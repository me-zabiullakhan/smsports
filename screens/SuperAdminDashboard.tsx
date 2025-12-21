
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { db } from '../firebase';
import { AuctionSetup } from '../types';
import { Users, Gavel, PlayCircle, Shield, Search, RefreshCw, Trash2, Edit, ExternalLink, Menu, LogOut, Database, UserCheck, LayoutDashboard, Globe, ChevronRight, Settings, Image as ImageIcon, Upload, Save } from 'lucide-react';

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
                resolve(canvas.toDataURL('image/png', 0.8));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

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
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (state.systemLogoUrl) setLogoPreview(state.systemLogoUrl);
    }, [state.systemLogoUrl]);

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
                
                {/* System Identity & Global Branding */}
                <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl mb-12 flex flex-col md:flex-row items-center gap-10">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            {/* LOGO FRAME */}
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
