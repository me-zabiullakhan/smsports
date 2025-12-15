
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { AuctionSetup, Team, AuctionCategory, RegistrationConfig, FormField, RegisteredPlayer, Player, Sponsor, SponsorConfig, PlayerRole, BidIncrementSlab, FieldType } from '../types';
import { ArrowLeft, Plus, Trash2, X, Image as ImageIcon, AlertTriangle, FileText, Settings, Upload, Users, CheckCircle, Edit, Loader2, DollarSign, Cast, Monitor, FileSpreadsheet, UserPlus, Tag, Briefcase, Info, Save, ChevronDown, ChevronUp, Download, List } from 'lucide-react';
import firebase from 'firebase/compat/app';
import { useAuction } from '../hooks/useAuction';
import * as XLSX from 'xlsx';

const AuctionManage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { correctPlayerSale } = useAuction();
  
  const [auction, setAuction] = useState<AuctionSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'types' | 'categories' | 'registration' | 'registrations' | 'pool' | 'sponsors'>('teams');

  // Data States
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<AuctionCategory[]>([]);
  const [playerRoles, setPlayerRoles] = useState<PlayerRole[]>([]);
  const [registrations, setRegistrations] = useState<RegisteredPlayer[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<Player[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorConfig, setSponsorConfig] = useState<SponsorConfig>({ showOnOBS: true, showOnProjector: true, loopInterval: 5 });

  // Registration Config State
  const [regConfig, setRegConfig] = useState<RegistrationConfig>({
      isEnabled: false,
      includePayment: true,
      fee: 1500,
      upiId: '',
      upiName: '',
      qrCodeUrl: '',
      terms: '* Player registration fees is Rs. 1500...\n* Make payment and attach screenshot...',
      bannerUrl: '',
      customFields: []
  });
  
  // Custom Field State
  const [newField, setNewField] = useState<{
      label: string;
      type: FieldType;
      required: boolean;
      options: string; // comma separated for UI
  }>({
      label: '',
      type: 'text',
      required: false,
      options: ''
  });

  const qrInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // UI States
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  
  // Category UI State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AuctionCategory | null>(null);

  // Role UI State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<PlayerRole | null>(null);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Player Edit/Bulk States
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  
  // Registration View Modal
  const [selectedRegistration, setSelectedRegistration] = useState<RegisteredPlayer | null>(null);
  // Auto-fill states for approval
  const [approveName, setApproveName] = useState('');
  const [approveRole, setApproveRole] = useState('');
  const [approveCategory, setApproveCategory] = useState('');
  const [approveBase, setApproveBase] = useState(0);

  // Auction Edit Modal
  const [showEditAuctionModal, setShowEditAuctionModal] = useState(false);

  // Sponsor Modal
  const [showSponsorModal, setShowSponsorModal] = useState(false);

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);

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
                    includePayment: data.registrationConfig.includePayment ?? true,
                    customFields: data.registrationConfig.customFields || []
                });
            }
            if (data.sponsorConfig) setSponsorConfig(data.sponsorConfig);
            setErrorMsg(null);
        } else {
            console.error("Auction not found");
            setErrorMsg("Auction not found.");
        }
        setLoading(false);
    }, (error: any) => {
        setErrorMsg(error.message);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  // Real-time Listeners
  useEffect(() => {
      if (!id) return;
      const unsubTeams = db.collection('auctions').doc(id).collection('teams').onSnapshot(s => setTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as Team))));
      const unsubCats = db.collection('auctions').doc(id).collection('categories').onSnapshot(s => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCategory))));
      const unsubRoles = db.collection('auctions').doc(id).collection('roles').onSnapshot(s => setPlayerRoles(s.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole))));
      const unsubRegs = db.collection('auctions').doc(id).collection('registrations').onSnapshot(s => setRegistrations(s.docs.map(d => ({ id: d.id, ...d.data() } as RegisteredPlayer))));
      const unsubPlayers = db.collection('auctions').doc(id).collection('players').onSnapshot(s => setPoolPlayers(s.docs.map(d => ({ id: d.id, ...d.data() } as Player))));
      const unsubSponsors = db.collection('auctions').doc(id).collection('sponsors').onSnapshot(s => setSponsors(s.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor))));

      return () => {
          unsubTeams(); unsubCats(); unsubRoles(); unsubRegs(); unsubPlayers(); unsubSponsors();
      };
  }, [id]);

  // Set default approval values when a registration is selected
  useEffect(() => {
      if (selectedRegistration) {
          setApproveName(selectedRegistration.fullName);
          setApproveRole(selectedRegistration.playerType);
          setApproveCategory(''); // Let admin choose, or could default to 'Standard'
          setApproveBase(auction?.basePrice || 0);
      }
  }, [selectedRegistration, auction]);

  const handleDeleteTeam = async (teamId: string) => {
      if (!id || !auth.currentUser) return alert("You must be logged in to delete teams.");
      if (window.confirm(`Are you sure you want to delete this team (ID: ${teamId})?`)) {
          try { await db.collection('auctions').doc(id).collection('teams').doc(teamId).delete(); } catch (e: any) { alert("Failed to delete team: " + e.message); }
      }
  };

  const handleDeleteCategory = async (catId: string) => {
      if (!id) return;
      if (window.confirm("Delete this category?")) {
          try { await db.collection('auctions').doc(id).collection('categories').doc(catId).delete(); } catch (e: any) { alert("Failed to delete: " + e.message); }
      }
  };

  const handleDeleteRole = async (roleId: string) => {
      if (!id) return;
      if (window.confirm("Delete this player role?")) {
          try { await db.collection('auctions').doc(id).collection('roles').doc(roleId).delete(); } catch (e: any) { alert("Failed to delete: " + e.message); }
      }
  };

  const handleDeletePoolPlayer = async (playerId: string) => {
      if (!id) return;
      if (window.confirm("Remove player from pool?")) {
          try { await db.collection('auctions').doc(id).collection('players').doc(playerId).delete(); } catch (e: any) { alert(e.message); }
      }
  };

  const handleClearPool = async () => {
      if (!id) return;
      if (window.confirm("Delete ALL players from pool?")) {
          setIsDeleting(true);
          try {
              const snapshot = await db.collection('auctions').doc(id).collection('players').get();
              const batch = db.batch();
              snapshot.docs.forEach((doc) => batch.delete(doc.ref));
              await batch.commit();
              alert(`Deleted ${snapshot.size} players.`);
          } catch (e: any) { alert(e.message); } finally { setIsDeleting(false); }
      }
  };

  const handleApprovePlayer = async (reg: RegisteredPlayer) => {
      if (!id) return;
      if (!approveName || !approveRole) return alert("Name and Role are required.");

      setIsApproving(true);
      const newPlayerId = db.collection('dummy').doc().id; 
      const playerData: Player = {
          id: String(newPlayerId),
          name: String(approveName),
          category: String(approveCategory || 'Standard'),
          role: String(approveRole),
          basePrice: Number(approveBase),
          nationality: 'India',
          photoUrl: reg.profilePic || '',
          speciality: String(approveRole),
          stats: { matches: 0, runs: 0, wickets: 0 },
          status: 'UNSOLD'
      };
      try {
          await db.collection('auctions').doc(id).collection('players').doc(newPlayerId).set(playerData);
          await db.collection('auctions').doc(id).collection('registrations').doc(reg.id).update({ status: 'APPROVED' });
          alert("Player Approved & Added to Pool!");
          setSelectedRegistration(null);
      } catch (e: any) { alert(e.message); } finally { setIsApproving(false); }
  };

  const handleRejectPlayer = async (regId: string) => {
      if (!id) return;
      if (window.confirm("Reject registration?")) {
          try { await db.collection('auctions').doc(id).collection('registrations').doc(regId).delete(); } catch (e: any) { alert(e.message); }
      }
  };

  const handleSaveRegConfig = async () => {
      if (!id) return;
      setIsSavingConfig(true);
      try { 
          // Deep clean undefined values (Firestore rejects undefined)
          const cleanConfig = JSON.parse(JSON.stringify(regConfig));
          await db.collection('auctions').doc(id).update({ registrationConfig: cleanConfig }); 
          alert("Config Saved Successfully!"); 
      } catch (e: any) { 
          console.error("Save Error:", e);
          alert("Failed to save config: " + e.message); 
      } finally { 
          setIsSavingConfig(false); 
      }
  };

  // Custom Field Handlers
  const handleAddCustomField = () => {
      if (!newField.label.trim()) return alert("Field Label is required");
      
      const fieldId = `field_${Date.now()}`;
      
      const field: FormField = {
          id: fieldId,
          label: newField.label,
          type: newField.type,
          required: newField.required,
          placeholder: `Enter ${newField.label}`
      };

      // Only add options if it's a select field to avoid undefined values in state
      if (newField.type === 'select') {
          field.options = newField.options.split(',').map(s => s.trim()).filter(s => s);
      }

      setRegConfig(prev => ({
          ...prev,
          customFields: [...(prev.customFields || []), field]
      }));

      // Reset form
      setNewField({
          label: '',
          type: 'text',
          required: false,
          options: ''
      });
  };

  const handleDeleteCustomField = (fieldId: string) => {
      setRegConfig(prev => ({
          ...prev,
          customFields: prev.customFields?.filter(f => f.id !== fieldId) || []
      }));
  };

  const copyRegLink = () => {
      navigator.clipboard.writeText(`${window.location.origin}/#/auction/${id}/register`);
      alert("Link Copied!");
  };

  const copyOBSLink = (type: 'transparent' | 'green') => {
      if (!id) return;
      const baseUrl = window.location.href.split('#')[0];
      const route = type === 'green' ? 'obs-green' : 'obs-overlay';
      navigator.clipboard.writeText(`${baseUrl}#/${route}/${id}`);
      alert("OBS Link Copied!");
  }

  // --- EXCEL IMPORT LOGIC ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !id) return;
      setIsImporting(true);
      try {
          const data = await file.arrayBuffer();
          // Specify type: 'array' for reliability
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
              alert("File appears to be empty.");
              return;
          }

          let count = 0;
          let batch = db.batch();
          const BATCH_SIZE = 400; // Firestore batch limit is 500

          for (const row of jsonData as any[]) {
               const name = row['Name'] || row['name'] || row['Player Name'];
               if(name) {
                   const newId = db.collection('dummy').doc().id;
                   const playerData: Player = {
                       id: String(newId),
                       name: String(name),
                       category: row['Category'] || row['category'] || 'Standard',
                       role: row['Role'] || row['role'] || 'General',
                       basePrice: Number(row['Base Price'] || row['Base'] || 0),
                       nationality: 'India',
                       photoUrl: '',
                       speciality: row['Role'] || row['role'] || 'General',
                       stats: { matches: 0, runs: 0, wickets: 0 },
                       status: 'UNSOLD'
                   };

                   batch.set(db.collection('auctions').doc(id).collection('players').doc(newId), playerData);
                   count++;
                   
                   if(count % BATCH_SIZE === 0) { 
                       await batch.commit(); 
                       batch = db.batch(); 
                   }
               }
          }
          
          if (count % BATCH_SIZE !== 0) {
              await batch.commit();
          }
          
          alert(`Successfully imported ${count} players!`);
      } catch (err: any) { 
          console.error(err);
          alert("Import Failed: " + err.message); 
      } finally { 
          setIsImporting(false); 
          if(excelInputRef.current) excelInputRef.current.value=''; 
      }
  };

  // ... (Sponsor Logic remains same)
  const handleSaveSponsorConfig = async () => {
      if (!id) return;
      try { await db.collection('auctions').doc(id).update({ sponsorConfig }); alert("Saved!"); } catch(e) { console.error(e); }
  };

  const deleteSponsor = async (sponsorId: string) => {
      if (!id || !window.confirm("Remove sponsor?")) return;
      try { await db.collection('auctions').doc(id).collection('sponsors').doc(sponsorId).delete(); } catch (e: any) { alert(e.message); }
  };

  // --- MODALS ---
  const CategoryModal = () => {
      const [cName, setCName] = useState(editingCategory?.name || '');
      const [cBase, setCBase] = useState(editingCategory?.basePrice || 0);
      const [saving, setSaving] = useState(false);

      const save = async () => {
          if (!id || !cName) return alert("Name required");
          setSaving(true);
          try {
              const data = { name: cName, basePrice: Number(cBase) };
              if (editingCategory?.id) {
                  await db.collection('auctions').doc(id).collection('categories').doc(editingCategory.id).update(data);
              } else {
                  await db.collection('auctions').doc(id).collection('categories').add(data);
              }
              setShowCategoryModal(false);
          } catch(e: any) { alert(e.message); } finally { setSaving(false); }
      };

      return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="text-lg font-bold mb-4">{editingCategory ? 'Edit' : 'Add'} Category</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category Name</label>
                          <input className="w-full border p-2 rounded" value={cName} onChange={e => setCName(e.target.value)} placeholder="e.g. Marquee, Grade A" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base Price</label>
                          <input type="number" className="w-full border p-2 rounded" value={cBase} onChange={e => setCBase(Number(e.target.value))} />
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                      <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save</button>
                  </div>
              </div>
          </div>
      );
  };

  const RoleModal = () => {
      const [rName, setRName] = useState(editingRole?.name || '');
      const [rBase, setRBase] = useState(editingRole?.basePrice || 0);
      const [saving, setSaving] = useState(false);

      const save = async () => {
          if (!id || !rName) return alert("Name required");
          setSaving(true);
          try {
              const data = { name: rName, basePrice: Number(rBase) };
              if (editingRole?.id) {
                  await db.collection('auctions').doc(id).collection('roles').doc(editingRole.id).update(data);
              } else {
                  await db.collection('auctions').doc(id).collection('roles').add(data);
              }
              setShowRoleModal(false);
          } catch(e: any) { alert(e.message); } finally { setSaving(false); }
      };

      return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="text-lg font-bold mb-4">{editingRole ? 'Edit' : 'Add'} Player Type</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role Name</label>
                          <input className="w-full border p-2 rounded" value={rName} onChange={e => setRName(e.target.value)} placeholder="e.g. Batsman, Bowler" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Default Base Price</label>
                          <input type="number" className="w-full border p-2 rounded" value={rBase} onChange={e => setRBase(Number(e.target.value))} />
                          <p className="text-[10px] text-gray-400 mt-1">Used if player has no category.</p>
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                      <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save</button>
                  </div>
              </div>
          </div>
      );
  };

  const EditAuctionModal = () => {
      const [formData, setFormData] = useState({
          title: auction?.title || '',
          date: auction?.date || '',
          sport: auction?.sport || '',
          purseValue: auction?.purseValue || 0,
          basePrice: auction?.basePrice || 0,
          bidIncrement: auction?.bidIncrement || 0
      });
      
      const [slabs, setSlabs] = useState<BidIncrementSlab[]>(auction?.slabs || []);
      const [newSlab, setNewSlab] = useState({ from: '', increment: '' });
      const [saving, setSaving] = useState(false);

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

      const save = async () => {
          if(!id) return;
          setSaving(true);
          try {
              await db.collection('auctions').doc(id).update({
                  ...formData,
                  slabs: slabs // Include slabs update
              });
              setShowEditAuctionModal(false);
          } catch(e:any) { alert("Failed: " + e.message); }
          finally { setSaving(false); }
      };

      return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4">Edit Auction Settings</h3>
                  <div className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label><input className="w-full border p-2 rounded" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label><input type="date" className="w-full border p-2 rounded" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sport</label><input className="w-full border p-2 rounded" value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Purse</label><input type="number" className="w-full border p-2 rounded" value={formData.purseValue} onChange={e => setFormData({...formData, purseValue: Number(e.target.value)})} /></div>
                          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base</label><input type="number" className="w-full border p-2 rounded" value={formData.basePrice} onChange={e => setFormData({...formData, basePrice: Number(e.target.value)})} /></div>
                          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Def. Increment</label><input type="number" className="w-full border p-2 rounded" value={formData.bidIncrement} onChange={e => setFormData({...formData, bidIncrement: Number(e.target.value)})} /></div>
                      </div>

                      {/* SLABS SECTION */}
                      <div className="border-t pt-4 mt-2">
                          <label className="block text-sm font-bold text-gray-700 mb-2">Bid Increment Slabs</label>
                          <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-2">
                              {slabs.length > 0 ? (
                                  <div className="space-y-2 mb-3 max-h-32 overflow-y-auto custom-scrollbar">
                                      {slabs.map((slab, idx) => (
                                          <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border shadow-sm">
                                              <span>From <b>{slab.from}</b>: +<b>{slab.increment}</b></span>
                                              <button onClick={() => removeSlab(idx)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                                          </div>
                                      ))}
                                  </div>
                              ) : <p className="text-xs text-gray-400 italic mb-3">No slabs defined. Using default increment.</p>}

                              <div className="flex gap-2 items-center">
                                  <input type="number" placeholder="Price >=" className="w-full border p-2 rounded text-sm" value={newSlab.from} onChange={e => setNewSlab({...newSlab, from: e.target.value})} />
                                  <input type="number" placeholder="+ Increment" className="w-full border p-2 rounded text-sm" value={newSlab.increment} onChange={e => setNewSlab({...newSlab, increment: e.target.value})} />
                                  <button onClick={addSlab} className="bg-green-600 text-white px-3 py-2 rounded font-bold text-xs hover:bg-green-700 whitespace-nowrap shadow-sm">Add Rule</button>
                              </div>
                          </div>
                          <p className="text-[10px] text-gray-400">Example: If price &ge; 1000, increment by 500.</p>
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setShowEditAuctionModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                      <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded font-bold shadow-md">{saving ? 'Saving...' : 'Save Changes'}</button>
                  </div>
              </div>
          </div>
      );
  }

  const AddSponsorModal = () => {
      // ... (Implementation unchanged for brevity)
      const [name, setName] = useState('');
      const [image, setImage] = useState('');
      const [saving, setSaving] = useState(false);
      const ref = useRef<HTMLInputElement>(null);

      const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if(file) {
              const reader = new FileReader();
              reader.onloadend = () => setImage(reader.result as string);
              reader.readAsDataURL(file);
          }
      };

      const save = async () => {
          if(!id || !name || !image) return alert("Required");
          setSaving(true);
          try { await db.collection('auctions').doc(id).collection('sponsors').add({ name, imageUrl: image }); setShowSponsorModal(false); } catch(e:any) { alert(e.message); } finally { setSaving(false); }
      };

      return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="text-lg font-bold mb-4">Add Sponsor</h3>
                  <div className="space-y-4">
                      <div onClick={() => ref.current?.click()} className="h-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                          {image ? <img src={image} className="h-full object-contain"/> : <div className="text-center text-gray-400"><ImageIcon className="w-8 h-8 mx-auto"/><span className="text-xs">Upload Logo</span></div>}
                          <input ref={ref} type="file" className="hidden" accept="image/*" onChange={handleFile}/>
                      </div>
                      <input className="w-full border p-2 rounded" value={name} onChange={e => setName(e.target.value)} placeholder="Sponsor Name" />
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setShowSponsorModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                      <button onClick={save} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded font-bold">Add</button>
                  </div>
              </div>
          </div>
      );
  };

  const AddPlayerModal = () => {
      // ... (Implementation unchanged for brevity)
      const [pName, setPName] = useState('');
      const [pCat, setPCat] = useState('');
      const [pRole, setPRole] = useState('');
      const [pBase, setPBase] = useState(auction?.basePrice || 20);
      const [pPhoto, setPPhoto] = useState('');
      const [adding, setAdding] = useState(false);
      const photoRef = useRef<HTMLInputElement>(null);

      const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if(file) {
              const reader = new FileReader();
              reader.onloadend = () => setPPhoto(reader.result as string);
              reader.readAsDataURL(file);
          }
      };

      const add = async () => {
          if (!id || !pName || !pCat || !pRole) return alert("Please fill all fields");
          setAdding(true);
          try {
              const newId = db.collection('dummy').doc().id;
              await db.collection('auctions').doc(id).collection('players').doc(newId).set({
                  id: String(newId),
                  name: pName,
                  category: pCat,
                  role: pRole,
                  basePrice: Number(pBase),
                  nationality: 'India',
                  photoUrl: pPhoto,
                  speciality: pRole,
                  stats: { matches: 0, runs: 0, wickets: 0 },
                  status: 'UNSOLD'
              });
              setShowAddPlayerModal(false);
          } catch(e: any) {
              alert(e.message);
          } finally {
              setAdding(false);
          }
      };

      return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4">Add New Player</h3>
                  <div className="space-y-4">
                      <div className="flex justify-center mb-4">
                          <div onClick={() => photoRef.current?.click()} className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden relative">
                              {pPhoto ? <img src={pPhoto} className="w-full h-full object-cover"/> : <div className="text-gray-400 text-center"><ImageIcon className="w-8 h-8 mx-auto"/><span className="text-[10px] block">Photo</span></div>}
                              <input ref={photoRef} type="file" className="hidden" accept="image/*" onChange={handlePhoto}/>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                          <input className="w-full border p-2 rounded" value={pName} onChange={e => setPName(e.target.value)} placeholder="Full Name" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                              <select className="w-full border p-2 rounded" value={pCat} onChange={e => setPCat(e.target.value)}>
                                  <option value="">Select Category</option>
                                  {categories.length > 0 ? categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value="Standard">Standard</option>}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                              <select className="w-full border p-2 rounded" value={pRole} onChange={e => setPRole(e.target.value)}>
                                  <option value="">Select Role</option>
                                  {playerRoles.length > 0 ? playerRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>) : ['Batsman','Bowler','All Rounder','Wicket Keeper'].map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base Price</label>
                          <input type="number" className="w-full border p-2 rounded" value={pBase} onChange={e => setPBase(Number(e.target.value))} />
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setShowAddPlayerModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                      <button onClick={add} disabled={adding} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">{adding ? 'Adding...' : 'Add Player'}</button>
                  </div>
              </div>
          </div>
      );
  };

  const ExportModal = () => {
      const standardFields = [
          { id: 'fullName', label: 'Full Name' },
          { id: 'mobile', label: 'Mobile' },
          { id: 'playerType', label: 'Role' },
          { id: 'gender', label: 'Gender' },
          { id: 'dob', label: 'DOB' },
          { id: 'status', label: 'Status' },
          { id: 'submittedAt', label: 'Submitted Date' }
      ];

      // Merge Standard and Custom Fields
      const allFields = [
          ...standardFields,
          ...(regConfig.customFields?.map(f => ({ id: f.id, label: f.label })) || [])
      ];

      const [selectedFields, setSelectedFields] = useState<string[]>(allFields.map(f => f.id));

      const toggleField = (id: string) => {
          setSelectedFields(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
      };

      const handleExport = () => {
          if (registrations.length === 0) return alert("No data to export");
          
          const exportData = registrations.map(reg => {
              const row: any = {};
              selectedFields.forEach(fieldId => {
                  const fieldDef = allFields.find(f => f.id === fieldId);
                  if (!fieldDef) return;

                  let val = reg[fieldId];
                  if (fieldId === 'submittedAt' && val) {
                      val = new Date(val).toLocaleString();
                  }
                  row[fieldDef.label] = val || '';
              });
              return row;
          });

          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Registrations");
          XLSX.writeFile(wb, `${auction?.title || 'Auction'}_Registrations.xlsx`);
          setShowExportModal(false);
      };

      return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="text-lg font-bold mb-4">Export Options</h3>
                  <p className="text-xs text-gray-500 mb-4">Select the fields you want to include in the Excel file.</p>
                  
                  <div className="max-h-60 overflow-y-auto border rounded p-2 mb-4 space-y-2 custom-scrollbar">
                      {allFields.map(field => (
                          <label key={field.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                              <input 
                                  type="checkbox" 
                                  checked={selectedFields.includes(field.id)}
                                  onChange={() => toggleField(field.id)}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{field.label}</span>
                          </label>
                      ))}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                      <div className="space-x-2">
                          <button onClick={() => setSelectedFields(allFields.map(f => f.id))} className="text-xs text-blue-600 hover:underline">Select All</button>
                          <button onClick={() => setSelectedFields([])} className="text-xs text-gray-500 hover:underline">Clear</button>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => setShowExportModal(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                          <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-bold flex items-center">
                              <Download className="w-4 h-4 mr-2"/> Download
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
            <div className="container mx-auto px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-700"><ArrowLeft /></button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-gray-700">{loading ? 'Loading...' : auction?.title}</h1>
                            <button onClick={() => setShowEditAuctionModal(true)} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors">
                                <Edit className="w-3 h-3" /> Edit Settings
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">{auction?.sport} • {auction?.date}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => copyOBSLink('transparent')} className="bg-purple-50 text-purple-600 border border-purple-200 font-bold py-1.5 px-3 rounded text-sm flex items-center"><Cast className="w-4 h-4 mr-2"/> Overlay</button>
                    <button onClick={() => copyOBSLink('green')} className="bg-green-50 text-green-600 border border-green-200 font-bold py-1.5 px-3 rounded text-sm flex items-center"><Monitor className="w-4 h-4 mr-2"/> Chroma</button>
                </div>
            </div>
        </header>

        <div className="bg-white border-b border-gray-200 sticky top-[60px] z-10 shadow-sm">
            <div className="container mx-auto px-6 flex gap-6 overflow-x-auto">
                <button onClick={() => setActiveTab('teams')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'teams' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>Teams</button>
                <button onClick={() => setActiveTab('types')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'types' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>Player Types</button>
                <button onClick={() => setActiveTab('categories')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'categories' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>Categories</button>
                <button onClick={() => setActiveTab('pool')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'pool' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>Player Pool ({poolPlayers.length})</button>
                <button onClick={() => setActiveTab('sponsors')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'sponsors' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>Sponsors</button>
                <button onClick={() => setActiveTab('registration')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'registration' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>Reg. Form</button>
                <button onClick={() => setActiveTab('registrations')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'registrations' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>Requests ({registrations.length})</button>
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
                                        <div><h3 className="font-bold text-gray-800">{team.name}</h3><span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{team.id}</span></div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleDeleteTeam(team.id.toString())} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                    <div><p className="text-xs text-gray-400">Purse</p><p className="font-semibold">{team.budget}</p></div>
                                    <div><p className="text-xs text-gray-400">Players</p><p className="font-semibold">{team.players.length} / {team.maxPlayers}</p></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PLAYER TYPES (ROLES) TAB */}
            {activeTab === 'types' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Player Types (Roles)</h2>
                        <button onClick={() => { setEditingRole(null); setShowRoleModal(true); }} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow flex items-center">
                            <Plus className="w-4 h-4 mr-2" /> Add Type
                        </button>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6 flex items-start gap-3">
                        <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                            <p className="font-bold mb-1">How Player Types Work:</p>
                            <p>Define roles here (e.g. Batsman, Bowler). These options will appear in the registration form for players to select. You can also set a specific Base Price for each role.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {playerRoles.map(role => (
                            <div key={role.id} className="bg-white border rounded-lg p-4 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <h4 className="font-bold text-gray-800">{role.name}</h4>
                                    <p className="text-xs text-gray-500">Base Price: <span className="font-mono font-bold text-green-600">{role.basePrice}</span></p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingRole(role); setShowRoleModal(true); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded"><Edit className="w-4 h-4"/></button>
                                    <button onClick={() => handleDeleteRole(role.id!)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                        {playerRoles.length === 0 && <div className="col-span-full text-center text-gray-400 py-8 italic border-2 border-dashed border-gray-200 rounded-lg">No player types defined. Players will see default options.</div>}
                    </div>
                </div>
            )}

            {/* CATEGORIES TAB */}
            {activeTab === 'categories' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Categories Manager</h2>
                        <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow flex items-center">
                            <Plus className="w-4 h-4 mr-2" /> Add Category
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {categories.map(cat => (
                            <div key={cat.id} className="bg-white border rounded-lg p-4 flex justify-between items-center shadow-sm">
                                <div>
                                    <h4 className="font-bold text-gray-800">{cat.name}</h4>
                                    <p className="text-xs text-gray-500">Base Price: <span className="font-mono font-bold text-green-600">{cat.basePrice}</span></p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded"><Edit className="w-4 h-4"/></button>
                                    <button onClick={() => handleDeleteCategory(cat.id!)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                        {categories.length === 0 && <div className="col-span-full text-center text-gray-400 py-8 italic">No categories defined.</div>}
                    </div>
                </div>
            )}

            {/* REGISTRATION FORM CONFIG TAB */}
            {activeTab === 'registration' && (
                <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Form Configuration</h2>
                        <button onClick={copyRegLink} className="text-blue-600 text-sm font-bold hover:underline">Copy Public Link</button>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> Player Name, Role, Mobile Number, Gender, DOB, and Profile Picture are collected by default. You do not need to add these fields manually. Use the section below to add <em>additional</em> fields (e.g. Jersey Size, Address).
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-green-600"
                                    checked={regConfig.isEnabled} 
                                    onChange={(e) => setRegConfig({...regConfig, isEnabled: e.target.checked})} 
                                />
                                <span className="font-bold text-gray-700">Enable Registration Form</span>
                            </label>
                        </div>

                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-blue-600"
                                    checked={regConfig.includePayment} 
                                    onChange={(e) => setRegConfig({...regConfig, includePayment: e.target.checked})} 
                                />
                                <span className="font-bold text-gray-700">Enable Payment Collection</span>
                            </label>
                        </div>

                        {regConfig.includePayment && (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3 animate-fade-in">
                                <h3 className="font-bold text-sm text-gray-600 uppercase">Payment Details</h3>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Registration Fee (₹)</label>
                                    <input type="number" className="w-full border p-2 rounded" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">UPI Name</label>
                                        <input type="text" className="w-full border p-2 rounded" value={regConfig.upiName} onChange={e => setRegConfig({...regConfig, upiName: e.target.value})} placeholder="e.g. John Doe" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">UPI ID</label>
                                        <input type="text" className="w-full border p-2 rounded" value={regConfig.upiId} onChange={e => setRegConfig({...regConfig, upiId: e.target.value})} placeholder="e.g. 9876543210@upi" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CUSTOM FIELDS SECTION */}
                        <div className="mt-4 border-t pt-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                                <List className="w-4 h-4 mr-2 text-gray-600"/> Additional Fields
                            </h3>
                            
                            {/* Existing Fields List */}
                            <div className="space-y-3 mb-6">
                                {regConfig.customFields && regConfig.customFields.length > 0 ? (
                                    regConfig.customFields.map((field) => (
                                        <div key={field.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 shadow-sm">
                                            <div>
                                                <p className="font-bold text-sm text-gray-800">{field.label}</p>
                                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                                    {field.type} {field.required && <span className="text-red-500 ml-1">(Required)</span>}
                                                </p>
                                                {field.type === 'select' && field.options && (
                                                    <p className="text-xs text-gray-400 truncate max-w-[200px] mt-0.5">Opt: {field.options.join(', ')}</p>
                                                )}
                                            </div>
                                            <button onClick={() => handleDeleteCustomField(field.id)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-sm text-gray-400 py-2 border-2 border-dashed border-gray-200 rounded">
                                        No custom fields added yet.
                                    </div>
                                )}
                            </div>

                            {/* Add Field Form */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h4 className="text-xs font-bold text-blue-800 uppercase mb-3">Add New Field</h4>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Field Label</label>
                                            <input 
                                                type="text" 
                                                className="w-full border p-2 rounded text-sm" 
                                                placeholder="e.g. Jersey Size"
                                                value={newField.label}
                                                onChange={(e) => setNewField({...newField, label: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Field Type</label>
                                            <select 
                                                className="w-full border p-2 rounded text-sm bg-white"
                                                value={newField.type}
                                                onChange={(e) => setNewField({...newField, type: e.target.value as FieldType})}
                                            >
                                                <option value="text">Text Input</option>
                                                <option value="number">Number Input</option>
                                                <option value="select">Dropdown Selection</option>
                                                <option value="date">Date Picker</option>
                                                <option value="file">File Upload</option>
                                            </select>
                                        </div>
                                    </div>

                                    {newField.type === 'select' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Options (Comma separated)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border p-2 rounded text-sm" 
                                                placeholder="e.g. Small, Medium, Large, XL"
                                                value={newField.options}
                                                onChange={(e) => setNewField({...newField, options: e.target.value})}
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2">
                                        <label className="flex items-center text-sm text-gray-700 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                className="mr-2 accent-blue-600 w-4 h-4"
                                                checked={newField.required}
                                                onChange={(e) => setNewField({...newField, required: e.target.checked})}
                                            />
                                            Mark as Required
                                        </label>
                                        <button 
                                            onClick={handleAddCustomField}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow transition-all active:scale-95"
                                        >
                                            + Add Field
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Terms & Conditions</label>
                            <textarea className="w-full border p-2 rounded h-24 text-sm" value={regConfig.terms} onChange={e => setRegConfig({...regConfig, terms: e.target.value})} />
                        </div>

                        <div className="pt-4 border-t">
                            <button 
                                onClick={handleSaveRegConfig} 
                                disabled={isSavingConfig}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded shadow transition-all flex items-center justify-center"
                            >
                                {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>} Save Configuration
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REGISTRATIONS TAB (REQUESTS) */}
            {activeTab === 'registrations' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800">Pending Requests</h2>
                        <button 
                            onClick={() => setShowExportModal(true)} 
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-3 rounded shadow flex items-center"
                        >
                            <Download className="w-4 h-4 mr-2" /> Export Excel
                        </button>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        {registrations.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 italic">No registration requests yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold">
                                        <tr>
                                            <th className="p-4">Photo</th>
                                            <th className="p-4">Name</th>
                                            <th className="p-4">Role</th>
                                            <th className="p-4">Mobile</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {registrations.map(reg => (
                                            <React.Fragment key={reg.id}>
                                                <tr className="hover:bg-gray-50">
                                                    <td className="p-4"><img src={reg.profilePic} className="w-10 h-10 rounded-full object-cover border"/></td>
                                                    <td className="p-4 font-bold text-gray-800">{reg.fullName}</td>
                                                    <td className="p-4 text-sm">{reg.playerType}</td>
                                                    <td className="p-4 text-sm font-mono">{reg.mobile}</td>
                                                    <td className="p-4">
                                                        <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${reg.status === 'APPROVED' ? 'bg-green-100 text-green-700' : reg.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                            {reg.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {reg.status === 'PENDING' && (
                                                            <div className="flex justify-end gap-2">
                                                                <button 
                                                                    onClick={() => setSelectedRegistration(selectedRegistration?.id === reg.id ? null : reg)} 
                                                                    className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${selectedRegistration?.id === reg.id ? 'bg-gray-200 text-gray-800 border-gray-300' : 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200'}`}
                                                                >
                                                                    {selectedRegistration?.id === reg.id ? 'Close' : 'Review'}
                                                                </button>
                                                                <button onClick={() => handleRejectPlayer(reg.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4"/></button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                {/* INLINE APPROVAL FORM */}
                                                {selectedRegistration?.id === reg.id && (
                                                    <tr className="bg-blue-50/30 animate-fade-in border-b-2 border-blue-100">
                                                        <td colSpan={6} className="p-4">
                                                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                                                <div className="flex-1 space-y-1">
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500">Confirm Name</label>
                                                                    <input 
                                                                        className="w-full border p-2 rounded text-sm" 
                                                                        value={approveName} 
                                                                        onChange={e => setApproveName(e.target.value)} 
                                                                    />
                                                                </div>
                                                                <div className="flex-1 space-y-1">
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500">Assign Role</label>
                                                                    <select 
                                                                        className="w-full border p-2 rounded text-sm" 
                                                                        value={approveRole} 
                                                                        onChange={e => setApproveRole(e.target.value)}
                                                                    >
                                                                        <option value="">Select Role</option>
                                                                        {playerRoles.length > 0 ? playerRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>) : ['Batsman','Bowler','All Rounder','Wicket Keeper'].map(r => <option key={r} value={r}>{r}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div className="flex-1 space-y-1">
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500">Assign Category</label>
                                                                    <select 
                                                                        className="w-full border p-2 rounded text-sm" 
                                                                        value={approveCategory} 
                                                                        onChange={e => setApproveCategory(e.target.value)}
                                                                    >
                                                                        <option value="">Select Category</option>
                                                                        {categories.length > 0 ? categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value="Standard">Standard</option>}
                                                                    </select>
                                                                </div>
                                                                <div className="w-32 space-y-1">
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500">Base Price</label>
                                                                    <input 
                                                                        type="number" 
                                                                        className="w-full border p-2 rounded text-sm" 
                                                                        value={approveBase} 
                                                                        onChange={e => setApproveBase(Number(e.target.value))} 
                                                                    />
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleApprovePlayer(reg)} 
                                                                    disabled={isApproving} 
                                                                    className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center hover:bg-green-700 disabled:opacity-50"
                                                                >
                                                                    {isApproving ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4 mr-1"/>} Approve
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Other tabs omitted for brevity but logic persists */}
            {activeTab === 'pool' && (
                <div>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <h2 className="text-lg font-bold text-gray-800">Player Pool</h2>
                        <div className="flex flex-wrap gap-2">
                             <div className="relative">
                                 <button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded shadow text-sm flex items-center">
                                     {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <FileSpreadsheet className="w-4 h-4 mr-2"/>} Import Excel
                                 </button>
                                 <input ref={excelInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport}/>
                             </div>
                             <button onClick={() => setShowAddPlayerModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded shadow text-sm flex items-center"><UserPlus className="w-4 h-4 mr-2"/> Add Player</button>
                             <button onClick={handleClearPool} disabled={isDeleting} className="bg-red-50 text-red-600 border border-red-200 font-bold py-2 px-3 rounded hover:bg-red-100 text-sm flex items-center"><Trash2 className="w-4 h-4 mr-2"/> Clear Pool</button>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left">
                             <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold">
                                <tr><th className="p-4">Photo</th><th className="p-4">Name</th><th className="p-4">Category</th><th className="p-4">Role</th><th className="p-4">Base Price</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {poolPlayers.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="p-4"><img src={p.photoUrl} className="w-10 h-10 rounded-full bg-gray-100 object-cover border"/></td>
                                        <td className="p-4 font-bold text-gray-800">{p.name}</td>
                                        <td className="p-4"><span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold">{p.category}</span></td>
                                        <td className="p-4"><span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold uppercase">{p.role}</span></td>
                                        <td className="p-4 font-mono">{p.basePrice}</td>
                                        <td className="p-4">
                                            {p.status === 'SOLD' ? <span className="text-green-600 font-bold text-xs uppercase">Sold ({p.soldPrice})</span> : <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${p.status === 'UNSOLD' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{p.status || 'OPEN'}</span>}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleDeletePoolPlayer(p.id.toString())} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SPONSORS TAB */}
            {activeTab === 'sponsors' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Sponsors Manager</h2>
                        <button onClick={() => setShowSponsorModal(true)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow flex items-center">
                            <Plus className="w-4 h-4 mr-2" /> Add Sponsor
                        </button>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                        <h3 className="font-bold text-gray-700 mb-2">Display Settings</h3>
                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={sponsorConfig.showOnProjector} onChange={e => setSponsorConfig({...sponsorConfig, showOnProjector: e.target.checked})} />
                                <span className="text-sm">Show on Projector</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={sponsorConfig.showOnOBS} onChange={e => setSponsorConfig({...sponsorConfig, showOnOBS: e.target.checked})} />
                                <span className="text-sm">Show on OBS</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">Loop Interval (sec):</span>
                                <input type="number" className="border w-16 p-1 rounded" value={sponsorConfig.loopInterval} onChange={e => setSponsorConfig({...sponsorConfig, loopInterval: Number(e.target.value)})} />
                            </div>
                            <button onClick={handleSaveSponsorConfig} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">Save Config</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {sponsors.map(sponsor => (
                            <div key={sponsor.id} className="bg-white border rounded-lg p-4 relative group">
                                <div className="h-24 flex items-center justify-center mb-2">
                                    <img src={sponsor.imageUrl} className="max-h-full max-w-full object-contain" />
                                </div>
                                <p className="text-center font-bold text-sm truncate">{sponsor.name}</p>
                                <button onClick={() => deleteSponsor(sponsor.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        ))}
                        {sponsors.length === 0 && <div className="col-span-full text-center text-gray-400 py-8 italic">No sponsors added yet.</div>}
                    </div>
                </div>
            )}
        </main>

        {showTeamModal && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div className="bg-white p-6 rounded text-center"><p>Use Dashboard to add teams easily.</p><button onClick={() => setShowTeamModal(false)} className="mt-2 px-4 py-2 bg-gray-200 rounded">Close</button></div></div>}
        {showCategoryModal && <CategoryModal />}
        {showRoleModal && <RoleModal />}
        {showAddPlayerModal && <AddPlayerModal />}
        {showEditAuctionModal && <EditAuctionModal />}
        {showSponsorModal && <AddSponsorModal />}
        {showExportModal && <ExportModal />}
    </div>
  );
};

export default AuctionManage;
