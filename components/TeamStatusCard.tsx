import React, { useState } from 'react';
import { Team, UserRole } from '../types';
import { useAuction } from '../hooks/useAuction';
import { Wallet, Users, Gavel } from 'lucide-react';

interface Props {
    team: Team;
}

const TeamStatusCard: React.FC<Props> = ({ team }) => {
    const { state, placeBid, userProfile, nextBid } = useAuction();
    const { currentPlayerId, players, maxPlayersPerTeam, categories, roles, basePrice: globalBasePrice } = state;
    const isAdmin = userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.SUPER_ADMIN;
    const isAuctionLive = state.status === 'IN_PROGRESS';
    const currentPlayer = currentPlayerId ? players.find(p => String(p.id) === String(currentPlayerId)) : null;

    // --- SQUAD FILLING RESERVE CALCULATION (SYNCED) ---
    let isLimitReached = false;
    let limitReason = "";

    const targetSquadSize = maxPlayersPerTeam || 11;
    const currentSquadCount = team.players.length;
    const remainingToBuy = targetSquadSize - currentSquadCount;

    // 1. Check Global Squad Limit
    if (remainingToBuy <= 0) {
        isLimitReached = true;
        limitReason = "Squad Full";
    }

    // 2. Check Category Specific Max Limit
    if (!isLimitReached && currentPlayer && currentPlayer.category) {
        const catConfig = categories.find(c => c.name === currentPlayer.category);
        if (catConfig && catConfig.maxPerTeam > 0) {
            const count = team.players.filter(p => p.category === currentPlayer.category).length;
            if (count >= catConfig.maxPerTeam) {
                isLimitReached = true;
                limitReason = "Cat. Full";
            }
        }
    }

    // 3. Squad Filling Reserve Check
    if (!isLimitReached && currentPlayer) {
        // Find absolute cheapest base price available
        const absoluteMinBasePrice = Math.min(
            globalBasePrice || 100,
            ...(categories.length > 0 ? categories.map(c => c.basePrice) : [100]),
            ...(roles.length > 0 ? roles.map(r => r.basePrice) : [100])
        );

        let totalMinSlotsReserved = 0;
        let totalMandatoryReserve = 0;

        categories.forEach(cat => {
            const alreadyHasInCat = team.players.filter(p => p.category === cat.name).length;
            let neededInCat = Math.max(0, cat.minPerTeam - alreadyHasInCat);
            
            if (currentPlayer.category === cat.name) {
                neededInCat = Math.max(0, neededInCat - 1);
            }

            totalMinSlotsReserved += neededInCat;
            totalMandatoryReserve += neededInCat * cat.basePrice;
        });

        const extraSlots = Math.max(0, (remainingToBuy - 1) - totalMinSlotsReserved);
        totalMandatoryReserve += (extraSlots * absoluteMinBasePrice);

        const biddingCapacity = team.budget - totalMandatoryReserve;
        if (nextBid > biddingCapacity) {
            isLimitReached = true;
            limitReason = "Reserve Req.";
        }
    }

    const canAfford = team.budget >= nextBid;
    const isHighest = state.highestBidder?.id === team.id;

    const handleAdminBid = async () => {
        if (canAfford && !isHighest && !isLimitReached && nextBid > 0) {
            try {
                await placeBid(team.id, nextBid);
            } catch (e) {
                alert((e as Error).message);
            }
        }
    };

    return (
        <div className={`bg-accent p-3 rounded-lg shadow-md transition-all duration-300 ${isHighest ? 'ring-2 ring-green-500 bg-green-900/30' : ''}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                    {team.logoUrl ? (
                        <img src={team.logoUrl} alt={team.name} className="w-8 h-8 rounded-full mr-3 bg-white p-0.5" />
                    ) : (
                        <div className="w-8 h-8 rounded-full mr-3 bg-gray-700 flex items-center justify-center font-bold text-white text-xs">
                            {team.name.charAt(0)}
                        </div>
                    )}
                    <div>
                        <h4 className="font-bold text-white text-md truncate max-w-[120px] leading-none">{team.name}</h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 select-all">ID: {team.id}</p>
                    </div>
                </div>
            </div>
            
            <div className="text-sm space-y-1">
                <p className="flex items-center text-text-secondary">
                    <Wallet className="w-4 h-4 mr-2 text-green-400" /> 
                    Budget: <span className="font-semibold text-white ml-1">{team.budget}</span>
                </p>
                <p className="flex items-center text-text-secondary">
                    <Users className="w-4 h-4 mr-2 text-blue-400" />
                    Players: <span className={`font-semibold ml-1 ${remainingToBuy <= 0 ? 'text-red-400' : 'text-white'}`}>{team.players.length} / {targetSquadSize}</span>
                </p>
            </div>

            {isAdmin && isAuctionLive && (
                <div className="mt-3 pt-2 border-t border-white/10">
                    <button 
                        onClick={handleAdminBid}
                        disabled={!canAfford || isHighest || isLimitReached}
                        className={`w-full py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center uppercase tracking-wide transition-colors ${
                            isHighest 
                                ? 'bg-green-600 text-white cursor-default' 
                                : isLimitReached
                                    ? 'bg-red-900/50 text-red-200 border border-red-500/30 cursor-not-allowed'
                                : !canAfford 
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                    : 'bg-highlight hover:bg-teal-400 text-primary'
                        }`}
                    >
                        {isHighest ? (
                            <>Leading</>
                        ) : isLimitReached ? (
                            <span className="text-[8px] truncate">{limitReason}</span>
                        ) : !canAfford ? (
                            <>No Funds</>
                        ) : (
                            <><Gavel className="w-3 h-3 mr-1"/> Bid {nextBid}</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TeamStatusCard;