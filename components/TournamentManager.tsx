
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { Tournament, Team, Player } from '../types';
import { Plus, Trash2, Save, FileSpreadsheet, Loader2, ChevronDown, ChevronRight, UserPlus, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuction } from '../hooks/useAuction';

const TournamentManager: React.FC = () => {
    const { userProfile } = useAuction();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTournName, setNewTournName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    // Expanded Tournament ID for accordion view
    const [expandedTournId, setExpandedTournId] = useState<string | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);

    // New Team Input
    const [newTeamName, setNewTeamName] = useState('');

    // Excel Import
    const excelInputRef = useRef<HTMLInputElement>(null);
    const [importingTeamId, setImportingTeamId] = useState<string | null>(null);

    useEffect(() => {
        if (!userProfile?.uid) return;
        const unsub = db.collection('tournaments')
            .where('createdBy', '==', userProfile.uid)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));
                setLoading(false);
            });
        return () => unsub();
    }, [userProfile]);

    useEffect(() => {
        if (!expandedTournId) {
            setTeams([]);
            return;
        }
        setLoadingTeams(true);
        const unsub = db.collection('tournaments').doc(expandedTournId).collection('teams').onSnapshot(snap => {
            setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
            setLoadingTeams(false);
        });
        return () => unsub();
    }, [expandedTournId]);

    const handleCreateTournament = async () => {
        if (!newTournName.trim()) return;
        setIsCreating(true);
        try {
            await db.collection('tournaments').add({
                name: newTournName,
                createdBy: userProfile?.uid,
                createdAt: Date.now()
            });
            setNewTournName('');
        } catch (e) {
            console.error(e);
            alert("Failed to create tournament");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteTournament = async (id: string) => {
        if (window.confirm("Delete this tournament and all its teams?")) {
            await db.collection('tournaments').doc(id).delete();
        }
    };

    const handleAddTeam = async () => {
        if (!expandedTournId || !newTeamName.trim()) return;
        try {
            const teamId = db.collection('dummy').doc().id;
            await db.collection('tournaments').doc(expandedTournId).collection('teams').doc(teamId).set({
                id: teamId,
                name: newTeamName,
                owner: 'Manager',
                budget: 0,
                players: [],
                logoUrl: ''
            });
            setNewTeamName('');
        } catch (e) {
            alert("Error adding team");
        }
    };

    const handleDeleteTeam = async (teamId: string) => {
        if (!expandedTournId) return;
        if(window.confirm("Delete team?")) {
            await db.collection('tournaments').doc(expandedTournId).collection('teams').doc(teamId).delete();
        }
    };

    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !expandedTournId || !importingTeamId) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("File empty");
                return;
            }

            const newPlayers: Player[] = jsonData.map((row: any) => ({
                id: db.collection('dummy').doc().id,
                name: row['Name'] || row['name'] || 'Unknown',
                role: row['Role'] || row['role'] || 'General',
                category: 'Standard',
                basePrice: 0,
                photoUrl: '',
                nationality: 'India',
                speciality: row['Role'] || 'General',
                stats: { matches: 0, runs: 0, wickets: 0 },
                status: 'SOLD',
                soldPrice: 0
            }));

            // Fetch current team to append
            const teamRef = db.collection('tournaments').doc(expandedTournId).collection('teams').doc(importingTeamId);
            const teamDoc = await teamRef.get();
            if (teamDoc.exists) {
                const currentPlayers = (teamDoc.data() as Team).players || [];
                await teamRef.update({
                    players: [...currentPlayers, ...newPlayers]
                });
                alert(`Added ${newPlayers.length} players to team.`);
            }
        } catch (err: any) {
            alert("Import Failed: " + err.message);
        } finally {
            if (excelInputRef.current) excelInputRef.current.value = '';
            setImportingTeamId(null);
        }
    };

    const triggerImport = (teamId: string) => {
        setImportingTeamId(teamId);
        setTimeout(() => excelInputRef.current?.click(), 100);
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600"/> Tournament Manager
            </h2>
            
            <div className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    placeholder="New Tournament Name" 
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    value={newTournName}
                    onChange={(e) => setNewTournName(e.target.value)}
                />
                <button 
                    onClick={handleCreateTournament} 
                    disabled={isCreating}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center"
                >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4 mr-1"/>} Create
                </button>
            </div>

            <div className="space-y-3">
                {tournaments.length === 0 && !loading && (
                    <div className="text-center text-gray-500 py-4 italic">No standalone tournaments created.</div>
                )}
                {tournaments.map(tourn => (
                    <div key={tourn.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div 
                            className="bg-gray-50 p-3 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                            onClick={() => setExpandedTournId(expandedTournId === tourn.id ? null : tourn.id!)}
                        >
                            <div className="flex items-center gap-2 font-bold text-gray-700">
                                {expandedTournId === tourn.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                {tourn.name}
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteTournament(tourn.id!); }}
                                className="text-red-400 hover:text-red-600 p-1"
                            >
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                        
                        {expandedTournId === tourn.id && (
                            <div className="p-4 bg-white border-t border-gray-200 animate-slide-up">
                                <div className="flex gap-2 mb-4">
                                    <input 
                                        type="text" 
                                        placeholder="Add Team Name" 
                                        className="flex-1 border rounded px-3 py-1.5 text-sm"
                                        value={newTeamName}
                                        onChange={(e) => setNewTeamName(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleAddTeam}
                                        className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold"
                                    >
                                        Add Team
                                    </button>
                                </div>

                                {loadingTeams ? (
                                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500"/></div>
                                ) : (
                                    <div className="space-y-2">
                                        {teams.length === 0 && <p className="text-xs text-gray-400 text-center">No teams added yet.</p>}
                                        {teams.map(team => (
                                            <div key={team.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                                                <div>
                                                    <span className="font-bold text-sm text-gray-800">{team.name}</span>
                                                    <span className="text-xs text-gray-500 ml-2">({team.players.length} players)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => triggerImport(team.id.toString())}
                                                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-xs flex items-center border border-blue-200"
                                                        title="Import Players from Excel"
                                                    >
                                                        <FileSpreadsheet className="w-3 h-3 mr-1"/> Import
                                                    </button>
                                                    <button onClick={() => handleDeleteTeam(team.id.toString())} className="text-gray-400 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4"/>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Hidden Input for Excel */}
            <input ref={excelInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport}/>
        </div>
    );
};

export default TournamentManager;
