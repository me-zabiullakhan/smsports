
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { db } from '../firebase';
import { AuctionSetup } from '../types';
import { Users, Gavel, PlayCircle, Shield, Search, RefreshCw, Trash2, Edit, ExternalLink, Menu, LogOut, Database, UserCheck, LayoutDashboard, Globe, ChevronRight, Settings } from 'lucide-react';

const SuperAdminDashboard: React.FC = () => {
    const { userProfile, logout } = useAuction();
    const navigate = useNavigate();
    const [auctions, setAuctions] = useState<AuctionSetup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        totalAuctions: 0,
        activeAuctions: 0,
        totalAccounts: 0,
    });

    useEffect(() => {
        setLoading(true);
        // Fetch ALL auctions globally
        const unsubscribe = db.collection('auctions').onSnapshot((snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            
            setAuctions(data);
            
            // Extract unique owner IDs to estimate accounts
            const uniqueOwners = new Set(data.map(a => a.createdBy).filter(Boolean));
            
            const activeCount = data.filter(a => 
                a.status === 'LIVE' || 
                a.status === 'DRAFT' || 
                (a.status as any) === 'IN_PROGRESS'
            ).length;

            setStats({
                totalAuctions: data.length,
                activeAuctions: activeCount,
                totalAccounts: uniqueOwners.size
            });
            
            setLoading(false);
        }, (error) => {
            console.error("Super Admin Fetch Error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string, title: string) => {
        if (window.confirm(`PERMANENT SYSTEM DELETE:\nAre you sure you want to WIPER "${title}" from the cloud?\nThis cannot be reversed.`)) {
            try {
                await db.collection('auctions').doc(id).delete();
            } catch (e: any) {
                alert("Delete failed: " + e.message);
            }
        }
    };

    const handleEdit = (id: string) => {
        // Super admin can edit any auction using the standard manage screen
        navigate(`/admin/auction/${id}/manage`);
    };

    const filteredAuctions = auctions.filter(a => 
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.createdBy?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-black font-sans text-white selection:bg-red-500 selection:text-white">
            {/* Master Navbar */}
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
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{userProfile?.name || 'ROOT'}</span>
                            <span className="text-[10px] text-red-500 font-bold uppercase">{userProfile?.email}</span>
                        </div>
                        <button onClick={logout} className="bg-zinc-900 hover:bg-red-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all shadow-xl active:scale-95">
                            <LogOut className="w-4 h-4 mr-2"/> Termination
                        </button>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-10 max-w-7xl">
                {/* Global Pulse Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Database className="w-24 h-24" />
                        </div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Cloud Footprint</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-6xl font-black text-white">{stats.totalAuctions}</h2>
                            <span className="text-sm font-bold text-zinc-600 uppercase">Auctions</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-zinc-400">
                            <Globe className="w-3 h-3" /> System Wide Data
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <PlayCircle className="w-24 h-24" />
                        </div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Real-time Pulse</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-6xl font-black text-green-500">{stats.activeAuctions}</h2>
                            <span className="text-sm font-bold text-zinc-600 uppercase">Live Ops</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-green-500/50">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Active Connections
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <UserCheck className="w-24 h-24" />
                        </div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Total Ecosystem</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-6xl font-black text-blue-500">{stats.totalAccounts}</h2>
                            <span className="text-sm font-bold text-zinc-600 uppercase">Unique IDs</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-500/50">
                            <Users className="w-3 h-3" /> Managed Identities
                        </div>
                    </div>
                </div>

                {/* Master Database Registry */}
                <div className="bg-zinc-950 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden">
                    <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-zinc-900 p-3 rounded-2xl border border-white/5">
                                <LayoutDashboard className="w-6 h-6 text-red-500"/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tighter uppercase">Registry Explorer</h2>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Full Tenant Inspection</p>
                            </div>
                        </div>
                        
                        <div className="relative w-full md:w-auto flex-grow max-w-xl">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"/>
                            <input 
                                type="text" 
                                placeholder="SEARCH TITLE, UID, ID, OR PROTOCOL..." 
                                className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-xs font-black uppercase tracking-widest focus:border-red-500/50 outline-none focus:ring-4 ring-red-500/5 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <button onClick={() => window.location.reload()} className="p-4 bg-zinc-900 hover:bg-white hover:text-black rounded-2xl transition-all shadow-xl active:scale-95">
                            <RefreshCw className="w-5 h-5"/>
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-32 text-center text-zinc-600 flex flex-col items-center">
                            <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-6"></div>
                            <p className="font-black uppercase tracking-[0.5em] text-xs">Accessing Mainframe...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-900/50 text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em]">
                                    <tr>
                                        <th className="p-6">Timestamp</th>
                                        <th className="p-6">Instance Identity</th>
                                        <th className="p-6">Protocol</th>
                                        <th className="p-6">Owner UID</th>
                                        <th className="p-6">Status</th>
                                        <th className="p-6 text-right">Execution</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredAuctions.length > 0 ? filteredAuctions.map(auction => (
                                        <tr key={auction.id} className="hover:bg-white/5 transition-all group">
                                            <td className="p-6 text-[10px] text-zinc-400 font-black tabular-nums">
                                                {new Date(auction.createdAt).toLocaleString()}
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-zinc-900 rounded-xl border border-white/10 flex items-center justify-center font-black text-xs group-hover:border-red-500/50 transition-all">
                                                        {auction.title.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-sm text-white block tracking-tight uppercase">{auction.title}</span>
                                                        <span className="text-[10px] text-zinc-600 font-bold">ID: {auction.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-900 px-3 py-1.5 rounded-lg border border-white/5">
                                                    {auction.sport}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-2 group/uid">
                                                    <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px] select-all" title={auction.createdBy}>
                                                        {auction.createdBy || 'SYSTEM'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${
                                                        (auction.status as any) === 'IN_PROGRESS' || auction.status === 'LIVE' ? 'bg-green-500 animate-pulse' :
                                                        auction.status === 'COMPLETED' ? 'bg-blue-500' : 'bg-zinc-700'
                                                    }`}></span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        {auction.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-30 group-hover:opacity-100 transition-all">
                                                    <button 
                                                        onClick={() => navigate(`/auction/${auction.id}`)}
                                                        className="p-3 bg-zinc-800 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"
                                                        title="Live View"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEdit(auction.id!)}
                                                        className="p-3 bg-zinc-800 text-yellow-400 hover:bg-yellow-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"
                                                        title="System Override Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(auction.id!, auction.title)}
                                                        className="p-3 bg-zinc-800 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"
                                                        title="Destroy Entity"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="p-20 text-center text-zinc-700">
                                                <Database className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                                <p className="font-black uppercase tracking-[0.4em] text-xs">No entries found matching criteria</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                {/* Advanced Settings Bottom Bar */}
                <div className="mt-12 flex flex-col md:flex-row items-center justify-between p-10 bg-gradient-to-r from-zinc-950 to-zinc-900 rounded-[2.5rem] border border-white/5 gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-zinc-900 rounded-3xl border border-white/5">
                            <Settings className="w-8 h-8 text-zinc-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tighter">Instance Protocols</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Manage global system parameters</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button className="px-8 py-4 bg-zinc-900 hover:bg-white hover:text-black text-[10px] font-black uppercase tracking-widest rounded-2xl border border-white/5 transition-all">Clear Global Cache</button>
                        <button className="px-8 py-4 bg-zinc-900 hover:bg-white hover:text-black text-[10px] font-black uppercase tracking-widest rounded-2xl border border-white/5 transition-all">System Diagnostic</button>
                        <button className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-[0_10px_20px_rgba(220,38,38,0.2)] transition-all">Maintenance Mode</button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SuperAdminDashboard;
