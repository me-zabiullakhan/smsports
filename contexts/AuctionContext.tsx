
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { AuctionContextType, AuctionState, UserProfile, Team, Player, AuctionStatus, BiddingStatus, AdminViewOverride, BidIncrementSlab, UserRole, SponsorConfig } from '../types';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';

// Initial State
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
    bidSlabs: [],
    auctionLog: [],
    biddingStatus: 'PAUSED',
    playerSelectionMode: 'MANUAL',
    auctionLogoUrl: '',
    tournamentName: '',
    sponsors: [],
    sponsorConfig: { showOnOBS: false, showOnProjector: false, loopInterval: 5 },
    projectorLayout: 'STANDARD',
    obsLayout: 'STANDARD',
    adminViewOverride: null,
};

export const AuctionContext = createContext<AuctionContextType | null>(null);

export const AuctionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuctionState>(initialState);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [activeAuctionId, setActiveAuctionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Auth Listener
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Check if user is anonymous (Team Owner usually) or Google/Email (Admin)
                if (user.isAnonymous) {
                    // Try to recover session from localStorage if exists
                    const session = localStorage.getItem('sm_sports_team_session');
                    if (session) {
                        const data = JSON.parse(session);
                        setUserProfile({
                            uid: user.uid,
                            email: 'team@smsports.com',
                            role: UserRole.TEAM_OWNER,
                            teamId: data.teamId
                        });
                        if (data.auctionId) joinAuction(data.auctionId);
                    } else {
                        // Just a viewer or lost session
                        setUserProfile({ uid: user.uid, email: 'viewer@smsports.com', role: UserRole.VIEWER });
                    }
                } else {
                    // Admin
                    setUserProfile({
                        uid: user.uid,
                        email: user.email || '',
                        name: user.displayName || '',
                        role: user.email === 'admin@smsports.com' ? UserRole.SUPER_ADMIN : UserRole.ADMIN
                    });
                }
            } else {
                setUserProfile(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Auction Listener
    useEffect(() => {
        if (!activeAuctionId) return;

        const unsubscribe = db.collection('auctions').doc(activeAuctionId).onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (data) {
                    setState(prev => ({
                        ...prev,
                        ...data,
                        // Explicitly map 'slabs' from DB to 'bidSlabs' in state
                        bidSlabs: data.slabs || [],
                        // Explicitly map Title and Logo for display
                        tournamentName: data.title || prev.tournamentName,
                        auctionLogoUrl: data.logoUrl || prev.auctionLogoUrl,
                        // Ensure sponsorConfig has defaults
                        sponsorConfig: data.sponsorConfig || prev.sponsorConfig || { showOnOBS: false, showOnProjector: false, loopInterval: 5 }
                    }));
                }
            } else {
                setError("Auction not found");
            }
        }, (err) => {
            console.error("Auction Listener Error", err);
            setError(err.message);
        });

        // Listen to Subcollections
        const unsubTeams = db.collection('auctions').doc(activeAuctionId).collection('teams').onSnapshot(snap => {
            const teams = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
            setState(prev => ({ ...prev, teams }));
        });

        const unsubPlayers = db.collection('auctions').doc(activeAuctionId).collection('players').onSnapshot(snap => {
            const allPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
            setState(prev => ({ ...prev, players: allPlayers }));
        });
        
        const unsubCategories = db.collection('auctions').doc(activeAuctionId).collection('categories').onSnapshot(snap => {
             const categories = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
             setState(prev => ({ ...prev, categories }));
        });

        const unsubSponsors = db.collection('auctions').doc(activeAuctionId).collection('sponsors').onSnapshot(snap => {
             const sponsors = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
             setState(prev => ({ ...prev, sponsors }));
        });

        return () => {
            unsubscribe();
            unsubTeams();
            unsubPlayers();
            unsubCategories();
            unsubSponsors();
        };
    }, [activeAuctionId]);

    const joinAuction = (id: string) => {
        setActiveAuctionId(id);
    };

    const logout = async () => {
        await auth.signOut();
        localStorage.removeItem('sm_sports_team_session');
        setUserProfile(null);
        setActiveAuctionId(null);
        setState(initialState);
    };

    // --- DERIVED STATE (Fixes "Not Automatic Showing" Issue) ---
    // Instead of setting these in the listener, we calculate them whenever players or currentId changes.
    const derivedUnsoldPlayers = useMemo(() => {
        return state.players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
    }, [state.players]);

    const derivedCurrentPlayerIndex = useMemo(() => {
        if (!state.currentPlayerId || derivedUnsoldPlayers.length === 0) return null;
        const idx = derivedUnsoldPlayers.findIndex(p => String(p.id) === String(state.currentPlayerId));
        return idx !== -1 ? idx : null;
    }, [state.currentPlayerId, derivedUnsoldPlayers]);

    // Merge derived values into the state object consumed by the app
    const activeState = {
        ...state,
        unsoldPlayers: derivedUnsoldPlayers,
        currentPlayerIndex: derivedCurrentPlayerIndex
    };

    // Derived State: nextBid
    const nextBid = useMemo(() => {
        const { currentPlayerId, players, currentBid, bidIncrement, bidSlabs, categories } = state;
        const currentPlayer = players.find(p => String(p.id) === String(currentPlayerId));
        
        if (!currentPlayer) return 0;

        const basePrice = Number(currentPlayer.basePrice) || 0;
        const currentPrice = Number(currentBid) || 0;

        // SCENARIO 1: No bids yet (First Bid)
        if (currentPrice === 0) {
            return basePrice > 0 ? basePrice : (bidIncrement || 100);
        }
        
        // 1. Check Category Specific Rules First (Specific overrides General)
        if (currentPlayer.category) {
            const cat = categories.find(c => c.name === currentPlayer.category);
            
            // Category Slabs
            if (cat && cat.slabs && cat.slabs.length > 0) {
                 const sortedSlabs = [...cat.slabs].sort((a, b) => b.from - a.from);
                 const activeSlab = sortedSlabs.find(s => currentPrice >= s.from);
                 if (activeSlab) {
                     return currentPrice + Number(activeSlab.increment);
                 }
            }
            
            // Category specific increment (without slabs)
            if (cat && cat.bidIncrement > 0) {
                return currentPrice + Number(cat.bidIncrement);
            }
        }

        // 2. Check Global Slabs
        if (bidSlabs && bidSlabs.length > 0) {
            const sortedSlabs = [...bidSlabs].sort((a, b) => b.from - a.from);
            const activeSlab = sortedSlabs.find(s => currentPrice >= s.from);
            if (activeSlab) {
                return currentPrice + Number(activeSlab.increment);
            }
        }

        // 3. Default Global Increment
        return currentPrice + (Number(bidIncrement) || 100);
    }, [state.currentBid, state.currentPlayerId, state.players, state.bidIncrement, state.bidSlabs, state.categories]);

    // Implementation of actions
    const placeBid = async (teamId: string | number, amount: number) => {
        if (!activeAuctionId) return;
        const team = state.teams.find(t => String(t.id) === String(teamId));
        if (!team) throw new Error("Team not found");
        
        const log = {
            message: `${team.name} bid ${amount}`,
            timestamp: Date.now(),
            type: 'BID'
        };

        await db.collection('auctions').doc(activeAuctionId).update({
            currentBid: amount,
            highestBidder: team,
            timer: 10,
            auctionLog: firebase.firestore.FieldValue.arrayUnion(log)
        });
    };

    const sellPlayer = async (teamId?: string | number, customPrice?: number) => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        
        const finalTeam = teamId ? state.teams.find(t => String(t.id) === String(teamId)) : state.highestBidder;
        const finalPrice = customPrice !== undefined ? customPrice : (state.currentBid || 0);

        if (!finalTeam) throw new Error("No team selected to sell to");

        const player = state.players.find(p => String(p.id) === String(state.currentPlayerId));
        if (!player) return;

        await db.runTransaction(async (transaction) => {
            const auctionRef = db.collection('auctions').doc(activeAuctionId);
            const playerRef = auctionRef.collection('players').doc(String(player.id));
            const teamRef = auctionRef.collection('teams').doc(String(finalTeam.id));

            // CRITICAL CHECK: Ensure team doc exists before reading data
            const teamDoc = await transaction.get(teamRef);
            if (!teamDoc.exists) {
                throw new Error("Target team document does not exist in database");
            }
            const teamData = teamDoc.data() as Team;

            transaction.update(playerRef, {
                status: 'SOLD',
                soldPrice: finalPrice,
                soldTo: finalTeam.name
            });
            
            const updatedPlayers = [...(teamData.players || []), { ...player, status: 'SOLD', soldPrice: finalPrice, soldTo: finalTeam.name }];
            const newBudget = (teamData.budget || 0) - finalPrice;

            transaction.update(teamRef, {
                budget: newBudget,
                players: updatedPlayers
            });

            const log = {
                message: `${player.name} SOLD to ${finalTeam.name} for ${finalPrice}`,
                timestamp: Date.now(),
                type: 'SOLD'
            };

            transaction.update(auctionRef, {
                status: AuctionStatus.Sold, 
                auctionLog: firebase.firestore.FieldValue.arrayUnion(log),
                currentBid: finalPrice,
                highestBidder: finalTeam
            });
        });
    };

    const passPlayer = async () => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        const player = state.players.find(p => String(p.id) === String(state.currentPlayerId));
        if (!player) return;

        await db.collection('auctions').doc(activeAuctionId).collection('players').doc(String(player.id)).update({
            status: 'UNSOLD'
        });

        const log = {
            message: `${player.name} UNSOLD`,
            timestamp: Date.now(),
            type: 'UNSOLD'
        };

        await db.collection('auctions').doc(activeAuctionId).update({
            status: AuctionStatus.Unsold,
            auctionLog: firebase.firestore.FieldValue.arrayUnion(log)
        });
    };

    const startAuction = async (specificPlayerId?: string | number) => {
        if (!activeAuctionId) return false;
        
        let nextPlayerId = specificPlayerId;
        
        if (!nextPlayerId) {
            const available = state.players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
            if (available.length === 0) return false;
            const next = available[Math.floor(Math.random() * available.length)];
            nextPlayerId = next.id;
        }

        if (!nextPlayerId) return false;

        const player = state.players.find(p => String(p.id) === String(nextPlayerId));

        await db.collection('auctions').doc(activeAuctionId).update({
            currentPlayerId: nextPlayerId,
            currentBid: 0,
            highestBidder: null,
            status: AuctionStatus.InProgress,
            timer: 10,
            auctionLog: firebase.firestore.FieldValue.arrayUnion({
                message: `Bidding started for ${player?.name}`,
                timestamp: Date.now(),
                type: 'SYSTEM'
            })
        });
        
        return true;
    };

    const resetCurrentPlayer = async () => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        await db.collection('auctions').doc(activeAuctionId).update({
            currentBid: 0,
            highestBidder: null,
            timer: 10,
            status: AuctionStatus.InProgress
        });
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
        
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        
        // 1. Fetch Default Purse from Auction Config
        const auctionSnap = await auctionRef.get();
        if (!auctionSnap.exists) return;
        const defaultPurse = auctionSnap.data()?.purseValue || 10000;

        // 2. Fetch all Teams and Players to reset
        const playersSnap = await auctionRef.collection('players').get();
        const teamsSnap = await auctionRef.collection('teams').get();

        // 3. Batched Updates (Handling chunks of 450 to stay under 500 limit)
        const batchSize = 450;
        const allDocs = [
            ...playersSnap.docs.map(d => ({ type: 'PLAYER', ref: d.ref })),
            ...teamsSnap.docs.map(d => ({ type: 'TEAM', ref: d.ref }))
        ];

        // Process in chunks
        for (let i = 0; i < allDocs.length; i += batchSize) {
            const batch = db.batch();
            const chunk = allDocs.slice(i, i + batchSize);
            
            chunk.forEach(item => {
                if (item.type === 'PLAYER') {
                    batch.update(item.ref, {
                        status: firebase.firestore.FieldValue.delete(),
                        soldPrice: firebase.firestore.FieldValue.delete(),
                        soldTo: firebase.firestore.FieldValue.delete()
                    });
                } else {
                    batch.update(item.ref, {
                        budget: defaultPurse,
                        players: []
                    });
                }
            });
            
            // Only update root auction doc in the first batch
            if (i === 0) {
                batch.update(auctionRef, {
                    status: AuctionStatus.NotStarted,
                    currentPlayerId: null,
                    currentBid: 0,
                    highestBidder: null,
                    auctionLog: [],
                    timer: 0
                });
            }
            
            await batch.commit();
        }
        
        // If there were no sub-docs, we still need to reset the auction status
        if (allDocs.length === 0) {
             await auctionRef.update({
                status: AuctionStatus.NotStarted,
                currentPlayerId: null,
                currentBid: 0,
                highestBidder: null,
                auctionLog: [],
                timer: 0
            });
        }
    };

    const resetUnsoldPlayers = async () => {
        if (!activeAuctionId) return;
        const unsold = state.players.filter(p => p.status === 'UNSOLD');
        const batch = db.batch();
        
        unsold.forEach(p => {
            const ref = db.collection('auctions').doc(activeAuctionId).collection('players').doc(String(p.id));
            batch.update(ref, { status: firebase.firestore.FieldValue.delete() });
        });
        
        await batch.commit();
        
        await db.collection('auctions').doc(activeAuctionId).update({
            auctionLog: firebase.firestore.FieldValue.arrayUnion({
                message: `${unsold.length} unsold players brought back to pool`,
                timestamp: Date.now(),
                type: 'SYSTEM'
            })
        });
    };

    const updateBiddingStatus = async (status: BiddingStatus) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ biddingStatus: status });
    };

    const updateSponsorConfig = async (config: SponsorConfig) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ sponsorConfig: config });
    };

    const toggleSelectionMode = async () => {
        if (!activeAuctionId) return;
        const newMode = state.playerSelectionMode === 'MANUAL' ? 'AUTO' : 'MANUAL';
        await db.collection('auctions').doc(activeAuctionId).update({ playerSelectionMode: newMode });
    };

    const updateTheme = async (type: 'PROJECTOR' | 'OBS', layout: string) => {
        if (!activeAuctionId) return;
        const field = type === 'PROJECTOR' ? 'projectorLayout' : 'obsLayout';
        await db.collection('auctions').doc(activeAuctionId).update({ [field]: layout });
    };

    const setAdminView = async (view: AdminViewOverride | null) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ adminViewOverride: view });
    };

    const correctPlayerSale = async (playerId: string, newTeamId: string | null, newPrice: number) => {
        if (!activeAuctionId) return;
        
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        
        await db.runTransaction(async (t) => {
            const playerRef = auctionRef.collection('players').doc(playerId);
            const playerDoc = await t.get(playerRef);
            const playerData = playerDoc.data() as Player;
            
            // 1. Revert previous sale if applicable
            if (playerData.status === 'SOLD' && playerData.soldTo) {
                const prevTeam = state.teams.find(tm => tm.name === playerData.soldTo);
                if (prevTeam) {
                    const prevTeamRef = auctionRef.collection('teams').doc(String(prevTeam.id));
                    const prevTeamDoc = await t.get(prevTeamRef);
                    if (prevTeamDoc.exists) {
                        const ptData = prevTeamDoc.data() as Team;
                        const refund = playerData.soldPrice || 0;
                        const newBudget = (ptData.budget || 0) + refund;
                        const newPlayers = (ptData.players || []).filter(p => String(p.id) !== playerId);
                        
                        t.update(prevTeamRef, { budget: newBudget, players: newPlayers });
                    }
                }
            }
            
            // 2. Apply new sale if newTeamId provided
            if (newTeamId) {
                const newTeamRef = auctionRef.collection('teams').doc(newTeamId);
                const newTeamDoc = await t.get(newTeamRef);
                const newTeamData = newTeamDoc.data() as Team;
                
                const newBudget = (newTeamData.budget || 0) - newPrice;
                const updatedPlayerObj = { ...playerData, status: 'SOLD', soldPrice: newPrice, soldTo: newTeamData.name };
                const newPlayers = [...(newTeamData.players || []), updatedPlayerObj];
                
                t.update(newTeamRef, { budget: newBudget, players: newPlayers });
                t.update(playerRef, { status: 'SOLD', soldPrice: newPrice, soldTo: newTeamData.name });
            } else {
                t.update(playerRef, { 
                    status: firebase.firestore.FieldValue.delete(), 
                    soldPrice: firebase.firestore.FieldValue.delete(),
                    soldTo: firebase.firestore.FieldValue.delete()
                });
            }
        });
    };

    return (
        <AuctionContext.Provider value={{
            state: activeState, // Pass the state with derived values overrides
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
            updateSponsorConfig,
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
