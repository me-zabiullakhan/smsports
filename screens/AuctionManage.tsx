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
// Import useAuction hook
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
    // Destructure userProfile from useAuction
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

    // Export Filter States
    const [pExportFilter, setPExportFilter] = useState({ status: 'ALL', category: 'ALL', role: 'ALL' });
    const [rExportFilter, setRExportFilter] = useState({ status: 'ALL', type: 'ALL' });

    useEffect(() => {
        if (!id) return;
        
        // Root Auction Doc Listener
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
            console.error("Auction load error:", err);
            setLoading(false);
        });

        // Real-time sub-collection listeners
        const unsubTeams = db.collection('auctions').doc(id).collection('teams').onSnapshot(s => setTeams(s.docs.map(d => ({id: d.id, ...d.data()}) as Team)));
        const unsubPlayers = db.collection('auctions').doc(id).collection('players').onSnapshot(s => setPlayers(s.docs.map(d => ({id: d.id, ...d.data()}) as Player)));
        const unsubCats = db.collection('auctions').doc(id).collection('categories').onSnapshot(s => setCategories(s.docs.map(d => ({id: d.id, ...d.data()}) as AuctionCategory)));
        const unsubRoles = db.collection('auctions').doc(id).collection('roles').onSnapshot(s => setRoles(s.docs.map(d => ({id: d.id, ...d.data()}) as PlayerRole)));
        const unsubSponsors = db.collection('auctions').doc(id).collection('sponsors').onSnapshot(s => setSponsors(s.docs.map(d => ({id: d.id, ...d.data()}) as Sponsor)));
        const unsubRegs = db.collection('auctions').doc(id).collection('registrations').onSnapshot(s => setRegistrations(s.docs.map(d => ({id: d.id, ...d.data()}) as RegisteredPlayer)));

        return () => {
            unsubAuction();
            unsubTeams();
            unsubPlayers();
            unsubCats();
            unsubRoles();
            unsubSponsors();
            unsubRegs();
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

        // --- TEAM LIMIT LOGIC ---
        // If adding a NEW team, check if we've reached the limit defined by the plan (totalTeams property)
        if (!editItem.id) {
            const limit = auction?.totalTeams || 2;
            if (teams.length >= limit) {
                alert(`Team limit reached! Your current plan supports a maximum of ${limit} teams. Please upgrade this auction from the Admin Dashboard to add more teams.`);
                return;
            }
        }

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
                    id: newId,
                    name: row.Name || row.name || 'Unknown',
                    category: row.Category || row.category || (categories[0]?.name || 'Standard'),
                    role: row.Role || row.role || (roles[0]?.name || 'All Rounder'),
                    basePrice: Number(row.BasePrice || row.price) || settingsForm.basePrice,
                    photoUrl: row.PhotoUrl || row.photo || 'https://via.placeholder.com/150',
                    nationality: row.Nationality || 'Indian',
                    speciality: row.Role || row.role || 'All Rounder',
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
            ID: p.id,
            Name: p.name,
            Category: p.category,
            Role: p.role,
            BasePrice: p.basePrice,
            Status: p.status || 'AVAILABLE',
            SoldTo: p.soldTo || '-',
            SoldPrice: p.soldPrice || 0,
            Nationality: p.nationality
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
            ID: r.id,
            FullName: r.fullName,
            Mobile: r.mobile,
            PlayerType: r.playerType,
            Gender: r.gender,
            DOB: r.dob,
            Status: r.status,
            SubmittedAt: new Date(r.submittedAt).toLocaleString(),
            PaymentID: r.razorpayPaymentId || 'MANUAL'
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
            name: editItem.name, 
            basePrice: Number(editItem.basePrice), 
            maxPerTeam: Number(editItem.maxPerTeam), 
            bidIncrement: Number(editItem.bidIncrement),
            slabs: [] 
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('categories').doc(editItem.id).update(catData);
            } else {
                await db.collection('auctions').doc(id).collection('categories').add(catData);
            }
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
        const newField: FormField = {
            id: Date.now().toString(),
            label: '',
            type: 'text',
            required: true,
            options: []
        };
        setRegConfig({ ...regConfig, customFields: [...regConfig.customFields, newField] });
    };

    const removeCustomField = (fid: string) => {
        setRegConfig({ ...regConfig, customFields: regConfig.customFields.filter(f => f.id !== fid) });
    };

    const updateField = (fid: string, key: keyof FormField, value: any) => {
        setRegConfig({
            ...regConfig,
            customFields: regConfig.customFields.map(f => f.id === fid ? { ...f, [key]: value } : f)
        });
    };

    const handleDelete = async (coll: string, itemId: string) => {
        if (!window.confirm("Confirm deletion?")) return;
        try {
            await db.collection('auctions').doc(id!).collection(coll).doc(itemId).delete();
        } catch (e) { alert("Delete failed"); }
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
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-800 transition-colors">
                            <ArrowLeft className="w-5 h-5"/>
                        </button>
                        <h1 className="text-sm font-black uppercase tracking-widest text-gray-700">{auction?.title}</h1>
                    </div>
                    {/* Tab Navigation */}
                    <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 overflow-x-auto no-scrollbar">
                        {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'CATEGORIES', 'ROLES', 'SPONSORS', 'REGISTRATION'].map(tab => (
                            <button 
                                key={tab} 
                                onClick={() => { setActiveTab(tab as any); setIsAdding(false); setEditItem(null); setIsExportPanelOpen(false); }}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all rounded-md whitespace-nowrap ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                
                {/* SETTINGS TAB */}
                {activeTab === 'SETTINGS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-blue-500" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">Auction Configuration</h2>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Auction Title</label>
                                            <input className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold focus:border-blue-500 focus:bg-white outline-none transition-all" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Sport</label>
                                            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                                                {['Cricket', 'Football', 'Kabaddi'].map(s => (
                                                    <button 
                                                        key={s} 
                                                        onClick={() => setSettingsForm({...settingsForm, sport: s})}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${settingsForm.sport === s ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Purse Value</label>
                                                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Team Limit ({auction?.isPaid ? 'PAID' : 'FREE'})</label>
                                                <input type="number" disabled={!userProfile?.role.includes('ADMIN')} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold text-gray-500 cursor-not-allowed" value={settingsForm.totalTeams} title="To increase team limit, please upgrade this auction from the Dashboard." />
                                                <p className="text-[8px] font-black text-blue-600 uppercase mt-1">Controlled by current plan.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Default Base Price</label>
                                                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold" value={settingsForm.basePrice} onChange={e => setSettingsForm({...settingsForm, basePrice: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Default Bid Increment</label>
                                                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold" value={settingsForm.bidIncrement} onChange={e => setSettingsForm({...settingsForm, bidIncrement: Number(e.target.value)})} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-start pt-6">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Auction Logo</label>
                                        <div className="w-40 h-40 rounded-[2.5rem] bg-black border-8 border-white shadow-xl flex items-center justify-center relative group overflow-hidden">
                                            {settingsLogo ? <img src={settingsLogo} className="w-full h-full object-contain p-4" /> : <ImageIcon className="text-zinc-800 w-12 h-12" />}
                                            <button onClick={() => settingsLogoRef.current?.click()} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Upload className="text-white w-6 h-6"/></button>
                                        </div>
                                        <input ref={settingsLogoRef} type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                            if (e.target.files?.[0]) setSettingsLogo(await compressImage(e.target.files[0]));
                                        }} />
                                    </div>
                                </div>

                                <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-gray-200 relative">
                                    <div className="flex items-center gap-2 mb-6">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        <h3 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.2em]">Global Bid Increment Slabs</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-4">Add New Bid Rule</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">When Price {'>='}</label>
                                                    <input placeholder="e.g. 500" className="w-full border rounded-lg p-2 text-xs" value={newSlab.from} onChange={e => setNewSlab({...newSlab, from: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Increment By</label>
                                                    <input placeholder="e.g. 50" className="w-full border rounded-lg p-2 text-xs" value={newSlab.increment} onChange={e => setNewSlab({...newSlab, increment: e.target.value})} />
                                                </div>
                                            </div>
                                            <button onClick={handleAddSlab} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-lg text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                                <Plus className="w-4 h-4"/> Add Increment Rule
                                            </button>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-4">Active Rules ({slabs.length})</p>
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                                {slabs.map((s, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white border rounded-xl px-4 py-2 shadow-sm">
                                                        <span className="text-[11px] font-bold text-gray-600">From <b className="text-gray-900">{s.from}</b> +<b className="text-blue-600">{s.increment}</b></span>
                                                        <button onClick={() => setSlabs(slabs.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4"/></button>
                                                    </div>
                                                ))}
                                                {slabs.length === 0 && <div className="h-24 flex flex-col items-center justify-center text-gray-300 opacity-50"><TrendingUp className="w-8 h-8 mb-2"/><p className="text-[9px] font-bold uppercase">No custom slab rules defined</p></div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-start">
                                <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-10 rounded-xl shadow-lg shadow-blue-900/20 text-xs uppercase tracking-[0.2em] flex items-center gap-2 transition-all active:scale-95">
                                    <Save className="w-4 h-4" /> Update Configuration
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TEAMS TAB */}
                {activeTab === 'TEAMS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-2 rounded-lg">
                                    <Users className="w-5 h-5 text-blue-600"/>
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-800 tracking-tight uppercase">Participating Teams</h2>
                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">PLAN LIMIT: {teams.length} / {auction?.totalTeams || 2} TEAMS USED</p>
                                </div>
                            </div>
                            <button onClick={() => { setEditItem({ name: '', budget: settingsForm.purseValue, password: '1234' }); setIsAdding(true); setPreviewImage(''); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                <Plus className="w-4 h-4"/> Add New Team
                            </button>
                        </div>

                        {isAdding && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-8 shadow-2xl animate-slide-up">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Establish New Franchise</h3>
                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
                                </div>
                                <form onSubmit={handleSaveTeam} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Team Name</label>
                                            <input className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} placeholder="e.g. Mumbai Masters" required />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Starting Purse</label>
                                                <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.budget} onChange={e => setEditItem({...editItem, budget: e.target.value})} required />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Login Pass</label>
                                                <input className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.password} onChange={e => setEditItem({...editItem, password: e.target.value})} placeholder="1234" required />
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">Authorize Team Registry</button>
                                    </div>
                                    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-6">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-4">Team Emblem (Logo)</label>
                                        <div className="w-32 h-32 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center relative group overflow-hidden">
                                            {(previewImage || editItem.logoUrl) ? <img src={previewImage || editItem.logoUrl} className="w-full h-full object-contain p-2" /> : <ImageIcon className="text-zinc-200 w-12 h-12" />}
                                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                <Upload className="text-white w-6 h-6"/>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageFileChange} />
                                            </label>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {teams.map(team => (
                                <div key={team.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden p-2">
                                            {team.logoUrl ? <img src={team.logoUrl} className="max-w-full max-h-full object-contain" /> : <Users className="text-gray-300" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-gray-800 uppercase tracking-tight truncate">{team.name}</h3>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">ID: {team.id} • PASS: {team.password || '1234'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-50">
                                        <div className="text-xs font-black text-green-600">₹{team.budget}</div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setEditItem(team); setIsAdding(true); setPreviewImage(''); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                            <button onClick={() => handleDelete('teams', String(team.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {teams.length === 0 && (
                                <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                    <Users className="w-16 h-16 text-gray-100 mb-4" />
                                    <p className="text-sm font-black text-gray-300 uppercase tracking-widest">No franchises established in registry</p>
                                    <button onClick={() => { setEditItem({ name: '', budget: settingsForm.purseValue, password: '1234' }); setIsAdding(true); }} className="mt-6 text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-2">
                                        <Plus className="w-4 h-4"/> Create First Team
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* PLAYERS TAB */}
                {activeTab === 'PLAYERS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm gap-4">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="bg-indigo-100 p-2 rounded-lg">
                                    <LayoutList className="w-5 h-5 text-indigo-600"/>
                                </div>
                                <h2 className="text-lg font-black text-gray-800 tracking-tight uppercase whitespace-nowrap">Player Registry</h2>
                                <div className="relative w-full max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                                    <input 
                                        type="text" 
                                        placeholder="SEARCH REGISTRY..." 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-[10px] font-black uppercase tracking-widest focus:bg-white outline-none"
                                        value={playerSearch}
                                        onChange={e => setPlayerSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <button onClick={() => setIsExportPanelOpen(!isExportPanelOpen)} className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${isExportPanelOpen ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    <FileDown className="w-4 h-4"/> Data Export
                                </button>
                                <button onClick={() => excelInputRef.current?.click()} className="flex-1 md:flex-initial bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-emerald-100 transition-all">
                                    <FileSpreadsheet className="w-4 h-4"/> Import Excel
                                    <input ref={excelInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
                                </button>
                                <button onClick={() => { setEditItem({ name: '', nationality: 'Indian', role: roles[0]?.name || 'All Rounder', category: categories[0]?.name || 'Standard', basePrice: settingsForm.basePrice }); setIsAdding(true); setPreviewImage(''); }} className="flex-1 md:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                                    <UserPlus className="w-4 h-4"/> New Player
                                </button>
                            </div>
                        </div>

                        {/* Inline Export Panel for Players */}
                        {isExportPanelOpen && (
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 animate-slide-up space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-blue-600 p-1.5 rounded-lg text-white"><FileDown className="w-4 h-4"/></div>
                                        <h3 className="font-black text-blue-900 uppercase tracking-widest text-[10px]">Registry Export Protocol</h3>
                                    </div>
                                    <button onClick={() => setIsExportPanelOpen(false)} className="text-blue-400 hover:text-blue-600"><XCircle className="w-5 h-5"/></button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Status Filter</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['ALL', 'AVAILABLE', 'SOLD', 'UNSOLD'].map(s => (
                                                <button key={s} onClick={() => setPExportFilter({...pExportFilter, status: s})} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${pExportFilter.status === s ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'}`}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Category Filter</label>
                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                                            {['ALL', ...categories.map(c => c.name)].map(c => (
                                                <button key={c} onClick={() => setPExportFilter({...pExportFilter, category: c})} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${pExportFilter.category === c ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-indigo-200 text-indigo-400 hover:bg-indigo-100'}`}>{c}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Role Filter</label>
                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                                            {['ALL', ...roles.map(r => r.name)].map(r => (
                                                <button key={r} onClick={() => setPExportFilter({...pExportFilter, role: r})} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${pExportFilter.role === r ? 'bg-cyan-600 border-cyan-600 text-white shadow-md' : 'bg-white border-cyan-200 text-cyan-400 hover:bg-cyan-100'}`}>{r}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-blue-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="text-[10px] font-bold text-blue-800 uppercase bg-blue-100 px-4 py-2 rounded-full">
                                        MATCHED RECORDS: {players.filter(p => {
                                            const matchStatus = pExportFilter.status === 'ALL' || p.status === pExportFilter.status || (pExportFilter.status === 'AVAILABLE' && !p.status);
                                            const matchCat = pExportFilter.category === 'ALL' || p.category === pExportFilter.category;
                                            const matchRole = pExportFilter.role === 'ALL' || p.role === pExportFilter.role;
                                            return matchStatus && matchCat && matchRole;
                                        }).length}
                                    </div>
                                    <button onClick={handleExportPlayers} className="w-full sm:w-auto bg-blue-900 hover:bg-black text-white font-black px-10 py-3 rounded-xl text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95">
                                        <Download className="w-4 h-4"/> DOWNLOAD EXCEL (.XLSX)
                                    </button>
                                </div>
                            </div>
                        )}

                        {isAdding && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-8 shadow-2xl animate-slide-up">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Registry Enrollment</h3>
                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
                                </div>
                                <form onSubmit={handleSavePlayer} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="md:col-span-2 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Player Name</label>
                                                <input className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} placeholder="e.g. Virat Kohli" required />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nationality</label>
                                                <input className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.nationality} onChange={e => setEditItem({...editItem, nationality: e.target.value})} placeholder="Indian" required />
                                            </div>
                                        </div>
                                        
                                        {/* Inline Role Selection */}
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Skill Set Identity</label>
                                            <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border rounded-xl">
                                                {(roles.length > 0 ? roles.map(r => r.name) : ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper']).map(r => (
                                                    <button 
                                                        key={r}
                                                        type="button"
                                                        onClick={() => setEditItem({...editItem, role: r})}
                                                        className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${editItem.role === r ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                                    >
                                                        {r}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Inline Category Selection */}
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Set Category</label>
                                            <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border rounded-xl">
                                                {(categories.length > 0 ? categories.map(c => c.name) : ['Standard']).map(c => (
                                                    <button 
                                                        key={c}
                                                        type="button"
                                                        onClick={() => setEditItem({...editItem, category: c})}
                                                        className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${editItem.category === c ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Base Price</label>
                                            <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: e.target.value})} required />
                                        </div>
                                        
                                        <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">Enroll in Registry</button>
                                    </div>
                                    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-6">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-4">Official Portrait</label>
                                        <div className="w-40 h-48 bg-white border-4 border-white shadow-xl flex items-center justify-center relative group overflow-hidden rounded-xl">
                                            {(previewImage || editItem.photoUrl) ? <img src={previewImage || editItem.photoUrl} className="w-full h-full object-cover" /> : <User className="text-zinc-200 w-16 h-16" />}
                                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                <Upload className="text-white w-6 h-6"/>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageFileChange} />
                                            </label>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[700px]">
                                    <thead className="bg-gray-50 border-b text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="p-5">Identity</th>
                                            <th className="p-5">Skill Set</th>
                                            <th className="p-5">Category Set</th>
                                            <th className="p-5">Reserve Price</th>
                                            <th className="p-5">Status</th>
                                            <th className="p-5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredPlayers.map(player => (
                                            <tr key={player.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="p-5">
                                                    <div className="flex items-center gap-3">
                                                        <img src={player.photoUrl} className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200" />
                                                        <div>
                                                            <div className="font-black text-gray-800 uppercase text-xs truncate max-w-[120px]">{player.name}</div>
                                                            <div className="text-[9px] text-gray-400 font-bold uppercase">{player.nationality}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-[10px] font-black uppercase text-blue-600">{player.role}</td>
                                                <td className="p-5"><span className="bg-gray-100 text-gray-500 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest">{player.category}</span></td>
                                                <td className="p-5 font-mono font-bold text-gray-700">{player.basePrice}</td>
                                                <td className="p-5">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${player.status === 'SOLD' ? 'text-green-600' : player.status === 'UNSOLD' ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {player.status || 'AVAILABLE'}
                                                    </span>
                                                </td>
                                                <td className="p-5 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditItem(player); setIsAdding(true); setPreviewImage(''); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                                        <button onClick={() => handleDelete('players', String(player.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {players.length === 0 && (
                                <div className="p-20 text-center flex flex-col items-center justify-center">
                                    <User className="w-16 h-16 text-gray-100 mb-4" />
                                    <p className="text-sm font-black text-gray-300 uppercase tracking-widest">Player registry is currently empty</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* REQUESTS TAB */}
                {activeTab === 'REQUESTS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-100 p-2 rounded-lg">
                                    <UserCheck className="w-5 h-5 text-emerald-600"/>
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-800 tracking-tight uppercase">Enrollment Applications</h2>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Authorized registrations pending pool authorization.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsExportPanelOpen(!isExportPanelOpen)} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${isExportPanelOpen ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                <FileDown className="w-4 h-4"/> Export Requests
                            </button>
                        </div>

                        {/* Inline Export Panel for Requests */}
                        {isExportPanelOpen && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 animate-slide-up space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-emerald-600 p-1.5 rounded-lg text-white"><FileDown className="w-4 h-4"/></div>
                                        <h3 className="font-black text-emerald-900 uppercase tracking-widest text-[10px]">Registration Data Export</h3>
                                    </div>
                                    <button onClick={() => setIsExportPanelOpen(false)} className="text-emerald-400 hover:text-emerald-600"><XCircle className="w-5 h-5"/></button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-3">Application Status</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                                                <button key={s} onClick={() => setRExportFilter({...rExportFilter, status: s})} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${rExportFilter.status === s ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-emerald-200 text-emerald-400 hover:bg-emerald-100'}`}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-3">Skill Set Type</label>
                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                                            {['ALL', ...roles.map(r => r.name)].map(r => (
                                                <button key={r} onClick={() => setRExportFilter({...rExportFilter, type: r})} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${rExportFilter.type === r ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-indigo-200 text-indigo-400 hover:bg-indigo-100'}`}>{r}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-emerald-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="text-[10px] font-bold text-emerald-800 uppercase bg-emerald-100 px-4 py-2 rounded-full">
                                        MATCHED APPLICATIONS: {registrations.filter(r => {
                                            const matchStatus = rExportFilter.status === 'ALL' || r.status === rExportFilter.status;
                                            const matchType = rExportFilter.type === 'ALL' || r.playerType === rExportFilter.type;
                                            return matchStatus && matchType;
                                        }).length}
                                    </div>
                                    <button onClick={handleExportRequests} className="w-full sm:w-auto bg-emerald-900 hover:bg-black text-white font-black px-10 py-3 rounded-xl text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95">
                                        <Download className="w-4 h-4"/> DOWNLOAD XLS REPORT
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {registrations.filter(r => r.status === 'PENDING').map(reg => (
                                <div key={reg.id} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col">
                                    <div className="p-6 flex items-start gap-5">
                                        <div className="w-24 h-32 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                                            {reg.profilePic ? <img src={reg.profilePic} className="w-full h-full object-cover" /> : <User className="text-gray-200" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-gray-800 uppercase text-lg leading-tight truncate">{reg.fullName}</h3>
                                            <div className="mt-2 space-y-1">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest"><User className="w-3 h-3 text-blue-500"/> {reg.playerType}</div>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest"><Clock className="w-3 h-3 text-blue-500"/> {new Date(reg.submittedAt).toLocaleDateString()}</div>
                                            </div>
                                            {reg.paymentScreenshot && (
                                                <button onClick={() => window.open(reg.paymentScreenshot, '_blank')} className="mt-4 flex items-center gap-2 text-[9px] font-black text-blue-600 uppercase border-b border-blue-100 hover:border-blue-600 transition-all">
                                                    <ImageIcon className="w-3 h-3"/> Verify Payment Proof
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-auto p-4 bg-gray-50 flex gap-2">
                                        <button onClick={() => handleApproveRequest(reg)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all">
                                            <CheckCircle className="w-4 h-4"/> Authorize
                                        </button>
                                        <button onClick={() => handleRejectRequest(reg.id)} className="flex-1 bg-white hover:bg-red-50 text-red-500 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-red-100 transition-all flex items-center justify-center gap-2">
                                            <XCircle className="w-4 h-4"/> Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {registrations.filter(r => r.status === 'PENDING').length === 0 && (
                                <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                    <UserCheck className="w-16 h-16 text-gray-100 mb-4" />
                                    <p className="text-sm font-black text-gray-300 uppercase tracking-widest">No enrollment applications pending verification</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ROLES TAB */}
                {activeTab === 'ROLES' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-amber-100 p-2 rounded-lg">
                                    <Briefcase className="w-5 h-5 text-amber-600"/>
                                </div>
                                <h2 className="text-lg font-black text-gray-800 tracking-tight uppercase">Skill Set Definitions</h2>
                            </div>
                            <button onClick={() => { setEditItem({ name: '', basePrice: settingsForm.basePrice }); setIsAdding(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                <Plus className="w-4 h-4"/> New Definition
                            </button>
                        </div>

                        {isAdding && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-8 shadow-2xl animate-slide-up">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Establish Skill Identity</h3>
                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
                                </div>
                                <form onSubmit={handleSaveRole} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Identity Name</label>
                                        <input className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} placeholder="e.g. Batsman" required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Default Base Price</label>
                                        <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: e.target.value})} required />
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">Authorize Identity</button>
                                </form>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {roles.map(role => (
                                <div key={role.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">{role.name}</h3>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditItem(role); setIsAdding(true); }} className="text-blue-500 hover:text-blue-700 transition-colors"><Edit className="w-3 h-3"/></button>
                                            <button onClick={() => handleDelete('roles', role.id!)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-3 h-3"/></button>
                                        </div>
                                    </div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Base: <span className="text-gray-900">₹{role.basePrice}</span></p>
                                </div>
                            ))}
                            {roles.length === 0 && (
                                <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                    <Briefcase className="w-16 h-16 text-gray-100 mb-4" />
                                    <p className="text-sm font-black text-gray-300 uppercase tracking-widest">No skill sets defined in protocol</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CATEGORIES TAB */}
                {activeTab === 'CATEGORIES' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 p-2 rounded-lg">
                                    <Layers className="w-5 h-5 text-indigo-600"/>
                                </div>
                                <h2 className="text-lg font-black text-gray-800 tracking-tight uppercase">Auction Sets (Categories)</h2>
                            </div>
                            <button onClick={() => { setEditItem({ name: '', basePrice: settingsForm.basePrice, maxPerTeam: 10, bidIncrement: settingsForm.bidIncrement }); setIsAdding(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                <Plus className="w-4 h-4"/> New Set
                            </button>
                        </div>

                        {isAdding && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-8 shadow-2xl animate-slide-up">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Establish Player Set</h3>
                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
                                </div>
                                <form onSubmit={handleSaveCategory} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                    <div className="col-span-1 md:col-span-1">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Set Name</label>
                                        <input className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} placeholder="e.g. Uncapped" required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Base Price</label>
                                        <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Max/Team</label>
                                        <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.maxPerTeam} onChange={e => setEditItem({...editItem, maxPerTeam: Number(e.target.value)})} required />
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">Authorize Set</button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead className="bg-gray-50 border-b text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="p-5">Set Name</th>
                                        <th className="p-5">Base Price</th>
                                        <th className="p-5">Max/Team</th>
                                        <th className="p-5">Increment</th>
                                        <th className="p-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {categories.map(cat => (
                                        <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="p-5 font-black text-gray-700 text-sm uppercase">{cat.name}</td>
                                            <td className="p-5 font-mono font-bold text-gray-500">{cat.basePrice}</td>
                                            <td className="p-5 font-mono font-bold text-blue-600">{cat.maxPerTeam}</td>
                                            <td className="p-5 font-mono font-bold text-emerald-600">{cat.bidIncrement}</td>
                                            <td className="p-5 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditItem(cat); setIsAdding(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                                    <button onClick={() => handleDelete('categories', cat.id!)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {categories.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-gray-300 italic text-xs uppercase font-black tracking-widest">No sets established in registry</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SPONSORS TAB */}
                {activeTab === 'SPONSORS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-yellow-100 p-2 rounded-lg">
                                    <Star className="w-5 h-5 text-yellow-600"/>
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-800 tracking-tight uppercase">Partner Ecosystem</h2>
                                </div>
                            </div>
                            <button onClick={() => { setEditItem({ name: '' }); setIsAdding(true); setPreviewImage(''); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                <Plus className="w-4 h-4"/> New Partner
                            </button>
                        </div>

                        {isAdding && (
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-8 shadow-2xl animate-slide-up">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Partner Enrollment</h3>
                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
                                </div>
                                <form onSubmit={handleSaveSponsor} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Partner Name</label>
                                            <input className="w-full border rounded-xl p-3 text-sm font-bold" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} placeholder="e.g. Tata Group" required />
                                        </div>
                                        <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">Enroll Partner</button>
                                    </div>
                                    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-6">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-4">Partner Asset (Logo)</label>
                                        <div className="w-48 h-24 bg-white border border-gray-100 shadow flex items-center justify-center relative group overflow-hidden rounded-lg">
                                            {(previewImage || editItem.imageUrl) ? <img src={previewImage || editItem.imageUrl} className="max-w-full max-h-full object-contain p-2" /> : <ImageIcon className="text-zinc-200 w-8 h-8" />}
                                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                <Upload className="text-white w-4 h-4"/>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageFileChange} />
                                            </label>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                            {sponsors.map(sponsor => (
                                <div key={sponsor.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative group overflow-hidden flex flex-col items-center">
                                    <div className="w-full aspect-video bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center p-3 mb-3">
                                        {sponsor.imageUrl ? <img src={sponsor.imageUrl} className="max-w-full max-h-full object-contain" /> : <Star className="text-gray-200" />}
                                    </div>
                                    <h3 className="font-black text-gray-800 uppercase text-[9px] tracking-[0.2em] truncate w-full text-center">{sponsor.name}</h3>
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditItem(sponsor); setIsAdding(true); setPreviewImage(''); }} className="p-1.5 bg-white text-blue-50 rounded-lg shadow-sm border border-gray-100"><Edit className="w-3 h-3"/></button>
                                        <button onClick={() => handleDelete('sponsors', sponsor.id!)} className="p-1.5 bg-white text-red-400 rounded-lg shadow-sm border border-gray-100"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                </div>
                            ))}
                            {sponsors.length === 0 && (
                                <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                    <Star className="w-16 h-16 text-gray-100 mb-4" />
                                    <p className="text-sm font-black text-gray-300 uppercase tracking-widest">No partner ecosystems established</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* REGISTRATION TAB */}
                {activeTab === 'REGISTRATION' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Registration Header */}
                            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <UserCheck className="w-5 h-5 text-blue-600"/>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">Public Registration</h2>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure the form players will use to sign up.</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <button onClick={() => {
                                        const url = `${window.location.origin}/#/auction/${id}/register`;
                                        navigator.clipboard.writeText(url);
                                        alert("Public link copied!");
                                    }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-6 rounded-lg text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                        <Share2 className="w-4 h-4"/> Copy Public Link
                                    </button>
                                    <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase">Form Enabled</label>
                                        <button 
                                            onClick={() => setRegConfig({...regConfig, isEnabled: !regConfig.isEnabled})}
                                            className={`transition-colors ${regConfig.isEnabled ? 'text-blue-600' : 'text-gray-300'}`}
                                        >
                                            {regConfig.isEnabled ? <ToggleRight className="w-8 h-8"/> : <ToggleLeft className="w-8 h-8"/>}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    {/* Left: Core Features */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Core Features</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-2xl group cursor-pointer hover:border-blue-400 transition-all" onClick={() => setRegConfig({...regConfig, includePayment: !regConfig.includePayment})}>
                                                <span className="text-xs font-bold text-gray-700">Collect Payment (QR Code)</span>
                                                {regConfig.includePayment ? <CheckCircle className="w-6 h-6 text-blue-600"/> : <Square className="w-6 h-6 text-gray-300"/>}
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-2xl group cursor-pointer hover:border-blue-400 transition-all" onClick={() => setRegConfig({...regConfig, isPublic: !regConfig.isPublic})}>
                                                <span className="text-xs font-bold text-gray-700">Public Access (Show on Home)</span>
                                                {regConfig.isPublic ? <CheckCircle className="w-6 h-6 text-blue-600"/> : <Square className="w-6 h-6 text-gray-300"/>}
                                            </div>
                                        </div>

                                        {/* PAYMENT CONFIG - SHOWN ONLY IF includePayment IS TRUE */}
                                        {regConfig.includePayment && (
                                            <div className="mt-6 p-6 bg-blue-50/50 border border-blue-100 rounded-3xl animate-slide-up space-y-5">
                                                <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <QrCode className="w-4 h-4"/> UPI Configuration
                                                </h3>
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
                                                            {regConfig.qrCodeUrl ? (
                                                                <img src={regConfig.qrCodeUrl} className="w-full h-full object-contain p-2" />
                                                            ) : (
                                                                <>
                                                                    <Upload className="w-8 h-8 text-blue-300 mb-2"/>
                                                                    <span className="text-[10px] font-black text-blue-400 uppercase">Upload UPI QR</span>
                                                                </>
                                                            )}
                                                            <input ref={qrInputRef} type="file" className="hidden" accept="image/*" onChange={async e => {
                                                                if (e.target.files?.[0]) setRegConfig({...regConfig, qrCodeUrl: await compressImage(e.target.files[0])});
                                                            }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Brand & Legal */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Brand & Legal</h3>
                                        <div className="flex gap-6">
                                            <div className="flex-1 bg-gray-100 border border-dashed border-gray-300 rounded-2xl h-24 flex items-center justify-center relative overflow-hidden group">
                                                {regConfig.bannerUrl ? <img src={regConfig.bannerUrl} className="w-full h-full object-cover" /> : <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg"><ImageIcon className="text-gray-200" /></div>}
                                                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                    <Upload className="text-white w-5 h-5"/>
                                                    <input type="file" className="hidden" accept="image/*" onChange={async e => {
                                                        if (e.target.files?.[0]) setRegConfig({...regConfig, bannerUrl: await compressImage(e.target.files[0])});
                                                    }} />
                                                </label>
                                            </div>
                                            <div className="flex-[2] flex flex-col justify-center">
                                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Banner Logo</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Terms & Conditions (One per line)</label>
                                            <textarea 
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-bold text-gray-600 min-h-[100px] outline-none focus:bg-white focus:border-blue-500 transition-all"
                                                value={regConfig.terms}
                                                onChange={e => setRegConfig({...regConfig, terms: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Form Fields */}
                                <div className="mt-12 pt-12 border-t border-gray-100">
                                    <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest text-center sm:text-left">Custom Form Fields</h3>
                                        <button onClick={addCustomField} className="w-full sm:w-auto bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all">
                                            <ListPlus className="w-4 h-4"/> Add Dynamic Field
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {regConfig.customFields.map(field => (
                                            <div key={field.id} className="bg-gray-50/50 border border-gray-100 rounded-[2rem] p-6 relative group hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all">
                                                <button onClick={() => removeCustomField(field.id)} className="absolute -top-3 -right-3 bg-red-500 text-white p-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shadow-lg hover:scale-110"><X className="w-4 h-4"/></button>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Label</label>
                                                        <input className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-tighter outline-none focus:border-blue-400" value={field.label} onChange={e => updateField(field.id, 'label', e.target.value.toUpperCase())} placeholder="ENTER FIELD NAME" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Type</label>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {['text', 'number', 'select', 'date'].map(ft => (
                                                                <button
                                                                    key={ft}
                                                                    type="button"
                                                                    onClick={() => updateField(field.id, 'type', ft)}
                                                                    className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${field.type === ft ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-400'}`}
                                                                >
                                                                    {ft}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex items-center justify-between">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, 'required', e.target.checked)} className="accent-blue-600" />
                                                        <span className="text-[9px] font-black text-gray-500 uppercase">Required</span>
                                                    </label>
                                                </div>
                                                {/* Inline Dropdown Options */}
                                                {field.type === 'select' && (
                                                    <div className="mt-4 animate-fade-in">
                                                        <label className="block text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Dropdown Options (Comma separated)</label>
                                                        <input className="w-full bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-[10px] font-bold outline-none" value={(field.options || []).join(',')} onChange={e => updateField(field.id, 'options', e.target.value.split(','))} placeholder="S,M,L,XL,2XL..." />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-white border-t border-gray-100 flex justify-center">
                                <button onClick={handleSaveRegistration} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-16 rounded-2xl shadow-2xl shadow-blue-900/40 text-sm uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all active:scale-95 group">
                                    <Save className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Deploy Registration Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default AuctionManage;