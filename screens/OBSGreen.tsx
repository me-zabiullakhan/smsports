
import React, { useEffect, useState, useRef } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe, AlertTriangle, User, TrendingUp, CheckCircle, Wallet } from 'lucide-react';
import { Team, Player, AuctionStatus } from '../types';

interface DisplayState {
    player: Player | null;
    bid: number;
    bidder: Team | null;
    status: 'WAITING' | 'LIVE' | 'SOLD' | 'UNSOLD';
}

const ProjectorScreen: React.FC = () => {
  const { state, joinAuction } = useAuction();
  const { auctionId } = useParams<{ auctionId: string }>();
  
  const [display, setDisplay] = useState<DisplayState>({
      player: null,
      bid: 0,
      bidder: null,
      status: 'WAITING'
  });
  
  const [latestLog, setLatestLog] = useState<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sponsor Loop State
  const [currentSponsorIndex, setCurrentSponsorIndex] = useState(0);

  useEffect(() => {
      const interval = setInterval(() => {
          if (state.sponsors && state.sponsors.length > 0) {
              setCurrentSponsorIndex(prev => (prev + 1) % state.sponsors.length);
          }
      }, (state.sponsorConfig?.loopInterval || 5) * 1000);
      return () => clearInterval(interval);
  }, [state.sponsors, state.sponsorConfig]);

  // Force White Background for Projector
  useEffect(() => {
      const originalBodyBg = document.body.style.backgroundColor;
      document.body.style.backgroundColor = '#f3f4f6'; // Light Gray/White
      document.documentElement.style.backgroundColor = '#f3f4f6';
      return () => {
          document.body.style.backgroundColor = originalBodyBg;
          document.documentElement.style.backgroundColor = '';
      };
  }, []);

  useEffect(() => {
      if (auctionId) joinAuction(auctionId);
  }, [auctionId]);

  // Sync State
  useEffect(() => {
      const { currentPlayerIndex, unsoldPlayers, currentBid, highestBidder, status, teams, auctionLog } = state;
      const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

      // Update Ticker Log
      if (auctionLog.length > 0) {
          // Find the most recent meaningful log
          const relevantLog = auctionLog.find(l => l.type === 'SOLD' || l.type === 'UNSOLD');
          if (relevantLog) setLatestLog(relevantLog.message);
      }

      if (currentPlayer) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
          let derivedStatus: 'LIVE' | 'SOLD' | 'UNSOLD' = 'LIVE';
          if (status === AuctionStatus.Sold || currentPlayer.status === 'SOLD') derivedStatus = 'SOLD';
          else if (status === AuctionStatus.Unsold || currentPlayer.status === 'UNSOLD') derivedStatus = 'UNSOLD';

          // Resolve Bidder/Winner
          let resolvedBidder = highestBidder;
          if (derivedStatus === 'SOLD' && !resolvedBidder && currentPlayer.soldTo) {
             resolvedBidder = teams.find(t => t.name === currentPlayer.soldTo) || null;
          }

          setDisplay({
              player: currentPlayer,
              bid: currentPlayer.soldPrice || currentBid || currentPlayer.basePrice,
              bidder: resolvedBidder,
              status: derivedStatus
          });
      } else {
          // Keep display for a moment after reset or transition
          if (display.status !== 'WAITING') {
              timeoutRef.current = setTimeout(() => {
                  setDisplay({ player: null, bid: 0, bidder: null, status: 'WAITING' });
              }, 2000); 
          }
      }
  }, [state]);

  if (!display.player) {
      return (
          <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-10 relative">
              {/* Tournament Logo (Top Left) */}
              {state.auctionLogoUrl && (
                  <div className="absolute top-6 left-6 w-32 h-32 bg-white rounded-xl shadow-lg p-2 flex items-center justify-center z-50">
                      <img src={state.auctionLogoUrl} className="max-w-full max-h-full object-contain" />
                  </div>
              )}
               {/* Sponsor Logo (Top Right) */}
               {state.sponsorConfig?.showOnProjector && state.sponsors.length > 0 && (
                  <div className="absolute top-6 right-6 w-40 h-24 bg-white rounded-xl shadow-lg p-2 flex items-center justify-center z-50 overflow-hidden">
                      <img 
                          src={state.sponsors[currentSponsorIndex]?.imageUrl} 
                          className="max-w-full max-h-full object-contain transition-opacity duration-500"
                          alt="Sponsor"
                      />
                  </div>
              )}

              <div className="bg-white p-12 rounded-3xl shadow-xl text-center border border-gray-200">
                  <h1 className="text-5xl font-bold text-gray-800 tracking-wider mb-4">WAITING FOR AUCTION</h1>
                  <p className="text-gray-500 text-xl animate-pulse">The next player will appear shortly...</p>
              </div>

               {/* Scrolling Marquee (Bottom) */}
              {state.sponsorConfig?.showOnProjector && state.sponsors.length > 0 && (
                <div className="absolute bottom-0 left-0 w-full bg-black text-white py-3 overflow-hidden whitespace-nowrap z-50">
                    <div className="inline-block animate-marquee pl-[100%]">
                         {state.sponsors.map(s => s.name).join('  •  ')}  •  {state.sponsors.map(s => s.name).join('  •  ')}
                    </div>
                     <style>{`
                        @keyframes marquee {
                            0% { transform: translateX(0%); }
                            100% { transform: translateX(-100%); }
                        }
                        .animate-marquee {
                            animation: marquee 30s linear infinite;
                            display: inline-block;
                            white-space: nowrap;
                            padding-left: 100%; 
                        }
                    `}</style>
                </div>
              )}
          </div>
      );
  }

  const { player, bid, bidder, status } = display;

  return (
    <div className="min-h-screen w-full bg-gray-100 p-6 flex flex-col font-sans overflow-hidden relative pb-16">
        
        {/* TOP OVERLAYS */}
        {state.auctionLogoUrl && (
            <div className="absolute top-6 left-6 w-24 h-24 bg-white rounded-xl shadow-lg p-2 flex items-center justify-center z-50 border border-gray-200">
                <img src={state.auctionLogoUrl} className="max-w-full max-h-full object-contain" />
            </div>
        )}

        {state.sponsorConfig?.showOnProjector && state.sponsors.length > 0 && (
            <div className="absolute top-6 right-6 w-40 h-24 bg-white rounded-xl shadow-lg p-2 flex items-center justify-center z-50 border border-gray-200">
                 <img 
                    src={state.sponsors[currentSponsorIndex]?.imageUrl} 
                    className="max-w-full max-h-full object-contain"
                />
            </div>
        )}

        {/* MAIN CARD CONTAINER */}
        <div className="flex-1 flex gap-6 max-h-[75vh] mt-24">
            
            {/* LEFT: PLAYER IMAGE CARD */}
            <div className="w-[35%] bg-white rounded-3xl shadow-2xl overflow-hidden relative border-4 border-white flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <img 
                    src={player.photoUrl} 
                    alt={player.name} 
                    className="w-full h-full object-cover object-top"
                />
                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-gray-200">
                    <span className="font-bold text-2xl text-gray-800 uppercase tracking-wide">{player.category}</span>
                </div>
            </div>

            {/* RIGHT: DETAILS & BID */}
            <div className="flex-1 flex flex-col gap-6">
                
                {/* INFO HEADER */}
                <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2 text-gray-500 font-bold tracking-widest uppercase">
                            <Globe className="w-5 h-5" /> {player.nationality}
                        </div>
                        <h1 className="text-6xl font-black text-gray-900 leading-tight mb-2">{player.name}</h1>
                        <p className="text-2xl text-highlight font-bold flex items-center">
                            <User className="w-6 h-6 mr-2"/> {player.speciality || player.category}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-1">Base Price</p>
                        <p className="text-4xl font-bold text-gray-700">{player.basePrice}</p>
                    </div>
                </div>

                {/* BID DISPLAY AREA */}
                <div className="flex-1 bg-gray-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center border-4 border-gray-800">
                    
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-highlight/10 blur-3xl rounded-full"></div>

                    {/* SOLD OVERLAY ANIMATION */}
                    {status === 'SOLD' && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="flex flex-col items-center">
                                <div className="bg-green-600 text-white font-black text-8xl px-12 py-4 border-8 border-white -rotate-12 shadow-[0_0_50px_rgba(22,163,74,0.6)] animate-bounce-in tracking-widest uppercase mb-8">
                                    SOLD
                                </div>
                                {bidder && (
                                    <div className="bg-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400 font-bold uppercase">Sold To</p>
                                            <p className="text-3xl font-black text-gray-800">{bidder.name}</p>
                                        </div>
                                        {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-16 h-16 rounded-full border border-gray-200" /> : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xl">{bidder.name.charAt(0)}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {status === 'UNSOLD' && (
                         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="bg-red-600 text-white font-black text-8xl px-12 py-4 border-8 border-white -rotate-12 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce-in tracking-widest uppercase">
                                UNSOLD
                            </div>
                        </div>
                    )}

                    <p className="text-highlight font-bold text-xl uppercase tracking-[0.5em] mb-4 relative z-10">Current Bid Amount</p>
                    <div className="text-[10rem] leading-none font-black text-white tabular-nums drop-shadow-2xl relative z-10">
                        {bid.toLocaleString()}
                    </div>
                    
                    {/* Highest Bidder Indicator (If Live) */}
                    {status === 'LIVE' && bidder && (
                         <div className="mt-8 bg-gray-800 px-6 py-3 rounded-full flex items-center gap-4 border border-gray-700 relative z-10">
                             <div className="text-right">
                                 <p className="text-[10px] text-gray-400 font-bold uppercase">Highest Bidder</p>
                                 <p className="text-xl font-bold text-white">{bidder.name}</p>
                             </div>
                             {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 bg-gray-600 rounded-full" />}
                         </div>
                    )}

                </div>
            </div>
        </div>

        {/* BOTTOM SECTION: LOGS & PURSES */}
        <div className="mt-6 flex gap-6 h-[20vh] relative z-20 bg-gray-100">
            
            {/* LATEST AUCTION UPDATE LOG */}
            <div className="w-1/3 bg-white rounded-3xl shadow-lg border border-gray-200 p-6 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-highlight"></div>
                <h3 className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-2 flex items-center"><TrendingUp className="w-4 h-4 mr-2"/> Recent Activity</h3>
                <div className="text-2xl font-bold text-gray-800 leading-snug">
                    {latestLog || "Auction in progress..."}
                </div>
            </div>

            {/* TEAM PURSE TICKER (Grid/List View) */}
            <div className="flex-1 bg-gray-900 rounded-3xl shadow-lg border border-gray-800 p-6 overflow-hidden flex flex-col">
                <h3 className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-3 flex items-center"><Wallet className="w-4 h-4 mr-2"/> Team Purses Remaining</h3>
                <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-4 pb-2 custom-scrollbar">
                    {state.teams.map(team => (
                        <div key={team.id} className="min-w-[160px] bg-gray-800 p-4 rounded-2xl border border-gray-700 flex flex-col items-center text-center shrink-0">
                            {team.logoUrl ? <img src={team.logoUrl} className="w-8 h-8 rounded-full mb-2 bg-white p-0.5 object-contain" /> : <div className="w-8 h-8 rounded-full bg-gray-600 mb-2 flex items-center justify-center text-white font-bold">{team.name.charAt(0)}</div>}
                            <h4 className="text-white font-bold text-sm truncate w-full">{team.name}</h4>
                            <p className="text-green-400 font-mono font-bold text-lg">{team.budget}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Scrolling Marquee (Bottom) */}
        {state.sponsorConfig?.showOnProjector && state.sponsors.length > 0 && (
            <div className="fixed bottom-0 left-0 w-full bg-black text-white py-3 overflow-hidden whitespace-nowrap z-50">
                <div className="inline-block animate-marquee pl-[100%]">
                    {state.sponsors.map(s => s.name).join('  •  ')}  •  {state.sponsors.map(s => s.name).join('  •  ')}
                </div>
                <style>{`
                    @keyframes marquee {
                        0% { transform: translateX(0%); }
                        100% { transform: translateX(-100%); }
                    }
                    .animate-marquee {
                        animation: marquee 30s linear infinite;
                        display: inline-block;
                        white-space: nowrap;
                        padding-left: 100%; 
                    }
                `}</style>
            </div>
        )}
    </div>
  );
};

export default ProjectorScreen;
