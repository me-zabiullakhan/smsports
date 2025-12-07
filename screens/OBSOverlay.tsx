
import React, { useEffect } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe, AlertTriangle } from 'lucide-react';

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

  // Force Transparency on Mount
  useEffect(() => {
      // Save original styles
      const originalBodyBg = document.body.style.backgroundColor;
      const originalHtmlBg = document.documentElement.style.backgroundColor;

      // Apply transparency for OBS
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';

      return () => {
          // Restore (though unlikely to navigate away in OBS)
          document.body.style.backgroundColor = originalBodyBg;
          document.documentElement.style.backgroundColor = originalHtmlBg;
      };
  }, []);

  useEffect(() => {
      if (auctionId) {
          joinAuction(auctionId);
      }
  }, [auctionId]);

  // Check for Preview/Blob environment
  if (window.location.protocol === 'blob:') {
      return (
          <div className="min-h-screen w-full flex items-center justify-center bg-black/90 p-10">
              <div className="bg-red-600/20 border border-red-500 text-white p-8 rounded-xl max-w-2xl text-center">
                  <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                  <h1 className="text-3xl font-bold mb-4">Overlay Not Available in Preview</h1>
                  <p className="text-lg mb-6">
                      You are viewing this app via a temporary <code>blob:</code> URL. 
                      OBS Studio cannot access this type of link.
                  </p>
                  <div className="bg-black/50 p-4 rounded text-left text-sm font-mono space-y-2">
                      <p className="text-gray-400">To use this overlay:</p>
                      <p>1. <span className="text-yellow-400">Deploy your app</span> (e.g. to Firebase Hosting, Vercel).</p>
                      <p>2. Open the <span className="text-green-400">Live Website URL</span>.</p>
                      <p>3. Copy the OBS Link from the live dashboard.</p>
                  </div>
              </div>
          </div>
      );
  }

  if (!currentPlayer) {
      return (
          <div className="min-h-screen w-full flex items-center justify-center bg-transparent">
              <div className="bg-black/80 text-white px-10 py-6 rounded-xl border-l-8 border-highlight animate-pulse shadow-2xl">
                  <h1 className="text-4xl font-bold uppercase tracking-widest">Auction Waiting...</h1>
                  {state.status === 'NOT_STARTED' && <p className="text-sm mt-2 text-gray-400 font-mono text-center">WAITING FOR ADMIN TO START</p>}
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen w-full bg-transparent p-10 flex items-end pb-20">
        {/* Main Card Card */}
        <div className="w-full max-w-6xl mx-auto relative animate-fade-in-up">
            
            <div className="flex bg-secondary/95 border-2 border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
                {/* Left: Image */}
                <div className="w-1/3 bg-gradient-to-br from-gray-800 to-black relative overflow-hidden">
                    <img src={currentPlayer.photoUrl} className="w-full h-full object-cover object-top" alt="" />
                    <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-4">
                         <span className="bg-highlight text-primary font-bold px-3 py-1 rounded text-sm uppercase shadow-lg">{currentPlayer.category}</span>
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
                        <h1 className="text-6xl font-black text-white uppercase leading-none mb-2 drop-shadow-lg">{currentPlayer.name}</h1>
                        <p className="text-2xl text-highlight font-light">{currentPlayer.speciality}</p>
                     </div>

                     {/* Live Bid Strip */}
                     <div className="mt-8 bg-primary/50 rounded-xl p-6 border border-white/5 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-highlight"></div>
                        <div>
                            <p className="text-text-secondary text-sm uppercase mb-1 font-bold tracking-wider">Current Bid</p>
                            <p className="text-7xl font-bold text-white tabular-nums drop-shadow-md">{currentBid || currentPlayer.basePrice}</p>
                        </div>
                        
                        {/* Base Price Display */}
                        <div className="px-6 text-center border-l border-white/10">
                             <p className="text-text-secondary text-xs uppercase mb-1">Base Price</p>
                             <p className="text-2xl font-bold text-gray-300">{currentPlayer.basePrice}</p>
                        </div>

                        <div className="flex-grow pl-6 border-l border-white/10">
                            <p className="text-text-secondary text-sm uppercase mb-1 font-bold tracking-wider">Held By</p>
                            {highestBidder ? (
                                <div className="flex items-center">
                                    {highestBidder.logoUrl ? (
                                        <img src={highestBidder.logoUrl} className="w-16 h-16 rounded-full bg-white p-1 mr-4 object-contain shadow-lg" alt="" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center font-bold text-white text-2xl mr-4 border-2 border-white/20">
                                            {highestBidder.name.charAt(0)}
                                        </div>
                                    )}
                                    <span className="text-4xl font-bold text-green-400 truncate max-w-[250px] drop-shadow-sm">{highestBidder.name}</span>
                                </div>
                            ) : (
                                <span className="text-3xl font-bold text-gray-500 italic opacity-50">Waiting for bid...</span>
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
