
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Upload, CheckCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { AuctionSetup, BidIncrementSlab } from '../types';
import { useAuction } from '../hooks/useAuction';

const CreateAuction: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuction();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
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

  // Global Slabs State
  const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);
  const [newSlab, setNewSlab] = useState<{from: string, increment: string}>({from: '', increment: ''});

  // File State (Mocking upload for UI feedback)
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

      setLoading(true);
      try {
          // Fallback if userProfile is not loaded yet
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
              slabs: slabs, // Include slabs
              status: 'DRAFT',
              createdAt: Date.now(),
              createdBy: uid
          };

          console.log("Attempting to save auction:", newAuction);
          // COMPAT SYNTAX FIX
          const docRef = await db.collection('auctions').add(newAuction);
          console.log("Auction Saved Successfully with ID:", docRef.id);
          
          setShowSuccessModal(true);
      } catch (error: any) {
          console.error("Error creating auction:", error);
          let msg = "Failed to save to database.";
          
          if (error.code === 'permission-denied') msg = "Permission Denied: You do not have rights to create auctions. Check Rules.";
          else if (error.code === 'unavailable') msg = "Network unavailable. Please check your connection.";
          else if (error.message.includes("does not exist")) msg = "CRITICAL: Database not found. Please create it in Firebase Console.";
          
          setErrorMsg(`${msg} (${error.message})`);
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
             <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-800 mr-4">
                 <ArrowLeft />
             </button>
             <h1 className="text-xl font-bold text-gray-700">New Auction</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow p-6 md:p-8 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Auction Info</h2>
            <p className="text-sm text-gray-500 mb-6 pb-4 border-b border-gray-100">
                Fill in the details below to initialize your auction event.
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

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sport */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select a sport <span className="text-red-500">*</span></label>
                    <select 
                        name="sport" 
                        required 
                        value={formData.sport} 
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="">Select an option</option>
                        <option value="Cricket">Cricket</option>
                        <option value="Football">Football</option>
                        <option value="Kabaddi">Kabaddi</option>
                    </select>
                </div>

                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auction title <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        name="title" 
                        required
                        value={formData.title}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                        <span>Auction Date <span className="text-red-500">*</span></span>
                        <span className="text-gray-400 font-normal text-xs">select tentative date if not confirm</span>
                    </label>
                    <div className="relative">
                        <input 
                            type="date" 
                            name="date" 
                            required
                            value={formData.date}
                            onChange={handleChange}
                            className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Plan */}
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                        <span>Select a Plan <span className="text-red-500">*</span></span>
                    </label>
                    <select 
                        name="plan" 
                        required
                        value={formData.plan}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <option value="">Select an option</option>
                        <option value="Free">Free (Demo)</option>
                        <option value="Basic">Basic</option>
                        <option value="Premium">Premium</option>
                    </select>
                </div>

                {/* Total Teams */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total teams <span className="text-red-500">*</span></label>
                    <input 
                        type="number" 
                        name="totalTeams" 
                        min="2"
                        required
                        value={formData.totalTeams}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* File Uploads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Logo Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                            <span>Logo</span>
                            <span className="text-gray-400 text-xs">Size : 500 x 500 pixel</span>
                        </label>
                        <div 
                            onClick={() => logoInputRef.current?.click()}
                            className="border border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer min-h-[100px]"
                        >
                             <input 
                                ref={logoInputRef} 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleFileChange(e, 'logo')}
                             />
                             {logoName ? (
                                 <div className="flex flex-col items-center text-green-600">
                                    <p className="text-sm font-medium break-all">{logoName}</p>
                                    <p className="text-xs mt-1 text-gray-400">Click to change</p>
                                 </div>
                             ) : (
                                 <>
                                    <Upload className="h-6 w-6 mb-2 text-gray-300"/>
                                    <p className="text-xs text-center">Drag & Drop your files or <span className="underline text-gray-700">Browse</span></p>
                                 </>
                             )}
                        </div>
                    </div>

                    {/* Banner Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Banner</label>
                        <div 
                             onClick={() => bannerInputRef.current?.click()}
                             className="border border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer min-h-[100px]"
                        >
                             <input 
                                ref={bannerInputRef} 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleFileChange(e, 'banner')}
                             />
                             {bannerName ? (
                                 <div className="flex flex-col items-center text-green-600">
                                    <p className="text-sm font-medium break-all">{bannerName}</p>
                                    <p className="text-xs mt-1 text-gray-400">Click to change</p>
                                 </div>
                             ) : (
                                 <>
                                    <Upload className="h-6 w-6 mb-2 text-gray-300"/>
                                    <p className="text-xs text-center">Drag & Drop your files or <span className="underline text-gray-700">Browse</span></p>
                                 </>
                             )}
                        </div>
                    </div>
                </div>

                {/* Default Team Purse */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default team purse value <span className="text-red-500">*</span></label>
                    <input 
                        type="number" 
                        name="purseValue" 
                        required
                        value={formData.purseValue}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* Player Base Price */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Player base price <span className="text-red-500">*</span></label>
                    <input 
                        type="number" 
                        name="basePrice" 
                        required
                        value={formData.basePrice}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* Bid Increment & Slabs */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bid Rules</label>
                    
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Default Bid Increment <span className="text-red-500">*</span></label>
                        <input 
                            type="number" 
                            name="bidIncrement" 
                            required
                            value={formData.bidIncrement}
                            onChange={handleChange}
                            className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2">Global Bid Slabs (Optional)</label>
                        <div className="bg-white p-3 rounded border border-gray-300">
                             {slabs.map((slab, idx) => (
                                 <div key={idx} className="flex justify-between items-center text-sm mb-2 bg-gray-50 p-2 rounded">
                                     <span>From <b>{slab.from}</b>: Increase by <b>+{slab.increment}</b></span>
                                     <button type="button" onClick={() => removeSlab(idx)} className="text-red-500 hover:text-red-700">
                                         <Trash2 className="w-4 h-4"/>
                                     </button>
                                 </div>
                             ))}
                             
                             <div className="grid grid-cols-2 gap-2 mt-2">
                                 <input 
                                    type="number" 
                                    placeholder="Price >=" 
                                    className="border p-2 rounded text-sm" 
                                    value={newSlab.from} 
                                    onChange={e => setNewSlab({...newSlab, from: e.target.value})} 
                                 />
                                 <input 
                                    type="number" 
                                    placeholder="+ Increment" 
                                    className="border p-2 rounded text-sm" 
                                    value={newSlab.increment} 
                                    onChange={e => setNewSlab({...newSlab, increment: e.target.value})} 
                                 />
                             </div>
                             <button type="button" onClick={addSlab} className="mt-2 w-full py-2 bg-green-50 border border-green-200 text-green-700 text-sm font-bold rounded hover:bg-green-100 flex items-center justify-center">
                                 <Plus className="w-3 h-3 mr-1"/> Add Slab Rule
                             </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">E.g. If current bid is 500, and you have a slab "From 500: +50", next bid will be 550.</p>
                    </div>
                </div>

                 {/* Total Players per team */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total players per team <span className="text-red-500">*</span></label>
                    <input 
                        type="number" 
                        name="playersPerTeam" 
                        required
                        value={formData.playersPerTeam}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* Captcha */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                        <span>Captcha <span className="text-red-500">*</span></span>
                    </label>
                    <input 
                        type="text" 
                        value={captchaInput}
                        onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
                        className={`w-full bg-white border ${captchaError ? 'border-red-500' : 'border-gray-300'} rounded-md py-2 px-3 mb-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500`}
                        placeholder="Enter the text below"
                    />
                    {captchaError && <p className="text-red-500 text-xs mb-2">Incorrect captcha. Please try again.</p>}
                    
                    <div className="w-40 h-12 bg-gray-200 select-none flex items-center justify-center font-mono text-xl tracking-widest text-gray-500 line-through italic border border-gray-300 rounded relative overflow-hidden">
                        j g m u j
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded shadow-lg w-full md:w-auto transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Saving...' : 'Create Auction'}
                    </button>
                </div>

            </form>
        </div>
      </main>
    </div>
  );
};

export default CreateAuction;
