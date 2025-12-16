import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuction } from '../hooks/useAuction';
import { ArrowLeft, Plus, Trash2, Edit, Save, List, Users, Settings } from 'lucide-react';
import { AuctionSetup } from '../types';

const AuctionManage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { userProfile } = useAuction();
    const [auction, setAuction] = useState<AuctionSetup | null>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'DETAILS' | 'CATEGORIES' | 'TEAMS'>('DETAILS');
    
    // Category Modal State
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);

    useEffect(() => {
        if (!id) return;
        const unsub = db.collection('auctions').doc(id).onSnapshot(doc => {
            if(doc.exists) setAuction({ id: doc.id, ...doc.data() } as AuctionSetup);
        });
        const unsubCat = db.collection('auctions').doc(id).collection('categories').onSnapshot(snap => {
            setCategories(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        const unsubTeams = db.collection('auctions').doc(id).collection('teams').onSnapshot(snap => {
            setTeams(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return () => { unsub(); unsubCat(); unsubTeams(); };
    }, [id]);

    const CategoryModal = () => {
        const [cName, setCName] = useState(editingCategory?.name || '');
        const [cBase, setCBase] = useState(editingCategory?.basePrice || 0);
        const [cMax, setCMax] = useState(editingCategory?.maxPerTeam || 0);
        const [saving, setSaving] = useState(false);
  
        const save = async () => {
            if (!id || !cName) return alert("Name required");
            setSaving(true);
            try {
                const data = { 
                    name: cName, 
                    basePrice: Number(cBase),
                    maxPerTeam: Number(cMax)
                };
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
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base Price</label>
                                <input type="number" className="w-full border p-2 rounded" value={cBase} onChange={e => setCBase(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max Per Team</label>
                                <input 
                                    type="number" 
                                    className="w-full border p-2 rounded" 
                                    value={cMax} 
                                    onChange={e => setCMax(Number(e.target.value))} 
                                    placeholder="0 = No Limit"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400">Set "Max Per Team" to 0 for unlimited players in this category.</p>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                        <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save</button>
                    </div>
                </div>
            </div>
        );
    };

    const deleteCategory = async (catId: string) => {
        if(window.confirm("Delete category?")) {
            await db.collection('auctions').doc(id).collection('categories').doc(catId).delete();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans p-6">
            <button onClick={() => navigate('/admin')} className="mb-6 flex items-center text-gray-500 hover:text-gray-800">
                <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
            </button>
            
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Manage Auction: {auction?.title}</h1>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="flex border-b">
                    <button 
                        onClick={() => setActiveTab('DETAILS')} 
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center ${activeTab === 'DETAILS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                    >
                        <Settings className="w-4 h-4 mr-2"/> Details
                    </button>
                    <button 
                        onClick={() => setActiveTab('CATEGORIES')} 
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center ${activeTab === 'CATEGORIES' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                    >
                        <List className="w-4 h-4 mr-2"/> Categories
                    </button>
                    <button 
                        onClick={() => setActiveTab('TEAMS')} 
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center ${activeTab === 'TEAMS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                    >
                        <Users className="w-4 h-4 mr-2"/> Teams
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'DETAILS' && (
                        <div>
                            <p className="text-gray-600">Basic auction details view (Sport, Date, Title etc.). Use the "Edit" button on dashboard to change these.</p>
                            {/* Add form fields here to edit basic details if needed */}
                        </div>
                    )}

                    {activeTab === 'CATEGORIES' && (
                        <div>
                            <div className="flex justify-between mb-4">
                                <h3 className="font-bold text-lg">Player Categories</h3>
                                <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center">
                                    <Plus className="w-4 h-4 mr-1"/> Add Category
                                </button>
                            </div>
                            <div className="space-y-2">
                                {categories.map(cat => (
                                    <div key={cat.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border">
                                        <div>
                                            <span className="font-bold block">{cat.name}</span>
                                            <span className="text-xs text-gray-500">Base: {cat.basePrice} | Max: {cat.maxPerTeam > 0 ? cat.maxPerTeam : 'Unlimited'}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }} className="text-blue-500 p-1"><Edit className="w-4 h-4"/></button>
                                            <button onClick={() => deleteCategory(cat.id)} className="text-red-500 p-1"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'TEAMS' && (
                         <div>
                             <h3 className="font-bold text-lg mb-4">Registered Teams</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {teams.map(t => (
                                     <div key={t.id} className="border p-3 rounded flex items-center gap-3">
                                         <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold">{t.name.charAt(0)}</div>
                                         <div>
                                             <p className="font-bold">{t.name}</p>
                                             <p className="text-xs text-gray-500">Purse: {t.budget}</p>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                    )}
                </div>
            </div>
            
            {showCategoryModal && <CategoryModal />}
        </div>
    );
};

export default AuctionManage;
