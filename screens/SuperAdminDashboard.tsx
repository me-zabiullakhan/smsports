import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { db } from '../firebase';
import { AuctionSetup, ScoreboardTheme, ScoringAsset, PromoCode, SystemPopup } from '../types';
import { Users, Gavel, PlayCircle, Shield, Search, RefreshCw, Trash2, Edit, ExternalLink, LogOut, Database, UserCheck, LayoutDashboard, Settings, Image as ImageIcon, Upload, Save, Eye, EyeOff, Layout, XCircle, Plus, CreditCard, CheckCircle, Tag, Clock, Ban, Check, Zap, Server, Activity, AlertTriangle, HardDrive, Calendar, ShieldCheck, Megaphone, Bell, Timer, Infinity as InfinityIcon } from 'lucide-react';

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

const THEMES_LIST: {id: ScoreboardTheme, label: string, year: string}[] = [
    { id: 'ICC_T20_2010', label: 'Classic ICC 2010', year: '2010' },
    { id: 'ICC_T20_2012', label: 'Signature ICC 2012', year: '2012' },
    { id: 'ICC_T20_2014', label: 'Compact ICC 2014', year: '2014' },
    { id: 'ICC_T20_2016', label: 'Dynamic ICC 2016', year: '2016' },
    { id: 'ICC_T20_2021', label: 'Modern Pink 2021', year: '2021' },
    { id: 'ICC_T20_2022', label: 'Crimson Glow 2022', year: '2022' },
    { id: 'ICC_T20_2024', label: 'NexGen Dark 2024', year: '2024' },
    { id: 'DEFAULT', label: 'Standard Minimal', year: 'Current' },
];

