
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { Match, InningsState, BatsmanStats } from '../types';

const MatchOverlay: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const [match, setMatch] = useState<Match | null>(null);

    // Force Transparent Background
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

    // Recent balls (last 6)
    const recentBalls = currentInnings.recentBalls.slice(-6);

    const theme = match.overlay?.theme || 'DEFAULT';
    const view = match.overlay?.currentView || 'DEFAULT';

    // --- CWC 2023 THEME RENDERER ---
    if (theme === 'CWC2023') {
        const CWC_PURPLE = '#1c0b2b';
        const CWC_PINK = '#ff008c';
        const CWC_CYAN = '#00baff';
        
        // CSS for Navarasa Pattern Strip
        const patternStyle = {
            backgroundImage: `
                linear-gradient(45deg, ${CWC_PINK} 25%, transparent 25%), 
                linear-gradient(-45deg, ${CWC_PINK} 25%, transparent 25%), 
                linear-gradient(45deg, transparent 75%, ${CWC_CYAN} 75%), 
                linear-gradient(-45deg, transparent 75%, ${CWC_CYAN} 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
        };

        // Summary View (Similar to your first image)
        if (view === 'SUMMARY') {
            const inn1 = match.innings[1];
            const inn2 = match.innings[2];
            const team1 = match.teamAName;
            const team2 = match.teamBName;

            return (
                <div className="w-full h-screen flex flex-col justify-center items-center p-10 font-sans">
                    <div className="w-[1000px] bg-white rounded-3xl overflow-hidden shadow-2xl relative border-4 border-white/20">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#220337] to-[#3a0f5d] h-20 flex justify-between items-center px-10 relative">
                            {/* Left Strip */}
                            <div className="absolute left-0 top-0 h-full w-4" style={patternStyle}></div>
                            <div className="absolute right-0 top-0 h-full w-4" style={patternStyle}></div>

                            <span className="text-3xl font-black text-white uppercase tracking-wider">{team1}</span>
                            <div className="flex flex-col items-center">
                                <img src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/2023_Cricket_World_Cup_Logo.svg/1200px-2023_Cricket_World_Cup_Logo.svg.png" className="h-16 -mt-2 bg-white rounded-full p-2" />
                                <span className="text-white text-xs font-bold bg-[#e9008c] px-3 py-0.5 rounded-full -mt-2 uppercase">Match Summary</span>
                            </div>
                            <span className="text-3xl font-black text-white uppercase tracking-wider">{team2}</span>
                        </div>

                        {/* Scores Section */}
                        <div className="flex border-b-8 border-[#00b1e1]">
                            {/* Team 1 Score */}
                            <div className="flex-1 bg-gradient-to-br from-[#00b1e1] to-[#0092ca] p-6 text-center text-white relative overflow-hidden">
                                <h2 className="text-7xl font-black">{inn1.totalRuns}{inn1.wickets < 10 ? `-${inn1.wickets}` : ''}</h2>
                                <p className="text-xl font-bold opacity-80 mt-2">{inn1.overs} OVERS</p>
                            </div>
                            
                            {/* Team 2 Score */}
                            <div className="flex-1 bg-gradient-to-bl from-[#00b1e1] to-[#0092ca] p-6 text-center text-white relative border-l-2 border-white/20">
                                <h2 className="text-7xl font-black">{inn2.totalRuns > 0 ? `${inn2.totalRuns}${inn2.wickets < 10 ? `-${inn2.wickets}` : ''}` : 'YET TO BAT'}</h2>
                                <p className="text-xl font-bold opacity-80 mt-2">{inn2.totalRuns > 0 ? `${inn2.overs} OVERS` : 'TARGET: ' + (inn1.totalRuns + 1)}</p>
                            </div>
                        </div>

                        {/* Stats Rows - Mocked Data for visual structure based on image */}
                        <div className="grid grid-cols-2 bg-white">
                            <div className="p-4 border-r border-gray-200">
                                {(Object.values(inn1.batsmen) as BatsmanStats[]).sort((a,b) => b.runs - a.runs).slice(0,3).map((b,i) => (
                                    <div key={i} className="flex justify-between py-2 border-b border-gray-100 font-bold text-gray-700 text-lg">
                                        <span className="uppercase">{b.name}</span>
                                        <span>{b.runs} <span className="text-sm text-gray-400">({b.balls})</span></span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4">
                                {(Object.values(inn2.batsmen) as BatsmanStats[]).sort((a,b) => b.runs - a.runs).slice(0,3).map((b,i) => (
                                    <div key={i} className="flex justify-between py-2 border-b border-gray-100 font-bold text-gray-700 text-lg">
                                        <span className="uppercase">{b.name}</span>
                                        <span>{b.runs} <span className="text-sm text-gray-400">({b.balls})</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Result Bar */}
                        <div className="bg-[#00b1e1] py-4 text-center">
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest drop-shadow-md">
                                {match.winnerId ? `Winner Declared` : 'Match In Progress'}
                            </h2>
                        </div>
                    </div>
                </div>
            );
        }

        // Standard Lower Third (Default CWC)
        return (
            <div className="w-full h-screen flex flex-col justify-end pb-8 px-8 font-sans text-white">
                <div className="w-full flex items-end gap-0">
                    
                    {/* Main Bar Container */}
                    <div className="flex-1 bg-gradient-to-r from-[#220337] via-[#3a0f5d] to-[#220337] h-20 rounded-lg relative flex items-center shadow-2xl border-b-4 border-[#e9008c] overflow-hidden">
                        
                        {/* Pattern Left */}
                        <div className="absolute left-0 top-0 h-full w-3 z-20" style={patternStyle}></div>

                        {/* Batting Team Logo/Name Area */}
                        <div className="px-6 flex items-center h-full bg-black/20 border-r border-white/10 min-w-[200px]">
                            {/* <div className="w-10 h-6 bg-white rounded mr-3"></div> */} {/* Placeholder for flag */}
                            <span className="text-2xl font-black uppercase tracking-wide text-white drop-shadow-md">{battingTeamName}</span>
                        </div>

                        {/* Score Area */}
                        <div className="px-6 flex items-center justify-center h-full bg-gradient-to-b from-[#e9008c] to-[#b8006e] min-w-[160px] skew-x-[-10deg] mx-2 shadow-lg">
                            <div className="skew-x-[10deg] text-center">
                                <span className="text-4xl font-black leading-none block">{currentInnings.totalRuns}/{currentInnings.wickets}</span>
                                <span className="text-xs font-bold opacity-90">{currentInnings.overs} OVERS</span>
                            </div>
                        </div>

                        {/* Batsman 1 */}
                        <div className="flex-1 flex items-center px-4 border-r border-white/10 h-full relative">
                            <div className={`flex flex-col ${currentInnings.strikerId ? 'opacity-100' : 'opacity-40'}`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-[#00b1e1] font-black uppercase text-lg">{striker?.name || 'STRIKER'}</span>
                                    <span className="text-yellow-400 text-xs">►</span>
                                </div>
                                <span className="text-2xl font-bold">{striker?.runs || 0} <span className="text-sm font-normal text-gray-300">({striker?.balls || 0})</span></span>
                            </div>
                        </div>

                        {/* Batsman 2 */}
                        <div className="flex-1 flex items-center px-4 border-r border-white/10 h-full">
                            <div className={`flex flex-col ${currentInnings.nonStrikerId ? 'opacity-100' : 'opacity-40'}`}>
                                <span className="text-gray-300 font-bold uppercase text-lg">{nonStriker?.name || 'NON-STR'}</span>
                                <span className="text-2xl font-bold">{nonStriker?.runs || 0} <span className="text-sm font-normal text-gray-300">({nonStriker?.balls || 0})</span></span>
                            </div>
                        </div>

                        {/* Bowler Info */}
                        <div className="flex-1 flex items-center justify-end px-6 h-full bg-black/20">
                            <div className="text-right">
                                <span className="text-[#00b1e1] font-bold uppercase text-sm block">{bowler?.name || 'BOWLER'}</span>
                                <span className="text-2xl font-black text-white">{bowler?.wickets || 0}-{bowler?.runsConceded || 0} <span className="text-sm font-normal text-gray-400">({bowler?.overs || 0})</span></span>
                            </div>
                        </div>

                        {/* Pattern Right */}
                        <div className="absolute right-0 top-0 h-full w-3 z-20" style={patternStyle}></div>
                    </div>

                    {/* Logo Box (Optional) */}
                    <div className="w-24 h-24 bg-white rounded-t-lg ml-4 shadow-lg flex items-center justify-center p-2 mb-[-8px] relative z-0">
                        <img src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/2023_Cricket_World_Cup_Logo.svg/1200px-2023_Cricket_World_Cup_Logo.svg.png" className="max-w-full max-h-full" />
                    </div>
                </div>

                {/* Info Bar (Recent Balls / CRR) */}
                <div className="w-full flex justify-between items-center mt-2 px-1">
                    <div className="flex items-center gap-2 bg-white/90 px-4 py-1 rounded-full shadow-lg">
                        <span className="text-[#1c0b2b] text-xs font-black uppercase">Recent</span>
                        <div className="flex gap-1">
                            {recentBalls.map((b, i) => (
                                <span key={i} className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${b.isWicket ? 'bg-red-600 text-white' : b.runs === 4 || b.runs === 6 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-black'}`}>
                                    {b.isWicket ? 'W' : b.runs}
                                </span>
                            ))}
                        </div>
                    </div>
                    
                    <div className="bg-[#e9008c] text-white px-6 py-1 rounded-full font-bold text-sm shadow-lg tracking-wider uppercase">
                        CRR: {(currentInnings.totalRuns / Math.max(0.1, currentInnings.overs)).toFixed(2)}
                    </div>
                </div>
            </div>
        );
    }

    // --- DEFAULT THEME RENDERER ---
    return (
        <div className="w-full h-screen flex flex-col justify-end p-10 font-sans text-white">
            <div className="w-full max-w-6xl mx-auto">
                <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-t-xl border-t-4 border-yellow-500 shadow-2xl flex items-stretch h-24 overflow-hidden">
                    <div className="px-8 flex items-center gap-6 bg-black/20">
                        <div className="text-3xl font-black uppercase tracking-wider">{battingTeamName}</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-black text-yellow-400 leading-none">{currentInnings.totalRuns}/{currentInnings.wickets}</span>
                            <span className="text-2xl font-mono text-gray-300">({currentInnings.overs})</span>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-around px-6 relative">
                        <div className={`flex flex-col ${currentInnings.strikerId ? 'opacity-100' : 'opacity-50'}`}>
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-400 text-2xl">🏏</span>
                                <span className="text-2xl font-bold uppercase">{striker?.name || '-'}</span>
                            </div>
                            <span className="text-xl font-mono text-gray-300">{striker?.runs || 0} ({striker?.balls || 0})</span>
                        </div>
                        <div className="flex flex-col opacity-80">
                            <span className="text-xl font-bold uppercase">{nonStriker?.name || '-'}</span>
                            <span className="text-lg font-mono text-gray-400">{nonStriker?.runs || 0} ({nonStriker?.balls || 0})</span>
                        </div>
                        <div className="flex flex-col border-l border-white/10 pl-6">
                            <div className="flex items-center gap-2">
                                <span className="text-red-400 text-xl">⚾</span>
                                <span className="text-xl font-bold uppercase">{bowler?.name || '-'}</span>
                            </div>
                            <span className="text-lg font-mono text-gray-300">{bowler?.wickets || 0}-{bowler?.runsConceded || 0} <span className="text-xs">({bowler?.overs || 0})</span></span>
                        </div>
                    </div>
                    <div className="px-6 bg-black/40 flex flex-col justify-center items-end min-w-[150px]">
                        <span className="text-xs text-gray-400 uppercase font-bold tracking-widest">CRR</span>
                        <span className="text-3xl font-bold text-green-400">{(currentInnings.totalRuns / Math.max(0.1, currentInnings.overs)).toFixed(2)}</span>
                    </div>
                </div>
                <div className="bg-black/80 h-10 flex items-center px-4 gap-2 rounded-b-xl border-t border-white/10">
                    <span className="text-xs font-bold uppercase text-gray-400 tracking-widest mr-2">This Over:</span>
                    <div className="flex gap-2">
                        {recentBalls.map((b, i) => (
                            <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${b.isWicket ? 'bg-red-600 text-white' : b.runs >= 4 ? 'bg-green-600 text-white' : 'bg-gray-200 text-black'}`}>
                                {b.isWicket ? 'W' : b.isWide ? 'wd' : b.isNoBall ? 'nb' : b.runs}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MatchOverlay;
