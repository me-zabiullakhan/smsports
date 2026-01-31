
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
    MessageSquare, Layers, Newspaper, Headset, UserMinus, UserPlus, Mail, ShieldAlert, Key, Filter, ChevronDown, UserX, Monitor
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
                canvas.width = width; canvas.height = height;
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

    // Fix: Added missing totalGB definition to be used on lines 471 and 856
    const totalGB = (stats.totalDocsEstimate * 0.00002).toFixed(2);

    const [logoPreview, setLogoPreview] = useState(state.systemLogoUrl || '');
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Common States
    const [isProcessing, setIsProcessing] = useState(false);

    // Registry / User Management States
    const [userRegistry, setUserRegistry] = useState<UserProfile[]>([]);
    const [registryFilter, setRegistryFilter] = useState<'ALL' | 'SUPPORT' | 'ADMIN' | 'VIEWER'>('ALL');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: UserRole.SUPPORT });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ email: '', name: '', password: '', role: UserRole.VIEWER });

    // Auction Management (Metadata Editing)
    const [editingAuctionId, setEditingAuctionId] = useState<string | null>(null);
    const [auctionEditForm, setAuctionEditForm] = useState<Partial<AuctionSetup>>({});

    // Plans Management
    const [dbPlans, setDbPlans] = useState<any[]>([]);
    const [planForm, setPlanForm] = useState({ id: '', name: '', price: 0, teams: 0 });
    const [isAddingPlan, setIsAddingPlan] = useState(false);

    // Promo Codes State
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [isAddingPromo, setIsAddingPromo] = useState(false);
    const [promoForm, setPromoForm] = useState<Partial<PromoCode>>({
        code: '', discountType: 'PERCENT', discountValue: 0, maxClaims: 10, expiryDate: Date.now() + 604800000, active: true
    });

    // System Popups State
    const [popups, setPopups] = useState<SystemPopup[]>([]);
    const [isAddingPopup, setIsAddingPopup] = useState(false);
    const [popupForm, setPopupForm] = useState<Partial<SystemPopup>>({
        title: '', message: '', imageUrl: '', showImage: false, showText: true, delaySeconds: 5, okButtonText: 'UNDERSTOOD', closeButtonText: 'CLOSE', expiryDate: Date.now() + 86400000 * 7, isActive: true
    });
    const [popupPreviewImg, setPopupPreviewImg] = useState('');
    const popupImgRef = useRef<HTMLInputElement>(null);

    // Database Ops State
    const [retentionDays, setRetentionDays] = useState(30);
    const [savingRetention, setSavingRetention] = useState(false);

    // Graphics Library State
    const [globalAssets, setGlobalAssets] = useState<ScoringAsset[]>([]);
    const [isAddingAsset, setIsAddingAsset] = useState(false);
    const [assetForm, setAssetForm] = useState({ name: '', type: 'BACKGROUND' as ScoringAsset['type'] });
    const [assetPreview, setAssetPreview] = useState('');
    const assetInputRef = useRef<HTMLInputElement>(null);

    // Broadcast State
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [isAddingBroadcast, setIsAddingBroadcast] = useState(false);
    const [broadcastForm, setBroadcastForm] = useState({ message: '', isActive: true });

    useEffect(() => {
        setLoading(true);
        // Auctions Listener (All system auctions)
        const unsubscribe = db.collection('auctions').onSnapshot(async (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setAuctions(data);
            
            const uniqueOwners = new Set(data.map(a => a.createdBy).filter(Boolean));
            const activeCount = data.filter(a => a.status === 'LIVE' || a.status === 'DRAFT' || (a.status as any) === 'IN_PROGRESS' || (a.status as any) === 'LIVE').length;
            
            setStats(prev => ({ 
                ...prev,
                totalAuctions: data.length, 
                activeAuctions: activeCount, 
                totalAccounts: uniqueOwners.size
            }));

            // Deep stats fetch once on load
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

        // Registry Listener (All Users)
        const unsubRegistry = db.collection('users').onSnapshot(snap => {
            const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
            list.sort((a,b) => a.email.localeCompare(b.email));
            setUserRegistry(list);
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

        const unsubRetention = db.collection('appConfig').doc('globalSettings').onSnapshot(doc => {
            if(doc.exists) setRetentionDays(doc.data()?.defaultRetentionDays || 30);
        });

        const unsubAssets = db.collection('globalAssets').onSnapshot(snap => {
            setGlobalAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScoringAsset)));
        });

        const unsubBroadcasts = db.collection('systemBroadcasts').onSnapshot(snap => {
            setBroadcasts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubscribe();
            unsubRegistry();
            unsubPlans();
            unsubPromos();
            unsubPopups();
            unsubRetention();
            unsubAssets();
            unsubBroadcasts();
        };
    }, []);

    // 0. Registry Handlers
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userForm.email || !userForm.password) return;
        setIsProcessing(true);
        try {
            const usersRef = db.collection('users');
            const snap = await usersRef.where('email', '==', userForm.email.toLowerCase()).limit(1).get();
            let userDocId = snap.empty ? `USER_${Date.now()}` : snap.docs[0].id;

            await usersRef.doc(userDocId).set({
                email: userForm.email.toLowerCase(),
                name: userForm.name || 'New User',
                role: userForm.role,
                password: userForm.password,
                createdAt: Date.now()
            }, { merge: true });

            setIsAddingUser(false);
            setUserForm({ email: '', name: '', password: '', role: UserRole.SUPPORT });
            alert("Registry Identity Established!");
        } catch (err: any) { alert("Fail: " + err.message); }
        setIsProcessing(false);
    };

    const handleUpdateUser = async (uid: string) => {
        setIsProcessing(true);
        try {
            await db.collection('users').doc(uid).update({
                name: editForm.name,
                email: editForm.email.toLowerCase(),
                password: editForm.password,
                role: editForm.role
            });
            setEditingUserId(null);
            alert("Registry Profile Synced.");
        } catch (err: any) { alert("Failed Update: " + err.message); }
        setIsProcessing(false);
    };

    const handleDeleteUser = async (uid: string, email: string) => {
        if (window.confirm(`Permanently terminate access for ${email}? This cannot be undone.`)) {
            await db.collection('users').doc(uid).delete();
        }
    };

    const handleOpenEdit = (user: UserProfile) => {
        setEditingUserId(user.uid);
        setEditForm({
            name: user.name || '',
            email: user.email,
            password: (user as any).password || '',
            role: user.role
        });
    };

    // 1. Auction Handlers
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
        if (window.confirm(`PERMANENT DELETION: Purge entire record for "${title}"? All teams, players and logs will be deleted.`)) {
            await db.collection('auctions').doc(id).delete();
        }
    };

    const handleRemoteAssist = (auctionId: string) => {
        if (window.confirm("Entering Remote Assist Mode. You will be redirected to this auction's management terminal. Proceed?")) {
            joinAuction(auctionId);
            navigate(`/auction/${auctionId}`);
        }
    };

    // 2. Subscription Plan Handlers
    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!planForm.name) return;
        setIsProcessing(true);
        try {
            const pData = {
                name: planForm.name,
                price: Number(planForm.price),
                teams: Number(planForm.teams),
                updatedAt: Date.now()
            };
            if (planForm.id) {
                await db.collection('subscriptionPlans').doc(planForm.id).update(pData);
            } else {
                await db.collection('subscriptionPlans').add({ ...pData, createdAt: Date.now() });
            }
            setIsAddingPlan(false);
            setPlanForm({ id: '', name: '', price: 0, teams: 0 });
            alert("Subscription Protocol Authorized!");
        } catch (err: any) { alert("Fail: " + err.message); }
        setIsProcessing(false);
    };

    const deletePlan = async (id: string) => {
        if (window.confirm("Permanently purge this subscription plan? This will affect new upgrades.")) {
            await db.collection('subscriptionPlans').doc(id).delete();
        }
    };

    // Filters for Registry & Auctions
    const filteredRegistry = userRegistry.filter(u => {
        const matchesRole = registryFilter === 'ALL' || u.role === registryFilter;
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) || (u.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesRole && matchesSearch;
    });

    const filteredAuctions = auctions.filter(a => {
        const term = searchTerm.toLowerCase();
        return a.title.toLowerCase().includes(term) || a.id?.toLowerCase().includes(term) || a.createdBy?.toLowerCase().includes(term);
    });

    // 3. Promo Handlers
    const handleSavePromo = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const data = { ...promoForm, code: promoForm.code?.toUpperCase(), currentClaims: 0, active: true, createdAt: Date.now() };
            await db.collection('promoCodes').add(data);
            setIsAddingPromo(false);
            setPromoForm({ code: '', discountType: 'PERCENT', discountValue: 0, maxClaims: 10, expiryDate: Date.now() + 604800000 });
            alert("Promo Code Authorized!");
        } catch (err: any) { alert("Failed: " + err.message); }
        setIsProcessing(false);
    };

    const deletePromo = async (id: string) => {
        if (window.confirm("Purge promo protocol from registry?")) {
            await db.collection('promoCodes').doc(id).delete();
        }
    };

    // 4. Popup Handlers
    const handleSavePopup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const data = { ...popupForm, imageUrl: popupPreviewImg, createdAt: Date.now() };
            if (popupForm.id) {
                await db.collection('systemPopups').doc(popupForm.id).update(data);
            } else {
                await db.collection('systemPopups').add(data);
            }
            setIsAddingPopup(false);
            setPopupForm({ title: '', message: '', delaySeconds: 5, okButtonText: 'UNDERSTOOD', closeButtonText: 'CLOSE', showImage: false, showText: true, expiryDate: Date.now() + 86400000 * 7, isActive: true });
            setPopupPreviewImg('');
            alert("System Alert Broadcast Live!");
        } catch (err: any) { alert("Popup Protocol Failed: " + err.message); }
        setIsProcessing(false);
    };

    const deletePopup = async (id: string) => {
        if (window.confirm("Purge this system alert?")) {
            await db.collection('systemPopups').doc(id).delete();
        }
    };

    // 5. Database Handlers
    const handleSaveGlobalRetention = async () => {
        setSavingRetention(true);
        try {
            await db.collection('appConfig').doc('globalSettings').update({ defaultRetentionDays: retentionDays });
            alert("Global Retention Policy Updated.");
        } catch(e: any) { alert("Fail: " + e.message); }
        setSavingRetention(false);
    };

    // 6. Graphics Handlers
    const handleSaveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assetPreview || !assetForm.name) return;
        setIsProcessing(true);
        try {
            await db.collection('globalAssets').add({
                ...assetForm,
                url: assetPreview,
                createdBy: 'SUPER_ADMIN',
                createdAt: Date.now()
            });
            setIsAddingAsset(false);
            setAssetPreview('');
            setAssetForm({ name: '', type: 'BACKGROUND' });
            alert("Global Asset Deployed!");
        } catch (e: any) { alert("Deploy Failed: " + e.message); }
        setIsProcessing(false);
    };

    const deleteAsset = async (id: string) => {
        if (window.confirm("Delete global graphic?")) {
            await db.collection('globalAssets').doc(id).delete();
        }
    };

    // 7. Broadcast Handlers
    const handleSaveBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            await db.collection('systemBroadcasts').add({ ...broadcastForm, createdAt: Date.now() });
            setIsAddingBroadcast(false);
            setBroadcastForm({ message: '', isActive: true });
        } catch (e: any) { alert("Fail: " + e.message); }
        setIsProcessing(false);
    };

    return (
        <div className="min-h-screen bg-black font-sans text-white selection:bg-red-500 selection:text-white">
            <nav className="bg-zinc-950 border-b border-zinc-800/50 sticky top-0 z-50 backdrop-blur-xl">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveTab('OVERVIEW')}>
                        <div className="bg-red-600 p-2.5 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.4)] group-hover:rotate-12 transition-all">
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
                
                {/* Search Bar (Adaptable for Registry & Auctions) */}
                {(activeTab === 'REGISTRY' || activeTab === 'AUCTIONS') && (
                    <div className="mb-8 relative animate-fade-in">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                        <input 
                            placeholder={activeTab === 'REGISTRY' ? "SEARCH USERS BY EMAIL OR NAME..." : "SEARCH AUCTIONS BY TITLE, ID OR OWNER UID..."}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-[2rem] py-6 pl-16 pr-6 text-sm font-bold uppercase tracking-widest focus:border-red-600 outline-none transition-all shadow-xl"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}

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
                                <div className="flex flex-wrap gap-4">
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
                    </div>
                )}

                {/* AUCTIONS MANAGEMENT TAB */}
                {activeTab === 'AUCTIONS' && (
                    <div className="space-y-6 animate-fade-in">
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
                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1.5"><Calendar className="w-3 h-3"/> {new Date(auction.createdAt || 0).toLocaleDateString()}</span>
                                                    <span className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1.5"><Mail className="w-3 h-3"/> OWNER: {auction.createdBy?.slice(0, 15)}...</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right hidden md:block">
                                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Status Protocol</p>
                                                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border ${auction.isPaid ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}>
                                                    {auction.isPaid ? 'Paid' : 'Free Trial'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingAuctionId(auction.id!); setAuctionEditForm(auction); }} className="bg-zinc-800 hover:bg-zinc-700 p-4 rounded-2xl transition-all border border-white/5 shadow-xl"><Edit className="w-5 h-5 text-zinc-400" /></button>
                                                <button onClick={() => handleRemoteAssist(auction.id!)} className="bg-blue-600 hover:bg-blue-500 p-4 rounded-2xl transition-all shadow-xl"><Monitor className="w-5 h-5 text-white" /></button>
                                                <button onClick={() => handleDeleteAuction(auction.id!, auction.title)} className="bg-zinc-800 hover:bg-red-600 p-4 rounded-2xl transition-all border border-white/5 shadow-xl"><Trash2 className="w-5 h-5 text-zinc-400 group-hover:text-white" /></button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* INLINE EDIT FORM */}
                                    {editingAuctionId === auction.id && (
                                        <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-4 gap-8 animate-slide-up">
                                            <div>
                                                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Manual Retention Lock</label>
                                                <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                                                    <span className="text-[10px] font-bold text-zinc-400">Permanent</span>
                                                    <button 
                                                        onClick={() => setAuctionEditForm({...auctionEditForm, isLifetime: !auctionEditForm.isLifetime})}
                                                        className={`w-12 h-6 rounded-full transition-all relative ${auctionEditForm.isLifetime ? 'bg-red-600' : 'bg-zinc-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${auctionEditForm.isLifetime ? 'left-7' : 'left-1'}`}></div>
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Authorization Class</label>
                                                <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                                                    <span className="text-[10px] font-bold text-zinc-400">Paid Tier</span>
                                                    <button 
                                                        onClick={() => setAuctionEditForm({...auctionEditForm, isPaid: !auctionEditForm.isPaid})}
                                                        className={`w-12 h-6 rounded-full transition-all relative ${auctionEditForm.isPaid ? 'bg-green-600' : 'bg-zinc-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${auctionEditForm.isPaid ? 'left-7' : 'left-1'}`}></div>
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Auto-Purge Schedule</label>
                                                <input 
                                                    type="date" 
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs font-bold text-white outline-none"
                                                    value={auctionEditForm.autoDeleteAt ? new Date(auctionEditForm.autoDeleteAt).toISOString().split('T')[0] : ''}
                                                    onChange={e => setAuctionEditForm({...auctionEditForm, autoDeleteAt: new Date(e.target.value).getTime()})}
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <button onClick={handleSaveAuctionMetadata} className="w-full bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95">SYNC METADATA</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {filteredAuctions.length === 0 && (
                                <div className="py-20 text-center opacity-20">
                                    <Gavel className="w-20 h-20 mx-auto mb-4" />
                                    <p className="text-xl font-black uppercase tracking-[0.5em]">No system records found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* REGISTRY / USERS TAB */}
                {activeTab === 'REGISTRY' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                             <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-12">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-xl">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-4xl font-black uppercase tracking-tighter">Universal Identities</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Master Registry Access</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex bg-black rounded-xl p-1 border border-zinc-800">
                                        {[
                                            {id: 'ALL', label: 'All'},
                                            {id: 'SUPPORT', label: 'Staff'},
                                            {id: 'ADMIN', label: 'Admins'},
                                            {id: 'VIEWER', label: 'Basic'}
                                        ].map(f => (
                                            <button 
                                                key={f.id} 
                                                onClick={() => setRegistryFilter(f.id as any)}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${registryFilter === f.id ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => setIsAddingUser(!isAddingUser)} className="bg-white hover:bg-blue-600 text-black hover:text-white font-black px-6 py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95">
                                        {isAddingUser ? 'CANCEL' : 'REGISTER NEW ID'}
                                    </button>
                                </div>
                             </div>

                             {isAddingUser && (
                                 <form onSubmit={handleCreateUser} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-5 gap-6 mb-12 animate-slide-up">
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Login Email</label>
                                         <input type="email" required placeholder="user@sm.in" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Display Name</label>
                                         <input required placeholder="Identity Name" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Auth Password</label>
                                         <input required type="text" placeholder="SECURE KEY" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Protocol Role</label>
                                         <select className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none h-[52px]" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}>
                                             <option value={UserRole.SUPPORT}>Support Node</option>
                                             <option value={UserRole.ADMIN}>Tournament Admin</option>
                                             <option value={UserRole.VIEWER}>Basic Viewer</option>
                                         </select>
                                     </div>
                                     <div className="flex items-end">
                                         <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest">
                                             {isProcessing ? <RefreshCw className="animate-spin w-4 h-4"/> : <ShieldCheck className="w-4 h-4"/>}
                                             DEPLOY IDENTITY
                                         </button>
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                 {filteredRegistry.map(user => (
                                     <div key={user.uid} className={`bg-zinc-950 p-8 rounded-[2rem] border transition-all ${editingUserId === user.uid ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-white/5 hover:border-white/10'} group relative`}>
                                         <div className="flex items-start justify-between mb-6">
                                             <div className="flex items-center gap-5 min-w-0">
                                                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black border ${user.role === UserRole.SUPPORT ? 'bg-blue-600/10 text-blue-500 border-blue-500/20' : user.role === UserRole.ADMIN ? 'bg-purple-600/10 text-purple-500 border-purple-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                                                     {user.role === UserRole.SUPPORT ? <Headset className="w-6 h-6"/> : user.role === UserRole.ADMIN ? <Gavel className="w-6 h-6"/> : <Users className="w-6 h-6"/>}
                                                 </div>
                                                 <div className="min-w-0">
                                                     <h3 className="font-black text-white uppercase tracking-tight truncate text-base leading-none mb-1">{user.email}</h3>
                                                     <p className="text-[10px] text-zinc-500 font-bold uppercase truncate">{user.name || 'ANONYMOUS UNIT'}</p>
                                                 </div>
                                             </div>
                                             <div className="flex gap-1">
                                                <button onClick={() => editingUserId === user.uid ? setEditingUserId(null) : handleOpenEdit(user)} className="p-2 text-zinc-500 hover:text-white transition-colors"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteUser(user.uid, user.email)} className="p-2 text-zinc-500 hover:text-red-500 transition-colors"><UserX className="w-4 h-4"/></button>
                                             </div>
                                         </div>

                                         {editingUserId === user.uid ? (
                                             <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4 animate-fade-in">
                                                 <div className="grid grid-cols-2 gap-4">
                                                     <div><label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">UNIT NAME</label><input className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-bold" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                                                     <div><label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">PROTOCOL ROLE</label><select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-black uppercase" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value as any})}><option value={UserRole.SUPPORT}>Support</option><option value={UserRole.ADMIN}>Admin</option><option value={UserRole.VIEWER}>Viewer</option></select></div>
                                                 </div>
                                                 <div className="flex gap-2">
                                                     <button onClick={() => handleUpdateUser(user.uid)} className="flex-1 bg-white text-black font-black py-3 rounded-xl text-[9px] uppercase tracking-widest">SAVE PROFILE</button>
                                                     <button onClick={() => setEditingUserId(null)} className="px-4 bg-zinc-900 text-zinc-500 font-black py-3 rounded-xl text-[9px] uppercase tracking-widest">EXIT</button>
                                                 </div>
                                             </div>
                                         ) : (
                                             <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-4 pt-4 border-t border-white/5">
                                                 <span>{user.role} IDENTITY</span>
                                                 <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> SECURE UNIT</span>
                                             </div>
                                         )}
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* PLANS TAB */}
                {activeTab === 'PLANS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-xl">
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tighter">Subscription Protocol</h2>
                                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configure pricing tiers and team capacities</p>
                            </div>
                            <button onClick={() => { setIsAddingPlan(!isAddingPlan); setPlanForm({ id: '', name: '', price: 0, teams: 0 }); }} className="bg-white text-black hover:bg-blue-600 hover:text-white font-black px-8 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg">
                                {isAddingPlan ? <XCircle className="w-4 h-4 inline mr-2"/> : <Plus className="w-4 h-4 inline mr-2"/>}
                                {isAddingPlan ? 'CANCEL' : 'DEPLOY PROTOCOL'}
                            </button>
                        </div>

                        {isAddingPlan && (
                            <form onSubmit={handleSavePlan} className="bg-zinc-900/80 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up mb-10 shadow-2xl">
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Protocol Name</label><input required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase" value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Price (INR)</label><input type="number" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-black" value={planForm.price} onChange={e => setPlanForm({...planForm, price: Number(e.target.value)})} /></div>
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Max Teams</label><input type="number" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-black" value={planForm.teams} onChange={e => setPlanForm({...planForm, teams: Number(e.target.value)})} /></div>
                                <div className="flex items-end"><button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-[10px]">SYNC PROTOCOL</button></div>
                            </form>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {dbPlans.map(p => (
                                <div key={p.id} className="bg-zinc-950 p-8 rounded-[2.5rem] border border-white/5 hover:border-blue-500/30 transition-all group relative overflow-hidden shadow-xl text-center">
                                    <h3 className="text-2xl font-black text-white uppercase mb-8">{p.name}</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-baseline border-b border-white/5 pb-2"><span className="text-[10px] font-bold text-zinc-500 uppercase">Pricing</span><span className="text-2xl font-black text-blue-500">₹{p.price}</span></div>
                                        <div className="flex justify-between items-baseline"><span className="text-[10px] font-bold text-zinc-500 uppercase">Capacity</span><span className="text-xl font-black text-white">{p.teams}</span></div>
                                    </div>
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setPlanForm(p); setIsAddingPlan(true); }} className="text-zinc-600 hover:text-white"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => deletePlan(p.id!)} className="text-zinc-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PROMOS TAB */}
                {activeTab === 'PROMOS' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-emerald-600 p-3 rounded-2xl shadow-xl">
                                        <Tag className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter">Promo Engine</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Discount Registry Control</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddingPromo(!isAddingPromo)} className="bg-white hover:bg-emerald-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                                    {isAddingPromo ? 'CANCEL' : 'CREATE PROMO'}
                                </button>
                             </div>

                             {isAddingPromo && (
                                 <form onSubmit={handleSavePromo} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 animate-slide-up">
                                     <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">CODE</label><input required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase" value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value})} /></div>
                                     <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">TYPE</label><select className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black" value={promoForm.discountType} onChange={e => setPromoForm({...promoForm, discountType: e.target.value as any})}><option value="PERCENT">Percentage</option><option value="FLAT">Flat INR</option></select></div>
                                     <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">VALUE</label><input type="number" required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black" value={promoForm.discountValue} onChange={e => setPromoForm({...promoForm, discountValue: Number(e.target.value)})} /></div>
                                     <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">MAX CLAIMS</label><input type="number" required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black" value={promoForm.maxClaims} onChange={e => setPromoForm({...promoForm, maxClaims: Number(e.target.value)})} /></div>
                                     <button type="submit" className="md:col-span-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs">ESTABLISH PROMO PROTOCOL</button>
                                 </form>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                 {promos.map(p => (
                                     <div key={p.id} className="bg-zinc-950 p-6 rounded-3xl border border-white/5 group relative">
                                         <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-black text-white">{p.code}</h3><button onClick={() => deletePromo(p.id!)} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button></div>
                                         <div className="text-3xl font-black text-emerald-500 mb-2">{p.discountType === 'PERCENT' ? `${p.discountValue}%` : `₹${p.discountValue}`} OFF</div>
                                         <div className="flex justify-between text-[8px] font-black uppercase text-zinc-500"><span>Claims: {p.currentClaims} / {p.maxClaims}</span><span>Exp: {new Date(p.expiryDate).toLocaleDateString()}</span></div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* ALERTS TAB */}
                {activeTab === 'ALERTS' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-600 p-3 rounded-2xl shadow-xl">
                                        <Megaphone className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter">System Broadcaster</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configure global modal alerts</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddingPopup(!isAddingPopup)} className="bg-white hover:bg-purple-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                                    {isAddingPopup ? 'CANCEL' : 'DEPLOY ALERT'}
                                </button>
                             </div>

                             {isAddingPopup && (
                                 <form onSubmit={handleSavePopup} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 animate-slide-up">
                                     <div className="md:col-span-2 space-y-6">
                                         <div><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Title</label><input required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black" value={popupForm.title} onChange={e => setPopupForm({...popupForm, title: e.target.value})} /></div>
                                         <div><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Content</label><textarea rows={4} required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold" value={popupForm.message} onChange={e => setPopupForm({...popupForm, message: e.target.value})} /></div>
                                     </div>
                                     <div className="space-y-6">
                                        <div onClick={() => popupImgRef.current?.click()} className="w-full aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative">
                                            {popupPreviewImg ? <img src={popupPreviewImg} className="w-full h-full object-cover" /> : <ImageIcon className="w-12 h-12 text-zinc-800" />}
                                            <input ref={popupImgRef} type="file" className="hidden" accept="image/*" onChange={async e => { if(e.target.files?.[0]) setPopupPreviewImg(await compressImage(e.target.files[0])); }} />
                                        </div>
                                        <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs">ACTIVATE BROADCAST</button>
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                 {popups.map(p => (
                                     <div key={p.id} className="bg-zinc-950 p-6 rounded-3xl border border-white/5 relative group shadow-lg">
                                         <div className="flex justify-between items-start mb-4"><h3 className="text-lg font-black text-white uppercase truncate">{p.title}</h3><button onClick={() => deletePopup(p.id!)} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button></div>
                                         <p className="text-[10px] text-zinc-400 font-bold line-clamp-2 mb-4">{p.message}</p>
                                         <div className="pt-4 border-t border-white/5 flex justify-between text-[8px] font-black uppercase text-zinc-600"><span>Delay: {p.delaySeconds}s</span><span>Exp: {new Date(p.expiryDate).toLocaleDateString()}</span></div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* DATABASE TAB */}
                {activeTab === 'DATABASE' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                             <div className="flex items-center gap-4 mb-10">
                                <div className="bg-red-600 p-3 rounded-2xl shadow-xl">
                                    <HardDrive className="w-6 h-6 text-white" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tighter">Infrastructure Hub</h2>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                                {[
                                    { label: 'Registry Load', val: stats.totalDocsEstimate.toLocaleString(), color: 'text-white' },
                                    { label: 'Storage Stress', val: `${totalGB} GB`, color: 'text-red-500' },
                                    { label: 'Latency Node', val: '0.04s', color: 'text-blue-400' },
                                    { label: 'Health Status', val: 'OPERATIONAL', color: 'text-green-500' }
                                ].map(card => (
                                    <div key={card.label} className="bg-black/40 p-8 rounded-3xl border border-white/5">
                                        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-2">{card.label}</p>
                                        <h3 className={`text-4xl font-black ${card.color}`}>{card.val}</h3>
                                    </div>
                                ))}
                             </div>

                             <div className="bg-zinc-950 p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                                <div className="relative z-10 max-w-2xl">
                                    <h3 className="text-2xl font-black uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-6 h-6" /> Data Retention Protocol
                                    </h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed mb-8 font-medium">Configure system-wide TTL for completed or inactive tournament environments. Inactive instances are flagged for purging after this threshold.</p>
                                    <div className="flex items-center gap-4">
                                        <input type="number" className="w-40 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-2xl font-black text-center" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))} />
                                        <button onClick={handleSaveGlobalRetention} disabled={savingRetention} className="flex-1 bg-white text-black font-black py-5 rounded-2xl shadow-xl transition-all hover:bg-red-600 hover:text-white uppercase text-xs tracking-widest">
                                            {savingRetention ? <RefreshCw className="animate-spin h-5 w-5 mx-auto"/> : 'INITIALIZE RETENTION POLICY'}
                                        </button>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {/* GRAPHICS TAB */}
                {activeTab === 'GRAPHICS' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                             <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-xl">
                                        <Layers className="w-6 h-6 text-white" />
                                    </div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter">Visual Protocol Library</h2>
                                </div>
                                <button onClick={() => setIsAddingAsset(!isAddingAsset)} className="bg-white hover:bg-blue-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                                    {isAddingAsset ? 'CANCEL' : 'DEPLOY ASSET'}
                                </button>
                             </div>

                             {isAddingAsset && (
                                 <form onSubmit={handleSaveAsset} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 animate-slide-up">
                                     <div className="space-y-6">
                                         <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Asset Identity</label><input required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase" value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} /></div>
                                         <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Protocol Type</label><div className="grid grid-cols-3 gap-2">{['BACKGROUND', 'FRAME', 'LOGO'].map(t => (<button key={t} type="button" onClick={() => setAssetForm({...assetForm, type: t as any})} className={`py-2 rounded-xl text-[8px] font-black transition-all border ${assetForm.type === t ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>{t}</button>))}</div></div>
                                         <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs">SAVE TO GLOBAL REPOSITORY</button>
                                     </div>
                                     <div onClick={() => assetInputRef.current?.click()} className="w-full aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative shadow-inner">
                                         {assetPreview ? <img src={assetPreview} className="w-full h-full object-contain p-4" /> : <ImageIcon className="w-12 h-12 text-zinc-800" />}
                                         <input ref={assetInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if(e.target.files?.[0]) setAssetPreview(await compressImage(e.target.files[0])); }} />
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                 {globalAssets.map(a => (
                                     <div key={a.id} className="bg-zinc-950 rounded-[2rem] border border-white/5 overflow-hidden group relative shadow-md">
                                         <div className="aspect-video bg-black flex items-center justify-center p-2"><img src={a.url} className="max-h-full max-w-full object-contain" /></div>
                                         <div className="p-4 border-t border-white/5 flex justify-between items-center"><span className="text-[10px] font-black uppercase text-zinc-400 truncate max-w-[120px]">{a.name}</span><button onClick={() => deleteAsset(a.id)} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3"/></button></div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* TICKER TAB */}
                {activeTab === 'BROADCAST' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                             <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-orange-600 p-3 rounded-2xl shadow-xl">
                                        <Newspaper className="w-6 h-6 text-white" />
                                    </div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter">Global Ticker Registry</h2>
                                </div>
                                <button onClick={() => setIsAddingBroadcast(!isAddingBroadcast)} className="bg-white hover:bg-orange-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                                    {isAddingBroadcast ? 'CANCEL' : 'DEPLOY TICKER'}
                                </button>
                             </div>

                             {isAddingBroadcast && (
                                 <form onSubmit={handleSaveBroadcast} className="bg-black/40 p-10 rounded-[2rem] border border-white/5 space-y-6 mb-12 animate-slide-up">
                                     <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Broadcast Message String</label><input required placeholder="SYSTEM MAINTENANCE SCHEDULED..." className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-sm font-black uppercase tracking-widest" value={broadcastForm.message} onChange={e => setBroadcastForm({...broadcastForm, message: e.target.value})} /></div>
                                     <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs">INITIATE GLOBAL TICKER</button>
                                 </form>
                             )}

                             <div className="space-y-4">
                                 {broadcasts.map(b => (
                                     <div key={b.id} className="bg-zinc-950 p-6 rounded-3xl border border-white/5 flex justify-between items-center group shadow-md">
                                         <div className="flex items-center gap-6"><div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div><p className="text-sm font-black uppercase tracking-widest text-zinc-300">{b.message}</p></div>
                                         <button onClick={async () => { if(window.confirm("Purge ticker?")) await db.collection('systemBroadcasts').doc(b.id).delete(); }} className="text-zinc-800 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                                     </div>
                                 ))}
                                 {broadcasts.length === 0 && <div className="p-20 text-center text-zinc-700 italic font-black uppercase text-[10px] tracking-widest">Registry empty: No active news strings</div>}
                             </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default SuperAdminDashboard;
