
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe, User, TrendingUp, Wallet, Trophy, Star, AlertTriangle, Users } from 'lucide-react';
import { Team, Player, AuctionStatus } from '../types';

interface DisplayState {
    player: Player | null;
    bid: number;
    bidder: Team | null;
    status: 'WAITING' | 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED';
}

const Marquee = React.memo(({ content, show }: { content: string[], show: boolean }) => {
    if (!show || content.length === 0) return null;
    return (
          <div className="fixed bottom-0 left-0 w-full bg-black text-white py-2 overflow-hidden whitespace-nowrap z-50 shadow-2xl border-t-4 border-highlight">
              <div className="flex animate-marquee w-max will-change-transform">
                  <div className="flex shrink-0 items-center">
                    {content.map((text, i) => (
                        <span key={i} className="mx-8 font-bold text-2xl tracking-wide flex items-center uppercase">
                            <span className="text-highlight mr-3 text-xl">★</span> {text}
                        </span>
                    ))}
                  </div>
                  {/* Duplicate for seamless loop */}
                  <div className="flex shrink-0 items-center">
                    {content.map((text, i) => (
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
                      animation: marquee 40s linear infinite;
                  }
              `}</style>
          </div>
    );
});

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
       
       if (state.sponsors.length > 0) {
           items.push("SPONSORS:"); // Explicit label added
           state.sponsors.forEach(s => {
               items.push(s.name.toUpperCase());
           });
       }
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

      // Check for Finished State
      if (status === AuctionStatus.Finished) {
          setDisplay({ player: null, bid: 0, bidder: null, status: 'FINISHED' });
          return;
      }

      // Update Ticker Log
      if (auctionLog.length > 0) {
          const relevantLog = auctionLog.find(l => l.type === 'SOLD' || l.type === 'UNSOLD');
          if (relevantLog) setLatestLog(relevantLog.message);
      }

      if (currentPlayer) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
          let derivedStatus: 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED' = 'LIVE';
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
          if (display.status !== 'WAITING' && display.status !== 'FINISHED') {
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

  // --- SPECIAL VIEWS RENDERER ---
  if (state.adminViewOverride && state.adminViewOverride.type !== 'NONE') {
      const { type, data } = state.adminViewOverride;

      const RenderOverrideContainer = ({ children, title }: any) => (
          <div className="h-screen w-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1e293b] via-[#0f172a] to-black text-white flex flex-col p-8 relative overflow-hidden font-sans">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
              <TournamentLogo />
              <SponsorLoop />
              <div className="mt-20 mb-6 text-center z-10">
                  <h1 className="text-5xl lg:text-7xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-xl filter">{title}</h1>
                  <div className="h-1 w-64 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-4 rounded-full"></div>
              </div>
              <div className="flex-1 overflow-hidden z-10 w-full max-w-7xl mx-auto bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative">
                  {children}
              </div>
          </div>
      );

      if (type === 'SQUAD' && data?.teamId) {
          const team = state.teams.find(t => String(t.id) === String(data.teamId));
          if (team) {
              return (
                  <RenderOverrideContainer title={`Squad: ${team.name}`}>
                      <div className="h-full flex flex-col">
                          <div className="flex items-center gap-8 mb-6 pb-6 border-b border-white/10 bg-gradient-to-r from-blue-900/40 to-transparent p-6 rounded-2xl border border-blue-500/20">
                              <div className="relative">
                                  <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full"></div>
                                  {team.logoUrl ? <img src={team.logoUrl} className="w-32 h-32 rounded-full bg-white p-2 object-contain relative z-10 shadow-2xl"/> : <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-5xl font-bold relative z-10 border-4 border-white/20">{team.name.charAt(0)}</div>}
                              </div>
                              <div>
                                  <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-xl">
                                      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                                          <p className="text-slate-400 text-sm uppercase font-bold tracking-wider mb-1">Total Players</p>
                                          <span className="text-4xl font-black text-white">{team.players.length}</span>
                                      </div>
                                      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                                          <p className="text-slate-400 text-sm uppercase font-bold tracking-wider mb-1">Remaining Purse</p>
                                          <span className="text-4xl font-black text-green-400">{team.budget.toLocaleString()}</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2 custom-scrollbar">
                              {team.players.map((p, i) => (
                                  <div key={i} className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-xl flex items-center gap-4 border border-white/5 hover:border-blue-500/50 transition-all hover:scale-[1.02] shadow-lg">
                                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-500 to-yellow-300 text-black flex items-center justify-center font-black text-sm shadow-lg">#{i+1}</div>
                                      <div className="min-w-0">
                                          <p className="font-bold text-lg text-white truncate">{p.name}</p>
                                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                              <span className="text-blue-400">{p.category}</span>
                                              <span className="text-gray-600">•</span>
                                              <span className="text-green-400">{p.soldPrice?.toLocaleString()}</span>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </RenderOverrideContainer>
              );
          }
      }

      if (type === 'PURSES') {
          const sortedTeams = [...state.teams].sort((a,b) => b.budget - a.budget);
          return (
              <RenderOverrideContainer title="Team Purse Standings">
                  <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                      <div className="grid grid-cols-1 gap-4">
                          {sortedTeams.map((team, i) => (
                              <div key={team.id} className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl border border-white/5 hover:border-green-500/50 transition-all hover:translate-x-2">
                                  <div className="flex items-center gap-6">
                                      <span className={`text-4xl font-black w-12 text-center ${i < 3 ? 'text-yellow-400 drop-shadow' : 'text-slate-600'}`}>#{i+1}</span>
                                      {team.logoUrl ? <img src={team.logoUrl} className="w-16 h-16 rounded-full bg-white p-1 object-contain shadow-lg"/> : <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center font-bold text-2xl">{team.name.charAt(0)}</div>}
                                      <div>
                                          <h3 className="text-3xl font-black text-white">{team.name}</h3>
                                          <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">{team.players.length} Players Signed</p>
                                      </div>
                                  </div>
                                  <div className="text-right bg-black/20 px-6 py-2 rounded-xl border border-white/5">
                                      <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Available Funds</p>
                                      <p className="text-5xl font-black text-green-400 tabular-nums tracking-tight">{team.budget.toLocaleString()}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </RenderOverrideContainer>
          );
      }

      if (type === 'TOP_5') {
          const soldPlayers = state.teams.flatMap(t => t.players).sort((a, b) => (Number(b.soldPrice) || 0) - (Number(a.soldPrice) || 0)).slice(0, 5);
          return (
              <RenderOverrideContainer title="Top 5 Most Expensive">
                  <div className="h-full flex flex-col justify-center gap-5 px-4">
                      {soldPlayers.map((p, i) => (
                          <div key={i} className="flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-900 to-black p-6 rounded-2xl border-l-8 border-yellow-500 shadow-xl transform hover:scale-[1.02] transition-transform">
                              <div className="flex items-center gap-8">
                                  <div className={`text-6xl font-black ${i===0 ? 'text-yellow-400' : i===1 ? 'text-gray-300' : i===2 ? 'text-orange-600' : 'text-slate-700'}`}>#{i+1}</div>
                                  <img src={p.photoUrl} className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-lg" />
                                  <div>
                                      <h3 className="text-4xl font-black uppercase text-white tracking-tight">{p.name}</h3>
                                      <div className="flex gap-2 mt-1">
                                          <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border border-blue-600/30">{p.category}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-5xl font-black text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]">{p.soldPrice?.toLocaleString()}</p>
                                  <p className="text-sm text-slate-400 uppercase font-bold tracking-widest mt-1">Sold To: <span className="text-white">{p.soldTo}</span></p>
                              </div>
                          </div>
                      ))}
                  </div>
              </RenderOverrideContainer>
          );
      }

      if (type === 'SOLD' || type === 'UNSOLD') {
          const isSold = type === 'SOLD';
          const list = isSold 
                ? state.teams.flatMap(t => t.players).sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))
                : state.unsoldPlayers.filter(p => p.status === 'UNSOLD');
          
          return (
              <RenderOverrideContainer title={isSold ? "Sold Players List" : "Unsold Players List"}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto h-full pr-2 custom-scrollbar">
                      {list.map((p, i) => (
                          <div key={i} className={`bg-gradient-to-b ${isSold ? 'from-green-900/20 to-slate-900 border-green-500/30' : 'from-red-900/20 to-slate-900 border-red-500/30'} p-4 rounded-xl flex flex-col items-center text-center border hover:scale-105 transition-transform shadow-lg`}>
                              <div className="relative mb-3">
                                  <img src={p.photoUrl} className={`w-20 h-20 rounded-full object-cover border-4 ${isSold ? 'border-green-500/50' : 'border-red-500/50'}`}/>
                                  {isSold && <div className="absolute -bottom-2 -right-2 bg-green-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Sold</div>}
                              </div>
                              <h4 className="font-bold text-base truncate w-full text-white mb-1">{p.name}</h4>
                              <p className="text-xs text-slate-400 uppercase font-bold tracking-wide mb-2">{p.category}</p>
                              {isSold && (
                                  <div className="mt-auto w-full bg-black/30 rounded py-1 border border-white/5">
                                      <p className="text-green-400 font-black text-lg">{p.soldPrice?.toLocaleString()}</p>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </RenderOverrideContainer>
          );
      }
  }

  const { player, bid, bidder, status } = display;
  const layout = state.projectorLayout || 'STANDARD';

  // --- LAYOUT RENDERERS ---

  const RenderFinished = () => {
    const [slideIndex, setSlideIndex] = useState(0);

    const soldPlayers = useMemo(() => {
        return state.teams.flatMap(t => t.players).sort((a, b) => (Number(b.soldPrice) || 0) - (Number(a.soldPrice) || 0));
    }, [state.teams]);

    const mostExpensive = soldPlayers[0];
    const totalTurnover = soldPlayers.reduce((acc, p) => acc + (Number(p.soldPrice) || 0), 0);
    
    // 0: Summary, 1: Most Expensive, 2: Top 5 List
    const totalSlides = mostExpensive ? 3 : 1;

    useEffect(() => {
        const timer = setInterval(() => {
            setSlideIndex(prev => (prev + 1) % totalSlides);
        }, 8000); // Cycle every 8 seconds
        return () => clearInterval(timer);
    }, [totalSlides]);

    return (
        <div className="h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-between p-8 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black font-sans">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
             
             {/* Header */}
             <div className="z-10 text-center mt-6 animate-slide-up">
                 <h1 className="text-5xl lg:text-7xl font-black text-yellow-400 tracking-widest uppercase drop-shadow-[0_0_25px_rgba(250,204,21,0.6)]">
                     AUCTION COMPLETED
                 </h1>
                 <div className="h-2 w-48 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-6 rounded-full"></div>
             </div>

             {/* Content Carousel */}
             <div className="flex-1 flex items-center justify-center w-full max-w-7xl z-10 px-4">
                 {slideIndex === 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 w-full animate-fade-in">
                         <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/10 text-center flex flex-col justify-center items-center shadow-2xl transform hover:scale-105 transition-transform duration-500">
                             <div className="bg-green-500/20 p-6 rounded-full mb-6 ring-4 ring-green-500/20">
                                <TrendingUp className="w-16 h-16 text-green-400" />
                             </div>
                             <h2 className="text-2xl lg:text-3xl text-gray-400 uppercase font-bold tracking-widest mb-4">Total Turnover</h2>
                             <p className="text-6xl lg:text-8xl font-black text-white tabular-nums tracking-tighter">{totalTurnover.toLocaleString()}</p>
                         </div>
                         <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/10 text-center flex flex-col justify-center items-center shadow-2xl transform hover:scale-105 transition-transform duration-500">
                             <div className="bg-blue-500/20 p-6 rounded-full mb-6 ring-4 ring-blue-500/20">
                                <User className="w-16 h-16 text-blue-400" />
                             </div>
                             <h2 className="text-2xl lg:text-3xl text-gray-400 uppercase font-bold tracking-widest mb-4">Players Sold</h2>
                             <p className="text-6xl lg:text-8xl font-black text-white tabular-nums tracking-tighter">{soldPlayers.length}</p>
                         </div>
                     </div>
                 )}

                 {slideIndex === 1 && mostExpensive && (
                     <div className="flex flex-col md:flex-row items-center gap-12 w-full animate-slide-up">
                         <div className="w-full md:w-1/2 flex justify-center">
                              <div className="relative w-72 h-72 lg:w-[30rem] lg:h-[30rem] rounded-full border-8 border-yellow-500 shadow-[0_0_80px_rgba(234,179,8,0.5)] overflow-hidden bg-gray-800 ring-8 ring-yellow-500/30">
                                  <img src={mostExpensive.photoUrl} className="w-full h-full object-cover" />
                                  <div className="absolute bottom-0 w-full bg-gradient-to-t from-black to-transparent pt-20 pb-6 text-center">
                                      <p className="text-yellow-400 font-bold uppercase tracking-widest text-lg lg:text-xl text-shadow">Most Expensive Player</p>
                                  </div>
                              </div>
                         </div>
                         <div className="w-full md:w-1/2 text-center md:text-left">
                              <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500 rounded-full mb-4">
                                  <Trophy className="w-6 h-6 text-yellow-400"/>
                                  <span className="text-yellow-400 font-bold uppercase tracking-wider text-sm">Record Breaker</span>
                              </div>
                              <h1 className="text-5xl lg:text-8xl font-black text-white leading-tight mb-6 drop-shadow-xl">{mostExpensive.name}</h1>
                              
                              <div className="flex flex-col gap-2 mb-8">
                                  <span className="text-gray-400 uppercase text-lg font-bold tracking-widest">Sold Price</span>
                                  <span className="text-6xl lg:text-8xl font-black text-green-400 tabular-nums drop-shadow-lg">{mostExpensive.soldPrice?.toLocaleString()}</span>
                              </div>
                              
                              <div className="flex items-center justify-center md:justify-start gap-4 bg-white/10 p-4 rounded-xl border border-white/10 backdrop-blur-md w-fit mx-auto md:mx-0">
                                  <span className="text-xl text-gray-300 font-bold uppercase">Sold To:</span>
                                  <span className="text-2xl lg:text-4xl font-black text-white">
                                      {mostExpensive.soldTo}
                                  </span>
                              </div>
                         </div>
                     </div>
                 )}

                 {slideIndex === 2 && (
                     <div className="w-full max-w-5xl animate-fade-in bg-white/5 rounded-3xl p-8 border border-white/10 backdrop-blur-md shadow-2xl">
                         <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-4 border-b border-white/10 pb-6">
                             <div className="bg-yellow-500 p-2 rounded-lg text-black">
                                 <Star className="w-6 h-6 fill-current" />
                             </div>
                             TOP 5 BUYS
                         </h2>
                         <div className="space-y-4">
                             {soldPlayers.slice(0, 5).map((p, idx) => (
                                 <div key={p.id} className="flex items-center justify-between bg-white/5 p-4 lg:p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group">
                                     <div className="flex items-center gap-6">
                                         <div className={`w-12 h-12 flex items-center justify-center rounded-xl font-black text-2xl ${idx === 0 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50' : idx === 1 ? 'bg-gray-300 text-black' : idx === 2 ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                                             #{idx + 1}
                                         </div>
                                         <img src={p.photoUrl} className="w-16 h-16 rounded-full object-cover border-2 border-white/20 group-hover:border-white transition-colors" />
                                         <div>
                                             <h3 className="text-2xl lg:text-3xl font-bold text-white leading-none mb-1">{p.name}</h3>
                                             <p className="text-sm text-gray-400 uppercase tracking-wider font-bold">{p.category}</p>
                                         </div>
                                     </div>
                                     <div className="text-right">
                                         <p className="text-3xl lg:text-4xl font-black text-green-400 tabular-nums">{p.soldPrice?.toLocaleString()}</p>
                                         <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{p.soldTo}</p>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
             </div>

             {/* Footer */}
             <div className="z-10 mb-8 text-center animate-pulse">
                 <p className="text-xl lg:text-3xl text-gray-500 uppercase tracking-[0.6em] font-light">
                     Thank You For Watching
                 </p>
             </div>
        </div>
    );
  };

  const RenderWaiting = () => {
    const isStartingSoon = state.status === AuctionStatus.NotStarted;
    const title = isStartingSoon ? "AUCTION STARTING SOON" : "WAITING FOR AUCTIONEER";
    const subtitle = isStartingSoon ? "The event will begin shortly..." : "The next player will appear shortly...";

    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center p-10 relative overflow-hidden ${state.projectorLayout === 'IPL' ? 'bg-slate-900' : 'bg-gray-100'}`}>
          <TournamentLogo />
          <SponsorLoop />
          <div className={`p-12 rounded-3xl shadow-xl text-center border ${state.projectorLayout === 'IPL' ? 'bg-slate-800 border-yellow-500/30' : 'bg-white border-gray-200'}`}>
              <h1 className={`text-5xl font-bold tracking-wider mb-4 ${state.projectorLayout === 'IPL' ? 'text-yellow-400' : 'text-gray-800'}`}>{title}</h1>
              <p className={`${state.projectorLayout === 'IPL' ? 'text-slate-400' : 'text-gray-500'} text-xl animate-pulse`}>{subtitle}</p>
          </div>
      </div>
    );
  };

  const RenderStandard = () => (
    <div className="h-screen w-full bg-gray-100 p-4 pb-16 flex flex-col font-sans overflow-hidden relative">
        <TournamentLogo />
        <SponsorLoop />
        
        {/* Main Content Area - Increased Top Margin to prevent overlap */}
        <div className="flex-1 flex gap-4 mt-40 min-h-0 relative z-10">
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
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full mt-20">
            
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
          
          <div className="flex-1 grid grid-cols-12 gap-8 my-auto min-h-0 mt-20">
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
          {display.status === 'FINISHED' && <RenderFinished />}
          {display.status !== 'FINISHED' && !display.player && <RenderWaiting />}
          {display.status !== 'FINISHED' && display.player && layout === 'STANDARD' && <RenderStandard />}
          {display.status !== 'FINISHED' && display.player && layout === 'IPL' && <RenderIPL />}
          {display.status !== 'FINISHED' && display.player && layout === 'MODERN' && <RenderModern />}
          <Marquee show={!!(state.sponsorConfig?.showOnProjector && state.sponsors.length > 0)} content={marqueeContent} />
      </>
  );
};

export default ProjectorScreen;
