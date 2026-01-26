import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab } from '../types';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, AlignLeft, CheckSquare, Square, Palette, ChevronDown, Search, CheckCircle, XCircle, Clock, Calendar, Info, ListPlus, Eye, EyeOff, Copy, Link as LinkIcon, Check as CheckIcon, ShieldCheck, Tag, User, TrendingUp } from 'lucide-react';
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
    isPublic: true,
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
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TEAMS' | 'PLAYERS' | 'REQUESTS' | 'CATEGORIES' | 'SPONSORS' | 'ROLES' | 'REGISTRATION'>('SETTINGS');
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

    // Registration State
    const [regConfig, setRegConfig] = useState<RegistrationConfig>(DEFAULT_REG_CONFIG);

    // Settings State
    const [settingsForm, setSettingsForm] = useState({
        title: '',
        date: '',
        sport: '',
        purseValue: 0,
        basePrice: 0,
        bidIncrement: 0,
        playersPerTeam: 0,
        totalTeams: 0
    });
    const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);
    const [newSlab, setNewSlab] = useState<{from: string, increment: string}>({from: '', increment: ''});
    const [settingsLogo, setSettingsLogo] = useState('');
    const settingsLogoRef = useRef<HTMLInputElement>(null);

    // Edit/Create States
    const [isEditing, setIsEditing] = useState(false);
    const [editItem, setEditItem] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewImage, setPreviewImage] = useState<string>('');

    useEffect(() => {
        if (!id) return;
        const fetchAll = async () => {
            try {
                const aucDoc = await db.collection('auctions').doc(id).get();
                if (aucDoc.exists) {
                    const data = aucDoc.data() as AuctionSetup;
                    setAuction(data);
                    if (data.registrationConfig) setRegConfig({ ...DEFAULT_REG_CONFIG, ...data.registrationConfig });
                    setSettingsForm({
                        title: data.title || '',
                        date: data.date || '',
                        sport: data.sport || '',
                        purseValue: data.purseValue || 0,
                        basePrice: data.basePrice || 0,
                        bidIncrement: data.bidIncrement || 0,
                        playersPerTeam: data.playersPerTeam || 0,
                        totalTeams: data.totalTeams || 0
                    });
                    setSettingsLogo(data.logoUrl || '');
                    if (data.slabs) setSlabs(data.slabs);
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

    useEffect(() => {
        if (id && activeTab === 'REQUESTS') {
            db.collection('auctions').doc(id).collection('registrations').orderBy('submittedAt', 'desc').get()
                .then(snap => {
                    setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as RegisteredPlayer)));
                });
        }
    }, [id, activeTab]);

    const addSlab = () => {
        const fromVal = Number(newSlab.from);
        const incVal = Number(newSlab.increment);
        if (fromVal >= 0 && incVal > 0) {
            setSlabs(prev => [...prev, { from: fromVal, increment: incVal }]);
            setNewSlab({ from: '', increment: '' });
        }
    };

    const removeSlab = (index: number) => {
        setSlabs(prev => prev.filter((_, i) => i !== index));
    };

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
                await db.collection('auctions').doc(id).collection('teams').doc(editItem.id).update(teamData);
                setTeams(prev => prev.map(t => t.id === editItem.id ? { ...t, ...teamData } : t));
            } else {
                const newTeamResult = await db.runTransaction(async (transaction) => {
                    const counterRef = db.collection('appConfig').doc('globalCounters');
                    const counterDoc = await transaction.get(counterRef);
                    let nextNum = 1;
                    if (counterDoc.exists) nextNum = (counterDoc.data()?.teamCount || 0) + 1;
                    const newId = `T${String(nextNum).padStart(3, '0')}`;
                    const newTeamRef = db.collection('auctions').doc(id).collection('teams').doc(newId);
                    transaction.set(counterRef, { teamCount: nextNum }, { merge: true });
                    transaction.set(newTeamRef, { id: newId, ...teamData });
                    return { id: newId, ...teamData };
                });
                setTeams(prev => [...prev, newTeamResult as Team]);
            }
            closeModal();
        } catch (err: any) { alert("Error saving team: " + err.message); }
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
            basePrice: Number(editItem.basePrice)
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

    const handleSaveSettings = async () => {
        if (!id || !auction) return;
        try {
            const updates = {
                ...settingsForm,
                logoUrl: settingsLogo,
                slabs: slabs,
                totalTeams: Number(settingsForm.totalTeams)
            };
            await db.collection('auctions').doc(id).update(updates);
            setAuction({ ...auction, ...updates });
            alert("Auction Details Updated!");
        } catch (e: any) {
            console.error(e);
            alert("Failed to update settings: " + e.message);
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

    const handleSettingsLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setSettingsLogo(base64);
        }
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

    if (loading) return <div className="p-10 text-center text-gray-700">Loading Management Console...</div>;

    const rolesList = roles.length > 0 ? roles.map(r => r.name) : ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'];
    const categoriesList = categories.length > 0 ? categories.map(c => c.name) : ['Uncapped'];

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

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                
                {activeTab === 'SETTINGS' && (
                    <div className="bg-white rounded-xl shadow p-6 border border-gray-200 space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800 border-b pb-3 mb-6">
                                <Settings className="w-5 h-5 text-blue-500"/> Auction Configuration
                            </h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Auction Title</label>
                                        <input type="text" className="w-full border rounded-lg p-2.5 bg-gray-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-500" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sport</label>
                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                            {['Cricket', 'Football', 'Kabaddi'].map(s => (
                                                <button 
                                                    key={s}
                                                    onClick={() => setSettingsForm({...settingsForm, sport: s})}
                                                    className={`flex-1 py-2 rounded-md text-xs font-black transition-all ${settingsForm.sport === s ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-700'}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Purse Value</label>
                                            <input type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Teams</label>
                                            <input 
                                                type="number" 
                                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                                                value={settingsForm.totalTeams} 
                                                onChange={e => setSettingsForm({...settingsForm, totalTeams: Number(e.target.value)})}
                                                min="1"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-center">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 w-full text-left">Auction Logo</label>
                                    <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative bg-gray-50 group hover:border-blue-300 transition-colors">
                                        {settingsLogo ? (
                                            <img src={settingsLogo} className="w-full h-full object-contain" />
                                        ) : (
                                            <ImageIcon className="w-10 h-10 text-gray-300" />
                                        )}
                                        <div onClick={() => settingsLogoRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                            <Upload className="text-white w-6 h-6" />
                                        </div>
                                    </div>
                                    <input ref={settingsLogoRef} type="file" className="hidden" accept="image/*" onChange={handleSettingsLogoChange} />
                                </div>
                            </div>
                        </div>

                        {/* Bid Increment Slabs Section - Added back as requested */}
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                             <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" /> Global Bid Increment Slabs
                             </h3>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-3">
                                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                         <label className="block text-[10px] font-black text-gray-400 uppercase mb-3">Add New Bid Rule</label>
                                         <div className="grid grid-cols-2 gap-3 mb-4">
                                             <div>
                                                 <label className="block text-[10px] font-bold text-gray-500 mb-1">When Price >=</label>
                                                 <input 
                                                    type="number" 
                                                    placeholder="e.g. 500" 
                                                    className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" 
                                                    value={newSlab.from} 
                                                    onChange={e => setNewSlab({...newSlab, from: e.target.value})} 
                                                 />
                                             </div>
                                             <div>
                                                 <label className="block text-[10px] font-bold text-gray-500 mb-1">Increment by</label>
                                                 <input 
                                                    type="number" 
                                                    placeholder="e.g. 50" 
                                                    className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" 
                                                    value={newSlab.increment} 
                                                    onChange={e => setNewSlab({...newSlab, increment: e.target.value})} 
                                                 />
                                             </div>
                                         </div>
                                         <button 
                                            type="button" 
                                            onClick={addSlab} 
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                                         >
                                             <Plus className="w-4 h-4"/> Add Increment Rule
                                         </button>
                                     </div>
                                     <p className="text-[10px] text-gray-400 leading-relaxed bg-blue-50 p-3 rounded-lg border border-blue-100">
                                         <b>How it works:</b> If current bid is 500 and you have a rule "From 500: +50", the next button will show 550. If multiple rules match, the highest matching "From" value is used.
                                     </p>
                                 </div>

                                 <div className="space-y-2">
                                     <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Rules ({slabs.length})</label>
                                     <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                         {slabs.length > 0 ? slabs.sort((a,b) => a.from - b.from).map((slab, idx) => (
                                             <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 group hover:border-blue-400 transition-all shadow-sm">
                                                 <div className="flex items-center gap-4">
                                                     <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-[10px]">{idx + 1}</div>
                                                     <div className="flex flex-col">
                                                         <span className="text-[10px] text-gray-400 font-bold uppercase">Price Range</span>
                                                         <span className="text-xs font-black text-gray-800">Above {slab.from}</span>
                                                     </div>
                                                     <div className="w-px h-6 bg-gray-100 mx-2"></div>
                                                     <div className="flex flex-col">
                                                         <span className="text-[10px] text-gray-400 font-bold uppercase">Increment</span>
                                                         <span className="text-xs font-black text-emerald-600">+{slab.increment}</span>
                                                     </div>
                                                 </div>
                                                 <button 
                                                    type="button" 
                                                    onClick={() => removeSlab(idx)} 
                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                 >
                                                     <Trash2 className="w-4 h-4"/>
                                                 </button>
                                             </div>
                                         )) : (
                                             <div className="h-[200px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 italic text-xs">
                                                 <TrendingUp className="w-8 h-8 mb-2 opacity-10" />
                                                 No custom slab rules defined
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             </div>
                        </div>

                        <div className="pt-6 border-t">
                            <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transition-all active:scale-95">
                                <Save className="w-5 h-5"/> Update Configuration
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'TEAMS' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Teams List ({teams.length})</h2>
                            <button onClick={() => openModal({ name: '', budget: auction?.purseValue || 10000, logoUrl: '', players: [], password: '' })} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow">
                                <Plus className="w-5 h-5"/> Add Team
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teams.map(team => (
                                <div key={team.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        {team.logoUrl ? <img src={team.logoUrl} className="w-12 h-12 rounded-full object-contain border p-1"/> : <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{team.name.charAt(0)}</div>}
                                        <div>
                                            <h3 className="font-bold text-gray-800">{team.name}</h3>
                                            <p className="text-xs text-gray-400 font-mono">ID: {team.id}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal(team)} className="p-2 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete('teams', String(team.id))} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'PLAYERS' && (
                    <div className="space-y-4 animate-fade-in">
                         <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" className="w-full border rounded-full pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search players..." value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} />
                            </div>
                            <button onClick={() => openModal({ name: '', category: categoriesList[0], role: rolesList[0], basePrice: auction?.basePrice || 20, photoUrl: '', nationality: 'India' })} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow">
                                <Plus className="w-5 h-5"/> Add Player
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredPlayers.map(p => (
                                <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
                                    <div className="aspect-square bg-gray-100 relative">
                                        {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Users className="w-10 h-10"/></div>}
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openModal(p)} className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow text-blue-600"><Edit className="w-3.5 h-3.5"/></button>
                                            <button onClick={() => handleDelete('players', String(p.id))} className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow text-red-600"><Trash2 className="w-3.5 h-3.5"/></button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h4 className="font-bold text-gray-800 text-sm truncate">{p.name}</h4>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase">{p.role}</span>
                                            <span className="text-xs font-mono font-bold">{p.basePrice}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'CATEGORIES' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Auction Sets (Categories)</h2>
                            <button onClick={() => openModal({ name: '', basePrice: 20, maxPerTeam: 0, bidIncrement: 10 })} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow">
                                <Plus className="w-5 h-5"/> New Set
                            </button>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Set Name</th>
                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Base Price</th>
                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Max/Team</th>
                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Increment</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {categories.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-800">{c.name}</td>
                                            <td className="p-4 font-mono">{c.basePrice}</td>
                                            <td className="p-4 font-bold">{c.maxPerTeam || '∞'}</td>
                                            <td className="p-4 font-mono">+{c.bidIncrement}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => openModal(c)} className="p-2 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => handleDelete('categories', c.id!)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                {activeTab === 'ROLES' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Player Roles (Skills)</h2>
                            <button onClick={() => openModal({ name: '', basePrice: 20 })} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow">
                                <Plus className="w-5 h-5"/> New Role
                            </button>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Role Name</th>
                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Default Base Price</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {roles.map(r => (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-800">{r.name}</td>
                                            <td className="p-4 font-mono">{r.basePrice}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => openModal(r)} className="p-2 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => handleDelete('roles', r.id!)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </main>

            {isEditing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">{editItem.id ? 'Edit' : 'Create New'} {activeTab.slice(0, -1)}</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X/></button>
                        </div>
                        <form onSubmit={
                            activeTab === 'TEAMS' ? handleSaveTeam : 
                            activeTab === 'PLAYERS' ? handleSavePlayer : 
                            activeTab === 'CATEGORIES' ? handleSaveCategory : 
                            activeTab === 'ROLES' ? handleSaveRole :
                            undefined
                        } className="p-6 space-y-4">
                            
                            {(activeTab === 'TEAMS' || activeTab === 'PLAYERS' || activeTab === 'SPONSORS') && (
                                <div className="flex flex-col items-center mb-4">
                                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                                        {previewImage ? <img src={previewImage} className="w-full h-full object-cover" /> : <Upload className="text-gray-300"/>}
                                        <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                            <Upload className="text-white w-5 h-5"/>
                                        </div>
                                    </div>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    <p className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-widest">Profile Image</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Name</label>
                                <input required type="text" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} />
                            </div>

                            {activeTab === 'TEAMS' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Purse Budget</label>
                                        <input required type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={editItem.budget} onChange={e => setEditItem({...editItem, budget: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Login Password (Optional)</label>
                                        <input type="text" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={editItem.password} onChange={e => setEditItem({...editItem, password: e.target.value})} placeholder="Owner access code" />
                                    </div>
                                </>
                            )}

                            {activeTab === 'PLAYERS' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <User className="w-3 h-3"/> Select Role
                                        </label>
                                        <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 rounded-lg border border-gray-200">
                                            {rolesList.map(r => (
                                                <button 
                                                    key={r}
                                                    type="button"
                                                    onClick={() => setEditItem({...editItem, role: r})}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all border ${editItem.role === r ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'}`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <Tag className="w-3 h-3"/> Select Category (Set)
                                        </label>
                                        <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 rounded-lg border border-gray-200">
                                            {categoriesList.map(c => (
                                                <button 
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setEditItem({...editItem, category: c})}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all border ${editItem.category === c ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'}`}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Base Price</label>
                                            <input required type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'CATEGORIES' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Base Price</label>
                                            <input required type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Max Per Team</label>
                                            <input required type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={editItem.maxPerTeam} onChange={e => setEditItem({...editItem, maxPerTeam: Number(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Bid Increment</label>
                                        <input required type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={editItem.bidIncrement} onChange={e => setEditItem({...editItem, bidIncrement: Number(e.target.value)})} />
                                    </div>
                                </>
                            )}

                            {activeTab === 'ROLES' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Default Base Price</label>
                                    <input required type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} />
                                </div>
                            )}

                            <div className="pt-4">
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuctionManage;