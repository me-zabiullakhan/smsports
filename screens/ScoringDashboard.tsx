
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Match, Team, Tournament } from '../types';
import { ArrowLeft, Plus, Calendar, Play, Monitor, Trash2, Loader2, Trophy, Layers, PenTool, Save } from 'lucide-react';
import { useAuction } from '../hooks/useAuction';
import TournamentManager from '../components/TournamentManager';

const ScoringDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { userProfile } = useAuction();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI Tabs
    const [activeTab, setActiveTab] = useState<'MATCHES' | 'TOURNAMENTS'>('MATCHES');

    // Inline Create Match State
    const [sourceType, setSourceType] = useState<'AUCTION' | 'TOURNAMENT'>('AUCTION');
    const [sourceList, setSourceList] = useState<(AuctionSetup | Tournament)[]>([]);
    const [selectedSourceId, setSelectedSourceId] = useState('');
    const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
    
    const [teamA, setTeamA] = useState('');
    const [teamB, setTeamB] = useState('');
    const [overs, setOvers] = useState(20);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!userProfile?.uid) return;

        setLoading(true);
        // Fetch Matches
        const unsubMatches = db.collection('matches')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
                setLoading(false);
            });
        return () => unsubMatches();
    }, [userProfile]);

    // Load Sources based on Type selection
    useEffect(() => {
        if (!userProfile?.uid) return;
        setSourceList([]);
        setSelectedSourceId('');
        setAvailableTeams([]);

        const collection = sourceType === 'AUCTION' ? 'auctions' : 'tournaments';
        
        db.collection(collection)
            .where('createdBy', '==', userProfile.uid)
            .get()
            .then(snap => {
                const list = snap.docs.map(d => ({ id: d.id, name: (d.data().title || d.data().name), ...d.data() } as any));
                setSourceList(list);
            });
    }, [sourceType, userProfile]);

    // Load Teams when source selected
    useEffect(() => {
        if (!selectedSourceId) {
            setAvailableTeams([]);
            return;
        }
        const collection = sourceType === 'AUCTION' ? 'auctions' : 'tournaments';
        db.collection(collection).doc(selectedSourceId).collection('teams').get()
            .then(snap => {
                setAvailableTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
            });
    }, [selectedSourceId, sourceType]);

    const handleCreateMatch = async () => {
        if (!selectedSourceId || !teamA || !teamB || !overs) {
            alert("Please fill all fields");
            return;
        }
        if (teamA === teamB) {
            alert("Teams must be different");
            return;
        }

        setCreating(true);
        try {
            const teamAObj = availableTeams.find(t => t.id === teamA);
            const teamBObj = availableTeams.find(t => t.id === teamB);

            const newMatch: Omit<Match, 'id'> = {
                auctionId: selectedSourceId, // Used as generic source ID
                sourceType: sourceType, // NEW FIELD
                teamAId: teamA,
                teamBId: teamB,
                teamAName: teamAObj?.name || 'Team A',
                teamBName: teamBObj?.name || 'Team B',
                totalOvers: overs,
                status: 'SCHEDULED',
                currentInnings: 1,
                createdAt: Date.now(),
                innings: {
                    1: { battingTeamId: '', bowlingTeamId: '', totalRuns: 0, wickets: 0, overs: 0, ballsInCurrentOver: 0, currentRunRate: 0, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }, strikerId: null, nonStrikerId: null, currentBowlerId: null, batsmen: {}, bowlers: {}, recentBalls: [] },
                    2: { battingTeamId: '', bowlingTeamId: '', totalRuns: 0, wickets: 0, overs: 0, ballsInCurrentOver: 0, currentRunRate: 0, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }, strikerId: null, nonStrikerId: null, currentBowlerId: null, batsmen: {}, bowlers: {}, recentBalls: [] }
                }
            };

            await db.collection('matches').add(newMatch);
            setCreating(false);
            setTeamA(''); setTeamB(''); // Reset teams but keep source for fast creation
        } catch (e: any) {
            alert("Error creating match: " + e.message);
            setCreating(false);
        }
    };

    const deleteMatch = async (id: string) => {
        if(window.confirm("Delete this match?")) {
            await db.collection('matches').doc(id).delete();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-700">
                            <ArrowLeft className="w-5 h-5"/>
                        </button>
                        <h1 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                           <Trophy className="w-5 h-5 text-yellow-500"/> Cricket Scoring
                        </h1>
                    </div>
                    
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button 
                            onClick={() => setActiveTab('MATCHES')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'MATCHES' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Matches
                        </button>
                        <button 
                            onClick={() => setActiveTab('TOURNAMENTS')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'TOURNAMENTS' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Tournaments
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 max-w-6xl">
                
                {activeTab === 'TOURNAMENTS' ? (
                    <TournamentManager />
                ) : (
                    <>
                        {/* INLINE CREATE MATCH PANEL */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Plus className="w-4 h-4"/> Schedule New Match
                            </h2>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="w-full md:w-auto">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Source</label>
                                    <div className="flex bg-gray-100 rounded p-1">
                                        <button onClick={() => setSourceType('AUCTION')} className={`flex-1 px-3 py-1.5 text-xs font-bold rounded ${sourceType === 'AUCTION' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Auction</button>
                                        <button onClick={() => setSourceType('TOURNAMENT')} className={`flex-1 px-3 py-1.5 text-xs font-bold rounded ${sourceType === 'TOURNAMENT' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Tournament</button>
                                    </div>
                                </div>

                                <div className="flex-1 w-full">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Select {sourceType === 'AUCTION' ? 'Auction' : 'Tournament'}</label>
                                    <select className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" value={selectedSourceId} onChange={e => setSelectedSourceId(e.target.value)}>
                                        <option value="">-- Select --</option>
                                        {sourceList.map((s: any) => <option key={s.id} value={s.id}>{s.name || s.title}</option>)}
                                    </select>
                                </div>

                                <div className="flex-1 w-full">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Team A</label>
                                    <select className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" value={teamA} onChange={e => setTeamA(e.target.value)} disabled={!selectedSourceId}>
                                        <option value="">-- Team A --</option>
                                        {availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex-1 w-full">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Team B</label>
                                    <select className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" value={teamB} onChange={e => setTeamB(e.target.value)} disabled={!selectedSourceId}>
                                        <option value="">-- Team B --</option>
                                        {availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                <div className="w-20">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Overs</label>
                                    <input type="number" className="w-full border rounded-lg px-2 py-2 text-sm bg-gray-50 text-center" value={overs} onChange={e => setOvers(Number(e.target.value))} />
                                </div>

                                <button 
                                    onClick={handleCreateMatch} 
                                    disabled={creating}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all active:scale-95 flex items-center h-[38px]"
                                >
                                    {creating ? <Loader2 className="animate-spin w-4 h-4"/> : 'Create'}
                                </button>
                            </div>
                        </div>

                        {/* Matches List */}
                        {loading ? (
                            <div className="flex justify-center p-10"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>
                        ) : matches.length === 0 ? (
                            <div className="text-center p-12 text-gray-400 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
                                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                                <p>No matches scheduled.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {matches.map(match => (
                                    <div key={match.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group">
                                        <div className="p-4 border-b border-gray-50">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${match.status === 'LIVE' ? 'bg-red-50 text-red-600 animate-pulse border border-red-100' : match.status === 'COMPLETED' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-100 text-gray-500'}`}>
                                                    {match.status}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded">
                                                    {match.sourceType === 'TOURNAMENT' ? '🏆 TOUR' : '🔨 AUCTION'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="w-[45%]">
                                                    <div className="font-bold text-gray-800 truncate text-sm" title={match.teamAName}>{match.teamAName}</div>
                                                </div>
                                                <div className="text-gray-300 font-bold text-xs">VS</div>
                                                <div className="w-[45%] text-right">
                                                    <div className="font-bold text-gray-800 truncate text-sm" title={match.teamBName}>{match.teamBName}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 p-3 flex justify-between gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => navigate(`/scoring/${match.id}`)}
                                                className="flex-1 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Play className="w-3 h-3"/> Scorer
                                            </button>
                                            <button 
                                                onClick={() => window.open(`/#/match-overlay/${match.id}`, '_blank')}
                                                className="bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 p-2 rounded"
                                                title="OBS Overlay"
                                            >
                                                <Monitor className="w-4 h-4"/>
                                            </button>
                                            <button 
                                                onClick={() => deleteMatch(match.id)}
                                                className="bg-white hover:bg-red-50 text-red-400 border border-gray-200 hover:border-red-200 p-2 rounded transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default ScoringDashboard;
