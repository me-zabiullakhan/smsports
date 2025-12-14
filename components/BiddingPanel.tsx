
import React, { useState } from 'react';
import { useAuction } from '../hooks/useAuction';
import { Gavel, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';

const BiddingPanel: React.FC = () => {
  const { state, placeBid, userProfile, nextBid } = useAuction();
  const { currentBid, teams, highestBidder, biddingStatus } = state;
  const [isBidding, setIsBidding] = useState(false);
  const [showPurses, setShowPurses] = useState(false);

  // Totally hide if admin set to HIDDEN
  if (biddingStatus === 'HIDDEN') return null;

  if (!userProfile?.teamId) return null;

  // Find user's team securely
  const userTeam = teams.find(t => String(t.id) === String(userProfile.teamId));
  if (!userTeam) return null;

  const canAfford = userTeam.budget >= nextBid;
  const isLeading = highestBidder && String(highestBidder.id) === String(userTeam.id);
  const isLoadingBid = nextBid === 0;
  
  // Status Helpers
  const isPaused = biddingStatus === 'PAUSED';
  const isActive = biddingStatus === 'ON';

  // Sorted teams by budget for display
  const sortedTeams = [...teams].sort((a,b) => b.budget - a.budget);

  const handleBid = async () => {
    // Strict Client-Side Check: Only allow if Active
    if (canAfford && !isLeading && isActive) {
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
        </div>

        <button
          onClick={handleBid}
          disabled={!canAfford || isLeading || isBidding || !isActive || isLoadingBid}
          className={`
            w-full sm:w-auto flex-grow md:flex-grow-0 flex items-center justify-center py-3 md:py-4 px-6 md:px-8 rounded-lg font-black text-base md:text-xl tracking-wider transition-all transform
            ${isLeading 
                ? 'bg-green-600 text-white cursor-default' 
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
          ) : !isActive ? (
              <><Lock className="mr-2 h-4 w-4 md:h-5 md:w-5"/> PAUSED</>
          ) : isLoadingBid ? (
              <span className="animate-pulse">LOADING...</span>
          ) : (
              <><Gavel className="mr-2 h-5 w-5 md:h-6 md:w-6"/> BID {nextBid}</>
          )}
        </button>
      </div>
      
      {!canAfford && isActive && <p className="text-red-400 text-xs mt-2 flex items-center justify-center sm:justify-start font-bold"><AlertCircle className="w-3 h-3 mr-1"/> Insufficient Budget</p>}
      {!isActive && <p className="hidden sm:flex text-red-300 text-xs mt-2 items-center justify-center sm:justify-start font-bold uppercase tracking-wide"><Lock className="w-3 h-3 mr-1"/> Bidding Paused by Admin</p>}

      {/* Opponent Purses Toggle */}
      <div className="mt-4 pt-3 border-t border-gray-700">
          <button 
            onClick={() => setShowPurses(!showPurses)}
            className="w-full flex items-center justify-center text-[10px] text-highlight font-bold uppercase tracking-widest hover:text-white transition-colors gap-1 py-1"
          >
              {showPurses ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
              {showPurses ? 'Hide' : 'View'} Opponent Purses
          </button>
          
          {showPurses && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar bg-primary/40 p-2 rounded-lg border border-gray-700">
                  {sortedTeams.map(t => (
                      <div key={t.id} className={`p-2 rounded flex justify-between items-center text-xs ${t.id === userTeam.id ? 'bg-highlight/20 border border-highlight/50' : 'bg-gray-800 border border-gray-700'}`}>
                          <span className={`truncate max-w-[70px] font-bold ${t.id === userTeam.id ? 'text-highlight' : 'text-gray-300'}`}>{t.name}</span>
                          <span className={`font-mono font-bold ${t.id === userTeam.id ? 'text-white' : 'text-green-400'}`}>{t.budget}</span>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default BiddingPanel;
