
import React, { useState } from 'react';
import { Team, UserRole } from '../types';
import { useAuction } from '../hooks/useAuction';
import { Wallet, Users, Gavel } from 'lucide-react';

interface Props {
    team: Team;
}

const TeamStatusCard: React.FC<Props> = ({ team }) => {
    const { state, placeBid, userProfile, nextBid } = useAuction();
    const { currentPlayerIndex, unsoldPlayers, maxPlayersPerTeam, categories } = state;
    const isAdmin = userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.SUPER_ADMIN;
    const isAuctionLive = state.status === 'IN_PROGRESS';
    const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

    // Check Category Limit
    let isLimitReached = false;
    let limitReason = "";

    // 1. Check Global Squad Limit
    const squadLimit = maxPlayersPerTeam || 25;
    if (team.players.length >= squadLimit) {
        isLimitReached = true;
        limitReason = "Squad Full";
    }

    // 2. Check Category Specific Limit (only if global not hit)
    if (!isLimitReached && currentPlayer && currentPlayer.category) {
        const catConfig = categories.find(c => c.name === currentPlayer.category);
        if (catConfig && catConfig.maxPerTeam > 0) {
            const count = team.players.filter(p => p.category === currentPlayer.category).length;
            if (count >= catConfig.maxPerTeam) {
                isLimitReached = true;
                limitReason = "Cat. Limit";
            }
        }
    }

    // 3. Check Bid Limit Rule (Category-wise Squad Protection)
    let reservedBudget = 0;
    if (!isLimitReached && currentPlayer) {
        categories.forEach(cat => {
            if (cat.maxPerTeam > 0) {
                const playersInCat = team.players.filter(p => p.category === cat.name).length;
                let slotsToFill = Math.max(0, cat.maxPerTeam - playersInCat);
                if (currentPlayer.category === cat.name) {
                    slotsToFill = Math.max(0, slotsToFill - 1);
                }
                reservedBudget += slotsToFill * cat.basePrice;
            }
        });
        const maxAllowedBid = team.budget - reservedBudget;
        if (nextBid > maxAllowedBid) {
            isLimitReached = true;
            limitReason = "Max Bid Limit";
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
                    Players: <span className={`font-semibold ml-1 ${team.players.length >= squadLimit ? 'text-red-400' : 'text-white'}`}>{team.players.length} / {squadLimit}</span>
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
                            <>{limitReason}</>
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
