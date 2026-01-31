
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab } from '../types';
// Added Zap to the lucide-react imports to fix "Cannot find name 'Zap'" error
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
    const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);

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
                if (data.slabs) setSlabs(data.slabs);
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
                                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Razorpay Auth Key</span>
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-white/40 outline-none focus:bg-white/20 transition-all" 
                                                        value={regConfig.razorpayKey || ''} 
                                                        onChange={e => setRegConfig({...regConfig, razorpayKey: e.target.value})} 
                                                        placeholder="rzp_live_xxxxxxxxxxxx" 
                                                    />
                                                    <p className="text-[8px] text-indigo-200 font-bold uppercase mt-3 tracking-widest leading-relaxed">Fetch this from your Razorpay Dashboard > Settings > API Keys</p>
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
                                            <button className="p-2.5 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all"><Trash2 className="w-4 h-4"/></button>
                                            <button className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest shadow-lg">Verify</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AuctionManage;
