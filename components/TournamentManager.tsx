
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { Tournament, Team, Player } from '../types';
import { Plus, Trash2, Save, FileSpreadsheet, Loader2, ChevronDown, ChevronRight, UserPlus, Users, X, Image as ImageIcon, Upload, Crop, ZoomIn, Check } from 'lucide-react';
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

    // Manual Player Add State
    const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
    const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
    const [manualPlayerName, setManualPlayerName] = useState('');
    const [manualPlayerPhoto, setManualPlayerPhoto] = useState('');
    const [isAddingPlayer, setIsAddingPlayer] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // --- CROPPER STATE ---
    const [cropImage, setCropImage] = useState<string | null>(null);
    const [cropZoom, setCropZoom] = useState(1);
    const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

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
        // Ensure we have a file, a tournament selected, and a target team ID
        if (!file || !expandedTournId || !importingTeamId) return;

        try {
            const data = await file.arrayBuffer();
            // Important: Specify type: 'array' for arrayBuffer
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("File empty or invalid format");
                return;
            }

            const newPlayers: Player[] = jsonData.map((row: any) => {
                // Support multiple column names for Name
                const name = row['Name'] || row['name'] || row['Player Name'];
                if (!name) return null;

                return {
                    id: db.collection('dummy').doc().id,
                    name: String(name),
                    role: row['Role'] || row['role'] || 'General',
                    category: row['Category'] || row['category'] || 'Standard',
                    basePrice: Number(row['Base Price'] || 0),
                    photoUrl: '',
                    nationality: 'India',
                    speciality: row['Role'] || 'General',
                    stats: { matches: 0, runs: 0, wickets: 0 },
                    status: 'SOLD',
                    soldPrice: Number(row['Sold Price'] || row['Price'] || 0)
                };
            }).filter(p => p !== null) as Player[];

            if (newPlayers.length === 0) {
                alert("No valid players found in Excel. Check column headers (Name, Role, Category).");
                return;
            }

            // Fetch current team to append
            const teamRef = db.collection('tournaments').doc(expandedTournId).collection('teams').doc(importingTeamId);
            const teamDoc = await teamRef.get();
            if (teamDoc.exists) {
                const currentPlayers = (teamDoc.data() as Team).players || [];
                await teamRef.update({
                    players: [...currentPlayers, ...newPlayers]
                });
                alert(`Successfully added ${newPlayers.length} players to team.`);
            } else {
                alert("Team not found in database.");
            }
        } catch (err: any) {
            console.error("Import Error", err);
            alert("Import Failed: " + err.message);
        } finally {
            if (excelInputRef.current) excelInputRef.current.value = '';
            setImportingTeamId(null);
        }
    };

    const triggerImport = (teamId: string) => {
        setImportingTeamId(teamId);
        // Small timeout to ensure state update propagates before click
        setTimeout(() => {
            if (excelInputRef.current) {
                excelInputRef.current.click();
            }
        }, 100);
    };

    // Manual Player Functions
    const openAddPlayerModal = (teamId: string) => {
        setTargetTeamId(teamId);
        setManualPlayerName('');
        setManualPlayerPhoto('');
        setShowAddPlayerModal(true);
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5000 * 1024) { // 5MB limit
                alert("Image too large (Max 5MB)");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                // Initialize Cropper
                setCropImage(reader.result as string);
                setCropZoom(1);
                setCropOffset({ x: 0, y: 0 });
            };
            reader.readAsDataURL(file);
        }
    };

    // --- CROPPER HANDLERS ---
    const handleCropMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setDragStart({ x: clientX - cropOffset.x, y: clientY - cropOffset.y });
    };

    const handleCropMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setCropOffset({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y
        });
    };

    const handleCropMouseUp = () => {
        setIsDragging(false);
    };

    const performCrop = () => {
        if (!cropImage || !imgRef.current) return;

        const canvas = document.createElement('canvas');
        const size = 300; // Final output size
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            const img = imgRef.current;
            
            // Logic to map the visual crop to the canvas
            // The container is fixed size (e.g. 250px). The image scale is applied via CSS.
            // We need to replicate that on the canvas.
            
            // Container size in the DOM (approximate, hardcoded to match UI)
            const CONTAINER_SIZE = 250; 
            
            // Calculate scale relative to the container
            // We want to draw the image such that the visible area in the container is drawn 1:1 on the canvas (scaled to output size)
            
            // Effective scale of the image in the container
            const scale = cropZoom; 
            
            // Position
            const x = cropOffset.x;
            const y = cropOffset.y;

            // Draw logic:
            // 1. Clear background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);

            // 2. We want to draw the portion of the image visible in the CONTAINER_SIZE window onto the `size` canvas
            // Ratio between output canvas and UI container
            const ratio = size / CONTAINER_SIZE;

            ctx.translate(size / 2, size / 2);
            ctx.translate(x * ratio, y * ratio);
            ctx.scale(scale * ratio, scale * ratio);
            
            // Center image drawing
            // Determine draw size. If we fit width:
            const drawWidth = CONTAINER_SIZE;
            const drawHeight = (img.naturalHeight / img.naturalWidth) * CONTAINER_SIZE;
            
            // If the image is vertical/horizontal, we usually fit the smaller dimension or just fit width. 
            // In the UI we usually do `width: 100%`.
            // Let's assume `width: 100%` of container for the base image size before zoom.
            
            ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

            setManualPlayerPhoto(canvas.toDataURL('image/jpeg', 0.8));
            setCropImage(null); // Close cropper
        }
    };

    const saveManualPlayer = async () => {
        if (!expandedTournId || !targetTeamId || !manualPlayerName.trim()) return;
        
        setIsAddingPlayer(true);
        try {
            const teamRef = db.collection('tournaments').doc(expandedTournId).collection('teams').doc(targetTeamId);
            const teamDoc = await teamRef.get();
            
            if (teamDoc.exists) {
                const currentPlayers = (teamDoc.data() as Team).players || [];
                
                const newPlayer: Player = {
                    id: db.collection('dummy').doc().id,
                    name: manualPlayerName,
                    role: 'General', 
                    category: 'Standard', 
                    basePrice: 0,
                    photoUrl: manualPlayerPhoto,
                    nationality: 'India',
                    speciality: 'General',
                    stats: { matches: 0, runs: 0, wickets: 0 },
                    status: 'SOLD',
                    soldPrice: 0
                };

                await teamRef.update({
                    players: [...currentPlayers, newPlayer]
                });
                
                setShowAddPlayerModal(false);
            }
        } catch (e: any) {
            console.error(e);
            alert("Error adding player: " + e.message);
        } finally {
            setIsAddingPlayer(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
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
                                            <div key={team.id} className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 gap-2">
                                                <div className="flex-1">
                                                    <span className="font-bold text-sm text-gray-800">{team.name}</span>
                                                    <span className="text-xs text-gray-500 ml-2">({team.players.length} players)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => openAddPlayerModal(team.id.toString())}
                                                        className="bg-white text-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs flex items-center border border-green-200 font-bold shadow-sm"
                                                        title="Add Player Manually"
                                                    >
                                                        <UserPlus className="w-3 h-3 mr-1"/> Add
                                                    </button>
                                                    <button 
                                                        onClick={() => triggerImport(team.id.toString())}
                                                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-xs flex items-center border border-blue-200"
                                                        title="Import Players from Excel"
                                                    >
                                                        <FileSpreadsheet className="w-3 h-3 mr-1"/> Import
                                                    </button>
                                                    <button onClick={() => handleDeleteTeam(team.id.toString())} className="text-gray-400 hover:text-red-500 p-1">
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

            {/* CROPPER MODAL */}
            {cropImage && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-lg shadow-2xl p-4 w-full max-w-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center"><Crop className="w-4 h-4 mr-2"/> Adjust Image</h3>
                            <button onClick={() => setCropImage(null)} className="text-gray-500 hover:text-red-500"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div 
                            className="relative w-[250px] h-[250px] mx-auto bg-gray-100 overflow-hidden border-2 border-dashed border-gray-300 rounded-lg cursor-move"
                            onMouseDown={handleCropMouseDown}
                            onMouseMove={handleCropMouseMove}
                            onMouseUp={handleCropMouseUp}
                            onMouseLeave={handleCropMouseUp}
                            onTouchStart={handleCropMouseDown}
                            onTouchMove={handleCropMouseMove}
                            onTouchEnd={handleCropMouseUp}
                        >
                            <img 
                                ref={imgRef}
                                src={cropImage} 
                                alt="Crop Target"
                                className="absolute max-w-none"
                                draggable={false}
                                style={{
                                    width: '100%', // Fit width initially
                                    transformOrigin: 'center',
                                    transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                }}
                            />
                            {/* Grid Overlay */}
                            <div className="absolute inset-0 pointer-events-none opacity-30">
                                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                                    {[...Array(9)].map((_,i) => <div key={i} className="border border-gray-400"></div>)}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                            <ZoomIn className="w-4 h-4 text-gray-500"/>
                            <input 
                                type="range" 
                                min="1" 
                                max="3" 
                                step="0.1" 
                                value={cropZoom} 
                                onChange={e => setCropZoom(Number(e.target.value))}
                                className="flex-1 accent-blue-600"
                            />
                        </div>

                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setCropImage(null)} className="flex-1 py-2 text-gray-600 border rounded font-bold text-sm">Cancel</button>
                            <button onClick={performCrop} className="flex-1 py-2 bg-blue-600 text-white rounded font-bold text-sm flex items-center justify-center">
                                <Check className="w-4 h-4 mr-1"/> Crop & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANUAL PLAYER MODAL */}
            {showAddPlayerModal && !cropImage && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
                        <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">Add Player to Team</h3>
                            <button onClick={() => setShowAddPlayerModal(false)} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="p-4 space-y-4">
                            <div className="flex flex-col items-center">
                                <div 
                                    onClick={() => photoInputRef.current?.click()}
                                    className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden relative group"
                                >
                                    {manualPlayerPhoto ? (
                                        <img src={manualPlayerPhoto} alt="Preview" className="w-full h-full object-cover"/>
                                    ) : (
                                        <div className="text-center text-gray-400">
                                            <ImageIcon className="w-8 h-8 mx-auto mb-1"/>
                                            <span className="text-[10px]">Photo</span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 w-full bg-black/50 text-white text-[9px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Edit/Upload</div>
                                </div>
                                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect}/>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Player Name</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Enter full name"
                                    value={manualPlayerName}
                                    onChange={(e) => setManualPlayerName(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={saveManualPlayer}
                                disabled={isAddingPlayer || !manualPlayerName.trim()}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isAddingPlayer ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Add Player'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentManager;
