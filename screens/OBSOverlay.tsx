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
    <div className="min-h-screen w-full relative font-sans overflow-hidden">
        <SponsorLogo />
        
        {/* Main Lower Third Container */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl flex items-end justify-center gap-2 md:gap-4 animate-slide-up">
            
            {/* Left: Player Info */}
            <div className="flex-1 flex flex-col items-end mb-2 min-w-0">
                {/* Name Bar */}
                <div className="w-full max-w-md bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-900 text-white py-2 md:py-3 px-6 md:px-8 rounded-t-xl border-t-2 border-l-2 border-cyan-500 shadow-[0_0_15px_rgba(0,0,0,0.5)] flex justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent"></div>
                    <h1 className="text-xl md:text-3xl font-black uppercase tracking-wider truncate relative z-10 drop-shadow-md">{player?.name}</h1>
                </div>
                {/* Role Bar */}
                <div className="w-full max-w-md bg-cyan-400 text-blue-900 py-1 md:py-1.5 px-6 md:px-8 rounded-b-xl border-b-2 border-l-2 border-white shadow-lg flex justify-center relative">
                    <span className="font-extrabold text-sm md:text-lg uppercase tracking-[0.2em]">{player?.category}</span>
                </div>
            </div>

            {/* Center: Photo & Bid */}
            <div className="shrink-0 flex flex-col items-center relative z-20 -mb-2 md:-mb-4">
                 {/* Circle Container */}
                 <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-[6px] border-white bg-gradient-to-b from-slate-200 to-slate-400 shadow-[0_0_30px_rgba(0,0,0,0.6)] overflow-hidden relative">
                      <img src={player?.photoUrl} alt={player?.name} className="w-full h-full object-cover object-top" />
                      
                      {/* Status Overlays */}
                      {status === 'SOLD' && (
                          <div className="absolute inset-0 bg-green-600/90 flex items-center justify-center">
                              <span className="text-white font-black text-xl md:text-3xl -rotate-12 border-4 border-white px-2 py-1 uppercase tracking-wider">SOLD</span>
                          </div>
                      )}
                      {status === 'UNSOLD' && (
                          <div className="absolute inset-0 bg-red-600/90 flex items-center justify-center">
                              <span className="text-white font-black text-xl md:text-3xl -rotate-12 border-4 border-white px-2 py-1 uppercase tracking-wider">UNSOLD</span>
                          </div>
                      )}
                 </div>
                 
                 {/* Bid Pill */}
                 <div className="flex items-stretch -mt-4 md:-mt-6 transform scale-110 shadow-2xl relative z-30">
                     <div className="bg-white text-blue-900 px-2 md:px-4 py-1 md:py-2 rounded-l-lg border-y-2 border-l-2 border-gray-300 flex items-center">
                         <span className="text-[10px] md:text-xs font-black uppercase tracking-tight">CURRENT BID</span>
                     </div>
                     <div className="bg-cyan-400 text-blue-900 px-3 md:px-6 py-1 md:py-2 rounded-r-lg border-y-2 border-r-2 border-white flex items-center min-w-[80px] md:min-w-[100px] justify-center">
                         <span className="text-xl md:text-3xl font-black tabular-nums leading-none">{bid.toLocaleString()}</span>
                     </div>
                 </div>
            </div>

            {/* Right: Team Info */}
            <div className="flex-1 flex flex-col items-start mb-2 relative min-w-0">
                {/* Team Logo Floater */}
                <div className="absolute -top-12 md:-top-20 right-0 md:left-4 md:right-auto w-12 h-12 md:w-20 md:h-20 bg-white rounded-xl shadow-lg border-4 border-cyan-400 p-1 z-30 transform -rotate-6">
                    {bidder?.logoUrl ? <img src={bidder.logoUrl} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-lg md:text-3xl">?</div>}
                </div>

                {/* Team Name Bar */}
                <div className="w-full max-w-md bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-900 text-white py-2 md:py-3 px-6 md:px-8 rounded-t-xl border-t-2 border-r-2 border-cyan-500 shadow-[0_0_15px_rgba(0,0,0,0.5)] flex justify-center md:pl-16 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent"></div>
                    <h2 className="text-xl md:text-3xl font-black uppercase tracking-wider truncate relative z-10 drop-shadow-md">{bidder ? bidder.name : "NO BIDS YET"}</h2>
                </div>

                {/* Balance Bar */}
                <div className="w-full max-w-md flex rounded-b-xl shadow-lg overflow-hidden border-b-2 border-r-2 border-white">
                    <div className="bg-white text-blue-900 py-1 md:py-1.5 px-4 flex-1 text-right">
                         <span className="font-bold text-xs md:text-base uppercase tracking-tight">Balance</span>
                    </div>
                    <div className="bg-cyan-400 text-blue-900 py-1 md:py-1.5 px-4 w-24 md:w-36 text-center">
                         <span className="font-extrabold text-sm md:text-xl">{bidder ? bidder.budget.toLocaleString() : "-"}</span>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );

  const RenderMinimal = () => (
      <div className="min-h-screen w-full relative">
          <SponsorLogo />
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <div className="bg-gradient-to-r from-indigo-900 to-blue-900 backdrop-blur-md rounded-full px-6 py-2 flex items-center gap-6 border-2 border-cyan-500 shadow-xl">
                  <div className="flex items-center gap-3">
                      <img src={player?.photoUrl} className="w-12 h-12 rounded-full border-2 border-white object-cover" />
                      <div>
                          <h1 className="text-white font-bold text-lg leading-none">{player?.name}</h1>
                          <span className="text-xs text-cyan-400 uppercase font-bold">{player?.category}</span>
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
                              {bidder.logoUrl && <img src={bidder.logoUrl} className="w-8 h-8 object-contain bg-white rounded-full p-0.5" />}
                              <span className="text-white font-bold">{bidder.name}</span>
                          </div>
                      </>
                  )}
                  {status !== 'LIVE' && status !== 'WAITING' && (
                      <div className={`px-3 py-1 rounded-full font-bold text-xs ${status === 'SOLD' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                          {status}
                      </div>
                  )}
              </div>
          </div>
      </div>
  );

  const RenderVertical = () => (
      <div className="min-h-screen w-full relative">
          <div className="absolute top-0 right-0 h-full w-[300px] bg-gradient-to-b from-indigo-900 to-slate-900 border-l-4 border-cyan-500 flex flex-col p-6 shadow-2xl">
               <div className="bg-white/10 rounded-full p-2 mb-4 flex justify-center mx-auto w-36 h-36 border-4 border-cyan-500 relative">
                    <img src={player?.photoUrl} className="w-full h-full rounded-full object-cover" />
               </div>
               <h1 className="text-white text-2xl font-black text-center mb-1 leading-tight">{player?.name}</h1>
               <p className="text-cyan-400 text-center text-sm font-bold uppercase mb-6 tracking-widest">{player?.category}</p>
               
               <div className="bg-white/10 p-4 rounded-xl text-center mb-6 border border-white/20">
                   <p className="text-gray-300 text-xs uppercase mb-1 font-bold">Current Bid</p>
                   <p className="text-4xl font-black text-white">{bid.toLocaleString()}</p>
               </div>

               {bidder ? (
                   <div className="bg-indigo-800 p-4 rounded-xl border border-indigo-600">
                       <p className="text-xs text-gray-300 uppercase mb-2 font-bold">Highest Bidder</p>
                       <div className="flex items-center gap-3">
                            {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-10 h-10 rounded-full bg-white p-0.5"/> : <div className="w-10 h-10 bg-gray-600 rounded-full"/>}
                            <p className="font-bold text-white leading-tight">{bidder.name}</p>
                       </div>
                   </div>
               ) : (
                   <div className="text-center text-gray-500 italic mt-4">Waiting for bids...</div>
               )}

               <div className="mt-auto">
                   {status === 'SOLD' && <div className="bg-green-600 text-white text-center py-2 font-black text-xl rounded uppercase animate-pulse shadow-lg">SOLD</div>}
                   {status === 'UNSOLD' && <div className="bg-red-600 text-white text-center py-2 font-black text-xl rounded uppercase shadow-lg">UNSOLD</div>}
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