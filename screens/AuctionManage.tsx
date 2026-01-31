
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab } from '../types';
import { 
    ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, 
    DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, 
    AlignLeft, CheckSquare, Square, Palette, ChevronDown, Search, CheckCircle, 
    XCircle, Clock, Calendar, Info, ListPlus, Eye, EyeOff, Copy, Link as LinkIcon, 
    Check as CheckIcon, ShieldCheck, Tag, User, TrendingUp, CreditCard, Shield, 
    UserCheck, UserX, Share2, Download, FileSpreadsheet, Filter, Key, 
    ExternalLink, LayoutList, ToggleRight, ToggleLeft, RefreshCw, FileUp, 
    Star, UserPlus, Loader2, FileDown, ChevronRight, Zap
} from 'lucide-react';
import firebase from 'firebase/compat/app';
import * as XLSX from 'xlsx';
import { useAuction } from '../hooks/useAuction';

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
    const { userProfile } = useAuction();
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
        title: '', date: '', sport: '', purseValue: 0, basePrice: 0, bidIncrement: 0, playersPerTeam: 0, totalTeams: 0, logoUrl: ''
    });
    const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);
    const [newSlab, setNewSlab] = useState({ from: '', increment: '' });

    // CRUD Modals
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'TEAM' | 'PLAYER' | 'CATEGORY' | 'ROLE' | 'SPONSOR' | 'CSV'>('TEAM');
    const [editItem, setEditItem] = useState<any>(null);
    const [previewImage, setPreviewImage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const qrInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!id) return;
        const unsubAuction = db.collection('auctions').doc(id).onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data() as AuctionSetup;
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
                    totalTeams: data.totalTeams || 0,
                    logoUrl: data.logoUrl || ''
                });
                if (data.slabs) setSlabs(data.slabs);
            }
            setLoading(false);
        });

        const unsubTeams = db.collection('auctions').doc(id).collection('teams').onSnapshot(s => setTeams(s.docs.map(d => ({id: d.id, ...d.data()}) as Team)));
        const unsubPlayers = db.collection('auctions').doc(id).collection('players').onSnapshot(s => setPlayers(s.docs.map(d => ({id: d.id, ...d.data()}) as Player)));
        const unsubCats = db.collection('auctions').doc(id).collection('categories').onSnapshot(s => setCategories(s.docs.map(d => ({id: d.id, ...d.data()}) as AuctionCategory)));
        const unsubRoles = db.collection('auctions').doc(id).collection('roles').onSnapshot(s => setRoles(s.docs.map(d => ({id: d.id, ...d.data()}) as PlayerRole)));
        const unsubSponsors = db.collection('auctions').doc(id).collection('sponsors').onSnapshot(s => setSponsors(s.docs.map(d => ({id: d.id, ...d.data()}) as Sponsor)));
        const unsubRegs = db.collection('auctions').doc(id).collection('registrations').onSnapshot(s => setRegistrations(s.docs.map(d => ({id: d.id, ...d.data()}) as RegisteredPlayer)));

        return () => {
            unsubAuction(); unsubTeams(); unsubPlayers(); unsubCats(); unsubRoles(); unsubSponsors(); unsubRegs();
        };
    }, [id]);

    const handleSaveSettings = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({
                ...settingsForm,
                slabs
            });
            alert("Auction Identity Protocols Synced!");
        } catch (e: any) { alert("Save failed: " + e.message); }
    };

    const handleSaveRegistration = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({ registrationConfig: regConfig });
            alert("Registration Protocol Deployed!");
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'MODAL' | 'LOGO' | 'QR') => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            if (type === 'MODAL') setPreviewImage(base64);
            if (type === 'LOGO') setSettingsForm({ ...settingsForm, logoUrl: base64 });
            if (type === 'QR') setRegConfig({ ...regConfig, qrCodeUrl: base64 });
        }
    };

    const handleCrudSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const col = modalType.toLowerCase() + 's';
        const itemData = { ...editItem, logoUrl: previewImage || editItem.logoUrl || '', photoUrl: previewImage || editItem.photoUrl || '', imageUrl: previewImage || editItem.imageUrl || '' };
        
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection(col).doc(editItem.id).update(itemData);
            } else {
                await db.collection('auctions').doc(id).collection(col).add({ ...itemData, createdAt: Date.now() });
            }
            setShowModal(false);
            setEditItem(null);
            setPreviewImage('');
        } catch (err: any) { alert("Save failed: " + err.message); }
    };

    const handleDelete = async (type: string, itemId: string) => {
        if (window.confirm("Purge this record?")) {
            await db.collection('auctions').doc(id!).collection(type.toLowerCase() + 's').doc(itemId).delete();
        }
    };

    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>, type: 'TEAM' | 'PLAYER') => {
        const file = e.target.files?.[0];
        if (!file || !id) return;
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            
            const batch = db.batch();
            const col = type.toLowerCase() + 's';
            
            data.forEach(row => {
                const ref = db.collection('auctions').doc(id).collection(col).doc();
                if (type === 'TEAM') {
                    batch.set(ref, { id: ref.id, name: row.Name || row.name, owner: row.Owner || '', budget: Number(row.Budget) || settingsForm.purseValue, players: [], logoUrl: '' });
                } else {
                    batch.set(ref, { id: ref.id, name: row.Name || row.name, category: row.Category || 'Standard', role: row.Role || 'All Rounder', basePrice: Number(row.BasePrice) || settingsForm.basePrice, nationality: 'India', photoUrl: '', stats: { matches: 0, runs: 0, wickets: 0 } });
                }
            });
            
            await batch.commit();
            alert(`Imported ${data.length} records!`);
        };
        reader.readAsBinaryString(file);
    };

    const exportPlayersToCSV = () => {
        if (players.length === 0) return alert("No players to export.");
        const headers = ["Name", "Category", "Role", "Base Price", "Nationality", "Status", "Sold To", "Sold Price"];
        const rows = players.map(p => [
            p.name, p.category, p.role, p.basePrice, p.nationality, p.status || 'AVAILABLE', p.soldTo || '-', p.soldPrice || 0
        ]);

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `PLAYER_DATA_${auction?.title?.replace(/\s+/g, '_')}.csv`);
        link.click();
    };

    const addSlab = () => {
        if (!newSlab.from || !newSlab.increment) return;
        setSlabs([...slabs, { from: Number(newSlab.from), increment: Number(newSlab.increment) }]);
        setNewSlab({ from: '', increment: '' });
    };

    const removeSlab = (index: number) => {
        setSlabs(slabs.filter((_, i) => i !== index));
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]"><Loader2 className="animate-spin text-blue-600"/></div>;

    return (
        <div className="min-h-screen bg-[#f8f9fa] font-sans pb-20 text-gray-900 selection:bg-blue-100 selection:text-blue-900">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-800 transition-colors p-2 hover:bg-gray-50 rounded-lg"><ArrowLeft className="w-5 h-5"/></button>
                        <h1 className="text-sm font-black uppercase tracking-widest text-gray-700 truncate max-w-[200px]">{auction?.title}</h1>
                    </div>
                    <div className="flex gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 overflow-x-auto no-scrollbar">
                        {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'CATEGORIES', 'ROLES', 'SPONSORS', 'REGISTRATION'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-2 text-[10px] font-black uppercase transition-all rounded-lg whitespace-nowrap ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-6xl">
                {activeTab === 'SETTINGS' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-transparent flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-600/20 text-white"><Settings className="w-6 h-6"/></div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Auction Identity</h2>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure core tournament logic</p>
                                    </div>
                                </div>
                                <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-8 rounded-xl shadow-lg text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95">
                                    <Save className="w-4 h-4"/> Sync Identity
                                </button>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-1 space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Tournament Logo</label>
                                        <div onClick={() => logoInputRef.current?.click()} className="w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 transition-all overflow-hidden relative group">
                                            {settingsForm.logoUrl ? (
                                                <img src={settingsForm.logoUrl} className="w-full h-full object-contain p-4" />
                                            ) : (
                                                <div className="text-center">
                                                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                    <p className="text-[9px] font-black text-gray-400 uppercase">Select Source</p>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Upload className="text-white w-6 h-6" />
                                            </div>
                                            <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'LOGO')} />
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Event Name</label>
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Event Date</label>
                                            <input type="date" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.date} onChange={e => setSettingsForm({...settingsForm, date: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Total Teams</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.totalTeams} onChange={e => setSettingsForm({...settingsForm, totalTeams: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Squad Size (Max)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.playersPerTeam} onChange={e => setSettingsForm({...settingsForm, playersPerTeam: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Purse Budget (₹)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Standard Min Bid (₹)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.bidIncrement} onChange={e => setSettingsForm({...settingsForm, bidIncrement: Number(e.target.value)})} />
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Global Bidding Slabs</label>
                                            <div className="flex gap-2">
                                                <input placeholder="From ₹" type="number" className="w-24 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none" value={newSlab.from} onChange={e => setNewSlab({...newSlab, from: e.target.value})} />
                                                <input placeholder="+ ₹" type="number" className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none" value={newSlab.increment} onChange={e => setNewSlab({...newSlab, increment: e.target.value})} />
                                                <button onClick={addSlab} className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {slabs.map((slab, i) => (
                                                <div key={i} className="bg-white px-4 py-2.5 rounded-xl border border-gray-200 flex justify-between items-center shadow-sm">
                                                    <span className="text-[10px] font-black text-gray-600 uppercase">Above {slab.from} : +{slab.increment}</span>
                                                    <button onClick={() => removeSlab(i)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                                                </div>
                                            ))}
                                            {slabs.length === 0 && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No custom slabs established</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'PLAYERS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Player Pool ({players.length})</h2>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={exportPlayersToCSV} className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm">
                                    <Download className="w-4 h-4"/> Export CSV
                                </button>
                                <label className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
                                    <FileUp className="w-4 h-4"/> Import XLSX
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleExcelImport(e, 'PLAYER')}/>
                                </label>
                                <button onClick={() => { setModalType('PLAYER'); setEditItem({ name: '', category: 'Standard', role: 'All Rounder', basePrice: settingsForm.basePrice, nationality: 'India' }); setShowModal(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                                    <Plus className="w-4 h-4"/> Add Player
                                </button>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Identity</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Set/Category</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Role</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Value (₹)</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {players.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shadow-sm">
                                                            {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5 m-2.5 text-gray-300"/>}
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-gray-800 text-sm uppercase leading-none">{p.name}</span>
                                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">{p.nationality}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-gray-200">{p.category}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{p.role}</span>
                                                </td>
                                                <td className="px-6 py-4 font-mono font-black text-gray-700 text-sm">₹{p.basePrice}</td>
                                                <td className="px-6 py-4">
                                                    {p.status === 'SOLD' ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-green-600 font-black text-[9px] uppercase tracking-[0.2em]">SOLD</span>
                                                            <span className="text-[8px] text-gray-400 font-bold uppercase truncate max-w-[80px]">{p.soldTo} (₹{p.soldPrice})</span>
                                                        </div>
                                                    ) : p.status === 'UNSOLD' ? (
                                                        <span className="text-red-500 font-black text-[9px] uppercase tracking-[0.2em]">UNSOLD</span>
                                                    ) : (
                                                        <span className="text-gray-300 font-black text-[9px] uppercase tracking-[0.2em]">POOL</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setModalType('PLAYER'); setEditItem(p); setPreviewImage(p.photoUrl); setShowModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-4 h-4"/></button>
                                                        <button onClick={() => handleDelete('PLAYER', String(p.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {players.length === 0 && (
                                <div className="py-20 text-center flex flex-col items-center">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-dashed border-gray-300"><Users className="text-gray-300 w-8 h-8"/></div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Registry is empty</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'REGISTRATION' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-blue-50/50 to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-600/20"><UserCheck className="w-6 h-6 text-white"/></div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Registration Terminal</h2>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure player signup protocols</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl px-6 py-3 shadow-sm">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Public Status</label>
                                    <button onClick={() => setRegConfig({...regConfig, isEnabled: !regConfig.isEnabled})} className={`transition-all active:scale-90 ${regConfig.isEnabled ? 'text-blue-600' : 'text-gray-300'}`}>{regConfig.isEnabled ? <ToggleRight className="w-10 h-10"/> : <ToggleLeft className="w-10 h-10"/>}</button>
                                </div>
                            </div>

                            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <CreditCard className="w-4 h-4"/> Payment Configuration
                                        </h3>
                                        <div className="flex items-center justify-between p-6 bg-gray-50 border-2 rounded-[1.5rem] group cursor-pointer hover:border-blue-400 transition-all shadow-inner" onClick={() => setRegConfig({...regConfig, includePayment: !regConfig.includePayment})}>
                                            <div>
                                                <span className="text-sm font-black text-gray-700 block uppercase tracking-wide">Collect Registration Fee</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase mt-1 block">Require proof of payment to sign up</span>
                                            </div>
                                            {regConfig.includePayment ? <CheckCircle className="w-8 h-8 text-blue-600"/> : <div className="w-8 h-8 border-2 border-gray-200 rounded-full"/>}
                                        </div>
                                    </div>
                                    
                                    {regConfig.includePayment && (
                                        <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2rem] space-y-6 animate-slide-up">
                                            <div>
                                                <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Select Gateway Logic</label>
                                                <div className="flex gap-3">
                                                    <button 
                                                        onClick={() => setRegConfig({...regConfig, paymentMethod: 'MANUAL'})}
                                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${regConfig.paymentMethod === 'MANUAL' ? 'bg-white border-blue-400 text-blue-600 shadow-lg' : 'bg-transparent border-gray-200 text-gray-400 opacity-60'}`}
                                                    >
                                                        <QrCode className="w-4 h-4"/> Manual (UPI)
                                                    </button>
                                                    <button 
                                                        onClick={() => setRegConfig({...regConfig, paymentMethod: 'RAZORPAY'})}
                                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${regConfig.paymentMethod === 'RAZORPAY' ? 'bg-white border-blue-400 text-blue-600 shadow-lg' : 'bg-transparent border-gray-200 text-gray-400 opacity-60'}`}
                                                    >
                                                        <Zap className="w-4 h-4"/> Razorpay
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Fee Amount (₹)</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">₹</span>
                                                    <input type="number" className="w-full bg-white border-2 border-gray-100 rounded-xl px-8 py-3 text-sm font-black text-gray-700 focus:border-blue-400 outline-none" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} />
                                                </div>
                                            </div>

                                            {regConfig.paymentMethod === 'MANUAL' && (
                                                <div className="space-y-6 animate-fade-in">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">UPI ID</label>
                                                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold" value={regConfig.upiId} onChange={e => setRegConfig({...regConfig, upiId: e.target.value})} placeholder="someone@upi" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Account Name</label>
                                                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold" value={regConfig.upiName} onChange={e => setRegConfig({...regConfig, upiName: e.target.value})} placeholder="Official Name" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-3">UPI QR Code Deployment</label>
                                                        <div onClick={() => qrInputRef.current?.click()} className="w-full h-48 bg-white border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all overflow-hidden relative group">
                                                            {regConfig.qrCodeUrl ? (
                                                                <img src={regConfig.qrCodeUrl} className="h-full w-full object-contain p-4" />
                                                            ) : (
                                                                <div className="text-center">
                                                                    <QrCode className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Push QR Source</p>
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <Upload className="text-white w-6 h-6" />
                                                            </div>
                                                            <input ref={qrInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'QR')} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <AlignLeft className="w-4 h-4"/> Terms & Legal Identity
                                        </h3>
                                        <textarea 
                                            className="w-full border-2 border-gray-100 rounded-[1.5rem] p-6 text-xs font-bold text-gray-600 h-48 focus:border-blue-400 outline-none transition-all shadow-inner bg-gray-50/50"
                                            placeholder="Enter your tournament terms and conditions..."
                                            value={regConfig.terms}
                                            onChange={e => setRegConfig({...regConfig, terms: e.target.value})}
                                        />
                                    </div>
                                    <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Info className="w-5 h-5 text-blue-400"/>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Protocol Tip</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wide">
                                            Once you deploy, the public link is active. You can find it in your **Dashboard** main list.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-gray-50 border-t border-gray-100 flex justify-center">
                                <button onClick={handleSaveRegistration} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-16 rounded-[1.5rem] shadow-2xl shadow-blue-600/30 text-sm uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 group">
                                    <Save className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Deploy Registry Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'REQUESTS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4 px-2">
                             <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Registration Queue ({registrations.length})</h2>
                             <button className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline"><Download className="w-4 h-4"/> Export CSV</button>
                        </div>
                        {registrations.length === 0 ? (
                            <div className="p-32 text-center text-gray-400 bg-white rounded-[3rem] border-2 border-dashed border-gray-200 flex flex-col items-center">
                                <UserX className="w-12 h-12 mb-4 opacity-20"/>
                                <p className="font-black uppercase tracking-[0.2em] text-xs">Queue is empty</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {registrations.map(reg => (
                                    <div key={reg.id} className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 border-gray-50">
                                                <img src={reg.profilePic} className="w-full h-full object-cover"/>
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-gray-800 uppercase leading-none mb-1">{reg.fullName}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{reg.playerType} • {reg.mobile}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border-2 ${reg.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-green-50 text-green-600 border-green-200'}`}>{reg.status}</div>
                                            <button className="p-2.5 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all"><Trash2 className="w-4 h-4"/></button>
                                            <button className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest shadow-lg">Verify</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* MODALS */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border border-gray-200 animate-slide-up">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                            <h3 className="text-lg font-black uppercase tracking-tight relative z-10">{editItem?.id ? 'Modify' : 'Initialize'} {modalType}</h3>
                            <button onClick={() => setShowModal(false)} className="relative z-10 hover:rotate-90 transition-transform"><X className="w-6 h-6"/></button>
                        </div>
                        <form onSubmit={handleCrudSave} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Identity Name</label>
                                <input required className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.name || ''} onChange={e => setEditItem({...editItem, name: e.target.value})} />
                            </div>
                            
                            {(modalType === 'TEAM' || modalType === 'PLAYER' || modalType === 'SPONSOR') && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Visual Asset</label>
                                    <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 transition-all overflow-hidden relative group">
                                        {previewImage ? (
                                            <img src={previewImage} className="w-full h-full object-contain p-4" />
                                        ) : (
                                            <div className="text-center">
                                                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                                <p className="text-[9px] font-black text-gray-400 uppercase">Select Source</p>
                                            </div>
                                        )}
                                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'MODAL')} />
                                    </div>
                                </div>
                            )}

                            {modalType === 'TEAM' && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Assigned Purse (₹)</label>
                                    <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.budget} onChange={e => setEditItem({...editItem, budget: Number(e.target.value)})} />
                                </div>
                            )}

                            {modalType === 'PLAYER' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Base Price (₹)</label>
                                        <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Nationality</label>
                                        <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.nationality} onChange={e => setEditItem({...editItem, nationality: e.target.value})} />
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest active:scale-95">Save Registry Protocol</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuctionManage;
