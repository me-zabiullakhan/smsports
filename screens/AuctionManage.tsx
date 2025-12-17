
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer } from '../types';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, AlignLeft, CheckSquare, Search, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';
import firebase from 'firebase/compat/app';

// Helper for image compression
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500;
                const MAX_HEIGHT = 500;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const DEFAULT_REG_CONFIG: RegistrationConfig = {
    isEnabled: false,
    includePayment: false,
    fee: 0,
    upiId: '',
    upiName: '',
    qrCodeUrl: '',
    terms: '1. Registration fee is non-refundable.\n2. Players must report 30 mins before match.\n3. Umpire decision is final.',
    customFields: []
};

const AuctionManage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TEAMS' | 'PLAYERS' | 'REQUESTS' | 'CATEGORIES' | 'SPONSORS' | 'ROLES' | 'REGISTRATION'>('TEAMS');
    const [loading, setLoading] = useState(true);
    const [auction, setAuction] = useState<AuctionSetup | null>(null);

    // Data States
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [categories, setCategories] = useState<AuctionCategory[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [roles, setRoles] = useState<PlayerRole[]>([]);
    const [registrations, setRegistrations] = useState<RegisteredPlayer[]>([]);
    
    // Search States
    const [playerSearch, setPlayerSearch] = useState('');
    const [requestSearch, setRequestSearch] = useState('');

    // Registration State (Local copy for editing)
    const [regConfig, setRegConfig] = useState<RegistrationConfig>(DEFAULT_REG_CONFIG);

    // Settings State
    const [settingsForm, setSettingsForm] = useState({
        title: '',
        date: '',
        sport: '',
        purseValue: 0,
        basePrice: 0,
        bidIncrement: 0,
        playersPerTeam: 0
    });
    const [settingsLogo, setSettingsLogo] = useState('');
    const settingsLogoRef = useRef<HTMLInputElement>(null);

    // Edit/Create States
    const [isEditing, setIsEditing] = useState(false);
    const [editItem, setEditItem] = useState<any>(null); // Generic holder
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qrInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const [previewImage, setPreviewImage] = useState<string>('');

    // Custom Field Builder State
    const [newField, setNewField] = useState<FormField>({ id: '', label: '', type: 'text', required: false });

    // Initial Fetch
    useEffect(() => {
        if (!id) return;
        const fetchAll = async () => {
            try {
                const aucDoc = await db.collection('auctions').doc(id).get();
                if (aucDoc.exists) {
                    const data = aucDoc.data() as AuctionSetup;
                    setAuction(data);
                    if (data.registrationConfig) setRegConfig(data.registrationConfig);
                    
                    // Init Settings Form
                    setSettingsForm({
                        title: data.title || '',
                        date: data.date || '',
                        sport: data.sport || '',
                        purseValue: data.purseValue || 0,
                        basePrice: data.basePrice || 0,
                        bidIncrement: data.bidIncrement || 0,
                        playersPerTeam: data.playersPerTeam || 0
                    });
                    setSettingsLogo(data.logoUrl || '');
                }

                const teamsSnap = await db.collection('auctions').doc(id).collection('teams').get();
                setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));

                const playersSnap = await db.collection('auctions').doc(id).collection('players').get();
                setPlayers(playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));

                const catSnap = await db.collection('auctions').doc(id).collection('categories').get();
                setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCategory)));

                const sponsorSnap = await db.collection('auctions').doc(id).collection('sponsors').get();
                setSponsors(sponsorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor)));

                const roleSnap = await db.collection('auctions').doc(id).collection('roles').get();
                setRoles(roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole)));

                setLoading(false);
            } catch (e) {
                console.error(e);
                setLoading(false);
            }
        };
        fetchAll();
    }, [id]);

    // Fetch Registrations when tab active
    useEffect(() => {
        if (id && activeTab === 'REQUESTS') {
            db.collection('auctions').doc(id).collection('registrations').orderBy('submittedAt', 'desc').get()
                .then(snap => {
                    setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as RegisteredPlayer)));
                });
        }
    }, [id, activeTab]);

    const handleSaveTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const teamData = {
            name: editItem.name,
            budget: Number(editItem.budget),
            logoUrl: previewImage || editItem.logoUrl || '',
            players: editItem.players || [],
            password: editItem.password || ''
        };
        try {
            if (editItem.id) {
                // Update Existing
                await db.collection('auctions').doc(id).collection('teams').doc(editItem.id).update(teamData);
                setTeams(prev => prev.map(t => t.id === editItem.id ? { ...t, ...teamData } : t));
            } else {
                // Create New - Use Global Counter for T001, T002...
                const newTeamResult = await db.runTransaction(async (transaction) => {
                    const counterRef = db.collection('appConfig').doc('globalCounters');
                    const counterDoc = await transaction.get(counterRef);
                    
                    let nextNum = 1;
                    if (counterDoc.exists) {
                        nextNum = (counterDoc.data()?.teamCount || 0) + 1;
                    }
                    
                    const newId = `T${String(nextNum).padStart(3, '0')}`;
                    const newTeamRef = db.collection('auctions').doc(id).collection('teams').doc(newId);
                    
                    transaction.set(counterRef, { teamCount: nextNum }, { merge: true });
                    transaction.set(newTeamRef, { id: newId, ...teamData });
                    
                    return { id: newId, ...teamData };
                });
                
                setTeams(prev => [...prev, newTeamResult as Team]);
            }
            closeModal();
        } catch (err: any) { 
            console.error(err);
            alert("Error saving team: " + err.message); 
        }
    };

    const handleSavePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const playerData = {
            name: editItem.name,
            category: editItem.category,
            role: editItem.role,
            basePrice: Number(editItem.basePrice),
            photoUrl: previewImage || editItem.photoUrl || '',
            nationality: editItem.nationality || 'India',
            status: editItem.status || 'UNSOLD',
            stats: editItem.stats || { matches: 0, runs: 0, wickets: 0 }
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('players').doc(String(editItem.id)).update(playerData);
                setPlayers(prev => prev.map(p => p.id === editItem.id ? { ...p, ...playerData } : p));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('players').doc();
                await newRef.set({ id: newRef.id, ...playerData });
                setPlayers(prev => [...prev, { id: newRef.id, ...playerData } as Player]);
            }
            closeModal();
        } catch (err) { alert("Error saving player"); }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const catData = {
            name: editItem.name,
            basePrice: Number(editItem.basePrice),
            maxPerTeam: Number(editItem.maxPerTeam),
            bidIncrement: Number(editItem.bidIncrement),
            minPerTeam: 0,
            bidLimit: 0,
            slabs: []
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('categories').doc(editItem.id).update(catData);
                setCategories(prev => prev.map(c => c.id === editItem.id ? { ...c, ...catData } : c));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('categories').doc();
                await newRef.set({ id: newRef.id, ...catData });
                setCategories(prev => [...prev, { id: newRef.id, ...catData } as AuctionCategory]);
            }
            closeModal();
        } catch (err) { alert("Error saving category"); }
    };

    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const roleData = {
            name: editItem.name,
            basePrice: Number(editItem.basePrice || 0)
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('roles').doc(editItem.id).update(roleData);
                setRoles(prev => prev.map(r => r.id === editItem.id ? { ...r, ...roleData } : r));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('roles').doc();
                await newRef.set({ id: newRef.id, ...roleData });
                setRoles(prev => [...prev, { id: newRef.id, ...roleData } as PlayerRole]);
            }
            closeModal();
        } catch (err) { alert("Error saving role"); }
    };

    const handleSaveSponsor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const sponsorData = {
            name: editItem.name,
            imageUrl: previewImage || editItem.imageUrl || ''
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('sponsors').doc(editItem.id).update(sponsorData);
                setSponsors(prev => prev.map(s => s.id === editItem.id ? { ...s, ...sponsorData } : s));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('sponsors').doc();
                await newRef.set({ id: newRef.id, ...sponsorData });
                setSponsors(prev => [...prev, { id: newRef.id, ...sponsorData } as Sponsor]);
            }
            closeModal();
        } catch (err) { alert("Error saving sponsor"); }
    };

    const handleSaveRegistrationConfig = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({
                registrationConfig: regConfig,
                bannerUrl: regConfig.bannerUrl // Sync banner to root for ease
            });
            alert("Registration settings saved successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to save settings");
        }
    };

    // --- NEW: Handle Auction Settings Save ---
    const handleSaveSettings = async () => {
        if (!id || !auction) return;
        try {
            const updates = {
                ...settingsForm,
                logoUrl: settingsLogo
            };
            await db.collection('auctions').doc(id).update(updates);
            setAuction({ ...auction, ...updates }); // Optimistic update
            alert("Auction Details Updated!");
        } catch (e: any) {
            console.error(e);
            alert("Failed to update settings: " + e.message);
        }
    };

    const handleApproveRequest = async (reg: RegisteredPlayer) => {
        if (!id || !window.confirm(`Approve ${reg.fullName} and add to auction pool?`)) return;
        try {
            // Create Player Object
            const newPlayer: any = {
                name: reg.fullName,
                category: 'Uncapped', // Default to Uncapped, admin can change later
                role: reg.playerType || 'All Rounder',
                basePrice: auction?.basePrice || 0,
                photoUrl: reg.profilePic || '',
                nationality: 'India',
                status: 'UNSOLD',
                stats: { matches: 0, runs: 0, wickets: 0 },
                speciality: reg.playerType
            };

            // Add to Players Collection
            const playerRef = await db.collection('auctions').doc(id).collection('players').add(newPlayer);
            const playerWithId = { id: playerRef.id, ...newPlayer };

            // Update Registration Status
            await db.collection('auctions').doc(id).collection('registrations').doc(reg.id).update({ status: 'APPROVED' });

            // Update Local State
            setPlayers(prev => [...prev, playerWithId]);
            setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'APPROVED' } : r));
            
            alert("Player Approved!");
        } catch (e: any) {
            console.error(e);
            alert("Error approving player: " + e.message);
        }
    };

    const handleRejectRequest = async (regId: string) => {
        if (!id || !window.confirm("Reject this registration?")) return;
        try {
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).update({ status: 'REJECTED' });
            setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, status: 'REJECTED' } : r));
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleDeleteRequest = async (regId: string) => {
        if (!id || !window.confirm("Permanently delete this request?")) return;
        try {
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).delete();
            setRegistrations(prev => prev.filter(r => r.id !== regId));
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleDelete = async (collection: string, itemId: string) => {
        if (!window.confirm("Are you sure?")) return;
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).collection(collection).doc(String(itemId)).delete();
            if (collection === 'teams') setTeams(prev => prev.filter(t => t.id !== itemId));
            if (collection === 'players') setPlayers(prev => prev.filter(p => p.id !== itemId));
            if (collection === 'categories') setCategories(prev => prev.filter(c => c.id !== itemId));
            if (collection === 'sponsors') setSponsors(prev => prev.filter(s => s.id !== itemId));
            if (collection === 'roles') setRoles(prev => prev.filter(r => r.id !== itemId));
        } catch (e) { alert("Delete failed"); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setPreviewImage(base64);
        }
    };

    const handleRegFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'qrCodeUrl' | 'bannerUrl') => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setRegConfig(prev => ({ ...prev, [field]: base64 }));
        }
    };

    const handleSettingsLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setSettingsLogo(base64);
        }
    };

    const addCustomField = () => {
        if (!newField.label) return alert("Enter Field Label");
        const fieldId = newField.label.toLowerCase().replace(/\s+/g, '_');
        setRegConfig(prev => ({
            ...prev,
            customFields: [...prev.customFields, { ...newField, id: fieldId }]
        }));
        setNewField({ id: '', label: '', type: 'text', required: false });
    };

    const removeCustomField = (idx: number) => {
        setRegConfig(prev => ({
            ...prev,
            customFields: prev.customFields.filter((_, i) => i !== idx)
        }));
    };

    const openModal = (item: any = {}) => {
        setEditItem(item);
        setPreviewImage(item.logoUrl || item.photoUrl || item.imageUrl || '');
        setIsEditing(true);
    };

    const closeModal = () => {
        setIsEditing(false);
        setEditItem(null);
        setPreviewImage('');
    };

    const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()));
    const filteredRequests = registrations.filter(r => r.fullName.toLowerCase().includes(requestSearch.toLowerCase()));

    const Loading = () => <div className="p-10 text-center text-gray-700">Loading...</div>;

    if (loading) return <Loading />;

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-10 text-gray-900">
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-800"><ArrowLeft className="w-5 h-5"/></button>
                        <h1 className="text-lg font-bold text-gray-700 truncate">{auction?.title || 'Manage Auction'}</h1>
                    </div>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto custom-scrollbar">
                        {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'CATEGORIES', 'ROLES', 'SPONSORS', 'REGISTRATION'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab as any)} 
                                className={`px-3 py-1 text-xs font-bold rounded whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                
                {/* SETTINGS TAB */}
                {activeTab === 'SETTINGS' && (
                    <div className="max-w-4xl mx-auto bg-white rounded shadow p-6">
                        <h2 className="text-lg font-bold mb-6 flex items-center border-b pb-2"><Settings className="w-5 h-5 mr-2"/> Auction Settings</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* General Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Auction Title</label>
                                    <input type="text" className="w-full border rounded p-2" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Sport</label>
                                        <select className="w-full border rounded p-2 bg-white" value={settingsForm.sport} onChange={e => setSettingsForm({...settingsForm, sport: e.target.value})}>
                                            <option value="Cricket">Cricket</option>
                                            <option value="Football">Football</option>
                                            <option value="Kabaddi">Kabaddi</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Date</label>
                                        <input type="date" className="w-full border rounded p-2" value={settingsForm.date} onChange={e => setSettingsForm({...settingsForm, date: e.target.value})} />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Auction Logo</label>
                                    <div className="border border-dashed p-4 rounded flex items-center justify-center cursor-pointer hover:bg-gray-50" onClick={() => settingsLogoRef.current?.click()}>
                                        {settingsLogo ? (
                                            <img src={settingsLogo} className="h-24 object-contain" />
                                        ) : (
                                            <div className="text-center text-gray-400 text-sm">
                                                <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                                                Click to Upload
                                            </div>
                                        )}
                                        <input ref={settingsLogoRef} type="file" accept="image/*" className="hidden" onChange={handleSettingsLogoChange} />
                                    </div>
                                </div>
                            </div>

                            {/* Rules & Budget */}
                            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="font-bold text-sm text-gray-500 uppercase">Auction Rules</h3>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Default Team Purse</label>
                                    <input type="number" className="w-full border rounded p-2" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                    <p className="text-xs text-gray-400 mt-1">Changes here affect new teams or resets only.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Base Price</label>
                                        <input type="number" className="w-full border rounded p-2" value={settingsForm.basePrice} onChange={e => setSettingsForm({...settingsForm, basePrice: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Bid Increment</label>
                                        <input type="number" className="w-full border rounded p-2" value={settingsForm.bidIncrement} onChange={e => setSettingsForm({...settingsForm, bidIncrement: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Max Players Per Team</label>
                                    <input type="number" className="w-full border rounded p-2" value={settingsForm.playersPerTeam} onChange={e => setSettingsForm({...settingsForm, playersPerTeam: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t flex justify-end">
                            <button onClick={handleSaveSettings} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded shadow flex items-center">
                                <Save className="w-4 h-4 mr-2"/> Save Changes
                            </button>
                        </div>
                    </div>
                )}

                {/* TEAMS TAB */}
                {activeTab === 'TEAMS' && (
                    <div className="bg-white rounded shadow p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5"/> Teams ({teams.length})</h2>
                            <button onClick={() => openModal({ name: '', budget: auction?.purseValue || 10000 })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Add Team</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teams.map(t => (
                                <div key={t.id} className="border rounded p-3 flex items-center gap-3 relative group hover:shadow-md transition-shadow">
                                    <img src={t.logoUrl || 'https://via.placeholder.com/50'} className="w-12 h-12 object-contain bg-gray-100 rounded-full" />
                                    <div>
                                        <h3 className="font-bold text-gray-800">{t.name}</h3>
                                        <p className="text-xs text-gray-500 font-mono mb-0.5">ID: <span className="select-all font-bold">{t.id}</span></p>
                                        <p className="text-xs text-gray-500">Budget: {t.budget}</p>
                                    </div>
                                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                                        <button onClick={() => openModal(t)} className="p-1 text-blue-500 bg-blue-50 rounded"><Edit className="w-3 h-3"/></button>
                                        <button onClick={() => handleDelete('teams', String(t.id))} className="p-1 text-red-500 bg-red-50 rounded"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PLAYERS TAB */}
                {activeTab === 'PLAYERS' && (
                    <div className="bg-white rounded shadow p-4">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5"/> Players ({players.length})</h2>
                            <div className="flex gap-2 w-full md:w-auto">
                                <div className="relative flex-grow md:flex-grow-0">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Search players..." 
                                        className="w-full md:w-64 border rounded pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                        value={playerSearch}
                                        onChange={(e) => setPlayerSearch(e.target.value)}
                                    />
                                </div>
                                <button onClick={() => openModal({ name: '', basePrice: auction?.basePrice || 20, category: 'Uncapped', role: 'All Rounder' })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Add Player</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                        <th className="p-2">Name</th>
                                        <th className="p-2">Category</th>
                                        <th className="p-2">Role</th>
                                        <th className="p-2">Base Price</th>
                                        <th className="p-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPlayers.length > 0 ? filteredPlayers.map(p => (
                                        <tr key={p.id} className="border-b hover:bg-gray-50">
                                            <td className="p-2 flex items-center gap-2">
                                                <img src={p.photoUrl || 'https://via.placeholder.com/30'} className="w-8 h-8 rounded-full object-cover"/>
                                                {p.name}
                                            </td>
                                            <td className="p-2">{p.category}</td>
                                            <td className="p-2">{p.role}</td>
                                            <td className="p-2">{p.basePrice}</td>
                                            <td className="p-2 text-right">
                                                <button onClick={() => openModal(p)} className="text-blue-500 mr-2"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => handleDelete('players', String(p.id))} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="p-4 text-center text-gray-400 italic">No players found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* REQUESTS TAB */}
                {activeTab === 'REQUESTS' && (
                    <div className="bg-white rounded shadow p-4">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Clock className="w-5 h-5"/> Registration Requests ({registrations.length})</h2>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search requests..." 
                                    className="w-full border rounded pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                    value={requestSearch}
                                    onChange={(e) => setRequestSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                        <th className="p-3">Player</th>
                                        <th className="p-3">Details</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.map(r => (
                                        <tr key={r.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3 flex items-center gap-3">
                                                {r.profilePic ? <img src={r.profilePic} className="w-10 h-10 rounded-full object-cover border"/> : <div className="w-10 h-10 bg-gray-200 rounded-full"/>}
                                                <div>
                                                    <div className="font-bold">{r.fullName}</div>
                                                    <div className="text-xs text-gray-500">{r.mobile}</div>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="text-xs">
                                                    <span className="font-bold">Role:</span> {r.playerType} <br/>
                                                    <span className="font-bold">DOB:</span> {r.dob}
                                                </div>
                                                {r.paymentScreenshot && (
                                                    <a href={r.paymentScreenshot} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline mt-1 block">View Payment</a>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                {r.status === 'PENDING' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleApproveRequest(r)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Approve"><CheckCircle className="w-5 h-5"/></button>
                                                        <button onClick={() => handleRejectRequest(r.id)} className="text-red-600 hover:bg-red-50 p-1 rounded" title="Reject"><XCircle className="w-5 h-5"/></button>
                                                    </div>
                                                )}
                                                {r.status !== 'PENDING' && (
                                                    <button onClick={() => handleDeleteRequest(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredRequests.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-400 italic">No pending requests found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* CATEGORIES TAB */}
                {activeTab === 'CATEGORIES' && (
                    <div className="bg-white rounded shadow p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Layers className="w-5 h-5"/> Categories</h2>
                            <button onClick={() => openModal({ name: '', basePrice: 20, maxPerTeam: 0, bidIncrement: 10 })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Add Category</button>
                        </div>
                        <div className="grid gap-2">
                             {categories.map(c => (
                                 <div key={c.id} className="border p-3 rounded flex justify-between items-center hover:bg-gray-50">
                                     <div>
                                         <h3 className="font-bold text-gray-800">{c.name}</h3>
                                         <p className="text-xs text-gray-500">Base: {c.basePrice} | Max/Team: {c.maxPerTeam > 0 ? c.maxPerTeam : 'No Limit'} | Inc: {c.bidIncrement}</p>
                                     </div>
                                     <div className="flex gap-2">
                                         <button onClick={() => openModal(c)} className="text-blue-500"><Edit className="w-4 h-4"/></button>
                                         <button onClick={() => handleDelete('categories', String(c.id))} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    </div>
                )}

                {/* ROLES TAB */}
                {activeTab === 'ROLES' && (
                    <div className="bg-white rounded shadow p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Briefcase className="w-5 h-5"/> Player Roles</h2>
                            <button onClick={() => openModal({ name: '' })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Add Role</button>
                        </div>
                        <div className="grid gap-2">
                             {roles.length > 0 ? roles.map(r => (
                                 <div key={r.id} className="border p-3 rounded flex justify-between items-center hover:bg-gray-50">
                                     <div>
                                         <h3 className="font-bold text-gray-800">{r.name}</h3>
                                         {r.basePrice ? <p className="text-xs text-gray-500">Default Base: {r.basePrice}</p> : null}
                                     </div>
                                     <div className="flex gap-2">
                                         <button onClick={() => openModal(r)} className="text-blue-500"><Edit className="w-4 h-4"/></button>
                                         <button onClick={() => handleDelete('roles', String(r.id))} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                                     </div>
                                 </div>
                             )) : <p className="text-gray-400 italic text-center p-4">No roles defined. (e.g. Batsman, Bowler)</p>}
                        </div>
                    </div>
                )}

                {/* SPONSORS TAB */}
                {activeTab === 'SPONSORS' && (
                    <div className="bg-white rounded shadow p-4">
                         <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"><DollarSign className="w-5 h-5"/> Sponsors</h2>
                            <button onClick={() => openModal({ name: '' })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Add Sponsor</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {sponsors.map(s => (
                                <div key={s.id} className="border rounded p-3 text-center relative group">
                                    <img src={s.imageUrl} className="h-20 w-full object-contain mb-2"/>
                                    <p className="font-bold text-sm text-gray-800">{s.name}</p>
                                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-1 bg-white p-1 rounded shadow">
                                        <button onClick={() => openModal(s)} className="text-blue-500"><Edit className="w-3 h-3"/></button>
                                        <button onClick={() => handleDelete('sponsors', s.id)} className="text-red-500"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* REGISTRATION TAB */}
                {activeTab === 'REGISTRATION' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Settings Column */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* General Settings */}
                            <div className="bg-white rounded shadow p-6">
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center"><Settings className="w-5 h-5 mr-2"/> General Config</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
                                        <span className="font-semibold">Enable Registration Page</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={regConfig.isEnabled} onChange={e => setRegConfig({...regConfig, isEnabled: e.target.checked})} />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Registration Fee (₹)</label>
                                        <input type="number" className="w-full border rounded p-2" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="payToggle" checked={regConfig.includePayment} onChange={e => setRegConfig({...regConfig, includePayment: e.target.checked})} className="w-4 h-4"/>
                                        <label htmlFor="payToggle" className="text-sm font-semibold select-none cursor-pointer">Require Payment Screenshot</label>
                                    </div>
                                    {regConfig.includePayment && (
                                        <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-600 mb-1">UPI ID</label>
                                                <input type="text" className="w-full border rounded p-2" value={regConfig.upiId} onChange={e => setRegConfig({...regConfig, upiId: e.target.value})} placeholder="e.g. 9876543210@upi" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-600 mb-1">Payee Name</label>
                                                <input type="text" className="w-full border rounded p-2" value={regConfig.upiName} onChange={e => setRegConfig({...regConfig, upiName: e.target.value})} placeholder="e.g. John Doe" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Terms & Images */}
                            <div className="bg-white rounded shadow p-6">
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center"><FileText className="w-5 h-5 mr-2"/> Content & Terms</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Terms & Conditions</label>
                                        <textarea rows={4} className="w-full border rounded p-2 text-sm" value={regConfig.terms} onChange={e => setRegConfig({...regConfig, terms: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-600 mb-1">Tournament Banner</label>
                                            <div onClick={() => bannerInputRef.current?.click()} className="border border-dashed p-4 text-center cursor-pointer hover:bg-gray-50 rounded">
                                                {regConfig.bannerUrl ? <img src={regConfig.bannerUrl} className="h-16 mx-auto object-contain" /> : <span className="text-gray-400 text-xs">Upload Banner</span>}
                                                <input ref={bannerInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleRegFileChange(e, 'bannerUrl')} />
                                            </div>
                                        </div>
                                        {regConfig.includePayment && (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-600 mb-1">UPI QR Code</label>
                                                <div onClick={() => qrInputRef.current?.click()} className="border border-dashed p-4 text-center cursor-pointer hover:bg-gray-50 rounded">
                                                    {regConfig.qrCodeUrl ? <img src={regConfig.qrCodeUrl} className="h-16 mx-auto object-contain" /> : <div className="flex flex-col items-center text-gray-400 text-xs"><QrCode className="w-6 h-6 mb-1"/>Upload QR</div>}
                                                    <input ref={qrInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleRegFileChange(e, 'qrCodeUrl')} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Custom Fields Column */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded shadow p-6 h-full flex flex-col">
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center"><AlignLeft className="w-5 h-5 mr-2"/> Custom Fields</h3>
                                <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                                    {regConfig.customFields.map((field, idx) => (
                                        <div key={idx} className="bg-gray-50 p-2 rounded border flex justify-between items-center text-sm">
                                            <div>
                                                <p className="font-bold">{field.label}</p>
                                                <p className="text-xs text-gray-500 uppercase">{field.type} {field.required ? '(Required)' : ''}</p>
                                            </div>
                                            <button onClick={() => removeCustomField(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                    {regConfig.customFields.length === 0 && <p className="text-gray-400 text-sm italic text-center py-4">No custom fields added.</p>}
                                </div>
                                <div className="bg-gray-100 p-3 rounded border">
                                    <input type="text" placeholder="Field Label (e.g. Jersey No)" className="w-full border rounded p-1.5 text-sm mb-2" value={newField.label} onChange={e => setNewField({...newField, label: e.target.value})} />
                                    <div className="flex gap-2 mb-2">
                                        <select className="flex-1 border rounded p-1.5 text-sm" value={newField.type} onChange={e => setNewField({...newField, type: e.target.value as any})}>
                                            <option value="text">Text</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="file">File Upload</option>
                                            <option value="select">Dropdown</option>
                                        </select>
                                        {newField.type === 'select' && <span className="text-xs text-red-500 flex items-center" title="Options managed in code for now">*</span>}
                                    </div>
                                    <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                                        <input type="checkbox" checked={newField.required} onChange={e => setNewField({...newField, required: e.target.checked})} /> Required
                                    </label>
                                    <button onClick={addCustomField} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded">Add Field</button>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="lg:col-span-3">
                            <button onClick={handleSaveRegistrationConfig} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded shadow-lg flex items-center justify-center text-lg">
                                <Save className="w-6 h-6 mr-2" /> Save Configuration
                            </button>
                        </div>
                    </div>
                )}

            </main>

            {/* MODALS */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editItem.id ? 'Edit' : 'Add'} {activeTab === 'ROLES' ? 'Role' : activeTab.slice(0, -1)}
                            </h3>
                            <button onClick={closeModal}><X className="w-5 h-5 text-gray-500"/></button>
                        </div>
                        
                        <form onSubmit={activeTab === 'TEAMS' ? handleSaveTeam : activeTab === 'PLAYERS' ? handleSavePlayer : activeTab === 'CATEGORIES' ? handleSaveCategory : activeTab === 'SPONSORS' ? handleSaveSponsor : handleSaveRole} className="space-y-4">
                            
                            {/* COMMON NAME FIELD */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                                <input required type="text" className="w-full border rounded p-2 text-gray-900" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} />
                            </div>

                            {/* IMAGE UPLOAD (Teams, Players, Sponsors) */}
                            {(activeTab === 'TEAMS' || activeTab === 'PLAYERS' || activeTab === 'SPONSORS') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Image</label>
                                    <div onClick={() => fileInputRef.current?.click()} className="border border-dashed rounded p-4 text-center cursor-pointer hover:bg-gray-50">
                                        {previewImage ? <img src={previewImage} className="h-20 mx-auto object-contain"/> : <div className="text-gray-400"><Upload className="w-6 h-6 mx-auto mb-1"/>Upload Image</div>}
                                    </div>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                </div>
                            )}

                            {/* TEAMS SPECIFIC */}
                            {activeTab === 'TEAMS' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Budget</label>
                                        <input type="number" className="w-full border rounded p-2 text-gray-900" value={editItem.budget} onChange={e => setEditItem({...editItem, budget: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Login Password</label>
                                        <input type="text" className="w-full border rounded p-2 text-gray-900" value={editItem.password} onChange={e => setEditItem({...editItem, password: e.target.value})} placeholder="Optional" />
                                    </div>
                                </>
                            )}

                            {/* PLAYERS SPECIFIC */}
                            {activeTab === 'PLAYERS' && (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Role</label>
                                            <select className="w-full border rounded p-2 text-gray-900" value={editItem.role} onChange={e => setEditItem({...editItem, role: e.target.value})}>
                                                <option value="Batsman">Batsman</option>
                                                <option value="Bowler">Bowler</option>
                                                <option value="All Rounder">All Rounder</option>
                                                <option value="Wicket Keeper">Wicket Keeper</option>
                                                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                                            <select className="w-full border rounded p-2 text-gray-900" value={editItem.category} onChange={e => setEditItem({...editItem, category: e.target.value})}>
                                                <option value="Uncapped">Uncapped</option>
                                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Base Price</label>
                                        <input type="number" className="w-full border rounded p-2 text-gray-900" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: e.target.value})} />
                                    </div>
                                </>
                            )}

                            {/* CATEGORIES SPECIFIC */}
                            {activeTab === 'CATEGORIES' && (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Base Price</label>
                                            <input type="number" className="w-full border rounded p-2 text-gray-900" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Max Per Team</label>
                                            <input type="number" className="w-full border rounded p-2 text-gray-900" value={editItem.maxPerTeam} onChange={e => setEditItem({...editItem, maxPerTeam: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Bid Increment</label>
                                            <input type="number" className="w-full border rounded p-2 text-gray-900" value={editItem.bidIncrement} onChange={e => setEditItem({...editItem, bidIncrement: e.target.value})} />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ROLES SPECIFIC */}
                            {activeTab === 'ROLES' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Default Base Price (Optional)</label>
                                    <input type="number" className="w-full border rounded p-2 text-gray-900" value={editItem.basePrice || 0} onChange={e => setEditItem({...editItem, basePrice: e.target.value})} placeholder="0" />
                                </div>
                            )}

                            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 shadow">Save</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuctionManage;
