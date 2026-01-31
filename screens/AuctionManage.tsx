
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
    const [newSlab, setNewSlab] = useState<{from: string, increment: string}>({from: '', increment: ''});
    const [settingsLogo, setSettingsLogo] = useState('');
    const settingsLogoRef = useRef<HTMLInputElement>(null);
    const qrInputRef = useRef<HTMLInputElement>(null);

    const [editItem, setEditItem] = useState<any>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [previewImage, setPreviewImage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const excelInputRef = useRef<HTMLInputElement>(null);

    const [playerSearch, setPlayerSearch] = useState('');
    const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);

    const [pExportFilter, setPExportFilter] = useState({ status: 'ALL', category: 'ALL', role: 'ALL' });
    const [rExportFilter, setRExportFilter] = useState({ status: 'ALL', type: 'ALL' });

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
        }, (err) => {
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

    const handleSaveSettings = async () => {
        if (!id || !auction) return;
        try {
            const updates = { ...settingsForm, logoUrl: settingsLogo, slabs: slabs };
            await db.collection('auctions').doc(id).update(updates);
            alert("Configuration Updated!");
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const handleAddSlab = () => {
        const from = Number(newSlab.from);
        const inc = Number(newSlab.increment);
        if (from >= 0 && inc > 0) {
            setSlabs([...slabs, { from, increment: inc }]);
            setNewSlab({ from: '', increment: '' });
        }
    };

    const handleSaveTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const teamData = {
            name: editItem.name,
            logoUrl: previewImage || editItem.logoUrl || '',
            budget: Number(editItem.budget),
            password: editItem.password || '1234',
            players: editItem.players || []
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('teams').doc(editItem.id).update(teamData);
            } else {
                const teamId = `T${Math.floor(1000 + Math.random() * 9000)}`;
                await db.collection('auctions').doc(id).collection('teams').doc(teamId).set({ id: teamId, ...teamData });
            }
            setIsAdding(false); setEditItem(null); setPreviewImage('');
        } catch (e) { alert("Error saving team"); }
    };

    const handleSavePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const playerData: Omit<Player, 'id'> = {
            name: editItem.name,
            category: editItem.category || (categories[0]?.name || 'Standard'),
            role: editItem.role || (roles[0]?.name || 'All Rounder'),
            basePrice: Number(editItem.basePrice) || settingsForm.basePrice,
            photoUrl: previewImage || editItem.photoUrl || 'https://via.placeholder.com/150',
            nationality: editItem.nationality || 'Indian',
            speciality: editItem.role || 'All Rounder',
            stats: editItem.stats || { matches: 0, runs: 0, wickets: 0 }
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('players').doc(String(editItem.id)).update(playerData);
            } else {
                const newId = Date.now().toString();
                await db.collection('auctions').doc(id).collection('players').doc(newId).set({ id: newId, ...playerData });
            }
            setIsAdding(false); setEditItem(null); setPreviewImage('');
        } catch (e) { alert("Error saving player"); }
    };

    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const roleData = { name: editItem.name, basePrice: Number(editItem.basePrice) };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('roles').doc(editItem.id).update(roleData);
            } else {
                await db.collection('auctions').doc(id).collection('roles').add(roleData);
            }
            setIsAdding(false); setEditItem(null);
        } catch (e) { alert("Error saving role"); }
    };

    const handleSaveSponsor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const sponsorData = { name: editItem.name, imageUrl: previewImage || editItem.imageUrl || '' };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('sponsors').doc(editItem.id).update(sponsorData);
            } else {
                await db.collection('auctions').doc(id).collection('sponsors').add(sponsorData);
            }
            setIsAdding(false); setEditItem(null); setPreviewImage('');
        } catch (e) { alert("Error saving sponsor"); }
    };

    const handleApproveRequest = async (reg: RegisteredPlayer) => {
        if (!id) return;
        if (!window.confirm(`Approve ${reg.fullName} and add to player pool?`)) return;
        try {
            const newId = Date.now().toString();
            const playerData: Player = {
                id: newId,
                name: reg.fullName,
                category: categories[0]?.name || 'Standard',
                role: reg.playerType || 'All Rounder',
                basePrice: settingsForm.basePrice,
                photoUrl: reg.profilePic || 'https://via.placeholder.com/150',
                nationality: 'Indian',
                speciality: reg.playerType || 'All Rounder',
                stats: { matches: 0, runs: 0, wickets: 0 }
            };
            await db.collection('auctions').doc(id).collection('players').doc(newId).set(playerData);
            await db.collection('auctions').doc(id).collection('registrations').doc(reg.id).update({ status: 'APPROVED' });
            alert("Player authorized and added to pool!");
        } catch (e) { alert("Failed to approve request"); }
    };

    const handleRejectRequest = async (regId: string) => {
        if (!id) return;
        if (!window.confirm("Reject this registration?")) return;
        try {
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).update({ status: 'REJECTED' });
        } catch (e) { alert("Failed to reject request"); }
    };

    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !id) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws) as any[];
            setLoading(true);
            const batch = db.batch();
            data.forEach((row, idx) => {
                const newId = (Date.now() + idx).toString();
                const p: Player = {
                    id: newId, name: row.Name || row.name || 'Unknown', category: row.Category || row.category || (categories[0]?.name || 'Standard'),
                    role: row.Role || row.role || (roles[0]?.name || 'All Rounder'), basePrice: Number(row.BasePrice || row.price) || settingsForm.basePrice,
                    photoUrl: row.PhotoUrl || row.photo || 'https://via.placeholder.com/150', nationality: row.Nationality || 'Indian', speciality: row.Role || row.role || 'All Rounder',
                    stats: { matches: 0, runs: 0, wickets: 0 }
                };
                const ref = db.collection('auctions').doc(id).collection('players').doc(newId);
                batch.set(ref, p);
            });
            await batch.commit();
            setLoading(false);
            alert(`Imported ${data.length} players successfully!`);
        };
        reader.readAsBinaryString(file);
    };

    const handleExportPlayers = () => {
        const filtered = players.filter(p => {
            const matchStatus = pExportFilter.status === 'ALL' || p.status === pExportFilter.status || (pExportFilter.status === 'AVAILABLE' && !p.status);
            const matchCat = pExportFilter.category === 'ALL' || p.category === pExportFilter.category;
            const matchRole = pExportFilter.role === 'ALL' || p.role === pExportFilter.role;
            return matchStatus && matchCat && matchRole;
        });
        const data = filtered.map(p => ({
            ID: p.id, Name: p.name, Category: p.category, Role: p.role, BasePrice: p.basePrice, Status: p.status || 'AVAILABLE', SoldTo: p.soldTo || '-', SoldPrice: p.soldPrice || 0, Nationality: p.nationality
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Players");
        XLSX.writeFile(wb, `${auction?.title}_Players_Export.xlsx`);
    };

    const handleExportRequests = () => {
        const filtered = registrations.filter(r => {
            const matchStatus = rExportFilter.status === 'ALL' || r.status === rExportFilter.status;
            const matchType = rExportFilter.type === 'ALL' || r.playerType === rExportFilter.type;
            return matchStatus && matchType;
        });
        const data = filtered.map(r => ({
            ID: r.id, FullName: r.fullName, Mobile: r.mobile, PlayerType: r.playerType, Gender: r.gender, DOB: r.dob, Status: r.status, SubmittedAt: new Date(r.submittedAt).toLocaleString(), PaymentID: r.razorpayPaymentId || 'MANUAL'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registrations");
        XLSX.writeFile(wb, `${auction?.title}_Registrations_Export.xlsx`);
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const catData = { 
            name: editItem.name, basePrice: Number(editItem.basePrice), minPerTeam: Number(editItem.minPerTeam || 0),
            maxPerTeam: Number(editItem.maxPerTeam), bidIncrement: Number(editItem.bidIncrement || settingsForm.bidIncrement), slabs: editItem.slabs || [] 
        };
        try {
            if (editItem.id) { await db.collection('auctions').doc(id).collection('categories').doc(editItem.id).update(catData); } 
            else { await db.collection('auctions').doc(id).collection('categories').add(catData); }
            setIsAdding(false); setEditItem(null);
        } catch (e) { alert("Error saving category"); }
    };

    const handleSaveRegistration = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({ registrationConfig: regConfig });
            alert("Registration Protocol Deployed!");
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const addCustomField = () => {
        const newField: FormField = { id: Date.now().toString(), label: '', type: 'text', required: true, options: [] };
        setRegConfig({ ...regConfig, customFields: [...regConfig.customFields, newField] });
    };

    const removeCustomField = (fid: string) => {
        setRegConfig({ ...regConfig, customFields: regConfig.customFields.filter(f => f.id !== fid) });
    };

    const updateField = (fid: string, key: keyof FormField, value: any) => {
        setRegConfig({ ...regConfig, customFields: regConfig.customFields.map(f => f.id === fid ? { ...f, [key]: value } : f) });
    };

    const handleDelete = async (coll: string, itemId: string) => {
        if (!window.confirm("Confirm deletion?")) return;
        try { await db.collection('auctions').doc(id!).collection(coll).doc(itemId).delete(); } catch (e) { alert("Delete failed"); }
    };

    const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const compressed = await compressImage(e.target.files[0]);
            setPreviewImage(compressed);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest text-gray-400">Loading Configuration...</p>
                </div>
            </div>
        );
    }

    const filteredPlayers = players.filter(p => 
        p.name.toLowerCase().includes(playerSearch.toLowerCase()) || 
        p.category.toLowerCase().includes(playerSearch.toLowerCase()) ||
        p.role.toLowerCase().includes(playerSearch.toLowerCase())
    );

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
                            <button key={tab} onClick={() => { setActiveTab(tab as any); setIsAdding(false); setEditItem(null); setIsExportPanelOpen(false); }}
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
                                        <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">Public Registration</h2>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure player signup protocols.</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/#/auction/${id}/register`); alert("Link copied!"); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-6 rounded-lg text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95"><Share2 className="w-4 h-4"/> Copy Public Link</button>
                                    <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase">Form Enabled</label>
                                        <button onClick={() => setRegConfig({...regConfig, isEnabled: !regConfig.isEnabled})} className={`transition-colors ${regConfig.isEnabled ? 'text-blue-600' : 'text-gray-300'}`}>{regConfig.isEnabled ? <ToggleRight className="w-8 h-8"/> : <ToggleLeft className="w-8 h-8"/>}</button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Payment Logic</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-2xl group cursor-pointer hover:border-blue-400 transition-all" onClick={() => setRegConfig({...regConfig, includePayment: !regConfig.includePayment})}>
                                                <span className="text-xs font-bold text-gray-700">Collect Registration Fee</span>
                                                {regConfig.includePayment ? <CheckCircle className="w-6 h-6 text-blue-600"/> : <Square className="w-6 h-6 text-gray-300"/>}
                                            </div>
                                            
                                            {regConfig.includePayment && (
                                                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-4 animate-fade-in">
                                                    <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Payment Protocol</label>
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
                                                                Integrated (Razorpay)
                                                            </button>
                                                        )}
                                                    </div>
                                                    {!auction?.razorpayAuthorized && (
                                                        <p className="text-[8px] text-gray-400 font-bold uppercase leading-relaxed text-center italic">Integrated payments must be authorized by Super Admin for this specific instance.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {regConfig.includePayment && regConfig.paymentMethod === 'RAZORPAY' && auction?.razorpayAuthorized && (
                                            <div className="mt-6 p-6 bg-indigo-50 border border-indigo-100 rounded-3xl animate-slide-up space-y-5">
                                                <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2"><CreditCard className="w-4 h-4"/> Razorpay API Config</h3>
                                                <div className="grid grid-cols-1 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Registration Fee (₹)</label>
                                                        <input type="number" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} placeholder="e.g. 500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Razorpay Key ID</label>
                                                        <input type="text" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" value={regConfig.razorpayKey || ''} onChange={e => setRegConfig({...regConfig, razorpayKey: e.target.value})} placeholder="rzp_live_xxxxxxxx" />
                                                        <p className="text-[8px] font-bold text-indigo-400 uppercase mt-1">Get this from your Razorpay Dashboard > Settings > API Keys</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {regConfig.includePayment && regConfig.paymentMethod === 'MANUAL' && (
                                            <div className="mt-6 p-6 bg-blue-50/50 border border-blue-100 rounded-3xl animate-slide-up space-y-5">
                                                <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2"><QrCode className="w-4 h-4"/> UPI Configuration</h3>
                                                <div className="grid grid-cols-1 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Registration Fee (₹)</label>
                                                        <input type="number" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} placeholder="e.g. 500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">UPI Name (Payee Name)</label>
                                                        <input type="text" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" value={regConfig.upiName} onChange={e => setRegConfig({...regConfig, upiName: e.target.value})} placeholder="e.g. John Doe" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">UPI ID (VPA)</label>
                                                        <input type="text" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" value={regConfig.upiId} onChange={e => setRegConfig({...regConfig, upiId: e.target.value})} placeholder="e.g. name@upi" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-2">QR Code Graphic</label>
                                                        <div onClick={() => qrInputRef.current?.click()} className="w-full h-40 bg-white border-2 border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-all overflow-hidden relative">
                                                            {regConfig.qrCodeUrl ? <img src={regConfig.qrCodeUrl} className="w-full h-full object-contain p-2" /> : <><Upload className="w-8 h-8 text-blue-300 mb-2"/><span className="text-[10px] font-black text-blue-400 uppercase">Upload UPI QR</span></>}
                                                            <input ref={qrInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setRegConfig({...regConfig, qrCodeUrl: await compressImage(e.target.files[0])}); }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* ... rest of existing branding/fields logic ... */}
                                </div>
                            </div>
                            <div className="p-10 bg-white border-t border-gray-100 flex justify-center">
                                <button onClick={handleSaveRegistration} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-16 rounded-2xl shadow-2xl shadow-blue-900/40 text-sm uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all active:scale-95 group"><Save className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Deploy Registration Protocol</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* ... rest of tab renders ... */}
            </main>
        </div>
    );
};

export default AuctionManage;
