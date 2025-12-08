
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe, User, TrendingUp, Wallet } from 'lucide-react';
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
  const loopInterval = state.sponsorConfig?.loopInterval || 5;
  const sponsorsLength = state.sponsors.length;

  useEffect(() => {
      if (sponsorsLength <= 1) return;
      const interval = setInterval(() => {
          setCurrentSponsorIndex(prev => (prev + 1) % sponsorsLength);
      }, loopInterval * 1000);
      return () => clearInterval(interval);
  }, [sponsorsLength, loopInterval]);

  // Construct Marquee Content
  const marqueeContent = useMemo(() => {
       const tName = state.tournamentName?.toUpperCase() || "TOURNAMENT";
       const items = ["WELCOME TO AUCTION"];
       if (tName) items.push(tName);
       state.sponsors.forEach(s => {
           items.push(s.name.toUpperCase());
       });
       return items;
  }, [state.sponsors, state.tournamentName]);

  // Force Background Colors based on theme
  useEffect(() => {
      const originalBodyBg = document.body.style.backgroundColor;
      let bg = '#f3f4f6'; // Standard
      if (state.projectorLayout === 'IPL') bg = '#0f172a'; // Dark Blue
      if (state.projectorLayout === 'MODERN') bg = '#000000'; // Black

      document.body.style.backgroundColor = bg;
      document.documentElement.style.backgroundColor = bg;
      return () => {
          document.body.style.backgroundColor = originalBodyBg;
          document.documentElement.style.backgroundColor = '';
      };
  }, [state.projectorLayout]);

  useEffect(() => {
      if (auctionId) joinAuction(auctionId);
  }, [auctionId]);

  // Sync State
  useEffect(() => {
      const { currentPlayerIndex, unsoldPlayers, currentBid, highestBidder, status, teams, auctionLog } = state;
      const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

      // Update Ticker Log
      if (auctionLog.length > 0) {
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

  // Common Components
  const SponsorLoop = () => (
      state.sponsorConfig?.showOnProjector && state.sponsors.length > 0 && (
          <div className="absolute top-4 right-4 h-[10vh] max-w-[20vw] bg-white rounded-xl shadow-lg p-2 flex items-center justify-center z-40 overflow-hidden border border-gray-200">
              <img 
                  src={state.sponsors[currentSponsorIndex]?.imageUrl} 
                  className="max-h-full max-w-full object-contain transition-opacity duration-500"
                  alt="Sponsor"
              />
          </div>
      )
  );

  const TournamentLogo = () => (
      state.auctionLogoUrl && (
          <div className="absolute top-4 left-4 h-[12vh] max-w-[20vw] bg-white rounded-xl shadow-lg p-2 flex items-center justify-center z-40 border border-gray-200">
              <img src={state.auctionLogoUrl} className="max-h-full max-w-full object-contain" />
          </div>
      )
  );

  const Marquee = () => {
      if (!state.sponsorConfig?.showOnProjector || state.sponsors.length === 0) return null;

      return (
          <div className="fixed bottom-0 left-0 w-full bg-black text-white py-2 overflow-hidden whitespace-nowrap z-50 shadow-2xl border-t-4 border-highlight">
              <div className="flex animate-marquee w-max">
                  <div className="flex shrink-0 items-center">
                    {marqueeContent.map((text, i) => (
                        <span key={i} className="mx-8 font-bold text-2xl tracking-wide flex items-center uppercase">
                            <span className="text-highlight mr-3 text-xl">★</span> {text}
                        </span>
                    ))}
                  </div>
                  {/* Duplicate for seamless loop */}
                  <div className="flex shrink-0 items-center">
                    {marqueeContent.map((text, i) => (
                        <span key={`dup-${i}`} className="mx-8 font-bold text-2xl tracking-wide flex items-center uppercase">
                            <span className="text-highlight mr-3 text-xl">★</span> {text}
                        </span>
                    ))}
                  </div>
              </div>
              <style>{`
                  @keyframes marquee {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(-50%); }
                  }
                  .animate-marquee {
                      animation: marquee 30s linear infinite;
                  }
              `}</style>
          </div>
      );
  };

  // WAITING STATE
  if (!display.player) {
      return (
          <div className={`h-screen w-full flex flex-col items-center justify-center p-10 relative overflow-hidden ${state.projectorLayout === 'IPL' ? 'bg-slate-900' : 'bg-gray-100'}`}>
              <TournamentLogo />
              <SponsorLoop />
              <div className={`p-12 rounded-3xl shadow-xl text-center border ${state.projectorLayout === 'IPL' ? 'bg-slate-800 border-yellow-500/30' : 'bg-white border-gray-200'}`}>
                  <h1 className={`text-5xl font-bold tracking-wider mb-4 ${state.projectorLayout === 'IPL' ? 'text-yellow-400' : 'text-gray-800'}`}>WAITING FOR AUCTION</h1>
                  <p className={`${state.projectorLayout === 'IPL' ? 'text-slate-400' : 'text-gray-500'} text-xl animate-pulse`}>The next player will appear shortly...</p>
              </div>
              <Marquee />
          </div>
      );
  }

  const { player, bid, bidder, status } = display;
  const layout = state.projectorLayout || 'STANDARD';

  // --- LAYOUT RENDERERS ---

  const RenderStandard = () => (
    <div className="h-screen w-full bg-gray-100 p-4 pb-16 flex flex-col font-sans overflow-hidden relative">
        <TournamentLogo />
        <SponsorLoop />
        
        {/* Main Content Area */}
        <div className="flex-1 flex gap-4 mt-16 min-h-0">
            {/* Player Image */}
            <div className="w-[30%] bg-white rounded-3xl shadow-2xl overflow-hidden relative border-4 border-white flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <img src={player?.photoUrl} alt={player?.name} className="w-full h-full object-cover object-top" />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-lg shadow-lg border border-gray-200">
                    <span className="font-bold text-xl text-gray-800 uppercase tracking-wide">{player?.category}</span>
                </div>
            </div>

            {/* Right Column */}
            <div className="flex-1 flex flex-col gap-4 min-h-0">
                {/* Info Card */}
                <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex justify-between items-start shrink-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1 text-gray-500 font-bold tracking-widest uppercase text-sm"><Globe className="w-4 h-4" /> {player?.nationality}</div>
                        <h1 className="text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-1 truncate max-w-[60vw]">{player?.name}</h1>
                        <p className="text-xl text-highlight font-bold flex items-center"><User className="w-5 h-5 mr-2"/> {player?.speciality || player?.category}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Base Price</p>
                        <p className="text-3xl font-bold text-gray-700">{player?.basePrice}</p>
                    </div>
                </div>

                {/* Bid Display */}
                <div className="flex-1 bg-gray-900 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center border-4 border-gray-800">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-highlight/10 blur-3xl rounded-full"></div>
                    
                    {status === 'SOLD' && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"><div className="flex flex-col items-center"><div className="bg-green-600 text-white font-black text-7xl lg:text-8xl px-12 py-4 border-8 border-white -rotate-12 shadow-[0_0_50px_rgba(22,163,74,0.6)] animate-bounce-in tracking-widest uppercase mb-8">SOLD</div>{bidder && <div className="bg-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up"><div className="text-right"><p className="text-xs text-gray-400 font-bold uppercase">Sold To</p><p className="text-3xl font-black text-gray-800">{bidder.name}</p></div>{bidder.logoUrl ? <img src={bidder.logoUrl} className="w-16 h-16 rounded-full border border-gray-200 object-contain" /> : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xl">{bidder.name.charAt(0)}</div>}</div>}</div></div>}
                    {status === 'UNSOLD' && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-red-600 text-white font-black text-8xl px-12 py-4 border-8 border-white -rotate-12 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce-in tracking-widest uppercase">UNSOLD</div></div>}
                    
                    <p className="text-highlight font-bold text-lg lg:text-xl uppercase tracking-[0.5em] mb-2 relative z-10">Current Bid Amount</p>
                    <div className="text-[12vh] lg:text-[18vh] leading-none font-black text-white tabular-nums drop-shadow-2xl relative z-10">{bid.toLocaleString()}</div>
                    
                    {status === 'LIVE' && bidder && (
                        <div className="mt-4 bg-gray-800 px-6 py-2 rounded-full flex items-center gap-4 border border-gray-700 relative z-10">
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Highest Bidder</p>
                                <p className="text-xl font-bold text-white">{bidder.name}</p>
                            </div>
                            {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-10 h-10 rounded-full bg-white p-0.5" /> : <div className="w-10 h-10 bg-gray-600 rounded-full" />}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Bottom Activity Section */}
        <div className="mt-4 flex gap-4 h-[15vh] relative z-20 bg-gray-100 shrink-0">
            <div className="w-1/3 bg-white rounded-3xl shadow-lg border border-gray-200 p-4 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-highlight"></div>
                <h3 className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-1 flex items-center"><TrendingUp className="w-3 h-3 mr-1"/> Recent Activity</h3>
                <div className="text-xl lg:text-2xl font-bold text-gray-800 leading-snug truncate">{latestLog || "Auction in progress..."}</div>
            </div>
            <div className="flex-1 bg-gray-900 rounded-3xl shadow-lg border border-gray-800 p-4 overflow-hidden flex flex-col">
                <h3 className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-2 flex items-center"><Wallet className="w-3 h-3 mr-1"/> Team Purses Remaining</h3>
                <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-3 custom-scrollbar">
                    {state.teams.map(team => (
                        <div key={team.id} className="min-w-[140px] bg-gray-800 p-2 rounded-xl border border-gray-700 flex flex-col items-center text-center shrink-0">
                            {team.logoUrl ? <img src={team.logoUrl} className="w-6 h-6 rounded-full mb-1 bg-white p-0.5 object-contain" /> : <div className="w-6 h-6 rounded-full bg-gray-600 mb-1 flex items-center justify-center text-white font-bold text-xs">{team.name.charAt(0)}</div>}
                            <h4 className="text-white font-bold text-xs truncate w-full">{team.name}</h4>
                            <p className="text-green-400 font-mono font-bold text-sm">{team.budget}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );

  const RenderIPL = () => (
    <div className="h-screen w-full bg-slate-900 text-white p-4 pb-16 font-sans overflow-hidden relative flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
        <TournamentLogo />
        <SponsorLoop />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full">
            
            {/* Top Bar Stats */}
            <div className="w-full max-w-7xl flex justify-between items-center px-4 mb-4">
                 <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-black px-8 py-2 rounded-r-full border-l-8 border-white shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                     <span className="font-black text-2xl tracking-wider uppercase">{player?.category}</span>
                 </div>
                 <div className="flex items-center gap-3 bg-slate-800 px-8 py-2 rounded-full border border-slate-600">
                     <span className="text-slate-400 text-sm uppercase font-bold">Base Price</span>
                     <span className="text-3xl font-bold text-white">{player?.basePrice}</span>
                 </div>
            </div>

            <div className="flex items-stretch w-full max-w-7xl gap-8 h-[55vh]">
                {/* Player Card */}
                <div className="w-[35%] bg-gradient-to-b from-slate-700 to-slate-900 p-2 rounded-2xl border-2 border-yellow-500/50 shadow-2xl relative shrink-0">
                     <div className="w-full h-full bg-slate-800 rounded-xl overflow-hidden relative">
                         <img src={player?.photoUrl} className="w-full h-full object-cover object-top" />
                         <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent p-6">
                             <h1 className="text-4xl lg:text-5xl font-black text-white text-center uppercase drop-shadow-md leading-tight mb-2">{player?.name}</h1>
                             <div className="flex justify-center gap-4 text-yellow-400 font-bold text-base">
                                 <span>{player?.nationality}</span>
                                 <span>•</span>
                                 <span>{player?.speciality}</span>
                             </div>
                         </div>
                     </div>
                </div>

                {/* Bidding Area */}
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-800/50 rounded-3xl border border-slate-700 p-6 relative overflow-hidden backdrop-blur-sm">
                    {status === 'SOLD' && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"><div className="text-center"><h1 className="text-8xl font-black text-green-500 animate-bounce mb-4">SOLD</h1><h2 className="text-4xl text-white">To {bidder?.name}</h2></div></div>}
                    {status === 'UNSOLD' && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"><h1 className="text-8xl font-black text-red-500">UNSOLD</h1></div>}

                    <div className="text-center">
                        <h3 className="text-slate-400 uppercase tracking-[0.4em] font-bold mb-2">Current Bid</h3>
                        <div className="text-[12vh] lg:text-[15vh] font-black text-white leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                            {bid.toLocaleString()}
                        </div>
                    </div>

                    {status === 'LIVE' && bidder && (
                        <div className="mt-8 flex items-center gap-6 bg-slate-900 px-8 py-4 rounded-xl border-l-4 border-yellow-500 shadow-xl">
                            <div className="w-16 h-16 bg-white rounded-full p-1">{bidder.logoUrl ? <img src={bidder.logoUrl} className="w-full h-full object-contain rounded-full"/> : <div className="w-full h-full flex items-center justify-center text-black font-bold text-2xl">{bidder.name.charAt(0)}</div>}</div>
                            <div className="text-left">
                                <p className="text-xs text-yellow-500 uppercase font-bold">Leading Bidder</p>
                                <p className="text-3xl font-black text-white uppercase">{bidder.name}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Team Purses */}
            <div className="w-full mt-6 px-4 overflow-x-auto flex gap-4 pb-2 shrink-0">
                {state.teams.map(team => (
                    <div key={team.id} className="min-w-[150px] bg-slate-800 border-t-4 border-slate-600 p-3 flex flex-col items-center shadow-lg">
                        <span className="text-xs font-bold text-slate-400 mb-1 truncate w-full text-center">{team.name}</span>
                        <span className="text-2xl font-mono text-yellow-400 font-bold">{team.budget}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  const RenderModern = () => (
      <div className="h-screen w-full bg-black text-white font-sans overflow-hidden relative p-8 pb-16 flex flex-col">
          <TournamentLogo />
          <SponsorLoop />
          
          <div className="flex-1 grid grid-cols-12 gap-8 my-auto min-h-0">
              {/* Left Panel: Player Info */}
              <div className="col-span-4 flex flex-col h-full">
                  <div className="flex-1 bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800 group h-full">
                      <img src={player?.photoUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 opacity-80" />
                      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black to-transparent p-6">
                          <h1 className="text-5xl lg:text-6xl font-bold text-white mb-3 leading-tight">{player?.name}</h1>
                          <div className="flex flex-wrap gap-2">
                              <span className="px-3 py-1 bg-lime-400 text-black font-bold text-sm uppercase rounded-sm">{player?.category}</span>
                              <span className="px-3 py-1 bg-zinc-800 text-white font-bold text-sm uppercase rounded-sm border border-zinc-700">Base: {player?.basePrice}</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Center Panel: Bidding */}
              <div className="col-span-5 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden h-full">
                   {status === 'SOLD' && <div className="absolute inset-0 bg-lime-500/90 z-20 flex items-center justify-center flex-col text-black"><h1 className="text-9xl font-black tracking-tighter">SOLD</h1><h2 className="text-4xl font-bold mt-2">{bidder?.name}</h2></div>}
                   {status === 'UNSOLD' && <div className="absolute inset-0 bg-red-600/90 z-20 flex items-center justify-center"><h1 className="text-9xl font-black tracking-tighter text-white">UNSOLD</h1></div>}
                   
                   <p className="text-zinc-500 uppercase tracking-widest text-sm mb-4 font-bold">Current Bid</p>
                   <div className="text-[12vw] lg:text-[10vw] font-black text-white tabular-nums tracking-tighter leading-none">{bid.toLocaleString()}</div>
                   
                   {status === 'LIVE' && bidder && (
                       <div className="mt-12 flex items-center gap-4 animate-pulse">
                           <div className="w-4 h-4 bg-lime-500 rounded-full shadow-[0_0_10px_rgba(132,204,22,0.8)]"></div>
                           <span className="text-3xl font-bold text-lime-400 uppercase">{bidder.name}</span>
                       </div>
                   )}
              </div>

              {/* Right Panel: Teams List */}
              <div className="col-span-3 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col p-4 overflow-hidden h-full">
                  <h3 className="text-zinc-500 font-bold uppercase text-xs mb-4 shrink-0">Live Purses</h3>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {state.teams.map(team => (
                          <div key={team.id} className="flex justify-between items-center bg-black/50 p-3 rounded border border-zinc-800">
                              <span className="font-bold text-sm text-zinc-300 truncate w-32">{team.name}</span>
                              <span className="font-mono text-lime-400 text-lg">{team.budget}</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
  );

  return (
      <>
          {layout === 'STANDARD' && <RenderStandard />}
          {layout === 'IPL' && <RenderIPL />}
          {layout === 'MODERN' && <RenderModern />}
          <Marquee />
      </>
  );
};

export default ProjectorScreen;
