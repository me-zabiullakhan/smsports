
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { AuctionSetup, Team, AuctionCategory, RegistrationConfig, FormField, RegisteredPlayer, Player } from '../types';
import { ArrowLeft, Plus, Trash2, X, Image as ImageIcon, AlertTriangle, Layers, TrendingUp, FileText, QrCode, Link as LinkIcon, Save, Settings, AlignLeft, List, Calendar, Upload, Users, Eye, CheckCircle, XCircle, Key, Hash, Edit, Loader2, Database, DollarSign, Cast } from 'lucide-react';
import firebase from 'firebase/compat/app';

const AuctionManage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [auction, setAuction] = useState<AuctionSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'categories' | 'registration' | 'registrations' | 'pool'>('teams');

  // Data States
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<AuctionCategory[]>([]);
  const [registrations, setRegistrations] = useState<RegisteredPlayer[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<Player[]>([]);

  // Registration Config State
  const [regConfig, setRegConfig] = useState<RegistrationConfig>({
      isEnabled: false,
      fee: 1500,
      upiId: '',
      upiName: '',
      qrCodeUrl: '',
      terms: '* Player registration fees is Rs. 1500, which is to be paid on below given UPI details.\n* Make payment and attach the screenshot of successful payment with registration form.\n* Player name will be included in auction list only after payment is confirmed.',
      bannerUrl: '',
      customFields: []
  });
  const qrInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // UI States
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Player Edit/Bulk States
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  
  // Registration View Modal
  const [selectedRegistration, setSelectedRegistration] = useState<RegisteredPlayer | null>(null);

  // Real-time Listener for Auction Details
  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    const unsubscribe = db.collection('auctions').doc(id).onSnapshot((docSnap) => {
        if (docSnap.exists) {
            const data = { id: docSnap.id, ...docSnap.data() } as AuctionSetup;
            setAuction(data);
            if (data.registrationConfig) {
                setRegConfig({
                    ...data.registrationConfig,
                    customFields: data.registrationConfig.customFields || []
                });
            }
            setErrorMsg(null);
        } else {
            console.error("Auction not found");
            setErrorMsg("Auction not found.");
        }
        setLoading(false);
    }, (error: any) => {
        console.error("Error fetching auction details:", error);
        if (error.message?.includes("database") || error.code === 'not-found') {
            setErrorMsg("CRITICAL: Database not found. Create 'Firestore Database' in Firebase Console.");
        } else {
            setErrorMsg(error.message);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  // Real-time Listener for Teams
  useEffect(() => {
      if (!id) return;
      const unsubscribe = db.collection('auctions').doc(id).collection('teams').onSnapshot((snapshot) => {
          const loadedTeams = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team));
          setTeams(loadedTeams);
      });
      return () => unsubscribe();
  }, [id]);

  // Real-time Listener for Categories
  useEffect(() => {
      if (!id) return;
      const unsubscribe = db.collection('auctions').doc(id).collection('categories').onSnapshot((snapshot) => {
          const loadedCats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCategory));
          setCategories(loadedCats);
      });
      return () => unsubscribe();
  }, [id]);

  // Real-time Listener for Registrations
  useEffect(() => {
      if (!id) return;
      const unsubscribe = db.collection('auctions').doc(id).collection('registrations').onSnapshot((snapshot) => {
          const loadedRegs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RegisteredPlayer));
          setRegistrations(loadedRegs);
      });
      return () => unsubscribe();
  }, [id]);

  // Real-time Listener for Pool Players (Approved)
  useEffect(() => {
      if (!id) return;
      const unsubscribe = db.collection('auctions').doc(id).collection('players').onSnapshot((snapshot) => {
          const loadedPlayers = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
          setPoolPlayers(loadedPlayers);
      });
      return () => unsubscribe();
  }, [id]);

  const handleDeleteTeam = async (teamId: string) => {
      if (!id) return;
      if (!auth.currentUser) {
          alert("You must be logged in to delete teams.");
          return;
      }

      if (window.confirm(`Are you sure you want to delete this team (ID: ${teamId})? This cannot be undone.`)) {
          try {
              console.log(`Deleting team: auctions/${id}/teams/${teamId}`);
              await db.collection('auctions').doc(id).collection('teams').doc(teamId).delete();
              // Success - UI updates automatically via snapshot
          } catch (e: any) {
              console.error("Error deleting team:", e);
              alert("Failed to delete team: " + e.message);
          }
      }
  };

  const handleDeleteCategory = async (catId: string) => {
      if (!id) return;
      if (window.confirm("Delete this category?")) {
          try {
              await db.collection('auctions').doc(id).collection('categories').doc(catId).delete();
          } catch (e) {
              console.error("Error deleting category:", e);
          }
      }
  };

  const handleDeletePoolPlayer = async (playerId: string) => {
      if (!id) return;
      if (!auth.currentUser) return alert("Please login first.");
      
      if (window.confirm("Are you sure? This will remove the player from the auction pool.")) {
          try {
              await db.collection('auctions').doc(id).collection('players').doc(playerId.toString()).delete();
          } catch (e: any) {
              console.error(e);
              alert("Error deleting player: " + e.message);
          }
      }
  };

  const handleClearPool = async () => {
      if (!id) return;
      if (!auth.currentUser) return alert("Please login first.");

      if (window.confirm("DANGER: This will delete ALL players from the auction pool. This cannot be undone. Are you sure?")) {
          setIsDeleting(true);
          try {
              // Get all docs
              const snapshot = await db.collection('auctions').doc(id).collection('players').get();
              if (snapshot.empty) {
                  alert("Pool is already empty.");
                  setIsDeleting(false);
                  return;
              }

              // Firestore batches allow max 500 writes. We'll iterate.
              const batch = db.batch();
              let count = 0;
              snapshot.docs.forEach((doc) => {
                  batch.delete(doc.ref);
                  count++;
              });
              
              if (count > 0) {
                  await batch.commit();
                  alert(`Successfully deleted ${count} players.`);
              }
          } catch (e: any) {
              console.error("Bulk delete error:", e);
              alert("Failed to delete all players: " + e.message);
          } finally {
              setIsDeleting(false);
          }
      }
  };

  const handleApprovePlayer = async (reg: RegisteredPlayer, selectedCategory: string, selectedBasePrice: number) => {
      if (!id) {
          alert("Auction ID missing.");
          return;
      }
      if (!auth.currentUser) {
          alert("You are not logged in.");
          return;
      }

      setIsApproving(true);

      // Safe Image Logic
      let safePhotoUrl = '';
      if (reg.profilePic && reg.profilePic.length < 500000) {
          safePhotoUrl = reg.profilePic;
      } else {
          console.warn("Image too large, stripping for safety.");
      }

      const newPlayerId = db.collection('dummy').doc().id; 
      
      // Explicitly Cast Data to prevent 'undefined' errors
      const playerData = {
          id: String(newPlayerId),
          name: String(reg.fullName || 'Unknown Player'),
          category: String(selectedCategory || reg.playerType || 'Uncategorized'),
          basePrice: Number(selectedBasePrice || 0),
          nationality: 'India',
          photoUrl: safePhotoUrl,
          speciality: String(reg.playerType || 'General'),
          stats: { matches: 0, runs: 0, wickets: 0 }
      };

      try {
          // STEP 1: Create Player
          await db.collection('auctions').doc(id).collection('players').doc(newPlayerId).set(playerData);
          
          // STEP 2: Update Registration Status
          await db.collection('auctions').doc(id).collection('registrations').doc(reg.id).update({
              status: 'APPROVED'
          });

          alert("Player Approved Successfully!");
          setSelectedRegistration(null);

      } catch (e: any) {
          console.error("Approval Operation Failed:", e);
          alert(`Failed to approve: ${e.message} (Code: ${e.code})`);
      } finally {
          setIsApproving(false);
      }
  };

  const handleRejectPlayer = async (regId: string) => {
      if (!id) return;
      if (!auth.currentUser) {
          alert("You are not logged in.");
          return;
      }

      if (window.confirm("Are you sure you want to reject (DELETE) this registration?")) {
          try {
              await db.collection('auctions').doc(id).collection('registrations').doc(regId).delete();
              alert("Registration Deleted.");
              setSelectedRegistration(null);
          } catch (e: any) {
              console.error("Reject Error:", e);
              alert("Failed to delete: " + e.message);
          }
      }
  };

  const handleSaveRegConfig = async () => {
      if (!id) return;
      setIsSavingConfig(true);
      try {
          await db.collection('auctions').doc(id).update({
              registrationConfig: regConfig
          });
          alert("Configuration Saved!");
      } catch (e) {
          console.error(e);
          alert("Failed to save configuration.");
      } finally {
          setIsSavingConfig(false);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'qr' | 'banner') => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 800 * 1024) { 
            alert("Image too large. Please upload images smaller than 800KB.");
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              setRegConfig(prev => ({
                  ...prev,
                  [field === 'qr' ? 'qrCodeUrl' : 'bannerUrl']: base64
              }));
          };
          reader.readAsDataURL(file);
      }
  };

  const copyRegLink = () => {
      const url = `${window.location.origin}/#/auction/${id}/register`;
      navigator.clipboard.writeText(url);
      alert("Registration Link Copied!");
  };

  const copyOBSLink = () => {
      if (!id) return;
      
      // CHECK FOR PREVIEW ENVIRONMENT
      if (window.location.protocol === 'blob:') {
          alert("⚠️ PREVIEW MODE DETECTED\n\nOBS Overlays do not work in this preview environment because 'blob:' URLs are temporary.\n\nPlease DEPLOY this app (e.g. to Firebase Hosting) to use the Overlay feature.");
          return;
      }

      // Use current href base to support subdirectories/index.html paths
      const baseUrl = window.location.href.split('#')[0];
      const url = `${baseUrl}#/obs-overlay/${id}`;
      navigator.clipboard.writeText(url);
      alert("🎥 OBS Overlay URL Copied!\n\nPaste this as a Browser Source in OBS Studio.");
  }

  // --- FORM BUILDER LOGIC ---
  const addField = () => {
      const newField: FormField = { id: Date.now().toString(), label: 'New Question', type: 'text', required: false, placeholder: '' };
      setRegConfig(prev => ({ ...prev, customFields: [...prev.customFields, newField] }));
  };
  const removeField = (fieldId: string) => {
      if (!window.confirm("Delete this field?")) return;
      setRegConfig(prev => ({ ...prev, customFields: prev.customFields.filter(f => f.id !== fieldId) }));
  };
  const updateField = (fieldId: string, updates: Partial<FormField>) => {
      setRegConfig(prev => ({ ...prev, customFields: prev.customFields.map(f => f.id === fieldId ? { ...f, ...updates } : f) }));
  };
  const addOptionToField = (fieldId: string) => {
      setRegConfig(prev => ({
          ...prev,
          customFields: prev.customFields.map(f => {
              if (f.id === fieldId) return { ...f, options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] };
              return f;
          })
      }));
  };
  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
      setRegConfig(prev => ({
          ...prev,
          customFields: prev.customFields.map(f => {
              if (f.id === fieldId && f.options) {
                  const newOptions = [...f.options];
                  newOptions[optionIndex] = value;
                  return { ...f, options: newOptions };
              }
              return f;
          })
      }));
  };
  const removeOption = (fieldId: string, optionIndex: number) => {
      setRegConfig(prev => ({
          ...prev,
          customFields: prev.customFields.map(f => {
              if (f.id === fieldId && f.options) return { ...f, options: f.options.filter((_, i) => i !== optionIndex) };
              return f;
          })
      }));
  };

  // --- MODALS ---
  const CreateTeamModal = () => {
      const [form, setForm] = useState<Partial<Team>>(editingTeam || {
          id: '', // Will be generated
          name: '', shortName: '', minPlayers: 15, maxPlayers: 15, budget: 10000, logoUrl: '', password: '' 
      });
      const fileInputRef = useRef<HTMLInputElement>(null);
      const [isSubmitting, setIsSubmitting] = useState(false);

      const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 800 * 1024) return alert("File too large. max 800KB.");
            const reader = new FileReader();
            reader.onloadend = () => setForm(prev => ({ ...prev, logoUrl: reader.result as string }));
            reader.readAsDataURL(file);
        }
      };

      const handleSave = async (keepOpen: boolean) => {
          if (!id) return;
          if (!form.name || !form.shortName || !form.password) return alert("Name, Short Name and Password are required.");
          setIsSubmitting(true);
          try {
            let finalId = form.id?.toString();

            // GLOBAL ID GENERATION
            if (!editingTeam) {
                await db.runTransaction(async (transaction) => {
                    const globalCounterRef = db.collection('globals').doc('teamCounter');
                    const counterDoc = await transaction.get(globalCounterRef);
                    
                    let newCount = 1;
                    if (counterDoc.exists) {
                        newCount = (counterDoc.data()?.count || 0) + 1;
                    }
                    
                    transaction.set(globalCounterRef, { count: newCount }, { merge: true });
                    finalId = `T${String(newCount).padStart(3, '0')}`;
                });
            }

            if (!finalId) throw new Error("Failed to generate Team ID");

            const teamData = { ...form, id: finalId };
            if(!teamData.players) teamData.players = [];
            if(!teamData.owner) teamData.owner = '';
            
            await db.collection('auctions').doc(id).collection('teams').doc(finalId).set(teamData, { merge: true });
            
            alert(`Team ${editingTeam ? 'updated' : 'created'} successfully! ID: ${finalId}`);
            if (!keepOpen || editingTeam) {
                setShowTeamModal(false);
                setEditingTeam(null);
            } else {
                // Reset form for next team
                setForm({ id: '', name: '', shortName: '', minPlayers: 15, maxPlayers: 15, budget: 10000, logoUrl: '', password: '' });
            }
          } catch (e: any) { alert("Error: " + e.message); } finally { setIsSubmitting(false); }
      };

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">{editingTeam ? 'Edit team' : 'Create team'}</h3>
                    <button onClick={() => setShowTeamModal(false)} className="text-gray-400 hover:text-gray-600"><X /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-2">
                        <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Team ID</label>
                        <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-blue-600"/>
                            <span className="font-mono font-bold text-lg text-blue-900">
                                {editingTeam ? form.id : "Auto-Generated (Global)"}
                            </span>
                        </div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Short name *</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500" value={form.shortName} onChange={e => setForm({...form, shortName: e.target.value})}/></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label><div className="relative"><input type="text" className="w-full border p-2 pl-9 rounded outline-none focus:ring-2 focus:ring-green-500 bg-yellow-50" value={form.password} onChange={e => setForm({...form, password: e.target.value})}/><Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/></div></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Min player</label><input type="number" className="w-full border p-2 rounded outline-none" value={form.minPlayers} onChange={e => setForm({...form, minPlayers: parseInt(e.target.value)})}/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Max player</label><input type="number" className="w-full border p-2 rounded outline-none" value={form.maxPlayers} onChange={e => setForm({...form, maxPlayers: parseInt(e.target.value)})}/></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Total points</label><input type="number" className="w-full border p-2 rounded outline-none" value={form.budget} onChange={e => setForm({...form, budget: parseInt(e.target.value)})}/></div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                        <div onClick={() => fileInputRef.current?.click()} className="border border-dashed border-gray-300 rounded p-4 text-center cursor-pointer hover:bg-gray-50 flex flex-col items-center">
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
                            {form.logoUrl ? <img src={form.logoUrl} alt="Preview" className="w-20 h-20 object-contain"/> : <><ImageIcon className="w-8 h-8 text-gray-300"/><span className="text-xs mt-2">Upload</span></>}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button onClick={() => setShowTeamModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                    <button onClick={() => handleSave(false)} disabled={isSubmitting} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">{editingTeam ? 'Update' : 'Create'}</button>
                </div>
            </div>
        </div>
      );
  };

  const EditPlayerModal = () => {
      const [form, setForm] = useState<Partial<Player>>({ ...editingPlayer });
      const [isSubmitting, setIsSubmitting] = useState(false);

      const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
          const catName = e.target.value;
          const foundCat = categories.find(c => c.name === catName);
          setForm(prev => ({
              ...prev,
              category: catName,
              basePrice: foundCat ? Number(foundCat.basePrice) : prev.basePrice
          }));
      }

      const handleSave = async () => {
          if (!id || !form.id) return;
          setIsSubmitting(true);
          try {
              await db.collection('auctions').doc(id).collection('players').doc(form.id.toString()).update({
                  name: form.name,
                  category: form.category,
                  basePrice: Number(form.basePrice)
              });
              alert("Player updated successfully!");
              setShowPlayerModal(false);
              setEditingPlayer(null);
          } catch (e: any) {
              alert("Update failed: " + e.message);
          } finally {
              setIsSubmitting(false);
          }
      };

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Edit Player</h3>
                    <button onClick={() => { setShowPlayerModal(false); setEditingPlayer(null); }}><X className="text-gray-400" /></button>
                </div>
                <div className="space-y-3">
                    <div><label className="text-xs text-gray-500 uppercase font-bold">Name</label><input type="text" className="w-full border p-2 rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">Category</label>
                        <select className="w-full border p-2 rounded" value={form.category as string} onChange={handleCategoryChange}>
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            {!categories.find(c => c.name === form.category) && <option value={form.category as string}>{form.category}</option>}
                        </select>
                    </div>
                    <div><label className="text-xs text-gray-500 uppercase font-bold">Base Price</label><input type="number" className="w-full border p-2 rounded" value={form.basePrice} onChange={e => setForm({...form, basePrice: parseFloat(e.target.value)})}/></div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => { setShowPlayerModal(false); setEditingPlayer(null); }} className="px-3 py-1 border rounded">Cancel</button>
                    <button onClick={handleSave} disabled={isSubmitting} className="px-3 py-1 bg-green-600 text-white rounded">{isSubmitting ? 'Saving...' : 'Save'}</button>
                </div>
            </div>
        </div>
      );
  };

  const BulkPriceModal = () => {
      const [price, setPrice] = useState(0);
      const [isSubmitting, setIsSubmitting] = useState(false);

      const handleBulkUpdate = async () => {
          if (!id) return;
          if (price <= 0) return alert("Enter valid price");
          if (!window.confirm(`Set base price of ALL ${poolPlayers.length} players to ${price}?`)) return;
          
          setIsSubmitting(true);
          try {
              const batch = db.batch();
              poolPlayers.forEach(p => {
                  const ref = db.collection('auctions').doc(id).collection('players').doc(p.id.toString());
                  batch.update(ref, { basePrice: Number(price) });
              });
              await batch.commit();
              alert("Prices updated!");
              setShowBulkPriceModal(false);
          } catch (e: any) {
              alert("Failed: " + e.message);
          } finally {
              setIsSubmitting(false);
          }
      };

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold mb-4">Bulk Update Base Price</h3>
                <input type="number" placeholder="Enter new base price" className="w-full border p-2 rounded mb-4" onChange={e => setPrice(parseFloat(e.target.value))} />
                <div className="flex justify-end gap-2">
                    <button onClick={() => setShowBulkPriceModal(false)} className="px-3 py-1 border rounded">Cancel</button>
                    <button onClick={handleBulkUpdate} disabled={isSubmitting} className="px-3 py-1 bg-blue-600 text-white rounded">{isSubmitting ? 'Updating...' : 'Update All'}</button>
                </div>
            </div>
        </div>
      );
  };

  const CreateCategoryModal = () => {
    const [form, setForm] = useState<Partial<AuctionCategory>>({ name: '', basePrice: 20, minPerTeam: 1, maxPerTeam: 2, bidIncrement: 0, bidLimit: 0, slabs: [] });
    const [newSlab, setNewSlab] = useState({ from: 0, increment: 0 });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const addSlab = () => { if (newSlab.from >= 0 && newSlab.increment > 0) { setForm(prev => ({ ...prev, slabs: [...(prev.slabs || []), newSlab] })); setNewSlab({ from: 0, increment: 0 }); } };
    const removeSlab = (index: number) => { setForm(prev => ({ ...prev, slabs: prev.slabs?.filter((_, i) => i !== index) })); };
    const handleSave = async (keepOpen: boolean) => {
        if (!id) return; if (!form.name) return alert("Name is required");
        setIsSubmitting(true);
        try {
            await db.collection('auctions').doc(id).collection('categories').add(form);
            alert("Category created!");
            if (!keepOpen) setShowCategoryModal(false); else setForm({ name: '', basePrice: 20, minPerTeam: 1, maxPerTeam: 2, bidIncrement: 0, bidLimit: 0, slabs: [] });
        } catch (e: any) { alert("Error: " + e.message); } finally { setIsSubmitting(false); }
    };
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Create category</h3>
                    <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600"><X /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input type="text" className="w-full border p-2 rounded outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Base price</label><input type="number" className="w-full border p-2 rounded outline-none" value={form.basePrice} onChange={e => setForm({...form, basePrice: parseInt(e.target.value)})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Min per team</label><input type="number" className="w-full border p-2 rounded outline-none" value={form.minPerTeam} onChange={e => setForm({...form, minPerTeam: parseInt(e.target.value)})} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Max per team</label><input type="number" className="w-full border p-2 rounded outline-none" value={form.maxPerTeam} onChange={e => setForm({...form, maxPerTeam: parseInt(e.target.value)})} /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Min bid increment</label><input type="number" className="w-full border p-2 rounded outline-none" value={form.bidIncrement} onChange={e => setForm({...form, bidIncrement: parseInt(e.target.value)})} /></div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Slabs</label>
                        <div className="bg-gray-50 p-3 rounded border">
                             {form.slabs?.map((slab, idx) => (<div key={idx} className="flex justify-between text-sm mb-2"><span>From {slab.from}: +{slab.increment}</span><button onClick={() => removeSlab(idx)} className="text-red-500"><Trash2 className="w-4 h-4"/></button></div>))}
                             <div className="grid grid-cols-2 gap-2"><input type="number" placeholder="From" className="border p-2 rounded text-sm" value={newSlab.from} onChange={e => setNewSlab({...newSlab, from: parseInt(e.target.value)})} /><input type="number" placeholder="+ Inc" className="border p-2 rounded text-sm" value={newSlab.increment} onChange={e => setNewSlab({...newSlab, increment: parseInt(e.target.value)})} /></div>
                             <button type="button" onClick={addSlab} className="mt-2 w-full py-1 bg-white border border-green-600 text-green-600 text-sm rounded">Add Slab</button>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                    <button onClick={() => handleSave(false)} disabled={isSubmitting} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create</button>
                </div>
            </div>
        </div>
    );
  };

  const RegistrationDetailsModal = () => {
      if (!selectedRegistration) return null;
      const reg = selectedRegistration;
      const [assignCategory, setAssignCategory] = useState(reg.playerType || '');
      const [assignPrice, setAssignPrice] = useState(auction?.basePrice || 0);

      useEffect(() => {
          // Attempt to match registration type with a category
          const found = categories.find(c => c.name === reg.playerType);
          if (found) {
              setAssignCategory(found.name);
              setAssignPrice(found.basePrice);
          }
      }, [reg]);

      const handleCatSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
          const val = e.target.value;
          setAssignCategory(val);
          const found = categories.find(c => c.name === val);
          if (found) setAssignPrice(found.basePrice);
      }

      return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <div><h3 className="text-xl font-bold text-gray-800">{reg.fullName}</h3><p className="text-sm text-gray-500">{reg.playerType} • {reg.mobile}</p></div>
                    <button onClick={() => setSelectedRegistration(null)} className="text-gray-400 hover:text-gray-600"><X /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold border-b pb-2 mb-4 text-gray-700">Player Profile</h4>
                            <div className="flex flex-col items-center mb-6">
                                <img src={reg.profilePic} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 shadow" />
                                <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${reg.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{reg.status}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <p><strong>Gender:</strong> {reg.gender}</p><p><strong>DOB:</strong> {reg.dob}</p><p><strong>Submitted:</strong> {new Date(reg.submittedAt).toLocaleDateString()}</p>
                            </div>
                            {reg.status !== 'APPROVED' && (
                                <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <h4 className="font-bold text-blue-800 text-sm mb-2">Approval Settings</h4>
                                    <div className="mb-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Assign Category</label>
                                        <select className="w-full border p-2 rounded" value={assignCategory} onChange={handleCatSelect}>
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            {!categories.find(c => c.name === assignCategory) && <option value={assignCategory}>{assignCategory}</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Base Price</label>
                                        <input type="number" className="w-full border p-2 rounded" value={assignPrice} onChange={e => setAssignPrice(Number(e.target.value))}/>
                                    </div>
                                </div>
                            )}
                            <div className="mt-6"><h4 className="font-bold border-b pb-2 mb-4 text-gray-700">Payment</h4><a href={reg.paymentScreenshot} target="_blank" rel="noreferrer"><img src={reg.paymentScreenshot} alt="Payment" className="w-full rounded border cursor-zoom-in" /></a></div>
                        </div>
                        <div>
                            <h4 className="font-bold border-b pb-2 mb-4 text-gray-700">Additional Details</h4>
                            <div className="space-y-4">{regConfig.customFields.map(field => (<div key={field.id} className="bg-gray-50 p-3 rounded"><p className="text-xs text-gray-500 uppercase font-bold mb-1">{field.label}</p><p className="text-sm font-medium">{reg[field.id]?.toString() || '-'}</p></div>))}</div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
                    {reg.status !== 'APPROVED' && (<><button onClick={() => handleRejectPlayer(reg.id)} disabled={isApproving} className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200">Reject</button><button onClick={() => handleApprovePlayer(reg, assignCategory, assignPrice)} disabled={isApproving} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center">{isApproving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : 'Approve & Add'}</button></>)}
                </div>
            </div>
        </div>
      )
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
            <div className="container mx-auto px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-700"><ArrowLeft /></button>
                    <div><h1 className="text-xl font-bold text-gray-700">{loading ? 'Loading...' : auction?.title}</h1><p className="text-xs text-gray-400">{auction?.sport} • {auction?.date}</p></div>
                </div>
                <div>
                    <button 
                        onClick={copyOBSLink}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 font-bold py-1.5 px-3 rounded text-sm flex items-center transition-colors"
                        title="Copy OBS Overlay Link"
                    >
                        <Cast className="w-4 h-4 mr-2" />
                        Overlay Link
                    </button>
                </div>
            </div>
        </header>

        <div className="bg-white border-b border-gray-200 sticky top-[60px] z-10 shadow-sm">
            <div className="container mx-auto px-6 flex gap-6 overflow-x-auto">
                <button onClick={() => setActiveTab('teams')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'teams' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Teams ({teams.length})</button>
                <button onClick={() => setActiveTab('categories')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'categories' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Categories ({categories.length})</button>
                <button onClick={() => setActiveTab('registration')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'registration' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Registration Form</button>
                <button onClick={() => setActiveTab('registrations')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'registrations' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Registrations ({registrations.length})</button>
                <button onClick={() => setActiveTab('pool')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'pool' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Player Pool ({poolPlayers.length})</button>
            </div>
        </div>

        <main className="container mx-auto px-6 py-8">
            {errorMsg && <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center gap-3 text-red-700 mb-6"><AlertTriangle className="w-5 h-5"/><span className="font-bold">{errorMsg}</span></div>}

            {/* TEAMS TAB */}
            {activeTab === 'teams' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Teams List</h2>
                        <button onClick={() => { setEditingTeam(null); setShowTeamModal(true); }} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow flex items-center"><Plus className="w-4 h-4 mr-2" /> Add Team</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map(team => (
                            <div key={team.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow relative">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">{team.logoUrl ? <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" /> : <span className="font-bold text-gray-400 text-lg">{team.name.charAt(0)}</span>}</div>
                                        <div><h3 className="font-bold text-gray-800">{team.name}</h3><div className="flex items-center gap-2"><span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{team.id}</span><p className="text-xs text-gray-500">{team.shortName}</p></div></div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => { setEditingTeam(team); setShowTeamModal(true); }} className="text-gray-400 hover:text-blue-500 p-1"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteTeam(team.id.toString())} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                    <div><p className="text-xs text-gray-400">Purse</p><p className="font-semibold">{team.budget} pts</p></div>
                                    <div><p className="text-xs text-gray-400">Squad Size</p><p className="font-semibold">{team.players.length} / {team.maxPlayers}</p></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CATEGORIES TAB */}
            {activeTab === 'categories' && (
                 <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Categories</h2>
                        <button onClick={() => setShowCategoryModal(true)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow flex items-center"><Plus className="w-4 h-4 mr-2" /> Add Category</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories.map(cat => (
                            <div key={cat.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2"><div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Layers className="w-5 h-5" /></div><div><h3 className="font-bold text-lg text-gray-800">{cat.name}</h3><span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Base: {cat.basePrice}</span></div></div>
                                    <button onClick={() => handleDeleteCategory(cat.id || '')} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                </div>
                                <div className="space-y-3 text-sm text-gray-600">
                                    <div className="flex justify-between border-b pb-2"><span>Players per Team:</span><span className="font-semibold text-gray-800">{cat.minPerTeam} - {cat.maxPerTeam}</span></div>
                                    <div className="flex justify-between items-center"><span>Bid Increment:</span>{cat.slabs && cat.slabs.length > 0 ? <span className="flex items-center text-blue-600 font-semibold text-xs"><TrendingUp className="w-3 h-3 mr-1" /> Slab Wise</span> : <span className="font-semibold text-gray-800">Fixed (+{cat.bidIncrement})</span>}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
            )}

            {/* REGISTRATION CONFIG TAB */}
            {activeTab === 'registration' && (
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div><h2 className="text-lg font-bold text-gray-800">Player Registration Form</h2><p className="text-sm text-gray-500">Configure the public registration page for players.</p></div>
                        <div className="flex gap-3"><button onClick={copyRegLink} className="bg-white border text-gray-700 px-3 py-2 rounded flex items-center text-sm hover:bg-gray-50"><LinkIcon className="w-4 h-4 mr-2" /> Copy Link</button><button onClick={handleSaveRegConfig} disabled={isSavingConfig} className="bg-green-600 text-white px-4 py-2 rounded flex items-center text-sm hover:bg-green-700"><Save className="w-4 h-4 mr-2" /> {isSavingConfig ? 'Saving...' : 'Save Configuration'}</button></div>
                    </div>
                    <div className="space-y-6">
                         <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">General Settings</h3>
                             <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-6">
                                 <div><h4 className="font-bold text-gray-800">Registration Status</h4><p className="text-xs text-gray-500">If disabled, players cannot access the form.</p></div>
                                 <button onClick={() => setRegConfig({...regConfig, isEnabled: !regConfig.isEnabled})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${regConfig.isEnabled ? 'bg-green-600' : 'bg-gray-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${regConfig.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div><label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee (₹)</label><input type="number" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: parseInt(e.target.value)})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500"/></div>
                                 <div><label className="block text-sm font-medium text-gray-700 mb-1">UPI Name</label><input type="text" value={regConfig.upiName} onChange={e => setRegConfig({...regConfig, upiName: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500"/></div>
                                 <div><label className="block text-sm font-medium text-gray-700 mb-1">UPI Number</label><input type="text" value={regConfig.upiId} onChange={e => setRegConfig({...regConfig, upiId: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500"/></div>
                                 <div>
                                     <label className="block text-sm font-medium text-gray-700 mb-1">QR Code</label>
                                     <div onClick={() => qrInputRef.current?.click()} className="border border-dashed p-3 text-center cursor-pointer h-[42px] flex items-center justify-center text-sm"><input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'qr')} />{regConfig.qrCodeUrl ? <span className="text-green-600 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Uploaded</span> : <span className="flex items-center"><QrCode className="w-3 h-3 mr-1"/> Upload QR</span>}</div>
                                 </div>
                             </div>
                             <div className="mt-6"><label className="block text-sm font-medium text-gray-700 mb-1">Terms</label><textarea rows={5} value={regConfig.terms} onChange={e => setRegConfig({...regConfig, terms: e.target.value})} className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-green-500"/></div>
                         </div>
                         <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                             <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="text-md font-bold text-gray-800">Form Fields</h3><button onClick={addField} className="text-green-600 text-sm font-bold flex items-center hover:bg-green-50 px-3 py-1 rounded"><Plus className="w-4 h-4 mr-1"/> Add Field</button></div>
                             <div className="space-y-4">
                                 {regConfig.customFields.map((field, index) => (
                                     <div key={field.id} className="border border-gray-200 rounded-lg p-4 bg-white relative">
                                         <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2"><div className="text-xs font-bold text-gray-400 uppercase">Field {index + 1}</div><button onClick={() => removeField(field.id)} className="text-red-500 p-1"><Trash2 className="w-4 h-4" /></button></div>
                                         <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                             <div className="md:col-span-6"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Label</label><input type="text" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} className="w-full border p-1.5 rounded text-sm"/></div>
                                             <div className="md:col-span-4"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label><select value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value as any })} className="w-full border p-1.5 rounded text-sm"><option value="text">Short Answer</option><option value="number">Number</option><option value="select">Dropdown</option><option value="date">Date</option><option value="file">File Upload</option></select></div>
                                             <div className="md:col-span-2 pt-4"><label className="flex items-center"><input type="checkbox" className="mr-2" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} /><span className="text-xs font-bold text-gray-600">Required</span></label></div>
                                         </div>
                                         {field.type === 'select' && (<div className="mt-4 bg-gray-50 p-3 rounded border"><p className="text-xs text-gray-500 font-bold mb-2 uppercase">Options</p><div className="space-y-2">{field.options?.map((opt, idx) => (<div key={idx} className="flex items-center gap-2"><input type="text" value={opt} onChange={(e) => updateOption(field.id, idx, e.target.value)} className="flex-1 border p-1 rounded text-sm"/><button onClick={() => removeOption(field.id, idx)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4"/></button></div>))}<button onClick={() => addOptionToField(field.id)} className="text-blue-600 text-xs font-bold mt-2">Add Option</button></div></div>)}
                                     </div>
                                 ))}
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {/* REGISTRATIONS TAB */}
            {activeTab === 'registrations' && (
                 <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Pending Registrations</h2>
                        <div className="text-sm text-gray-500">Review and approve players here.</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase">
                                <tr><th className="px-6 py-3">Player</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {registrations.map(reg => (
                                    <tr key={reg.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4"><div className="flex items-center gap-3"><img src={reg.profilePic} className="w-8 h-8 rounded-full bg-gray-200" />{reg.fullName}</div></td>
                                        <td className="px-6 py-4 text-sm">{reg.playerType}</td>
                                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${reg.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{reg.status}</span></td>
                                        <td className="px-6 py-4 text-right"><button onClick={() => setSelectedRegistration(reg)} className="text-blue-600 hover:underline text-sm font-medium">View</button></td>
                                    </tr>
                                ))}
                                {registrations.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No registrations found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                 </div>
            )}

            {/* NEW POOL TAB */}
            {activeTab === 'pool' && (
                 <div>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Player Pool</h2>
                            <p className="text-sm text-gray-500">These are the approved players who will appear in the Live Auction.</p>
                        </div>
                        <div className="flex gap-2">
                            {poolPlayers.length > 0 && (
                                <button 
                                    onClick={() => setShowBulkPriceModal(true)}
                                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 font-bold py-2 px-4 rounded text-sm flex items-center transition-colors"
                                >
                                    <DollarSign className="w-4 h-4 mr-2"/>
                                    Bulk Set Price
                                </button>
                            )}
                            {poolPlayers.length > 0 && (
                                <button 
                                    onClick={handleClearPool}
                                    disabled={isDeleting}
                                    className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold py-2 px-4 rounded text-sm flex items-center transition-colors"
                                >
                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Trash2 className="w-4 h-4 mr-2"/>}
                                    Clear Pool
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase">
                                <tr><th className="px-6 py-3">Player</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Base Price</th><th className="px-6 py-3 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {poolPlayers.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4"><div className="flex items-center gap-3"><img src={p.photoUrl} className="w-8 h-8 rounded-full bg-gray-200" />{p.name}</div></td>
                                        <td className="px-6 py-4 text-sm">{p.category}</td>
                                        <td className="px-6 py-4 text-sm font-mono font-bold">{p.basePrice}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => { setEditingPlayer(p); setShowPlayerModal(true); }} className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors" title="Edit Player">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeletePoolPlayer(p.id.toString())} className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors" title="Delete from Auction">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {poolPlayers.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Pool is empty. Approve players from Registrations tab.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                 </div>
            )}
        </main>

        {showTeamModal && <CreateTeamModal />}
        {showCategoryModal && <CreateCategoryModal />}
        {selectedRegistration && <RegistrationDetailsModal />}
        {showPlayerModal && <EditPlayerModal />}
        {showBulkPriceModal && <BulkPriceModal />}
    </div>
  );
};

export default AuctionManage;
