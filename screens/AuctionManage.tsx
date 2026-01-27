
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab, FieldType } from '../types';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, AlignLeft, CheckSquare, Square, Palette, ChevronDown, Search, CheckCircle, XCircle, Clock, Calendar, Info, ListPlus, Eye, EyeOff, Copy, Link as LinkIcon, Check as CheckIcon, ShieldCheck, Tag, User, TrendingUp, CreditCard, Shield, UserCheck, UserX, Share2, Download, FileSpreadsheet, Filter, CreditCard as CardIcon, Key, ExternalLink } from 'lucide-react';
import firebase from 'firebase/compat/app';
import * as XLSX from 'xlsx';

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
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
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
    paymentMethod: 'MANUAL',
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
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TEAMS' | 'PLAYERS' | 'REQUESTS' | 'ROLES' | 'REGISTRATION'>('SETTINGS');
    const [loading, setLoading] = useState(true);
    const [auction, setAuction] = useState<AuctionSetup | null>(null);

    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [categories, setCategories] = useState<AuctionCategory[]>([]);
    const [roles, setRoles] = useState<PlayerRole[]>([]);
    const [registrations, setRegistrations] = useState<RegisteredPlayer[]>([]);
    
    const [playerSearch, setPlayerSearch] = useState('');
    const [requestSearch, setRequestSearch] = useState('');
    const [regConfig, setRegConfig] = useState<RegistrationConfig>(DEFAULT_REG_CONFIG);

    const [settingsForm, setSettingsForm] = useState({
        title: '', date: '', sport: '', purseValue: 0, basePrice: 0, bidIncrement: 0, playersPerTeam: 0, totalTeams: 0
    });
    const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);
    const [newSlab, setNewSlab] = useState<{from: string, increment: string}>({from: '', increment: ''});
    const [settingsLogo, setSettingsLogo] = useState('');
    const settingsLogoRef = useRef<HTMLInputElement>(null);

    // --- INLINE EDITING STATES ---
    const [isAddingTeam, setIsAddingTeam] = useState(false);
    const [isAddingPlayer, setIsAddingPlayer] = useState(false);
    const [isAddingRole, setIsAddingRole] = useState(false);
    
    const [editItem, setEditItem] = useState<any>(null);
    const [previewImage, setPreviewImage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                        title: data.title || '', date: data.date || '', sport: data.sport || '', purseValue: data.purseValue || 0,
                        basePrice: data.basePrice || 0, bidIncrement: data.bidIncrement || 0, playersPerTeam: data.playersPerTeam || 0, totalTeams: data.totalTeams || 0
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
                const roleSnap = await db.collection('auctions').doc(id).collection('roles').get();
                setRoles(roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole)));
                setLoading(false);
            } catch (e) { console.error(e); setLoading(false); }
        };
        fetchAll();
    }, [id]);

    useEffect(() => {
        if (id && activeTab === 'REQUESTS') {
            const unsub = db.collection('auctions').doc(id).collection('registrations').orderBy('submittedAt', 'desc').onSnapshot(snap => {
                setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as RegisteredPlayer)));
            });
            return () => unsub();
        }
    }, [id, activeTab]);

    // Added missing handler for settings logo change
    const handleSettingsLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setSettingsLogo(base64);
        }
    };

    const handleSaveTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const teamData = { name: editItem.name, budget: Number(editItem.budget), logoUrl: previewImage || editItem.logoUrl || '', players: editItem.players || [], password: editItem.password || '' };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('teams').doc(editItem.id).update(teamData);
                setTeams(prev => prev.map(t => t.id === editItem.id ? { ...t, ...teamData } : t));
            } else {
                const newTeamResult = await db.runTransaction(async (transaction) => {
                    const counterRef = db.collection('appConfig').doc('globalCounters');
                    const counterDoc = await transaction.get(counterRef);
                    let nextNum = (counterDoc.data()?.teamCount || 0) + 1;
                    const newId = `T${String(nextNum).padStart(3, '0')}`;
                    const newTeamRef = db.collection('auctions').doc(id).collection('teams').doc(newId);
                    transaction.set(counterRef, { teamCount: nextNum }, { merge: true });
                    transaction.set(newTeamRef, { id: newId, ...teamData });
                    return { id: newId, ...teamData };
                });
                setTeams(prev => [...prev, newTeamResult as Team]);
            }
            setIsAddingTeam(false);
            setEditItem(null);
        } catch (err: any) { alert("Error saving team: " + err.message); }
    };

    const handleSavePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const playerData = { 
            name: editItem.name, 
            category: editItem.category || (categoriesList[0] || 'Uncapped'), 
            role: editItem.role || (rolesList[0] || 'All Rounder'), 
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
            setIsAddingPlayer(false);
            setEditItem(null);
        } catch (err) { alert("Error saving player"); }
    };

    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const roleData = { name: editItem.name, basePrice: Number(editItem.basePrice) };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('roles').doc(editItem.id).update(roleData);
                setRoles(prev => prev.map(r => r.id === editItem.id ? { ...r, ...roleData } : r));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('roles').doc();
                await newRef.set({ id: newRef.id, ...roleData });
                setRoles(prev => [...prev, { id: newRef.id, ...roleData } as PlayerRole]);
            }
            setIsAddingRole(false);
            setEditItem(null);
        } catch (err) { alert("Error saving role"); }
    };

    const handleSaveSettings = async () => {
        if (!id || !auction) return;
        try {
            const updates = { ...settingsForm, logoUrl: settingsLogo, slabs: slabs, totalTeams: Number(settingsForm.totalTeams) };
            await db.collection('auctions').doc(id).update(updates);
            setAuction({ ...auction, ...updates });
            alert("Updated!");
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const handleSaveRegConfig = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({ registrationConfig: regConfig });
            alert("Settings Saved!");
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const copyRegLink = () => {
        if (!id) return;
        const baseUrl = window.location.href.split('#')[0];
        const url = `${baseUrl}#/auction/${id}/register`;
        navigator.clipboard.writeText(url);
        alert("✅ Copied!");
    };

    const handleDelete = async (collection: string, itemId: string) => {
        if (!window.confirm("Confirm?")) return;
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).collection(collection).doc(String(itemId)).delete();
            if (collection === 'teams') setTeams(prev => prev.filter(t => t.id !== itemId));
            if (collection === 'players') setPlayers(prev => prev.filter(p => p.id !== itemId));
            if (collection === 'roles') setRoles(prev => prev.filter(r => r.id !== itemId));
            if (collection === 'registrations') setRegistrations(prev => prev.filter(r => r.id !== itemId));
        } catch (e) { alert("Failed"); }
    };

    const handleUpdateRegStatus = async (requestId: string, approve: boolean) => {
        if (!id) return;
        try {
            if (!approve) { await handleDelete('registrations', requestId); return; }
            const regDoc = await db.collection('auctions').doc(id).collection('registrations').doc(requestId).get();
            if (!regDoc.exists) return;
            const regData = regDoc.data() as RegisteredPlayer;
            const existing = players.find(p => (p as any).mobile === regData.mobile);
            if (!existing) {
                const newPlayer: Omit<Player, 'id'> = {
                    name: regData.fullName, photoUrl: regData.profilePic, category: categories[0]?.name || 'Uncapped',
                    role: regData.playerType, basePrice: auction?.basePrice || 20, nationality: 'India', speciality: regData.playerType,
                    status: 'UNSOLD', stats: { matches: 0, runs: 0, wickets: 0 }, ...({ mobile: regData.mobile, regId: requestId } as any)
                };
                const newRef = db.collection('auctions').doc(id).collection('players').doc();
                await newRef.set({ id: newRef.id, ...newPlayer });
                setPlayers(prev => [...prev, { id: newRef.id, ...newPlayer } as Player]);
                await db.collection('auctions').doc(id).collection('registrations').doc(requestId).delete();
                setRegistrations(prev => prev.filter(r => r.id !== requestId));
            }
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) { setPreviewImage(await compressImage(e.target.files[0])); }
    };

    const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setRegConfig({ ...regConfig, qrCodeUrl: base64 });
        }
    };

    const rolesList = roles.length > 0 ? roles.map(r => r.name) : ['Batsman', 'Bowler', 'All Rounder'];
    const categoriesList = categories.length > 0 ? categories.map(c => c.name) : ['Uncapped'];

    const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()));
    const filteredRequests = registrations.filter(r => r.fullName.toLowerCase().includes(requestSearch.toLowerCase()));

    if (loading) return <div className="p-10 text-center text-gray-700">Loading Management...</div>;

    const InlineFormHeader = ({ title, onClose }: { title: string, onClose: () => void }) => (
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h3 className="font-bold text-gray-800 uppercase text-xs tracking-widest">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500"><XCircle className="w-5 h-5"/></button>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-10 text-gray-900">
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-800"><ArrowLeft className="w-5 h-5"/></button>
                        <h1 className="text-lg font-bold text-gray-700 truncate">{auction?.title}</h1>
                    </div>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto custom-scrollbar">
                        {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'ROLES', 'REGISTRATION'].map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-3 py-1 text-xs font-bold rounded whitespace-nowrap transition-all ${activeTab === tab ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>{tab}</button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                
                {activeTab === 'SETTINGS' && (
                    <div className="bg-white rounded-xl shadow p-6 border border-gray-200 space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Title</label>
                                    <input className="w-full border rounded-lg p-2.5" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Purse</label>
                                        <input type="number" className="w-full border rounded-lg p-2.5" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Teams</label>
                                        <input type="number" className="w-full border rounded-lg p-2.5" value={settingsForm.totalTeams} onChange={e => setSettingsForm({...settingsForm, totalTeams: Number(e.target.value)})} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Logo</label>
                                <div className="w-24 h-24 rounded-2xl bg-gray-50 border border-dashed flex items-center justify-center relative group overflow-hidden">
                                    {settingsLogo ? <img src={settingsLogo} className="w-full h-full object-contain" /> : <ImageIcon className="text-gray-300" />}
                                    <button onClick={() => settingsLogoRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Upload className="text-white w-5 h-5"/></button>
                                </div>
                                <input ref={settingsLogoRef} type="file" className="hidden" accept="image/*" onChange={e => handleSettingsLogoChange(e)} />
                            </div>
                        </div>
                        <button onClick={handleSaveSettings} className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg">Save Global Config</button>
                    </div>
                )}

                {activeTab === 'TEAMS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Teams ({teams.length})</h2>
                            {!isAddingTeam && (
                                <button onClick={() => { setEditItem({ name: '', budget: auction?.purseValue || 10000, password: '' }); setPreviewImage(''); setIsAddingTeam(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5"/> New Team</button>
                            )}
                        </div>

                        {isAddingTeam && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-xl animate-slide-up">
                                <InlineFormHeader title={editItem.id ? "Edit Team" : "Add Team Profile"} onClose={() => { setIsAddingTeam(false); setEditItem(null); }} />
                                <form onSubmit={handleSaveTeam} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                    <div className="flex flex-col items-center">
                                        <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden relative cursor-pointer">
                                            {previewImage ? <img src={previewImage} className="w-full h-full object-cover" /> : <Upload className="text-gray-300"/>}
                                        </div>
                                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    </div>
                                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 gap-4">
                                        <input placeholder="Team Name" className="w-full border rounded-xl p-3" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} required />
                                        <div className="flex gap-4">
                                            <input type="number" placeholder="Budget" className="w-full border rounded-xl p-3" value={editItem.budget} onChange={e => setEditItem({...editItem, budget: Number(e.target.value)})} required />
                                            <input placeholder="Password" title="Optional login code" className="w-full border rounded-xl p-3" value={editItem.password} onChange={e => setEditItem({...editItem, password: e.target.value})} />
                                        </div>
                                    </div>
                                    <button type="submit" className="bg-green-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs">Authorize Team</button>
                                </form>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teams.map(team => (
                                <div key={team.id} className="bg-white p-4 rounded-2xl shadow-sm border flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <img src={team.logoUrl} className="w-12 h-12 rounded-full border p-1" />
                                        <div><h3 className="font-bold text-gray-800 leading-none">{team.name}</h3><p className="text-[10px] text-gray-400 font-mono mt-1">{team.id}</p></div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditItem(team); setPreviewImage(team.logoUrl); setIsAddingTeam(true); }} className="p-2 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete('teams', String(team.id))} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'PLAYERS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <h2 className="text-xl font-bold text-gray-800">Players Pool ({players.length})</h2>
                            {!isAddingPlayer && (
                                <button onClick={() => { setEditItem({ name: '', basePrice: auction?.basePrice || 20, nationality: 'India' }); setPreviewImage(''); setIsAddingPlayer(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5"/> Register Player</button>
                            )}
                        </div>

                        {isAddingPlayer && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-xl animate-slide-up">
                                <InlineFormHeader title={editItem.id ? "Modify Record" : "New Player Record"} onClose={() => { setIsAddingPlayer(false); setEditItem(null); }} />
                                <form onSubmit={handleSavePlayer} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <div className="flex flex-col items-center">
                                            <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden relative cursor-pointer bg-gray-50">
                                                {previewImage ? <img src={previewImage} className="w-full h-full object-cover" /> : <Upload className="text-gray-300"/>}
                                            </div>
                                            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                        </div>
                                        <div className="md:col-span-3 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <input placeholder="Full Name" className="w-full border rounded-xl p-3" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} required />
                                                <input type="number" placeholder="Base Price" className="w-full border rounded-xl p-3" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} required />
                                            </div>
                                            
                                            {/* Role Chips */}
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Select Skill (Role)</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {rolesList.map(r => (
                                                        <button key={r} type="button" onClick={() => setEditItem({...editItem, role: r})} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${editItem.role === r ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>{r}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Category Chips */}
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Select Set (Category)</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {categoriesList.map(c => (
                                                        <button key={c} type="button" onClick={() => setEditItem({...editItem, category: c})} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${editItem.category === c ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>{c}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4 border-t"><button type="submit" className="bg-blue-600 text-white font-black py-4 px-12 rounded-xl shadow-lg uppercase tracking-widest text-xs">Verify & Register</button></div>
                                </form>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredPlayers.map(p => (
                                <div key={p.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden group">
                                    <div className="aspect-square bg-gray-50 relative">
                                        <img src={p.photoUrl} className="w-full h-full object-cover" />
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity">
                                            <button onClick={() => { setEditItem(p); setPreviewImage(p.photoUrl); setIsAddingPlayer(true); }} className="p-2 bg-white rounded-lg shadow text-blue-600"><Edit className="w-4 h-4"/></button>
                                            <button onClick={() => handleDelete('players', String(p.id))} className="p-2 bg-white rounded-lg shadow text-red-600"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                    <div className="p-3"><h4 className="font-bold text-gray-800 text-sm truncate">{p.name}</h4><div className="flex justify-between items-center mt-1"><span className="text-[10px] font-bold text-blue-600 uppercase">{p.role}</span><span className="text-xs font-bold text-gray-500">{p.basePrice}</span></div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {activeTab === 'ROLES' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Skill Categories</h2>
                            {!isAddingRole && (
                                <button onClick={() => { setEditItem({ name: '', basePrice: auction?.basePrice || 20 }); setIsAddingRole(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5"/> New Role</button>
                            )}
                        </div>

                        {isAddingRole && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-xl animate-slide-up">
                                <InlineFormHeader title="Define New Role" onClose={() => { setIsAddingRole(false); setEditItem(null); }} />
                                <form onSubmit={handleSaveRole} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <input placeholder="Role Name (e.g. Batsman)" className="w-full border rounded-xl p-3" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} required />
                                    <input type="number" placeholder="Default Base Price" className="w-full border rounded-xl p-3" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} required />
                                    <button type="submit" className="bg-blue-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px]">Establish Role</button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b"><tr><th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role Protocol</th><th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Default Unit Value</th><th className="p-4 text-right">Action</th></tr></thead>
                                <tbody className="divide-y">
                                    {roles.map(r => (
                                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-bold text-gray-800 uppercase tracking-wider">{r.name}</td>
                                            <td className="p-4 font-mono font-bold text-blue-600">{r.basePrice}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => { setEditItem(r); setIsAddingRole(true); }} className="p-2 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => handleDelete('roles', r.id!)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'REGISTRATION' && (
                    <div className="bg-white rounded-xl shadow p-6 border border-gray-200 space-y-8 animate-fade-in">
                         <div className="flex justify-between items-center border-b pb-4 mb-6">
                            <div><h2 className="text-xl font-bold text-gray-800">Registration Portal Config</h2><p className="text-xs text-gray-400">Secure automated payment and verification.</p></div>
                            <div className="flex items-center gap-3">
                                <button onClick={copyRegLink} className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 shadow-lg"><Share2 className="w-4 h-4"/> Share Link</button>
                                <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-xl border">
                                    <label className="text-xs font-black text-gray-500">TERMINAL ACTIVE</label>
                                    <button onClick={() => setRegConfig({ ...regConfig, isEnabled: !regConfig.isEnabled })} className={`w-12 h-6 rounded-full relative flex items-center px-1 transition-colors ${regConfig.isEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform ${regConfig.isEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div></button>
                                </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-6">
                                 <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-3">Gateway Parameters</label>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border">
                                            <span className="text-sm font-bold text-gray-700">Include Automated Payment</span>
                                            <button onClick={() => setRegConfig({...regConfig, includePayment: !regConfig.includePayment})} className={`p-1 rounded transition-colors ${regConfig.includePayment ? 'text-blue-600' : 'text-gray-300'}`}>{regConfig.includePayment ? <CheckSquare/> : <Square/>}</button>
                                        </div>
                                    </div>
                                 </div>

                                 {regConfig.includePayment && (
                                     <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 space-y-4 animate-slide-up">
                                         <h3 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2"><Key className="w-3 h-3" /> Razorpay integrated Checkout</h3>
                                         
                                         <div className="mb-4">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Select Process</label>
                                            <div className="flex bg-white rounded-lg border p-1">
                                                <button 
                                                    onClick={() => setRegConfig({...regConfig, paymentMethod: 'MANUAL'})}
                                                    className={`flex-1 py-1.5 rounded text-[10px] font-black transition-all ${regConfig.paymentMethod === 'MANUAL' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                                                >
                                                    MANUAL (QR)
                                                </button>
                                                <button 
                                                    onClick={() => setRegConfig({...regConfig, paymentMethod: 'RAZORPAY'})}
                                                    className={`flex-1 py-1.5 rounded text-[10px] font-black transition-all ${regConfig.paymentMethod === 'RAZORPAY' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                                                >
                                                    RAZORPAY MODAL
                                                </button>
                                            </div>
                                         </div>

                                         <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Fee (₹)</label>
                                                <input type="number" className="w-full border rounded-lg p-2 text-sm" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} />
                                            </div>
                                            {regConfig.paymentMethod === 'RAZORPAY' ? (
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Razorpay Key ID</label>
                                                    <input type="text" className="w-full border rounded-lg p-2 text-sm font-mono" value={regConfig.razorpayKey || ''} onChange={e => setRegConfig({...regConfig, razorpayKey: e.target.value})} placeholder="rzp_live_..." />
                                                    <p className="text-[8px] text-gray-500 mt-1 uppercase font-bold tracking-tighter">Found in Razorpay Dashboard > Settings > API Keys.</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">UPI ID</label>
                                                        <input type="text" className="w-full border rounded-lg p-2 text-sm font-mono" value={regConfig.upiId || ''} onChange={e => setRegConfig({...regConfig, upiId: e.target.value})} placeholder="merchant@upi" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">UPI Name</label>
                                                        <input type="text" className="w-full border rounded-lg p-2 text-sm" value={regConfig.upiName || ''} onChange={e => setRegConfig({...regConfig, upiName: e.target.value})} placeholder="Account Name" />
                                                    </div>
                                                </>
                                            )}
                                         </div>
                                     </div>
                                 )}
                             </div>
                             <div className="space-y-6">
                                 <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-200">
                                     <h3 className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-2 mb-4"><ShieldCheck className="w-3 h-3" /> Security Protocol</h3>
                                     <p className="text-[10px] text-zinc-600 leading-relaxed font-bold">
                                         Using "Razorpay Modal" prevents users from bypassing payment. The registration form data is only saved once Razorpay returns a success signature. Integrated checkout happens in a popup, so there is no "Success Page" link to share maliciously.
                                     </p>
                                 </div>
                             </div>
                         </div>
                         <div className="pt-8 border-t flex justify-end"><button onClick={handleSaveRegConfig} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-10 rounded-2xl shadow-xl flex items-center gap-2 transition-all active:scale-95"><Save className="w-5 h-5"/> Save Terminal Credentials</button></div>
                    </div>
                )}

                {activeTab === 'REQUESTS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <h2 className="text-xl font-bold text-gray-800">Registration Entries ({registrations.length})</h2>
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" className="w-full border rounded-full pl-10 pr-4 py-2 text-sm outline-none" placeholder="Search entries..." value={requestSearch} onChange={e => setRequestSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Player</th>
                                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</th>
                                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredRequests.map(r => (
                                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={r.profilePic} className="w-12 h-12 rounded-xl object-cover border" />
                                                    <div><p className="font-bold text-gray-800">{r.fullName}</p><p className="text-[10px] font-bold text-gray-400 uppercase">{r.playerType}</p></div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs font-mono text-gray-500">{r.mobile}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${r.razorpayPaymentId ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                        {r.razorpayPaymentId ? 'PAID' : 'MANUAL/PENDING'}
                                                    </span>
                                                    {r.razorpayPaymentId && (
                                                        <a 
                                                            href={`https://dashboard.razorpay.com/app/payments/${r.razorpayPaymentId}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="text-[8px] font-mono text-blue-500 underline"
                                                        >
                                                            {r.razorpayPaymentId}
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleUpdateRegStatus(r.id, true)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all" title="Move to Auction Pool"><UserCheck className="w-4 h-4"/></button>
                                                    <button onClick={() => handleUpdateRegStatus(r.id, false)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all" title="Delete entry"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredRequests.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic text-sm">No entries detected.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AuctionManage;
