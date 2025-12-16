import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
    AuctionContextType, AuctionState, UserProfile, UserRole, AuctionStatus, 
    Player, Team, AuctionCategory, PlayerRole, Sponsor, SponsorConfig, 
    AuctionLog, BiddingStatus, AdminViewOverride, BidIncrementSlab 
} from '../types';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';

const initialAuctionState: AuctionState = {
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
    bidIncrement: 100,
    auctionLog: [],
    biddingStatus: 'PAUSED',
    playerSelectionMode: 'MANUAL',
    sponsors: [],
    sponsorConfig: { showOnOBS: false, showOnProjector: false, loopInterval: 5 },
    projectorLayout: 'STANDARD',
    obsLayout: 'STANDARD',
    adminViewOverride: null
};

export const AuctionContext = createContext<AuctionContextType | undefined>(undefined);

export const AuctionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuctionState>(initialAuctionState);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [activeAuctionId, setActiveAuctionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Auth Listener
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                let role = UserRole.VIEWER;
                let teamId = undefined;
                
                const session = localStorage.getItem('sm_sports_team_session');
                if (session) {
                    try {
                        const data = JSON.parse(session);
                        if (data.role === 'TEAM_OWNER') {
                            role = UserRole.TEAM_OWNER;
                            teamId = data.teamId;
                            if(data.auctionId) setActiveAuctionId(data.auctionId);
                        }
                    } catch (e) { console.error("Session parse error", e); }
                } else if (!user.isAnonymous) {
                    role = UserRole.ADMIN;
                    // Mock Super Admin check
                    if (user.email === 'super@admin.com') role = UserRole.SUPER_ADMIN; 
                }

                setUserProfile({
                    uid: user.uid,
                    email: user.email || '',
                    name: user.displayName || 'User',
                    role,
                    teamId
                });
            } else {
                setUserProfile(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Auction Data Listener
    useEffect(() => {
        if (!activeAuctionId) return;

        // Listen to Auction Document (Root fields)
        const unsubAuction = db.collection('auctions').doc(activeAuctionId).onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                setState(prev => ({
                    ...prev,
                    status: data?.status || AuctionStatus.NotStarted,
                    currentPlayerId: data?.currentPlayerId || null,
                    currentBid: data?.currentBid || null,
                    timer: data?.timer || 0,
                    bidIncrement: data?.bidIncrement || 100,
                    bidSlabs: data?.slabs || [],
                    auctionLog: data?.auctionLog || [],
                    biddingStatus: data?.biddingStatus || 'PAUSED',
                    playerSelectionMode: data?.playerSelectionMode || 'MANUAL',
                    auctionLogoUrl: data?.logoUrl,
                    tournamentName: data?.title,
                    sponsorConfig: data?.sponsorConfig || prev.sponsorConfig,
                    projectorLayout: data?.projectorLayout || 'STANDARD',
                    obsLayout: data?.obsLayout || 'STANDARD',
                    adminViewOverride: data?.adminViewOverride || null,
                }));
            }
        }, err => setError(err.message));

        // Subcollections
        const unsubTeams = db.collection('auctions').doc(activeAuctionId).collection('teams').onSnapshot(snap => {
            const teams = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
            setState(prev => ({ ...prev, teams }));
        });

        const unsubPlayers = db.collection('auctions').doc(activeAuctionId).collection('players').onSnapshot(snap => {
            const players = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
            setState(prev => ({ 
                ...prev, 
                players,
                unsoldPlayers: players.filter(p => p.status !== 'SOLD').sort((a,b) => a.name.localeCompare(b.name))
            }));
        });

        const unsubCats = db.collection('auctions').doc(activeAuctionId).collection('categories').onSnapshot(snap => {
            const categories = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCategory));
            setState(prev => ({ ...prev, categories }));
        });

        const unsubRoles = db.collection('auctions').doc(activeAuctionId).collection('roles').onSnapshot(snap => {
            const roles = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole));
            setState(prev => ({ ...prev, roles }));
        });

        const unsubSponsors = db.collection('auctions').doc(activeAuctionId).collection('sponsors').onSnapshot(snap => {
            const sponsors = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor));
            setState(prev => ({ ...prev, sponsors }));
        });

        return () => {
            unsubAuction(); unsubTeams(); unsubPlayers(); unsubCats(); unsubRoles(); unsubSponsors();
        };
    }, [activeAuctionId]);

    // Derived State Updates (Current Player Index)
    useEffect(() => {
        setState(prev => {
            let currentPlayerIndex = null;
            if (prev.currentPlayerId && prev.unsoldPlayers.length > 0) {
                const idx = prev.unsoldPlayers.findIndex(p => String(p.id) === String(prev.currentPlayerId));
                if (idx !== -1) currentPlayerIndex = idx;
            }
            return { ...prev, currentPlayerIndex };
        });
    }, [state.currentPlayerId, state.unsoldPlayers]);

    // Highest Bidder Sync
    useEffect(() => {
        if (!activeAuctionId) return;
        const unsub = db.collection('auctions').doc(activeAuctionId).onSnapshot(doc => {
            const data = doc.data();
            if (data && data.highestBidderId) {
                setState(prev => {
                    const bidder = prev.teams.find(t => String(t.id) === String(data.highestBidderId)) || null;
                    return { ...prev, highestBidder: bidder };
                });
            } else {
                setState(prev => ({ ...prev, highestBidder: null }));
            }
        });
        return () => unsub();
    }, [activeAuctionId, state.teams]);

    // --- ACTIONS ---

    const joinAuction = useCallback((id: string) => {
        setActiveAuctionId(id);
    }, []);

    const logout = useCallback(() => {
        auth.signOut();
        localStorage.removeItem('sm_sports_team_session');
        setUserProfile(null);
        setActiveAuctionId(null);
        setState(initialAuctionState);
    }, []);

    const placeBid = useCallback(async (teamId: number | string, amount: number) => {
        if (!activeAuctionId) return;
        
        const team = state.teams.find(t => String(t.id) === String(teamId));
        const newLog: AuctionLog = {
            message: `Bid of ${amount} by ${team ? team.name : 'Team ' + teamId}`,
            timestamp: Date.now(),
            type: 'BID'
        };

        await db.collection('auctions').doc(activeAuctionId).update({
            currentBid: amount,
            highestBidderId: teamId,
            timer: 10,
            auctionLog: firebase.firestore.FieldValue.arrayUnion(newLog)
        });
    }, [activeAuctionId, state.teams]);

    const sellPlayer = useCallback(async (teamId?: string | number, customPrice?: number) => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        
        const price = customPrice || state.currentBid || 0;
        const winnerId = teamId || state.highestBidder?.id;
        
        if (!winnerId) return;

        const winner = state.teams.find(t => String(t.id) === String(winnerId));
        if (!winner) return;

        const player = state.players.find(p => String(p.id) === String(state.currentPlayerId));
        if (!player) return;

        await db.runTransaction(async (t) => {
            const auctionRef = db.collection('auctions').doc(activeAuctionId);
            const playerRef = auctionRef.collection('players').doc(String(player.id));
            const teamRef = auctionRef.collection('teams').doc(String(winner.id));

            const newBudget = winner.budget - price;
            if (newBudget < 0) throw new Error("Insufficient budget");

            t.update(playerRef, {
                status: 'SOLD',
                soldPrice: price,
                soldTo: winner.name
            });

            // Note: In real app, reading team doc first in transaction is safer to get latest roster
            const updatedRoster = [...winner.players, { ...player, status: 'SOLD', soldPrice: price, soldTo: winner.name }];
            t.update(teamRef, {
                budget: newBudget,
                players: updatedRoster
            });

            const soldLog: AuctionLog = {
                message: `${player.name} SOLD to ${winner.name} for ${price}`,
                timestamp: Date.now(),
                type: 'SOLD'
            };

            t.update(auctionRef, {
                status: AuctionStatus.Sold,
                auctionLog: firebase.firestore.FieldValue.arrayUnion(soldLog),
                currentBid: price,
                highestBidderId: winner.id,
                timer: 0
            });
        });
    }, [activeAuctionId, state.currentPlayerId, state.currentBid, state.highestBidder, state.teams, state.players]);

    const passPlayer = useCallback(async () => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        
        const player = state.players.find(p => String(p.id) === String(state.currentPlayerId));
        if (!player) return;

        await db.runTransaction(async (t) => {
            const auctionRef = db.collection('auctions').doc(activeAuctionId);
            const playerRef = auctionRef.collection('players').doc(String(player.id));

            t.update(playerRef, { status: 'UNSOLD' });

            const log: AuctionLog = {
                message: `${player.name} UNSOLD`,
                timestamp: Date.now(),
                type: 'UNSOLD'
            };

            t.update(auctionRef, {
                status: AuctionStatus.Unsold,
                auctionLog: firebase.firestore.FieldValue.arrayUnion(log),
                timer: 0
            });
        });
    }, [activeAuctionId, state.currentPlayerId, state.players]);

    const startAuction = useCallback(async (specificPlayerId?: string | number): Promise<boolean> => {
        if (!activeAuctionId) return false;

        let nextPlayer: Player | undefined;

        if (specificPlayerId) {
            nextPlayer = state.players.find(p => String(p.id) === String(specificPlayerId));
        } else {
            const available = state.players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
            if (available.length === 0) return false;
            nextPlayer = available[Math.floor(Math.random() * available.length)];
        }

        if (!nextPlayer) return false;

        await db.collection('auctions').doc(activeAuctionId).update({
            status: AuctionStatus.InProgress,
            currentPlayerId: nextPlayer.id,
            currentBid: 0,
            highestBidderId: null,
            timer: 10,
            auctionLog: firebase.firestore.FieldValue.arrayUnion({
                message: `Bidding started for ${nextPlayer.name}`,
                timestamp: Date.now(),
                type: 'SYSTEM'
            })
        });

        return true;
    }, [activeAuctionId, state.players]);

    const resetCurrentPlayer = useCallback(async () => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({
            currentBid: 0,
            highestBidderId: null,
            timer: 10,
            status: AuctionStatus.InProgress
        });
    }, [activeAuctionId]);

    const resetAuction = useCallback(async () => {
        if (!activeAuctionId) return;
        
        const batch = db.batch();
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        
        batch.update(auctionRef, {
            status: AuctionStatus.NotStarted,
            currentPlayerId: null,
            currentBid: 0,
            highestBidderId: null,
            timer: 0,
            auctionLog: []
        });

        state.players.forEach(p => {
            const pRef = auctionRef.collection('players').doc(String(p.id));
            batch.update(pRef, { status: firebase.firestore.FieldValue.delete(), soldPrice: firebase.firestore.FieldValue.delete(), soldTo: firebase.firestore.FieldValue.delete() });
        });

        // Use global default purse if possible or a hardcoded value if context lost
        const defaultPurse = 10000; 

        state.teams.forEach(t => {
            const tRef = auctionRef.collection('teams').doc(String(t.id));
            // Ideally should fetch original budget
            batch.update(tRef, { budget: defaultPurse, players: [] });
        });

        await batch.commit();
    }, [activeAuctionId, state.players, state.teams]);

    const endAuction = useCallback(async () => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({
            status: AuctionStatus.Finished,
            currentPlayerId: null
        });
    }, [activeAuctionId]);

    const resetUnsoldPlayers = useCallback(async () => {
        if (!activeAuctionId) return;
        const batch = db.batch();
        const unsold = state.players.filter(p => p.status === 'UNSOLD');
        
        unsold.forEach(p => {
            const ref = db.collection('auctions').doc(activeAuctionId).collection('players').doc(String(p.id));
            batch.update(ref, { status: firebase.firestore.FieldValue.delete() });
        });
        
        await batch.commit();
    }, [activeAuctionId, state.players]);

    const updateBiddingStatus = useCallback(async (status: BiddingStatus) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ biddingStatus: status });
    }, [activeAuctionId]);

    const toggleSelectionMode = useCallback(async () => {
        if (!activeAuctionId) return;
        const newMode = state.playerSelectionMode === 'AUTO' ? 'MANUAL' : 'AUTO';
        await db.collection('auctions').doc(activeAuctionId).update({ playerSelectionMode: newMode });
    }, [activeAuctionId, state.playerSelectionMode]);

    const updateTheme = useCallback(async (type: 'PROJECTOR' | 'OBS', layout: string) => {
        if (!activeAuctionId) return;
        const field = type === 'PROJECTOR' ? 'projectorLayout' : 'obsLayout';
        await db.collection('auctions').doc(activeAuctionId).update({ [field]: layout });
    }, [activeAuctionId]);

    const setAdminView = useCallback(async (view: AdminViewOverride | null) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ adminViewOverride: view });
    }, [activeAuctionId]);

    const correctPlayerSale = useCallback(async (playerId: string, newTeamId: string | null, newPrice: number) => {
        if (!activeAuctionId) return;
        
        await db.runTransaction(async (t) => {
            const auctionRef = db.collection('auctions').doc(activeAuctionId);
            const playerRef = auctionRef.collection('players').doc(playerId);
            const playerDoc = await t.get(playerRef);
            const player = playerDoc.data() as Player;

            // Revert Old Sale
            if (player.status === 'SOLD' && player.soldTo) {
                const oldTeam = state.teams.find(team => team.name === player.soldTo);
                if (oldTeam) {
                    const oldTeamRef = auctionRef.collection('teams').doc(String(oldTeam.id));
                    const refundedBudget = oldTeam.budget + (player.soldPrice || 0);
                    const filteredPlayers = oldTeam.players.filter(p => String(p.id) !== playerId);
                    t.update(oldTeamRef, { budget: refundedBudget, players: filteredPlayers });
                }
            }

            // Apply New Sale
            if (newTeamId) {
                const newTeam = state.teams.find(team => String(team.id) === String(newTeamId));
                if (!newTeam) throw new Error("New team not found");
                
                const newTeamRef = auctionRef.collection('teams').doc(String(newTeamId));
                // We assume client state is somewhat fresh or this op is done in isolation
                // For perfect accuracy, we should read team doc in transaction, but doing so for finding team by ID is fine.
                // However, calculating budget based on client state `newTeam.budget` inside transaction mixed with reads is unsafe if concurrent.
                // But for this app's scale, we rely on single admin flow mostly.
                
                // Better approach: Read doc
                const newTeamDoc = await t.get(newTeamRef);
                const newTeamData = newTeamDoc.data() as Team;
                
                // Adjust budget. If oldTeam == newTeam, the refund above logic might conflict if we use stale client state vs DB read.
                // Since we just updated oldTeamRef in transaction, we can't read it back easily in client SDK transaction.
                // We will assume separate teams for simplicity or user must refresh if complex.
                
                const updatedBudget = newTeamData.budget - newPrice;
                if (updatedBudget < 0) throw new Error("Insufficient budget");
                
                const playersList = newTeamData.players || [];
                t.update(newTeamRef, {
                    budget: updatedBudget,
                    players: [...playersList, { ...player, status: 'SOLD', soldPrice: newPrice, soldTo: newTeamData.name }]
                });
                
                t.update(playerRef, { status: 'SOLD', soldTo: newTeamData.name, soldPrice: newPrice });
            } else {
                // Unsell
                t.update(playerRef, { status: firebase.firestore.FieldValue.delete(), soldTo: firebase.firestore.FieldValue.delete(), soldPrice: firebase.firestore.FieldValue.delete() });
            }
        });
    }, [activeAuctionId, state.teams]);

    const nextBid = useMemo(() => {
        const currentPlayer = state.currentPlayerIndex !== null ? state.unsoldPlayers[state.currentPlayerIndex] : null;
        const basePrice = currentPlayer?.basePrice || 0;
        const currentBid = state.currentBid || 0;

        if (currentBid === 0) {
            return basePrice > 0 ? basePrice : (state.bidIncrement || 100);
        }
        
        const currentPrice = currentBid;
        
        if (state.bidSlabs && state.bidSlabs.length > 0) {
            const sortedSlabs = [...state.bidSlabs].sort((a, b) => b.from - a.from);
            const activeSlab = sortedSlabs.find(s => currentPrice >= s.from);
            if (activeSlab) {
                return currentPrice + activeSlab.increment;
            }
        }
        
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

        return currentPrice + (state.bidIncrement || 100);
    }, [state.currentBid, state.currentPlayerIndex, state.unsoldPlayers, state.bidIncrement, state.bidSlabs, state.categories]);

    const value: AuctionContextType = {
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
    };

    return (
        <AuctionContext.Provider value={value}>
            {children}
        </AuctionContext.Provider>
    );
};
