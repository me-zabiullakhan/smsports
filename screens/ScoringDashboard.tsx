
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Match, Team } from '../types';
import { ArrowLeft, Plus, Calendar, Play, Monitor, Trash2, Loader2, Trophy } from 'lucide-react';
import { useAuction } from '../hooks/useAuction';

const ScoringDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { userProfile } = useAuction();
    const [matches, setMatches] = useState<Match[]>([]);
    const [auctions, setAuctions] = useState<AuctionSetup[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Modal State
    const [selectedAuctionId, setSelectedAuctionId] = useState('');
    const [auctionTeams, setAuctionTeams] = useState<Team[]>([]);
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

        // Fetch Auctions (for dropdown)
        db.collection('auctions')
            .where('createdBy', '==', userProfile.uid)
            .get()
            .then(snap => {
                setAuctions(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup)));
            });

        return () => unsubMatches();
    }, [userProfile]);

    useEffect(() => {
        if (!selectedAuctionId) {
            setAuctionTeams([]);
            return;
        }
        // Fetch teams when auction selected
        db.collection('auctions').doc(selectedAuctionId).collection('teams').get()
            .then(snap => {
                setAuctionTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
            });
    }, [selectedAuctionId]);

    const handleCreateMatch = async () => {
        if (!selectedAuctionId || !teamA || !teamB || !overs) {
            alert("Please fill all fields");
            return;
        }
        if (teamA === teamB) {
            alert("Teams must be different");
            return;
        }

        setCreating(true);
        try {
            const teamAObj = auctionTeams.find(t => t.id === teamA);
            const teamBObj = auctionTeams.find(t => t.id === teamB);

            const newMatch: Omit<Match, 'id'> = {
                auctionId: selectedAuctionId,
                teamAId: teamA,
                teamBId: teamB,
                teamAName: teamAObj?.name || 'Team A',
                teamBName: teamBObj?.name || 'Team B',
                totalOvers: overs,
                status: 'SCHEDULED',
                currentInnings: 1,
                createdAt: Date.now(),
                innings: {
                    1: {
                        battingTeamId: '',
                        bowlingTeamId: '',
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
                    },
                    2: {
                        battingTeamId: '',
                        bowlingTeamId: '',
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
                    }
                }
            };

            await db.collection('matches').add(newMatch);
            setShowModal(false);
            setCreating(false);
            // Reset form
            setTeamA(''); setTeamB(''); setSelectedAuctionId('');
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
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-700">
                            <ArrowLeft />
                        </button>
                        <h1 className="text-xl font-bold text-gray-700">Cricket Scoring Manager</h1>
                    </div>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow-lg transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4 mr-2" /> New Match
                    </button>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>
                ) : matches.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 bg-white rounded-xl shadow-sm">
                        <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300"/>
                        <p>No matches created yet. Click "New Match" to start.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {matches.map(match => (
                            <div key={match.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                                <div className="p-5 border-b border-gray-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${match.status === 'LIVE' ? 'bg-red-100 text-red-600 animate-pulse' : match.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                                            {match.status}
                                        </span>
                                        <div className="text-xs text-gray-400 font-mono">
                                            {new Date(match.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="text-center w-1/3">
                                            <div className="font-bold text-gray-800 truncate">{match.teamAName}</div>
                                        </div>
                                        <div className="text-gray-400 font-bold text-xs">VS</div>
                                        <div className="text-center w-1/3">
                                            <div className="font-bold text-gray-800 truncate">{match.teamBName}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 flex justify-between items-center gap-2">
                                    <button 
                                        onClick={() => navigate(`/scoring/${match.id}`)}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"
                                    >
                                        <Play className="w-3 h-3"/> Scorer
                                    </button>
                                    <button 
                                        onClick={() => window.open(`/#/match-overlay/${match.id}`, '_blank')}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold p-2 rounded"
                                        title="OBS Overlay"
                                    >
                                        <Monitor className="w-4 h-4"/>
                                    </button>
                                    <button 
                                        onClick={() => deleteMatch(match.id)}
                                        className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded"
                                    >
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-blue-600 p-4 text-white font-bold text-lg">Create New Match</div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Auction</label>
                                <select 
                                    className="w-full border rounded p-2 text-sm"
                                    value={selectedAuctionId}
                                    onChange={e => setSelectedAuctionId(e.target.value)}
                                >
                                    <option value="">-- Choose Auction --</option>
                                    {auctions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team A</label>
                                    <select 
                                        className="w-full border rounded p-2 text-sm"
                                        value={teamA}
                                        onChange={e => setTeamA(e.target.value)}
                                        disabled={!selectedAuctionId}
                                    >
                                        <option value="">Select</option>
                                        {auctionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team B</label>
                                    <select 
                                        className="w-full border rounded p-2 text-sm"
                                        value={teamB}
                                        onChange={e => setTeamB(e.target.value)}
                                        disabled={!selectedAuctionId}
                                    >
                                        <option value="">Select</option>
                                        {auctionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Overs</label>
                                <input 
                                    type="number" 
                                    className="w-full border rounded p-2 text-sm"
                                    value={overs}
                                    onChange={e => setOvers(Number(e.target.value))}
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 py-2 rounded text-sm font-bold text-gray-600">Cancel</button>
                                <button 
                                    onClick={handleCreateMatch}
                                    disabled={creating}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-bold flex justify-center items-center"
                                >
                                    {creating ? <Loader2 className="animate-spin w-4 h-4"/> : 'Create Match'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScoringDashboard;
