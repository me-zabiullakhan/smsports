
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AuctionState, AuctionStatus, Team, Player, AuctionLog, UserProfile, UserRole, AuctionContextType, AuctionCategory, Sponsor, ProjectorLayout, OBSLayout, AdminViewOverride, BiddingStatus, PlayerRole } from '../types';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';

const BID_INTERVAL = 30;
const SUPER_ADMIN_EMAIL = "superadmin@smsports.com";

const initialState: AuctionState = {
  players: [],
  teams: [],
  unsoldPlayers: [],
  categories: [],
  roles: [],
  status: AuctionStatus.NotStarted,
  currentPlayerId: null,
  currentPlayerIndex: null,
  currentBid: null,
  highestBidder: null,
  timer: BID_INTERVAL,
  bidIncrement: 10,
  bidSlabs: [],
  auctionLog: [],
  biddingStatus: 'ON', // Default ON
  playerSelectionMode: 'MANUAL',
  sponsors: [],
  sponsorConfig: { showOnOBS: true, showOnProjector: true, loopInterval: 5 },
  auctionLogoUrl: '',
  tournamentName: '',
  projectorLayout: 'STANDARD',
  obsLayout: 'STANDARD',
  adminViewOverride: null
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
                             name: `Team ${sessionData.teamId}`,
                             role: UserRole.TEAM_OWNER,
                             teamId: sessionData.teamId
                         });
                         if (sessionData.auctionId) setActiveAuctionId(sessionData.auctionId);
                         return;
                     }
                 }
             }

             if (user.email) {
                 if (user.email === SUPER_ADMIN_EMAIL) {
                     // SUPER ADMIN ROLE
                     setUserProfile({
                         uid: user.uid,
                         email: user.email,
                         name: "Super Owner",
                         role: UserRole.SUPER_ADMIN
                     });
                 } else if (user.email.startsWith('team_')) {
                     try {
                         const idPart = user.email.split('@')[0].split('_')[1];
                         setUserProfile({
                             uid: user.uid,
                             email: user.email,
                             name: user.displayName || `Team ${idPart}`,
                             role: UserRole.TEAM_OWNER,
                             teamId: idPart 
                         });
                     } catch (e) {
                         setUserProfile({ uid: user.uid, email: user.email, name: 'Viewer', role: UserRole.VIEWER });
                     }
                 } else {
                     // ADMIN ROLE
                     setUserProfile({ 
                         uid: user.uid, 
                         email: user.email, 
                         name: user.displayName || user.email.split('@')[0], // Prioritize displayName
                         role: UserRole.ADMIN 
                     });
                 }
             } else {
                setUserProfile({ uid: user.uid, email: 'viewer', name: 'Guest', role: UserRole.VIEWER });
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
                const highestBidder = prev.teams.find(t => String(t.id) === String(data.highestBidderId)) || null;
                
                // BACKWARD COMPATIBILITY: If biddingStatus missing, assume ON (unless biddingEnabled was specifically false)
                let status: BiddingStatus = 'ON';
                if (data.biddingStatus) {
                    status = data.biddingStatus;
                } else if (data.biddingEnabled === false) {
                    status = 'PAUSED';
                }

                return {
                    ...prev,
                    status: data.status || AuctionStatus.NotStarted,
                    currentBid: data.currentBid,
                    timer: data.timer || BID_INTERVAL,
                    currentPlayerId: data.currentPlayerId,
                    highestBidder,
                    bidIncrement: data.bidIncrement || 10,
                    bidSlabs: data.slabs || [],
                    biddingStatus: status,
                    playerSelectionMode: data.playerSelectionMode || 'MANUAL',
                    auctionLogoUrl: data.logoUrl || '',
                    tournamentName: data.title || '',
                    sponsorConfig: data.sponsorConfig || { showOnOBS: true, showOnProjector: true, loopInterval: 5 },
                    projectorLayout: data.projectorLayout || 'STANDARD',
                    obsLayout: data.obsLayout || 'STANDARD',
                    adminViewOverride: data.adminViewOverride || null
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

    const unsubRoles = auctionDocRef.collection('roles').onSnapshot((s) => {
        const roles = s.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole));
        setState(p => ({ ...p, roles }));
    }, (err) => console.error("Roles sync error", err));

    const unsubSponsors = auctionDocRef.collection('sponsors').onSnapshot((s) => {
        const sponsors = s.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor));
        setState(p => ({ ...p, sponsors }));
    }, (err) => console.error("Sponsors sync error", err));

    const unsubLog = auctionDocRef.collection('log').orderBy('timestamp', 'desc').limit(50).onSnapshot((s) => {
         const auctionLog = s.docs.map(d => {
              const data = d.data();
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
        unsubRoles();
        unsubSponsors();
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

  // --- CORE BIDDING ENGINE ---
  const calculateNextBid = () => {
      const { currentPlayerId, players, currentBid, categories, roles, bidIncrement, bidSlabs } = state;
      const currentPlayer = players.find(p => String(p.id) === String(currentPlayerId));
      if (!currentPlayer) return 0;

      const currentPrice = Number(currentBid || 0);

      // --- 1. DETERMINE EFFECTIVE BASE PRICE ---
      // Logic:
      // A. If Player has a Category (e.g. 'MVP'), use Category's base price.
      // B. If NOT (or category has no price), check if Player has a Role (e.g. 'Batsman'). Use Role's base price.
      // C. Fallback to the individual player's basePrice (usually imported/set during add).
      
      let effectiveBasePrice = Number(currentPlayer.basePrice || 0);
      let rulesSource: 'CATEGORY' | 'GLOBAL' = 'GLOBAL';
      let activeCategory: AuctionCategory | undefined;

      // Check Category
      if (currentPlayer.category) {
          activeCategory = categories.find(c => c.name === currentPlayer.category);
          if (activeCategory) {
              if (activeCategory.basePrice > 0) {
                  effectiveBasePrice = activeCategory.basePrice;
                  rulesSource = 'CATEGORY'; // We found a category, so we prefer its slabs
              }
          }
      }

      // Check Role (Only if Category didn't override base price or wasn't found)
      // Note: The prompt says "If assigned to any category follow base price... if not assigned... have default base price as defined while creating player type"
      // So if activeCategory exists, we stick with it (even if basePrice was 0, it implies category determines it).
      // But if activeCategory is missing (e.g. 'Uncategorized'), we check Role.
      if (!activeCategory && currentPlayer.role) {
          const activeRole = roles.find(r => r.name === currentPlayer.role);
          if (activeRole && activeRole.basePrice > 0) {
              effectiveBasePrice = activeRole.basePrice;
          }
      }

      // If this is the FIRST bid
      if (currentPrice === 0) {
          return effectiveBasePrice > 0 ? effectiveBasePrice : 0;
      }

      // --- 2. DETERMINE INCREMENT / SLABS ---
      let effectiveIncrement = Number(bidIncrement || 10);
      let ruleFound = false;
      
      // If we are following Category rules
      if (activeCategory) {
          if (activeCategory.slabs && activeCategory.slabs.length > 0) {
              const activeSlab = [...activeCategory.slabs].sort((a, b) => b.from - a.from).find(s => currentPrice >= s.from);
              if (activeSlab) {
                  effectiveIncrement = Number(activeSlab.increment);
                  ruleFound = true;
              }
          }
          if (!ruleFound && activeCategory.bidIncrement > 0) {
              effectiveIncrement = Number(activeCategory.bidIncrement);
              ruleFound = true;
          }
      }

      // If no category rule found, check Global Slabs
      if (!ruleFound && bidSlabs && bidSlabs.length > 0) {
          const activeSlab = [...bidSlabs].sort((a, b) => b.from - a.from).find(s => currentPrice >= s.from);
          if (activeSlab) {
              effectiveIncrement = Number(activeSlab.increment);
              ruleFound = true; 
          }
      }

      const startPoint = Math.max(currentPrice, effectiveBasePrice);
      return startPoint + effectiveIncrement;
  };

  const updateBiddingStatus = async (status: BiddingStatus) => {
      if (!activeAuctionId) return;
      try {
          await db.collection('auctions').doc(activeAuctionId).update({
              biddingStatus: status,
              biddingEnabled: status === 'ON' // Maintain legacy field
          });
      } catch(e: any) {
          console.error("Toggle Bidding Error", e);
          alert("Failed to toggle bidding: " + e.message);
      }
  };

  const toggleSelectionMode = async () => {
      if (!activeAuctionId) return;
      try {
          const newMode = state.playerSelectionMode === 'AUTO' ? 'MANUAL' : 'AUTO';
          await db.collection('auctions').doc(activeAuctionId).update({
              playerSelectionMode: newMode
          });
      } catch(e: any) {
          console.error("Toggle Selection Mode Error", e);
      }
  };

  const updateTheme = async (type: 'PROJECTOR' | 'OBS', layout: string) => {
      if (!activeAuctionId) return;
      try {
          const updateData = type === 'PROJECTOR' ? { projectorLayout: layout } : { obsLayout: layout };
          await db.collection('auctions').doc(activeAuctionId).update(updateData);
      } catch(e: any) {
          console.error("Update Theme Error", e);
      }
  };

  const setAdminView = async (view: AdminViewOverride | null) => {
      if (!activeAuctionId) return;
      try {
          await db.collection('auctions').doc(activeAuctionId).update({
              adminViewOverride: view
          });
      } catch (e: any) {
          console.error("Set Admin View Error", e);
      }
  };

  const placeBid = async (teamId: number | string, amount: number) => {
      if (!activeAuctionId) return;
      
      const isAdmin = userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.SUPER_ADMIN;

      // STRICT EXCLUSIVE CHECK:
      // If not Admin, enforce Bidding Status
      if (!isAdmin && state.biddingStatus !== 'ON') {
          alert("Bidding is currently disabled by the Admin.");
          return;
      }

      const auctionRef = db.collection('auctions').doc(activeAuctionId);

      try {
        await db.runTransaction(async (transaction) => {
            const auctionSnap = await transaction.get(auctionRef);
            if (!auctionSnap.exists) throw "No auction";
            const data = auctionSnap.data() as any;

            if (data?.status !== AuctionStatus.InProgress) throw "Auction not in progress";
            
            // Server side check (Skip for Admin)
            if (!isAdmin) {
                if (data?.biddingStatus && data.biddingStatus !== 'ON') throw "Bidding is currently paused by Admin";
                if (data?.biddingEnabled === false && !data.biddingStatus) throw "Bidding is currently paused by Admin";
            }
            
            const currentPlayerId = data?.currentPlayerId;
            if (!currentPlayerId) throw "No active player";

            const playerRef = auctionRef.collection('players').doc(String(currentPlayerId));
            const playerSnap = await transaction.get(playerRef);
            if (!playerSnap.exists) throw "Player data missing";
            const playerData = playerSnap.data() as Player;
            // Note: Server-side validation logic mirrors calculateNextBid mostly, 
            // but for safety we check against the passed 'amount' vs currentBid.
            
            const teamRef = auctionRef.collection('teams').doc(String(teamId));
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists) throw "Team not found";
            const teamData = teamSnap.data() as Team;

            const currentHighest = Number(data?.currentBid || 0);
            
            // Allow initial bid to be base price
            if (amount <= 0) throw "Invalid Bid Amount";

            if (currentHighest > 0 && amount <= currentHighest) {
                throw `Bid (${amount}) must be higher than current bid (${currentHighest})`;
            }

            if (Number(teamData.budget) < amount) throw "Insufficient funds";

            transaction.update(auctionRef, {
                currentBid: Number(amount),
                highestBidderId: String(teamId),
                timer: BID_INTERVAL 
            });

            const logRef = auctionRef.collection('log').doc();
            transaction.set(logRef, {
                message: `${teamData.name} bids ${amount} ${isAdmin ? '(Admin)' : ''}`,
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

  const correctPlayerSale = async (playerId: string, newTeamId: string | null, newPrice: number) => {
      if (!activeAuctionId) return;
      const auctionRef = db.collection('auctions').doc(activeAuctionId);

      try {
          await db.runTransaction(async (transaction) => {
              const playerRef = auctionRef.collection('players').doc(playerId);
              const playerSnap = await transaction.get(playerRef);
              if (!playerSnap.exists) throw "Player not found";
              const playerData = playerSnap.data() as Player;

              if (playerData.status === 'SOLD' && playerData.soldTo) {
                  const oldTeamObj = state.teams.find(t => t.name === playerData.soldTo);
                  
                  if (oldTeamObj) {
                      const oldTeamRef = auctionRef.collection('teams').doc(String(oldTeamObj.id));
                      const oldTeamSnap = await transaction.get(oldTeamRef);
                      if (oldTeamSnap.exists) {
                          const oldTeamData = oldTeamSnap.data() as Team;
                          const refundAmount = Number(playerData.soldPrice || 0);
                          const updatedBudget = Number(oldTeamData.budget) + refundAmount;
                          const updatedPlayers = (oldTeamData.players || []).filter(p => String(p.id) !== String(playerId));
                          transaction.update(oldTeamRef, {
                              budget: updatedBudget,
                              players: updatedPlayers
                          });
                      }
                  }
              }

              if (newTeamId) {
                  const newTeamRef = auctionRef.collection('teams').doc(newTeamId);
                  const newTeamSnap = await transaction.get(newTeamRef);
                  if (!newTeamSnap.exists) throw "New Team not found";
                  const newTeamData = newTeamSnap.data() as Team;

                  if (Number(newTeamData.budget) < newPrice) {
                      throw `Team ${newTeamData.name} has insufficient budget (${newTeamData.budget}) for correction price ${newPrice}`;
                  }

                  const newBudget = Number(newTeamData.budget) - Number(newPrice);
                  const playerSummary = {
                      id: String(playerData.id),
                      name: String(playerData.name),
                      category: String(playerData.category),
                      soldPrice: Number(newPrice)
                  };

                  const currentPlayers = newTeamData.players || [];
                  const filteredPlayers = currentPlayers.filter(p => String(p.id) !== String(playerId));
                  
                  transaction.update(newTeamRef, {
                      budget: newBudget,
                      players: [...filteredPlayers, playerSummary]
                  });

                  transaction.update(playerRef, {
                      status: 'SOLD',
                      soldPrice: Number(newPrice),
                      soldTo: newTeamData.name
                  });
              } else {
                  transaction.update(playerRef, {
                      status: firebase.firestore.FieldValue.delete(),
                      soldPrice: firebase.firestore.FieldValue.delete(),
                      soldTo: firebase.firestore.FieldValue.delete()
                  });
              }

              const logRef = auctionRef.collection('log').doc();
              transaction.set(logRef, {
                  message: `ADMIN CORRECTION: ${playerData.name} ${newTeamId ? 'reassigned' : 'unsold'}.`,
                  timestamp: Date.now(),
                  type: 'SYSTEM'
              });
          });
      } catch (e: any) {
          console.error("Correction Error:", e);
          throw e; 
      }
  };

  const sellPlayer = async (customTeamId?: string | number, customPrice?: number) => {
      if (!activeAuctionId) {
          alert("Error: No active auction ID. Try refreshing.");
          return;
      }
      const auctionRef = db.collection('auctions').doc(activeAuctionId);
      
      try {
        console.log("Starting Sell Process...");
        const auctionSnap = await auctionRef.get();
        if (!auctionSnap.exists) throw new Error("Auction not found");
        const auctionData = auctionSnap.data() as any;
        const currentPlayerId = auctionData.currentPlayerId;
        
        let targetTeamId = customTeamId ? String(customTeamId) : auctionData.highestBidderId;
        if (targetTeamId) targetTeamId = String(targetTeamId); 

        const finalBid = customPrice !== undefined ? Number(customPrice) : Number(auctionData.currentBid || 0);

        if (!currentPlayerId) throw new Error("No current player active.");
        if (!targetTeamId) throw new Error("No bidder found. Use 'Unsold' or select a team manually.");

        const playerRef = auctionRef.collection('players').doc(String(currentPlayerId));
        const teamRef = auctionRef.collection('teams').doc(targetTeamId);
        
        const playerSnap = await playerRef.get();
        if (!playerSnap.exists) throw new Error("Player data missing");
        const playerData = playerSnap.data() as Player;

        const teamSnap = await teamRef.get();
        if (!teamSnap.exists) throw new Error("Winning team not found. ID: " + targetTeamId);
        
        const teamData = teamSnap.data() as Team;
        const currentBudget = Number(teamData.budget || 0);
        const newBudget = currentBudget - finalBid;
        const currentPlayers = teamData.players || [];

        const playerSummary = {
            id: String(playerData.id),
            name: String(playerData.name || 'Unknown'),
            category: String(playerData.category || 'Uncategorized'),
            soldPrice: finalBid
        };

        const updatedPlayers = [...currentPlayers, playerSummary];

        await teamRef.update({ budget: newBudget, players: updatedPlayers });
        await playerRef.update({ status: 'SOLD', soldPrice: finalBid, soldTo: teamData.name });

        await auctionRef.update({
            status: AuctionStatus.Sold,
            currentBid: null,
            highestBidderId: null,
            timer: BID_INTERVAL
        });

        await auctionRef.collection('log').add({
            message: `SOLD! ${playerData.name} to ${teamData.name} for ${finalBid}`,
            timestamp: Date.now(),
            type: 'SOLD'
        });

        if (state.playerSelectionMode === 'AUTO') {
             setTimeout(() => startAuction(), 3000);
        }

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
                await playerRef.update({ status: 'UNSOLD' });
            }
        }

        await auctionRef.update({
            status: AuctionStatus.Unsold,
            currentBid: null,
            highestBidderId: null,
            timer: BID_INTERVAL
        });

        await auctionRef.collection('log').add({
            message: `UNSOLD: ${playerName}`,
            timestamp: Date.now(),
            type: 'UNSOLD'
        });

        if (state.playerSelectionMode === 'AUTO') {
             setTimeout(() => startAuction(), 3000);
        }

      } catch (e: any) {
          console.error("Pass Player Error", e);
          alert("Pass Failed: " + e.message);
      }
  };

  const resetCurrentPlayer = async () => {
      if (!activeAuctionId) {
          alert("Error: No active auction. Refresh page.");
          return;
      }
      try {
          const auctionRef = db.collection('auctions').doc(activeAuctionId);
          await auctionRef.update({
              currentBid: 0,
              highestBidderId: null, 
              timer: BID_INTERVAL,
              status: AuctionStatus.InProgress 
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

  const resetAuction = async () => {
    if (!activeAuctionId) {
        alert("Error: No active auction.");
        return;
    }
    
    try {
        console.log("Starting Full Reset...");
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        
        const auctionSnap = await auctionRef.get();
        if (!auctionSnap.exists) throw new Error("Auction data not found");
        const auctionData = auctionSnap.data() as any;
        const defaultPurse = Number(auctionData.purseValue) || 10000;

        const teamsSnap = await auctionRef.collection('teams').get();
        const playersSnap = await auctionRef.collection('players').get();
        const logsSnap = await auctionRef.collection('log').get();

        const batch = db.batch();

        batch.update(auctionRef, {
            status: AuctionStatus.NotStarted,
            currentPlayerId: null,
            currentBid: null,
            highestBidderId: null,
            timer: BID_INTERVAL,
            adminViewOverride: null 
        });

        teamsSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                budget: defaultPurse,
                players: []
            });
        });

        playersSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                status: firebase.firestore.FieldValue.delete(),
                soldPrice: firebase.firestore.FieldValue.delete(),
                soldTo: firebase.firestore.FieldValue.delete()
            });
        });

        logsSnap.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();

        await auctionRef.collection('log').add({
            message: 'FULL AUCTION RESET by Admin. All data restored.',
            timestamp: Date.now(),
            type: 'SYSTEM'
        });

        alert("Auction Fully Reset to 'Not Started'. Teams and Players restored.");
    } catch (e: any) {
        console.error("Full Reset Failed:", e);
        alert("Reset Failed: " + e.message);
    }
  };

  const endAuction = async () => {
      if (!activeAuctionId) return;
      await db.collection('auctions').doc(activeAuctionId).update({ 
          status: AuctionStatus.Finished,
          currentPlayerId: null,
          currentBid: null,
          highestBidderId: null,
          adminViewOverride: null
      });
      await db.collection('auctions').doc(activeAuctionId).collection('log').add({
          message: "Auction Manually Completed by Admin.",
          timestamp: Date.now(),
          type: 'SYSTEM'
      });
  }

  const startAuction = async (specificPlayerId?: string | number): Promise<boolean> => {
    if (!activeAuctionId) return false;
    try {
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        const playersSnap = await auctionRef.collection('players').get();
        const players = playersSnap.docs.map(d => ({id: d.id, ...d.data()} as Player));
        let nextPlayer: Player | undefined;

        if (specificPlayerId) {
             nextPlayer = players.find(p => String(p.id) === String(specificPlayerId));
        } else {
             const availablePlayers = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
             if (state.playerSelectionMode === 'AUTO') {
                 if (availablePlayers.length > 0) {
                     const randomIndex = Math.floor(Math.random() * availablePlayers.length);
                     nextPlayer = availablePlayers[randomIndex];
                 }
             } else {
                 availablePlayers.sort((a,b) => {
                    const idA = Number(a.id);
                    const idB = Number(b.id);
                    if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
                    return String(a.id).localeCompare(String(b.id));
                 });
                 nextPlayer = availablePlayers[0];
             }
        }

        if (!nextPlayer) {
            return false;
        }

        await auctionRef.update({
            status: AuctionStatus.InProgress,
            currentPlayerId: nextPlayer.id,
            currentBid: 0, 
            highestBidderId: null,
            timer: BID_INTERVAL,
            adminViewOverride: null
        });
        
        await auctionRef.collection('log').add({
            message: `Up for Auction: ${nextPlayer.name} (Base: ${nextPlayer.basePrice})`,
            timestamp: Date.now(),
            type: 'SYSTEM'
        });

        return true;

    } catch (e: any) {
        console.error("Start Auction Error", e);
        alert("Start Failed: " + e.message);
        return false;
    }
  };

  const resetUnsoldPlayers = async () => {
      if (!activeAuctionId) return;
      try {
          const auctionRef = db.collection('auctions').doc(activeAuctionId);
          const snapshot = await auctionRef.collection('players').where('status', '==', 'UNSOLD').get();
          
          if (snapshot.empty) {
              alert("No unsold players found to reset.");
              return;
          }

          const batch = db.batch();
          snapshot.docs.forEach(doc => {
              batch.update(doc.ref, { status: firebase.firestore.FieldValue.delete() });
          });
          
          await batch.commit();

          await auctionRef.collection('log').add({
              message: `ADMIN ACTION: ${snapshot.size} Unsold Players returned to pool.`,
              timestamp: Date.now(),
              type: 'SYSTEM'
          });
          alert(`${snapshot.size} Unsold players have been moved back to the available pool.`);
      } catch (e: any) {
          console.error("Error resetting unsold:", e);
          alert("Failed to delete unsold status: " + e.message);
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
        correctPlayerSale,
        startAuction,
        endAuction,
        resetAuction,
        resetCurrentPlayer,
        resetUnsoldPlayers,
        updateBiddingStatus, // Replaces toggleBidding
        toggleSelectionMode,
        updateTheme,
        setAdminView,
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
