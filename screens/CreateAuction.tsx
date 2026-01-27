import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Added RefreshCw to the imports from lucide-react
import { ArrowLeft, Calendar, Upload, CheckCircle, AlertTriangle, Plus, Trash2, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { AuctionSetup, BidIncrementSlab } from '../types';
import { useAuction } from '../hooks/useAuction';

const CreateAuction: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuction();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
      sport: '',
      title: '',
      date: '',
      plan: '',
      totalTeams: 2,
      purseValue: 10000,
      basePrice: 20,
      bidIncrement: 10,
      playersPerTeam: 15
  });

  // Fetch available plans from DB to show as chips
  useEffect(() => {
      const unsub = db.collection('subscriptionPlans').orderBy('price', 'asc').onSnapshot(snap => {
          if (snap.empty) {
              setDbPlans([
                  { id: 'Free', name: 'Free (Demo)' },
                  { id: 'Basic', name: 'Basic' },
                  { id: 'Premium', name: 'Premium' }
              ]);
          } else {
              setDbPlans(snap.docs.map(d => ({ id: d.data().name, ...d.data() })));
          }
      });
      return () => unsub();
  }, []);

  // Global Slabs State
  const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);
  const [newSlab, setNewSlab] = useState<{from: string, increment: string}>({from: '', increment: ''});

  // File State
  const [logoName, setLogoName] = useState<string>("");
  const [bannerName, setBannerName] = useState<string>("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Captcha State
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (file.size > 800 * 1024) { // 800KB Limit
             alert("File too large. Please select an image under 800KB.");
             return;
          }
          if (type === 'logo') setLogoName(file.name);
          else setBannerName(file.name);
      }
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg(null);
      
      if (captchaInput.toLowerCase() !== 'jgmuj') {
          setCaptchaError(true);
          return;
      }

      if (!formData.sport) return alert("Please select a sport.");
      if (!formData.plan) return alert("Please select a subscription plan.");

      setLoading(true);
      try {
          const uid = userProfile?.uid || 'unknown_user';
          const newAuction: AuctionSetup = {
              title: formData.title,
              sport: formData.sport,
              date: formData.date,
              plan: formData.plan,
              totalTeams: Number(formData.totalTeams),
              purseValue: Number(formData.purseValue),
              basePrice: Number(formData.basePrice),
              bidIncrement: Number(formData.bidIncrement),
              playersPerTeam: Number(formData.playersPerTeam),
              slabs: slabs,
              status: 'DRAFT',
              createdAt: Date.now(),
              createdBy: uid
          };
          await db.collection('auctions').add(newAuction);
          setShowSuccessModal(true);
      } catch (error: any) {
          setErrorMsg(`Failed to save: ${error.message}`);
      } finally {
          setLoading(false);
      }
  };

  const handleNavigateDashboard = () => {
      navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 relative">
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all scale-100">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Auction Created!</h2>
                <p className="text-gray-600 mb-8">
                    <span className="font-semibold text-gray-900">{formData.title}</span> has been successfully saved.
                </p>
                <button 
                    onClick={handleNavigateDashboard}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform hover:scale-105"
                >
                    Go to Dashboard
                </button>
            </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="container mx-auto px-6 py-3 flex items-center">
             <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-800 mr-4 transition-colors">
                 <ArrowLeft />
             </button>
             <h1 className="text-xl font-bold text-gray-700 uppercase tracking-tighter">Initialize New Protocol</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
        <div className="bg-white rounded-2xl shadow p-6 md:p-8 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Auction Registry</h2>
            <p className="text-sm text-gray-500 mb-6 pb-4 border-b border-gray-100">
                Configure the technical parameters for your tournament's real-time auction room.
            </p>
            
            {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-6 flex items-start gap-2 animate-pulse">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{errorMsg}</span>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Sport Selection (Inline Chips) */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">1. Select Tournament Protocol (Sport) <span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-2">
                        {['Cricket', 'Football', 'Kabaddi'].map(s => (
                            <button 
                                key={s} 
                                type="button"
                                onClick={() => setFormData({...formData, sport: s})}
                                className={`px-6 py-3 rounded-xl text-xs font-black uppercase transition-all border-2 ${formData.sport === s ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-[1.02]' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Title */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">2. Identity Title <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        name="title" 
                        required
                        placeholder="E.G. IPL 2025 MOCK AUCTION"
                        value={formData.title}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all uppercase placeholder:opacity-30"
                    />
                </div>

                {/* Date */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">3. Activation Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input 
                            type="date" 
                            name="date" 
                            required
                            value={formData.date}
                            onChange={handleChange}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        />
                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Plan Selection (Inline Chips) */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">4. Operational Plan <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {dbPlans.map(plan => (
                            <button 
                                key={plan.id} 
                                type="button"
                                onClick={() => setFormData({...formData, plan: plan.id})}
                                className={`px-4 py-3 rounded-xl text-xs font-black uppercase transition-all border-2 text-center flex flex-col ${formData.plan === plan.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                            >
                                <span>{plan.name}</span>
                                {plan.teams && <span className="text-[8px] opacity-60 mt-1">UP TO {plan.teams} TEAMS</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Number Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-2">Total Franchise Teams</label>
                        <input type="number" name="totalTeams" min="2" required value={formData.totalTeams} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-2 px-4 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-2">Players per Squad</label>
                        <input type="number" name="playersPerTeam" required value={formData.playersPerTeam} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-2 px-4 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-2">Starting Team Purse</label>
                        <input type="number" name="purseValue" required value={formData.purseValue} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-2 px-4 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-2">Default Base Unit Price</label>
                        <input type="number" name="basePrice" required value={formData.basePrice} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-2 px-4 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                    </div>
                </div>

                {/* Bid Increment & Slabs */}
                <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100">
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4"/> Bid Increment Protocol
                    </h3>
                    
                    <div className="mb-6">
                        <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Standard Step Increment <span className="text-red-500">*</span></label>
                        <input 
                            type="number" 
                            name="bidIncrement" 
                            required
                            value={formData.bidIncrement}
                            onChange={handleChange}
                            className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:border-blue-500"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase mb-2">Dynamic Bid Slabs (Optional)</label>
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
                             {slabs.map((slab, idx) => (
                                 <div key={idx} className="flex justify-between items-center text-xs font-bold bg-gray-50 p-3 rounded-xl border border-gray-100 animate-slide-up">
                                     <span className="text-gray-600">From <b className="text-blue-600">{slab.from}</b>: Step <b className="text-emerald-600">+{slab.increment}</b></span>
                                     <button type="button" onClick={() => removeSlab(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                                         <Trash2 className="w-4 h-4"/>
                                     </button>
                                 </div>
                             ))}
                             
                             <div className="grid grid-cols-2 gap-3 pt-2">
                                 <div className="space-y-1">
                                     <span className="text-[8px] font-bold text-gray-400 uppercase px-1">When Price {'>='}</span>
                                     <input type="number" placeholder="500" className="w-full border border-gray-100 bg-gray-50 rounded-xl p-2 text-xs font-bold outline-none focus:border-blue-300" value={newSlab.from} onChange={e => setNewSlab({...newSlab, from: e.target.value})} />
                                 </div>
                                 <div className="space-y-1">
                                     <span className="text-[8px] font-bold text-gray-400 uppercase px-1">Step Amount</span>
                                     <input type="number" placeholder="100" className="w-full border border-gray-100 bg-gray-50 rounded-xl p-2 text-xs font-bold outline-none focus:border-blue-300" value={newSlab.increment} onChange={e => setNewSlab({...newSlab, increment: e.target.value})} />
                                 </div>
                             </div>
                             <button type="button" onClick={addSlab} className="mt-4 w-full py-3 bg-blue-600 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">
                                 Authorize Slab Rule
                             </button>
                        </div>
                    </div>
                </div>

                {/* Captcha */}
                <div className="bg-gray-100 p-8 rounded-[2rem] border border-gray-200">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Security Verification <span className="text-red-500">*</span></label>
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="w-full sm:w-48 h-16 bg-white select-none flex items-center justify-center font-mono text-3xl tracking-widest text-gray-400 line-through italic border border-gray-200 rounded-2xl relative overflow-hidden shadow-inner">
                             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                             jgmuj
                        </div>
                        <input 
                            type="text" 
                            required
                            value={captchaInput}
                            onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
                            className={`flex-1 w-full bg-white border-2 ${captchaError ? 'border-red-500' : 'border-transparent'} rounded-2xl py-4 px-6 font-black uppercase text-center outline-none focus:ring-4 ring-blue-500/10 transition-all`}
                            placeholder="RETYPE STRING"
                        />
                    </div>
                </div>

                <div className="pt-6">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full bg-black hover:bg-blue-700 text-white font-black py-5 px-10 rounded-[2rem] shadow-2xl transition-all active:scale-95 uppercase tracking-[0.3em] text-sm flex items-center justify-center gap-3 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? <RefreshCw className="animate-spin h-5 w-5"/> : <CheckCircle className="h-5 w-5"/>}
                        Deploy Auction Protocol
                    </button>
                </div>

            </form>
        </div>
      </main>
    </div>
  );
};

export default CreateAuction;