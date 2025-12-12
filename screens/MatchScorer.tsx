
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Match, Player, Team, InningsState, BallEvent } from '../types';
import { ArrowLeft, Settings, Users, RotateCcw, Save, Loader2, Undo2 } from 'lucide-react';

const MatchScorer: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const [match, setMatch] = useState<Match | null>(null);
    const [teamA, setTeamA] = useState<Team | null>(null);
    const [teamB, setTeamB] = useState<Team | null>(null);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [showTossModal, setShowTossModal] = useState(false);
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [playerSelectionType, setPlayerSelectionType] = useState<'STRIKER' | 'NON_STRIKER' | 'BOWLER' | null>(null);

    // Initial Data Fetch
    useEffect(() => {
        if (!matchId) return;
        const unsub = db.collection('matches').doc(matchId).onSnapshot(async doc => {
            if (doc.exists) {
                const matchData = { id: doc.id, ...doc.data() } as Match;
                setMatch(matchData);
                
                // Fetch Teams only once or if IDs change
                if (!teamA || teamA.id !== matchData.teamAId) {
                    const tA = await db.collection('auctions').doc(matchData.auctionId).collection('teams').doc(matchData.teamAId).get();
                    setTeamA({ id: tA.id, ...tA.data() } as Team);
                }
                if (!teamB || teamB.id !== matchData.teamBId) {
                    const tB = await db.collection('auctions').doc(matchData.auctionId).collection('teams').doc(matchData.teamBId).get();
                    setTeamB({ id: tB.id, ...tB.data() } as Team);
                }
                setLoading(false);
            }
        });
        return () => unsub();
    }, [matchId]);

    // Derived State Helpers
    const currentInningsNo = match?.currentInnings || 1;
    const currentInnings: InningsState | undefined = match?.innings?.[currentInningsNo];
    
    const battingTeam = currentInnings?.battingTeamId === teamA?.id ? teamA : teamB;
    const bowlingTeam = currentInnings?.bowlingTeamId === teamA?.id ? teamA : teamB;

    const striker = currentInnings?.batsmen[currentInnings.strikerId || ''];
    const nonStriker = currentInnings?.batsmen[currentInnings.nonStrikerId || ''];
    const bowler = currentInnings?.bowlers[currentInnings.currentBowlerId || ''];

    // Actions
    const updateMatch = async (updates: Partial<Match>) => {
        if (!matchId) return;
        await db.collection('matches').doc(matchId).update(updates);
    };

    const handleToss = async (winnerId: string, choice: 'BAT' | 'BOWL') => {
        if (!match) return;
        
        let battingTeamId = winnerId;
        let bowlingTeamId = winnerId === match.teamAId ? match.teamBId : match.teamAId;

        if (choice === 'BOWL') {
            const temp = battingTeamId;
            battingTeamId = bowlingTeamId;
            bowlingTeamId = temp;
        }

        const updates: any = {
            status: 'LIVE',
            tossWinnerId: winnerId,
            tossChoice: choice,
            'innings.1.battingTeamId': battingTeamId,
            'innings.1.bowlingTeamId': bowlingTeamId,
            'innings.2.battingTeamId': bowlingTeamId,
            'innings.2.bowlingTeamId': battingTeamId
        };
        await updateMatch(updates);
        setShowTossModal(false);
        // Prompt for openers
        setPlayerSelectionType('STRIKER');
        setShowPlayerModal(true);
    };

    const handlePlayerSelect = async (playerId: string) => {
        if (!match || !currentInnings) return;
        
        const updates: any = {};
        const playerKey = `innings.${currentInningsNo}`;

        if (playerSelectionType === 'STRIKER') {
            updates[`${playerKey}.strikerId`] = playerId;
            // Initialize stats if new
            if (!currentInnings.batsmen[playerId]) {
                const pName = battingTeam?.players.find(p => p.id === playerId)?.name || 'Unknown';
                updates[`${playerKey}.batsmen.${playerId}`] = { playerId, name: pName, runs: 0, balls: 0, fours: 0, sixes: 0, isStriker: true };
            }
            setPlayerSelectionType(playerSelectionType === 'STRIKER' && !currentInnings.nonStrikerId ? 'NON_STRIKER' : null);
        } else if (playerSelectionType === 'NON_STRIKER') {
            updates[`${playerKey}.nonStrikerId`] = playerId;
            if (!currentInnings.batsmen[playerId]) {
                const pName = battingTeam?.players.find(p => p.id === playerId)?.name || 'Unknown';
                updates[`${playerKey}.batsmen.${playerId}`] = { playerId, name: pName, runs: 0, balls: 0, fours: 0, sixes: 0, isStriker: false };
            }
            setPlayerSelectionType(playerSelectionType === 'NON_STRIKER' && !currentInnings.currentBowlerId ? 'BOWLER' : null);
        } else if (playerSelectionType === 'BOWLER') {
            updates[`${playerKey}.currentBowlerId`] = playerId;
            if (!currentInnings.bowlers[playerId]) {
                const pName = bowlingTeam?.players.find(p => p.id === playerId)?.name || 'Unknown';
                updates[`${playerKey}.bowlers.${playerId}`] = { playerId, name: pName, overs: 0, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 };
            }
            setPlayerSelectionType(null);
        }

        await updateMatch(updates);
        if (!playerSelectionType) setShowPlayerModal(false);
    };

    const recordBall = async (runs: number, extraType?: 'WIDE' | 'NOBALL' | 'BYE' | 'LEGBYE', isWicket: boolean = false) => {
        if (!match || !currentInnings || !striker || !bowler) {
            alert("Ensure Striker, Non-Striker and Bowler are selected");
            return;
        }

        const isWide = extraType === 'WIDE';
        const isNoBall = extraType === 'NOBALL';
        const isBye = extraType === 'BYE';
        const isLegBye = extraType === 'LEGBYE';
        const isLegalBall = !isWide && !isNoBall;

        // --- Calculate Runs ---
        // Batsman runs: Only if not wide. Byes/Legbyes don't count to bat.
        const batRuns = (isWide || isBye || isLegBye) ? 0 : runs;
        
        // Extras count
        let extraRuns = 0;
        if (isWide) extraRuns = 1 + runs; // 1 for wide + any running
        else if (isNoBall) extraRuns = 1 + runs; // 1 for NB + bat runs
        else if (isBye || isLegBye) extraRuns = runs;

        const totalBallRuns = batRuns + extraRuns;

        // --- Prepare Updates ---
        const key = `innings.${currentInningsNo}`;
        const newBallEvent: BallEvent = {
            ballNumber: currentInnings.recentBalls.length + 1,
            overNumber: Math.floor(currentInnings.ballsInCurrentOver / 6),
            bowlerId: bowler.playerId,
            batsmanId: striker.playerId,
            runs: batRuns,
            isWide, isNoBall, isWicket,
            extras: extraRuns,
            commentary: ''
        };

        const updates: any = {
            [`${key}.totalRuns`]: currentInnings.totalRuns + totalBallRuns,
            [`${key}.recentBalls`]: [...currentInnings.recentBalls, newBallEvent]
        };

        // Update Extras
        if (isWide) updates[`${key}.extras.wides`] = currentInnings.extras.wides + 1 + runs;
        if (isNoBall) updates[`${key}.extras.noBalls`] = currentInnings.extras.noBalls + 1;
        if (isBye) updates[`${key}.extras.byes`] = currentInnings.extras.byes + runs;
        if (isLegBye) updates[`${key}.extras.legByes`] = currentInnings.extras.legByes + runs;

        // Update Batsman
        if (!isWide) {
            updates[`${key}.batsmen.${striker.playerId}.runs`] = striker.runs + batRuns;
            updates[`${key}.batsmen.${striker.playerId}.balls`] = striker.balls + 1;
            if (batRuns === 4) updates[`${key}.batsmen.${striker.playerId}.fours`] = striker.fours + 1;
            if (batRuns === 6) updates[`${key}.batsmen.${striker.playerId}.sixes`] = striker.sixes + 1;
        }

        // Update Bowler
        if (isLegalBall) {
            const newBalls = bowler.ballsBowled + 1;
            const overs = Math.floor(newBalls / 6) + (newBalls % 6) / 10;
            updates[`${key}.bowlers.${bowler.playerId}.ballsBowled`] = newBalls;
            updates[`${key}.bowlers.${bowler.playerId}.overs`] = overs;
            
            // Over/Ball logic for Innings
            const totalLegalBalls = (Math.floor(currentInnings.overs) * 6) + Math.round((currentInnings.overs % 1) * 10) + 1;
            updates[`${key}.overs`] = Math.floor(totalLegalBalls / 6) + (totalLegalBalls % 6) / 10;
            
            // New Over Check
            if (newBalls % 6 === 0) {
                // Swap Strike
                updates[`${key}.strikerId`] = currentInnings.nonStrikerId;
                updates[`${key}.nonStrikerId`] = currentInnings.strikerId;
                // Unset Bowler to force selection next
                updates[`${key}.currentBowlerId`] = null; 
            }
        }
        
        // Bowler Runs Conceded (Wides, No Balls count to bowler)
        // Byes and Leg Byes do NOT count to bowler figures
        if (!isBye && !isLegBye) {
            updates[`${key}.bowlers.${bowler.playerId}.runsConceded`] = bowler.runsConceded + totalBallRuns;
        }

        // Wicket Logic
        if (isWicket) {
            updates[`${key}.wickets`] = currentInnings.wickets + 1;
            updates[`${key}.bowlers.${bowler.playerId}.wickets`] = bowler.wickets + 1;
            updates[`${key}.strikerId`] = null; // Needs new batsman
            // Trigger Modal for new batsman
            setPlayerSelectionType('STRIKER');
            setTimeout(() => setShowPlayerModal(true), 500); 
        } else {
            // Rotate Strike for odd runs
            // Note: If it's the last ball of over (legal), strike rotates due to over change above.
            // If we rotate here for odd runs, we need to ensure we don't double rotate or cancel out.
            // Standard rule: Odd runs = swap. End of over = swap. 
            // If last ball + 1 run: Swap (runs) -> Swap (Over) = Original striker faces next over? No.
            // Let's keep it simple: Swap on odd runs first.
            
            const isOddRun = runs % 2 !== 0;
            if (isOddRun) {
                // If legal ball ended over, we swap keys in 'updates' above.
                // It gets complex. Simplified:
                // If it's NOT end of over, swap. 
                // If it IS end of over, do NOT swap (because end of over auto-swaps ends, keeping same striker? No.)
                // Logic:
                // End of over: Batsmen stay put, bowler changes ends. Essentially strike changes.
                // 1 run on last ball: Batsmen cross. Non-striker is now at danger end. Bowler changes ends. Non-striker faces.
                
                // Effective logic: Always swap IDs on odd runs. 
                // Then if End of Over, simply swapping striker/nonStrikerId again works out correctly?
                // Let's rely on explicit setting.
                
                const currentS = updates[`${key}.strikerId`] || currentInnings.strikerId;
                const currentNS = updates[`${key}.nonStrikerId`] || currentInnings.nonStrikerId;
                
                updates[`${key}.strikerId`] = currentNS;
                updates[`${key}.nonStrikerId`] = currentS;
            }
        }

        await updateMatch(updates);
    };

    const handleSwapBatter = async () => {
        if (!currentInnings) return;
        await updateMatch({
            [`innings.${currentInningsNo}.strikerId`]: currentInnings.nonStrikerId,
            [`innings.${currentInningsNo}.nonStrikerId`]: currentInnings.strikerId
        });
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>;
    if (!match) return <div>Match not found</div>;

    // --- RENDER HELPERS ---
    
    // Status Check
    if (match.status === 'SCHEDULED') {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded-xl shadow-xl text-center max-w-md w-full">
                    <h1 className="text-2xl font-bold mb-6 text-gray-800">Match Setup</h1>
                    <div className="flex justify-between items-center mb-8 font-bold text-lg">
                        <span className="text-blue-600">{match.teamAName}</span>
                        <span className="text-gray-400">vs</span>
                        <span className="text-red-600">{match.teamBName}</span>
                    </div>
                    <button 
                        onClick={() => setShowTossModal(true)}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 rounded-lg shadow-lg transform transition hover:scale-105"
                    >
                        Start Toss
                    </button>
                    <button onClick={() => navigate('/scoring')} className="mt-4 text-gray-500 hover:text-gray-800 text-sm">Back to Dashboard</button>
                </div>

                {showTossModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-xl w-80">
                            <h3 className="font-bold text-lg mb-4">Who won the toss?</h3>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <button onClick={() => handleToss(match.teamAId, 'BAT')} className="p-3 border rounded hover:bg-blue-50 text-sm font-bold">{match.teamAName}</button>
                                <button onClick={() => handleToss(match.teamBId, 'BAT')} className="p-3 border rounded hover:bg-red-50 text-sm font-bold">{match.teamBName}</button>
                            </div>
                            <h3 className="font-bold text-lg mb-4">Opted to?</h3>
                            <div className="flex gap-2">
                                <button className="flex-1 bg-gray-200 p-2 rounded font-bold hover:bg-green-200" onClick={() => { /* Logic integrated above */ }}>Bat</button>
                                <button className="flex-1 bg-gray-200 p-2 rounded font-bold hover:bg-blue-200" onClick={() => { /* Logic integrated above */ }}>Bowl</button>
                            </div>
                            <div className="mt-4 text-xs text-gray-500">
                                * Simplified: Selecting Team above assumes they Bat first for MVP. 
                                (Expand logic for Bowl choice if needed)
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
            
            {/* Header / Scoreboard */}
            <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-4 shadow-xl border-b border-white/10">
                <div className="flex justify-between items-start">
                    <button onClick={() => navigate('/scoring')}><ArrowLeft className="w-6 h-6 text-gray-400"/></button>
                    <div className="text-center">
                        <h2 className="text-xs text-gray-400 uppercase tracking-widest">{battingTeam?.name} vs {bowlingTeam?.name}</h2>
                        <div className="flex items-baseline justify-center gap-2 mt-1">
                            <span className="text-4xl font-black text-yellow-400">{currentInnings?.totalRuns}/{currentInnings?.wickets}</span>
                            <span className="text-xl text-gray-300 font-mono">({currentInnings?.overs})</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            RR: {(currentInnings?.totalRuns && currentInnings?.overs) ? (currentInnings.totalRuns / Math.max(0.1, currentInnings.overs)).toFixed(2) : '0.00'}
                        </div>
                    </div>
                    <Settings className="w-6 h-6 text-gray-400" />
                </div>
            </div>

            {/* Players Area */}
            <div className="grid grid-cols-2 gap-1 p-2 bg-slate-800 border-b border-white/5">
                {/* Batsmen */}
                <div className="bg-white/5 rounded p-2 border border-white/10">
                    <div className="flex justify-between items-center text-xs text-gray-400 mb-2 uppercase font-bold">
                        <span>Batting</span>
                        <span>R (B)</span>
                    </div>
                    <div className={`flex justify-between items-center p-2 rounded ${currentInnings?.strikerId === striker?.playerId ? 'bg-green-900/30 border border-green-500/30' : ''}`}>
                        <div className="flex items-center gap-2">
                            {currentInnings?.strikerId === striker?.playerId && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>}
                            <span className="font-bold text-sm truncate w-24">{striker?.name || 'Select Striker'}</span>
                        </div>
                        <span className="font-mono text-yellow-300">{striker?.runs || 0} <span className="text-gray-500 text-xs">({striker?.balls || 0})</span></span>
                    </div>
                    <div className={`flex justify-between items-center p-2 rounded ${currentInnings?.strikerId === nonStriker?.playerId ? 'bg-green-900/30 border border-green-500/30' : ''}`}>
                        <div className="flex items-center gap-2">
                            {currentInnings?.strikerId === nonStriker?.playerId && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>}
                            <span className="font-bold text-sm truncate w-24">{nonStriker?.name || 'Select Non-Str'}</span>
                        </div>
                        <span className="font-mono text-white">{nonStriker?.runs || 0} <span className="text-gray-500 text-xs">({nonStriker?.balls || 0})</span></span>
                    </div>
                </div>

                {/* Bowler */}
                <div className="bg-white/5 rounded p-2 border border-white/10 relative">
                    <div className="flex justify-between items-center text-xs text-gray-400 mb-2 uppercase font-bold">
                        <span>Bowling</span>
                        <span>FIG</span>
                    </div>
                    <div className="p-2">
                        <span className="font-bold text-sm block mb-1">{bowler?.name || 'Select Bowler'}</span>
                        <div className="flex justify-between text-xs text-gray-300 font-mono">
                            <span>{bowler?.overs || 0}-{bowler?.maidens || 0}-{bowler?.runsConceded || 0}-{bowler?.wickets || 0}</span>
                        </div>
                    </div>
                    {!currentInnings?.currentBowlerId && (
                        <button 
                            onClick={() => { setPlayerSelectionType('BOWLER'); setShowPlayerModal(true); }}
                            className="absolute inset-0 bg-blue-600/90 text-white font-bold flex items-center justify-center rounded uppercase text-xs tracking-wider hover:bg-blue-500"
                        >
                            Select Bowler
                        </button>
                    )}
                </div>
            </div>

            {/* Main Controller */}
            <div className="flex-1 bg-gradient-to-b from-slate-900 to-black p-4 flex flex-col justify-end">
                
                {/* Action Buttons Row */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    <button onClick={handleSwapBatter} className="bg-purple-600 px-4 py-2 rounded text-xs font-bold uppercase shrink-0">Swap Ends</button>
                    <button className="bg-gray-700 px-4 py-2 rounded text-xs font-bold uppercase shrink-0 opacity-50 cursor-not-allowed">Retire</button>
                    <button 
                        onClick={() => { setPlayerSelectionType('BOWLER'); setShowPlayerModal(true); }}
                        className="bg-blue-600 px-4 py-2 rounded text-xs font-bold uppercase shrink-0"
                    >
                        Change Bowler
                    </button>
                </div>

                {/* Numeric Grid */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                    <button onClick={() => recordBall(0)} className="aspect-square rounded-full border-2 border-gray-600 hover:bg-gray-800 flex items-center justify-center text-xl font-bold">0</button>
                    <button onClick={() => recordBall(1)} className="aspect-square rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xl font-bold">1</button>
                    <button onClick={() => recordBall(2)} className="aspect-square rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xl font-bold">2</button>
                    <button onClick={() => recordBall(3)} className="aspect-square rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xl font-bold">3</button>
                    <button onClick={() => recordBall(4)} className="aspect-square rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-xl font-bold">4</button>
                    <button onClick={() => recordBall(6)} className="aspect-square rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-xl font-bold">6</button>
                    <button onClick={() => recordBall(5)} className="aspect-square rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xl font-bold">5</button>
                    <button className="aspect-square rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-500">...</button>
                </div>

                {/* Extras Grid */}
                <div className="grid grid-cols-4 gap-3">
                    <button onClick={() => recordBall(0, 'WIDE')} className="py-4 bg-yellow-600/80 rounded font-bold text-sm uppercase">Wide</button>
                    <button onClick={() => recordBall(0, 'NOBALL')} className="py-4 bg-orange-600/80 rounded font-bold text-sm uppercase">No Ball</button>
                    <button onClick={() => recordBall(0, undefined, true)} className="py-4 bg-red-600 hover:bg-red-500 rounded font-bold text-sm uppercase col-span-2">Wicket</button>
                </div>
            </div>

            {/* Player Selection Modal */}
            {showPlayerModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end md:justify-center p-4">
                    <div className="bg-white rounded-t-xl md:rounded-xl overflow-hidden max-h-[80vh] flex flex-col">
                        <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
                            <h3 className="font-bold text-black uppercase">
                                Select {playerSelectionType?.replace('_', ' ')}
                            </h3>
                            <button onClick={() => setShowPlayerModal(false)} className="text-gray-500"><Settings className="w-5 h-5"/></button>
                        </div>
                        <div className="overflow-y-auto p-2">
                            {((playerSelectionType === 'BOWLER' ? bowlingTeam : battingTeam)?.players || []).map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => handlePlayerSelect(String(p.id))}
                                    className="w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 flex items-center gap-3 text-black"
                                >
                                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-bold text-xs">{p.name.charAt(0)}</div>
                                    <div>
                                        <div className="font-bold">{p.name}</div>
                                        <div className="text-xs text-gray-500 uppercase">{p.role}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MatchScorer;
