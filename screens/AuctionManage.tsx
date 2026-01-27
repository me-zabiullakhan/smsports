import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab, FieldType } from '../types';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, AlignLeft, CheckSquare, Square, Palette, ChevronDown, Search, CheckCircle, XCircle, Clock, Calendar, Info, ListPlus, Eye, EyeOff, Copy, Link as LinkIcon, Check as CheckIcon, ShieldCheck, Tag, User, TrendingUp, CreditCard, Shield, UserCheck, UserX, Share2, Download, FileSpreadsheet, Filter, Key, ExternalLink, LayoutList, ToggleRight, ToggleLeft } from 'lucide-react';
import firebase from 'firebase/compat/app';

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
    terms: '1. Registration fee is non-refundable.\n2. Players must reporting 30 mins before match.',
    customFields: []
};

const AuctionManage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TEAMS' | 'PLAYERS' | 'REQUESTS' | 'CATEGORIES' | 'ROLES' | 'SPONSORS' | 'REGISTRATION'>('SETTINGS');
    const [loading, setLoading] = useState(true);
    const [auction, setAuction] = useState<AuctionSetup | null>(null);

    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [categories, setCategories] = useState<AuctionCategory[]>([]);
    const [roles, setRoles] = useState<PlayerRole[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [registrations, setRegistrations] = useState<RegisteredPlayer[]>([]);
    
    const [regConfig, setRegConfig] = useState<RegistrationConfig>(DEFAULT_REG_CONFIG);

    const [settingsForm, setSettingsForm] = useState({
        title: '', date: '', sport: '', purseValue: 0, basePrice: 0, bidIncrement: 0, playersPerTeam: 0, totalTeams: 0
    });
    const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);
    const [newSlab, setNewSlab] = useState<{from: string, increment: string}>({from: '', increment: ''});
    const [settingsLogo, setSettingsLogo] = useState('');
    const settingsLogoRef = useRef<HTMLInputElement>(null);

    const [editItem, setEditItem] = useState<any>(null);
    const [isAdding, setIsAdding] = useState(false);
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
                
                // Real-time listeners for all sub-collections
                const unsubTeams = db.collection('auctions').doc(id).collection('teams').onSnapshot(s => setTeams(s.docs.map(d => ({id: d.id, ...d.data()}) as Team)));
                const unsubPlayers = db.collection('auctions').doc(id).collection('players').onSnapshot(s => setPlayers(s.docs.map(d => ({id: d.id, ...d.data()}) as Player)));
                const unsubCats = db.collection('auctions').doc(id).collection('categories').onSnapshot(s => setCategories(s.docs.map(d => ({id: d.id, ...d.data()}) as AuctionCategory)));
                const unsubRoles = db.collection('auctions').doc(id).collection('roles').onSnapshot(s => setRoles(s.docs.map(d => ({id: d.id, ...d.data()}) as PlayerRole)));
                const unsubSponsors = db.collection('auctions').doc(id).collection('sponsors').onSnapshot(s => setSponsors(s.docs.map(d => ({id: d.id, ...d.data()}) as Sponsor)));

                setLoading(false);
            } catch (e) { console.error(e); setLoading(false); }
        };
        fetchAll();
    }, [id]);

    const handleSaveSettings = async () => {
        if (!id || !auction) return;
        try {
            const updates = { ...settingsForm, logoUrl: settingsLogo, slabs: slabs };
            await db.collection('auctions').doc(id).update(updates);
            alert("Configuration Updated!");
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const handleAddSlab = () => {
        const from = Number(newSlab.from);
        const inc = Number(newSlab.increment);
        if (from >= 0 && inc > 0) {
            setSlabs([...slabs, { from, increment: inc }]);
            setNewSlab({ from: '', increment: '' });
        }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const catData = { 
            name: editItem.name, 
            basePrice: Number(editItem.basePrice), 
            maxPerTeam: Number(editItem.maxPerTeam), 
            bidIncrement: Number(editItem.bidIncrement),
            slabs: [] 
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('categories').doc(editItem.id).update(catData);
            } else {
                await db.collection('auctions').doc(id).collection('categories').add(catData);
            }
            setIsAdding(false); setEditItem(null);
        } catch (e) { alert("Error saving category"); }
    };

    const handleSaveRegistration = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({ registrationConfig: regConfig });
            alert("Registration Protocol Deployed!");
        } catch (e: any) { alert("Failed to deploy: " + e.message); }
    };

    const addCustomField = () => {
        const newField: FormField = {
            id: Date.now().toString(),
            label: '',
            type: 'text',
            required: true,
            options: []
        };
        setRegConfig({ ...regConfig, customFields: [...regConfig.customFields, newField] });
    };

    const removeCustomField = (fid: string) => {
        setRegConfig({ ...regConfig, customFields: regConfig.customFields.filter(f => f.id !== fid) });
    };

    const updateField = (fid: string, key: keyof FormField, value: any) => {
        setRegConfig({
            ...regConfig,
            customFields: regConfig.customFields.map(f => f.id === fid ? { ...f, [key]: value } : f)
        });
    };

    const handleDelete = async (coll: string, itemId: string) => {
        if (!window.confirm("Confirm deletion?")) return;
        try {
            await db.collection('auctions').doc(id!).collection(coll).doc(itemId).delete();
        } catch (e) { alert("Delete failed"); }
    };

    if (loading) return <div className="p-10 text-center text-gray-500 font-bold uppercase tracking-widest animate-pulse">Accessing Core...</div>;

    return (
        <div className="min-h-screen bg-[#f8f9fa] font-sans pb-20 text-gray-900">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-800 transition-colors">
                            <ArrowLeft className="w-5 h-5"/>
                        </button>
                        <h1 className="text-sm font-black uppercase tracking-widest text-gray-700">{auction?.title}</h1>
                        <div className="hidden md:flex gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                            {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'CATEGORIES', 'ROLES', 'SPONSORS', 'REGISTRATION'].map(tab => (
                                <button 
                                    key={tab} 
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-3 py-1 text-[10px] font-black uppercase transition-all rounded-md ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                
                {/* SETTINGS TAB */}
                {activeTab === 'SETTINGS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-blue-500" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">Auction Configuration</h2>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Auction Title</label>
                                            <input className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold focus:border-blue-500 focus:bg-white outline-none transition-all" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Sport</label>
                                            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                                                {['Cricket', 'Football', 'Kabaddi'].map(s => (
                                                    <button 
                                                        key={s} 
                                                        onClick={() => setSettingsForm({...settingsForm, sport: s})}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${settingsForm.sport === s ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Purse Value</label>
                                                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Total Teams</label>
                                                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold" value={settingsForm.totalTeams} onChange={e => setSettingsForm({...settingsForm, totalTeams: Number(e.target.value)})} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Default Base Price</label>
                                                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold" value={settingsForm.basePrice} onChange={e => setSettingsForm({...settingsForm, basePrice: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Default Bid Increment</label>
                                                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold" value={settingsForm.bidIncrement} onChange={e => setSettingsForm({...settingsForm, bidIncrement: Number(e.target.value)})} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-start pt-6">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Auction Logo</label>
                                        <div className="w-40 h-40 rounded-[2.5rem] bg-black border-8 border-white shadow-xl flex items-center justify-center relative group overflow-hidden">
                                            {settingsLogo ? <img src={settingsLogo} className="w-full h-full object-contain p-4" /> : <ImageIcon className="text-zinc-800 w-12 h-12" />}
                                            <button onClick={() => settingsLogoRef.current?.click()} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Upload className="text-white w-6 h-6"/></button>
                                        </div>
                                        <input ref={settingsLogoRef} type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                            if (e.target.files?.[0]) setSettingsLogo(await compressImage(e.target.files[0]));
                                        }} />
                                    </div>
                                </div>

                                {/* Global Slabs Card */}
                                <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-gray-200 relative">
                                    <div className="flex items-center gap-2 mb-6">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        <h3 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.2em]">Global Bid Increment Slabs</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-4">Add New Bid Rule</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">When Price {'>='}</label>
                                                    <input placeholder="e.g. 500" className="w-full border rounded-lg p-2 text-xs" value={newSlab.from} onChange={e => setNewSlab({...newSlab, from: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Increment By</label>
                                                    <input placeholder="e.g. 50" className="w-full border rounded-lg p-2 text-xs" value={newSlab.increment} onChange={e => setNewSlab({...newSlab, increment: e.target.value})} />
                                                </div>
                                            </div>
                                            <button onClick={handleAddSlab} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-lg text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                                <Plus className="w-4 h-4"/> Add Increment Rule
                                            </button>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-4">Active Rules ({slabs.length})</p>
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                                {slabs.map((s, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white border rounded-xl px-4 py-2 shadow-sm">
                                                        <span className="text-[11px] font-bold text-gray-600">From <b className="text-gray-900">{s.from}</b> +<b className="text-blue-600">{s.increment}</b></span>
                                                        <button onClick={() => setSlabs(slabs.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4"/></button>
                                                    </div>
                                                ))}
                                                {slabs.length === 0 && <div className="h-24 flex flex-col items-center justify-center text-gray-300 opacity-50"><TrendingUp className="w-8 h-8 mb-2"/><p className="text-[9px] font-bold uppercase">No custom slab rules defined</p></div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-start">
                                <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-10 rounded-xl shadow-lg shadow-blue-900/20 text-xs uppercase tracking-[0.2em] flex items-center gap-2 transition-all active:scale-95">
                                    <Save className="w-4 h-4" /> Update Configuration
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CATEGORIES TAB */}
                {activeTab === 'CATEGORIES' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h2 className="text-lg font-black text-gray-800 tracking-tight uppercase">Auction Sets (Categories)</h2>
                            <button onClick={() => { setEditItem({ name: '', basePrice: settingsForm.basePrice, maxPerTeam: 10, bidIncrement: settingsForm.bidIncrement }); setIsAdding(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                <Plus className="w-4 h-4"/> New Set
                            </button>
                        </div>

                        {isAdding && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-8 shadow-2xl animate-slide-up">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Establish Player Set</h3>
                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
                                </div>
                                <form onSubmit={handleSaveCategory} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                    <div className="col-span-1 md:col-span-1">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Set Name</label>
                                        <input className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} placeholder="e.g. Uncapped" required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Base Price</label>
                                        <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Max/Team</label>
                                        <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.maxPerTeam} onChange={e => setEditItem({...editItem, maxPerTeam: Number(e.target.value)})} required />
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">Authorize Set</button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="p-5">Set Name</th>
                                        <th className="p-5">Base Price</th>
                                        <th className="p-5">Max/Team</th>
                                        <th className="p-5">Increment</th>
                                        <th className="p-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {categories.map(cat => (
                                        <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="p-5 font-black text-gray-700 text-sm uppercase">{cat.name}</td>
                                            <td className="p-5 font-mono font-bold text-gray-500">{cat.basePrice}</td>
                                            <td className="p-5 font-mono font-bold text-blue-600">{cat.maxPerTeam}</td>
                                            <td className="p-5 font-mono font-bold text-emerald-600">{cat.bidIncrement}</td>
                                            <td className="p-5 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditItem(cat); setIsAdding(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                                    <button onClick={() => handleDelete('categories', cat.id!)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {categories.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-gray-300 italic text-xs uppercase font-black tracking-widest">No sets established in registry</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* REGISTRATION TAB */}
                {activeTab === 'REGISTRATION' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Registration Header */}
                            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 tracking-tight">Public Player Registration</h2>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure the form players will use to sign up.</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => {
                                        const url = `${window.location.origin}/#/auction/${id}/register`;
                                        navigator.clipboard.writeText(url);
                                        alert("Public link copied!");
                                    }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-6 rounded-lg text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                        <Share2 className="w-4 h-4"/> Copy Public Link
                                    </button>
                                    <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase">Form Enabled</label>
                                        <button 
                                            onClick={() => setRegConfig({...regConfig, isEnabled: !regConfig.isEnabled})}
                                            className={`transition-colors ${regConfig.isEnabled ? 'text-blue-600' : 'text-gray-300'}`}
                                        >
                                            {regConfig.isEnabled ? <ToggleRight className="w-8 h-8"/> : <ToggleLeft className="w-8 h-8"/>}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    {/* Left: Core Features */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Core Features</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-2xl group cursor-pointer hover:border-blue-400 transition-all" onClick={() => setRegConfig({...regConfig, includePayment: !regConfig.includePayment})}>
                                                <span className="text-xs font-bold text-gray-700">Collect Payment (QR Code)</span>
                                                {regConfig.includePayment ? <CheckCircle className="w-6 h-6 text-blue-600"/> : <Square className="w-6 h-6 text-gray-300"/>}
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-2xl group cursor-pointer hover:border-blue-400 transition-all" onClick={() => setRegConfig({...regConfig, isPublic: !regConfig.isPublic})}>
                                                <span className="text-xs font-bold text-gray-700">Public Access (Show on Home)</span>
                                                {regConfig.isPublic ? <CheckCircle className="w-6 h-6 text-blue-600"/> : <Square className="w-6 h-6 text-gray-300"/>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Brand & Legal */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Brand & Legal</h3>
                                        <div className="flex gap-6">
                                            <div className="flex-1 bg-gray-100 border border-dashed border-gray-300 rounded-2xl h-24 flex items-center justify-center relative overflow-hidden group">
                                                {regConfig.bannerUrl ? <img src={regConfig.bannerUrl} className="w-full h-full object-cover" /> : <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg"><ImageIcon className="text-gray-200" /></div>}
                                                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                    <Upload className="text-white w-5 h-5"/>
                                                    <input type="file" className="hidden" accept="image/*" onChange={async e => {
                                                        if (e.target.files?.[0]) setRegConfig({...regConfig, bannerUrl: await compressImage(e.target.files[0])});
                                                    }} />
                                                </label>
                                            </div>
                                            <div className="flex-[2] flex flex-col justify-center">
                                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Banner Logo</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Terms & Conditions (One per line)</label>
                                            <textarea 
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-bold text-gray-600 min-h-[100px] outline-none focus:bg-white focus:border-blue-500 transition-all"
                                                value={regConfig.terms}
                                                onChange={e => setRegConfig({...regConfig, terms: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Form Fields */}
                                <div className="mt-12 pt-12 border-t border-gray-100">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Custom Form Fields</h3>
                                        <button onClick={addCustomField} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-100 transition-all">
                                            <ListPlus className="w-4 h-4"/> Add Dynamic Field
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {regConfig.customFields.map(field => (
                                            <div key={field.id} className="bg-gray-50/50 border border-gray-100 rounded-[2rem] p-6 relative group hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all">
                                                <button onClick={() => removeCustomField(field.id)} className="absolute -top-3 -right-3 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110"><X className="w-4 h-4"/></button>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Label</label>
                                                        <input className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-tighter outline-none focus:border-blue-400" value={field.label} onChange={e => updateField(field.id, 'label', e.target.value.toUpperCase())} placeholder="ENTER FIELD NAME" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Type</label>
                                                        <select className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs font-black outline-none focus:border-blue-400" value={field.type} onChange={e => updateField(field.id, 'type', e.target.value)}>
                                                            <option value="text">Short Text</option>
                                                            <option value="number">Number</option>
                                                            <option value="select">Dropdown</option>
                                                            <option value="date">Date</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex items-center justify-between">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, 'required', e.target.checked)} className="accent-blue-600" />
                                                        <span className="text-[9px] font-black text-gray-500 uppercase">Required</span>
                                                    </label>
                                                </div>
                                                {/* Inline Dropdown Options */}
                                                {field.type === 'select' && (
                                                    <div className="mt-4 animate-fade-in">
                                                        <label className="block text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Dropdown Options (Comma separated)</label>
                                                        <input className="w-full bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-[10px] font-bold outline-none" value={(field.options || []).join(',')} onChange={e => updateField(field.id, 'options', e.target.value.split(','))} placeholder="S,M,L,XL,2XL..." />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-white border-t border-gray-100 flex justify-center">
                                <button onClick={handleSaveRegistration} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-16 rounded-2xl shadow-2xl shadow-blue-900/40 text-sm uppercase tracking-[0.3em] flex items-center gap-3 transition-all active:scale-95 group">
                                    <Save className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Deploy Registration Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TEAMS, PLAYERS, REQUESTS, ROLES, SPONSORS placeholder tabs */}
                {['TEAMS', 'PLAYERS', 'REQUESTS', 'ROLES', 'SPONSORS'].includes(activeTab) && (
                    <div className="p-20 text-center text-gray-300 italic font-black uppercase tracking-widest border border-dashed border-gray-200 rounded-3xl animate-pulse">
                        Synchronizing {activeTab} Data Interface...
                    </div>
                )}

            </main>
        </div>
    );
};

export default AuctionManage;