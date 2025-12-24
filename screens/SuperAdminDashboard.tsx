
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { db } from '../firebase';
import { AuctionSetup, ScoreboardTheme, ScoringAsset } from '../types';
import { Users, Gavel, PlayCircle, Shield, Search, RefreshCw, Trash2, Edit, ExternalLink, Menu, LogOut, Database, UserCheck, LayoutDashboard, Globe, ChevronRight, Settings, Image as ImageIcon, Upload, Save, Eye, EyeOff, Layout, XCircle, Plus } from 'lucide-react';

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 720;
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
    const { state, userProfile, logout } = useAuction();
    const navigate = useNavigate();
    const [auctions, setAuctions] = useState<AuctionSetup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        totalAuctions: 0,
        activeAuctions: 0,
        totalAccounts: 0,
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

    useEffect(() => {
        setLoading(true);
        const unsubscribe = db.collection('auctions').onSnapshot((snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setAuctions(data);
            const uniqueOwners = new Set(data.map(a => a.createdBy).filter(Boolean));
            const activeCount = data.filter(a => a.status === 'LIVE' || a.status === 'DRAFT' || (a.status as any) === 'IN_PROGRESS').length;
            setStats({ totalAuctions: data.length, activeAuctions: activeCount, totalAccounts: uniqueOwners.size });
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

        return () => {
            unsubscribe();
            unsubConfig();
            unsubGlobalAssets();
        };
    }, []);

    useEffect(() => {
        if (state.systemLogoUrl) setLogoPreview(state.systemLogoUrl);
    }, [state.systemLogoUrl]);

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

    const filteredAuctions = auctions.filter(a => 
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.createdBy?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <div className="flex items-center gap-6">
                        <button onClick={logout} className="bg-zinc-900 hover:bg-red-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all shadow-xl active:scale-95">
                            <LogOut className="w-4 h-4 mr-2"/> Termination
                        </button>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-10 max-w-7xl">
                
                <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl mb-12 flex flex-col md:flex-row items-center gap-10">
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

                <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl mb-12">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="bg-blue-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                            <Layout className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Broadcast Packages</h2>
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Manage scoreboard registry visibility</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {THEMES_LIST.map(theme => {
                            const isHidden = hiddenThemes.includes(theme.id);
                            return (
                                <div key={theme.id} className={`bg-zinc-950 p-6 rounded-3xl border-2 transition-all relative overflow-hidden group ${isHidden ? 'border-zinc-800 opacity-50' : 'border-blue-500/30 hover:border-blue-500'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-zinc-900 px-3 py-1 rounded-full text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] border border-white/5">
                                            {theme.year}
                                        </div>
                                        <button 
                                            onClick={() => toggleThemeVisibility(theme.id)}
                                            disabled={updatingThemes}
                                            className={`p-2 rounded-xl transition-all ${isHidden ? 'bg-zinc-800 text-zinc-500 hover:text-white' : 'bg-blue-600 text-white shadow-lg'}`}
                                        >
                                            {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-tight text-white mb-2">{theme.label}</h3>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{isHidden ? 'Currently Hidden' : 'Active Registry'}</p>
                                    
                                    <div className={`absolute bottom-0 left-0 h-1 transition-all ${isHidden ? 'w-0' : 'w-full bg-blue-500'}`}></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl mb-12">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="bg-emerald-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                            <ImageIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Global Scoreboard Backgrounds</h2>
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Upload backgrounds available for all scoring matches</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <div className="bg-black/40 p-8 rounded-3xl border border-white/5 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Background Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 text-xs font-black uppercase tracking-widest outline-none focus:border-emerald-500 transition-all" 
                                    placeholder="E.G. FINALS BACKGROUND"
                                    value={newAssetName}
                                    onChange={e => setNewAssetName(e.target.value)}
                                />
                            </div>
                            <div 
                                onClick={() => assetFileRef.current?.click()}
                                className="aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-zinc-800/50 transition-all group relative overflow-hidden"
                            >
                                {assetPreview ? (
                                    <img src={assetPreview} className="max-h-full max-w-full object-contain relative z-10" />
                                ) : (
                                    <>
                                        <Upload className="w-10 h-10 text-zinc-700 group-hover:text-emerald-500 transition-colors mb-2" />
                                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Select Image</p>
                                    </>
                                )}
                                <input ref={assetFileRef} type="file" className="hidden" accept="image/*" onChange={handleAssetFileChange} />
                            </div>
                            <button 
                                onClick={handleUploadGlobalAsset}
                                disabled={uploadingAsset || !assetPreview || !newAssetName}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl"
                            >
                                {uploadingAsset ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                UPLOAD GLOBAL BACKGROUND
                            </button>
                        </div>

                        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-6 overflow-y-auto max-h-[500px] pr-4 custom-scrollbar">
                            {globalAssets.map(asset => (
                                <div key={asset.id} className="bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden group relative">
                                    <div className="aspect-video bg-black flex items-center justify-center relative">
                                        <img src={asset.url} className="max-h-full transition-transform group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                            <button 
                                                onClick={() => deleteGlobalAsset(asset.id)}
                                                className="bg-red-600 text-white p-3 rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <p className="font-black text-[10px] uppercase tracking-tighter truncate text-zinc-400">{asset.name}</p>
                                    </div>
                                </div>
                            ))}
                            {globalAssets.length === 0 && (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-zinc-700 opacity-20">
                                    <ImageIcon className="w-20 h-20 mb-4" />
                                    <p className="font-black uppercase tracking-[0.4em]">No Global Backgrounds</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Database className="w-24 h-24" /></div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Cloud Footprint</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-6xl font-black text-white">{stats.totalAuctions}</h2>
                            <span className="text-sm font-bold text-zinc-600 uppercase">Auctions</span>
                        </div>
                    </div>
                    <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><PlayCircle className="w-24 h-24" /></div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Real-time Pulse</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-6xl font-black text-green-500">{stats.activeAuctions}</h2>
                            <span className="text-sm font-bold text-zinc-600 uppercase">Live Ops</span>
                        </div>
                    </div>
                    <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><UserCheck className="w-24 h-24" /></div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Total Ecosystem</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-6xl font-black text-blue-500">{stats.totalAccounts}</h2>
                            <span className="text-sm font-bold text-zinc-600 uppercase">Unique IDs</span>
                        </div>
                    </div>
                </div>

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
                        <button onClick={() => window.location.reload()} className="p-4 bg-zinc-900 hover:bg-white hover:text-black rounded-2xl transition-all shadow-xl active:scale-95"><RefreshCw className="w-5 h-5"/></button>
                    </div>

                    {loading ? (
                        <div className="p-32 text-center text-zinc-600 flex flex-col items-center"><div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-6"></div><p className="font-black uppercase tracking-[0.5em] text-xs">Accessing Mainframe...</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-900/50 text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em]"><tr><th className="p-6">Timestamp</th><th className="p-6">Instance Identity</th><th className="p-6">Protocol</th><th className="p-6">Owner UID</th><th className="p-6">Status</th><th className="p-6 text-right">Execution</th></tr></thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredAuctions.length > 0 ? filteredAuctions.map(auction => (
                                        <tr key={auction.id} className="hover:bg-white/5 transition-all group">
                                            <td className="p-6 text-[10px] text-zinc-400 font-black tabular-nums">{new Date(auction.createdAt).toLocaleString()}</td>
                                            <td className="p-6"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-zinc-900 rounded-xl border border-white/10 flex items-center justify-center font-black text-xs group-hover:border-red-500/50 transition-all">{auction.title.charAt(0)}</div><div><span className="font-black text-sm text-white block tracking-tight uppercase">{auction.title}</span><span className="text-[10px] text-zinc-600 font-bold">ID: {auction.id}</span></div></div></td>
                                            <td className="p-6"><span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-900 px-3 py-1.5 rounded-lg border border-white/5">{auction.sport}</span></td>
                                            <td className="p-6"><div className="flex items-center gap-2 group/uid"><span className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px] select-all" title={auction.createdBy}>{auction.createdBy || 'SYSTEM'}</span></div></td>
                                            <td className="p-6"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${(auction.status as any) === 'IN_PROGRESS' || auction.status === 'LIVE' ? 'bg-green-500 animate-pulse' : auction.status === 'COMPLETED' ? 'bg-blue-500' : 'bg-zinc-700'}`}></span><span className="text-[10px] font-black uppercase tracking-widest">{auction.status}</span></div></td>
                                            <td className="p-6 text-right"><div className="flex justify-end gap-2 opacity-30 group-hover:opacity-100 transition-all">
                                                <button onClick={() => navigate(`/auction/${auction.id}`)} className="p-3 bg-zinc-800 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"><ExternalLink className="w-4 h-4" /></button>
                                                <button onClick={() => handleEdit(auction.id!)} className="p-3 bg-zinc-800 text-yellow-400 hover:bg-yellow-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(auction.id!, auction.title)} className="p-3 bg-zinc-800 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"><Trash2 className="w-4 h-4" /></button>
                                            </div></td>
                                        </tr>
                                    )) : (<tr><td colSpan={6} className="p-20 text-center text-zinc-700"><Database className="w-12 h-12 mx-auto mb-4 opacity-10" /><p className="font-black uppercase tracking-[0.4em] text-xs">No entries found matching criteria</p></td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default SuperAdminDashboard;
