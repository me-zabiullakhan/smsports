
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { Trophy, Users, Globe } from 'lucide-react';
import { Match, InningsState, BatsmanStats, BowlerStats, OverlayView, OverlayAnimation, DecisionStatus, ScoreboardTheme } from '../types';

const MatchOverlay: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const [match, setMatch] = useState<Match | null>(null);

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
    const bowlingTeamName = currentInnings.bowlingTeamId === match.teamAId ? match.teamAName : match.teamBName;
    const striker = currentInnings.batsmen[currentInnings.strikerId || ''];
    const nonStriker = currentInnings.batsmen[currentInnings.nonStrikerId || ''];
    const bowler = currentInnings.bowlers[currentInnings.currentBowlerId || ''];
    const recentBalls = currentInnings.recentBalls.slice(-6);

    const view = match.overlay?.currentView || 'DEFAULT';
    const theme = match.overlay?.theme || 'ICC_T20_2024';
    const decision = match.overlay?.decision || 'NONE';
    const animType = match.overlay?.animation || 'NONE';
    const backgroundUrl = match.overlay?.backgroundGraphicUrl;

    // --- SHARED COMPONENTS ---

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
            <div className="fixed bottom-24 left-0 w-full animate-slide-up flex justify-center px-20 z-50">
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
                    <h1 className="text-[12vw] font-black italic tracking-tighter leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]">{text}</h1>
                </div>
            </div>
        );
    };

    // --- THEME RENDERERS ---

    const T20_2010 = () => (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1200px] flex flex-col font-sans animate-slide-up z-20">
            <div className="bg-[#001427]/90 text-white flex items-stretch h-14 border-t border-cyan-400/50 shadow-2xl relative">
                <div className="bg-cyan-500 text-black px-6 flex items-center font-black text-2xl uppercase tracking-wider">{battingTeamName}</div>
                <div className="bg-white text-black px-8 flex items-center gap-3">
                    <span className="text-4xl font-black">{currentInnings.totalRuns}-{currentInnings.wickets}</span>
                    <div className="flex flex-col items-center justify-center leading-none mt-1">
                        <span className="text-[10px] font-bold text-gray-500">OVERS</span>
                        <span className="text-xl font-black">{currentInnings.overs}</span>
                    </div>
                </div>
                <div className="flex-1 flex items-center px-6 gap-8 border-l border-white/10">
                    <div className="flex items-baseline gap-2">
                        <span className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Target</span>
                        <span className="text-2xl font-black">{match.currentInnings === 2 ? match.innings[1].totalRuns + 1 : '-'}</span>
                    </div>
                    <div className="text-white/60 font-bold italic text-sm tracking-wide">
                        NEED {match.currentInnings === 2 ? (match.innings[1].totalRuns + 1 - currentInnings.totalRuns) : '-'} TO WIN FROM {match.currentInnings === 2 ? (match.totalOvers * 6 - (Math.floor(currentInnings.overs) * 6 + Math.round((currentInnings.overs % 1) * 10))) : '-'} BALLS
                    </div>
                </div>
            </div>
        </div>
    );

    const T20_2012 = () => (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1100px] flex flex-col font-sans animate-slide-up z-20">
             <div className="bg-[#0e2439] rounded-lg overflow-hidden border border-white/20 shadow-2xl flex items-stretch h-14">
                <div className="w-16 bg-white flex items-center justify-center p-2"><Trophy className="text-blue-900"/></div>
                <div className="px-6 flex items-center gap-4 bg-white/10">
                    <span className="text-white text-xl font-bold">{battingTeamName} v {bowlingTeamName}</span>
                </div>
                <div className="bg-red-600 px-6 flex items-center gap-2 border-x border-white/20">
                    <span className="text-white text-3xl font-black tabular-nums">{currentInnings.totalRuns}-{currentInnings.wickets}</span>
                </div>
                <div className="px-6 flex items-center gap-4 text-white/90 font-bold bg-white/5">
                    <span className="text-xl">{currentInnings.overs}</span>
                    <span className="text-xs text-white/40 font-black">OVERS</span>
                </div>
                <div className="flex-1 px-6 flex items-center justify-end gap-6 text-white bg-black/40">
                    <span className="text-[10px] font-black tracking-widest uppercase text-white/50">THIS OVER</span>
                    <div className="flex gap-1">
                        {recentBalls.map((b, i) => (
                            <span key={i} className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black ${b.isWicket ? 'bg-red-500' : 'bg-white/10 text-white'}`}>{b.isWicket ? 'W' : b.runs}</span>
                        ))}
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                        <span className="text-[10px] font-black text-white/40 uppercase">RUN RATE</span>
                        <span className="text-xl font-black italic">{currentInnings.currentRunRate.toFixed(2)}</span>
                    </div>
                </div>
             </div>
        </div>
    );

    const T20_2014 = () => (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1100px] flex gap-2 font-sans items-end animate-slide-up z-20">
            <div className="flex flex-col gap-0.5">
                <div className="bg-red-800 text-white flex items-stretch h-10 rounded-t-lg overflow-hidden border-b-2 border-black/30">
                    <div className="px-4 bg-red-950 flex items-center font-black">{battingTeamName}</div>
                    <div className="px-6 flex items-center text-2xl font-black italic tabular-nums">{currentInnings.totalRuns}-{currentInnings.wickets}</div>
                    <div className="px-4 bg-black/20 flex items-center font-bold text-sm">OVR {currentInnings.overs}</div>
                </div>
                <div className="bg-[#1e3a5f] text-white flex items-stretch h-8 rounded-b-lg overflow-hidden">
                    <div className="px-3 flex items-center text-[10px] font-black uppercase tracking-widest bg-black/20">TO WIN</div>
                    <div className="px-4 flex items-center text-lg font-black italic">{match.currentInnings === 2 ? (match.innings[1].totalRuns + 1 - currentInnings.totalRuns) : '-'}</div>
                    <div className="w-px h-full bg-white/10"></div>
                    <div className="px-4 flex items-center text-sm font-bold text-cyan-400">{match.currentInnings === 2 ? (match.totalOvers * 6 - (Math.floor(currentInnings.overs) * 6 + Math.round((currentInnings.overs % 1) * 10))) : '-'} balls</div>
                </div>
            </div>

            <div className="flex-1 h-full flex flex-col gap-0.5">
                <div className="grid grid-cols-3 gap-1 h-10">
                    <div className="bg-[#004e92] rounded-t-lg p-2 flex justify-between items-center text-white border-b-2 border-black/20">
                        <span className="text-xs font-black uppercase tracking-wider truncate">{striker?.name || '-'}</span>
                        <span className="text-lg font-black">{striker?.runs || 0}<span className="text-[10px] font-normal opacity-60">({striker?.balls || 0})</span></span>
                    </div>
                    <div className="bg-[#004e92] rounded-t-lg p-2 flex justify-between items-center text-white/70 border-b-2 border-black/20">
                        <span className="text-xs font-black uppercase tracking-wider truncate">{nonStriker?.name || '-'}</span>
                        <span className="text-lg font-black">{nonStriker?.runs || 0}<span className="text-[10px] font-normal opacity-60">({nonStriker?.balls || 0})</span></span>
                    </div>
                    <div className="bg-[#333333] rounded-t-lg p-2 flex justify-between items-center text-white border-b-2 border-black/20">
                        <span className="text-xs font-black uppercase tracking-wider truncate">{bowler?.name || '-'}</span>
                        <span className="text-lg font-black">{bowler?.wickets || 0}-{bowler?.runsConceded || 0}<span className="text-[10px] font-normal opacity-60">({bowler?.overs || 0})</span></span>
                    </div>
                </div>
            </div>
        </div>
    );

    const T20_2016 = () => (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1100px] font-sans animate-slide-up z-20">
            <div className="bg-gradient-to-r from-[#003366] via-[#004080] to-[#003366] rounded-full h-16 border-2 border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-stretch overflow-hidden">
                <div className="px-8 flex items-center gap-4 bg-white/10 relative">
                    <div className="flex items-center gap-3">
                         <div className="text-white text-sm font-bold uppercase">{bowlingTeamName}</div>
                         <div className="text-white/40 font-black italic">v</div>
                         <div className="text-white text-2xl font-black uppercase tracking-tighter">{battingTeamName}</div>
                    </div>
                    <div className="w-1.5 h-10 bg-cyan-400 rounded-full"></div>
                    <div className="text-white text-4xl font-black tracking-tighter tabular-nums">{currentInnings.totalRuns}-{currentInnings.wickets}</div>
                    <div className="text-cyan-400 text-lg font-black italic">{currentInnings.overs}</div>
                </div>

                <div className="flex-1 flex items-center px-10 gap-12 border-l border-white/5">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                             <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.8)]"></span>
                             <span className="text-white font-bold text-lg uppercase tracking-tight truncate max-w-[120px]">{striker?.name || '-'}</span>
                             <span className="text-white font-black text-xl">{striker?.runs || 0}</span>
                             <span className="text-white/40 text-sm font-bold">{striker?.balls || 0}</span>
                        </div>
                    </div>
                    <div className="flex flex-col opacity-60">
                        <div className="flex items-center gap-3">
                             <span className="text-white font-bold text-lg uppercase tracking-tight truncate max-w-[120px]">{nonStriker?.name || '-'}</span>
                             <span className="text-white font-black text-xl">{nonStriker?.runs || 0}</span>
                             <span className="text-white/40 text-sm font-bold">{nonStriker?.balls || 0}</span>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-cyan-400 font-bold text-lg uppercase tracking-tight truncate max-w-[120px]">{bowler?.name || '-'}</span>
                            <span className="text-white font-black">{bowler?.wickets || 0}-{bowler?.runsConceded || 0} <span className="text-xs opacity-50 font-bold">{bowler?.overs || 0}</span></span>
                        </div>
                        <div className="flex gap-1.5 bg-black/30 p-2 rounded-lg">
                            {recentBalls.map((b, i) => (
                                <div key={i} className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-black ${b.isWicket ? 'bg-red-500 text-white' : b.runs >= 4 ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}>{b.isWicket ? 'W' : b.runs}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {match.currentInnings === 2 && (
                <div className="flex justify-center -mt-1">
                    <div className="bg-[#002244] text-cyan-400 px-10 py-1 rounded-b-xl text-[10px] font-black uppercase tracking-[0.4em] shadow-lg border-x border-b border-white/5">TARGET {match.innings[1].totalRuns + 1}</div>
                </div>
            )}
        </div>
    );

    const T20_2021 = () => (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1200px] font-sans animate-slide-up z-20">
            <div className="flex items-center justify-center gap-1">
                {/* Team Left Decor */}
                <div className="bg-slate-800 w-16 h-16 rounded-lg border-2 border-white/10 flex items-center justify-center shadow-xl"><Globe className="text-white/40"/></div>
                
                {/* Batsmen Section */}
                <div className="bg-white/95 backdrop-blur-md rounded-lg h-16 w-80 shadow-2xl flex flex-col p-2 border-b-4 border-yellow-500">
                    <div className="flex justify-between items-center h-1/2 border-b border-gray-100">
                        <span className="font-black text-sm uppercase tracking-tight truncate max-w-[150px]">{striker?.name || '-'}</span>
                        <div className="flex items-center gap-3">
                            <span className="font-black text-lg">{striker?.runs || 0}</span>
                            <span className="text-[10px] font-bold text-gray-400">{striker?.balls || 0}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center h-1/2 opacity-60">
                        <span className="font-black text-xs uppercase tracking-tight truncate max-w-[150px]">{nonStriker?.name || '-'}</span>
                        <div className="flex items-center gap-3">
                            <span className="font-black text-sm">{nonStriker?.runs || 0}</span>
                            <span className="text-[10px] font-bold text-gray-400">{nonStriker?.balls || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Score Section */}
                <div className="bg-gradient-to-br from-pink-600 to-purple-800 rounded-lg h-20 w-96 shadow-[0_0_50px_rgba(190,24,93,0.3)] border-2 border-white/20 -mt-2 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-1 opacity-10"><Trophy className="w-12 h-12 text-white"/></div>
                    <div className="text-white text-[10px] font-black uppercase tracking-[0.3em] mb-1">{battingTeamName} v {bowlingTeamName}</div>
                    <div className="flex items-baseline gap-3 text-white">
                        <span className="text-6xl font-black tracking-tighter drop-shadow-lg tabular-nums">{currentInnings.totalRuns}-{currentInnings.wickets}</span>
                        <span className="text-2xl font-bold opacity-60">{currentInnings.overs}</span>
                    </div>
                    {match.currentInnings === 2 && (
                         <div className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mt-1">NEED {match.innings[1].totalRuns + 1 - currentInnings.totalRuns} FROM {match.totalOvers * 6 - (Math.floor(currentInnings.overs) * 6 + Math.round((currentInnings.overs % 1) * 10))} BALLS</div>
                    )}
                </div>

                {/* Bowler Section */}
                <div className="bg-white/95 backdrop-blur-md rounded-lg h-16 w-80 shadow-2xl flex flex-col p-2 border-b-4 border-cyan-500">
                    <div className="flex justify-between items-center h-1/2 border-b border-gray-100">
                        <span className="font-black text-sm uppercase tracking-tight truncate max-w-[150px]">{bowler?.name || '-'}</span>
                        <div className="flex items-center gap-3">
                            <span className="font-black text-lg">{bowler?.wickets || 0}-{bowler?.runsConceded || 0}</span>
                            <span className="text-[10px] font-bold text-gray-400">{bowler?.overs || 0}</span>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center justify-center h-1/2">
                        {recentBalls.map((b, i) => (
                             <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 border-gray-300 ${b.isWicket ? 'bg-red-500 border-red-500' : 'bg-transparent'}`}></div>
                        ))}
                    </div>
                </div>

                 {/* Team Right Decor */}
                 <div className="bg-slate-800 w-16 h-16 rounded-lg border-2 border-white/10 flex items-center justify-center shadow-xl"><Globe className="text-white/40"/></div>
            </div>
        </div>
    );

    const T20_2022 = () => (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1200px] font-sans animate-slide-up z-20">
            <div className="bg-[#0b172a] rounded-lg h-16 border border-white/10 shadow-2xl flex items-stretch overflow-hidden relative">
                <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-blue-400 to-indigo-600"></div>
                
                {/* Flags Decor */}
                <div className="w-14 bg-white/5 flex items-center justify-center border-r border-white/5"><Globe className="text-white/20 w-6 h-6"/></div>
                
                {/* Batsmen Area */}
                <div className="w-72 flex flex-col justify-center px-6 gap-0.5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                            <span className="text-white font-black uppercase text-sm truncate max-w-[130px] italic">{striker?.name || '-'}</span>
                        </div>
                        <span className="text-white font-black text-lg tabular-nums">{striker?.runs || 0} <span className="text-[10px] font-bold opacity-40 ml-1">{striker?.balls || 0}</span></span>
                    </div>
                    <div className="flex justify-between items-center opacity-40">
                         <span className="text-white font-bold uppercase text-[11px] truncate max-w-[130px] ml-3.5 italic">{nonStriker?.name || '-'}</span>
                         <span className="text-white font-black text-sm tabular-nums">{nonStriker?.runs || 0} <span className="text-[10px] font-bold opacity-40 ml-1">{nonStriker?.balls || 0}</span></span>
                    </div>
                </div>

                {/* Main Score Area */}
                <div className="bg-gradient-to-br from-[#d91d4e] to-[#a01135] flex-1 flex flex-col items-center justify-center relative border-x border-white/10">
                    <div className="text-white/40 text-[9px] font-black uppercase tracking-[0.4em] mb-0.5">{battingTeamName} v {bowlingTeamName}</div>
                    <div className="flex items-baseline gap-4 text-white">
                        <span className="text-5xl font-black italic tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] tabular-nums">{currentInnings.totalRuns}-{currentInnings.wickets}</span>
                        <span className="text-xl font-bold opacity-50 tabular-nums italic">{currentInnings.overs}</span>
                    </div>
                    {match.currentInnings === 2 && (
                         <div className="absolute bottom-1 bg-white/10 px-4 py-0.5 rounded-full text-white text-[9px] font-black uppercase tracking-widest">TARGET {match.innings[1].totalRuns + 1}</div>
                    )}
                </div>

                {/* Bowler Area */}
                <div className="w-80 flex flex-col justify-center px-6 gap-1 border-r border-white/5">
                    <div className="flex justify-between items-center">
                        <span className="text-white font-black uppercase text-sm truncate max-w-[140px] italic tracking-tight">{bowler?.name || '-'}</span>
                        <span className="text-white font-black text-lg tabular-nums">{bowler?.wickets || 0}-{bowler?.runsConceded || 0} <span className="text-[10px] font-bold opacity-40 ml-1 italic">{bowler?.overs || 0}</span></span>
                    </div>
                    <div className="flex gap-1.5 justify-center">
                        {recentBalls.map((b, i) => (
                             <div key={i} className={`w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[9px] font-black ${b.isWicket ? 'bg-white text-black' : b.runs >= 4 ? 'bg-yellow-500 text-black border-yellow-500' : 'text-white/40'}`}>
                                 {b.isWicket ? 'W' : b.runs === 6 ? '6' : b.runs === 4 ? '4' : '●'}
                             </div>
                        ))}
                    </div>
                </div>

                {/* Flag Right */}
                <div className="w-14 bg-white/5 flex items-center justify-center"><Globe className="text-white/20 w-6 h-6"/></div>
            </div>
        </div>
    );

    const T20_2024 = () => (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1200px] font-sans animate-slide-up z-20">
            <div className="bg-[#000a20] rounded-xl h-20 border-2 border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.7)] flex items-stretch overflow-hidden relative">
                <div className="w-20 bg-gradient-to-br from-indigo-900 to-black flex items-center justify-center border-r border-white/5"><Globe className="text-white/10 w-10 h-10"/></div>
                <div className="w-[300px] flex flex-col justify-center px-8 border-r border-white/5 gap-1.5">
                    <div className="flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-4 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
                            <span className="text-white font-black uppercase text-base tracking-tight">{striker?.name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-white font-black text-2xl tabular-nums">{striker?.runs || 0}</span>
                            <span className="text-xs font-bold text-gray-500 tabular-nums">{striker?.balls || 0}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center opacity-40">
                         <div className="flex items-center gap-3 ml-4">
                             <span className="text-white font-bold uppercase text-sm tracking-tight">{nonStriker?.name || '-'}</span>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="text-white font-black text-lg tabular-nums">{nonStriker?.runs || 0}</span>
                            <span className="text-[10px] font-bold text-gray-500 tabular-nums">{nonStriker?.balls || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-stretch overflow-hidden relative">
                    <div className="h-full flex items-center bg-gradient-to-r from-[#000d2b] via-[#00174d] to-[#000d2b]">
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <span className="text-[#64748b] text-[10px] font-black uppercase tracking-[0.4em] mb-1">{battingTeamName} v {bowlingTeamName}</span>
                            <div className="flex items-baseline gap-4 relative">
                                <span className="text-white text-6xl font-black tracking-tighter tabular-nums leading-none">{currentInnings.totalRuns}-{currentInnings.wickets}</span>
                                <div className="bg-pink-600 px-2 py-0.5 rounded-md text-white text-[10px] font-black uppercase shadow-lg">PP</div>
                                <span className="text-white text-2xl font-bold opacity-60 tabular-nums">{currentInnings.overs} <span className="text-xs font-black uppercase ml-1 tracking-widest">Overs</span></span>
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-700"></div>
                </div>
                <div className="w-[380px] flex flex-col justify-center px-8 border-l border-white/5 gap-2 bg-black/20">
                    <div className="flex justify-between items-center">
                        <span className="text-white font-black uppercase text-base tracking-tight italic">{bowler?.name || '-'}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-[#a5b4fc] font-black text-2xl tabular-nums leading-none">{bowler?.wickets || 0}-{bowler?.runsConceded || 0}</span>
                            <span className="text-xs font-bold text-gray-500 tabular-nums">{bowler?.overs || 0}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {recentBalls.map((b, i) => (
                             <div key={i} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black shadow-lg transition-all ${b.isWicket ? 'bg-pink-600 border-pink-400 text-white animate-pulse' : b.runs >= 4 ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                                 {b.isWicket ? 'W' : b.runs}
                             </div>
                        ))}
                    </div>
                </div>
                <div className="w-20 bg-gradient-to-br from-indigo-900 to-black flex items-center justify-center border-l border-white/5"><Globe className="text-white/10 w-10 h-10"/></div>
            </div>
            {match.currentInnings === 2 && (
                <div className="flex justify-center -mt-0.5">
                    <div className="bg-[#000a20] text-white px-12 py-1 rounded-b-xl border-x-2 border-b-2 border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-indigo-500/20 opacity-50"></div>
                        <span className="text-xs font-black uppercase tracking-[0.5em] italic relative z-10">Target {match.innings[1].totalRuns + 1}</span>
                    </div>
                </div>
            )}
        </div>
    );

    const CWC_2023 = () => (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1200px] font-sans animate-slide-up z-20">
            {/* Main Wrapper Bar */}
            <div className={`h-14 w-full rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.4)] flex items-stretch overflow-hidden border border-gray-100 transition-colors ${backgroundUrl ? 'bg-transparent border-none' : 'bg-white/95 backdrop-blur-sm'}`}>
                
                {/* Left Flag Placeholder */}
                <div className="w-16 flex items-center justify-center pl-4">
                    <Globe className="text-gray-300 w-8 h-8 opacity-20" />
                </div>

                {/* Batsmen Segment */}
                <div className="flex flex-col justify-center px-4 min-w-[240px]">
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-purple-700 rounded-full"></div>
                             <span className="text-gray-800 font-black uppercase text-sm tracking-tight truncate max-w-[120px]">{striker?.name || '-'}</span>
                        </div>
                        <span className="text-gray-800 font-black text-lg tabular-nums leading-none">{striker?.runs || 0} <span className="text-[10px] font-bold text-gray-400 ml-1">{striker?.balls || 0}</span></span>
                    </div>
                    <div className="flex justify-between items-center opacity-50">
                        <span className="text-gray-800 font-bold uppercase text-[11px] truncate max-w-[120px] ml-3.5">{nonStriker?.name || '-'}</span>
                        <span className="text-gray-800 font-black text-sm tabular-nums leading-none">{nonStriker?.runs || 0} <span className="text-[10px] font-bold text-gray-400 ml-1">{nonStriker?.balls || 0}</span></span>
                    </div>
                </div>

                {/* Match Identity Box - Slanted Purple */}
                <div className="relative w-44">
                    {!backgroundUrl && <div className="absolute inset-y-0 left-[-20px] right-[-10px] bg-indigo-900 transform -skew-x-[25deg] shadow-lg"></div>}
                    <div className="relative h-full flex flex-col items-center justify-center text-white px-2">
                         <span className="text-[10px] font-black uppercase tracking-tighter truncate w-full text-center">
                            {match.teamAName} v {match.teamBName}
                         </span>
                         <span className="text-[8px] font-bold uppercase opacity-60 truncate w-full text-center tracking-widest">LIVE MATCH</span>
                    </div>
                </div>

                {/* Score Box - Slanted Pink */}
                <div className="relative w-48">
                    {!backgroundUrl && <div className="absolute inset-y-0 left-[-15px] right-[-15px] bg-pink-600 transform -skew-x-[25deg] shadow-xl border-x-2 border-white/20"></div>}
                    <div className="relative h-full flex items-center justify-center text-white gap-2">
                        <span className="text-4xl font-black italic tracking-tighter tabular-nums drop-shadow-md">
                            {currentInnings.totalRuns}-{currentInnings.wickets}
                        </span>
                        <div className="bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-sm transform skew-x-[25deg] -rotate-3">PP</div>
                    </div>
                </div>

                {/* Overs Segment */}
                <div className="flex items-center px-4">
                    <span className="text-gray-800 font-black text-xl italic tabular-nums leading-none">{currentInnings.overs}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest leading-none">Overs</span>
                </div>

                {/* Bowler Segment */}
                <div className="flex-1 flex flex-col justify-center px-4">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-800 font-black uppercase text-sm italic tracking-tight">{bowler?.name || '-'}</span>
                        <span className="text-gray-800 font-black text-lg tabular-nums leading-none">
                            {bowler?.wickets || 0}-{bowler?.runsConceded || 0} <span className="text-[10px] font-bold text-gray-400 ml-1 italic">{bowler?.overs || 0}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className="bg-red-500 w-3 h-3 rounded-full flex items-center justify-center shadow-inner animate-pulse"><span className="text-white text-[6px] font-black">▶</span></div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">LIVE BROADCAST</span>
                    </div>
                </div>

                {/* Right Flag Placeholder */}
                <div className="w-16 flex items-center justify-center pr-4">
                    <Globe className="text-gray-300 w-8 h-8 opacity-20" />
                </div>
            </div>
        </div>
    );

    const RenderTheme = () => {
        switch (theme) {
            case 'ICC_T20_2010': return <T20_2010 />;
            case 'ICC_T20_2012': return <T20_2012 />;
            case 'ICC_T20_2014': return <T20_2014 />;
            case 'ICC_T20_2016': return <T20_2016 />;
            case 'ICC_T20_2021': return <T20_2021 />;
            case 'ICC_T20_2022': return <T20_2022 />;
            case 'ICC_T20_2024': return <T20_2024 />;
            case 'CWC_2023': return <CWC_2023 />;
            default: return <T20_2024 />;
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden">
            <style>{`
                @keyframes slide-up { from { transform: translate(-50%, 100px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
                @keyframes bounce-in { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
                .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
            
            {backgroundUrl && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[1200px] h-14 z-10 pointer-events-none animate-fade-in overflow-hidden rounded-full">
                    <img src={backgroundUrl} className="w-full h-full object-cover" alt="Overlay" />
                </div>
            )}
            
            <div className="relative z-20 w-full h-full">
                <DecisionBanner />
                <AnimationLayer />
                <RenderTheme />
            </div>
        </div>
    );
}

export default MatchOverlay;
