import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
// Add Trophy import
import { Trophy } from 'lucide-react';
import { Match, InningsState, BatsmanStats, BowlerStats, OverlayView, OverlayAnimation, DecisionStatus } from '../types';

const MatchOverlay: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const [match, setMatch] = useState<Match | null>(null);

    // Force Transparent Background for OBS
    useEffect(() => {
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
    }, []);

    useEffect(() => {
        if (!matchId) return;
        const unsub = db.collection('matches').doc(matchId).onSnapshot(doc => {
            if (doc.exists) setMatch({ id: doc.id, ...doc.data() } as Match);
        });
        return () => unsub();
    }, [matchId]);

    if (!match) return null;

    const currentInnings = match.innings[match.currentInnings];
    if (!currentInnings) return null;

    const battingTeamName = currentInnings.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
    const striker = currentInnings.batsmen[currentInnings.strikerId || ''];
    const nonStriker = currentInnings.batsmen[currentInnings.nonStrikerId || ''];
    const bowler = currentInnings.bowlers[currentInnings.currentBowlerId || ''];
    const recentBalls = currentInnings.recentBalls.slice(-6);

    const view = match.overlay?.currentView || 'DEFAULT';
    const decision = match.overlay?.decision || 'NONE';
    const animType = match.overlay?.animation || 'NONE';
    const backgroundUrl = match.overlay?.backgroundGraphicUrl;
    const teamAColor = match.overlay?.teamAColor || '#0000FF';
    const teamBColor = match.overlay?.teamBColor || '#FF0000';

    // --- SUB-COMPONENTS ---

    const DecisionBanner = () => {
        if (view !== 'DECISION' || decision === 'NONE') return null;
        let bgColor = "bg-yellow-500";
        let textColor = "text-black";
        let text = "DECISION PENDING";

        if (decision === 'OUT') {
            bgColor = "bg-red-600";
            textColor = "text-white";
            text = "OUT";
        } else if (decision === 'NOT_OUT') {
            bgColor = "bg-green-600";
            textColor = "text-white";
            text = "NOT OUT";
        }

        return (
            <div className="fixed bottom-10 left-0 w-full animate-slide-up flex justify-center px-20">
                <div className={`${bgColor} ${textColor} w-full py-4 text-center rounded-lg shadow-2xl border-4 border-white/20`}>
                    <h1 className="text-6xl font-black uppercase tracking-[0.5em] italic drop-shadow-lg">{text}</h1>
                </div>
            </div>
        );
    };

    const AnimationLayer = () => {
        if (view !== 'ANIMATION' || animType === 'NONE') return null;
        
        let text = "";
        let gradient = "";
        
        switch (animType) {
            case 'FOUR': text = "FOUR"; gradient = "from-pink-600 to-pink-400"; break;
            case 'SIX': text = "SIX"; gradient = "from-blue-600 to-blue-400"; break;
            case 'WICKET': text = "WICKET"; gradient = "from-red-700 to-red-500"; break;
            case 'FREE_HIT': text = "FREE HIT"; gradient = "from-green-600 to-green-400"; break;
            default: return null;
        }

        return (
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div className={`bg-gradient-to-r ${gradient} text-white px-20 py-10 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border-8 border-white animate-bounce-in relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <h1 className="text-[12vw] font-black italic tracking-tighter leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]">{text}</h1>
                </div>
            </div>
        );
    };

    const PlayerStatsCard = ({ data, type }: { data: BatsmanStats | BowlerStats | undefined, type: 'B' | 'BW' }) => {
        if (!data) return null;
        
        return (
            <div className="fixed bottom-10 left-10 w-[450px] animate-slide-up font-sans">
                <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white p-6 rounded-2xl shadow-2xl border-2 border-white/10 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500"></div>
                    
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 mb-1 block">{type === 'B' ? 'Batsman Stats' : 'Bowler Stats'}</span>
                            <h2 className="text-3xl font-black uppercase leading-tight italic">{data.name}</h2>
                        </div>
                        {type === 'B' && <span className="bg-yellow-500 text-black font-black px-2 py-0.5 rounded text-[10px] uppercase">On Strike</span>}
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-center">
                        {type === 'B' ? (
                            <>
                                <div className="bg-white/5 p-2 rounded-lg"><p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Runs</p><p className="text-2xl font-black italic">{(data as BatsmanStats).runs}</p></div>
                                <div className="bg-white/5 p-2 rounded-lg"><p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Balls</p><p className="text-2xl font-black italic">{(data as BatsmanStats).balls}</p></div>
                                <div className="bg-white/5 p-2 rounded-lg"><p className="text-[9px] text-gray-400 font-bold uppercase mb-1">4s / 6s</p><p className="text-2xl font-black italic">{(data as BatsmanStats).fours} / {(data as BatsmanStats).sixes}</p></div>
                                <div className="bg-cyan-500/20 p-2 rounded-lg"><p className="text-[9px] text-cyan-400 font-bold uppercase mb-1">S.R.</p><p className="text-2xl font-black italic text-cyan-400">{((data as BatsmanStats).runs / Math.max(1, (data as BatsmanStats).balls) * 100).toFixed(1)}</p></div>
                            </>
                        ) : (
                            <>
                                <div className="bg-white/5 p-2 rounded-lg"><p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Overs</p><p className="text-2xl font-black italic">{(data as BowlerStats).overs}</p></div>
                                <div className="bg-white/5 p-2 rounded-lg"><p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Mdn</p><p className="text-2xl font-black italic">{(data as BowlerStats).maidens}</p></div>
                                <div className="bg-white/5 p-2 rounded-lg"><p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Runs</p><p className="text-2xl font-black italic">{(data as BowlerStats).runsConceded}</p></div>
                                <div className="bg-red-500/20 p-2 rounded-lg"><p className="text-[9px] text-red-400 font-bold uppercase mb-1">Wickets</p><p className="text-2xl font-black italic text-red-400">{(data as BowlerStats).wickets}</p></div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const StatsPanel = ({ title, players }: { title: string, players: any[] }) => (
        <div className="fixed inset-0 flex items-center justify-center p-20 z-20">
            <div className="bg-slate-900/95 backdrop-blur-xl border-4 border-purple-500 rounded-3xl w-full max-w-4xl p-10 text-white shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                <h1 className="text-4xl font-black uppercase text-center mb-10 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">{title}</h1>
                <div className="space-y-4">
                    {players.map((p, i) => (
                        <div key={i} className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                            <div className="flex items-center gap-6">
                                <span className="text-2xl font-black text-purple-400 italic">#{i+1}</span>
                                <span className="text-2xl font-bold uppercase">{p.name}</span>
                            </div>
                            <span className="text-3xl font-black tabular-nums text-pink-400">{p.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // --- THEME RENDERERS ---

    const RenderDefaultTicker = () => (
        <div className="fixed bottom-10 left-0 w-full flex flex-col justify-end p-10 font-sans text-white z-20">
            <div className="w-full max-w-6xl mx-auto animate-slide-up">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-xl border-t-4 border-purple-500 shadow-2xl flex items-stretch h-24 overflow-hidden relative">
                    <div className="absolute inset-0 bg-black/40 opacity-40"></div>
                    <div className="px-8 flex items-center gap-6 bg-black/40 z-10" style={{ backgroundColor: match.currentInnings === 1 ? teamAColor : teamBColor }}>
                        <div className="text-2xl font-black uppercase tracking-wider italic">{battingTeamName}</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-black text-white leading-none drop-shadow-lg">{currentInnings.totalRuns}/{currentInnings.wickets}</span>
                            <span className="text-2xl font-mono text-white/70 font-bold">({currentInnings.overs})</span>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-around px-6 relative z-10">
                        <div className={`flex flex-col ${currentInnings.strikerId ? 'opacity-100' : 'opacity-40'}`}>
                            <div className="flex items-center gap-2"><span className="text-lime-400 text-2xl drop-shadow-md">🏏</span><span className="text-2xl font-black uppercase italic">{striker?.name || '-'}</span></div>
                            <span className="text-xl font-mono text-gray-300 font-bold">{striker?.runs || 0} <span className="text-sm font-normal">({striker?.balls || 0})</span></span>
                        </div>
                        <div className="w-px h-12 bg-white/10"></div>
                        <div className="flex flex-col opacity-80">
                            <span className="text-xl font-bold uppercase italic text-gray-400">{nonStriker?.name || '-'}</span>
                            <span className="text-lg font-mono text-gray-500 font-bold">{nonStriker?.runs || 0} <span className="text-xs">({nonStriker?.balls || 0})</span></span>
                        </div>
                        <div className="w-px h-12 bg-white/10"></div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2"><span className="text-red-400 text-xl drop-shadow-md">⚾</span><span className="text-xl font-black uppercase italic">{bowler?.name || '-'}</span></div>
                            <span className="text-lg font-mono text-gray-300 font-bold">{bowler?.wickets || 0}-{bowler?.runsConceded || 0} <span className="text-xs">({bowler?.overs || 0})</span></span>
                        </div>
                    </div>
                    <div className="px-6 bg-black/40 flex flex-col justify-center items-end min-w-[150px] z-10">
                        <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Target</span>
                        <span className="text-4xl font-black text-lime-400 italic">{match.currentInnings === 2 ? (match.innings[1].totalRuns + 1) : '-'}</span>
                    </div>
                </div>
                <div className="bg-black/80 h-10 flex items-center px-6 gap-2 rounded-b-xl border-t border-white/10 z-10">
                    <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest mr-4 italic">Recent Balls</span>
                    <div className="flex gap-2">{recentBalls.map((b, i) => (<div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg ${b.isWicket ? 'bg-red-600 text-white' : b.runs >= 4 ? 'bg-green-600 text-white' : 'bg-gray-200 text-black'}`}>{b.isWicket ? 'W' : b.runs}</div>))}</div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="relative w-full h-screen overflow-hidden">
            <style>{`
                @keyframes slide-up { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes bounce-in { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
                .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>
            
            {backgroundUrl && (
                <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center animate-fade-in">
                    <img src={backgroundUrl} className="w-full h-full object-contain" alt="Custom Overlay Frame" />
                </div>
            )}
            
            <div className="relative z-10 w-full h-full">
                
                <DecisionBanner />
                <AnimationLayer />

                {view === 'DEFAULT' && <RenderDefaultTicker />}
                {view === 'B1' && <PlayerStatsCard data={striker} type="B" />}
                {view === 'B2' && <PlayerStatsCard data={nonStriker} type="B" />}
                {view === 'BOWLER' && <PlayerStatsCard data={bowler} type="BW" />}
                
                {view === 'TOP_BATTERS' && <StatsPanel title="Top Batters" players={[{name: 'Player 1', value: 85}, {name: 'Player 2', value: 72}, {name: 'Player 3', value: 68}]} />}
                {view === 'TOP_BOWLERS' && <StatsPanel title="Top Bowlers" players={[{name: 'Bowler A', value: '4/12'}, {name: 'Bowler B', value: '3/15'}, {name: 'Bowler C', value: '2/20'}]} />}
                
                {view === 'CUSTOM' && match.overlay?.customMessage && (
                    <div className="fixed bottom-10 left-0 w-full flex justify-center p-10 animate-slide-up">
                        <div className="bg-slate-900 border-4 border-purple-500 rounded-2xl p-10 text-white text-center shadow-2xl min-w-[600px]">
                            <h2 className="text-4xl font-black uppercase italic leading-tight">
                                {match.overlay.customMessage.split('-').map((line, idx) => <div key={idx}>{line}</div>)}
                            </h2>
                        </div>
                    </div>
                )}

                {view === 'MOM' && match.overlay?.momId && (
                    <div className="fixed inset-0 flex items-center justify-center p-20">
                         <div className="bg-gradient-to-br from-indigo-900 to-black p-10 rounded-3xl border-8 border-purple-500 shadow-2xl text-center text-white animate-bounce-in">
                             <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-6 drop-shadow-lg" />
                             <h1 className="text-2xl font-bold uppercase tracking-widest text-purple-400 mb-2">Man of the Match</h1>
                             <h1 className="text-7xl font-black uppercase italic drop-shadow-md">
                                 {/* MOM Player name lookup needs allPlayers to be populated or match to have team data */}
                                 {match.innings[1].batsmen[match.overlay.momId]?.name || 
                                  match.innings[2].batsmen[match.overlay.momId]?.name || 
                                  match.innings[1].bowlers[match.overlay.momId]?.name || 
                                  match.innings[2].bowlers[match.overlay.momId]?.name || 'Player'}
                             </h1>
                         </div>
                    </div>
                )}

                {(view === 'DECISION' || view === 'ANIMATION') && decision === 'NONE' && animType === 'NONE' && <RenderDefaultTicker />}

            </div>
        </div>
    );
}

// Internal helper for MOM logic
const allPlayers = []; // This should be populated if needed in Overlay, or fetched from Match

export default MatchOverlay;