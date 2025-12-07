
import React, { useEffect } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe, AlertTriangle } from 'lucide-react';

// Simplified Timer for Green Screen (High Contrast)
const GreenTimer: React.FC<{val: number}> = ({ val }) => (
    <div className="absolute top-4 right-4 w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center border-4 border-white">
        <span className={`text-4xl font-bold ${val <= 5 ? 'text-red-500' : 'text-white'}`}>{val}</span>
    </div>
);

const OBSGreen: React.FC = () => {
  const { state, joinAuction } = useAuction();
  const { auctionId } = useParams<{ auctionId: string }>();
  const { currentPlayerIndex, unsoldPlayers, currentBid, highestBidder, timer } = state;
  const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

  // Force Green Background on Mount
  useEffect(() => {
      const originalBodyBg = document.body.style.backgroundColor;
      const originalHtmlBg = document.documentElement.style.backgroundColor;

      // CHROMA GREEN
      const chromaColor = '#00b140'; 
      document.body.style.backgroundColor = chromaColor;
      document.documentElement.style.backgroundColor = chromaColor;

      return () => {
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
          <div className="min-h-screen w-full flex items-center justify-center bg-gray-900 p-10">
              <div className="bg-red-100 border border-red-500 text-red-900 p-8 rounded-xl max-w-2xl text-center">
                  <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-600" />
                  <h1 className="text-3xl font-bold mb-4">Overlay Not Available in Preview</h1>
                  <p>Please deploy the app to use the OBS features.</p>
              </div>
          </div>
      );
  }

  if (!currentPlayer) {
      return (
          <div className="min-h-screen w-full flex items-center justify-center">
              {/* Placeholder text for waiting state - clean text for OBS */}
              <div className="bg-gray-900 text-white px-10 py-6 rounded-xl border-4 border-white shadow-none">
                  <h1 className="text-4xl font-bold uppercase tracking-widest">WAITING FOR AUCTION...</h1>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen w-full p-10 flex items-end pb-20">
        {/* Main Card - No Shadows, Solid Colors for better Keying */}
        <div className="w-full max-w-6xl mx-auto relative">
            
            <div className="flex bg-gray-900 border-4 border-white rounded-3xl overflow-hidden relative">
                {/* Left: Image */}
                <div className="w-1/3 bg-gray-800 relative overflow-hidden">
                    <img src={currentPlayer.photoUrl} className="w-full h-full object-cover object-top" alt="" />
                    <div className="absolute bottom-0 left-0 w-full bg-gray-900 p-4 border-t-4 border-highlight">
                         <span className="bg-white text-gray-900 font-bold px-3 py-1 rounded text-xl uppercase block text-center">
                             {currentPlayer.category}
                         </span>
                    </div>
                </div>

                {/* Right: Details & Bid */}
                <div className="w-2/3 p-8 flex flex-col justify-between relative bg-gray-900 text-white">
                     <GreenTimer val={timer} />

                     <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <Globe className="text-gray-400 w-6 h-6" />
                            <span className="text-2xl text-gray-300 uppercase tracking-widest font-bold">{currentPlayer.nationality}</span>
                        </div>
                        <h1 className="text-7xl font-black text-white uppercase leading-none mb-2">{currentPlayer.name}</h1>
                        <p className="text-3xl text-highlight font-bold">{currentPlayer.speciality}</p>
                     </div>

                     {/* Live Bid Strip - Solid Colors */}
                     <div className="mt-8 bg-gray-800 rounded-xl p-6 border-4 border-gray-700 flex justify-between items-center relative">
                        <div>
                            <p className="text-gray-400 text-sm uppercase mb-1 font-bold tracking-wider">Current Bid</p>
                            <p className="text-8xl font-black text-white tabular-nums">{currentBid || currentPlayer.basePrice}</p>
                        </div>
                        
                        {/* Base Price Display */}
                        <div className="px-6 text-center border-l-4 border-gray-700">
                             <p className="text-gray-400 text-xs uppercase mb-1 font-bold">Base Price</p>
                             <p className="text-3xl font-bold text-gray-300">{currentPlayer.basePrice}</p>
                        </div>

                        <div className="flex-grow pl-6 border-l-4 border-gray-700">
                            <p className="text-gray-400 text-sm uppercase mb-1 font-bold tracking-wider">Held By</p>
                            {highestBidder ? (
                                <div className="flex items-center">
                                    {highestBidder.logoUrl ? (
                                        <img src={highestBidder.logoUrl} className="w-16 h-16 rounded-full bg-white p-1 mr-4 object-contain" alt="" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center font-bold text-white text-2xl mr-4 border-2 border-white">
                                            {highestBidder.name.charAt(0)}
                                        </div>
                                    )}
                                    <span className="text-5xl font-black text-green-400 truncate max-w-[250px]">{highestBidder.name}</span>
                                </div>
                            ) : (
                                <span className="text-4xl font-bold text-gray-600 italic uppercase">NO BIDS</span>
                            )}
                        </div>
                     </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default OBSGreen;
