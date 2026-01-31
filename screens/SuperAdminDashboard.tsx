
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
        totalAuctions: 0, activeAuctions: 0, totalAccounts: 0, totalPlayers: 0, totalMatches: 0, totalTeams: 0, totalDocsEstimate: 0, supportStaffCount: 0
    });

    const totalGB = (stats.totalDocsEstimate * 0.00002).toFixed(2);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Registry States
    const [userRegistry, setUserRegistry] = useState<UserProfile[]>([]);
    const [registryFilter, setRegistryFilter] = useState<'ALL' | 'SUPPORT' | 'ADMIN' | 'VIEWER'>('ALL');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: UserRole.SUPPORT });

    // Auction States
    const [editingAuctionId, setEditingAuctionId] = useState<string | null>(null);
    const [auctionEditForm, setAuctionEditForm] = useState<Partial<AuctionSetup>>({});

    // Plans States
    const [dbPlans, setDbPlans] = useState<any[]>([]);
    const [planForm, setPlanForm] = useState({ id: '', name: '', price: 0, teams: 0 });
    const [isAddingPlan, setIsAddingPlan] = useState(false);

    // Promos States
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [isAddingPromo, setIsAddingPromo] = useState(false);
    const [promoForm, setPromoForm] = useState<Partial<PromoCode>>({
        code: '', discountType: 'PERCENT', discountValue: 0, maxClaims: 10, expiryDate: Date.now() + 604800000, active: true
    });

    // System Broadcaster States
    const [popups, setPopups] = useState<SystemPopup[]>([]);
    const [isAddingPopup, setIsAddingPopup] = useState(false);
    const [popupForm, setPopupForm] = useState<Partial<SystemPopup>>({
        title: '', message: '', showImage: false, showText: true, delaySeconds: 5, okButtonText: 'OK', closeButtonText: 'CLOSE', isActive: true, expiryDate: Date.now() + 86400000 * 7
    });
    const [popupPreviewImg, setPopupPreviewImg] = useState('');

    // Database Ops State
    const [retentionDays, setRetentionDays] = useState(30);
    const [globalAssets, setGlobalAssets] = useState<ScoringAsset[]>([]);
    const [assetPreview, setAssetPreview] = useState('');
    const [broadcasts, setBroadcasts] = useState<any[]>([]);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = db.collection('auctions').onSnapshot(async (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setAuctions(data);
            
            const uniqueOwners = new Set(data.map(a => a.createdBy).filter(Boolean));
            const activeCount = data.filter(a => a.status === 'LIVE' || a.status === 'DRAFT').length;
            setStats(prev => ({ ...prev, totalAuctions: data.length, activeAuctions: activeCount, totalAccounts: uniqueOwners.size }));
            setLoading(false);
        });

        const unsubRegistry = db.collection('users').onSnapshot(snap => {
            setUserRegistry(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
        });

        const unsubPlans = db.collection('subscriptionPlans').orderBy('price', 'asc').onSnapshot(snap => {
            setDbPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubPromos = db.collection('promoCodes').onSnapshot(snap => {
            setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode)));
        });

        const unsubPopups = db.collection('systemPopups').orderBy('createdAt', 'desc').onSnapshot(snap => {
            setPopups(snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemPopup)));
        });

        const unsubAssets = db.collection('globalAssets').onSnapshot(snap => {
            setGlobalAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScoringAsset)));
        });

        const unsubBroadcasts = db.collection('systemBroadcasts').onSnapshot(snap => {
            setBroadcasts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubscribe(); unsubRegistry(); unsubPlans(); unsubPromos(); unsubPopups(); unsubAssets(); unsubBroadcasts();
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

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            await db.collection('users').add({ ...userForm, createdAt: Date.now() });
            setIsAddingUser(false);
            setUserForm({ email: '', name: '', password: '', role: UserRole.SUPPORT });
        } catch (e: any) { alert(e.message); }
        setIsProcessing(false);
    };

    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            if (planForm.id) await db.collection('subscriptionPlans').doc(planForm.id).update(planForm);
            else await db.collection('subscriptionPlans').add({ ...planForm, createdAt: Date.now() });
            setIsAddingPlan(false);
            setPlanForm({ id: '', name: '', price: 0, teams: 0 });
        } catch (e: any) { alert(e.message); }
        setIsProcessing(false);
    };

    const handleSavePromo = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            await db.collection('promoCodes').add({ ...promoForm, code: promoForm.code?.toUpperCase(), currentClaims: 0, createdAt: Date.now() });
            setIsAddingPromo(false);
        } catch (e: any) { alert(e.message); }
        setIsProcessing(false);
    };

    const handleSavePopup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            await db.collection('systemPopups').add({ ...popupForm, imageUrl: popupPreviewImg, createdAt: Date.now() });
            setIsAddingPopup(false);
        } catch (e: any) { alert(e.message); }
        setIsProcessing(false);
    };

    const handleRemoteAssist = (auctionId: string) => {
        if (!auctionId) return alert("No auction ID provided.");
        if (window.confirm("REMOTE ASSIST: Jump into this auction dashboard with Super Admin Access?")) {
            joinAuction(auctionId);
            navigate(`/auction/${auctionId}`);
        }
    };

    const filteredAuctions = auctions.filter(a => {
        const term = searchTerm.toLowerCase();
        return a.title.toLowerCase().includes(term) || a.id?.toLowerCase().includes(term);
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
                            {id: 'PLANS', label: 'Plans', icon: <Server className="w-4 h-4"/>},
                            {id: 'PROMOS', label: 'Promos', icon: <Tag className="w-4 h-4"/>},
                            {id: 'ALERTS', label: 'Alerts', icon: <Megaphone className="w-4 h-4"/>},
                            {id: 'BROADCAST', label: 'Ticker', icon: <Newspaper className="w-4 h-4"/>},
                            {id: 'DATABASE', label: 'Database', icon: <HardDrive className="w-4 h-4"/>},
                            {id: 'GRAPHICS', label: 'Graphics', icon: <ImageIcon className="w-4 h-4"/>},
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
                                { label: 'Live Auctions', val: auctions.length, unit: 'Active', color: 'text-green-500' },
                                { label: 'Identity Pool', val: userRegistry.length, unit: 'IDs', color: 'text-blue-500' },
                                { label: 'Support Nodes', val: userRegistry.filter(u => u.role === UserRole.SUPPORT).length, unit: 'Online', color: 'text-white' }
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
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">User Registry</h2>
                            <button onClick={() => setIsAddingUser(true)} className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Plus className="w-4 h-4"/> ADD IDENTITY</button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {userRegistry.map(user => (
                                <div key={user.uid} className="bg-zinc-900/30 p-6 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-lg">{user.email}</p>
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{user.role}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={async () => { if(window.confirm("Purge?")) await db.collection('users').doc(user.uid).delete(); }} className="p-3 bg-zinc-800 rounded-xl hover:bg-red-600 transition-all text-zinc-400 hover:text-white"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'AUCTIONS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="mb-8 relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input 
                                placeholder="SEARCH AUCTIONS BY TITLE OR ID..."
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
                                                        {auction.razorpayAuthorized ? 'RAZORPAY AUTH' : 'PAYMENT LOCKED'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingAuctionId(auction.id!); setAuctionEditForm(auction); }} className="p-4 bg-zinc-800 rounded-2xl hover:bg-zinc-700 transition-all border border-white/5"><Edit className="w-5 h-5 text-zinc-400" /></button>
                                            <button onClick={() => handleRemoteAssist(auction.id!)} className="p-4 bg-blue-600 rounded-2xl hover:bg-blue-500 transition-all shadow-xl"><Monitor className="w-5 h-5 text-white" /></button>
                                            <button onClick={async () => { if(window.confirm("Purge?")) db.collection('auctions').doc(auction.id!).delete(); }} className="p-4 bg-zinc-800 rounded-2xl hover:bg-red-600 transition-all border border-white/5"><Trash2 className="w-5 h-5 text-zinc-400 group-hover:text-white" /></button>
                                        </div>
                                    </div>

                                    {editingAuctionId === auction.id && (
                                        <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-4 gap-8 animate-slide-up bg-zinc-950/30 p-6 rounded-3xl">
                                            <div className="col-span-full mb-4 flex items-center gap-2">
                                                <Fingerprint className="w-4 h-4 text-red-500" />
                                                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-300">Advanced Override Panel</h4>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-2">Integrated Payments (Razorpay)</label>
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
                                            <div>
                                                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Retention Lock</label>
                                                <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                                                    <span className="text-[10px] font-bold text-zinc-400">Permanent Active</span>
                                                    <button 
                                                        onClick={() => setAuctionEditForm({...auctionEditForm, isLifetime: !auctionEditForm.isLifetime})}
                                                        className={`w-12 h-6 rounded-full transition-all relative ${auctionEditForm.isLifetime ? 'bg-red-600' : 'bg-zinc-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${auctionEditForm.isLifetime ? 'left-7' : 'left-1'}`}></div>
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

                {activeTab === 'PLANS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Monetization Tier Manager</h2>
                            <button onClick={() => setIsAddingPlan(true)} className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Plus className="w-4 h-4"/> NEW PLAN</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {dbPlans.map(plan => (
                                <div key={plan.id} className="bg-zinc-900/30 p-8 rounded-[2rem] border border-white/5 relative group">
                                    <button onClick={async () => { if(window.confirm("Delete?")) db.collection('subscriptionPlans').doc(plan.id).delete(); }} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    <h3 className="text-xl font-black uppercase mb-4">{plan.name}</h3>
                                    <p className="text-4xl font-black text-blue-500 mb-6">₹{plan.price}</p>
                                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-500"><Users className="w-4 h-4"/> UPTO {plan.teams} TEAMS</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'PROMOS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Authorized Promos</h2>
                            <button onClick={() => setIsAddingPromo(true)} className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Plus className="w-4 h-4"/> NEW PROMO</button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {promos.map(promo => (
                                <div key={promo.id} className="bg-zinc-900/30 p-6 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <div>
                                        <p className="font-black text-2xl tracking-widest text-emerald-400">{promo.code}</p>
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase">{promo.discountType}: {promo.discountValue}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-zinc-400">{promo.currentClaims} / {promo.maxClaims} Claims</p>
                                        <button onClick={async () => { if(window.confirm("Purge?")) db.collection('promoCodes').doc(promo.id!).delete(); }} className="text-red-500 mt-2 hover:underline text-[10px] font-black">PURGE CODE</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'ALERTS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">System Broadcaster</h2>
                            <button onClick={() => setIsAddingPopup(true)} className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Plus className="w-4 h-4"/> NEW ALERT</button>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            {popups.map(popup => (
                                <div key={popup.id} className="bg-zinc-900/30 p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row gap-8 items-center">
                                    {popup.imageUrl && <div className="w-40 h-40 bg-black rounded-3xl overflow-hidden shadow-xl"><img src={popup.imageUrl} className="w-full h-full object-cover" /></div>}
                                    <div className="flex-1">
                                        <h3 className="text-xl font-black uppercase mb-2">{popup.title}</h3>
                                        <p className="text-sm text-zinc-500 line-clamp-2">{popup.message}</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={async () => { if(window.confirm("Delete?")) db.collection('systemPopups').doc(popup.id!).delete(); }} className="bg-zinc-800 p-4 rounded-2xl hover:bg-red-600 transition-all border border-white/5"><Trash2 className="w-5 h-5"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'BROADCAST' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Global Ticker Registry</h2>
                        <div className="bg-zinc-900/30 p-8 rounded-[2.5rem] border border-white/5">
                            <div className="space-y-4">
                                {broadcasts.map(b => (
                                    <div key={b.id} className="bg-black/40 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                        <p className="text-sm font-bold uppercase tracking-widest">{b.message}</p>
                                        <button onClick={async () => db.collection('systemBroadcasts').doc(b.id).delete()} className="text-red-500 hover:scale-110 transition-transform"><XCircle className="w-5 h-5"/></button>
                                    </div>
                                ))}
                                <div className="pt-6 border-t border-white/5 flex gap-4">
                                    <input id="ticker-msg" placeholder="ENTER GLOBAL HIGHLIGHT PROTOCOL..." className="flex-1 bg-black border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-red-600 transition-colors uppercase tracking-widest" />
                                    <button onClick={async () => {
                                        const msg = (document.getElementById('ticker-msg') as HTMLInputElement).value;
                                        if(msg) { await db.collection('systemBroadcasts').add({ message: msg, createdAt: Date.now() }); (document.getElementById('ticker-msg') as HTMLInputElement).value = ''; }
                                    }} className="bg-blue-600 px-10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl">DEPLOY</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'DATABASE' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-zinc-900/30 p-10 rounded-[3rem] border border-white/5">
                            <div className="flex items-center gap-6 mb-8">
                                <Database className="w-12 h-12 text-red-500" />
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter">Retention Protocol</h2>
                                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Configure automated system purging policies</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Default Registry TTL (Days)</label>
                                    <div className="flex items-center gap-4">
                                        <input type="number" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))} className="w-24 bg-black border border-white/10 rounded-2xl py-4 text-center text-xl font-black" />
                                        <button onClick={async () => { await db.collection('appConfig').doc('globalSettings').set({ defaultRetentionDays: retentionDays }, { merge: true }); alert("TTL Policy Updated."); }} className="bg-white text-black px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl">SYNC POLICY</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'GRAPHICS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Global Asset Vault</h2>
                            <div className="flex gap-2">
                                <input type="file" id="asset-up" className="hidden" accept="image/*" onChange={async (e) => {
                                    if(e.target.files?.[0]) setAssetPreview(await compressImage(e.target.files[0]));
                                }} />
                                <button onClick={() => document.getElementById('asset-up')?.click()} className="bg-zinc-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 hover:bg-zinc-700">SELECT SOURCE</button>
                                <button onClick={async () => {
                                    if(assetPreview) { await db.collection('globalAssets').add({ url: assetPreview, name: 'Global Asset ' + Date.now(), createdAt: Date.now(), type: 'BACKGROUND' }); setAssetPreview(''); alert("Asset Synced."); }
                                }} className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">PUSH TO ALL</button>
                            </div>
                        </div>
                        {assetPreview && <div className="w-full h-48 bg-zinc-900 rounded-3xl overflow-hidden mb-6 flex justify-center p-4 border border-blue-500/30"><img src={assetPreview} className="max-h-full object-contain" /></div>}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {globalAssets.map(asset => (
                                <div key={asset.id} className="aspect-video bg-zinc-900 rounded-2xl border border-white/5 overflow-hidden group relative shadow-lg">
                                    <img src={asset.url} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                                    <button onClick={async () => db.collection('globalAssets').doc(asset.id).delete()} className="absolute top-2 right-2 bg-red-600 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl"><Trash2 className="w-3 h-3 text-white"/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Modals Implementation */}
            {isAddingPlan && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/10 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black uppercase tracking-tighter">Monetization Protocol</h3>
                            <button onClick={() => setIsAddingPlan(false)}><XCircle className="w-6 h-6 text-zinc-500 hover:text-white transition-colors"/></button>
                        </div>
                        <form onSubmit={handleSavePlan} className="space-y-4">
                            <input placeholder="PLAN NAME" className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-xs font-bold uppercase tracking-widest outline-none focus:border-blue-500" value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} required />
                            <input type="number" placeholder="PRICE (₹)" className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-xs font-bold outline-none focus:border-blue-500" value={planForm.price} onChange={e => setPlanForm({...planForm, price: Number(e.target.value)})} required />
                            <input type="number" placeholder="MAX FRANCHISE TEAMS" className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-xs font-bold outline-none focus:border-blue-500" value={planForm.teams} onChange={e => setPlanForm({...planForm, teams: Number(e.target.value)})} required />
                            <button type="submit" className="w-full bg-blue-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95">AUTHORIZE SUBSCRIPTION</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;
