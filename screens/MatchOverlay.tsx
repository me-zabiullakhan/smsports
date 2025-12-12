
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { Match, InningsState } from '../types';

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

    return (
        <div className="w-full h-screen flex flex-col justify-end p-10 font-sans text-white">
            {/* Lower Third Scoreboard */}
            <div className="w-full max-w-6xl mx-auto">
                
                {/* Main Bar */}
                <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-t-xl border-t-4 border-yellow-500 shadow-2xl flex items-stretch h-24 overflow-hidden">
                    
                    {/* Batting Team & Score */}
                    <div className="px-8 flex items-center gap-6 bg-black/20">
                        <div className="text-3xl font-black uppercase tracking-wider">{battingTeamName}</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-black text-yellow-400 leading-none">{currentInnings.totalRuns}/{currentInnings.wickets}</span>
                            <span className="text-2xl font-mono text-gray-300">({currentInnings.overs})</span>
                        </div>
                    </div>

                    {/* Stats Divider */}
                    <div className="flex-1 flex items-center justify-around px-6 relative">
                        {/* Striker */}
                        <div className={`flex flex-col ${currentInnings.strikerId ? 'opacity-100' : 'opacity-50'}`}>
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-400 text-2xl">🏏</span>
                                <span className="text-2xl font-bold uppercase">{striker?.name || '-'}</span>
                            </div>
                            <span className="text-xl font-mono text-gray-300">{striker?.runs || 0} ({striker?.balls || 0})</span>
                        </div>

                        {/* Non Striker */}
                        <div className="flex flex-col opacity-80">
                            <span className="text-xl font-bold uppercase">{nonStriker?.name || '-'}</span>
                            <span className="text-lg font-mono text-gray-400">{nonStriker?.runs || 0} ({nonStriker?.balls || 0})</span>
                        </div>

                        {/* Bowler */}
                        <div className="flex flex-col border-l border-white/10 pl-6">
                            <div className="flex items-center gap-2">
                                <span className="text-red-400 text-xl">⚾</span>
                                <span className="text-xl font-bold uppercase">{bowler?.name || '-'}</span>
                            </div>
                            <span className="text-lg font-mono text-gray-300">{bowler?.wickets || 0}-{bowler?.runsConceded || 0} <span className="text-xs">({bowler?.overs || 0})</span></span>
                        </div>
                    </div>

                    {/* Target / Projector (Optional) */}
                    <div className="px-6 bg-black/40 flex flex-col justify-center items-end min-w-[150px]">
                        <span className="text-xs text-gray-400 uppercase font-bold tracking-widest">CRR</span>
                        <span className="text-3xl font-bold text-green-400">{(currentInnings.totalRuns / Math.max(0.1, currentInnings.overs)).toFixed(2)}</span>
                    </div>
                </div>

                {/* Recent Balls Strip */}
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
