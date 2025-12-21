
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Match, InningsState, BatsmanStats, BowlerStats, ScoringAsset, OverlayView, OverlayAnimation, DecisionStatus, Team } from '../types';
import { ArrowLeft, Trophy, Users, RotateCcw, Save, Loader2, Undo2, Circle, Settings, UserPlus, Info, CheckSquare, Square, Palette, ChevronDown, RefreshCw, Trash2, Image as ImageIcon, Check, Plus, Gavel, Monitor, Play } from 'lucide-react';
import { useAuction } from '../hooks/useAuction';

const MatchScorer: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const { userProfile } = useAuction();
    const [match, setMatch] = useState<Match | null>(null);
    const [teamA, setTeamA] = useState<Team | null>(null);
    const [teamB, setTeamB] = useState<Team | null>(null);
    const [assets, setAssets] = useState<ScoringAsset[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [tossWinner, setTossWinner] = useState('');
    const [tossChoice, setTossChoice] = useState<'BAT' | 'BOWL'>('BAT');
    const [processing, setProcessing] = useState(false);

    // Controller Inputs
    const [isWide, setIsWide] = useState(false);
    const [isNoBall, setIsNoBall] = useState(false);
    const [isBye, setIsBye] = useState(false);
    const [isLegBye, setIsLegBye] = useState(false);
    const [isWicket, setIsWicket] = useState(false);

    // Overlay Inputs
    const [customInput, setCustomInput] = useState('');
    const [selectedMOM, setSelectedMOM] = useState('');

    // Initial Data Fetch
    useEffect(() => {
        if (!matchId) return;
        const unsub = db.collection('matches').doc(matchId).onSnapshot(doc => {
            if (doc.exists) {
                const m = { id: doc.id, ...doc.data() } as Match;
                setMatch(m);
                if (m.overlay?.momId) setSelectedMOM(m.overlay.momId);
                if (m.overlay?.customMessage) setCustomInput(m.overlay.customMessage);
            } else {
                navigate('/scoring');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [matchId, navigate]);

    // Fetch Assets for Library
    useEffect(() => {
        if (!userProfile?.uid) return;
        const unsub = db.collection('scoringAssets')
            .where('createdBy', '==', userProfile.uid)
            .onSnapshot(snap => {
                setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScoringAsset)));
            });
        return () => unsub();
    }, [userProfile]);

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

    const handleDeleteMatch = async () => {
        if(!match) return;
        if(window.confirm("Are you sure?")) {
            setProcessing(true);
            try { await db.collection('matches').doc(match.id).delete(); } catch (e) { setProcessing(false); }
        }
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

    const handleScore = async (runs: number) => {
        if (!match || !currentInnings || needsStriker || needsNonStriker || needsBowler) return;
        setProcessing(true);
        const state = JSON.parse(JSON.stringify(currentInnings)) as InningsState;
        const striker = state.batsmen[state.strikerId!];
        const bowler = state.bowlers[state.currentBowlerId!];
        
        let extraType: 'WIDE' | 'NOBALL' | 'BYE' | 'LEGBYE' | undefined = undefined;
        if (isWide) extraType = 'WIDE'; else if (isNoBall) extraType = 'NOBALL'; else if (isBye) extraType = 'BYE'; else if (isLegBye) extraType = 'LEGBYE';
        
        const isLegalBall = !isWide && !isNoBall;
        
        let bowlerRuns = runs; 
        if (isWide || isNoBall) bowlerRuns += 1; 
        if (isBye || isLegBye) bowlerRuns = 0; 
        bowler.runsConceded += bowlerRuns;
        
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

        state.recentBalls.push({ ballNumber: state.ballsInCurrentOver, overNumber: Math.floor(state.overs), bowlerId: bowler.playerId, batsmanId: striker.playerId, runs, isWide, isNoBall, isWicket, isBye, isLegBye, extras: (extraType ? 1 : 0) });
        
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
        } catch (e) {
            console.error("Undo failed", e);
        } finally {
            setProcessing(false);
        }
    };

    const updateOverlay = async (updates: Partial<Match['overlay']>) => {
        if (!match) return;
        await db.collection('matches').doc(match.id).update({ overlay: { ...match.overlay, ...updates } });
    };

    const toggleTheme = async () => {
        if (!match) return;
        const currentTheme = match.overlay?.theme || 'DEFAULT';
        const nextTheme = currentTheme === 'DEFAULT' ? 'CWC2023' : 'DEFAULT';
        await updateOverlay({ theme: nextTheme });
    };

    const setOverlayBackground = async (url: string) => {
        const currentBg = match?.overlay?.backgroundGraphicUrl;
        const newUrl = currentBg === url ? null : url;
        await updateOverlay({ backgroundGraphicUrl: newUrl });
    };

    const handleAnimation = async (type: OverlayAnimation) => {
        if (!match) return;
        await updateOverlay({ currentView: 'ANIMATION', animation: type });
        // Auto stop after 5s for most animations
        if (type !== 'NONE' && type !== 'HAT_TRICK' && type !== 'TOUR_BOUNDARIES') {
            setTimeout(() => {
                 updateOverlay({ currentView: 'DEFAULT', animation: 'NONE' });
            }, 6000);
        }
    };

    const handleDecision = async (status: DecisionStatus) => {
        if (!match) return;
        await updateOverlay({ currentView: 'DECISION', decision: status });
        if (status === 'OUT' || status === 'NOT_OUT') {
            setTimeout(() => {
                updateOverlay({ currentView: 'DEFAULT', decision: 'NONE' });
            }, 5000);
        }
    };

    if (loading || !match) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin"/></div>;

    const renderPlayerSelector = (type: 'STRIKER' | 'NON_STRIKER' | 'BOWLER', currentId: string | null | undefined) => {
        const isBatsman = type === 'STRIKER' || type === 'NON_STRIKER';
        const team = isBatsman ? battingTeam : bowlingTeam;
        if (!team) return <div className="text-xs text-gray-400 font-bold animate-pulse">Loading Team...</div>;
        if (currentId) {
            const playerStats = isBatsman ? currentInnings?.batsmen[currentId] : currentInnings?.bowlers[currentId];
            const name = playerStats?.name || team.players.find(p => String(p.id) === String(currentId))?.name || 'Unknown';
            const statsDisplay = isBatsman ? `${(playerStats as BatsmanStats)?.runs || 0}(${(playerStats as BatsmanStats)?.balls || 0})` : `${(playerStats as BowlerStats)?.wickets || 0}-${(playerStats as BowlerStats)?.runsConceded || 0} (${(playerStats as BowlerStats)?.overs || 0})`;
            return (
                <div className={`flex justify-between font-bold text-sm ${type === 'STRIKER' ? 'text-green-400' : type === 'BOWLER' ? 'text-black' : 'text-white'}`}>
                    <span className="truncate max-w-[100px]">{name}</span>
                    <span className="tabular-nums">{statsDisplay}</span>
                </div>
            );
        }
        return (
            <select 
                className={`w-full text-[10px] font-bold p-1 rounded border outline-none uppercase mb-1 ${type === 'BOWLER' ? 'bg-white border-cyan-500 text-black' : 'bg-gray-800 border-gray-600 text-white animate-pulse'}`} 
                onChange={(e) => handlePlayerSelect(type, e.target.value)} 
                value=""
            >
                <option value="">SELECT {type}</option>
                {team.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20">
            <div className="bg-white p-4 shadow-sm border-b sticky top-0 z-10">
                <div className="flex justify-between items-center mb-2">
                    <button onClick={() => navigate('/scoring')} className="text-gray-500"><ArrowLeft className="w-5 h-5"/></button>
                    <h2 className="font-black text-gray-700 uppercase tracking-tighter">Match Scoreboard</h2>
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.open(`/#/match-overlay/${matchId}`, '_blank')} className="text-blue-600 font-bold text-xs underline flex items-center gap-1">
                            <Monitor className="w-3 h-3"/> LINKS
                        </button>
                        <button onClick={handleDeleteMatch} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4"/></button>
                    </div>
                </div>

                <div className="text-center mb-3">
                    <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">
                        {match.teamAName} <span className="text-gray-400 font-normal lowercase mx-2">vs</span> {match.teamBName}
                    </h3>
                    <div className="bg-purple-600 text-white py-1 rounded text-xs font-bold uppercase tracking-widest mt-1">
                        Run Rate: {(currentInnings?.totalRuns / Math.max(0.1, currentInnings?.overs || 0)).toFixed(2)}
                    </div>
                </div>

                {(match.status === 'SCHEDULED' || match.status === 'TOSS') && (
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center border-4 border-yellow-400 mb-4 animate-fade-in">
                        <Trophy className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
                        <h2 className="text-xl font-black mb-4 uppercase">Match Toss</h2>
                        <div className="mb-4 text-left">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Toss Winner</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setTossWinner(match.teamAId)} className={`p-2 rounded border-2 font-bold text-sm ${tossWinner === match.teamAId ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>{match.teamAName}</button>
                                <button onClick={() => setTossWinner(match.teamBId)} className={`p-2 rounded border-2 font-bold text-sm ${tossWinner === match.teamBId ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>{match.teamBName}</button>
                            </div>
                        </div>
                        <div className="mb-6 text-left">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Choice</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setTossChoice('BAT')} className={`p-2 rounded border-2 font-bold text-sm ${tossChoice === 'BAT' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>BAT</button>
                                <button onClick={() => setTossChoice('BOWL')} className={`p-2 rounded border-2 font-bold text-sm ${tossChoice === 'BOWL' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>BOWL</button>
                            </div>
                        </div>
                        <button onClick={handleToss} disabled={!tossWinner || processing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center justify-center">
                            {processing ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : 'START MATCH'}
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 mt-4 text-white">
                    <div className="bg-gray-900 rounded p-2 flex flex-col justify-center min-h-[64px]">
                        <div className="mb-1">{renderPlayerSelector('STRIKER', currentInnings?.strikerId)}</div>
                        <div>{renderPlayerSelector('NON_STRIKER', currentInnings?.nonStrikerId)}</div>
                    </div>
                    <div className="bg-blue-500 rounded p-2 text-center flex flex-col justify-center border-l-4 border-white/20">
                        <span className="text-3xl font-black">{currentInnings?.totalRuns}-{currentInnings?.wickets}</span>
                        <span className="text-xs font-bold uppercase">{currentInnings?.overs} OVR</span>
                    </div>
                    <div className="bg-cyan-500 rounded p-2 flex flex-col justify-between border-l-4 border-white/20">
                        <div>{renderPlayerSelector('BOWLER', currentInnings?.currentBowlerId)}</div>
                        <div className="flex gap-1 justify-center mt-2">{currentInnings?.recentBalls.slice(-6).map((b,i) => (<div key={i} className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${b.isWicket ? 'bg-red-600 text-white' : 'bg-white text-black'}`}>{b.isWicket ? 'W' : b.runs}</div>))}</div>
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <div className="flex-1 relative">
                        <input 
                            className="w-full bg-gray-100 border rounded py-2 px-3 text-sm font-bold uppercase" 
                            placeholder={`ADD PLAYER TO ${battingTeam?.name || 'BATTING TEAM'}`} 
                        />
                    </div>
                    <button className="bg-green-500 text-white p-2 rounded flex items-center justify-center"><UserPlus className="w-5 h-5"/></button>
                    <button className="bg-gray-900 text-white px-3 py-2 rounded text-xs font-bold whitespace-nowrap">{battingTeam?.name} Players ({battingTeam?.players.length})</button>
                </div>
            </div>

            <div className="max-w-xl mx-auto p-4 space-y-6">
                
                {/* Animations Section */}
                <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest text-center mb-4">Animations</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                        <button onClick={() => handleAnimation('FREE_HIT')} className="bg-green-500 text-white text-[10px] font-bold px-4 py-2 rounded uppercase shadow-sm">Free Hit</button>
                        <button onClick={() => handleAnimation('HAT_TRICK')} className="bg-purple-500 text-white text-[10px] font-bold px-4 py-2 rounded uppercase shadow-sm">Hat-trick Ball</button>
                        <button onClick={() => handleAnimation('FOUR')} className="bg-pink-500 text-white text-[10px] font-bold px-4 py-2 rounded uppercase shadow-sm">Four</button>
                        <button onClick={() => handleAnimation('SIX')} className="bg-blue-500 text-white text-[10px] font-bold px-4 py-2 rounded uppercase shadow-sm">Six</button>
                        <button onClick={() => handleAnimation('WICKET')} className="bg-red-500 text-white text-[10px] font-bold px-4 py-2 rounded uppercase shadow-sm">Wicket</button>
                        <button onClick={() => handleAnimation('TOUR_BOUNDARIES')} className="bg-purple-400 text-white text-[10px] font-bold px-4 py-2 rounded uppercase shadow-sm">Tour Boundaries</button>
                        <button onClick={() => handleAnimation('NONE')} className="bg-red-800 text-white text-[10px] font-bold px-4 py-2 rounded uppercase shadow-sm">Stop</button>
                    </div>
                </div>

                {/* Display Controller */}
                <div className="bg-black rounded-3xl shadow-xl p-6 text-white border-b-8 border-purple-600">
                    <h3 className="text-center font-black text-sm uppercase tracking-[0.3em] mb-6">Display Controller</h3>
                    <div className="grid grid-cols-5 gap-2 mb-4">
                        <button onClick={() => updateOverlay({ currentView: 'DEFAULT' })} className={`text-[10px] font-bold py-2 rounded transition-all border-b-4 border-black/40 ${match.overlay?.currentView === 'DEFAULT' ? 'bg-green-500' : 'bg-gray-600'}`}>DEFAULT</button>
                        <button onClick={() => updateOverlay({ currentView: 'B1' })} className={`text-[10px] font-bold py-2 rounded border-b-4 border-black/40 ${match.overlay?.currentView === 'B1' ? 'bg-blue-600' : 'bg-blue-800'}`}>I1BAT</button>
                        <button onClick={() => updateOverlay({ currentView: 'B2' })} className={`text-[10px] font-bold py-2 rounded border-b-4 border-black/40 ${match.overlay?.currentView === 'B2' ? 'bg-blue-600' : 'bg-blue-800'}`}>I1BALL</button>
                        <button className="bg-blue-800 text-[10px] font-bold py-2 rounded border-b-4 border-black/40 opacity-50">I2BAT</button>
                        <button className="bg-blue-800 text-[10px] font-bold py-2 rounded border-b-4 border-black/40 opacity-50">I2BALL</button>
                    </div>
                    <div className="grid grid-cols-5 gap-2 mb-4">
                        <button onClick={() => updateOverlay({ currentView: 'SUMMARY' })} className="bg-pink-500 text-[10px] font-bold py-2 rounded border-b-4 border-black/40">SUMMARY</button>
                        <button className="bg-pink-500 text-[10px] font-bold py-2 rounded border-b-4 border-black/40 opacity-50">FOW</button>
                        <button onClick={() => updateOverlay({ currentView: 'B1' })} className="bg-red-600 text-[10px] font-bold py-2 rounded border-b-4 border-black/40">B1</button>
                        <button onClick={() => updateOverlay({ currentView: 'B2' })} className="bg-red-600 text-[10px] font-bold py-2 rounded border-b-4 border-black/40">B2</button>
                        <button onClick={() => updateOverlay({ currentView: 'BOWLER' })} className="bg-red-600 text-[10px] font-bold py-2 rounded border-b-4 border-black/40">BOWLER</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => updateOverlay({ currentView: 'TARGET' })} className="bg-cyan-600 text-[10px] font-bold py-2 rounded border-b-4 border-black/40">TARGET</button>
                        <button className="bg-yellow-500 text-[10px] font-bold py-2 rounded border-b-4 border-black/40 opacity-50">PARTNERSHIP</button>
                        <button className="bg-red-600 text-[10px] font-bold py-2 rounded border-b-4 border-black/40 opacity-50">TEAMS PLAYERS</button>
                    </div>
                </div>

                {/* Decision Panel */}
                <div className="bg-black rounded-xl p-6 text-white shadow-xl border-l-8 border-purple-600">
                    <div className="flex items-center gap-6">
                        <h3 className="font-black text-cyan-400 uppercase text-lg tracking-wider whitespace-nowrap">Decision :</h3>
                        <div className="flex-1 grid grid-cols-3 gap-3">
                            <button onClick={() => handleDecision('PENDING')} className="bg-yellow-500 text-black font-black text-xs py-2 px-4 rounded-full uppercase shadow-lg border-b-4 border-black/20">Pending</button>
                            <button onClick={() => handleDecision('OUT')} className="bg-red-600 text-white font-black text-xs py-2 px-4 rounded-full uppercase shadow-lg border-b-4 border-black/20">Out</button>
                            <button onClick={() => handleDecision('NOT_OUT')} className="bg-green-600 text-white font-black text-xs py-2 px-4 rounded-full uppercase shadow-lg border-b-4 border-black/20">Not Out</button>
                        </div>
                    </div>
                </div>

                {/* Custom Input */}
                <div className="bg-black rounded-xl p-6 text-white shadow-xl">
                    <div className="flex items-center gap-6">
                        <h3 className="font-black text-cyan-400 uppercase text-[10px] tracking-widest whitespace-nowrap">Custom Input :</h3>
                        <div className="flex-1 flex gap-2">
                            <input 
                                className="flex-1 bg-white text-black text-xs px-3 py-2 rounded font-bold outline-none" 
                                placeholder="Use - for split text" 
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                            />
                            <button 
                                onClick={() => updateOverlay({ customMessage: customInput })}
                                className="bg-green-600 text-white font-bold text-[10px] px-3 py-2 rounded whitespace-nowrap uppercase"
                            >Display Input</button>
                        </div>
                    </div>
                </div>

                {/* MOM Player */}
                <div className="bg-black rounded-xl p-6 text-white shadow-xl">
                    <div className="flex items-center gap-6">
                        <h3 className="font-black text-cyan-400 uppercase text-[10px] tracking-widest whitespace-nowrap">Select MOM Player:</h3>
                        <div className="flex-1 flex gap-2">
                            <select 
                                className="flex-1 bg-white text-black text-xs px-3 py-2 rounded font-bold outline-none"
                                value={selectedMOM}
                                onChange={(e) => setSelectedMOM(e.target.value)}
                            >
                                <option value="">Select MOM Player</option>
                                {battingTeam?.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                {bowlingTeam?.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button 
                                onClick={() => updateOverlay({ momId: selectedMOM })}
                                className="bg-green-600 text-white font-bold text-[10px] px-3 py-2 rounded whitespace-nowrap uppercase"
                            >Display MOM</button>
                        </div>
                    </div>
                </div>

                {/* Main Scoring Controller */}
                <div className="bg-gradient-to-br from-cyan-400 to-purple-600 rounded-3xl p-6 shadow-2xl text-white mt-10">
                    <h3 className="text-center font-black text-black text-2xl mb-6 uppercase tracking-tighter">Match Controller</h3>
                    <div className="flex justify-between items-center bg-white/20 p-4 rounded-2xl mb-6 text-xs font-black uppercase">
                        <button onClick={() => setIsWide(!isWide)} className={`flex flex-col items-center gap-1 transition-all ${isWide ? 'text-blue-900 scale-110' : 'text-white/60'}`}>{isWide ? <CheckSquare className="w-8 h-8"/> : <Square className="w-8 h-8"/>} Wide</button>
                        <button onClick={() => setIsNoBall(!isNoBall)} className={`flex flex-col items-center gap-1 transition-all ${isNoBall ? 'text-blue-900 scale-110' : 'text-white/60'}`}>{isNoBall ? <CheckSquare className="w-8 h-8"/> : <Square className="w-8 h-8"/>} NB</button>
                        <button onClick={() => setIsBye(!isBye)} className={`flex flex-col items-center gap-1 transition-all ${isBye ? 'text-blue-900 scale-110' : 'text-white/60'}`}>{isBye ? <CheckSquare className="w-8 h-8"/> : <Square className="w-8 h-8"/>} Bye</button>
                        <button onClick={() => setIsWicket(!isWicket)} className={`flex flex-col items-center gap-1 transition-all ${isWicket ? 'text-red-900 scale-110 font-black' : 'text-white/60'}`}>{isWicket ? <CheckSquare className="w-8 h-8"/> : <Square className="w-8 h-8"/>} Wicket</button>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        {[0, 1, 2, 3, 4, 5, 6].map(r => (
                            <button key={r} onClick={() => handleScore(r)} className="bg-white/10 hover:bg-white/30 text-black font-black text-4xl py-6 rounded-3xl border border-white/20 transition-all active:scale-95 shadow-lg backdrop-blur-md">{r}</button>
                        ))}
                        <button onClick={handleUndo} className="bg-red-600 hover:bg-red-700 text-white font-black rounded-3xl text-sm flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95"><Undo2 className="w-6 h-6"/> UNDO</button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow p-4 text-center border-t-8 border-gray-200">
                    <h4 className="font-black text-xs uppercase text-gray-400 mb-4 tracking-widest">Theme & System</h4>
                    <div className="flex flex-wrap gap-2 justify-center">
                        <button onClick={toggleTheme} className="bg-gray-800 text-white text-[10px] font-bold px-4 py-2 rounded-lg uppercase shadow-md flex items-center gap-2">
                           <Palette className="w-3 h-3"/> Theme: {match.overlay?.theme || 'Default'}
                        </button>
                        <button onClick={() => navigate('/scoring')} className="bg-blue-600 text-white text-[10px] font-bold px-4 py-2 rounded-lg uppercase shadow-md">Dashboard</button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MatchScorer;
