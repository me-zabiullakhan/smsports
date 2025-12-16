import React from 'react';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus } from '../types';
import { DollarSign, User, Loader2 } from 'lucide-react';

const LiveAdminPanel: React.FC = () => {
    const { state, placeBid, nextBid } = useAuction();
    const { teams } = state;
    
    const handleAdminBid = async (team: any) => {
        if (nextBid && nextBid > 0) {
            await placeBid(team.id, nextBid);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {teams.map(team => {
                const isLeading = state.highestBidder?.id === team.id;
                const canAfford = team.budget >= nextBid;
                
                // Check Category Limit for Admin Buttons
                let isLimitReached = false;
                const currentPlayer = state.currentPlayerIndex !== null ? state.players[state.currentPlayerIndex] : null;
                if (currentPlayer && currentPlayer.category) {
                    const catConfig = state.categories.find(c => c.name === currentPlayer.category);
                    if (catConfig && catConfig.maxPerTeam > 0) {
                        const count = team.players.filter(p => p.category === currentPlayer.category).length;
                        if (count >= catConfig.maxPerTeam) isLimitReached = true;
                    }
                }

                return (
                    <div key={team.id} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${isLeading ? 'bg-green-900/20 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                                {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-contain"/> : <span className="text-black font-bold text-xs">{team.name.charAt(0)}</span>}
                            </div>
                            <div className="min-w-0">
                                <div className="text-white font-bold text-xs truncate max-w-[120px]">{team.name}</div>
                                <div className="text-[10px] text-gray-400 flex items-center gap-3">
                                    <span className="flex items-center"><DollarSign className="w-3 h-3 text-green-500 mr-0.5"/> {team.budget}</span>
                                    <span className="flex items-center"><User className="w-3 h-3 text-blue-500 mr-0.5"/> {team.players.length}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Fast Bid Button */}
                        {state.status === AuctionStatus.InProgress && state.currentPlayerId && (
                                <button
                                    onClick={() => handleAdminBid(team)}
                                    disabled={!canAfford || isLeading || nextBid <= 0 || isLimitReached}
                                    className={`ml-2 px-3 py-0 rounded text-[10px] font-bold uppercase transition-all min-w-[75px] h-8 flex items-center justify-center
                                    ${isLeading 
                                        ? 'bg-green-600 text-white cursor-default opacity-80' 
                                        : isLimitReached
                                            ? 'bg-red-900/50 text-red-400 border border-red-500/30 cursor-not-allowed'
                                        : (!canAfford)
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : (nextBid <= 0)
                                                ? 'bg-gray-700 text-gray-400 cursor-wait'
                                                : 'bg-highlight hover:bg-teal-400 text-primary hover:scale-105 active:scale-95 shadow-lg shadow-highlight/10'
                                    }
                                    `}
                                    title={isLimitReached ? "Category Limit Reached" : ""}
                                >
                                    {isLeading ? 'Leading' : isLimitReached ? 'Max Limit' : !canAfford ? 'No Funds' : (nextBid > 0 ? `BID ${nextBid}` : <Loader2 className="w-3 h-3 animate-spin"/>)}
                                </button>
                        )}
                    </div>
                )
            })}
        </div>
    );
};

export default LiveAdminPanel;
