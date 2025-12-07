
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AuctionState, AuctionStatus, Team, Player, AuctionLog, UserProfile, UserRole, AuctionContextType, AuctionCategory } from '../types';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';

const BID_INTERVAL = 30;

const initialState: AuctionState = {
  players: [],
  teams: [],
  unsoldPlayers: [],
  categories: [],
  status: AuctionStatus.NotStarted,
  currentPlayerId: null,
  currentPlayerIndex: null,
  currentBid: null,
  highestBidder: null,
  timer: BID_INTERVAL,
  bidIncrement: 10,
  auctionLog: [],
};

export const AuctionContext = createContext<AuctionContextType | null>(null);

export const AuctionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuctionState>(initialState);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAuctionId, setActiveAuctionId] = useState<string | null>(null);

  // Restore session & Derive Role
  useEffect(() => {
     const unsubscribe = auth.onAuthStateChanged((user) => {
         if (user) {
             if (user.isAnonymous) {
                 const storedSession = localStorage.getItem('sm_sports_team_session');
                 if (storedSession) {
                     const sessionData = JSON.parse(storedSession);
                     if (sessionData.role === 'TEAM_OWNER') {
                         setUserProfile({
                             uid: user.uid,
                             email: `team_${sessionData.teamId}`,
                             role: UserRole.TEAM_OWNER,
                             teamId: sessionData.teamId
                         });
                         if (sessionData.auctionId) setActiveAuctionId(sessionData.auctionId);
                         return;
                     }
                 }
             }

             if (user.email) {
                 if (user.email.startsWith('team_')) {
                     try {
                         const idPart = user.email.split('@')[0].split('_')[1];
                         setUserProfile({
                             uid: user.uid,
                             email: user.email,
                             role: UserRole.TEAM_OWNER,
                             teamId: idPart 
                         });
                     } catch (e) {
                         setUserProfile({ uid: user.uid, email: user.email, role: UserRole.VIEWER });
                     }
                 } else {
                     setUserProfile({ uid: user.uid, email: user.email, role: UserRole.ADMIN });
                 }
             } else {
                setUserProfile({ uid: user.uid, email: 'viewer', role: UserRole.VIEWER });
             }
         } else {
             setUserProfile(null);
             localStorage.removeItem('sm_sports_team_session');
         }
     });
     return () => unsubscribe();
  }, []);

  // MAIN LISTENER
  useEffect(() => {
    if (!activeAuctionId) return;

    const auctionDocRef = db.collection('auctions').doc(activeAuctionId);
    
    const unsubAuction = auctionDocRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
            setError(null);
            const data = docSnap.data() as any; 
            
            setState(prev => {
                // Find highest bidder object from the ID
                const highestBidder = prev.teams.find(t => String(t.id) === String(data.highestBidderId)) || null;
                
                return {
                    ...prev,
                    status: data.status || AuctionStatus.NotStarted,
                    currentBid: data.currentBid,
                    timer: data.timer || BID_INTERVAL,
                    currentPlayerId: data.currentPlayerId,
                    highestBidder,
                    bidIncrement: data.bidIncrement || 10
                };
            });
        } else {
            setError("Auction Not Found");
        }
    }, (err: any) => {
        console.error("Firestore Main Sync Error:", err);
        handleError(err);
    });

    const unsubTeams = auctionDocRef.collection('teams').onSnapshot((s) => {
        const teams = s.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        setState(p => ({ ...p, teams }));
    }, (err) => console.error("Teams sync error", err));

    const unsubPlayers = auctionDocRef.collection('players').onSnapshot((s) => {
        const players = s.docs.map(d => ({ id: d.id, ...d.data() } as Player));
        // Sort players: Number IDs first, then String IDs
        players.sort((a,b) => {
            const idA = Number(a.id);
            const idB = Number(b.id);
            if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
            return String(a.id).localeCompare(String(b.id));
        });
        
        setState(p => ({ ...p, players, unsoldPlayers: players }));
    }, (err) => console.error("Players sync error", err));

    const unsubCats = auctionDocRef.collection('categories').onSnapshot((s) => {
        const categories = s.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCategory));
        setState(p => ({ ...p, categories }));
    }, (err) => console.error("Categories sync error", err));

    const unsubLog = auctionDocRef.collection('log').orderBy('timestamp', 'desc').limit(50).onSnapshot((s) => {
         const auctionLog = s.docs.map(d => {
              const data = d.data();
              // Handle both Firestore Timestamp (object with toMillis) and standard Number
              let ts = Date.now();
              if (data.timestamp && typeof data.timestamp.toMillis === 'function') {
                  ts = data.timestamp.toMillis();
              } else if (typeof data.timestamp === 'number') {
                  ts = data.timestamp;
              }
              return { ...data, timestamp: ts } as AuctionLog;
          });
        setState(p => ({ ...p, auctionLog }));
    }, (err) => console.error("Log sync error", err));

    return () => {
        unsubAuction();
        unsubTeams();
        unsubPlayers();
        unsubCats();
        unsubLog();
    };
  }, [activeAuctionId]);

  const handleError = (err: any) => {
      if (err.message?.includes("database") || err.code === 'not-found') {
          setError("Database not found. Go to Firebase Console -> Firestore Database -> Create Database");
      } else if (err.code === 'permission-denied') {
          setError("Permission denied. Check Firestore Security Rules.");
      }
  };

  const joinAuction = (id: string) => {
      setActiveAuctionId(id);
  };

  // --- HELPER: CALCULATE NEXT BID (Central Source of Truth) ---
  const calculateNextBid = () => {
      const { currentPlayerIndex, unsoldPlayers, currentBid, categories, bidIncrement } = state;
      const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;
      if (!currentPlayer) return 0;

      const basePrice = Number(currentPlayer.basePrice || 0);
      const currentPrice = Number(currentBid || 0);

      // 1. Initial Bid Scenario: If no bid yet, next bid is exactly Base Price
      if (currentPrice === 0) {
          return basePrice;
      }

      // 2. Determine Increment: Check Slabs -> Category Default -> Global Default
      let effectiveIncrement = Number(bidIncrement || 10);
      
      if (categories.length > 0) {
          const playerCat = categories.find(c => c.name === currentPlayer.category);
          if (playerCat) {
              if (playerCat.slabs && playerCat.slabs.length > 0) {
                  // Find applicable slab
                  // Sort descending to find the highest matching slab
                  const activeSlab = [...playerCat.slabs]
                      .sort((a, b) => b.from - a.from) 
                      .find(s => currentPrice >= s.from);
                  
                  if (activeSlab) {
                      effectiveIncrement = Number(activeSlab.increment);
                  } else {
                      // If current price is below all slabs, fallback to cat default or global
                      if (playerCat.bidIncrement > 0) effectiveIncrement = Number(playerCat.bidIncrement);
                  }
              } else if (playerCat.bidIncrement > 0) {
                  effectiveIncrement = Number(playerCat.bidIncrement);
              }
          }
      }

      // 3. Calc
      // We take Max(Current, Base) just in case Base > Current (shouldn't happen with correct logic but good safety)
      const startPoint = Math.max(currentPrice, basePrice);
      return startPoint + effectiveIncrement;
  };

  const placeBid = async (teamId: number | string, amount: number) => {
      if (!activeAuctionId) return;
      const auctionRef = db.collection('auctions').doc(activeAuctionId);

      try {
        await db.runTransaction(async (transaction) => {
            const auctionSnap = await transaction.get(auctionRef);
            if (!auctionSnap.exists) throw "No auction";
            const data = auctionSnap.data() as any;

            if (data?.status !== AuctionStatus.InProgress) throw "Auction not in progress";
            
            const currentPlayerId = data?.currentPlayerId;
            if (!currentPlayerId) throw "No active player";

            // Fetch Player details inside transaction to get authoritative Base Price
            const playerRef = auctionRef.collection('players').doc(String(currentPlayerId));
            const playerSnap = await transaction.get(playerRef);
            if (!playerSnap.exists) throw "Player data missing";
            const playerData = playerSnap.data() as Player;
            const basePrice = Number(playerData.basePrice || 0);

            // Fetch Team
            const teamRef = auctionRef.collection('teams').doc(String(teamId));
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists) throw "Team not found";
            const teamData = teamSnap.data() as Team;

            // VALIDATION
            const currentHighest = Number(data?.currentBid || 0);
            
            // 1. Amount must be >= Base Price
            if (amount < basePrice) {
                throw `Bid (${amount}) cannot be lower than Base Price (${basePrice})`;
            }

            // 2. Amount must be > Current Highest (if it exists)
            // Note: If currentHighest is 0 (start of auction), any amount >= basePrice is valid.
            if (currentHighest > 0 && amount <= currentHighest) {
                throw `Bid (${amount}) must be higher than current bid (${currentHighest})`;
            }

            // 3. Budget Check
            if (Number(teamData.budget) < amount) throw "Insufficient funds";

            transaction.update(auctionRef, {
                currentBid: Number(amount),
                highestBidderId: String(teamId), // Force String ID
                timer: BID_INTERVAL 
            });

            const logRef = auctionRef.collection('log').doc();
            transaction.set(logRef, {
                message: `${teamData.name} bids ${amount}`,
                timestamp: Date.now(), 
                type: 'BID'
            });
        });
        console.log("Bid placed successfully");
      } catch (e: any) {
          console.error("Bid Error:", e);
          alert(`Bid Failed: ${e.message || e}`);
          throw e;
      }
  };

  // --- REFACTORED SELL PLAYER (FAIL-SAFE MODE) ---
  const sellPlayer = async (customTeamId?: string | number, customPrice?: number) => {
      if (!activeAuctionId) {
          alert("Error: No active auction ID. Try refreshing.");
          return;
      }
      
      const auctionRef = db.collection('auctions').doc(activeAuctionId);
      
      try {
        console.log("Starting Sell Process...");
        
        // 1. Get current auction state
        const auctionSnap = await auctionRef.get();
        if (!auctionSnap.exists) throw new Error("Auction not found");
        const auctionData = auctionSnap.data() as any;
        
        const currentPlayerId = auctionData.currentPlayerId;
        
        // Determine Winning Team and Price
        // If customTeamId is provided (from Modal), use it. Otherwise use highestBidderId from DB.
        let targetTeamId = customTeamId ? String(customTeamId) : auctionData.highestBidderId;
        if (targetTeamId) targetTeamId = String(targetTeamId); // Ensure string

        const finalBid = customPrice !== undefined ? Number(customPrice) : Number(auctionData.currentBid || 0);

        if (!currentPlayerId) throw new Error("No current player active.");
        if (!targetTeamId) throw new Error("No bidder found. Use 'Unsold' or select a team manually.");

        // 2. Get Data References
        const playerRef = auctionRef.collection('players').doc(String(currentPlayerId));
        const teamRef = auctionRef.collection('teams').doc(targetTeamId);
        
        const playerSnap = await playerRef.get();
        if (!playerSnap.exists) throw new Error("Player data missing");
        const playerData = playerSnap.data() as Player;

        const teamSnap = await teamRef.get();
        if (!teamSnap.exists) throw new Error("Winning team not found. ID: " + targetTeamId);
        
        // 3. READ-MODIFY-WRITE for Team Budget & Squad
        const teamData = teamSnap.data() as Team;
        const currentBudget = Number(teamData.budget || 0);
        const newBudget = currentBudget - finalBid;
        const currentPlayers = teamData.players || [];

        // Prepare Lightweight Player Object
        const playerSummary = {
            id: String(playerData.id),
            name: String(playerData.name || 'Unknown'),
            category: String(playerData.category || 'Uncategorized'),
            soldPrice: finalBid
        };

        // Create a new array with the player added
        const updatedPlayers = [...currentPlayers, playerSummary];

        // 4. Perform Updates (Sequential to ensure data integrity)
        
        // A. Update Team (Budget & Squad)
        await teamRef.update({
            budget: newBudget,
            players: updatedPlayers
        });

        // B. Update Player Status
        await playerRef.update({
            status: 'SOLD',
            soldPrice: finalBid,
            soldTo: teamData.name
        });

        // C. Reset Auction State
        await auctionRef.update({
            status: AuctionStatus.Paused,
            currentPlayerId: null,
            currentBid: null,
            highestBidderId: null,
            timer: BID_INTERVAL
        });

        // D. Log
        await auctionRef.collection('log').add({
            message: `SOLD! ${playerData.name} to ${teamData.name} for ${finalBid}`,
            timestamp: Date.now(),
            type: 'SOLD'
        });

        console.log("Sell Complete");

        // Auto-next
        setTimeout(() => startAuction(), 1500);

      } catch (e: any) {
          console.error("Sell Error:", e);
          alert("SELL FAILED: " + (e.message || e));
      }
  };

  const passPlayer = async () => {
      if (!activeAuctionId) return;
      const auctionRef = db.collection('auctions').doc(activeAuctionId);
      
      try {
        const docSnap = await auctionRef.get();
        const data = docSnap.data() as any;
        const currentPlayerId = data.currentPlayerId;

        let playerName = "Player";
        if (currentPlayerId) {
            const playerRef = auctionRef.collection('players').doc(String(currentPlayerId));
            const pDoc = await playerRef.get();
            if (pDoc.exists) {
                playerName = (pDoc.data() as any).name;
                // Mark Player as UNSOLD in their document
                await playerRef.update({ status: 'UNSOLD' });
            }
        }

        await auctionRef.update({
            status: AuctionStatus.Paused,
            currentPlayerId: null,
            currentBid: null,
            highestBidderId: null,
            timer: BID_INTERVAL
        });

        await auctionRef.collection('log').add({
            message: `UNSOLD: ${playerName}`,
            timestamp: Date.now(),
            type: 'UNSOLD'
        });

        setTimeout(() => startAuction(), 1500);

      } catch (e: any) {
          console.error("Pass Player Error", e);
          alert("Pass Failed: " + e.message);
      }
  };

  // Option 1: Reset ONLY the current player's bid status
  const resetCurrentPlayer = async () => {
      if (!activeAuctionId) {
          alert("Error: No active auction. Refresh page.");
          return;
      }
      
      try {
          const auctionRef = db.collection('auctions').doc(activeAuctionId);
          
          // Verify we have a current player before resetting
          const snap = await auctionRef.get();
          if (!snap.exists) throw new Error("Auction data missing");
          const data = snap.data();
          if (!data?.currentPlayerId) {
              alert("No player currently active to reset.");
              return;
          }

          await auctionRef.update({
              currentBid: 0,
              highestBidderId: null, // This effectively clears the bid
              timer: BID_INTERVAL
          });
          
          await auctionRef.collection('log').add({
              message: "Current Player Reset by Admin (Bids Cleared)",
              timestamp: Date.now(),
              type: 'SYSTEM'
          });
          alert("Player reset successfully. Bids cleared.");
      } catch(e: any) {
          console.error("Reset Player Failed:", e);
          alert("Reset Player Failed: " + e.message);
      }
  };

  // Option 2: Full Auction Reset
  const resetAuction = async () => {
    if (!activeAuctionId) {
        alert("Error: No active auction.");
        return;
    }
    
    try {
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        
        await auctionRef.update({
            status: AuctionStatus.NotStarted,
            currentPlayerId: null,
            currentBid: null,
            highestBidderId: null,
            timer: BID_INTERVAL,
        });
        
        await auctionRef.collection('log').add({
            message: 'FULL AUCTION RESET by Admin.',
            timestamp: Date.now(),
            type: 'SYSTEM'
        });

        alert("Auction Fully Reset to 'Not Started'.");
    } catch (e: any) {
        console.error("Full Reset Failed:", e);
        alert("Reset Failed: " + e.message);
    }
  };

  const startAuction = async () => {
    if (!activeAuctionId) return;
    try {
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        
        // Fetch all players
        const playersSnap = await auctionRef.collection('players').get();
        const players = playersSnap.docs.map(d => ({id: d.id, ...d.data()} as Player));
        
        // Sort players to maintain order
        players.sort((a,b) => {
            const idA = Number(a.id);
            const idB = Number(b.id);
            if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
            return String(a.id).localeCompare(String(b.id));
        });

        // Find next player who is NOT 'SOLD' and NOT 'UNSOLD'
        // This prevents infinite loops of the same player
        const nextPlayer = players.find(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');

        if (!nextPlayer) {
            await auctionRef.update({ status: AuctionStatus.Finished });
            alert("No more players available (All SOLD or UNSOLD). Auction Finished.");
            return;
        }

        // Set Current Bid to 0 initially so first bid can be Base Price
        await auctionRef.update({
            status: AuctionStatus.InProgress,
            currentPlayerId: nextPlayer.id,
            currentBid: 0, 
            highestBidderId: null,
            timer: BID_INTERVAL,
        });
        
        await auctionRef.collection('log').add({
            message: `Up for Auction: ${nextPlayer.name} (Base: ${nextPlayer.basePrice})`,
            timestamp: Date.now(),
            type: 'SYSTEM'
        });

    } catch (e: any) {
        console.error("Start Auction Error", e);
        alert("Start Failed: " + e.message);
    }
  };

  const handleLogout = () => {
      auth.signOut();
      setUserProfile(null);
      localStorage.removeItem('sm_sports_team_session');
  };

  const derivedCurrentPlayerIndex = state.players.findIndex(p => String(p.id) === String(state.currentPlayerId));
  const derivedState = { 
      ...state, 
      currentPlayerIndex: derivedCurrentPlayerIndex !== -1 ? derivedCurrentPlayerIndex : null 
  };

  return (
    <AuctionContext.Provider value={{ 
        state: derivedState, 
        userProfile, 
        setUserProfile,
        placeBid,
        sellPlayer,
        passPlayer,
        startAuction,
        resetAuction,
        resetCurrentPlayer,
        logout: handleLogout,
        error,
        joinAuction,
        activeAuctionId,
        nextBid: calculateNextBid()
    }}>
      {children}
    </AuctionContext.Provider>
  );
};
