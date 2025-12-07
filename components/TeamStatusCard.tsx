
import React from 'react';
import { AuctionStatus, Team, UserRole } from '../types';
import { Wallet, Users, Gavel } from 'lucide-react';
import { useAuction } from '../hooks/useAuction';

interface TeamStatusCardProps {
  team: Team;
}

const TeamStatusCard: React.FC<TeamStatusCardProps> = ({ team }) => {
  const { placeBid, state, userProfile } = useAuction();
  
  const isAdmin = userProfile?.role === UserRole.ADMIN;
  const isAuctionLive = state.status === AuctionStatus.InProgress;
  
  const { currentPlayerIndex, unsoldPlayers, currentBid, bidIncrement } = state;
  const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;
  const basePrice = currentPlayer?.basePrice || 0;
  const currentPrice = currentBid || 0;

  // Next Bid Calculation
  let nextBid;
  if (currentPrice === 0 || currentPrice < basePrice) {
      nextBid = basePrice;
  } else {
      nextBid = currentPrice + bidIncrement;
  }

  const canAfford = team.budget >= nextBid;
  const isHighest = state.highestBidder?.id === team.id;

  const handleAdminBid = async () => {
      if (canAfford && !isHighest) {
          try {
              await placeBid(team.id, nextBid);
          } catch (e) {
              // alert handled in context
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
            <h4 className="font-bold text-white text-md truncate max-w-[120px]">{team.name}</h4>
        </div>
      </div>
      
      <div className="text-sm space-y-1">
        <p className="flex items-center text-text-secondary">
            <Wallet className="w-4 h-4 mr-2 text-green-400" /> 
            Budget: <span className="font-semibold text-white ml-1">{team.budget}</span>
        </p>
        <p className="flex items-center text-text-secondary">
            <Users className="w-4 h-4 mr-2 text-blue-400" />
            Players: <span className="font-semibold text-white ml-1">{team.players.length}</span>
        </p>
      </div>

      {isAdmin && isAuctionLive && (
          <div className="mt-3 pt-2 border-t border-white/10">
              <button 
                onClick={handleAdminBid}
                disabled={!canAfford || isHighest}
                className={`w-full py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center uppercase tracking-wide transition-colors ${
                    isHighest 
                        ? 'bg-green-600 text-white cursor-default' 
                        : !canAfford 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                            : 'bg-highlight hover:bg-teal-400 text-primary'
                }`}
              >
                  {isHighest ? (
                      <>Leading</>
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
