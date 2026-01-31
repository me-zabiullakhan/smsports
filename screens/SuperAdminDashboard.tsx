import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { db } from '../firebase';
import { AuctionSetup, ScoreboardTheme, ScoringAsset, PromoCode, SystemPopup, UserRole, UserProfile } from '../types';
import { 
    Users, Gavel, PlayCircle, Shield, Search, RefreshCw, Trash2, Edit, ExternalLink, 
    LogOut, Database, UserCheck, LayoutDashboard, Settings, Image as ImageIcon, 
    Upload, Save, Eye, EyeOff, Layout, XCircle, Plus, CreditCard, CheckCircle, 
    Tag, Clock, Ban, Check, Zap, Server, Activity, AlertTriangle, HardDrive, 
    Calendar, ShieldCheck, Megaphone, Bell, Timer, Infinity as InfinityIcon, 
    MessageSquare, Layers, Newspaper, Headset, UserMinus, UserPlus, Mail, ShieldAlert, Key, Filter, ChevronDown, UserX, Monitor, Fingerprint
} from 'lucide-react';

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png', 0.8));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const SuperAdminDashboard: React.FC = () => {
    const { state, logout, joinAuction } = useAuction();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'REGISTRY' | 'AUCTIONS' | 'PLANS' | 'PROMOS' | 'ALERTS' | 'BROADCAST' | 'DATABASE' | 'GRAPHICS'>('OVERVIEW');
    const [auctions, setAuctions] = useState<AuctionSetup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        totalAuctions: 0,
        activeAuctions: 0,
        totalAccounts: 0,
        totalPlayers: 0,
        totalMatches: 0,
        totalTeams: 0,
        totalDocsEstimate: 0,
        supportStaffCount: 0
    });

    const totalGB = (stats.totalDocsEstimate * 0.00002).toFixed(2);
    const [logoPreview, setLogoPreview] = useState(state.systemLogoUrl || '');
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Registry / User Management
    const [userRegistry, setUserRegistry] = useState<UserProfile[]>([]);
    const [registryFilter, setRegistryFilter] = useState<'ALL' | 'SUPPORT' | 'ADMIN' | 'VIEWER'>('ALL');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: UserRole.SUPPORT });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ email: '', name: '', password: '', role: UserRole.VIEWER });

    // Auction Management
    const [editingAuctionId, setEditingAuctionId] = useState<string | null>(null);
    const [auctionEditForm, setAuctionEditForm] = useState<Partial<AuctionSetup>>({});

    // Graphics
    const [globalAssets, setGlobalAssets] = useState<ScoringAsset[]>([]);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = db.collection('auctions').onSnapshot(async (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setAuctions(data);
            
            const uniqueOwners = new Set(data.map(a => a.createdBy).filter(Boolean));
            const activeCount = data.filter(a => a.status === 'LIVE' || a.status === 'DRAFT').length;
            
            const matchesSnap = await db.collection('matches').get();
            const playersSnap = await db.collectionGroup('players').get();
            const teamsSnap = await db.collectionGroup('teams').get();
            const staffSnap = await db.collection('users').where('role', '==', UserRole.SUPPORT).get();
            const docCount = snapshot.size + matchesSnap.size + playersSnap.size + teamsSnap.size;

            setStats({ 
                totalAuctions: data.length, 
                activeAuctions: activeCount, 
                totalAccounts: uniqueOwners.size,
                totalPlayers: playersSnap.size,
                totalMatches: matchesSnap.size,
                totalTeams: teamsSnap.size,
                totalDocsEstimate: docCount,
                supportStaffCount: staffSnap.size
            });
            setLoading(false);
        });

        const unsubRegistry = db.collection('users').onSnapshot(snap => {
            const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
            list.sort((a,b) => a.email.localeCompare(b.email));
            setUserRegistry(list);
        });

        const unsubAssets = db.collection('globalAssets').onSnapshot(snap => {
            setGlobalAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScoringAsset)));
        });

        return () => {
            unsubscribe();
            unsubRegistry();
            unsubAssets();
        };
    }, []);

    const handleSaveAuctionMetadata = async () => {
        if (!editingAuctionId) return;
        setIsProcessing(true);
        try {
            await db.collection('auctions').doc(editingAuctionId).update(auctionEditForm);
            setEditingAuctionId(null);
            alert("Auction Metadata Patched!");
        } catch (err: any) { alert("Patch Failed: " + err.message); }
        setIsProcessing(false);
    };

    const handleDeleteAuction = async (id: string, title: string) => {
        if (window.confirm(`PERMANENT DELETION: Purge entire record for "${title}"? This will wipe all data.`)) {
            await db.collection('auctions').doc(id).delete();
        }
    };

    const handleRemoteAssist = (auctionId: string) => {
        if (window.confirm("Entering Remote Assist Mode. You will be redirected to this auction. Proceed?")) {
            joinAuction(auctionId);
            navigate(`/auction/${auctionId}`);
        }
    };

    const filteredAuctions = auctions.filter(a => {
        const term = searchTerm.toLowerCase();
        return a.title.toLowerCase().includes(term) || a.id?.toLowerCase().includes(term) || a.createdBy?.toLowerCase().includes(term);
    });

    const filteredRegistry = userRegistry.filter(u => {
        const matchesRole = registryFilter === 'ALL' || u.role === registryFilter;
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) || (u.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesRole && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-black font-sans text-white selection:bg-red-500 selection:text-white">
            <nav className="bg-zinc-950 border-b border-zinc-800/50 sticky top-0 z-50 backdrop-blur-xl">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveTab('OVERVIEW')}>
                        <div className="bg-red-600 p-2.5 rounded-2xl shadow-xl group-hover:rotate-12 transition-all">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tighter uppercase leading-none">Super Control</h1>
                            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.4em] mt-1 opacity-60">System Root Access</p>
                        </div>
                    </div>
                    <div className="flex bg-zinc-900 rounded-xl p-1 gap-1 overflow-x-auto no-scrollbar">
                        {[
                            {id: 'OVERVIEW', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4"/>},
                            {id: 'REGISTRY', label: 'Users', icon: <Users className="w-4 h-4"/>},
                            {id: 'AUCTIONS', label: 'Auctions', icon: <Gavel className="w-4 h-4"/>},
                        ].map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                            >
                                {t.icon} <span className="hidden lg:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>
                    <button onClick={logout} className="bg-zinc-900 hover:bg-red-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all">
                        <LogOut className="w-4 h-4 mr-2"/> Exit
                    </button>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-10 max-w-7xl">
                {activeTab === 'OVERVIEW' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                { label: 'Storage Usage', val: totalGB, unit: 'GB', color: 'text-red-500' },
                                { label: 'Live Systems', val: stats.activeAuctions, unit: 'PROT', color: 'text-green-500' },
                                { label: 'Identity Pool', val: stats.totalAccounts, unit: 'IDs', color: 'text-blue-500' },
                                { label: 'Support Nodes', val: stats.supportStaffCount, unit: 'Active', color: 'text-white' }
                            ].map(s => (
                                <div key={s.label} className="bg-zinc-900/30 p-10 rounded-[2.5rem] border border-white/5 shadow-inner">
                                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{s.label}</p>
                                    <div className="flex items-baseline gap-2">
                                        <h2 className={`text-5xl font-black ${s.color}`}>{s.val}</h2>
                                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{s.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 shadow-2xl flex flex-col md:flex-row items-center gap-12">
                             <div className="w-48 h-48 rounded-3xl bg-black border-4 border-zinc-800 p-4 shadow-xl flex items-center justify-center overflow-hidden relative">
                                {state.systemLogoUrl ? <img src={state.systemLogoUrl} className="max-w-full max-h-full object-contain" /> : <ImageIcon className="w-12 h-12 text-zinc-800" />}
                             </div>
                             <div className="flex-1 text-center md:text-left">
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Master OS Identity</h2>
                                <p className="text-zinc-400 text-sm max-w-xl mb-8 leading-relaxed font-medium">Inject global system branding that overrides tenant presets across all tournament environments.</p>
                                <button onClick={() => logoInputRef.current?.click()} className="bg-white text-black font-black px-10 py-4 rounded-2xl flex items-center gap-3 transition-all hover:bg-red-600 hover:text-white">
                                    <Upload className="w-5 h-5" /> REFLASH BRANDING
                                </button>
                                <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                        const base64 = await compressImage(e.target.files[0]);
                                        await db.collection('appConfig').doc('globalSettings').set({ systemLogoUrl: base64 }, { merge: true });
                                        alert("System Brand Synced.");
                                    }
                                }} />
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === 'REGISTRY' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-zinc-900/30 p-8 rounded-[2rem] border border-white/5">
                            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6">User Registry</h2>
                            <div className="grid grid-cols-1 gap-4">
                                {filteredRegistry.map(user => (
                                    <div key={user.uid} className="bg-black/40 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold">{user.email}</p>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{user.role}</p>
                                        </div>
                                        <span className="text-[10px] font-mono text-zinc-700">UID: {user.uid.slice(0,8)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'AUCTIONS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="mb-8 relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input 
                                placeholder="SEARCH AUCTIONS..."
                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-[2rem] py-6 pl-16 pr-6 text-sm font-bold uppercase tracking-widest focus:border-red-600 outline-none transition-all shadow-xl"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {filteredAuctions.map(auction => (
                                <div key={auction.id} className="bg-zinc-900/30 p-8 rounded-[2rem] border border-white/5 hover:border-red-600/30 transition-all group overflow-hidden">
                                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                                        <div className="flex items-center gap-6 flex-1 min-w-0">
                                            <div className="w-16 h-16 rounded-2xl bg-black border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                                {auction.logoUrl ? <img src={auction.logoUrl} className="w-full h-full object-contain" /> : <Gavel className="w-6 h-6 text-zinc-700" />}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-2xl font-black uppercase tracking-tighter truncate text-white">{auction.title}</h3>
                                                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-0.5 rounded-full border border-red-500/20">#{auction.id}</span>
                                                    <span className={`text-[9px] font-black px-3 py-0.5 rounded-full border ${auction.razorpayAuthorized ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}>
                                                        {auction.razorpayAuthorized ? 'PAYMENT AUTH' : 'PAYMENT LOCKED'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right hidden md:block">
                                                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border ${auction.isPaid ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}>
                                                    {auction.isPaid ? 'Paid' : 'Trial'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingAuctionId(auction.id!); setAuctionEditForm(auction); }} className="bg-zinc-800 hover:bg-zinc-700 p-4 rounded-2xl border border-white/5 flex items-center gap-2">
                                                    <Edit className="w-5 h-5 text-zinc-400" />
                                                </button>
                                                <button onClick={() => handleRemoteAssist(auction.id!)} className="bg-blue-600 hover:bg-blue-500 p-4 rounded-2xl"><Monitor className="w-5 h-5 text-white" /></button>
                                                <button onClick={() => handleDeleteAuction(auction.id!, auction.title)} className="bg-zinc-800 hover:bg-red-600 p-4 rounded-2xl"><Trash2 className="w-5 h-5 text-zinc-400 group-hover:text-white" /></button>
                                            </div>
                                        </div>
                                    </div>

                                    {editingAuctionId === auction.id && (
                                        <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-4 gap-8 animate-slide-up bg-zinc-950/30 p-6 rounded-3xl">
                                            <div className="col-span-full mb-4 flex items-center gap-2">
                                                <Fingerprint className="w-4 h-4 text-red-500" />
                                                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-300">Advanced Override Panel</h4>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Integrated Payments (Razorpay)</label>
                                                <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                                                    <span className="text-[10px] font-bold text-zinc-400">Authorize Integrated Gateway</span>
                                                    <button 
                                                        onClick={() => setAuctionEditForm({...auctionEditForm, razorpayAuthorized: !auctionEditForm.razorpayAuthorized})}
                                                        className={`w-12 h-6 rounded-full transition-all relative ${auctionEditForm.razorpayAuthorized ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${auctionEditForm.razorpayAuthorized ? 'left-7' : 'left-1'}`}></div>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-end col-start-4">
                                                <button onClick={handleSaveAuctionMetadata} className="w-full bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95">SYNC OVERRIDE</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SuperAdminDashboard;