
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab } from '../types';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, AlignLeft, CheckSquare, Square, Palette, ChevronDown, Search, CheckCircle, XCircle, Clock, Calendar, Info, ListPlus, Eye, EyeOff, Copy, Link as LinkIcon, Check as CheckIcon } from 'lucide-react';
import firebase from 'firebase/compat/app';

// Helper for image compression
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

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
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
    isPublic: true,
    fee: 0,
    upiId: '',
    upiName: '',
    qrCodeUrl: '',
    terms: '1. Registration fee is non-refundable.\n2. Players must report 30 mins before match.\n3. Umpire decision is final.',
    customFields: []
};

const AuctionManage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TEAMS' | 'PLAYERS' | 'REQUESTS' | 'CATEGORIES' | 'SPONSORS' | 'ROLES' | 'REGISTRATION'>('SETTINGS');
    const [loading, setLoading] = useState(true);
    const [auction, setAuction] = useState<AuctionSetup | null>(null);

    // Data States
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [categories, setCategories] = useState<AuctionCategory[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [roles, setRoles] = useState<PlayerRole[]>([]);
    const [registrations, setRegistrations] = useState<RegisteredPlayer[]>([]);
    
    // Search States
    const [playerSearch, setPlayerSearch] = useState('');
    const [requestSearch, setRequestSearch] = useState('');

    // Registration State (Local copy for editing)
    const [regConfig, setRegConfig] = useState<RegistrationConfig>(DEFAULT_REG_CONFIG);
    const [isCopied, setIsCopied] = useState(false);

    // Settings State
    const [settingsForm, setSettingsForm] = useState({
        title: '',
        date: '',
        sport: '',
        purseValue: 0,
        basePrice: 0,
        bidIncrement: 0,
        playersPerTeam: 0,
        totalTeams: 0
    });
    const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);
    const [newSlab, setNewSlab] = useState<{from: string, increment: string}>({from: '', increment: ''});

    const [settingsLogo, setSettingsLogo] = useState('');
    const settingsLogoRef = useRef<HTMLInputElement>(null);

    // Edit/Create States
    const [isEditing, setIsEditing] = useState(false);
    const [editItem, setEditItem] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qrInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const [previewImage, setPreviewImage] = useState<string>('');

    // Custom Field Builder State
    const [newField, setNewField] = useState<FormField>({ id: '', label: '', type: 'text', required: false });
    const [dropdownOptionsInput, setDropdownOptionsInput] = useState('');

    // Initial Fetch
    useEffect(() => {
        if (!id) return;
        const fetchAll = async () => {
            try {
                const aucDoc = await db.collection('auctions').doc(id).get();
                if (aucDoc.exists) {
                    const data = aucDoc.data() as AuctionSetup;
                    setAuction(data);
                    if (data.registrationConfig) {
                        setRegConfig({
                            ...DEFAULT_REG_CONFIG,
                            ...data.registrationConfig
                        });
                    }
                    
                    setSettingsForm({
                        title: data.title || '',
                        date: data.date || '',
                        sport: data.sport || '',
                        purseValue: data.purseValue || 0,
                        basePrice: data.basePrice || 0,
                        bidIncrement: data.bidIncrement || 0,
                        playersPerTeam: data.playersPerTeam || 0,
                        totalTeams: data.totalTeams || 0
                    });
                    setSettingsLogo(data.logoUrl || '');
                    if (data.slabs) setSlabs(data.slabs);
                }

                const teamsSnap = await db.collection('auctions').doc(id).collection('teams').get();
                setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));

                const playersSnap = await db.collection('auctions').doc(id).collection('players').get();
                setPlayers(playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));

                const catSnap = await db.collection('auctions').doc(id).collection('categories').get();
                setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCategory)));

                const sponsorSnap = await db.collection('auctions').doc(id).collection('sponsors').get();
                setSponsors(sponsorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor)));

                const roleSnap = await db.collection('auctions').doc(id).collection('roles').get();
                setRoles(roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole)));

                setLoading(false);
            } catch (e) {
                console.error(e);
                setLoading(false);
            }
        };
        fetchAll();
    }, [id]);

    useEffect(() => {
        if (id && activeTab === 'REQUESTS') {
            db.collection('auctions').doc(id).collection('registrations').orderBy('submittedAt', 'desc').get()
                .then(snap => {
                    setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as RegisteredPlayer)));
                });
        }
    }, [id, activeTab]);

    const addSlab = () => {
        const fromVal = Number(newSlab.from);
        const incVal = Number(newSlab.increment);
        if (fromVal >= 0 && incVal > 0) {
            setSlabs(prev => [...prev, { from: fromVal, increment: incVal }]);
            setNewSlab({ from: '', increment: '' });
        }
    };

    const removeSlab = (index: number) => {
        setSlabs(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const teamData = {
            name: editItem.name,
            budget: Number(editItem.budget),
            logoUrl: previewImage || editItem.logoUrl || '',
            players: editItem.players || [],
            password: editItem.password || ''
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('teams').doc(editItem.id).update(teamData);
                setTeams(prev => prev.map(t => t.id === editItem.id ? { ...t, ...teamData } : t));
            } else {
                const newTeamResult = await db.runTransaction(async (transaction) => {
                    const counterRef = db.collection('appConfig').doc('globalCounters');
                    const counterDoc = await transaction.get(counterRef);
                    let nextNum = 1;
                    if (counterDoc.exists) nextNum = (counterDoc.data()?.teamCount || 0) + 1;
                    const newId = `T${String(nextNum).padStart(3, '0')}`;
                    const newTeamRef = db.collection('auctions').doc(id).collection('teams').doc(newId);
                    transaction.set(counterRef, { teamCount: nextNum }, { merge: true });
                    transaction.set(newTeamRef, { id: newId, ...teamData });
                    return { id: newId, ...teamData };
                });
                setTeams(prev => [...prev, newTeamResult as Team]);
            }
            closeModal();
        } catch (err: any) { alert("Error saving team: " + err.message); }
    };

    const handleSavePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const playerData = {
            name: editItem.name,
            category: editItem.category,
            role: editItem.role,
            basePrice: Number(editItem.basePrice),
            photoUrl: previewImage || editItem.photoUrl || '',
            nationality: editItem.nationality || 'India',
            status: editItem.status || 'UNSOLD',
            stats: editItem.stats || { matches: 0, runs: 0, wickets: 0 }
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('players').doc(String(editItem.id)).update(playerData);
                setPlayers(prev => prev.map(p => p.id === editItem.id ? { ...p, ...playerData } : p));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('players').doc();
                await newRef.set({ id: newRef.id, ...playerData });
                setPlayers(prev => [...prev, { id: newRef.id, ...playerData } as Player]);
            }
            closeModal();
        } catch (err) { alert("Error saving player"); }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const catData = {
            name: editItem.name,
            basePrice: Number(editItem.basePrice),
            maxPerTeam: Number(editItem.maxPerTeam),
            bidIncrement: Number(editItem.bidIncrement),
            minPerTeam: 0,
            bidLimit: 0,
            slabs: []
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('categories').doc(editItem.id).update(catData);
                setCategories(prev => prev.map(c => c.id === editItem.id ? { ...c, ...catData } : c));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('categories').doc();
                await newRef.set({ id: newRef.id, ...catData });
                setCategories(prev => [...prev, { id: newRef.id, ...catData } as AuctionCategory]);
            }
            closeModal();
        } catch (err) { alert("Error saving category"); }
    };

    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const roleData = {
            name: editItem.name,
            basePrice: Number(editItem.basePrice || 0)
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('roles').doc(editItem.id).update(roleData);
                setRoles(prev => prev.map(r => r.id === editItem.id ? { ...r, ...roleData } : r));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('roles').doc();
                await newRef.set({ id: newRef.id, ...roleData });
                setRoles(prev => [...prev, { id: newRef.id, ...roleData } as PlayerRole]);
            }
            closeModal();
        } catch (err) { alert("Error saving role"); }
    };

    const handleSaveSponsor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const sponsorData = {
            name: editItem.name,
            imageUrl: previewImage || editItem.imageUrl || ''
        };
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection('sponsors').doc(editItem.id).update(sponsorData);
                setSponsors(prev => prev.map(s => s.id === editItem.id ? { ...s, ...sponsorData } : s));
            } else {
                const newRef = db.collection('auctions').doc(id).collection('sponsors').doc();
                await newRef.set({ id: newRef.id, ...sponsorData });
                setSponsors(prev => [...prev, { id: newRef.id, ...sponsorData } as Sponsor]);
            }
            closeModal();
        } catch (err) { alert("Error saving sponsor"); }
    };

    const handleSaveRegistrationConfig = async () => {
        if (!id) return;
        try {
            // Create a sanitized object to avoid 'undefined' field errors in Firestore
            const sanitizedConfig = JSON.parse(JSON.stringify(regConfig));
            
            await db.collection('auctions').doc(id).update({
                registrationConfig: sanitizedConfig,
                bannerUrl: sanitizedConfig.bannerUrl || ''
            });
            alert("Registration settings saved successfully!");
        } catch (e: any) {
            console.error("Save Registration Config Error:", e);
            alert("Failed to save settings: " + (e.message || "Unknown error"));
        }
    };

    const handleSaveSettings = async () => {
        if (!id || !auction) return;
        try {
            const updates = {
                ...settingsForm,
                logoUrl: settingsLogo,
                slabs: slabs,
                totalTeams: Number(settingsForm.totalTeams)
            };
            await db.collection('auctions').doc(id).update(updates);
            setAuction({ ...auction, ...updates });
            alert("Auction Details Updated!");
        } catch (e: any) {
            console.error(e);
            alert("Failed to update settings: " + e.message);
        }
    };

    const handleApproveRequest = async (reg: RegisteredPlayer) => {
        if (!id || !window.confirm(`Approve ${reg.fullName} and add to auction pool?`)) return;
        try {
            const newPlayer: any = {
                name: reg.fullName,
                category: 'Uncapped',
                role: reg.playerType || 'All Rounder',
                basePrice: auction?.basePrice || 0,
                photoUrl: reg.profilePic || '',
                nationality: 'India',
                status: 'UNSOLD',
                stats: { matches: 0, runs: 0, wickets: 0 },
                speciality: reg.playerType
            };
            const playerRef = await db.collection('auctions').doc(id).collection('players').add(newPlayer);
            const playerWithId = { id: playerRef.id, ...newPlayer };
            await db.collection('auctions').doc(id).collection('registrations').doc(reg.id).update({ status: 'APPROVED' });
            setPlayers(prev => [...prev, playerWithId]);
            setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'APPROVED' } : r));
            alert("Player Approved!");
        } catch (e: any) { alert("Error approving player: " + e.message); }
    };

    const handleRejectRequest = async (regId: string) => {
        if (!id || !window.confirm("Reject this registration?")) return;
        try {
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).update({ status: 'REJECTED' });
            setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, status: 'REJECTED' } : r));
        } catch (e: any) { alert("Error: " + e.message); }
    };

    const handleDeleteRequest = async (regId: string) => {
        if (!id || !window.confirm("Permanently delete this request?")) return;
        try {
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).delete();
            setRegistrations(prev => prev.filter(r => r.id !== regId));
        } catch (e: any) { alert("Error: " + e.message); }
    };

    const handleDelete = async (collection: string, itemId: string) => {
        if (!window.confirm("Are you sure?")) return;
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).collection(collection).doc(String(itemId)).delete();
            if (collection === 'teams') setTeams(prev => prev.filter(t => t.id !== itemId));
            if (collection === 'players') setPlayers(prev => prev.filter(p => p.id !== itemId));
            if (collection === 'categories') setCategories(prev => prev.filter(c => c.id !== itemId));
            if (collection === 'sponsors') setSponsors(prev => prev.filter(s => s.id !== itemId));
            if (collection === 'roles') setRoles(prev => prev.filter(r => r.id !== itemId));
        } catch (e) { alert("Delete failed"); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setPreviewImage(base64);
        }
    };

    const handleRegFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'qrCodeUrl' | 'bannerUrl') => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setRegConfig(prev => ({ ...prev, [field]: base64 }));
        }
    };

    const handleSettingsLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setSettingsLogo(base64);
        }
    };

    const addCustomField = () => {
        if (!newField.label) return alert("Enter Field Label");
        const fieldId = newField.label.toLowerCase().replace(/\s+/g, '_');
        
        let processedOptions: string[] | undefined = undefined;
        if (newField.type === 'select' && dropdownOptionsInput) {
            processedOptions = dropdownOptionsInput.split(',').map(s => s.trim()).filter(Boolean);
        }

        setRegConfig(prev => ({
            ...prev,
            customFields: [...prev.customFields, { ...newField, id: fieldId, options: processedOptions }]
        }));
        
        // Reset builder
        setNewField({ id: '', label: '', type: 'text', required: false });
        setDropdownOptionsInput('');
    };

    const removeCustomField = (idx: number) => {
        setRegConfig(prev => ({
            ...prev,
            customFields: prev.customFields.filter((_, i) => i !== idx)
        }));
    };

    const copyRegLink = () => {
        if (!id) return;
        const baseUrl = window.location.href.split('#')[0];
        const link = `${baseUrl}#/auction/${id}/register`;
        navigator.clipboard.writeText(link);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const openModal = (item: any = {}) => {
        setEditItem(item);
        setPreviewImage(item.logoUrl || item.photoUrl || item.imageUrl || '');
        setIsEditing(true);
    };

    const closeModal = () => {
        setIsEditing(false);
        setEditItem(null);
        setPreviewImage('');
    };

    const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()));
    const filteredRequests = registrations.filter(r => r.fullName.toLowerCase().includes(requestSearch.toLowerCase()));

    if (loading) return <div className="p-10 text-center text-gray-700">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-10 text-gray-900">
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-800"><ArrowLeft className="w-5 h-5"/></button>
                        <h1 className="text-lg font-bold text-gray-700 truncate">{auction?.title || 'Manage Auction'}</h1>
                    </div>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto custom-scrollbar">
                        {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'CATEGORIES', 'ROLES', 'SPONSORS', 'REGISTRATION'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab as any)} 
                                className={`px-3 py-1 text-xs font-bold rounded whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                
                {/* SETTINGS TAB */}
                {activeTab === 'SETTINGS' && (
                    <div className="max-w-4xl mx-auto bg-white rounded shadow p-6">
                        <h2 className="text-lg font-bold mb-6 flex items-center border-b pb-2"><Settings className="w-5 h-5 mr-2"/> Auction Settings</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Auction Title</label>
                                    <input type="text" className="w-full border rounded p-2" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Sport</label>
                                        <select className="w-full border rounded p-2 bg-white" value={settingsForm.sport} onChange={e => setSettingsForm({...settingsForm, sport: e.target.value})}>
                                            <option value="Cricket">Cricket</option>
                                            <option value="Football">Football</option>
                                            <option value="Kabaddi">Kabaddi</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Date</label>
                                        <input type="date" className="w-full border rounded p-2" value={settingsForm.date} onChange={e => setSettingsForm({...settingsForm, date: e.target.value})} />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Auction Logo</label>
                                    <div className="border border-dashed p-4 rounded flex items-center justify-center cursor-pointer hover:bg-gray-50" onClick={() => settingsLogoRef.current?.click()}>
                                        {settingsLogo ? (
                                            <img src={settingsLogo} className="h-24 object-contain" />
                                        ) : (
                                            <div className="text-center text-gray-400 text-sm">
                                                <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                                                Click to Upload
                                            </div>
                                        )}
                                        <input ref={settingsLogoRef} type="file" accept="image/*" className="hidden" onChange={handleSettingsLogoChange} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="font-bold text-sm text-gray-500 uppercase">Auction Rules</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Total Teams</label>
                                        <input type="number" className="w-full border rounded p-2" value={settingsForm.totalTeams} onChange={e => setSettingsForm({...settingsForm, totalTeams: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Default Team Purse</label>
                                        <input type="number" className="w-full border rounded p-2" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Base Price</label>
                                        <input type="number" className="w-full border rounded p-2" value={settingsForm.basePrice} onChange={e => setSettingsForm({...settingsForm, basePrice: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Bid Increment (Default)</label>
                                        <input type="number" className="w-full border rounded p-2" value={settingsForm.bidIncrement} onChange={e => setSettingsForm({...settingsForm, bidIncrement: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Max Players Per Team</label>
                                    <input type="number" className="w-full border rounded p-2" value={settingsForm.playersPerTeam} onChange={e => setSettingsForm({...settingsForm, playersPerTeam: Number(e.target.value)})} />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-2">Global Bid Slabs</label>
                                    <div className="bg-white p-3 rounded border border-gray-300">
                                         {slabs.length === 0 && <p className="text-xs text-gray-400 italic text-center mb-2">No slabs defined.</p>}
                                         {slabs.map((slab, idx) => (
                                             <div key={idx} className="flex justify-between items-center text-sm mb-2 bg-gray-50 p-2 rounded">
                                                 <span>From <b>{slab.from}</b>: Increase <b>+{slab.increment}</b></span>
                                                 <button type="button" onClick={() => removeSlab(idx)} className="text-red-500 hover:text-red-700">
                                                     <Trash2 className="w-4 h-4"/>
                                                 </button>
                                             </div>
                                         ))}
                                         <div className="grid grid-cols-2 gap-2 mt-2">
                                             <input type="number" placeholder="Price >=" className="border p-2 rounded text-sm w-full" value={newSlab.from} onChange={e => setNewSlab({...newSlab, from: e.target.value})} />
                                             <input type="number" placeholder="+ Increment" className="border p-2 rounded text-sm w-full" value={newSlab.increment} onChange={e => setNewSlab({...newSlab, increment: e.target.value})} />
                                         </div>
                                         <button type="button" onClick={addSlab} className="mt-2 w-full py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded hover:bg-green-100 flex items-center justify-center">
                                             <Plus className="w-3 h-3 mr-1"/> Add Rule
                                         </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t flex justify-end">
                            <button onClick={handleSaveSettings} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded shadow flex items-center">
                                <Save className="w-4 h-4 mr-2"/> Save Changes
                            </button>
                        </div>
                    </div>
                )}
                {/* ... other tabs remain unchanged ... */}
