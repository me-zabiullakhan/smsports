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
        title: '', date: '', sport: '', purseValue: 0, basePrice: 0, bidIncrement: 0, playersPerTeam: 0, totalTeams: 0
    });
    
    // CRUD Modals
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'TEAM' | 'PLAYER' | 'CATEGORY' | 'ROLE' | 'SPONSOR' | 'CSV'>('TEAM');
    const [editItem, setEditItem] = useState<any>(null);
    const [previewImage, setPreviewImage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!id) return;
        const unsubAuction = db.collection('auctions').doc(id).onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data() as AuctionSetup;
                setAuction(data);
                if (data.registrationConfig) setRegConfig({ ...DEFAULT_REG_CONFIG, ...data.registrationConfig });
                setSettingsForm({
                    title: data.title || '', date: data.date || '', sport: data.sport || '', purseValue: data.purseValue || 0,
                    basePrice: data.basePrice || 0, bidIncrement: data.bidIncrement || 0, playersPerTeam: data.playersPerTeam || 0, totalTeams: data.totalTeams || 0
                });
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

    const handleSaveRegistration = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({ registrationConfig: regConfig });
            alert("Registration Protocol Deployed!");
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setPreviewImage(base64);
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

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                {activeTab === 'SETTINGS' && (
                    <div className="bg-white rounded-[2rem] p-10 border border-gray-200 shadow-sm animate-fade-in space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Tournament Title</label>
                                <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Event Date</label>
                                <input type="date" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.date} onChange={e => setSettingsForm({...settingsForm, date: e.target.value})}/>
                            </div>
                        </div>
                        <button onClick={() => { db.collection('auctions').doc(id!).update(settingsForm); alert("Settings Updated!"); }} className="bg-black hover:bg-zinc-800 text-white font-black py-4 px-12 rounded-xl text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">Save Core Identity</button>
                    </div>
                )}

                {activeTab === 'TEAMS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Franchise Registry ({teams.length})</h2>
                            <div className="flex gap-2">
                                <label className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-gray-50 transition-all flex items-center gap-2">
                                    <FileUp className="w-4 h-4"/> Import XLSX
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleExcelImport(e, 'TEAM')}/>
                                </label>
                                <button onClick={() => { setModalType('TEAM'); setEditItem({ name: '', owner: '', budget: settingsForm.purseValue }); setShowModal(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-600/20"><Plus className="w-4 h-4"/> Add Team</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teams.map(team => (
                                <div key={team.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-200 shadow-sm flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 p-1">
                                            {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-contain" /> : <Users className="text-gray-300 w-6 h-6"/>}
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-800 uppercase text-sm leading-none">{team.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">₹{team.budget}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setModalType('TEAM'); setEditItem(team); setPreviewImage(team.logoUrl); setShowModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete('TEAM', String(team.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'PLAYERS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Player Pool ({players.length})</h2>
                            <div className="flex gap-2">
                                <label className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-gray-50 transition-all flex items-center gap-2">
                                    <FileUp className="w-4 h-4"/> Import XLSX
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleExcelImport(e, 'PLAYER')}/>
                                </label>
                                <button onClick={() => { setModalType('PLAYER'); setEditItem({ name: '', category: 'Standard', role: 'All Rounder', basePrice: settingsForm.basePrice }); setShowModal(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4"/> Add Player</button>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Category</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Role</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Base</th>
                                            <th className="px-6 py-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {players.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 border overflow-hidden">
                                                            {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" /> : <User className="w-4 h-4 m-2 text-gray-300"/>}
                                                        </div>
                                                        <span className="font-bold text-gray-700 text-sm">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-gray-500">{p.category}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-gray-500">{p.role}</td>
                                                <td className="px-6 py-4 font-mono font-bold text-blue-600 text-sm">{p.basePrice}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setModalType('PLAYER'); setEditItem(p); setPreviewImage(p.photoUrl); setShowModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                                        <button onClick={() => handleDelete('PLAYER', String(p.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
                                                        onClick={() => auction?.razorpayAuthorized ? setRegConfig({...regConfig, paymentMethod: 'RAZORPAY'}) : alert("RAZORPAY LOCKED: Please contact Support to authorize integrated payments for this tournament.")}
                                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${regConfig.paymentMethod === 'RAZORPAY' ? 'bg-white border-blue-400 text-blue-600 shadow-lg' : 'bg-transparent border-gray-200 text-gray-400'} ${!auction?.razorpayAuthorized ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                                                    >
                                                        <Zap className="w-4 h-4"/> Razorpay
                                                    </button>
                                                </div>
                                                {!auction?.razorpayAuthorized && (
                                                    <p className="text-[9px] text-orange-600 font-black uppercase leading-relaxed text-center mt-3 bg-orange-100/50 p-2 rounded-lg">Integrated Gateway requires Super Admin Authorization</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Fee Amount (₹)</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">₹</span>
                                                    <input type="number" className="w-full bg-white border-2 border-gray-100 rounded-xl px-8 py-3 text-sm font-black text-gray-700 focus:border-blue-400 outline-none" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} />
                                                </div>
                                            </div>

                                            {regConfig.paymentMethod === 'RAZORPAY' && auction?.razorpayAuthorized && (
                                                <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl animate-fade-in">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Key className="w-5 h-5 text-indigo-200" />
                                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Razorpay Key ID</span>
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-white/40 outline-none focus:bg-white/20 transition-all" 
                                                        value={regConfig.razorpayKey || ''} 
                                                        onChange={e => setRegConfig({...regConfig, razorpayKey: e.target.value})} 
                                                        placeholder="rzp_live_xxxxxxxxxxxx" 
                                                    />
                                                    <p className="text-[8px] text-indigo-200 font-bold uppercase mt-3 tracking-widest leading-relaxed text-center">Fetch this from your Razorpay Dashboard > Settings > API Keys</p>
                                                </div>
                                            )}

                                            {regConfig.paymentMethod === 'MANUAL' && (
                                                <div className="space-y-4 animate-fade-in">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">UPI ID</label>
                                                        <input type="text" className="w-full border rounded-lg px-4 py-2 text-sm font-bold" value={regConfig.upiId} onChange={e => setRegConfig({...regConfig, upiId: e.target.value})} placeholder="someone@upi" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">UPI Name</label>
                                                        <input type="text" className="w-full border rounded-lg px-4 py-2 text-sm font-bold" value={regConfig.upiName} onChange={e => setRegConfig({...regConfig, upiName: e.target.value})} placeholder="Official Name" />
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
                                            <button onClick={() => handleDelete('REGISTRATION', reg.id)} className="p-2.5 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all"><Trash2 className="w-4 h-4"/></button>
                                            <button onClick={async () => {
                                                await db.collection('auctions').doc(id!).collection('registrations').doc(reg.id).update({ status: 'APPROVED' });
                                            }} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest shadow-lg">Verify</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {(activeTab === 'CATEGORIES' || activeTab === 'ROLES' || activeTab === 'SPONSORS') && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Manage {activeTab}</h2>
                            <button onClick={() => {
                                setModalType(activeTab === 'CATEGORIES' ? 'CATEGORY' : activeTab === 'ROLES' ? 'ROLE' : 'SPONSOR');
                                setEditItem({});
                                setShowModal(true);
                            }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Plus className="w-4 h-4"/> Add New</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(activeTab === 'CATEGORIES' ? categories : activeTab === 'ROLES' ? roles : sponsors).map((item: any) => (
                                <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden">
                                            {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain" /> : <Layers className="text-gray-300 w-5 h-5"/>}
                                        </div>
                                        <p className="font-black text-gray-800 uppercase text-xs">{item.name}</p>
                                    </div>
                                    <button onClick={() => handleDelete(activeTab.slice(0, -1), item.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* CRUD MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border border-gray-200">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                            <h3 className="text-lg font-black uppercase tracking-tight">{editItem?.id ? 'Edit' : 'Add'} {modalType}</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-6 h-6"/></button>
                        </div>
                        <form onSubmit={handleCrudSave} className="p-8 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Identity Name</label>
                                <input required className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem?.name || ''} onChange={e => setEditItem({...editItem, name: e.target.value})} />
                            </div>
                            
                            {(modalType === 'TEAM' || modalType === 'PLAYER' || modalType === 'SPONSOR') && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Visual Asset</label>
                                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-100 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                                        {previewImage ? <img src={previewImage} className="h-20 mx-auto object-contain" /> : <div className="text-gray-400 text-xs font-bold uppercase"><Upload className="w-6 h-6 mx-auto mb-2 opacity-20"/> Select Source</div>}
                                    </div>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </div>
                            )}

                            {(modalType === 'TEAM' || modalType === 'PLAYER' || modalType === 'CATEGORY') && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{modalType === 'TEAM' ? 'Purse' : 'Base Price'}</label>
                                    <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={modalType === 'TEAM' ? editItem?.budget : editItem?.basePrice} onChange={e => setEditItem({...editItem, [modalType === 'TEAM' ? 'budget' : 'basePrice']: Number(e.target.value)})} />
                                </div>
                            )}

                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-xl transition-all uppercase text-xs tracking-widest active:scale-95">Save Registry Protocol</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuctionManage;
