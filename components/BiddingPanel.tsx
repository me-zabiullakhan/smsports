import React, { useState } from 'react';
import { useAuction } from '../hooks/useAuction';
import { Gavel, Lock, AlertCircle, Users, AlertTriangle, Info } from 'lucide-react';

const BiddingPanel: React.FC = () => {
    const { state, userProfile, placeBid, nextBid } = useAuction();
    const { teams, highestBidder, biddingStatus, currentBid, currentPlayerId, players, status, categories, maxPlayersPerTeam, basePrice: globalBasePrice } = state;
    const [isBidding, setIsBidding] = useState(false);

    if (!userProfile || !userProfile.teamId) return null;

    // Find user's team securely
    const userTeam = teams.find(t => String(t.id) === String(userProfile.teamId));
    if (!userTeam) return null;

    // If auction is not in progress (e.g. SOLD), hide the bidding controls or show status
    if (status !== 'IN_PROGRESS') {
        return (
            <div className="bg-secondary rounded-xl shadow-xl p-4 border border-gray-700 text-center">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">
                    {status === 'SOLD' ? 'LOT SOLD' : status === 'UNSOLD' ? 'LOT UNSOLD' : 'BIDDING CLOSED'}
                </p>
            </div>
        );
    }

    // Resolve current player using ID from full list (consistent with other views)
    const currentPlayer = currentPlayerId ? players.find(p => String(p.id) === String(currentPlayerId)) : null;

    // --- SQUAD FILLING RESERVE CALCULATION ---
    const maxSquadSize = maxPlayersPerTeam || 11;
    const currentSquadSize = userTeam.players.length;
    const totalRemainingNeeded = maxSquadSize - currentSquadSize;

    // A. Identify category max limits
    let isCategoryMaxReached = false;
    let categoryLimitMsg = "";
    if (currentPlayer && currentPlayer.category) {
        const catConfig = categories.find(c => c.name === currentPlayer.category);
        if (catConfig && catConfig.maxPerTeam > 0) {
            const currentCount = userTeam.players.filter(p => p.category === currentPlayer.category).length;
            if (currentCount >= catConfig.maxPerTeam) {
                isCategoryMaxReached = true;
                categoryLimitMsg = `Max ${catConfig.maxPerTeam} '${currentPlayer.category}' players reached`;
            }
        }
    }

    // B. Calculate mandatory reserve for remaining players
    let totalMandatoryReserve = 0;
    let totalMinSlotsUsed = 0;
    
    // Step 1: Cheapest base price in system for flexible slots
    const absoluteMinBasePrice = categories.length > 0 
        ? Math.min(...categories.map(c => c.basePrice))
        : (globalBasePrice || 10);

    if (currentPlayer) {
        // Step 2: Category Mins
        categories.forEach(cat => {
            const hasInCat = userTeam.players.filter(p => p.category === cat.name).length;
            let stillNeededInCat = Math.max(0, (cat.minPerTeam || 0) - hasInCat);
            
            // If current player is in this category, they fulfill a slot if bid is successful
            if (currentPlayer.category === cat.name) {
                stillNeededInCat = Math.max(0, stillNeededInCat - 1);
            }
            
            totalMinSlotsUsed += stillNeededInCat;
            totalMandatoryReserve += stillNeededInCat * cat.basePrice;
        });

        // Step 3: Flexible slots needed to reach maxSquadSize
        const flexibleSlots = Math.max(0, (totalRemainingNeeded - 1) - totalMinSlotsUsed);
        totalMandatoryReserve += (flexibleSlots * absoluteMinBasePrice);
    }

    const maxAllowedBid = userTeam.budget - totalMandatoryReserve;
    const isBidLimitExceeded = nextBid > maxAllowedBid;
    const isSquadFull = totalRemainingNeeded <= 0;

    const canAfford = userTeam.budget >= nextBid;
    const isLeading = highestBidder && String(highestBidder.id) === String(userTeam.id);
    const isLoadingBid = nextBid === 0;
  
    // Status Helpers
    const isPaused = biddingStatus === 'PAUSED';
    const isActive = biddingStatus === 'ON';

    const handleBid = async () => {
        // Strict Client-Side Check
        if (canAfford && !isLeading && isActive && !isCategoryMaxReached && !isSquadFull && !isBidLimitExceeded) {
            setIsBidding(true);
            try {
                await placeBid(userTeam.id, nextBid);
            } catch (e) {
                console.error(e);
                alert((e as Error).message);
            } finally {
                setIsBidding(false);
            }
        }
    };

    return (
        <div className="bg-secondary rounded-xl shadow-xl p-3 md:p-6 border border-highlight/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-highlight"></div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-full sm:w-auto text-center sm:text-left flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start px-2 sm:px-0">
                    <div>
                        <p className="text-text-secondary text-[10px] md:text-sm uppercase tracking-widest font-bold">Your Purse</p>
                        <p className="text-xl md:text-3xl font-bold text-white tabular-nums leading-none mt-1">{userTeam.budget}</p>
                    </div>
                    {isPaused && (
                        <div className="sm:hidden bg-red-900/50 px-2 py-1 rounded border border-red-500/50">
                            <span className="text-[10px] text-red-200 font-bold uppercase flex items-center"><Lock className="w-3 h-3 mr-1"/> Paused</span>
                        </div>
                    )}
                    {!isSquadFull && (
                        <div className="mt-2 text-left hidden sm:block">
                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                Max Bid Limit: {Math.max(0, maxAllowedBid)}
                            </p>
                            <p className="text-[8px] text-gray-500 uppercase font-medium mt-0.5 flex items-center">
                                <Info className="w-2 h-2 mr-1"/> {totalMandatoryReserve} reserved for remaining squad
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center w-full sm:w-auto">
                    <button
                        onClick={handleBid}
                        disabled={!canAfford || isLeading || isBidding || !isActive || isLoadingBid || isCategoryMaxReached || isSquadFull || isBidLimitExceeded}
                        className={`
                            w-full sm:w-auto flex-grow md:flex-grow-0 flex items-center justify-center py-3 md:py-4 px-6 md:px-8 rounded-lg font-black text-base md:text-xl tracking-wider transition-all transform
                            ${isLeading 
                                ? 'bg-green-600 text-white cursor-default' 
                                : isSquadFull || isCategoryMaxReached || isBidLimitExceeded
                                    ? 'bg-gray-700 text-red-300 border border-red-500/30 cursor-not-allowed'
                                : (!isActive)
                                    ? 'bg-red-900/50 border border-red-700 text-red-200 cursor-not-allowed opacity-75'
                                    : (!canAfford || isLoadingBid)
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-highlight hover:bg-teal-400 text-primary hover:scale-105 shadow-[0_0_20px_rgba(56,178,172,0.4)]'
                            }
                        `}
                    >
                        {isLeading ? (
                            <>LEADING <span className="ml-2 text-sm font-normal hidden sm:inline">({currentBid})</span></>
                        ) : isSquadFull ? (
                            <><Users className="mr-2 h-4 w-4"/> SQUAD FULL</>
                        ) : isCategoryMaxReached ? (
                            <><Lock className="mr-2 h-4 w-4"/> LIMIT REACHED</>
                        ) : isBidLimitExceeded ? (
                            <><AlertTriangle className="mr-2 h-4 w-4"/> RESERVE REQUIRED</>
                        ) : !isActive ? (
                            <><Lock className="mr-2 h-4 w-4 md:h-5 md:w-5"/> PAUSED</>
                        ) : isLoadingBid ? (
                            <span className="animate-pulse">LOADING...</span>
                        ) : (
                            <><Gavel className="mr-2 h-5 w-5 md:h-6 md:w-6"/> BID {nextBid}</>
                        )}
                    </button>
                    {isBidLimitExceeded && (
                        <span className="text-[10px] text-red-400 font-bold mt-1 uppercase tracking-wide">
                            Limit: {Math.max(0, maxAllowedBid)} (Squad Reserve)
                        </span>
                    )}
                </div>
            </div>
            
            {isSquadFull && <p className="text-red-400 text-xs mt-2 flex items-center justify-center sm:justify-start font-bold uppercase"><AlertCircle className="w-3 h-3 mr-1"/> Max Players ({maxSquadSize}) Reached</p>}
            {isCategoryMaxReached && !isSquadFull && <p className="text-red-400 text-xs mt-2 flex items-center justify-center sm:justify-start font-bold uppercase"><AlertCircle className="w-3 h-3 mr-1"/> {categoryLimitMsg}</p>}
            {isBidLimitExceeded && (
                <div className="bg-red-950/20 border border-red-900/30 p-2 rounded mt-3">
                    <p className="text-red-400 text-[10px] flex items-start font-bold uppercase tracking-tight">
                        <AlertCircle className="w-3 h-3 mr-1.5 shrink-0 mt-0.5"/> 
                        Bidding locked. You must keep {totalMandatoryReserve} to buy {totalRemainingNeeded - 1} more players to fill your required {maxSquadSize} player squad.
                    </p>
                </div>
            )}
            {!canAfford && isActive && !isCategoryMaxReached && !isSquadFull && !isBidLimitExceeded && <p className="text-red-400 text-xs mt-2 flex items-center justify-center sm:justify-start font-bold"><AlertCircle className="w-3 h-3 mr-1"/> Insufficient Budget</p>}
            {!isActive && <p className="hidden sm:flex text-red-300 text-xs mt-2 items-center justify-center sm:justify-start font-bold uppercase tracking-wide"><Lock className="w-3 h-3 mr-1"/> Bidding Paused by Admin</p>}
        </div>
    );
};

export default BiddingPanel;