
import React, { useEffect, useState, useRef } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { User, Gavel, DollarSign } from 'lucide-react';
import { Player, Team, AuctionStatus } from '../types';

// Types for our local frozen state
interface OverlayState {
    player: Player | null;
    bid: number;
    bidder: Team | null;
    status: 'WAITING' | 'LIVE' | 'SOLD' | 'UNSOLD';
}

const OBSOverlay: React.FC = () => {
  const { state, joinAuction } = useAuction();
  const { auctionId } = useParams<{ auctionId: string }>();
  
  // Local state to handle persistence
  const [display, setDisplay] = useState<OverlayState>({
      player: null,
      bid: 0,
      bidder: null,
      status: 'WAITING'
  });

  const [currentSponsorIndex, setCurrentSponsorIndex] = useState(0);
  const loopInterval = state.sponsorConfig?.loopInterval || 5;
  const sponsorsLength = state.sponsors.length;

  useEffect(() => {
      if (sponsorsLength <= 1) return;
      const interval = setInterval(() => {
          setCurrentSponsorIndex(prev => (prev + 1) % sponsorsLength);
      }, loopInterval * 1000);
      return () => clearInterval(interval);
  }, [sponsorsLength, loopInterval]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Force Transparency on Mount
  useEffect(() => {
      const originalBodyBg = document.body.style.backgroundColor;
      const originalHtmlBg = document.documentElement.style.backgroundColor;
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      return () => {
          document.body.style.backgroundColor = originalBodyBg;
          document.documentElement.style.backgroundColor = originalHtmlBg;
      };
  }, []);

  useEffect(() => {
      if (auctionId) joinAuction(auctionId);
  }, [auctionId]);

  // --- SYNC LOGIC ---
  useEffect(() => {
      const { currentPlayerIndex, unsoldPlayers, currentBid, highestBidder, status, teams } = state;
      const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

      if (currentPlayer) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
          let derivedStatus: 'LIVE' | 'SOLD' | 'UNSOLD' = 'LIVE';
          if (status === AuctionStatus.Sold || currentPlayer.status === 'SOLD') derivedStatus = 'SOLD';
          else if (status === AuctionStatus.Unsold || currentPlayer.status === 'UNSOLD') derivedStatus = 'UNSOLD';

          // Determine Bidder for Sold Status
          // If status is SOLD, highestBidder might be null in context, so we check player.soldTo and find the team
          let resolvedBidder = highestBidder;
          
          if (derivedStatus === 'SOLD' && !resolvedBidder && currentPlayer.soldTo) {
             const winningTeam = teams.find(t => t.name === currentPlayer.soldTo);
             if (winningTeam) resolvedBidder = winningTeam;
          }

          setDisplay({
              player: currentPlayer,
              bid: currentPlayer.soldPrice || currentBid || currentPlayer.basePrice,
              bidder: resolvedBidder,
              status: derivedStatus
          });
      } else {
          // No player
          if (display.status !== 'WAITING') {
              timeoutRef.current = setTimeout(() => {
                  setDisplay({ player: null, bid: 0, bidder: null, status: 'WAITING' });
              }, 2000); 
          }
      }
  }, [state]);

  if (window.location.protocol === 'blob:') {
      return (
          <div className="min-h-screen w-full flex items-center justify-center bg-black/90 p-10">
              <div className="bg-red-600/20 border border-red-500 text-white p-8 rounded-xl text-center">
                  <h1 className="text-2xl font-bold mb-2">Preview Mode Detected</h1>
                  <p>Please deploy the app to use the OBS Overlay.</p>
              </div>
          </div>
      );
  }

  // Common Sponsor
  const SponsorLogo = () => (
      state.sponsorConfig?.showOnOBS && state.sponsors.length > 0 && (
          <div className="absolute top-6 right-6 w-40 h-24 bg-white/90 backdrop-blur rounded-xl shadow-lg p-2 flex items-center justify-center z-50 border-2 border-white/20 overflow-hidden">
               <img 
                  src={state.sponsors[currentSponsorIndex]?.imageUrl} 
                  className="max-w-full max-h-full object-contain"
                  alt="Sponsor"
              />
          </div>
      )
  );

  // Waiting State
  if (display.status === 'WAITING' || !display.player) {
      return (
          <div className="min-h-screen w-full flex flex-col items-center justify-end pb-20 relative">
              <SponsorLogo />
              <div className="bg-slate-900/90 text-white px-12 py-4 rounded-full border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse">
                  <h1 className="text-2xl font-bold tracking-[0.5em] uppercase text-cyan-400">Waiting for Auction</h1>
              </div>
          </div>
      );
  }

  const { player, bid, bidder, status } = display;
  const layout = state.obsLayout || 'STANDARD';

  // --- LAYOUTS ---

  const RenderStandard = () => (
    <div className="min-h-screen w-full overflow-hidden relative font-sans">
        <SponsorLogo />
        <div className="absolute bottom-10 left-4 right-4 md:left-10 md:right-10 h-32 bg-slate-900/95 rounded-2xl border border-slate-700 shadow-2xl flex items-center overflow-visible animate-slide-up max-w-[95vw] mx-auto">
            <div className="relative w-[28%] md:w-[25%] h-full shrink-0">
                <div className="absolute bottom-4 left-4 w-48 md:w-56 h-56 md:h-64 z-20 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-transform duration-500 border-4 border-white bg-gray-800 rounded-xl overflow-hidden">
                    <img src={player?.photoUrl} alt={player?.name} className="w-full h-full object-cover object-top" />
                    {status === 'SOLD' && <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"><div className="bg-green-600 text-white font-black text-2xl md:text-3xl px-4 py-2 border-4 border-white -rotate-12 shadow-xl animate-bounce-in uppercase tracking-wider">SOLD</div></div>}
                    {status === 'UNSOLD' && <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"><div className="bg-red-600 text-white font-black text-2xl md:text-3xl px-4 py-2 border-4 border-white -rotate-12 shadow-xl animate-bounce-in uppercase tracking-wider">UNSOLD</div></div>}
                </div>
                <div className="absolute bottom-4 left-56 md:left-64 z-10 w-[150%] pointer-events-none">
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-1 rounded-t-lg w-fit min-w-[150px]">
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center truncate"><User className="w-3 h-3 mr-1"/> {player?.category}</span>
                    </div>
                    <div className="bg-white text-slate-900 px-4 md:px-6 py-2 rounded-b-lg rounded-tr-lg shadow-lg w-fit max-w-full">
                        <h1 className="text-2xl md:text-3xl font-black uppercase leading-none truncate">{player?.name}</h1>
                        <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center mt-1 truncate">{player?.nationality}</p>
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center z-10 px-2 border-l border-r border-slate-700/50 h-3/4 my-auto min-w-0">
                <p className="text-cyan-400 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-1 whitespace-nowrap">Current Bid</p>
                <div className="flex items-baseline justify-center w-full">
                    <span className="text-5xl md:text-6xl font-black text-white tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] truncate">{bid.toLocaleString()}</span>
                </div>
            </div>
            <div className="w-[35%] md:w-[33%] h-full flex items-center px-4 md:px-6 justify-end relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-l from-blue-900/50 to-transparent opacity-50"></div>
                {bidder ? (
                    <div className="flex items-center gap-3 md:gap-6 z-10 text-right animate-fade-in w-full justify-end">
                        <div className="min-w-0 flex-1 flex flex-col items-end">
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 whitespace-nowrap">{status === 'SOLD' ? 'SOLD TO' : 'WINNING BIDDER'}</p>
                            <h2 className="text-xl md:text-2xl font-black text-white uppercase leading-none mb-1 text-shadow w-full truncate">{bidder.name}</h2>
                            <p className="text-[10px] md:text-sm font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded inline-block border border-green-500/30 whitespace-nowrap">BAL: {bidder.budget.toLocaleString()}</p>
                        </div>
                        <div className="w-14 h-14 md:w-20 md:h-20 bg-white p-1 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)] shrink-0 border-4 border-slate-800">
                            {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-full h-full object-contain rounded-full" /> : <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-800 font-black text-lg md:text-2xl rounded-full">{bidder.name.charAt(0)}</div>}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4 z-10 opacity-50 justify-end w-full">
                         <Gavel className="w-8 h-8 text-slate-600" />
                    </div>
                )}
            </div>
        </div>
    </div>
  );

  const RenderMinimal = () => (
      <div className="min-h-screen w-full relative">
          <SponsorLogo />
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <div className="bg-black/90 backdrop-blur-md rounded-full px-6 py-2 flex items-center gap-6 border border-white/20 shadow-xl">
                  <div className="flex items-center gap-3">
                      <img src={player?.photoUrl} className="w-12 h-12 rounded-full border-2 border-white object-cover" />
                      <div>
                          <h1 className="text-white font-bold text-lg leading-none">{player?.name}</h1>
                          <span className="text-xs text-gray-400 uppercase">{player?.category}</span>
                      </div>
                  </div>
                  <div className="w-px h-8 bg-white/20"></div>
                  <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      <span className="text-3xl font-black text-white tabular-nums">{bid.toLocaleString()}</span>
                  </div>
                  {bidder && (
                      <>
                          <div className="w-px h-8 bg-white/20"></div>
                          <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 uppercase font-bold">Leading:</span>
                              <span className="text-white font-bold">{bidder.name}</span>
                          </div>
                      </>
                  )}
                  {status !== 'LIVE' && status !== 'WAITING' && (
                      <div className={`px-3 py-1 rounded font-bold text-xs ${status === 'SOLD' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                          {status}
                      </div>
                  )}
              </div>
          </div>
      </div>
  );

  const RenderVertical = () => (
      <div className="min-h-screen w-full relative">
          <div className="absolute top-0 right-0 h-full w-[300px] bg-slate-900/95 border-l-4 border-yellow-500 flex flex-col p-6 shadow-2xl">
               <div className="bg-white/10 rounded-lg p-2 mb-4 flex justify-center">
                    <img src={player?.photoUrl} className="w-32 h-32 rounded-full object-cover border-4 border-white shadow" />
               </div>
               <h1 className="text-white text-2xl font-black text-center mb-1">{player?.name}</h1>
               <p className="text-yellow-400 text-center text-sm font-bold uppercase mb-6">{player?.category}</p>
               
               <div className="bg-black/40 p-4 rounded-lg text-center mb-6">
                   <p className="text-gray-400 text-xs uppercase mb-1">Current Bid</p>
                   <p className="text-4xl font-black text-white">{bid.toLocaleString()}</p>
               </div>

               {bidder ? (
                   <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                       <p className="text-xs text-gray-400 uppercase mb-2">Highest Bidder</p>
                       <div className="flex items-center gap-3">
                            {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-10 h-10 rounded-full"/> : <div className="w-10 h-10 bg-gray-600 rounded-full"/>}
                            <p className="font-bold text-white leading-tight">{bidder.name}</p>
                       </div>
                   </div>
               ) : (
                   <div className="text-center text-gray-500 italic mt-4">Waiting for bids...</div>
               )}

               <div className="mt-auto">
                   {status === 'SOLD' && <div className="bg-green-600 text-white text-center py-2 font-black text-xl rounded uppercase animate-pulse">SOLD</div>}
                   {status === 'UNSOLD' && <div className="bg-red-600 text-white text-center py-2 font-black text-xl rounded uppercase">UNSOLD</div>}
               </div>
          </div>
      </div>
  );

  return (
    <>
        {layout === 'STANDARD' && <RenderStandard />}
        {layout === 'MINIMAL' && <RenderMinimal />}
        {layout === 'VERTICAL' && <RenderVertical />}
    </>
  );
};

export default OBSOverlay;
