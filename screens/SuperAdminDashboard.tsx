
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
    MessageSquare, Layers, Newspaper, Headset, UserMinus, UserPlus, Mail, ShieldAlert, Key, Filter, ChevronDown, UserX
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
    const { state, logout } = useAuction();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'REGISTRY' | 'PLANS' | 'PROMOS' | 'ALERTS' | 'BROADCAST' | 'DATABASE' | 'GRAPHICS'>('OVERVIEW');
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

    const [logoPreview, setLogoPreview] = useState(state.systemLogoUrl || '');
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [savingLogo, setSavingLogo] = useState(false);

    // Common States
    const [isProcessing, setIsProcessing] = useState(false);

    // Registry / User Management States
    const [userRegistry, setUserRegistry] = useState<UserProfile[]>([]);
    const [registryFilter, setRegistryFilter] = useState<'ALL' | 'SUPPORT' | 'ADMIN' | 'VIEWER'>('ALL');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: UserRole.SUPPORT });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ email: '', name: '', password: '', role: UserRole.VIEWER });

    // Plans Management
    const [dbPlans, setDbPlans] = useState<any[]>([]);
    const [planForm, setPlanForm] = useState({ id: '', name: '', price: 0, teams: 0 });
    const [isEditingPlan, setIsEditingPlan] = useState(false);
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
        // Auctions Listener
        const unsubscribe = db.collection('auctions').onSnapshot(async (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setAuctions(data);
            const uniqueOwners = new Set(data.map(a => a.createdBy).filter(Boolean));
            const activeCount = data.filter(a => a.status === 'LIVE' || a.status === 'DRAFT' || (a.status as any) === 'IN_PROGRESS').length;
            
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

    // Filters for Registry
    const filteredRegistry = userRegistry.filter(u => {
        const matchesRole = registryFilter === 'ALL' || u.role === registryFilter;
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) || (u.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesRole && matchesSearch;
    });

    // 1. Promo Handlers
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

    // 2. Popup Handlers
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

    // 3. Database Handlers
    const handleSaveGlobalRetention = async () => {
        setSavingRetention(true);
        try {
            await db.collection('appConfig').doc('globalSettings').update({ defaultRetentionDays: retentionDays });
            alert("Global Retention Policy Updated.");
        } catch(e: any) { alert("Fail: " + e.message); }
        setSavingRetention(false);
    };

    // 4. Graphics Handlers
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

    // 5. Broadcast Handlers
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

    // Estimate GB Usage (Approx 2KB per doc + index overhead)
    const totalGB = (stats.totalDocsEstimate * 0.0000019).toFixed(4);

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
                            {id: 'REGISTRY', label: 'Registry', icon: <Users className="w-4 h-4"/>},
                            {id: 'PLANS', label: 'Plans', icon: <Server className="w-4 h-4"/>},
                            {id: 'PROMOS', label: 'Promos', icon: <Tag className="w-4 h-4"/>},
                            {id: 'ALERTS', label: 'Alerts', icon: <Megaphone className="w-4 h-4"/>},
                            {id: 'BROADCAST', label: 'Broadcast', icon: <Newspaper className="w-4 h-4"/>},
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
                        <LogOut className="w-4 h-4 mr-2"/> Termination
                    </button>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-10 max-w-7xl">
                
                {activeTab === 'OVERVIEW' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col md:flex-row items-center gap-10">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative group">
                                    <div className="w-48 h-48 rounded-3xl bg-black border-4 border-zinc-800 p-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                                        {logoPreview ? (
                                            <img src={logoPreview} className="max-w-full max-h-full object-contain relative z-10" />
                                        ) : (
                                            <ImageIcon className="w-16 h-16 text-zinc-700" />
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => logoInputRef.current?.click()}
                                        className="absolute -bottom-4 -right-4 bg-red-600 hover:bg-red-50 p-4 rounded-2xl shadow-xl transition-all"
                                    >
                                        <Upload className="w-6 h-6" />
                                    </button>
                                    <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                        if (e.target.files?.[0]) setLogoPreview(await compressImage(e.target.files[0]));
                                    }} />
                                </div>
                                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">System Logo</p>
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Master Branding</h2>
                                <p className="text-zinc-400 text-sm max-w-xl mb-8 leading-relaxed">Apply global branding that persists across all tenant dashboards and OBS overlays.</p>
                                <button onClick={async () => {
                                    setIsProcessing(true);
                                    await db.collection('appConfig').doc('globalSettings').set({ systemLogoUrl: logoPreview }, { merge: true });
                                    setIsProcessing(false);
                                    alert("Applied!");
                                }} className="bg-white text-black font-black px-10 py-4 rounded-2xl flex items-center gap-3 transition-all hover:bg-red-600 hover:text-white">
                                    {isProcessing ? <RefreshCw className="animate-spin h-5 w-5"/> : <Save className="w-5 h-5" />} APPLY GLOBAL BRANDING
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                { label: 'Storage', val: totalGB, unit: 'GB', color: 'text-red-500' },
                                { label: 'Pulse', val: stats.activeAuctions, unit: 'Live', color: 'text-green-500' },
                                { label: 'Accounts', val: stats.totalAccounts, unit: 'IDs', color: 'text-blue-500' },
                                { label: 'Staff', val: stats.supportStaffCount, unit: 'Active', color: 'text-white' }
                            ].map(s => (
                                <div key={s.label} className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5">
                                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{s.label}</p>
                                    <div className="flex items-baseline gap-2">
                                        <h2 className={`text-4xl font-black ${s.color}`}>{s.val}</h2>
                                        <span className="text-[10px] font-bold text-zinc-600 uppercase">{s.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* REGISTRY / USERS TAB */}
                {activeTab === 'REGISTRY' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter">Identity Hub</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Universal Registry Management</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex bg-black rounded-xl p-1 border border-zinc-800">
                                        {[
                                            {id: 'ALL', label: 'All'},
                                            {id: 'SUPPORT', label: 'Staff'},
                                            {id: 'ADMIN', label: 'Organizers'},
                                            {id: 'VIEWER', label: 'Viewers'}
                                        ].map(f => (
                                            <button 
                                                key={f.id} 
                                                onClick={() => setRegistryFilter(f.id as any)}
                                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${registryFilter === f.id ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                        <input 
                                            placeholder="Search Email / Name..." 
                                            className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs font-bold w-48 outline-none focus:border-blue-500"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <button onClick={() => setIsAddingUser(!isAddingUser)} className="bg-white hover:bg-blue-600 text-black hover:text-white font-black px-6 py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95">
                                        {isAddingUser ? <XCircle className="w-4 h-4 inline mr-2"/> : <UserPlus className="w-4 h-4 inline mr-2"/>}
                                        {isAddingUser ? 'CANCEL' : 'CREATE ACCOUNT'}
                                    </button>
                                </div>
                             </div>

                             {isAddingUser && (
                                 <form onSubmit={handleCreateUser} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-5 gap-6 mb-10 animate-slide-up">
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Login Email</label>
                                         <input type="email" required placeholder="user@identity.in" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Display Name</label>
                                         <input required placeholder="Identity Name" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Access Key</label>
                                         <input required type="text" placeholder="SECURE PASSWORD" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Assign Role</label>
                                         <select className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-blue-500 h-[52px]" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}>
                                             <option value={UserRole.SUPPORT}>Support Staff</option>
                                             <option value={UserRole.ADMIN}>Organizer / Admin</option>
                                             <option value={UserRole.VIEWER}>Basic Viewer</option>
                                         </select>
                                     </div>
                                     <div className="flex items-end">
                                         <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest">
                                             {isProcessing ? <RefreshCw className="animate-spin w-4 h-4"/> : <ShieldCheck className="w-4 h-4"/>}
                                             AUTHORIZE IDENTITY
                                         </button>
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                 {filteredRegistry.map(user => (
                                     <div key={user.uid} className={`bg-zinc-950 p-6 rounded-3xl border transition-all ${editingUserId === user.uid ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-white/5 hover:border-white/10'} group relative`}>
                                         <div className="flex items-start justify-between mb-4">
                                             <div className="flex items-center gap-4 min-w-0">
                                                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black border ${user.role === UserRole.SUPPORT ? 'bg-blue-600/10 text-blue-500 border-blue-500/20' : user.role === UserRole.ADMIN ? 'bg-purple-600/10 text-purple-500 border-purple-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                                                     {user.role === UserRole.SUPPORT ? <Headset className="w-5 h-5"/> : user.role === UserRole.ADMIN ? <Gavel className="w-5 h-5"/> : <Users className="w-5 h-5"/>}
                                                 </div>
                                                 <div className="min-w-0">
                                                     <h3 className="font-black text-white uppercase tracking-tight truncate text-sm">{user.email}</h3>
                                                     <p className="text-[9px] text-zinc-500 font-bold uppercase truncate mt-0.5">{user.name || 'Anonymous'}</p>
                                                 </div>
                                             </div>
                                             <div className="flex items-center gap-2">
                                                <button onClick={() => editingUserId === user.uid ? setEditingUserId(null) : handleOpenEdit(user)} className={`p-2 rounded-lg transition-all ${editingUserId === user.uid ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-blue-500 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100'}`}>
                                                    <Edit className="w-4 h-4"/>
                                                </button>
                                                <button onClick={() => handleDeleteUser(user.uid, user.email)} className="p-2 rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                                                    <UserX className="w-4 h-4"/>
                                                </button>
                                             </div>
                                         </div>

                                         {editingUserId === user.uid ? (
                                             <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4 animate-fade-in">
                                                 <div>
                                                     <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Profile Name</label>
                                                     <input className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                                                 </div>
                                                 <div>
                                                     <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Master Email</label>
                                                     <input className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                                                 </div>
                                                 <div>
                                                     <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Access Password</label>
                                                     <input className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} />
                                                 </div>
                                                 <div>
                                                     <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Switch Protocol Role</label>
                                                     <div className="grid grid-cols-2 gap-2">
                                                         {[
                                                             {id: UserRole.SUPPORT, label: 'Staff'},
                                                             {id: UserRole.ADMIN, label: 'Admin'},
                                                             {id: UserRole.VIEWER, label: 'Viewer'}
                                                         ].map(role => (
                                                             <button 
                                                                key={role.id} 
                                                                type="button" 
                                                                onClick={() => setEditForm({...editForm, role: role.id})}
                                                                className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${editForm.role === role.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                                                             >
                                                                 {role.label}
                                                             </button>
                                                         ))}
                                                     </div>
                                                 </div>
                                                 <div className="flex gap-2 pt-2">
                                                     <button onClick={() => handleUpdateUser(user.uid)} className="flex-1 bg-white text-black font-black py-3 rounded-xl text-[9px] uppercase tracking-widest shadow-xl">SAVE PROFILE</button>
                                                     <button onClick={() => setEditingUserId(null)} className="px-4 bg-zinc-900 text-zinc-500 font-black py-3 rounded-xl text-[9px] uppercase tracking-widest">EXIT</button>
                                                 </div>
                                             </div>
                                         ) : (
                                             <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                                 <div className="flex items-center gap-3">
                                                     <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${user.role === UserRole.SUPPORT ? 'bg-blue-500/10 text-blue-500' : user.role === UserRole.ADMIN ? 'bg-purple-500/10 text-purple-500' : 'bg-zinc-800 text-zinc-500'}`}>
                                                         {user.role}
                                                     </div>
                                                     {(user as any).password && (
                                                         <div className="flex items-center gap-1 text-[8px] font-black text-zinc-600 uppercase">
                                                             <Key className="w-2.5 h-2.5"/> Secret Key Active
                                                         </div>
                                                     )}
                                                 </div>
                                                 <div className="flex items-center gap-1.5">
                                                     <div className={`w-1.5 h-1.5 rounded-full ${user.role === UserRole.VIEWER ? 'bg-zinc-800' : 'bg-emerald-500 animate-pulse'}`}></div>
                                                     <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{user.role === UserRole.VIEWER ? 'IDLE' : 'LIVE'}</span>
                                                 </div>
                                             </div>
                                         )}
                                     </div>
                                 ))}
                                 {filteredRegistry.length === 0 && (
                                     <div className="col-span-full py-20 text-center flex flex-col items-center justify-center opacity-20">
                                         <Users className="w-16 h-16 mb-4" />
                                         <p className="text-sm font-black uppercase tracking-[0.3em]">No matching identities found</p>
                                     </div>
                                 )}
                             </div>
                        </div>
                    </div>
                )}

                {/* PLANS TAB */}
                {activeTab === 'PLANS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5">
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tighter">Subscription Plans</h2>
                                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configure pricing tiers</p>
                            </div>
                            <button onClick={() => { setIsAddingPlan(true); setPlanForm({ id: '', name: '', price: 0, teams: 0 }); }} className="bg-white text-black font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                                <Plus className="w-4 h-4 inline mr-2"/> DEPLOY PROTOCOL
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {dbPlans.map(p => (
                                <div key={p.id} className="bg-zinc-950 p-6 rounded-3xl border border-white/5 hover:border-blue-500/20 transition-all">
                                    <div className="flex justify-between items-start mb-6">
                                        <span className="text-xl font-black tracking-tighter uppercase text-white">{p.name}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setIsAddingPlan(true); setIsEditingPlan(true); setPlanForm(p); }} className="text-zinc-600 hover:text-blue-500"><Edit className="w-4 h-4"/></button>
                                            <button onClick={async () => { if(window.confirm("Purge?")) await db.collection('subscriptionPlans').doc(p.id).delete(); }} className="text-zinc-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                    <div className="text-4xl font-black text-blue-500 mb-4">₹{p.price}</div>
                                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Upto {p.teams} Teams</p>
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
                                    <div className="bg-emerald-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                                        <Tag className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter">Promo Code Engine</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Discount protocol management</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddingPromo(!isAddingPromo)} className="bg-white hover:bg-emerald-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                                    {isAddingPromo ? <XCircle className="w-4 h-4 inline mr-2"/> : <Plus className="w-4 h-4 inline mr-2"/>}
                                    {isAddingPromo ? 'CANCEL' : 'CREATE PROMO'}
                                </button>
                             </div>

                             {isAddingPromo && (
                                 <form onSubmit={handleSavePromo} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 animate-slide-up">
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Code</label>
                                         <input required placeholder="SAVE50" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-emerald-500" value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Type</label>
                                         <select className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none" value={promoForm.discountType} onChange={e => setPromoForm({...promoForm, discountType: e.target.value as any})}>
                                             <option value="PERCENT">Percentage</option>
                                             <option value="FLAT">Flat INR</option>
                                         </select>
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Value</label>
                                         <input type="number" required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none focus:border-emerald-500" value={promoForm.discountValue} onChange={e => setPromoForm({...promoForm, discountValue: Number(e.target.value)})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Max Claims</label>
                                         <input type="number" required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none focus:border-emerald-500" value={promoForm.maxClaims} onChange={e => setPromoForm({...promoForm, maxClaims: Number(e.target.value)})} />
                                     </div>
                                     <div className="md:col-span-4">
                                         <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2">
                                             <Zap className="w-5 h-5"/> INITIALIZE PROMO PROTOCOL
                                         </button>
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                 {promos.map(p => (
                                     <div key={p.id} className="bg-zinc-950 p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                                         <div className="flex justify-between items-center mb-4">
                                             <h3 className="text-xl font-black text-white">{p.code}</h3>
                                             <button onClick={() => deletePromo(p.id!)} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                         </div>
                                         <div className="text-3xl font-black text-emerald-500 mb-2">{p.discountType === 'PERCENT' ? `${p.discountValue}%` : `₹${p.discountValue}`} OFF</div>
                                         <div className="flex justify-between text-[8px] font-black uppercase text-zinc-500">
                                             <span>Used: {p.currentClaims} / {p.maxClaims}</span>
                                             <span>Exp: {new Date(p.expiryDate).toLocaleDateString()}</span>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* 4. ALERTS TAB */}
                {activeTab === 'ALERTS' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(147,51,234,0.4)]">
                                        <Megaphone className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter">System Alert Manager</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configure global broadcast popups</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddingPopup(!isAddingPopup)} className="bg-white hover:bg-purple-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                                    {isAddingPopup ? <XCircle className="w-4 h-4 inline mr-2"/> : <Plus className="w-4 h-4 inline mr-2"/>}
                                    {isAddingPopup ? 'CANCEL' : 'DEPLOY BROADCAST'}
                                </button>
                             </div>

                             {isAddingPopup && (
                                 <form onSubmit={handleSavePopup} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 animate-slide-up">
                                     <div className="md:col-span-2 space-y-6">
                                         <div>
                                             <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Alert Title</label>
                                             <input required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-purple-500" value={popupForm.title} onChange={e => setPopupForm({...popupForm, title: e.target.value})} />
                                         </div>
                                         <div>
                                             <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Message Content</label>
                                             <textarea rows={4} required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold outline-none focus:border-purple-500" value={popupForm.message} onChange={e => setPopupForm({...popupForm, message: e.target.value})} />
                                         </div>
                                         <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Delay (Sec)</label><input type="number" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black" value={popupForm.delaySeconds} onChange={e => setPopupForm({...popupForm, delaySeconds: Number(e.target.value)})} /></div>
                                            <div><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Expiry</label><input type="date" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black" onChange={e => setPopupForm({...popupForm, expiryDate: new Date(e.target.value).getTime()})} /></div>
                                         </div>
                                     </div>
                                     <div className="space-y-6">
                                        <div className="flex flex-col items-center">
                                            <div onClick={() => popupImgRef.current?.click()} className="w-full aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative">
                                                {popupPreviewImg ? <img src={popupPreviewImg} className="w-full h-full object-cover" /> : <ImageIcon className="w-12 h-12 text-zinc-800" />}
                                            </div>
                                            <input ref={popupImgRef} type="file" className="hidden" accept="image/*" onChange={async e => { if(e.target.files?.[0]) setPopupPreviewImg(await compressImage(e.target.files[0])); }} />
                                            <p className="mt-2 text-[8px] font-black uppercase text-zinc-500">Alert Graphic</p>
                                        </div>
                                        <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all">INITIALIZE ALERT</button>
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                 {popups.map(p => (
                                     <div key={p.id} className="bg-zinc-950 p-6 rounded-3xl border border-white/5 relative group">
                                         <div className="flex justify-between items-start mb-4">
                                             <h3 className="text-lg font-black text-white uppercase truncate">{p.title}</h3>
                                             <button onClick={() => deletePopup(p.id!)} className="text-zinc-700 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                         </div>
                                         <p className="text-[10px] text-zinc-400 font-bold line-clamp-2 mb-4">{p.message}</p>
                                         <div className="pt-4 border-t border-white/5 flex justify-between text-[8px] font-black uppercase text-zinc-600">
                                            <span>Delay: {p.delaySeconds}s</span>
                                            <span>Active until: {new Date(p.expiryDate).toLocaleDateString()}</span>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* 5. DATABASE TAB */}
                {activeTab === 'DATABASE' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex items-center gap-4 mb-10">
                                <div className="bg-red-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                                    <HardDrive className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter">Infrastructure Node</h2>
                                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Resource allocation & retention</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                                {[
                                    { label: 'Total Registry Docs', val: stats.totalDocsEstimate.toLocaleString(), color: 'text-white' },
                                    { label: 'Storage Intensity', val: `${totalGB} GB`, color: 'text-red-500' },
                                    { label: 'System Latency', val: '12ms', color: 'text-blue-400' },
                                    { label: 'Health Status', val: 'HEALTHY', color: 'text-green-500' }
                                ].map(card => (
                                    <div key={card.label} className="bg-black/40 p-8 rounded-3xl border border-white/5">
                                        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-2">{card.label}</p>
                                        <h3 className={`text-4xl font-black ${card.color}`}>{card.val}</h3>
                                    </div>
                                ))}
                             </div>

                             <div className="bg-zinc-950 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden">
                                <div className="relative z-10 max-w-2xl">
                                    <h3 className="text-xl font-black uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" /> Deletion Threshold Policy
                                    </h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                                        Configure the lifecycle of unpaid or completed auction instances. After the retention period, 
                                        unpaid or completed auctions are flagged for automated purging. **LIFETIME** instances override this.
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <input type="number" className="w-40 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xl font-black text-center" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))} />
                                        <button onClick={handleSaveGlobalRetention} disabled={savingRetention} className="flex-1 bg-white text-black font-black py-4 rounded-2xl shadow-xl transition-all hover:bg-red-600 hover:text-white">
                                            {savingRetention ? <RefreshCw className="animate-spin h-5 w-5 mx-auto"/> : 'INITIALIZE GLOBAL POLICY'}
                                        </button>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {/* 6. GRAPHICS TAB */}
                {activeTab === 'GRAPHICS' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                                        <Layers className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter">Global Asset Library</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Shared visual protocol components</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddingAsset(!isAddingAsset)} className="bg-white hover:bg-blue-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                                    {isAddingAsset ? <XCircle className="w-4 h-4 inline mr-2"/> : <Plus className="w-4 h-4 inline mr-2"/>}
                                    {isAddingAsset ? 'CANCEL' : 'DEPLOY ASSET'}
                                </button>
                             </div>

                             {isAddingAsset && (
                                 <form onSubmit={handleSaveAsset} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 animate-slide-up">
                                     <div className="space-y-6">
                                         <div>
                                             <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Asset Name</label>
                                             <input required placeholder="ICC 2024 FRAME" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-blue-500" value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} />
                                         </div>
                                         <div>
                                             <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Protocol Type</label>
                                             <div className="grid grid-cols-3 gap-2">
                                                 {['BACKGROUND', 'FRAME', 'LOGO'].map(t => (
                                                     <button key={t} type="button" onClick={() => setAssetForm({...assetForm, type: t as any})} className={`py-2 rounded-xl text-[8px] font-black transition-all border ${assetForm.type === t ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>{t}</button>
                                                 ))}
                                             </div>
                                         </div>
                                         <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all">ESTABLISH GLOBAL ASSET</button>
                                     </div>
                                     <div className="flex flex-col items-center">
                                         <div onClick={() => assetInputRef.current?.click()} className="w-full aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative">
                                             {assetPreview ? <img src={assetPreview} className="w-full h-full object-contain p-4" /> : <ImageIcon className="w-12 h-12 text-zinc-800" />}
                                         </div>
                                         <input ref={assetInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if(e.target.files?.[0]) setAssetPreview(await compressImage(e.target.files[0])); }} />
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                 {globalAssets.map(a => (
                                     <div key={a.id} className="bg-zinc-950 rounded-3xl border border-white/5 overflow-hidden group relative">
                                         <div className="aspect-video bg-black flex items-center justify-center p-2"><img src={a.url} className="max-h-full max-w-full object-contain" /></div>
                                         <div className="p-4 border-t border-white/5 flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-zinc-400 truncate max-w-[100px]">{a.name}</span>
                                            <button onClick={() => deleteAsset(a.id)} className="text-zinc-700 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* 7. BROADCAST TAB */}
                {activeTab === 'BROADCAST' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-orange-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                                        <Newspaper className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter">Global Ticker Hub</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Manage global news & announcements</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddingBroadcast(!isAddingBroadcast)} className="bg-white hover:bg-orange-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                                    {isAddingBroadcast ? <XCircle className="w-4 h-4 inline mr-2"/> : <Plus className="w-4 h-4 inline mr-2"/>}
                                    {isAddingBroadcast ? 'CANCEL' : 'DEPLOY TICKER'}
                                </button>
                             </div>

                             {isAddingBroadcast && (
                                 <form onSubmit={handleSaveBroadcast} className="bg-black/40 p-8 rounded-3xl border border-white/5 space-y-6 mb-10 animate-slide-up">
                                     <div>
                                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Message String</label>
                                         <input required placeholder="SYSTEM MAINTENANCE SCHEDULED FOR 2:00 AM..." className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-orange-500" value={broadcastForm.message} onChange={e => setBroadcastForm({...broadcastForm, message: e.target.value})} />
                                     </div>
                                     <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all">DEPLOY TICKER BROADCAST</button>
                                 </form>
                             )}

                             <div className="space-y-4">
                                 {broadcasts.map(b => (
                                     <div key={b.id} className="bg-zinc-950 p-6 rounded-2xl border border-white/5 flex justify-between items-center group">
                                         <div className="flex items-center gap-6">
                                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                            <p className="text-xs font-black uppercase tracking-widest text-zinc-300">{b.message}</p>
                                         </div>
                                         <button onClick={async () => { if(window.confirm("Purge ticker?")) await db.collection('systemBroadcasts').doc(b.id).delete(); }} className="text-zinc-800 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                     </div>
                                 ))}
                                 {broadcasts.length === 0 && <div className="p-20 text-center text-zinc-700 italic font-black uppercase text-[10px] tracking-widest">No ticker broadcasts active</div>}
                             </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default SuperAdminDashboard;