const SuperAdminDashboard: React.FC = () => {
    const { state, logout } = useAuction();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PLANS' | 'PROMOS' | 'ALERTS' | 'BROADCAST' | 'DATABASE' | 'GRAPHICS'>('OVERVIEW');
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
        totalDocsEstimate: 0
    });

    const [logoPreview, setLogoPreview] = useState(state.systemLogoUrl || '');
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [savingLogo, setSavingLogo] = useState(false);

    const [globalAssets, setGlobalAssets] = useState<ScoringAsset[]>([]);
    const [newAssetName, setNewAssetName] = useState('');
    const [assetPreview, setAssetPreview] = useState('');
    const assetFileRef = useRef<HTMLInputElement>(null);
    const [uploadingAsset, setUploadingAsset] = useState(false);

    const [hiddenThemes, setHiddenThemes] = useState<string[]>([]);
    const [updatingThemes, setUpdatingThemes] = useState(false);

    // Plans Management State
    const [dbPlans, setDbPlans] = useState<any[]>([]);
    const [planForm, setPlanForm] = useState({ id: '', name: '', price: 0, teams: 0 });
    const [isEditingPlan, setIsEditingPlan] = useState(false);
    const [isAddingPlan, setIsAddingPlan] = useState(false);

    // Promo Codes State
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [promoForm, setPromoForm] = useState<Partial<PromoCode>>({
        code: '', discountType: 'PERCENT', discountValue: 0, maxClaims: 10, expiryDate: Date.now() + 604800000, active: true
    });
    const [isAddingPromo, setIsAddingPromo] = useState(false);

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

    useEffect(() => {
        setLoading(true);
        const unsubscribe = db.collection('auctions').onSnapshot(async (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setAuctions(data);
            const uniqueOwners = new Set(data.map(a => a.createdBy).filter(Boolean));
            const activeCount = data.filter(a => a.status === 'LIVE' || a.status === 'DRAFT' || (a.status as any) === 'IN_PROGRESS').length;
            
            const matchesSnap = await db.collection('matches').get();
            const playersSnap = await db.collectionGroup('players').get();
            const teamsSnap = await db.collectionGroup('teams').get();

            const docCount = snapshot.size + matchesSnap.size + playersSnap.size + teamsSnap.size;

            setStats({ 
                totalAuctions: data.length, 
                activeAuctions: activeCount, 
                totalAccounts: uniqueOwners.size,
                totalPlayers: playersSnap.size,
                totalMatches: matchesSnap.size,
                totalTeams: teamsSnap.size,
                totalDocsEstimate: docCount
            });
            setLoading(false);
        });

        const unsubConfig = db.collection('appConfig').doc('scoreboardConfig').onSnapshot(doc => {
            if (doc.exists) {
                setHiddenThemes(doc.data()?.hiddenThemes || []);
            }
        });

        const unsubGlobalAssets = db.collection('globalAssets').onSnapshot(snap => {
            setGlobalAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScoringAsset)));
        });

        const unsubPlans = db.collection('subscriptionPlans').orderBy('price', 'asc').onSnapshot(snap => {
            setDbPlans(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
        });

        const unsubPromos = db.collection('promoCodes').onSnapshot(snap => {
            setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode)));
        });

        const unsubRetention = db.collection('appConfig').doc('globalSettings').onSnapshot(doc => {
            if(doc.exists) setRetentionDays(doc.data()?.defaultRetentionDays || 30);
        });

        const unsubPopups = db.collection('systemPopups').onSnapshot(snap => {
            setPopups(snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemPopup)));
        });

        return () => {
            unsubscribe();
            unsubConfig();
            unsubGlobalAssets();
            unsubPlans();
            unsubPromos();
            unsubRetention();
            unsubPopups();
        };
    }, []);

    useEffect(() => {
        if (state.systemLogoUrl) setLogoPreview(state.systemLogoUrl);
    }, [state.systemLogoUrl]);

    const handleSavePopup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                ...popupForm,
                imageUrl: popupPreviewImg,
                createdAt: Date.now()
            };
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
    };

    const deletePopup = async (id: string) => {
        if (window.confirm("Purge this system alert from the cloud?")) {
            await db.collection('systemPopups').doc(id).delete();
        }
    };

    const handleSavePromo = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                ...promoForm,
                code: promoForm.code?.toUpperCase(),
                currentClaims: 0,
                active: true
            };
            await db.collection('promoCodes').add(data);
            setIsAddingPromo(false);
            setPromoForm({ code: '', discountType: 'PERCENT', discountValue: 0, maxClaims: 10, expiryDate: Date.now() + 604800000 });
            alert("Promo Protocol Deployed!");
        } catch (err: any) {
            alert("Promo Fail: " + err.message);
        }
    };

    const togglePromoStatus = async (promo: PromoCode) => {
        await db.collection('promoCodes').doc(promo.id).update({ active: !promo.active });
    };

    const deletePromo = async (id: string) => {
        if (window.confirm("Purge promo code from system?")) {
            await db.collection('promoCodes').doc(id).delete();
        }
    };

    const handleManualPaidToggle = async (auctionId: string, currentStatus: boolean) => {
        try {
            await db.collection('auctions').doc(auctionId).update({ isPaid: !currentStatus });
        } catch (e: any) { alert("Toggle failed: " + e.message); }
    };

    const handleLifetimeToggle = async (auctionId: string, currentLifetime: boolean) => {
        try {
            await db.collection('auctions').doc(auctionId).update({ 
                isLifetime: !currentLifetime,
                autoDeleteAt: !currentLifetime ? null : (Date.now() + 30 * 24 * 60 * 60 * 1000) // Re-enable retention if toggled off
            });
        } catch (e: any) { alert("Toggle failed: " + e.message); }
    };

    const handlePlanManualChange = async (auctionId: string, newPlanId: string) => {
        const plan = dbPlans.find(p => p.docId === newPlanId);
        if (!plan) return;
        try {
            await db.collection('auctions').doc(auctionId).update({ 
                planId: newPlanId,
                totalTeams: plan.teams 
            });
        } catch (e: any) { alert("Plan change failed"); }
    };

    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const planData = {
                name: planForm.name,
                price: Number(planForm.price),
                teams: Number(planForm.teams),
                features: ['Squad Management', 'Branding Removal', 'OBS & Projector Overlays', 'Public Player Registration', 'Custom Bidding Slabs', '24/7 Support']
            };

            if (isEditingPlan && planForm.id) {
                await db.collection('subscriptionPlans').doc(planForm.id).update(planData);
            } else {
                await db.collection('subscriptionPlans').add(planData);
            }
            setPlanForm({ id: '', name: '', price: 0, teams: 0 });
            setIsEditingPlan(false);
            setIsAddingPlan(false);
            alert("Plan Protocol Updated!");
        } catch (err: any) {
            alert("Protocol Failed: " + err.message);
        }
    };

    const deletePlan = async (planId: string) => {
        if (!window.confirm("Confirm deletion of this subscription protocol?")) return;
        await db.collection('subscriptionPlans').doc(planId).delete();
    };

    const toggleThemeVisibility = async (themeId: string) => {
        setUpdatingThemes(true);
        try {
            let newHidden = [...hiddenThemes];
            if (newHidden.includes(themeId)) {
                newHidden = newHidden.filter(t => t !== themeId);
            } else {
                newHidden.push(themeId);
            }
            await db.collection('appConfig').doc('scoreboardConfig').set({
                hiddenThemes: newHidden
            }, { merge: true });
        } catch (e: any) {
            alert("Update failed: " + e.message);
        }
        setUpdatingThemes(false);
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const compressed = await compressImage(e.target.files[0]);
            setLogoPreview(compressed);
        }
    };

    const saveSystemLogo = async () => {
        setSavingLogo(true);
        try {
            await db.collection('appConfig').doc('globalSettings').set({
                systemLogoUrl: logoPreview
            }, { merge: true });
            alert("System Logo Updated Successfully!");
        } catch (e: any) {
            alert("Failed to save: " + e.message);
        }
        setSavingLogo(false);
    };

    const handleAssetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const compressed = await compressImage(e.target.files[0]);
            setAssetPreview(compressed);
        }
    };

    const handleUploadGlobalAsset = async () => {
        if (!assetPreview || !newAssetName) return;
        setUploadingAsset(true);
        try {
            await db.collection('globalAssets').add({
                name: newAssetName,
                url: assetPreview,
                type: 'BACKGROUND',
                createdBy: 'SUPER_ADMIN',
                createdAt: Date.now()
            });
            setNewAssetName('');
            setAssetPreview('');
            alert("Global Scoreboard Background Uploaded!");
        } catch (e: any) {
            alert("Upload failed: " + e.message);
        }
        setUploadingAsset(false);
    };

    const deleteGlobalAsset = async (id: string) => {
        if (!window.confirm("Permanently delete this global graphic?")) return;
        await db.collection('globalAssets').doc(id).delete();
    };

    const handleDelete = async (id: string, title: string) => {
        if (window.confirm(`PERMANENT SYSTEM DELETE:\nAre you sure you want to WIPER "${title}" from the cloud?\nThis cannot be reversed.`)) {
            try { await db.collection('auctions').doc(id).delete(); } 
            catch (e: any) { alert("Delete failed: " + e.message); }
        }
    };

    const handleEdit = (id: string) => { navigate(`/admin/auction/${id}/manage`); };

    const handleScheduleDelete = async (auctionId: string, days: number) => {
        const deleteAt = Date.now() + (days * 24 * 60 * 60 * 1000);
        try {
            await db.collection('auctions').doc(auctionId).update({ autoDeleteAt: deleteAt, isLifetime: false });
            alert(`Deletion scheduled for T+${days} days.`);
        } catch(e: any) { alert("Fail: " + e.message); }
    };

    const handleSaveGlobalRetention = async () => {
        setSavingRetention(true);
        try {
            await db.collection('appConfig').doc('globalSettings').update({ defaultRetentionDays: retentionDays });
            alert("Global Retention Policy Updated.");
        } catch(e: any) { alert("Fail: " + e.message); }
        setSavingRetention(false);
    };

    const filteredAuctions = auctions.filter(a => 
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.createdBy?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Estimate GB Usage (Approx 2KB per doc + index overhead)
    const totalGB = (stats.totalDocsEstimate * 0.0000019).toFixed(4);

    return (
        <div className="min-h-screen bg-black font-sans text-white selection:bg-red-500 selection:text-white">
            <nav className="bg-zinc-950 border-b border-zinc-800/50 sticky top-0 z-50 backdrop-blur-xl">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/super-admin')}>
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
                            {id: 'PLANS', label: 'Subscriptions', icon: <CreditCard className="w-4 h-4"/>},
                            {id: 'PROMOS', label: 'Promos', icon: <Tag className="w-4 h-4"/>},
                            {id: 'ALERTS', label: 'Alerts', icon: <Megaphone className="w-4 h-4"/>},
                            {id: 'BROADCAST', label: 'Broadcast', icon: <Layout className="w-4 h-4"/>},
                            {id: 'DATABASE', label: 'Database', icon: <HardDrive className="w-4 h-4"/>},
                            {id: 'GRAPHICS', label: 'Graphics', icon: <ImageIcon className="w-4 h-4"/>},
                        ].map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                            >
                                {t.icon} <span className="hidden md:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-6">
                        <button onClick={logout} className="hidden md:flex bg-zinc-900 hover:bg-red-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all shadow-xl active:scale-95">
                            <LogOut className="w-4 h-4 mr-2"/> Termination
                        </button>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-10 max-w-7xl">
                
                {activeTab === 'OVERVIEW' && (
                    <div className="space-y-12 animate-fade-in">
                        {/* Master Branding */}
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
                                        className="absolute -bottom-4 -right-4 bg-red-600 hover:bg-red-500 p-4 rounded-2xl shadow-xl transition-all hover:scale-110 active:scale-95"
                                    >
                                        <Upload className="w-6 h-6" />
                                    </button>
                                    <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                                </div>
                                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">System Branding Logo</p>
                            </div>
                            
                            <div className="flex-1 text-center md:text-left">
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Master Branding Control</h2>
                                <p className="text-zinc-400 text-sm max-w-xl mb-8 leading-relaxed">
                                    Upload your official system logo here. This image will be automatically rendered in stylized frames across the landing page, dashboard headers, and all OBS live overlays.
                                </p>
                                <button 
                                    onClick={saveSystemLogo}
                                    disabled={savingLogo}
                                    className="bg-white hover:bg-red-600 hover:text-white text-black font-black px-10 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                                >
                                    {savingLogo ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />}
                                    APPLY GLOBAL BRANDING
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Cloud Usage</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-4xl font-black text-red-500">{totalGB}</h2>
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase">GB</span>
                                </div>
                            </div>
                            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Real-time Pulse</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-4xl font-black text-green-500">{stats.activeAuctions}</h2>
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase">Live Ops</span>
                                </div>
                            </div>
                            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Total Ecosystem</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-4xl font-black text-blue-500">{stats.totalAccounts}</h2>
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase">IDs</span>
                                </div>
                            </div>
                             <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Document Load</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-4xl font-black text-white">{stats.totalDocsEstimate.toLocaleString()}</h2>
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase">Units</span>
                                </div>
                            </div>
                        </div>

                        {/* Enhanced Registry Explorer */}
                        <div className="bg-zinc-950 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden">
                            <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-zinc-900 p-3 rounded-2xl border border-white/5"><LayoutDashboard className="w-6 h-6 text-red-500"/></div>
                                    <div><h2 className="text-2xl font-black tracking-tighter uppercase">Registry Explorer</h2><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Full Tenant Inspection</p></div>
                                </div>
                                <div className="relative w-full md:w-auto flex-grow max-w-xl">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"/>
                                    <input type="text" placeholder="SEARCH TITLE, UID, ID, OR PROTOCOL..." className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-xs font-black uppercase tracking-widest focus:border-red-500/50 outline-none focus:ring-4 ring-red-500/5 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-900/50 text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em]"><tr><th className="p-6">Instance</th><th className="p-6">Subscription</th><th className="p-6">Override Plan</th><th className="p-6">Retention Type</th><th className="p-6 text-right">Execution</th></tr></thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredAuctions.map(auction => (
                                            <tr key={auction.id} className="hover:bg-white/5 transition-all group">
                                                <td className="p-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-zinc-900 rounded-xl border border-white/10 flex items-center justify-center font-black text-xs group-hover:border-red-500/50 transition-all">{auction.title.charAt(0)}</div>
                                                        <div><span className="font-black text-sm text-white block tracking-tight uppercase">{auction.title}</span><span className="text-[10px] text-zinc-600 font-bold">UID: {auction.createdBy}</span></div>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <button 
                                                        onClick={() => handleManualPaidToggle(auction.id!, !!auction.isPaid)}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${auction.isPaid ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                                                    >
                                                        {auction.isPaid ? <CheckCircle className="w-3 h-3"/> : <Ban className="w-3 h-3"/>}
                                                        {auction.isPaid ? 'SUBSCRIPTION ACTIVE' : 'UNPAID INSTANCE'}
                                                    </button>
                                                </td>
                                                <td className="p-6">
                                                    <select 
                                                        className="bg-zinc-900 border border-white/5 rounded-lg p-1.5 text-[10px] font-black uppercase text-zinc-400 outline-none focus:border-red-500"
                                                        value={auction.planId || ''}
                                                        onChange={(e) => handlePlanManualChange(auction.id!, e.target.value)}
                                                    >
                                                        <option value="">(Select Plan)</option>
                                                        {dbPlans.map(p => <option key={p.docId} value={p.docId}>{p.name} ({p.teams}T)</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <button 
                                                            onClick={() => handleLifetimeToggle(auction.id!, !!auction.isLifetime)}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${auction.isLifetime ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
                                                        >
                                                            <InfinityIcon className="w-3 h-3" /> {auction.isLifetime ? 'LIFETIME ACTIVE' : 'Standard'}
                                                        </button>

                                                        {!auction.isLifetime && (
                                                             auction.autoDeleteAt ? (
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-1.5 text-orange-500 font-black text-[9px] uppercase">
                                                                        <Clock className="w-3 h-3"/> {new Date(auction.autoDeleteAt).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-1">
                                                                    {[7, 30].map(d => (
                                                                        <button key={d} onClick={() => handleScheduleDelete(auction.id!, d)} className="bg-zinc-800 hover:bg-red-600 px-2 py-1 rounded text-[8px] font-black uppercase transition-all">T+{d}</button>
                                                                    ))}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right"><div className="flex justify-end gap-2 opacity-30 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => navigate(`/auction/${auction.id}`)} className="p-3 bg-zinc-800 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"><ExternalLink className="w-4 h-4" /></button>
                                                    <button onClick={() => handleEdit(auction.id!)} className="p-3 bg-zinc-800 text-yellow-400 hover:bg-yellow-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"><Edit className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(auction.id!, auction.title)} className="p-3 bg-zinc-800 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"><Trash2 className="w-4 h-4" /></button>
                                                </div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

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
                                <button 
                                    onClick={() => setIsAddingPopup(!isAddingPopup)}
                                    className="bg-white hover:bg-purple-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                                >
                                    {isAddingPopup ? <XCircle className="w-4 h-4 inline mr-2"/> : <Plus className="w-4 h-4 inline mr-2"/>}
                                    {isAddingPopup ? 'CANCEL' : 'ESTABLISH BROADCAST'}
                                </button>
                             </div>

                             {isAddingPopup && (
                                 <form onSubmit={handleSavePopup} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-slide-up">
                                     <div className="md:col-span-2 space-y-4">
                                         <div>
                                             <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Alert Title</label>
                                             <input required placeholder="E.G. SCHEDULED MAINTENANCE" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-purple-500" value={popupForm.title} onChange={e => setPopupForm({...popupForm, title: e.target.value})} />
                                         </div>
                                         <div>
                                             <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Broadcast Message</label>
                                             <textarea rows={4} required placeholder="DETAILED MESSAGE FOR USERS..." className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-bold outline-none focus:border-purple-500" value={popupForm.message} onChange={e => setPopupForm({...popupForm, message: e.target.value})} />
                                         </div>
                                         <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Login Delay (Seconds)</label>
                                                <input type="number" required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none focus:border-purple-500" value={popupForm.delaySeconds} onChange={e => setPopupForm({...popupForm, delaySeconds: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Expiry Date</label>
                                                <input type="date" required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none focus:border-purple-500" onChange={e => setPopupForm({...popupForm, expiryDate: new Date(e.target.value).getTime()})} />
                                            </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Confirm Btn Text</label>
                                                <input required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none focus:border-purple-500 uppercase" value={popupForm.okButtonText} onChange={e => setPopupForm({...popupForm, okButtonText: e.target.value.toUpperCase()})} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Close Btn Text</label>
                                                <input required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none focus:border-purple-500 uppercase" value={popupForm.closeButtonText} onChange={e => setPopupForm({...popupForm, closeButtonText: e.target.value.toUpperCase()})} />
                                            </div>
                                         </div>
                                     </div>
                                     <div className="space-y-6">
                                         <div className="flex flex-col items-center">
                                            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Alert Graphic</label>
                                            <div onClick={() => popupImgRef.current?.click()} className="w-full aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 overflow-hidden relative">
                                                {popupPreviewImg ? <img src={popupPreviewImg} className="w-full h-full object-cover" /> : <ImageIcon className="w-12 h-12 text-zinc-700" />}
                                                <input ref={popupImgRef} type="file" className="hidden" accept="image/*" onChange={async (e) => { if(e.target.files?.[0]) setPopupPreviewImg(await compressImage(e.target.files[0])); }} />
                                            </div>
                                         </div>
                                         <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                                                <span className="text-[10px] font-black text-zinc-500 uppercase">Show Image</span>
                                                <button type="button" onClick={() => setPopupForm({...popupForm, showImage: !popupForm.showImage})} className={`p-2 rounded-xl ${popupForm.showImage ? 'bg-purple-600' : 'bg-zinc-800'}`}>
                                                    {popupForm.showImage ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                                                <span className="text-[10px] font-black text-zinc-500 uppercase">Show Text</span>
                                                <button type="button" onClick={() => setPopupForm({...popupForm, showText: !popupForm.showText})} className={`p-2 rounded-xl ${popupForm.showText ? 'bg-purple-600' : 'bg-zinc-800'}`}>
                                                    {popupForm.showText ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                                                </button>
                                            </div>
                                         </div>
                                         <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2">
                                             <Megaphone className="w-5 h-5"/> INITIALIZE ALERT BROADCAST
                                         </button>
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                 {popups.map(p => (
                                     <div key={p.id} className={`bg-zinc-950 p-6 rounded-3xl border-2 transition-all relative overflow-hidden group ${p.isActive ? 'border-purple-500/20' : 'border-zinc-800 opacity-50'}`}>
                                         <div className="flex justify-between items-start mb-4">
                                             <h3 className="text-xl font-black text-white uppercase tracking-tight truncate max-w-[150px]">{p.title}</h3>
                                             <div className="flex gap-1">
                                                <button onClick={() => { setPopupForm(p); setPopupPreviewImg(p.imageUrl || ''); setIsAddingPopup(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-2 text-zinc-500 hover:text-white"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => deletePopup(p.id!)} className="p-2 text-zinc-500 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                             </div>
                                         </div>
                                         <p className="text-[10px] text-zinc-400 font-bold mb-4 line-clamp-2">{p.message}</p>
                                         <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-zinc-500 pt-4 border-t border-white/5">
                                            <span className="flex items-center gap-1"><Timer className="w-3 h-3"/> {p.delaySeconds}S DELAY</span>
                                            <span className="flex items-center gap-1"><Bell className="w-3 h-3"/> EXP: {new Date(p.expiryDate).toLocaleDateString()}</span>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === 'DATABASE' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex items-center gap-4 mb-10">
                                <div className="bg-red-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                                    <HardDrive className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter">Database Management</h2>
                                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Full system resource & intensity control</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                                <div className="bg-black/40 p-8 rounded-3xl border border-white/5">
                                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-2">Total Registry Docs</p>
                                    <h3 className="text-4xl font-black text-white">{stats.totalDocsEstimate.toLocaleString()}</h3>
                                </div>
                                <div className="bg-black/40 p-8 rounded-3xl border border-white/5">
                                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-2">Total Storage Intensity</p>
                                    <h3 className="text-4xl font-black text-red-500">{totalGB} <span className="text-xs">GB</span></h3>
                                </div>
                                <div className="bg-black/40 p-8 rounded-3xl border border-white/5">
                                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-2">Infrastructure Status</p>
                                    <h3 className="text-4xl font-black text-green-500">HEALTHY</h3>
                                </div>
                                <div className="bg-black/40 p-8 rounded-3xl border border-white/5">
                                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-2">Avg. Latency</p>
                                    <h3 className="text-4xl font-black text-blue-400">12ms</h3>
                                </div>
                             </div>

                             <div className="bg-zinc-950 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5"><ShieldCheck className="w-40 h-40" /></div>
                                <div className="relative z-10 max-w-2xl">
                                    <h3 className="text-xl font-black uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" /> Data Retention Protocol
                                    </h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                                        Configure the default lifecycle for auction instances. After the retention period, 
                                        unpaid or completed auctions are flagged for automated cloud purging. Individual auctions marked as <b>LIFETIME</b> will override this protocol.
                                    </p>
                                    
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <div className="w-full sm:w-auto">
                                            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Retention Threshold (Days)</label>
                                            <input 
                                                type="number" 
                                                className="w-full sm:w-40 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xl font-black outline-none focus:border-red-500 text-center" 
                                                value={retentionDays}
                                                onChange={e => setRetentionDays(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="flex-1 flex items-end">
                                            <button 
                                                onClick={handleSaveGlobalRetention}
                                                disabled={savingRetention}
                                                className="w-full bg-white hover:bg-red-600 text-black hover:text-white font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2"
                                            >
                                                {savingRetention ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                                                INITIALIZE GLOBAL POLICY
                                            </button>
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {/* Subscription Plans tab remains existing */}
                {activeTab === 'PLANS' && (
                    <div className="space-y-12 animate-fade-in">
                        <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                             <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                                        <Server className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter">Subscription Plans</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configure pricing and team limits</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setIsAddingPlan(!isAddingPlan); setIsEditingPlan(false); setPlanForm({ id: '', name: '', price: 0, teams: 0 }); }}
                                    className="bg-white hover:bg-blue-600 text-black hover:text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                                >
                                    {isAddingPlan ? <XCircle className="w-4 h-4 inline mr-2"/> : <Plus className="w-4 h-4 inline mr-2"/>}
                                    {isAddingPlan ? 'CANCEL' : 'DEPLOY PLAN'}
                                </button>
                             </div>

                             {(isAddingPlan || isEditingPlan) && (
                                 <form onSubmit={handleSavePlan} className="bg-black/40 p-8 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-slide-up">
                                     <div>
                                         <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Plan Name</label>
                                         <input required placeholder="E.G. PRO PACKAGE" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-blue-500" value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Price (INR)</label>
                                         <input type="number" required placeholder="0 for Free" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none focus:border-blue-500" value={planForm.price} onChange={e => setPlanForm({...planForm, price: Number(e.target.value)})} />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Team Limit</label>
                                         <input type="number" required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none focus:border-blue-500" value={planForm.teams} onChange={e => setPlanForm({...planForm, teams: Number(e.target.value)})} />
                                     </div>
                                     <div className="md:col-span-3">
                                         <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-black w-full py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2">
                                             <Save className="w-5 h-5"/> {isEditingPlan ? 'UPDATE PLAN PROTOCOL' : 'INITIALIZE PLAN PROTOCOL'}
                                         </button>
                                     </div>
                                 </form>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                 {dbPlans.map(p => (
                                     <div key={p.docId} className="bg-zinc-950 p-6 rounded-3xl border-2 border-white/5 hover:border-blue-500/20 transition-all relative overflow-hidden group">
                                         <div className="flex justify-between items-start mb-6">
                                             <span className="text-xl font-black tracking-tighter uppercase text-white">{p.name}</span>
                                             <div className="flex gap-2">
                                                <button onClick={() => { setIsEditingPlan(true); setIsAddingPlan(false); setPlanForm({ id: p.docId, name: p.name, price: p.price, teams: p.teams }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-zinc-600 hover:text-blue-500"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => deletePlan(p.docId)} className="p-2 text-zinc-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                             </div>
                                         </div>
                                         <div className="flex items-baseline gap-2 mb-4">
                                             <span className="text-4xl font-black text-blue-500">₹{p.price}</span>
                                             <span className="text-[10px] font-bold text-zinc-500 uppercase">per auction</span>
                                         </div>
                                         <div className="space-y-4 border-t border-white/5 pt-4">
                                            <div className="flex items-center gap-3 text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                                                <Users className="w-4 h-4 text-blue-500"/> Supports up to {p.teams} Teams
                                            </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SuperAdminDashboard;