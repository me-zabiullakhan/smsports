
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Match, InningsState, BatsmanStats, BowlerStats, ScoringAsset, OverlayView, OverlayAnimation, DecisionStatus, Team, Player } from '../types';
import { ArrowLeft, Trophy, Users, RotateCcw, Save, Loader2, Undo2, CheckSquare, Square, Palette, ChevronDown, RefreshCw, Trash2, Check, Plus, Monitor, Play, Zap, Info, UserPlus, AlignLeft, ShieldCheck, MoreHorizontal, Settings, HelpCircle } from 'lucide-react';
import { useAuction } from '../hooks/useAuction';

const MatchScorer: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const { userProfile } = useAuction();
    const [match, setMatch] = useState<Match | null>(null);
    const [teamA, setTeamA] = useState<Team | null>(null);
    const [teamB, setTeamB] = useState<Team | null>(null);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [tossWinner, setTossWinner] = useState('');
    const [tossChoice, setTossChoice] = useState<'BAT' | 'BOWL'>('BAT');
    const [processing, setProcessing] = useState(false);
    const [extraControllerVisible, setExtraControllerVisible] = useState(true);

    // Controller Inputs
    const [isWide, setIsWide] = useState(false);
    const [isNoBall, setIsNoBall] = useState(false);
    const [isBye, setIsBye] = useState(false);
    const [isLegBye, setIsLegBye] = useState(false);
    const [isWicket, setIsWicket] = useState(false);

    // Overlay Inputs
    const [customInput, setCustomInput] = useState('');
    const [selectedMOM, setSelectedMOM] = useState('');
    const [selectedStatsPlayer, setSelectedStatsPlayer] = useState('');
    const [teamAColor, setTeamAColor] = useState('#0000FF');
    const [teamBColor, setTeamBColor] = useState('#FF0000');

    // Override State
    const [manualRuns, setManualRuns] = useState<{ [key: string]: number }>({ I1: 0, I1W: 0, I2: 0, I2W: 0 });

    // Initial Data Fetch
    useEffect(() => {
        if (!matchId) return;
        const unsub = db.collection('matches').doc(matchId).onSnapshot(doc => {
            if (doc.exists) {
                const m = { id: doc.id, ...doc.data() } as Match;
                setMatch(m);
                if (m.overlay?.momId) setSelectedMOM(m.overlay.momId);
                if (m.overlay?.customMessage) setCustomInput(m.overlay.customMessage);
                if (m.overlay?.statsPlayerId) setSelectedStatsPlayer(m.overlay.statsPlayerId);
                if (m.overlay?.teamAColor) setTeamAColor(m.overlay.teamAColor);
                if (m.overlay?.teamBColor) setTeamBColor(m.overlay.teamBColor);
                
                // Sync manual override fields with DB values initially
                setManualRuns({
                    I1: m.innings[1]?.totalRuns || 0,
                    I1W: m.innings[1]?.wickets || 0,
                    I2: m.innings[2]?.totalRuns || 0,
                    I2W: m.innings[2]?.wickets || 0
                });
            } else {
                navigate('/scoring');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [matchId, navigate]);

    // Fetch Teams
    useEffect(() => {
        if (!match) return;
        const fetchTeams = async () => {
            const collectionName = match.sourceType === 'TOURNAMENT' ? 'tournaments' : 'auctions';
            const rootRef = db.collection(collectionName).doc(match.auctionId).collection('teams');
            const docA = await rootRef.doc(match.teamAId).get();
            const docB = await rootRef.doc(match.teamBId).get();
            if (docA.exists) setTeamA({ id: docA.id, ...docA.data() } as Team);
            if (docB.exists) setTeamB({ id: docB.id, ...docB.data() } as Team);
        };
        fetchTeams();
    }, [match?.auctionId, match?.teamAId, match?.teamBId, match?.sourceType]);

    const currentInnings = match ? match.innings[match.currentInnings] : null;
    
    const getTeam = (id: string | undefined | null) => {
        if (!id) return null;
        if (String(teamA?.id) === String(id)) return teamA;
        if (String(teamB?.id) === String(id)) return teamB;
        return null;
    };

    const battingTeam = currentInnings ? getTeam(currentInnings.battingTeamId) : null;
    const bowlingTeam = currentInnings ? getTeam(currentInnings.bowlingTeamId) : null;
    const allPlayers = [...(teamA?.players || []), ...(teamB?.players || [])];

    const needsStriker = currentInnings && !currentInnings.strikerId;
    const needsNonStriker = currentInnings && !currentInnings.nonStrikerId;
    const needsBowler = currentInnings && !currentInnings.currentBowlerId;

    const handleToss = async () => {
        if (!match || !tossWinner || !tossChoice) return;
        setProcessing(true);
        let battingId = tossWinner;
        let bowlingId = tossWinner === match.teamAId ? match.teamBId : match.teamAId;
        if (tossChoice === 'BOWL') { const temp = battingId; battingId = bowlingId; bowlingId = temp; }
        const newInnings: InningsState = {
            battingTeamId: battingId, bowlingTeamId: bowlingId, totalRuns: 0, wickets: 0, overs: 0, ballsInCurrentOver: 0, currentRunRate: 0, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }, strikerId: null, nonStrikerId: null, currentBowlerId: null, batsmen: {}, bowlers: {}, recentBalls: []
        };
        await db.collection('matches').doc(match.id).update({
            tossWinnerId: tossWinner, tossChoice: tossChoice, status: 'LIVE', [`innings.1`]: newInnings, overlay: { currentView: 'DEFAULT', animation: 'NONE', theme: 'DEFAULT', decision: 'NONE' }
        });
        setProcessing(false);
    };

    const handlePlayerSelect = async (type: 'STRIKER' | 'NON_STRIKER' | 'BOWLER', playerId: string) => {
        if (!match || !playerId) return;
        const targetTeam = type === 'BOWLER' ? bowlingTeam : battingTeam;
        if (!targetTeam) return;
        const playerObj = targetTeam.players.find(p => String(p.id) === String(playerId));
        if (!playerObj) return;
        const updateData: any = {};
        const prefix = `innings.${match.currentInnings}`;
        if (type === 'BOWLER') {
            if (!currentInnings?.bowlers || !currentInnings.bowlers[playerId]) {
                updateData[`${prefix}.bowlers.${playerId}`] = { playerId, name: playerObj.name, overs: 0, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 };
            }
            updateData[`${prefix}.currentBowlerId`] = playerId;
        } else {
            if (!currentInnings?.batsmen || !currentInnings.batsmen[playerId]) {
                updateData[`${prefix}.batsmen.${playerId}`] = { playerId, name: playerObj.name, runs: 0, balls: 0, fours: 0, sixes: 0, isStriker: type === 'STRIKER' };
            } else { updateData[`${prefix}.batsmen.${playerId}.isStriker`] = type === 'STRIKER'; }
            if (type === 'STRIKER') updateData[`${prefix}.strikerId`] = playerId;
            else updateData[`${prefix}.nonStrikerId`] = playerId;
        }
        await db.collection('matches').doc(match.id).update(updateData);
    };

    const handleSwapBatter = async () => {
        if (!match || !currentInnings || !currentInnings.strikerId || !currentInnings.nonStrikerId) return;
        const updateData: any = {};
        const prefix = `innings.${match.currentInnings}`;
        updateData[`${prefix}.strikerId`] = currentInnings.nonStrikerId;
        updateData[`${prefix}.nonStrikerId`] = currentInnings.strikerId;
        updateData[`${prefix}.batsmen.${currentInnings.strikerId}.isStriker`] = false;
        updateData[`${prefix}.batsmen.${currentInnings.nonStrikerId}.isStriker`] = true;
        await db.collection('matches').doc(match.id).update(updateData);
    };

    const handleEndInning = async () => {
        if (!match) return;
        if (!window.confirm("End this inning and start next?")) return;
        
        if (match.currentInnings === 1) {
            const bowlingId = currentInnings?.bowlingTeamId;
            const battingId = currentInnings?.battingTeamId;
            const newInnings: InningsState = {
                battingTeamId: bowlingId || '', bowlingTeamId: battingId || '', totalRuns: 0, wickets: 0, overs: 0, ballsInCurrentOver: 0, currentRunRate: 0, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }, strikerId: null, nonStrikerId: null, currentBowlerId: null, batsmen: {}, bowlers: {}, recentBalls: []
            };
            await db.collection('matches').doc(match.id).update({ currentInnings: 2, [`innings.2`]: newInnings });
        } else {
            await db.collection('matches').doc(match.id).update({ status: 'COMPLETED' });
        }
    };

    const handleScore = async (runs: number) => {
        if (!match || !currentInnings || needsStriker || needsNonStriker || needsBowler) return;
        setProcessing(true);
        const state = JSON.parse(JSON.stringify(currentInnings)) as InningsState;
        const striker = state.batsmen[state.strikerId!];
        const bowler = state.bowlers[state.currentBowlerId!];
        
        const isLegalBall = !isWide && !isNoBall;
        
        let totalBallRuns = runs; 
        if (isWide || isNoBall) totalBallRuns += 1; 
        state.totalRuns += totalBallRuns;
        
        if (isWide) state.extras.wides += (1 + runs); 
        if (isNoBall) state.extras.noBalls += (1 + runs); 
        if (isBye) state.extras.byes += runs; 
        if (isLegBye) state.extras.legByes += runs;
        
        if (!isWide) { 
            if (isLegalBall || isNoBall) { 
                if (!isBye && !isLegBye) { 
                    striker.runs += runs; 
                    if (runs === 4) striker.fours++; 
                    if (runs === 6) striker.sixes++; 
                } 
                striker.balls++; 
            } 
        }

        let bowlerRuns = runs; 
        if (isWide || isNoBall) bowlerRuns += 1; 
        if (isBye || isLegBye) bowlerRuns = 0; 
        bowler.runsConceded += bowlerRuns;

        if (isLegalBall) {
            state.ballsInCurrentOver++; bowler.ballsBowled++;
            const totalValidBalls = (Math.floor(state.overs) * 6) + Math.round((state.overs % 1) * 10) + 1;
            state.overs = Number(`${Math.floor(totalValidBalls / 6)}.${totalValidBalls % 6}`);
            const bValidBalls = (Math.floor(bowler.overs) * 6) + Math.round((bowler.overs % 1) * 10) + 1;
            bowler.overs = Number(`${Math.floor(bValidBalls / 6)}.${bValidBalls % 6}`);
        }

        if (isWicket) { 
            state.wickets++; 
            bowler.wickets++; 
            striker.outBy = `b ${bowler.name}`; 
            state.strikerId = null; 
        }

        state.recentBalls.push({ ballNumber: state.ballsInCurrentOver, overNumber: Math.floor(state.overs), bowlerId: bowler.playerId, batsmanId: striker.playerId, runs, isWide, isNoBall, isWicket, isBye, isLegBye, extras: (isWide || isNoBall ? 1 : 0) });
        
        if (runs % 2 !== 0) { 
            const temp = state.strikerId; 
            state.strikerId = state.nonStrikerId; 
            state.nonStrikerId = temp; 
        }

        if (state.ballsInCurrentOver === 6) { 
            state.ballsInCurrentOver = 0; 
            state.currentBowlerId = null; 
            const temp = state.strikerId; 
            state.strikerId = state.nonStrikerId; 
            state.nonStrikerId = temp; 
        }

        await db.collection('matches').doc(match.id).update({ [`innings.${match.currentInnings}`]: state });
        setIsWide(false); setIsNoBall(false); setIsBye(false); setIsLegBye(false); setIsWicket(false);
        setProcessing(false);
    };

    const handleUndo = async () => {
        if (!match || !currentInnings || currentInnings.recentBalls.length === 0) return;
        setProcessing(true);
        try {
            const state = JSON.parse(JSON.stringify(currentInnings)) as InningsState;
            const lastBall = state.recentBalls.pop();
            if (!lastBall) { setProcessing(false); return; }

            const extraRuns = (lastBall.isWide || lastBall.isNoBall) ? 1 : 0;
            state.totalRuns -= (lastBall.runs + extraRuns);
            if (lastBall.isWicket) state.wickets--;

            if (lastBall.isWide) state.extras.wides -= (1 + lastBall.runs);
            if (lastBall.isNoBall) state.extras.noBalls -= (1 + lastBall.runs);
            if (lastBall.isBye) state.extras.byes -= lastBall.runs;
            if (lastBall.isLegBye) state.extras.legByes -= lastBall.runs;

            const batsman = state.batsmen[lastBall.batsmanId];
            if (batsman && !lastBall.isWide) {
                if (!lastBall.isBye && !lastBall.isLegBye) {
                    batsman.runs -= lastBall.runs;
                    if (lastBall.runs === 4) batsman.fours--;
                    if (lastBall.runs === 6) batsman.sixes--;
                }
                batsman.balls--;
                if (lastBall.isWicket) {
                    delete batsman.outBy;
                    state.strikerId = lastBall.batsmanId;
                }
            }

            const bowler = state.bowlers[lastBall.bowlerId];
            if (bowler) {
                let bRuns = lastBall.runs;
                if (lastBall.isWide || lastBall.isNoBall) bRuns += 1;
                if (lastBall.isBye || lastBall.isLegBye) bRuns = 0;
                bowler.runsConceded -= bRuns;
                if (lastBall.isWicket) bowler.wickets--;
                
                if (!lastBall.isWide && !lastBall.isNoBall) {
                    bowler.ballsBowled--;
                    const bVal = bowler.ballsBowled;
                    bowler.overs = Number(`${Math.floor(bVal / 6)}.${bVal % 6}`);
                }
            }

            if (!lastBall.isWide && !lastBall.isNoBall) {
                state.ballsInCurrentOver--;
                const totalValidBalls = (Math.floor(state.overs) * 6) + Math.round((state.overs % 1) * 10) - 1;
                state.overs = Number(`${Math.floor(totalValidBalls / 6)}.${totalValidBalls % 6}`);
                if (state.ballsInCurrentOver < 0) state.ballsInCurrentOver = 5;
            }

            if (lastBall.runs % 2 !== 0) {
                const temp = state.strikerId;
                state.strikerId = state.nonStrikerId;
                state.nonStrikerId = temp;
            }

            await db.collection('matches').doc(match.id).update({ [`innings.${match.currentInnings}`]: state });
        } catch (e) { console.error("Undo failed", e); } finally { setProcessing(false); }
    };

    const updateOverlay = async (updates: Partial<Match['overlay']>) => {
        if (!match) return;
        await db.collection('matches').doc(match.id).update({ overlay: { ...match.overlay, ...updates } });
    };

    const handleSaveManual = async (field: 'I1' | 'I1W' | 'I2' | 'I2W') => {
        if (!match) return;
        const updates: any = {};
        if (field === 'I1') updates['innings.1.totalRuns'] = manualRuns.I1;
        if (field === 'I1W') updates['innings.1.wickets'] = manualRuns.I1W;
        if (field === 'I2') updates['innings.2.totalRuns'] = manualRuns.I2;
        if (field === 'I2W') updates['innings.2.wickets'] = manualRuns.I2W;
        await db.collection('matches').doc(match.id).update(updates);
    };

    if (loading || !match) return <div className="flex items-center justify-center h-screen bg-black"><Loader2 className="w-8 h-8 animate-spin text-purple-500"/></div>;

    const renderPlayerSelector = (type: 'STRIKER' | 'NON_STRIKER' | 'BOWLER', currentId: string | null | undefined) => {
        const isBatsman = type === 'STRIKER' || type === 'NON_STRIKER';
        const team = isBatsman ? battingTeam : bowlingTeam;
        if (!team) return <div className="text-[10px] text-gray-500 font-bold">Waiting for team...</div>;
        if (currentId) {
            const playerStats = isBatsman ? currentInnings?.batsmen[currentId] : currentInnings?.bowlers[currentId];
            const name = playerStats?.name || team.players.find(p => String(p.id) === String(currentId))?.name || 'Unknown';
            const statsDisplay = isBatsman ? `${(playerStats as BatsmanStats)?.runs || 0}(${(playerStats as BatsmanStats)?.balls || 0})` : `${(playerStats as BowlerStats)?.wickets || 0}-${(playerStats as BowlerStats)?.runsConceded || 0} (${(playerStats as BowlerStats)?.overs || 0})`;
            return (
                <div className={`flex justify-between items-center font-bold text-sm ${type === 'STRIKER' ? 'text-lime-400' : 'text-white'}`}>
                    <span className="truncate max-w-[120px]">{name}</span>
                    <span className="tabular-nums bg-black/40 px-2 rounded">{statsDisplay}</span>
                </div>
            );
        }
        return (
            <select 
                className="w-full text-[10px] font-black p-1.5 rounded bg-white text-black outline-none uppercase border-2 border-purple-500" 
                onChange={(e) => handlePlayerSelect(type, e.target.value)} 
                value=""
            >
                <option value="">SELECT {type}</option>
                {team.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
        );
    };

    return (
        <div className="min-h-screen bg-slate-900 font-sans text-white pb-10">
            {/* Header */}
            <div className="bg-slate-800 p-4 shadow-lg sticky top-0 z-40 border-b border-white/10">
                <div className="flex justify-between items-center mb-3">
                    <button onClick={() => navigate('/scoring')} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600"><ArrowLeft className="w-5 h-5"/></button>
                    <div className="text-center flex-1">
                        <h2 className="text-lg font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                           {match.teamAName} <span className="text-white text-xs opacity-50 mx-1">VS</span> {match.teamBName}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => window.open(`/#/match-overlay/${matchId}`, '_blank')} className="bg-blue-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-2">
                            <Monitor className="w-3 h-3"/> OVERLAY
                        </button>
                    </div>
                </div>

                {/* Score Summary Bar */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-white/10 flex flex-col justify-center">
                        <div className="mb-2">{renderPlayerSelector('STRIKER', currentInnings?.strikerId)}</div>
                        <div>{renderPlayerSelector('NON_STRIKER', currentInnings?.nonStrikerId)}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl text-center flex flex-col justify-center shadow-lg border-b-4 border-black/30">
                        <span className="text-4xl font-black leading-none">{currentInnings?.totalRuns}-{currentInnings?.wickets}</span>
                        <span className="text-[10px] font-bold uppercase opacity-80 mt-1">{currentInnings?.overs} / {match.totalOvers} OVR</span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-white/10 flex flex-col justify-between">
                        <div>{renderPlayerSelector('BOWLER', currentInnings?.currentBowlerId)}</div>
                        <div className="flex gap-1.5 justify-center mt-2">
                            {currentInnings?.recentBalls.slice(-6).map((b, i) => (
                                <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${b.isWicket ? 'bg-red-500 text-white' : b.runs >= 4 ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{b.isWicket ? 'W' : b.runs}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-xl mx-auto p-4 space-y-4">
                
                {/* Main Controller Section */}
                <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden border border-white/10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full"></div>
                    <h3 className="text-center font-black text-xs uppercase tracking-[0.4em] text-purple-300 mb-6">Controller</h3>
                    
                    {/* Top Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleSwapBatter} className="bg-blue-600/80 hover:bg-blue-600 py-2.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2"><RefreshCw className="w-3 h-3"/> Swap</button>
                            <button className="bg-red-600/80 hover:bg-red-600 py-2.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2"><Trash2 className="w-3 h-3"/> Retire</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handlePlayerSelect('BOWLER', '')} className="bg-indigo-600/80 hover:bg-indigo-600 py-2.5 rounded-lg text-[10px] font-black uppercase">Bowler</button>
                            <button onClick={() => updateOverlay({ currentView: 'DEFAULT' })} className="bg-lime-500 hover:bg-lime-600 py-2.5 rounded-lg text-[10px] font-black text-black uppercase">Default</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-6">
                        {['Mini-Score', 'Tour Name', 'B1', 'B2'].map(btn => (
                            <button key={btn} onClick={() => updateOverlay({ currentView: btn === 'B1' ? 'B1' : btn === 'B2' ? 'B2' : 'DEFAULT' })} className="bg-slate-800/80 py-2 rounded text-[10px] font-bold uppercase border border-white/5">{btn}</button>
                        ))}
                        {['Bowler', 'Batting', 'Bowling', 'PP+'].map(btn => (
                            <button key={btn} onClick={() => updateOverlay({ currentView: btn === 'Bowler' ? 'BOWLER' : 'DEFAULT' })} className="bg-slate-800/80 py-2 rounded text-[10px] font-bold uppercase border border-white/5">{btn}</button>
                        ))}
                    </div>

                    <div className="flex justify-center gap-4 mb-6">
                        <button onClick={handleEndInning} className="bg-pink-600 hover:bg-pink-700 px-6 py-2.5 rounded-full text-xs font-black uppercase shadow-lg border-b-4 border-pink-900/50">End Inning {match.currentInnings}</button>
                        <button onClick={handleUndo} className="bg-red-600 hover:bg-red-700 px-6 py-2.5 rounded-full text-xs font-black uppercase shadow-lg border-b-4 border-red-900/50 flex items-center gap-2"><Undo2 className="w-4 h-4"/> Undo</button>
                    </div>

                    {/* Extras Checkboxes */}
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-8 bg-black/30 p-4 rounded-2xl border border-white/5">
                        {[ 
                            { label: 'Wide', state: isWide, set: setIsWide },
                            { label: 'No Ball', state: isNoBall, set: setIsNoBall },
                            { label: 'Byes', state: isBye, set: setIsBye },
                            { label: 'Leg Byes', state: isLegBye, set: setIsLegBye },
                            { label: 'Wicket', state: isWicket, set: setIsWicket, color: 'text-red-400' }
                        ].map(item => (
                            <button key={item.label} onClick={() => item.set(!item.state)} className={`flex items-center gap-1.5 transition-all ${item.state ? (item.color || 'text-lime-400') : 'text-gray-400 opacity-50'}`}>
                                {item.state ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                                <span className="text-[10px] font-black uppercase">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Score Buttons */}
                    <div className="grid grid-cols-4 gap-4">
                        {[0, 1, 2, 3, 4, 5, 6].map(r => (
                            <button key={r} onClick={() => handleScore(r)} className="w-16 h-16 rounded-full bg-slate-100 hover:bg-white text-slate-900 flex items-center justify-center text-2xl font-black shadow-xl border-b-4 border-slate-300 active:translate-y-1 transition-all mx-auto">{r}</button>
                        ))}
                        <button className="w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center border-2 border-white/10"><MoreHorizontal/></button>
                    </div>
                </div>

                {/* Animations Block */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5">
                    <h4 className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Animations</h4>
                    <div className="flex flex-wrap justify-center gap-2">
                        {['FREE HIT', 'HAT-TRICK BALL', 'FOUR', 'SIX', 'WICKET', 'TOUR BOUNDARIES'].map(anim => (
                             <button key={anim} onClick={() => updateOverlay({ currentView: 'ANIMATION', animation: anim.split(' ')[0] as any })} className="bg-purple-600/80 hover:bg-purple-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-tight">{anim}</button>
                        ))}
                        <button onClick={() => updateOverlay({ currentView: 'DEFAULT', animation: 'NONE' })} className="bg-red-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase">STOP</button>
                    </div>
                </div>

                {/* Display Controller Block */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5">
                    <h4 className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Display Controller</h4>
                    <div className="grid grid-cols-5 gap-2 mb-2">
                         {['DEFAULT', 'I1BAT', 'I1BALL', 'I2BAT', 'I2BALL'].map(view => (
                             <button key={view} onClick={() => updateOverlay({ currentView: view as any })} className="bg-lime-500/80 hover:bg-lime-500 text-black py-2 rounded text-[8px] font-black uppercase">{view}</button>
                         ))}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                         {['SUMMARY', 'FOW', 'B1', 'B2'].map(view => (
                             <button key={view} onClick={() => updateOverlay({ currentView: view as any })} className="bg-purple-600/80 hover:bg-purple-600 py-2 rounded text-[8px] font-black uppercase">{view}</button>
                         ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                         {['BOWLER', 'TARGET', 'PARTNERSHIP'].map(view => (
                             <button key={view} onClick={() => updateOverlay({ currentView: view as any })} className="bg-pink-600/80 hover:bg-pink-600 py-2 rounded text-[8px] font-black uppercase">{view}</button>
                         ))}
                    </div>
                    <div className="mt-2">
                        <button onClick={() => updateOverlay({ currentView: 'TEAMS_PLAYERS' })} className="w-full bg-pink-600 py-2 rounded text-[8px] font-black uppercase">Teams Players</button>
                    </div>
                </div>

                {/* Decision Block */}
                <div className="bg-black/50 p-5 rounded-2xl border-l-4 border-lime-500 flex items-center justify-between gap-4">
                    <span className="text-lime-500 font-black text-sm uppercase italic">Decision :</span>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                        <button onClick={() => updateOverlay({ currentView: 'DECISION', decision: 'PENDING' })} className="bg-yellow-500 text-black font-black text-[10px] py-2 rounded-full uppercase">Pending</button>
                        <button onClick={() => updateOverlay({ currentView: 'DECISION', decision: 'OUT' })} className="bg-red-600 py-2 rounded-full font-black text-[10px] uppercase">Out</button>
                        <button onClick={() => updateOverlay({ currentView: 'DECISION', decision: 'NOT_OUT' })} className="bg-lime-600 py-2 rounded-full font-black text-[10px] uppercase">Not Out</button>
                    </div>
                </div>

                {/* Input Blocks */}
                <div className="space-y-2">
                    {/* Custom Input */}
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                        <span className="text-[10px] font-black text-cyan-400 uppercase whitespace-nowrap">Custom Input :</span>
                        <input className="flex-1 bg-white text-black text-xs px-3 py-2 rounded font-bold outline-none" value={customInput} onChange={e => setCustomInput(e.target.value)} placeholder="Split text with -" />
                        <button onClick={() => updateOverlay({ customMessage: customInput, currentView: 'CUSTOM' })} className="bg-lime-500 text-black font-black text-[10px] px-3 py-2 rounded uppercase whitespace-nowrap">Display</button>
                    </div>

                    {/* MOM Input */}
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                        <span className="text-[10px] font-black text-lime-400 uppercase whitespace-nowrap">Select MOM:</span>
                        <select className="flex-1 bg-white text-black text-xs px-3 py-2 rounded font-bold outline-none" value={selectedMOM} onChange={e => setSelectedMOM(e.target.value)}>
                            <option value="">Select MOM Player</option>
                            {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={() => updateOverlay({ momId: selectedMOM, currentView: 'MOM' })} className="bg-lime-500 text-black font-black text-[10px] px-3 py-2 rounded uppercase whitespace-nowrap">Display</button>
                    </div>

                    {/* Tour Stats Player Input */}
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                        <span className="text-[10px] font-black text-purple-400 uppercase whitespace-nowrap">Tour Stats Player:</span>
                        <select className="flex-1 bg-white text-black text-xs px-3 py-2 rounded font-bold outline-none" value={selectedStatsPlayer} onChange={e => setSelectedStatsPlayer(e.target.value)}>
                            <option value="">Select Player</option>
                            {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={() => updateOverlay({ statsPlayerId: selectedStatsPlayer, currentView: 'PLAYER_STATS' })} className="bg-lime-500 text-black font-black text-[10px] px-3 py-2 rounded uppercase whitespace-nowrap">Display</button>
                    </div>
                </div>

                {/* Tour Stats Buttons */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5">
                    <h4 className="text-center text-[10px] font-black uppercase tracking-widest text-red-500 mb-4">Tour Stats Controller</h4>
                    <div className="flex flex-wrap justify-center gap-2">
                        {['POINTS TABLE', 'TOP BATTERS', 'TOP BOWLERS', 'TOP 4/6 STRIKERS', 'TOP PLAYER OF SERIES'].map(stat => (
                             <button key={stat} onClick={() => updateOverlay({ currentView: stat.replace(/ /g, '_') as any })} className="bg-pink-600/80 hover:bg-pink-600 px-4 py-2 rounded-lg text-[8px] font-black uppercase">{stat}</button>
                        ))}
                    </div>
                </div>

                {/* Team Color Picker */}
                <div className="bg-slate-800/80 p-6 rounded-2xl border border-white/5">
                    <h4 className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Select Team Color</h4>
                    <div className="flex items-center justify-center gap-6">
                        <div className="flex flex-col items-center gap-2">
                            <input type="color" className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 bg-transparent" value={teamAColor} onChange={e => setTeamAColor(e.target.value)} />
                            <span className="text-[10px] font-bold text-gray-400">{match.teamAName}</span>
                        </div>
                        <button onClick={() => updateOverlay({ teamAColor, teamBColor })} className="bg-black/50 text-white font-black text-[10px] px-8 py-2 rounded uppercase border border-white/10 hover:bg-black transition-colors">Save Colors</button>
                        <div className="flex flex-col items-center gap-2">
                            <input type="color" className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 bg-transparent" value={teamBColor} onChange={e => setTeamBColor(e.target.value)} />
                            <span className="text-[10px] font-bold text-gray-400">{match.teamBName}</span>
                        </div>
                    </div>
                </div>

                {/* Extra Controller Section */}
                <div className="bg-red-600 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="flex justify-center mb-6">
                        <button onClick={() => setExtraControllerVisible(!extraControllerVisible)} className="bg-black px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white">{extraControllerVisible ? 'Hide Extra Controller' : 'Show Extra Controller'}</button>
                    </div>
                    
                    {extraControllerVisible && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                            {[
                                { label: 'Change Inning 1 Runs (+1 run will added to Target)', field: 'I1' as const, key: 'I1' },
                                { label: 'Change Inning 1 Wickets', field: 'I1W' as const, key: 'I1W' },
                                { label: 'Change Inning 2 Runs', field: 'I2' as const, key: 'I2' },
                                { label: 'Change Inning 2 Wickets', field: 'I2W' as const, key: 'I2W' }
                            ].map(item => (
                                <div key={item.key} className="flex flex-col items-center text-center space-y-3">
                                    <p className="text-[10px] font-black text-white leading-tight h-10 flex items-center justify-center">{item.label}</p>
                                    <input type="number" className="w-20 h-12 rounded-xl bg-white text-slate-900 text-xl font-black text-center" value={manualRuns[item.key]} onChange={e => setManualRuns({...manualRuns, [item.key]: Number(e.target.value)})} />
                                    <button onClick={() => handleSaveManual(item.field)} className="bg-black text-white font-black text-[10px] px-6 py-1.5 rounded-full uppercase">Save</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MatchScorer;
