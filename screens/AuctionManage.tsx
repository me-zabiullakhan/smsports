import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab } from '../types';
import { 
    ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, 
    DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, 
    AlignLeft, CheckSquare, Square, Palette, ChevronDown, Search, CheckCircle, 
    XCircle, Clock, Calendar, Info, ListPlus, Eye, EyeOff, Copy, Link as LinkIcon, 
    Check as CheckIcon, ShieldCheck, Tag, User, TrendingUp, CreditCard, Shield, 
    UserCheck, UserX, Share2, Download, FileSpreadsheet, Filter, Key, 
    ExternalLink, LayoutList, ToggleRight, ToggleLeft, RefreshCw, FileUp, 
    Star, UserPlus, Loader2, FileDown, ChevronRight
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
    const [settingsLogo, setSettingsLogo] = useState('');
    const qrInputRef = useRef<HTMLInputElement>(null);

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
                setSettingsLogo(data.logoUrl || '');
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

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

    return (
        <div className="min-h-screen bg-[#f8f9fa] font-sans pb-20 text-gray-900">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-800 transition-colors"><ArrowLeft className="w-5 h-5"/></button>
                        <h1 className="text-sm font-black uppercase tracking-widest text-gray-700">{auction?.title}</h1>
                    </div>
                    <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 overflow-x-auto no-scrollbar">
                        {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'CATEGORIES', 'ROLES', 'SPONSORS', 'REGISTRATION'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all rounded-md whitespace-nowrap ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                {activeTab === 'REGISTRATION' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg"><UserCheck className="w-5 h-5 text-blue-600"/></div>
                                    <div>
                                        <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">Registration Desk</h2>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Deploy player signup protocol.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase">Form Enabled</label>
                                    <button onClick={() => setRegConfig({...regConfig, isEnabled: !regConfig.isEnabled})} className={`transition-colors ${regConfig.isEnabled ? 'text-blue-600' : 'text-gray-300'}`}>{regConfig.isEnabled ? <ToggleRight className="w-8 h-8"/> : <ToggleLeft className="w-8 h-8"/>}</button>
                                </div>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Payment Configuration</h3>
                                    <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-2xl group cursor-pointer hover:border-blue-400 transition-all" onClick={() => setRegConfig({...regConfig, includePayment: !regConfig.includePayment})}>
                                        <span className="text-xs font-bold text-gray-700">Collect Registration Fee</span>
                                        {regConfig.includePayment ? <CheckCircle className="w-6 h-6 text-blue-600"/> : <Square className="w-6 h-6 text-gray-300"/>}
                                    </div>
                                    
                                    {regConfig.includePayment && (
                                        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-4 animate-fade-in">
                                            <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Gatekeeper Logic</label>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setRegConfig({...regConfig, paymentMethod: 'MANUAL'})}
                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${regConfig.paymentMethod === 'MANUAL' ? 'bg-white border-blue-400 text-blue-600 shadow-sm' : 'bg-transparent border-gray-200 text-gray-400'}`}
                                                >
                                                    Manual (QR/UPI)
                                                </button>
                                                {auction?.razorpayAuthorized && (
                                                    <button 
                                                        onClick={() => setRegConfig({...regConfig, paymentMethod: 'RAZORPAY'})}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${regConfig.paymentMethod === 'RAZORPAY' ? 'bg-white border-blue-400 text-blue-600 shadow-sm' : 'bg-transparent border-gray-200 text-gray-400'}`}
                                                    >
                                                        Razorpay
                                                    </button>
                                                )}
                                            </div>
                                            {!auction?.razorpayAuthorized && (
                                                <p className="text-[8px] text-gray-400 font-bold uppercase leading-relaxed text-center italic">Razorpay requires Super Admin authorization for this instance.</p>
                                            )}
                                        </div>
                                    )}

                                    {regConfig.includePayment && regConfig.paymentMethod === 'RAZORPAY' && auction?.razorpayAuthorized && (
                                        <div className="mt-4 space-y-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                            <div>
                                                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Fee (₹)</label>
                                                <input type="number" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Razorpay Key ID</label>
                                                <input type="text" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" value={regConfig.razorpayKey || ''} onChange={e => setRegConfig({...regConfig, razorpayKey: e.target.value})} placeholder="rzp_live_xxxxxxxx" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Branding & Terms</h3>
                                    <textarea 
                                        className="w-full border rounded-xl p-4 text-xs h-32 focus:border-blue-500 outline-none"
                                        placeholder="Enter Terms & Conditions..."
                                        value={regConfig.terms}
                                        onChange={e => setRegConfig({...regConfig, terms: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="p-10 bg-gray-50 border-t border-gray-100 flex justify-center">
                                <button onClick={handleSaveRegistration} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-16 rounded-2xl shadow-xl text-sm uppercase tracking-widest flex items-center gap-3 transition-all">
                                    <Save className="w-5 h-5" /> Deploy Registry Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'SETTINGS' && (
                    <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Auction Title</label><input type="text" className="w-full border rounded-lg px-4 py-2" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})}/></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label><input type="date" className="w-full border rounded-lg px-4 py-2" value={settingsForm.date} onChange={e => setSettingsForm({...settingsForm, date: e.target.value})}/></div>
                        </div>
                        <button onClick={() => { db.collection('auctions').doc(id!).update(settingsForm); alert("Settings Saved!"); }} className="bg-blue-600 text-white font-black py-3 px-8 rounded-xl text-xs uppercase shadow-lg">Save Settings</button>
                    </div>
                )}
                
                {activeTab === 'REQUESTS' && (
                    <div className="space-y-4 animate-fade-in">
                        {registrations.length === 0 ? (
                            <div className="p-20 text-center text-gray-400 bg-white rounded-2xl border border-dashed">No registration requests found.</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {registrations.map(reg => (
                                    <div key={reg.id} className="bg-white p-6 rounded-2xl border border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <img src={reg.profilePic} className="w-12 h-12 rounded-full object-cover"/>
                                            <div>
                                                <p className="font-bold">{reg.fullName}</p>
                                                <p className="text-[10px] text-gray-500 uppercase">{reg.playerType} • {reg.mobile}</p>
                                            </div>
                                        </div>
                                        <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${reg.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' : reg.status === 'APPROVED' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>{reg.status}</div>
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