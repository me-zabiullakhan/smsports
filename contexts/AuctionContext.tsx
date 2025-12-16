import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { 
    AuctionContextType, AuctionState, AuctionStatus, Player, Team, UserProfile, 
    UserRole, BidIncrementSlab, BiddingStatus, AdminViewOverride, SponsorConfig 
} from '../types';

const BID_INTERVAL = 15; // Seconds for timer reset on bid

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
    timer: 0,
    bidIncrement: 0,
    auctionLog: [],
    biddingStatus: 'ON',
    playerSelectionMode: 'AUTO',
    sponsors: [],
    sponsorConfig: { showOnOBS: true, showOnProjector: true, loopInterval: 5 },
    projectorLayout: 'STANDARD',
    obsLayout: 'STANDARD',
    adminViewOverride: null
};

export const AuctionContext = createContext<AuctionContextType | null>(null);

export const AuctionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuctionState>(initialState);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [activeAuctionId, setActiveAuctionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Calculate next bid
    const nextBid = React.useMemo(() => {
        const currentPrice = state.currentBid || (state.currentPlayerIndex !== null ? state.unsoldPlayers[state.currentPlayerIndex]?.basePrice : 0) || 0;
        
        // Check global slabs
        if (state.bidSlabs && state.bidSlabs.length > 0) {
            // Sort slabs desc to find matching range
            const sortedSlabs = [...state.bidSlabs].sort((a, b) => b.from - a.from);
            const activeSlab = sortedSlabs.find(s => currentPrice >= s.from);
            if (activeSlab) {
                return currentPrice + activeSlab.increment;
            }
        }
        
        // Check category slabs (override global)
        const currentPlayer = state.currentPlayerIndex !== null ? state.unsoldPlayers[state.currentPlayerIndex] : null;
        if (currentPlayer && currentPlayer.category) {
            const cat = state.categories.find(c => c.name === currentPlayer.category);
            if (cat && cat.slabs && cat.slabs.length > 0) {
                 const sortedSlabs = [...cat.slabs].sort((a, b) => b.from - a.from);
                 const activeSlab = sortedSlabs.find(s => currentPrice >= s.from);
                 if (activeSlab) {
                     return currentPrice + activeSlab.increment;
                 }
            }
            if (cat && cat.bidIncrement > 0) {
                return currentPrice + cat.bidIncrement;
            }
        }

        return currentPrice + (state.bidIncrement || 100); // Default fallback
    }, [state.currentBid, state.currentPlayerIndex, state.unsoldPlayers, state.bidIncrement, state.bidSlabs, state.categories]);

    // Auth Listener
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Check if admin
                if (!user.isAnonymous) {
                    // Try to fetch admin profile if stored, otherwise default to Admin
                    // For simplicity in this app, non-anonymous email/pass users are Admins
                    // Check if super admin (hardcoded or via custom claim in real app)
                    const isSuper = user.email?.includes('super'); 
                    setUserProfile({
                        uid: user.uid,
                        email: user.email || '',
                        name: user.displayName || 'Admin',
                        role: isSuper ? UserRole.SUPER_ADMIN : UserRole.ADMIN
                    });
                } else {
                    // Team Owner (Anonymous Auth)
                    // Retrieve session info from localStorage
                    const session = localStorage.getItem('sm_sports_team_session');
                    if (session) {
                        const data = JSON.parse(session);
                        setUserProfile({
                            uid: user.uid,
                            email: 'team@smsports.com',
                            role: UserRole.TEAM_OWNER,
                            teamId: data.teamId
                        });
                        joinAuction(data.auctionId);
                    }
                }
            } else {
                setUserProfile(null);
            }
        });
        return () => unsubscribe();
    }, []);

    const joinAuction = (id: string) => {
        setActiveAuctionId(id);
    };

    // Auction Data Listener
    useEffect(() => {
        if (!activeAuctionId) return;

        const unsubscribe = db.collection('auctions').doc(activeAuctionId)
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    const data = doc.data() as any;
                    
                    // Fetch Subcollections if needed (Teams, Players, Categories, Roles, Sponsors)
                    // For performance, we set up listeners for these subcollections
                    
                } else {
                    setError("Auction not found");
                }
            }, (err) => setError(err.message));

        // Subcollection Listeners
        const unsubPlayers = db.collection('auctions').doc(activeAuctionId).collection('players').onSnapshot(snap => {
            const players = snap.docs.map(d => ({id: d.id, ...d.data()} as Player));
            setState(prev => {
                // Derived Unsold
                const unsold = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
                // Re-calculate current index if needed
                let idx = prev.currentPlayerIndex;
                if (prev.currentPlayerId) {
                     idx = unsold.findIndex(p => String(p.id) === String(prev.currentPlayerId));
                     if (idx === -1) idx = null; // Player no longer in unsold
                }
                return { ...prev, players, unsoldPlayers: unsold, currentPlayerIndex: idx };
            });
        });

        const unsubTeams = db.collection('auctions').doc(activeAuctionId).collection('teams').onSnapshot(snap => {
            setState(prev => ({ ...prev, teams: snap.docs.map(d => ({id: d.id, ...d.data()} as Team)) }));
        });

        const unsubCategories = db.collection('auctions').doc(activeAuctionId).collection('categories').onSnapshot(snap => {
            setState(prev => ({ ...prev, categories: snap.docs.map(d => ({id: d.id, ...d.data()} as any)) }));
        });

        const unsubRoles = db.collection('auctions').doc(activeAuctionId).collection('roles').onSnapshot(snap => {
            setState(prev => ({ ...prev, roles: snap.docs.map(d => ({id: d.id, ...d.data()} as any)) }));
        });
        
        const unsubLog = db.collection('auctions').doc(activeAuctionId).collection('log')
            .orderBy('timestamp', 'desc').limit(50)
            .onSnapshot(snap => {
                setState(prev => ({ ...prev, auctionLog: snap.docs.map(d => d.data() as any) }));
            });
            
        const unsubSponsors = db.collection('auctions').doc(activeAuctionId).collection('sponsors').onSnapshot(snap => {
            setState(prev => ({ ...prev, sponsors: snap.docs.map(d => ({id: d.id, ...d.data()} as any)) }));
        });

        // Main Doc Listener for State Flags
        const unsubMain = db.collection('auctions').doc(activeAuctionId).onSnapshot(doc => {
            if(doc.exists) {
                const d = doc.data() as any;
                setState(prev => ({
                    ...prev,
                    status: d.status || AuctionStatus.NotStarted,
                    currentPlayerId: d.currentPlayerId,
                    currentBid: d.currentBid,
                    highestBidder: d.highestBidderId ? (prev.teams.find(t => String(t.id) === String(d.highestBidderId)) || null) : null,
                    timer: d.timer || 0,
                    bidIncrement: d.bidIncrement || 0,
                    bidSlabs: d.slabs || [],
                    biddingStatus: d.biddingStatus || 'ON',
                    playerSelectionMode: d.playerSelectionMode || 'AUTO',
                    auctionLogoUrl: d.logoUrl,
                    tournamentName: d.title,
                    sponsorConfig: d.sponsorConfig || prev.sponsorConfig,
                    projectorLayout: d.projectorLayout || 'STANDARD',
                    obsLayout: d.obsLayout || 'STANDARD',
                    adminViewOverride: d.adminViewOverride || null
                }));
            }
        });

        return () => {
            unsubscribe();
            unsubPlayers();
            unsubTeams();
            unsubCategories();
            unsubRoles();
            unsubLog();
            unsubSponsors();
            unsubMain();
        };
    }, [activeAuctionId]);

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
            if (!auctionSnap.exists) throw new Error("No auction");
            const data = auctionSnap.data() as any;

            if (data?.status !== AuctionStatus.InProgress) throw new Error("Auction not in progress");
            
            // Server side check (Skip for Admin)
            if (!isAdmin) {
                if (data?.biddingStatus && data.biddingStatus !== 'ON') throw new Error("Bidding is currently paused by Admin");
                if (data?.biddingEnabled === false && !data.biddingStatus) throw new Error("Bidding is currently paused by Admin");
            }
            
            const currentPlayerId = data?.currentPlayerId;
            if (!currentPlayerId) throw new Error("No active player");

            const playerRef = auctionRef.collection('players').doc(String(currentPlayerId));
            const playerSnap = await transaction.get(playerRef);
            if (!playerSnap.exists) throw new Error("Player data missing");
            const playerData = playerSnap.data() as Player;
            
            const teamRef = auctionRef.collection('teams').doc(String(teamId));
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists) throw new Error("Team not found");
            const teamData = teamSnap.data() as Team;

            // --- CATEGORY LIMIT CHECK ---
            const playerCategory = playerData.category;
            const categoryConfig = state.categories.find(c => c.name === playerCategory);
            
            if (categoryConfig && categoryConfig.maxPerTeam > 0) {
                const currentPlayers = teamData.players || [];
                // Count players in this specific category
                const categoryCount = currentPlayers.filter(p => p.category === playerCategory).length;
                
                if (categoryCount >= categoryConfig.maxPerTeam) {
                    throw new Error(`Limit Reached: Team can only buy ${categoryConfig.maxPerTeam} players in '${playerCategory}' category.`);
                }
            }
            
            const currentHighest = Number(data?.currentBid || 0);
            
            // Allow initial bid to be base price
            if (amount <= 0) throw new Error("Invalid Bid Amount");

            if (currentHighest > 0 && amount <= currentHighest) {
                throw new Error(`Bid (${amount}) must be higher than current bid (${currentHighest})`);
            }

            if (Number(teamData.budget) < amount) throw new Error("Insufficient funds");

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
      } catch (e: any) {
          console.error("Bid Error:", e);
          alert(`Bid Failed: ${e.message || e}`);
          throw e;
      }
    };

    const startAuction = async (specificPlayerId?: string | number) => {
        if (!activeAuctionId) return false;
        
        let nextPlayer: Player | undefined;

        if (specificPlayerId) {
            nextPlayer = state.players.find(p => String(p.id) === String(specificPlayerId));
        } else {
            // Auto Select Random
            const available = state.players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
            if (available.length === 0) return false;
            const randomIndex = Math.floor(Math.random() * available.length);
            nextPlayer = available[randomIndex];
        }

        if (!nextPlayer) return false;

        await db.collection('auctions').doc(activeAuctionId).update({
            status: AuctionStatus.InProgress,
            currentPlayerId: nextPlayer.id,
            currentBid: 0,
            highestBidderId: null,
            timer: 30
        });

        await db.collection('auctions').doc(activeAuctionId).collection('log').add({
            message: `Auction started for ${nextPlayer.name}`,
            timestamp: Date.now(),
            type: 'SYSTEM'
        });
        
        return true;
    };

    const sellPlayer = async (teamId?: string | number, customPrice?: number) => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        
        const price = customPrice || state.currentBid || 0;
        const winnerId = teamId || state.highestBidder?.id;

        if (!winnerId || price <= 0) {
            alert("No valid bidder or price.");
            return;
        }

        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        
        try {
            await db.runTransaction(async (t) => {
                const teamRef = auctionRef.collection('teams').doc(String(winnerId));
                const teamSnap = await t.get(teamRef);
                if (!teamSnap.exists) throw "Team not found";
                const teamData = teamSnap.data() as Team;

                const playerRef = auctionRef.collection('players').doc(String(state.currentPlayerId));
                const playerSnap = await t.get(playerRef);
                const playerData = playerSnap.data() as Player;

                const newBudget = teamData.budget - price;
                if (newBudget < 0) throw "Budget mismatch during sale";

                const updatedPlayer = { ...playerData, status: 'SOLD', soldPrice: price, soldTo: teamData.name };
                
                t.update(playerRef, { status: 'SOLD', soldPrice: price, soldTo: teamData.name });
                t.update(teamRef, {
                    budget: newBudget,
                    players: firebase.firestore.FieldValue.arrayUnion(updatedPlayer)
                });
                
                t.update(auctionRef, {
                    status: AuctionStatus.Sold,
                    timer: 0
                });

                const logRef = auctionRef.collection('log').doc();
                t.set(logRef, {
                    message: `${playerData.name} SOLD to ${teamData.name} for ${price}`,
                    timestamp: Date.now(),
                    type: 'SOLD'
                });
            });
        } catch (e: any) {
            console.error(e);
            alert("Sale failed: " + e.message);
        }
    };

    const passPlayer = async () => {
         if (!activeAuctionId || !state.currentPlayerId) return;
         
         const playerRef = db.collection('auctions').doc(activeAuctionId).collection('players').doc(String(state.currentPlayerId));
         const playerSnap = await playerRef.get();
         const playerName = playerSnap.data()?.name || "Player";

         await playerRef.update({ status: 'UNSOLD' });
         await db.collection('auctions').doc(activeAuctionId).update({
             status: AuctionStatus.Unsold,
             timer: 0
         });
         
         await db.collection('auctions').doc(activeAuctionId).collection('log').add({
            message: `${playerName} marked UNSOLD`,
            timestamp: Date.now(),
            type: 'UNSOLD'
        });
    };
    
    const correctPlayerSale = async (playerId: string, newTeamId: string | null, newPrice: number) => {
        // Advanced admin feature - implement if needed
    };

    const endAuction = async () => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({
            status: AuctionStatus.Finished,
            currentPlayerId: null
        });
    };

    const resetAuction = async () => {
        if (!activeAuctionId) return;
        
        const batch = db.batch();
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        
        // Reset Auction State
        batch.update(auctionRef, {
            status: AuctionStatus.NotStarted,
            currentPlayerId: null,
            currentBid: 0,
            highestBidderId: null,
            timer: 0
        });

        // Reset Players
        const playersSnap = await auctionRef.collection('players').get();
        playersSnap.forEach(doc => {
            batch.update(doc.ref, { status: null, soldPrice: 0, soldTo: null });
        });

        // Reset Teams (Clear Players, Reset Budget)
        // NOTE: Budget reset requires original budget. Assuming purseValue in auction doc.
        const auctionSnap = await auctionRef.get();
        const purseValue = auctionSnap.data()?.purseValue || 10000;
        
        const teamsSnap = await auctionRef.collection('teams').get();
        teamsSnap.forEach(doc => {
            batch.update(doc.ref, { budget: purseValue, players: [] });
        });
        
        // Clear Log
        // Note: Batch limit is 500. If log is huge, this might fail. Ideally delete collection via cloud function.
        // For client side, we might just leave logs or delete recent ones.
        
        await batch.commit();
    };

    const resetCurrentPlayer = async () => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({
            currentBid: 0,
            highestBidderId: null,
            timer: 30 // Restart timer
        });
    };

    const resetUnsoldPlayers = async () => {
        if (!activeAuctionId) return;
        const batch = db.batch();
        const unsoldSnap = await db.collection('auctions').doc(activeAuctionId).collection('players').where('status', '==', 'UNSOLD').get();
        unsoldSnap.forEach(doc => {
            batch.update(doc.ref, { status: null });
        });
        await batch.commit();
    };

    const updateBiddingStatus = async (status: BiddingStatus) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ biddingStatus: status });
    };

    const toggleSelectionMode = async () => {
        if (!activeAuctionId) return;
        const newMode = state.playerSelectionMode === 'AUTO' ? 'MANUAL' : 'AUTO';
        await db.collection('auctions').doc(activeAuctionId).update({ playerSelectionMode: newMode });
    };

    const updateTheme = async (type: 'PROJECTOR' | 'OBS', layout: string) => {
        if (!activeAuctionId) return;
        if (type === 'PROJECTOR') {
            await db.collection('auctions').doc(activeAuctionId).update({ projectorLayout: layout });
        } else {
            await db.collection('auctions').doc(activeAuctionId).update({ obsLayout: layout });
        }
    };

    const setAdminView = async (view: AdminViewOverride | null) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ adminViewOverride: view });
    };

    const logout = async () => {
        await auth.signOut();
        localStorage.removeItem('sm_sports_team_session');
        setUserProfile(null);
    };

    return (
        <AuctionContext.Provider value={{
            state,
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
            updateBiddingStatus,
            toggleSelectionMode,
            updateTheme,
            setAdminView,
            logout,
            error,
            joinAuction,
            activeAuctionId,
            nextBid
        }}>
            {children}
        </AuctionContext.Provider>
    );
};
