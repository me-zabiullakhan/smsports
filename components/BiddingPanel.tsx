
import React, { useState } from 'react';
import { useAuction } from '../hooks/useAuction';
import { Gavel, AlertCircle } from 'lucide-react';

const BiddingPanel: React.FC = () => {
  const { state, placeBid, userProfile, nextBid } = useAuction();
  const { currentBid, teams, highestBidder } = state;
  const [isBidding, setIsBidding] = useState(false);

  if (!userProfile?.teamId) return null;

  // Find user's team securely
  const userTeam = teams.find(t => String(t.id) === String(userProfile.teamId));
  if (!userTeam) return null;

  const canAfford = userTeam.budget >= nextBid;
  const isLeading = highestBidder && String(highestBidder.id) === String(userTeam.id);

  const handleBid = async () => {
    if (canAfford && !isLeading) {
      setIsBidding(true);
      try {
          await placeBid(userTeam.id, nextBid);
      } catch (e) {
          console.error(e);
          // Alert handled in context
      } finally {
          setIsBidding(false);
      }
    }
  };

  return (
    <div className="bg-secondary rounded-xl shadow-xl p-4 md:p-6 border border-highlight/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-highlight"></div>
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto text-center sm:text-left">
            <p className="text-text-secondary text-xs md:text-sm uppercase tracking-widest">Your Purse</p>
            <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{userTeam.budget}</p>
        </div>

        <button
          onClick={handleBid}
          disabled={!canAfford || isLeading || isBidding}
          className={`
            w-full sm:w-auto flex-grow md:flex-grow-0 flex items-center justify-center py-3 md:py-4 px-6 md:px-8 rounded-lg font-black text-lg md:text-xl tracking-wider transition-all transform
            ${isLeading 
                ? 'bg-green-600 text-white cursor-default' 
                : !canAfford 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-highlight hover:bg-teal-400 text-primary hover:scale-105 shadow-[0_0_20px_rgba(56,178,172,0.4)]'
            }
          `}
        >
          {isLeading ? (
              <>LEADING <span className="ml-2 text-sm font-normal">({currentBid})</span></>
          ) : (
              <><Gavel className="mr-2 h-5 w-5 md:h-6 md:w-6"/> BID {nextBid}</>
          )}
        </button>
      </div>
      
      {!canAfford && <p className="text-red-400 text-xs mt-2 flex items-center justify-center sm:justify-start"><AlertCircle className="w-3 h-3 mr-1"/> Insufficient Budget</p>}
    </div>
  );
};

export default BiddingPanel;
