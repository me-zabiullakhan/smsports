
import React, { useEffect } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe } from 'lucide-react';

// Specialized simplified timer for OBS
const OBSTimer: React.FC<{val: number}> = ({ val }) => (
    <div className="absolute top-4 right-4 w-20 h-20 bg-black/50 rounded-full flex items-center justify-center border-4 border-white/20 backdrop-blur-md">
        <span className={`text-3xl font-bold ${val <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{val}</span>
    </div>
);

const OBSOverlay: React.FC = () => {
  const { state, joinAuction } = useAuction();
  const { auctionId } = useParams<{ auctionId: string }>();
  const { currentPlayerIndex, unsoldPlayers, currentBid, highestBidder, timer } = state;
  const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

  useEffect(() => {
      if (auctionId) {
          joinAuction(auctionId);
      }
  }, [auctionId]);

  if (!currentPlayer) {
      return (
          <div className="min-h-screen w-full flex items-center justify-center bg-transparent">
              <div className="bg-black/80 text-white px-10 py-6 rounded-xl border-l-8 border-highlight animate-pulse">
                  <h1 className="text-4xl font-bold uppercase tracking-widest">Auction Waiting...</h1>
                  {state.status === 'NOT_STARTED' && <p className="text-sm mt-2 text-gray-400">Waiting for Admin to Start</p>}
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen w-full bg-transparent p-10 flex items-end pb-20">
        {/* Main Card Card */}
        <div className="w-full max-w-6xl mx-auto relative">
            
            <div className="flex bg-secondary/95 border-2 border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
                {/* Left: Image */}
                <div className="w-1/3 bg-gradient-to-br from-gray-800 to-black relative overflow-hidden">
                    <img src={currentPlayer.photoUrl} className="w-full h-full object-cover object-top" alt="" />
                    <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-4">
                         <span className="bg-highlight text-primary font-bold px-3 py-1 rounded text-sm uppercase">{currentPlayer.category}</span>
                    </div>
                </div>

                {/* Right: Details & Bid */}
                <div className="w-2/3 p-8 flex flex-col justify-between relative">
                     <OBSTimer val={timer} />

                     <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <Globe className="text-text-secondary w-5 h-5" />
                            <span className="text-xl text-text-secondary uppercase tracking-widest">{currentPlayer.nationality}</span>
                        </div>
                        <h1 className="text-6xl font-black text-white uppercase leading-none mb-2">{currentPlayer.name}</h1>
                        <p className="text-2xl text-highlight font-light">{currentPlayer.speciality}</p>
                     </div>

                     {/* Live Bid Strip */}
                     <div className="mt-8 bg-primary/50 rounded-xl p-6 border border-white/5 flex justify-between items-center">
                        <div>
                            <p className="text-text-secondary text-sm uppercase mb-1">Current Bid</p>
                            <p className="text-6xl font-bold text-white tabular-nums">{currentBid}</p>
                        </div>
                        
                        {/* Base Price Display */}
                        <div className="px-6 text-center">
                             <p className="text-text-secondary text-xs uppercase mb-1">Base</p>
                             <p className="text-xl font-bold text-gray-300">{currentPlayer.basePrice}</p>
                        </div>

                        <div className="h-16 w-px bg-white/10 mx-2"></div>

                        <div className="flex-grow pl-4">
                            <p className="text-text-secondary text-sm uppercase mb-1">Held By</p>
                            {highestBidder ? (
                                <div className="flex items-center">
                                    <img src={highestBidder.logoUrl} className="w-12 h-12 rounded-full bg-white p-1 mr-4" />
                                    <span className="text-3xl font-bold text-white truncate">{highestBidder.name}</span>
                                </div>
                            ) : (
                                <span className="text-3xl font-bold text-gray-500 italic">Waiting for bid...</span>
                            )}
                        </div>
                     </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default OBSOverlay;
