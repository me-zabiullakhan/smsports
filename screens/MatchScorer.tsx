
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Match, Player, Team, InningsState, BallEvent, BatsmanStats, BowlerStats } from '../types';
import { ArrowLeft, Trophy, Users, RotateCcw, Save, Loader2, Undo2, Circle, Settings, UserPlus, Info, CheckSquare, Square, Palette, ChevronDown, RefreshCw, Trash2 } from 'lucide-react';

const MatchScorer: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const [match, setMatch] = useState<Match | null>(null);
    const [teamA, setTeamA] = useState<Team | null>(null);
    const [teamB, setTeamB] = useState<Team | null>(null);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [showTossModal, setShowTossModal] = useState(false);
    
    // Toss State
    const [tossWinner, setTossWinner] = useState('');
    const [tossChoice, setTossChoice] = useState<'BAT' | 'BOWL'>('BAT');

    const [processing, setProcessing] = useState(false);

    // Controller Inputs
    const [isWide, setIsWide] = useState(false);
    const [isNoBall, setIsNoBall] = useState(false);
    const [isBye, setIsBye] = useState(false);
    const [isLegBye, setIsLegBye] = useState(false);
    const [isWicket, setIsWicket] = useState(false);

    // Team Editing Inputs
    const [newPlayerNameA, setNewPlayerNameA] = useState('');
    const [newPlayerNameB, setNewPlayerNameB] = useState('');

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
                if (m.status === 'SCHEDULED' || m.status === 'TOSS') {
                    setShowTossModal(true);
                } else {
                    setShowTossModal(false);
                }
                
                // Sync local state if needed (e.g. MOM)
                if (m.overlay?.momId) setSelectedMOM(m.overlay.momId);
                if (m.overlay?.customMessage) setCustomInput(m.overlay.customMessage);
            } else {
                navigate('/scoring');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [matchId]);

    // Fetch Teams based on Source Type
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
    }, [match?.auctionId, match?.teamAId, match?.teamBId]);

    // --- COMPUTED HELPERS ---
    const currentInnings = match ? match.innings[match.currentInnings] : null;
    
    // Robust Team Helper
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

    // --- ACTIONS ---

    const handleToss = async () => {
        if (!match || !tossWinner || !tossChoice) return;
        setProcessing(true);
        
        let battingId = tossWinner;
        let bowlingId = tossWinner === match.teamAId ? match.teamBId : match.teamAId;

        if (tossChoice === 'BOWL') {
            const temp = battingId;
            battingId = bowlingId;
            bowlingId = temp;
        }

        const newInnings: InningsState = {
            battingTeamId: battingId,
            bowlingTeamId: bowlingId,
            totalRuns: 0,
            wickets: 0,
            overs: 0,
            ballsInCurrentOver: 0,
            currentRunRate: 0,
            extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
            strikerId: null,
            nonStrikerId: null,
            currentBowlerId: null,
            batsmen: {},
            bowlers: {},
            recentBalls: []
        };

        await db.collection('matches').doc(match.id).update({
            tossWinnerId: tossWinner,
            tossChoice: tossChoice,
            status: 'LIVE',
            [`innings.1`]: newInnings,
            overlay: { currentView: 'DEFAULT', animation: 'NONE', theme: 'DEFAULT' }
        });
        
        setShowTossModal(false);
        setProcessing(false);
    };

    const handleDeleteMatch = async () => {
        if(!match) return;
        if(window.confirm("Are you sure you want to DELETE this match permanently? This action cannot be undone.")) {
            setProcessing(true);
            try {
                await db.collection('matches').doc(match.id).delete();
                // Navigation is handled automatically by the onSnapshot listener detecting deletion
            } catch (e) {
                console.error(e);
                alert("Failed to delete match");
                setProcessing(false);
            }
        }
    };

    const handlePlayerSelect = async (type: 'STRIKER' | 'NON_STRIKER' | 'BOWLER', playerId: string) => {
        if (!match || !playerId) return;
        
        // Ensure we are looking at the right team
        const targetTeam = type === 'BOWLER' ? bowlingTeam : battingTeam;
        
        if (!targetTeam) {
            console.error("Target team not found for selection");
            return;
        }

        const playerObj = targetTeam.players.find(p => String(p.id) === String(playerId));
            
        if (!playerObj) {
            console.error("Player not found in team", playerId);
            return;
        }

        const updateData: any = {};
        const prefix = `innings.${match.currentInnings}`;

        if (type === 'BOWLER') {
            // Check if bowler exists in map, if not add them
            if (!currentInnings?.bowlers || !currentInnings.bowlers[playerId]) {
                const newBowlerStats: BowlerStats = {
                    playerId,
                    name: playerObj.name,
                    overs: 0,
                    ballsBowled: 0,
                    runsConceded: 0,
                    wickets: 0,
                    maidens: 0
                };
                updateData[`${prefix}.bowlers.${playerId}`] = newBowlerStats;
            }
            updateData[`${prefix}.currentBowlerId`] = playerId;
        } else {
            // Check if batsman exists in map
            if (!currentInnings?.batsmen || !currentInnings.batsmen[playerId]) {
                const newBatStats: BatsmanStats = {
                    playerId,
                    name: playerObj.name,
                    runs: 0,
                    balls: 0,
                    fours: 0,
                    sixes: 0,
                    isStriker: type === 'STRIKER'
                };
                updateData[`${prefix}.batsmen.${playerId}`] = newBatStats;
            } else {
                updateData[`${prefix}.batsmen.${playerId}.isStriker`] = type === 'STRIKER';
            }
            
            if (type === 'STRIKER') updateData[`${prefix}.strikerId`] = playerId;
            else updateData[`${prefix}.nonStrikerId`] = playerId;
        }

        await db.collection('matches').doc(match.id).update(updateData);
    };

    const handleScore = async (runs: number) => {
        if (!match || !currentInnings) return;
        
        if (needsStriker || needsNonStriker || needsBowler) {
            alert("Please select Striker, Non-Striker and Bowler first.");
            return;
        }

        setProcessing(true);

        const state = JSON.parse(JSON.stringify(currentInnings)) as InningsState;
        const striker = state.batsmen[state.strikerId!];
        const bowler = state.bowlers[state.currentBowlerId!];

        // Determine Type
        let extraType: 'WIDE' | 'NOBALL' | 'BYE' | 'LEGBYE' | undefined = undefined;
        if (isWide) extraType = 'WIDE';
        else if (isNoBall) extraType = 'NOBALL';
        else if (isBye) extraType = 'BYE';
        else if (isLegBye) extraType = 'LEGBYE';

        const isLegalBall = !isWide && !isNoBall;
        
        // --- CALCS ---
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
            state.ballsInCurrentOver++;
            bowler.ballsBowled++;
            // Overs calc
            const totalValidBalls = (Math.floor(state.overs) * 6) + Math.round((state.overs % 1) * 10) + 1;
            const completedOvers = Math.floor(totalValidBalls / 6);
            const ballsRem = totalValidBalls % 6;
            state.overs = Number(`${completedOvers}.${ballsRem}`);
            
            // Bowler Overs
            const bValidBalls = (Math.floor(bowler.overs) * 6) + Math.round((bowler.overs % 1) * 10) + 1;
            const bOvers = Math.floor(bValidBalls / 6);
            const bRem = bValidBalls % 6;
            bowler.overs = Number(`${bOvers}.${bRem}`);
        }

        if (isWicket) {
            state.wickets++;
            bowler.wickets++;
            striker.outBy = `b ${bowler.name}`;
            state.strikerId = null; 
        }

        const newEvent: BallEvent = {
            ballNumber: state.ballsInCurrentOver,
            overNumber: Math.floor(state.overs),
            bowlerId: bowler.playerId,
            batsmanId: striker.playerId,
            runs,
            isWide, isNoBall, isWicket, isBye, isLegBye,
            extras: (extraType ? 1 : 0)
        };
        if (isWicket) {
            newEvent.wicketType = 'bowled';
        }
        state.recentBalls.push(newEvent);

        // Rotation
        const oddRuns = runs % 2 !== 0;
        if (oddRuns) {
            const temp = state.strikerId;
            state.strikerId = state.nonStrikerId;
            state.nonStrikerId = temp;
            if (state.strikerId && state.batsmen[state.strikerId]) state.batsmen[state.strikerId].isStriker = true;
            if (state.nonStrikerId && state.batsmen[state.nonStrikerId]) state.batsmen[state.nonStrikerId].isStriker = false;
        }

        if (state.ballsInCurrentOver === 6) {
            state.ballsInCurrentOver = 0;
            state.currentBowlerId = null;
            const temp = state.strikerId;
            state.strikerId = state.nonStrikerId;
            state.nonStrikerId = temp;
            if (state.strikerId && state.batsmen[state.strikerId]) state.batsmen[state.strikerId].isStriker = true;
            if (state.nonStrikerId && state.batsmen[state.nonStrikerId]) state.batsmen[state.nonStrikerId].isStriker = false;
        }

        await db.collection('matches').doc(match.id).update({
            [`innings.${match.currentInnings}`]: state
        });

        // Reset inputs
        setIsWide(false); setIsNoBall(false); setIsBye(false); setIsLegBye(false); setIsWicket(false);
        setProcessing(false);
    };

    const handleSwapBatter = async () => {
        if (!match || !currentInnings) return;
        const temp = currentInnings.strikerId;
        const newStriker = currentInnings.nonStrikerId;
        const newNonStriker = temp;
        
        // Update Firestore
        await db.collection('matches').doc(match.id).update({
            [`innings.${match.currentInnings}.strikerId`]: newStriker,
            [`innings.${match.currentInnings}.nonStrikerId`]: newNonStriker
        });
    };

    const handleRetireBatter = async () => {
        if (!match || !currentInnings || !currentInnings.strikerId) return;
        if (!window.confirm("Retire current striker?")) return;
        // Logic: just remove striker ID so scorer prompts for new one. Stats persist.
        await db.collection('matches').doc(match.id).update({
            [`innings.${match.currentInnings}.strikerId`]: null
        });
    };

    const handleChangeBowler = async () => {
        if (!match) return;
        await db.collection('matches').doc(match.id).update({
            [`innings.${match.currentInnings}.currentBowlerId`]: null
        });
    };

    const handleAddPlayer = async (teamId: string, playerName: string) => {
        if (!match || !playerName.trim()) return;
        setProcessing(true);
        try {
            const collectionName = match.sourceType === 'TOURNAMENT' ? 'tournaments' : 'auctions';
            const teamRef = db.collection(collectionName).doc(match.auctionId).collection('teams').doc(teamId);
            const teamDoc = await teamRef.get();
            if (teamDoc.exists) {
                const currentPlayers = teamDoc.data()?.players || [];
                const newPlayer: Player = {
                    id: Date.now().toString(),
                    name: playerName,
                    role: 'General',
                    category: 'Standard',
                    basePrice: 0,
                    photoUrl: '',
                    nationality: 'India',
                    speciality: 'General',
                    stats: { matches: 0, runs: 0, wickets: 0 },
                    status: 'SOLD',
                    soldPrice: 0
                };
                await teamRef.update({ players: [...currentPlayers, newPlayer] });
                
                // Refresh local state immediately
                if (teamId === teamA?.id && teamA) setTeamA({ ...teamA, players: [...teamA.players, newPlayer] });
                if (teamId === teamB?.id && teamB) setTeamB({ ...teamB, players: [...teamB.players, newPlayer] });
                
                setNewPlayerNameA('');
                setNewPlayerNameB('');
            }
        } catch (e) {
            console.error(e);
            alert("Failed to add player");
        }
        setProcessing(false);
    };

    const updateOverlay = async (updates: any) => {
        if (!match) return;
        await db.collection('matches').doc(match.id).update({
            overlay: { ...match.overlay, ...updates }
        });
    };

    const toggleTheme = async () => {
        if (!match) return;
        const newTheme = match.overlay?.theme === 'CWC2023' ? 'DEFAULT' : 'CWC2023';
        await updateOverlay({ theme: newTheme });
    };

    const handleUndo = async () => {
        if (!match || !currentInnings || currentInnings.recentBalls.length === 0) return;
        if (window.confirm("Undo last ball?")) {
            setProcessing(true);
            try {
                const state = JSON.parse(JSON.stringify(currentInnings)) as InningsState;
                const lastBall = state.recentBalls.pop();
                if (lastBall) {
                    const batsman = state.batsmen[lastBall.batsmanId];
                    const bowler = state.bowlers[lastBall.bowlerId];
                    
                    // Reverse stats
                    let runVal = lastBall.runs;
                    let extrasVal = (lastBall.isWide || lastBall.isNoBall) ? 1 : 0;
                    let totalVal = runVal + extrasVal;
                    
                    state.totalRuns -= totalVal;
                    
                    // Bowler runs
                    let bRuns = runVal;
                    if (lastBall.isWide || lastBall.isNoBall) bRuns += 1;
                    if (lastBall.isBye || lastBall.isLegBye) bRuns = 0;
                    bowler.runsConceded -= bRuns;
                    
                    // Extras
                    if (lastBall.isWide) state.extras.wides -= (1 + runVal);
                    if (lastBall.isNoBall) state.extras.noBalls -= (1 + runVal);
                    if (lastBall.isBye) state.extras.byes -= runVal;
                    if (lastBall.isLegBye) state.extras.legByes -= runVal;
                    
                    // Batsman
                    if (!lastBall.isWide) {
                        if (!lastBall.isBye && !lastBall.isLegBye) {
                            batsman.runs -= runVal;
                            if (runVal === 4) batsman.fours--;
                            if (runVal === 6) batsman.sixes--;
                        }
                        batsman.balls--;
                    }
                    
                    // Wicket
                    if (lastBall.isWicket) {
                        state.wickets--;
                        bowler.wickets--;
                        delete batsman.outBy;
                        state.strikerId = lastBall.batsmanId; // Revive
                    }
                    
                    // Legal ball logic
                    const isLegal = !lastBall.isWide && !lastBall.isNoBall;
                    if (isLegal) {
                        bowler.ballsBowled--;
                        
                        if (lastBall.ballNumber === 6) {
                            // Reverse over change
                            state.ballsInCurrentOver = 5;
                            state.currentBowlerId = lastBall.bowlerId;
                            // Reverse swap
                            const temp = state.strikerId;
                            state.strikerId = state.nonStrikerId;
                            state.nonStrikerId = temp;
                        } else {
                            state.ballsInCurrentOver--;
                        }
                        
                        // Recalc Overs
                        const totalLegal = state.recentBalls.filter(b => !b.isWide && !b.isNoBall).length;
                        state.overs = Number(`${Math.floor(totalLegal/6)}.${totalLegal%6}`);
                        
                        const bLegal = bowler.ballsBowled;
                        bowler.overs = Number(`${Math.floor(bLegal/6)}.${bLegal%6}`);
                    }
                    
                    // Reverse rotation
                    if (!lastBall.isWicket && (runVal % 2 !== 0)) {
                        const temp = state.strikerId;
                        state.strikerId = state.nonStrikerId;
                        state.nonStrikerId = temp;
                    }
                    
                    if (state.strikerId && state.batsmen[state.strikerId]) state.batsmen[state.strikerId].isStriker = true;
                    if (state.nonStrikerId && state.batsmen[state.nonStrikerId]) state.batsmen[state.nonStrikerId].isStriker = false;
                }
                
                await db.collection('matches').doc(match.id).update({
                    [`innings.${match.currentInnings}`]: state
                });
            } catch(e) {
                console.error(e);
            } finally {
                setProcessing(false);
            }
        }
    };

    const handleInningsEnd = async () => {
        if (!match) return;
        if (match.currentInnings === 1) {
            if (window.confirm("End 1st Innings?")) {
                const inn2: InningsState = {
                    battingTeamId: match.innings[1].bowlingTeamId,
                    bowlingTeamId: match.innings[1].battingTeamId,
                    totalRuns: 0, wickets: 0, overs: 0, ballsInCurrentOver: 0, currentRunRate: 0,
                    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
                    strikerId: null, nonStrikerId: null, currentBowlerId: null, batsmen: {}, bowlers: {}, recentBalls: []
                };
                await db.collection('matches').doc(match.id).update({
                    currentInnings: 2,
                    [`innings.2`]: inn2
                });
            }
        } else {
            if (window.confirm("Finish Match?")) {
                let winnerId = '';
                if (match.innings[1].totalRuns > match.innings[2].totalRuns) winnerId = match.innings[1].battingTeamId;
                else if (match.innings[2].totalRuns > match.innings[1].totalRuns) winnerId = match.innings[2].battingTeamId;
                
                await db.collection('matches').doc(match.id).update({
                    status: 'COMPLETED',
                    winnerId
                });
                navigate('/scoring');
            }
        }
    };

    if (loading || !match) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin"/></div>;

    const CheckBoxBtn = ({ label, val, setVal }: any) => (
        <button onClick={() => setVal(!val)} className={`flex items-center gap-2 font-bold ${val ? 'text-blue-600' : 'text-gray-600'}`}>
            {val ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>} {label}
        </button>
    );

    // Helper to render selection dropdowns inline
    const renderPlayerSelector = (type: 'STRIKER' | 'NON_STRIKER' | 'BOWLER', currentId: string | null | undefined) => {
        const isBatsman = type === 'STRIKER' || type === 'NON_STRIKER';
        const team = isBatsman ? battingTeam : bowlingTeam;
        
        // If team data isn't loaded yet, show loading
        if (!team) return <div className="text-xs text-gray-400 font-bold animate-pulse">Loading Team...</div>;

        if (currentId) {
            const playerStats = isBatsman ? currentInnings?.batsmen[currentId] : currentInnings?.bowlers[currentId];
            const name = playerStats?.name || team.players.find(p => String(p.id) === String(currentId))?.name || 'Unknown';
            const statsDisplay = isBatsman 
                ? (playerStats as BatsmanStats)?.runs || 0 
                : `${(playerStats as BowlerStats)?.wickets || 0}-${(playerStats as BowlerStats)?.runsConceded || 0}`;

            return (
                <div className={`flex justify-between font-bold text-sm ${type === 'STRIKER' ? 'text-green-400' : type === 'BOWLER' ? 'text-black' : 'text-white'}`}>
                    <span>{name}</span>
                    <span>{statsDisplay}</span>
                </div>
            );
        }

        const label = type === 'STRIKER' ? 'SELECT STRIKER' : type === 'NON_STRIKER' ? 'SELECT NON-STR' : 'SELECT BOWLER';
        const otherId = type === 'STRIKER' ? currentInnings?.nonStrikerId : type === 'NON_STRIKER' ? currentInnings?.strikerId : null;

        return (
            <select 
                className={`w-full text-xs font-bold p-1 rounded border outline-none uppercase mb-1
                    ${type === 'BOWLER' ? 'bg-white border-cyan-500 text-black' : 'bg-gray-800 border-gray-600 text-white animate-pulse'}
                `}
                onChange={(e) => handlePlayerSelect(type, e.target.value)}
                value=""
            >
                <option value="">{label}</option>
                {team.players.map(p => (
                    <option key={p.id} value={p.id} disabled={String(p.id) === String(otherId)}>
                        {p.name}
                    </option>
                ))}
            </select>
        );
    };

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-10">
            
            {/* TOSS MODAL - High Z-Index and Visibility */}
            {showTossModal && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl border-4 border-yellow-400 scale-100 transform transition-all">
                        <Trophy className="w-16 h-16 mx-auto text-yellow-500 mb-4 animate-bounce" />
                        <h2 className="text-2xl font-black mb-6">MATCH TOSS</h2>
                        
                        <div className="mb-4 text-left">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Who won the toss?</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setTossWinner(match.teamAId)}
                                    className={`p-3 rounded border-2 font-bold ${tossWinner === match.teamAId ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                                >
                                    {match.teamAName}
                                </button>
                                <button 
                                    onClick={() => setTossWinner(match.teamBId)}
                                    className={`p-3 rounded border-2 font-bold ${tossWinner === match.teamBId ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                                >
                                    {match.teamBName}
                                </button>
                            </div>
                        </div>

                        <div className="mb-6 text-left">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Choice</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setTossChoice('BAT')}
                                    className={`p-3 rounded border-2 font-bold ${tossChoice === 'BAT' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                                >
                                    BAT
                                </button>
                                <button 
                                    onClick={() => setTossChoice('BOWL')}
                                    className={`p-3 rounded border-2 font-bold ${tossChoice === 'BOWL' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                                >
                                    BOWL
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={handleToss}
                            disabled={!tossWinner || processing}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? 'Starting Match...' : 'START MATCH'}
                        </button>
                    </div>
                </div>
            )}

            {/* 1. Header Match Scoreboard */}
            <div className="bg-white p-4 shadow-sm border-b sticky top-0 z-10">
                <div className="flex justify-between items-center mb-2">
                    <button onClick={() => navigate('/scoring')} className="text-gray-500"><ArrowLeft className="w-5 h-5"/></button>
                    <h2 className="font-black text-gray-700 uppercase">Match Scoreboard</h2>
                    <div className="flex items-center gap-3">
                        <a href={`/#/match-overlay/${matchId}`} target="_blank" className="text-blue-600 font-bold text-xs underline">LINKS</a>
                        <button onClick={handleDeleteMatch} className="text-red-500 hover:text-red-700 p-1" title="Delete Match">
                            <Trash2 className="w-4 h-4"/>
                        </button>
                    </div>
                </div>
                <div className="text-center">
                    <h3 className="font-bold text-lg">{match.teamAName} <span className="text-gray-400 text-sm">vs</span> {match.teamBName}</h3>
                    <div className="bg-purple-600 text-white font-bold py-1 px-4 rounded mt-1 text-sm uppercase tracking-wider">
                        RUN RATE: {(currentInnings?.totalRuns && currentInnings?.overs) ? (currentInnings.totalRuns / Math.max(0.1, currentInnings.overs)).toFixed(2) : '0.00'}
                    </div>
                </div>
                
                {/* Score Cards - UPDATED with Inline Selectors */}
                <div className="grid grid-cols-3 gap-2 mt-4 text-white">
                    <div className="bg-gray-900 rounded p-2 flex flex-col justify-center">
                        <div className="mb-1">
                            {renderPlayerSelector('STRIKER', currentInnings?.strikerId)}
                        </div>
                        <div>
                            {renderPlayerSelector('NON_STRIKER', currentInnings?.nonStrikerId)}
                        </div>
                    </div>
                    
                    <div className="bg-blue-500 rounded p-2 text-center flex flex-col justify-center">
                        <span className="text-3xl font-black">{currentInnings?.totalRuns}-{currentInnings?.wickets}</span>
                        <span className="text-xs font-bold uppercase">{currentInnings?.overs} OVR</span>
                    </div>
                    
                    <div className="bg-cyan-500 rounded p-2 flex flex-col justify-between">
                        <div>
                            {renderPlayerSelector('BOWLER', currentInnings?.currentBowlerId)}
                        </div>
                        {/* Last 6 balls dots */}
                        <div className="flex gap-1 justify-center mt-2">
                            {currentInnings?.recentBalls.slice(-6).map((b,i) => (
                                <div key={i} className="w-3 h-3 rounded-full bg-white flex items-center justify-center text-[8px] text-black font-bold">
                                    {b.isWicket ? 'W' : b.runs}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-xl mx-auto p-2 space-y-4">
                
                {/* 2. Controller */}
                <div className="bg-gradient-to-br from-cyan-400 to-purple-600 rounded-xl p-4 shadow-lg text-white">
                    <h3 className="text-center font-bold text-black text-xl mb-4">Controller</h3>
                    
                    {/* Action Buttons */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        <button onClick={handleSwapBatter} className="col-span-1 bg-pink-400 hover:bg-pink-500 text-white text-[10px] font-bold py-2 rounded">⇄ SWAP BATTER</button>
                        <button onClick={handleRetireBatter} className="col-span-1 bg-green-300 hover:bg-green-400 text-black text-[10px] font-bold py-2 rounded">RETIRE BATTER</button>
                        <button onClick={handleChangeBowler} className="col-span-1 bg-blue-400 hover:bg-blue-500 text-white text-[10px] font-bold py-2 rounded">CHANGE BOWLER</button>
                        <button onClick={() => updateOverlay({ currentView: 'DEFAULT' })} className="col-span-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold py-2 rounded">Default</button>
                    </div>

                    {/* View Control Grid */}
                    <div className="grid grid-cols-5 gap-2 mb-3">
                        <button onClick={() => updateOverlay({ currentView: 'DEFAULT' })} className="bg-indigo-900 text-[10px] py-1 rounded">Mini-Score</button>
                        
                        {/* THEME TOGGLE - Explicitly showing state */}
                        <button onClick={() => toggleTheme()} className="bg-blue-700 hover:bg-blue-600 text-[10px] py-1 rounded flex flex-col items-center justify-center font-bold border border-blue-400">
                            <Palette className="w-3 h-3 mb-0.5"/> 
                            {match.overlay?.theme === 'CWC2023' ? 'Theme: CWC 23' : 'Theme: Standard'}
                        </button>

                        <button onClick={() => updateOverlay({ currentView: 'B1' })} className="bg-teal-500 text-[10px] py-1 rounded">B1</button>
                        <button onClick={() => updateOverlay({ currentView: 'B2' })} className="bg-pink-500 text-[10px] py-1 rounded">B2</button>
                        <button onClick={() => updateOverlay({ currentView: 'BOWLER' })} className="bg-cyan-500 text-[10px] py-1 rounded">Bowler</button>
                        
                        <button onClick={() => updateOverlay({ currentView: 'I1BAT' })} className="bg-red-800 text-[10px] py-1 rounded">Batting</button>
                        <button onClick={() => updateOverlay({ currentView: 'I1BALL' })} className="bg-purple-800 text-[10px] py-1 rounded">Bowling</button>
                        <button className="bg-yellow-500 text-black text-[10px] py-1 rounded">PP+</button>
                        <button onClick={handleInningsEnd} className="bg-purple-900 text-[10px] py-1 rounded col-span-2">END Inning {match.currentInnings}</button>
                    </div>
                    
                    {/* UNDO */}
                    <div className="flex justify-end mb-3">
                        <button onClick={handleUndo} className="bg-red-600 text-white text-xs font-bold px-4 py-1 rounded shadow">UNDO</button>
                    </div>

                    {/* Extras Checkboxes */}
                    <div className="flex justify-between items-center bg-white/20 p-2 rounded mb-4 text-xs font-bold">
                        <CheckBoxBtn label="Wide" val={isWide} setVal={setIsWide} />
                        <CheckBoxBtn label="No Ball" val={isNoBall} setVal={setIsNoBall} />
                        <CheckBoxBtn label="Byes" val={isBye} setVal={setIsBye} />
                        <CheckBoxBtn label="Leg Byes" val={isLegBye} setVal={setIsLegBye} />
                        <div className="flex items-center gap-1">
                            <CheckBoxBtn label="Wicket" val={isWicket} setVal={setIsWicket} />
                            <Info className="w-3 h-3 text-yellow-300"/>
                        </div>
                    </div>

                    {/* Run Buttons */}
                    <div className="flex justify-center gap-4 mb-4">
                        {[0, 1, 2, 3].map(r => (
                            <button key={r} onClick={() => handleScore(r)} className="w-10 h-10 rounded-full border-2 border-black bg-transparent text-black font-bold text-xl hover:bg-white/30 transition-colors flex items-center justify-center">{r}</button>
                        ))}
                    </div>
                    <div className="flex justify-center gap-4">
                        {[4, 5, 6].map(r => (
                            <button key={r} onClick={() => handleScore(r)} className="w-10 h-10 rounded-full border-2 border-black bg-transparent text-black font-bold text-xl hover:bg-white/30 transition-colors flex items-center justify-center">{r}</button>
                        ))}
                        <button className="w-10 h-10 rounded-full border-2 border-black bg-transparent text-black font-bold text-xl flex items-center justify-center">...</button>
                    </div>
                    <div className="flex justify-center gap-4 mt-4">
                        <button className="w-10 h-10 rounded-full border-2 border-black bg-transparent text-black font-bold text-lg flex items-center justify-center">1D</button>
                        <button className="w-10 h-10 rounded-full border-2 border-black bg-transparent text-black font-bold text-lg flex items-center justify-center">?</button>
                    </div>
                </div>

                {/* 3. Team Management */}
                <div className="bg-fuchsia-600 rounded-xl p-4 text-white">
                    <div className="text-center mb-2">
                        <button className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded flex items-center mx-auto">Edit Team Short Name <Settings className="w-3 h-3 ml-1"/></button>
                        <p className="text-[10px] mt-1 text-fuchsia-200">For Bulk upload add , between player name</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <input value={newPlayerNameA} onChange={e => setNewPlayerNameA(e.target.value)} placeholder={`ADD PLAYER TO ${teamA?.name}`} className="flex-1 text-black text-xs px-2 py-1 rounded uppercase font-bold"/>
                            <button onClick={() => handleAddPlayer(teamA!.id.toString(), newPlayerNameA)} className="bg-green-500 p-1 rounded"><UserPlus className="w-5 h-5"/></button>
                            <button className="bg-gray-900 text-[10px] px-2 py-1 rounded font-bold">{teamA?.name} Players ({teamA?.players.length})</button>
                        </div>
                        <div className="flex gap-2">
                            <input value={newPlayerNameB} onChange={e => setNewPlayerNameB(e.target.value)} placeholder={`ADD PLAYER TO ${teamB?.name}`} className="flex-1 text-black text-xs px-2 py-1 rounded uppercase font-bold"/>
                            <button onClick={() => handleAddPlayer(teamB!.id.toString(), newPlayerNameB)} className="bg-green-500 p-1 rounded"><UserPlus className="w-5 h-5"/></button>
                            <button className="bg-gray-900 text-[10px] px-2 py-1 rounded font-bold">{teamB?.name} Players ({teamB?.players.length})</button>
                        </div>
                    </div>
                </div>

                {/* 4. Animations */}
                <div className="bg-white rounded-xl shadow p-4 text-center">
                    <h4 className="font-bold text-sm mb-2">Animations</h4>
                    <div className="flex flex-wrap gap-2 justify-center">
                        <button onClick={() => updateOverlay({ animation: 'FREE_HIT' })} className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded">FREE HIT</button>
                        <button onClick={() => updateOverlay({ animation: 'HAT_TRICK' })} className="bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded">HAT-TRICK BALL</button>
                        <button onClick={() => updateOverlay({ animation: 'FOUR' })} className="bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded">FOUR</button>
                        <button onClick={() => updateOverlay({ animation: 'SIX' })} className="bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded">SIX</button>
                        <button onClick={() => updateOverlay({ animation: 'WICKET' })} className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded">WICKET</button>
                        <button onClick={() => updateOverlay({ animation: 'BOUNDARIES' })} className="bg-fuchsia-500 text-white text-[10px] font-bold px-3 py-1 rounded">TOUR BOUNDARIES</button>
                        <button onClick={() => updateOverlay({ animation: 'NONE' })} className="bg-red-800 text-white text-[10px] font-bold px-3 py-1 rounded-full">STOP</button>
                    </div>
                </div>

                {/* 5. Display Controller */}
                <div className="bg-black text-white rounded-xl p-4 text-center">
                    <h4 className="font-bold text-sm mb-3 uppercase">Display Controller</h4>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {['DEFAULT', 'I1BAT', 'I1BALL', 'I2BAT', 'I2BALL', 'SUMMARY', 'FOW', 'B1', 'B2'].map(v => (
                            <button key={v} onClick={() => updateOverlay({ currentView: v })} className={`px-3 py-1 rounded text-[10px] font-bold ${v === 'DEFAULT' ? 'bg-green-500' : v.startsWith('I') ? 'bg-blue-600' : 'bg-pink-500'}`}>{v}</button>
                        ))}
                        <button onClick={() => updateOverlay({ currentView: 'BOWLER' })} className="bg-pink-700 px-3 py-1 rounded text-[10px] font-bold">BOWLER</button>
                        <button onClick={() => updateOverlay({ currentView: 'TARGET' })} className="bg-cyan-500 px-3 py-1 rounded text-[10px] font-bold">TARGET</button>
                        <button onClick={() => updateOverlay({ currentView: 'PARTNERSHIP' })} className="bg-yellow-500 text-black px-3 py-1 rounded text-[10px] font-bold">PARTNERSHIP</button>
                        <button onClick={() => updateOverlay({ currentView: 'TEAMS_PLAYERS' })} className="bg-red-600 px-3 py-1 rounded text-[10px] font-bold">TEAMS PLAYERS</button>
                    </div>
                </div>

                {/* 6. Decision */}
                <div className="bg-black text-white rounded-xl p-4 flex items-center justify-center gap-4">
                    <span className="font-bold text-cyan-400">Decision :</span>
                    <button onClick={() => updateOverlay({ decision: 'PENDING' })} className="bg-yellow-400 text-black font-bold px-4 py-1 rounded text-xs">PENDING</button>
                    <button onClick={() => updateOverlay({ decision: 'OUT' })} className="bg-red-600 text-white font-bold px-4 py-1 rounded text-xs">OUT</button>
                    <button onClick={() => updateOverlay({ decision: 'NOT_OUT' })} className="bg-green-500 text-white font-bold px-4 py-1 rounded text-xs">NOT OUT</button>
                </div>

                {/* 7. Custom Input */}
                <div className="bg-black text-white rounded-xl p-4 flex gap-2 items-center">
                    <span className="font-bold text-cyan-400 text-xs whitespace-nowrap">Custom Input :</span>
                    <input value={customInput} onChange={e => setCustomInput(e.target.value)} className="flex-1 text-black text-xs px-2 py-1 rounded" placeholder="Use - for split text"/>
                    <button onClick={() => updateOverlay({ customMessage: customInput })} className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded">Display Input</button>
                </div>

                {/* 8. MOM */}
                <div className="bg-black text-white rounded-xl p-4 flex gap-2 items-center">
                    <span className="font-bold text-cyan-400 text-xs whitespace-nowrap">Select MOM Player:</span>
                    <select value={selectedMOM} onChange={e => setSelectedMOM(e.target.value)} className="flex-1 text-black text-xs px-2 py-1 rounded">
                        <option value="">Select MOM Player</option>
                        {teamA?.players.map(p => <option key={p.id} value={p.id}>{p.name} ({teamA.name})</option>)}
                        {teamB?.players.map(p => <option key={p.id} value={p.id}>{p.name} ({teamB.name})</option>)}
                    </select>
                    <button onClick={() => updateOverlay({ momId: selectedMOM })} className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded">Display MOM</button>
                </div>

            </div>
        </div>
    );
};

export default MatchScorer;
