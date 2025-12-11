
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { db } from '../firebase';
import { AuctionSetup } from '../types';
import { Users, Gavel, PlayCircle, Shield, Search, RefreshCw, Trash2, Edit, ExternalLink, Menu, LogOut, Database } from 'lucide-react';

const SuperAdminDashboard: React.FC = () => {
    const { userProfile, logout } = useAuction();
    const navigate = useNavigate();
    const [auctions, setAuctions] = useState<AuctionSetup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        totalAuctions: 0,
        activeAuctions: 0,
        totalRevenue: 0, // Placeholder for future logic
    });

    useEffect(() => {
        setLoading(true);
        // Fetch ALL auctions (no where clause for createdBy)
        const unsubscribe = db.collection('auctions').onSnapshot((snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            
            setAuctions(data);
            
            // Calc Stats
            const active = data.filter(a => a.status === 'LIVE' || a.status === 'DRAFT' || (a.status as any) === 'IN_PROGRESS').length;
            setStats({
                totalAuctions: data.length,
                activeAuctions: active,
                totalRevenue: 0
            });
            
            setLoading(false);
        }, (error) => {
            console.error("Super Admin Fetch Error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string, title: string) => {
        if (window.confirm(`SUPER ADMIN WARNING:\nAre you sure you want to PERMANENTLY DELETE "${title}"?\nThis cannot be undone.`)) {
            try {
                await db.collection('auctions').doc(id).delete();
                // Collections inside need to be deleted manually or via cloud function usually, 
                // but client-side we just remove the root ref for display purposes.
            } catch (e: any) {
                alert("Delete failed: " + e.message);
            }
        }
    };

    const filteredAuctions = auctions.filter(a => 
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-900 font-sans text-white">
            {/* Sidebar / Navbar */}
            <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-600 p-2 rounded-lg">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-wider">SUPER ADMIN</h1>
                            <p className="text-xs text-slate-400">Master Control Panel</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-300 hidden md:inline">Logged in as {userProfile?.email}</span>
                        <button onClick={logout} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-bold flex items-center transition-colors">
                            <LogOut className="w-4 h-4 mr-2"/> Logout
                        </button>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-8">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Auctions</p>
                                <h2 className="text-4xl font-black text-white mt-1">{stats.totalAuctions}</h2>
                            </div>
                            <div className="bg-blue-500/20 p-3 rounded-lg"><Database className="w-6 h-6 text-blue-400"/></div>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                         <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Active Now</p>
                                <h2 className="text-4xl font-black text-green-400 mt-1">{stats.activeAuctions}</h2>
                            </div>
                            <div className="bg-green-500/20 p-3 rounded-lg"><PlayCircle className="w-6 h-6 text-green-400"/></div>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">System Status</p>
                                <h2 className="text-xl font-bold text-white mt-2 flex items-center gap-2">
                                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span> Operational
                                </h2>
                            </div>
                            <div className="bg-purple-500/20 p-3 rounded-lg"><Gavel className="w-6 h-6 text-purple-400"/></div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-400"/> All Auctions ({auctions.length})
                        </h2>
                        
                        <div className="relative w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
                            <input 
                                type="text" 
                                placeholder="Search ID, Title, Sport..." 
                                className="w-full md:w-80 bg-slate-900 border border-slate-600 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-blue-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <button onClick={() => window.location.reload()} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4"/>
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                            <RefreshCw className="w-8 h-8 animate-spin mb-4"/>
                            Loading global data...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900 text-xs text-slate-400 uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="p-4 border-b border-slate-700">Created</th>
                                        <th className="p-4 border-b border-slate-700">Title</th>
                                        <th className="p-4 border-b border-slate-700">Sport</th>
                                        <th className="p-4 border-b border-slate-700">Owner UID</th>
                                        <th className="p-4 border-b border-slate-700">Status</th>
                                        <th className="p-4 border-b border-slate-700 text-right">Control</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredAuctions.length > 0 ? filteredAuctions.map(auction => (
                                        <tr key={auction.id} className="hover:bg-slate-700/50 transition-colors">
                                            <td className="p-4 text-sm text-slate-400 font-mono">
                                                {new Date(auction.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-white block">{auction.title}</span>
                                                <span className="text-xs text-slate-500">ID: {auction.id}</span>
                                            </td>
                                            <td className="p-4 text-sm text-slate-300">{auction.sport}</td>
                                            <td className="p-4 text-xs font-mono text-slate-500 truncate max-w-[100px]" title={auction.createdBy}>
                                                {auction.createdBy || 'N/A'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                                    (auction.status as any) === 'IN_PROGRESS' || auction.status === 'LIVE' ? 'bg-green-900 text-green-400' :
                                                    auction.status === 'COMPLETED' ? 'bg-blue-900 text-blue-400' :
                                                    'bg-slate-700 text-slate-400'
                                                }`}>
                                                    {auction.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => navigate(`/auction/${auction.id}`)}
                                                        className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded"
                                                        title="Join Room"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => navigate(`/admin/auction/${auction.id}/manage`)}
                                                        className="p-1.5 text-yellow-400 hover:bg-yellow-500/20 rounded"
                                                        title="Manage / Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(auction.id!, auction.title)}
                                                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-500 italic">No auctions found matching your search.</td>
                                        </tr>
                                    )}
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
