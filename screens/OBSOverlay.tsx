
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
    status: 'WAITING' | 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED';
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

      if (status === AuctionStatus.Finished) {
           setDisplay({ player: null, bid: 0, bidder: null, status: 'FINISHED' });
           return;
      }

      if (currentPlayer) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
          let derivedStatus: 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED' = 'LIVE';
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
          if (display.status !== 'WAITING' && display.status !== 'FINISHED') {
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

  // --- OVERRIDE RENDERER ---
  if (state.adminViewOverride && state.adminViewOverride.type !== 'NONE') {
      const { type, data } = state.adminViewOverride;

      const OverlayCard = ({ children, title }: any) => (
          <div className="min-h-screen w-full flex flex-col items-center justify-center relative p-8">
              <SponsorLogo />
              <div className="bg-gradient-to-br from-indigo-900/95 via-slate-900/95 to-black/95 backdrop-blur-xl rounded-2xl border-2 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.15)] p-0 w-full max-w-4xl animate-slide-up overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-900/40 to-blue-900/40 px-6 py-4 border-b border-cyan-500/30 flex items-center justify-center relative">
                      <div className="absolute left-0 top-0 h-full w-2 bg-cyan-500"></div>
                      <h1 className="text-3xl font-black text-cyan-400 uppercase tracking-widest drop-shadow-md text-center">{title}</h1>
                  </div>
                  <div className="p-6">
                      {children}
                  </div>
              </div>
          </div>
      );

      if (type === 'SQUAD' && data?.teamId) {
          const team = state.teams.find(t => String(t.id) === String(data.teamId));
          if (team) {
              return (
                  <OverlayCard title={team.name}>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {team.players.map((p, i) => (
                              <div key={i} className="bg-white/5 p-3 rounded flex items-center gap-3 border border-white/10 hover:border-cyan-500/50 transition-colors">
                                  <div className="w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs font-bold shadow-lg">#{i+1}</div>
                                  <div className="min-w-0">
                                      <p className="text-white font-bold text-sm truncate">{p.name}</p>
                                      <p className="text-cyan-300 text-xs font-mono">{p.soldPrice?.toLocaleString()}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </OverlayCard>
              );
          }
      }

      if (type === 'TOP_5') {
          const soldPlayers = state.teams.flatMap(t => t.players).sort((a, b) => (Number(b.soldPrice) || 0) - (Number(a.soldPrice) || 0)).slice(0, 5);
          return (
              <OverlayCard title="Top 5 Buys">
                  <div className="space-y-3">
                      {soldPlayers.map((p, i) => (
                          <div key={i} className="flex justify-between items-center bg-gradient-to-r from-slate-800 to-slate-900 p-3 rounded border-l-4 border-cyan-500 hover:bg-slate-800 transition-colors shadow-lg">
                              <div className="flex items-center gap-4">
                                  <div className={`text-2xl font-black ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-orange-400':'text-gray-600'}`}>#{i+1}</div>
                                  <img src={p.photoUrl} className="w-12 h-12 rounded-full object-cover border-2 border-white/10"/>
                                  <div>
                                      <p className="text-white font-bold text-lg leading-none mb-1">{p.name}</p>
                                      <p className="text-cyan-400 text-xs uppercase font-bold tracking-wider">{p.category}</p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-2xl font-black text-green-400 tabular-nums drop-shadow-sm">{p.soldPrice?.toLocaleString()}</p>
                                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{p.soldTo}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </OverlayCard>
          );
      }

      if (type === 'PURSES') {
          const sortedTeams = [...state.teams].sort((a,b) => b.budget - a.budget);
          return (
              <OverlayCard title="Remaining Purse">
                  <div className="grid grid-cols-2 gap-4">
                      {sortedTeams.map((team, i) => (
                          <div key={team.id} className="flex justify-between items-center bg-white/5 p-3 rounded border border-white/10 relative overflow-hidden">
                              <div className="absolute left-0 top-0 h-full w-1 bg-cyan-500"></div>
                              <div className="flex items-center gap-3 pl-2">
                                  {team.logoUrl ? <img src={team.logoUrl} className="w-8 h-8 object-contain bg-white rounded-full p-0.5"/> : <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold text-xs text-white">{team.name.charAt(0)}</div>}
                                  <span className="text-white font-bold text-sm truncate max-w-[120px]">{team.name}</span>
                              </div>
                              <span className="text-green-400 font-mono font-black text-xl tabular-nums">{team.budget.toLocaleString()}</span>
                          </div>
                      ))}
                  </div>
              </OverlayCard>
          );
      }
  }

  // ... (Existing Rendering Logic for Live/Finished/Waiting) ...

  if (display.status === 'FINISHED') {
      return (
          <div className="min-h-screen w-full flex flex-col items-center justify-center relative">
              <SponsorLogo />
              <div className="bg-green-900/90 text-white px-16 py-8 rounded-3xl border-4 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)] animate-bounce-in text-center">
                  <h1 className="text-4xl md:text-6xl font-black tracking-widest uppercase text-green-400 mb-2">AUCTION</h1>
                  <h1 className="text-4xl md:text-6xl font-black tracking-widest uppercase text-white">COMPLETED</h1>
              </div>
          </div>
      );
  }

  // Waiting State
  if (display.status === 'WAITING' || !display.player) {
      const isStartingSoon = state.status === AuctionStatus.NotStarted;
      const waitingText = isStartingSoon ? "AUCTION STARTING SOON" : "WAITING FOR AUCTION";

      return (
          <div className="min-h-screen w-full flex flex-col items-center justify-end pb-20 relative">
              <SponsorLogo />
              <div className="bg-slate-900/90 text-white px-12 py-4 rounded-full border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse">
                  <h1 className="text-2xl font-bold tracking-[0.5em] uppercase text-cyan-400">{waitingText}</h1>
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
        
        {/* Main Lower Third Container - Fit to Width */}
        <div className="absolute bottom-10 w-full px-2 md:px-6 flex items-end justify-between gap-4 animate-slide-up">
            
            {/* Left Side: Player Info */}
            <div className="flex-1 flex flex-col items-end mr-2 min-w-0">
                 {/* Name Panel */}
                 <div className="w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-indigo-800 text-white py-4 px-6 rounded-l-lg border-l-8 border-cyan-400 shadow-2xl transform skew-x-[-12deg] origin-bottom-right flex items-center justify-end">
                     <div className="transform skew-x-[12deg] text-right truncate w-full">
                        <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight truncate drop-shadow-md leading-tight">
                            {player?.name}
                        </h1>
                     </div>
                 </div>
                 {/* Category/Role Panel */}
                 <div className="bg-cyan-500 text-black py-1.5 px-8 rounded-b-lg shadow-lg mt-[-4px] mr-8 transform skew-x-[-12deg] border-b-2 border-white z-10">
                      <div className="transform skew-x-[12deg] text-center font-extrabold text-xl uppercase tracking-widest">
                          {player?.category}
                      </div>
                 </div>
            </div>

            {/* Center: Photo & Bid */}
            <div className="shrink-0 flex flex-col items-center relative z-20 -mb-4 mx-2">
                 {/* Photo Circle */}
                 <div className="w-56 h-56 rounded-full border-[6px] border-white bg-slate-200 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden relative z-10 bg-gradient-to-b from-gray-100 to-gray-300">
                      <img src={player?.photoUrl} alt={player?.name} className="w-full h-full object-cover object-top" />
                      
                      {/* Status Overlay */}
                      {status !== 'LIVE' && (
                          <div className={`absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]`}>
                              <span className={`font-black text-3xl uppercase -rotate-12 border-4 px-3 py-1 tracking-wider shadow-xl ${status === 'SOLD' ? 'text-green-400 border-green-400' : 'text-red-500 border-red-500'}`}>
                                  {status}
                              </span>
                          </div>
                      )}
                 </div>
                 
                 {/* Bid Capsule */}
                 <div className="relative z-30 -mt-12">
                     <div className="flex items-stretch shadow-2xl rounded-full overflow-hidden border-4 border-white min-w-[280px] transform hover:scale-105 transition-transform">
                         <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-center border-r border-gray-700">
                             <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Current Bid</span>
                         </div>
                         <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2 flex items-center justify-center flex-grow">
                             <span className="text-5xl font-black text-white leading-none tabular-nums drop-shadow-sm">{bid.toLocaleString()}</span>
                         </div>
                     </div>
                 </div>
            </div>

            {/* Right Side: Team Info */}
            <div className="flex-1 flex flex-col items-start ml-2 relative min-w-0">
                 {/* Team Name Panel */}
                 <div className="w-full bg-gradient-to-l from-blue-900 via-indigo-900 to-indigo-800 text-white py-4 px-6 rounded-r-lg border-r-8 border-cyan-400 shadow-2xl transform skew-x-[12deg] origin-bottom-left flex items-center relative h-[88px]">
                     <div className="transform skew-x-[-12deg] w-full pl-4 pr-32">
                        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight truncate drop-shadow-md leading-tight text-left">
                            {bidder ? bidder.name : "NO BIDS YET"}
                        </h2>
                     </div>
                 </div>
                 
                 {/* Balance Panel */}
                 <div className="bg-white text-indigo-900 py-1.5 px-8 rounded-b-lg shadow-lg mt-[-4px] ml-8 transform skew-x-[12deg] border-b-2 border-cyan-500 z-10 min-w-[220px]">
                      <div className="transform skew-x-[-12deg] flex items-center gap-3">
                         <span className="font-bold text-sm uppercase text-gray-500">Balance:</span>
                         <span className="font-extrabold text-2xl">{bidder ? bidder.budget.toLocaleString() : "-"}</span>
                      </div>
                 </div>

                 {/* Team Logo - Overlapping the bar on the right */}
                 <div className="absolute bottom-6 right-8 z-30">
                      <div className="w-28 h-28 bg-white rounded-full shadow-2xl border-4 border-cyan-400 p-2 flex items-center justify-center transform hover:scale-105 transition-transform">
                          {bidder?.logoUrl ? (
                              <img src={bidder.logoUrl} className="max-w-full max-h-full object-contain" />
                          ) : (
                              <span className="text-4xl font-bold text-gray-300">?</span>
                          )}
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
                  {status !== 'LIVE' && (
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
