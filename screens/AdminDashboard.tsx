import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { Plus, Search, Menu, AlertCircle, RefreshCw, Database, Trash2, Cast, Monitor, Activity, UserPlus, Link as LinkIcon, ShieldCheck, CreditCard, Scale, FileText, ChevronRight, CheckCircle, Info, Zap, Crown, Users, Gavel, Sparkles, Shield, Book, HelpCircle, UserPlus2, Layout, Youtube, MessageSquare, Star, Trophy, Tag, Check, ShieldAlert } from 'lucide-react';
import { db } from '../firebase';
import { AuctionSetup, UserPlan, UserRole, PromoCode } from '../types';

const AdminDashboard: React.FC = () => {
  const { userProfile, logout } = useAuction();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [auctions, setAuctions] = useState<(AuctionSetup & { currentTeamCount?: number })[]>([]);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'AUCTIONS' | 'PLANS' | 'LEGAL'>('AUCTIONS');
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);
  const [selectedAuctionForUpgrade, setSelectedAuctionForUpgrade] = useState<string | null>(null);

  // Promo Code States
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const isSuperAdmin = userProfile?.role === UserRole.SUPER_ADMIN;

  const COMMON_FEATURES = [
      { name: 'Online player registration', icon: <UserPlus2 className="w-4 h-4" /> },
      { name: 'Excel Data entry support', icon: <FileText className="w-4 h-4" /> },
      { name: 'Public Auction Page', icon: <Layout className="w-4 h-4" /> },
      { name: 'Auto points calculation', icon: <Zap className="w-4 h-4" /> },
      { name: 'WhatsApp Player Updates', icon: <MessageSquare className="w-4 h-4" /> },
      { name: 'LED/Projector Views', icon: <Monitor className="w-4 h-4" /> },
      { name: 'YouTube Overlays', icon: <Youtube className="w-4 h-4" /> },
  ];

  // Detect auto-upgrade query param
  useEffect(() => {
    const upgradeId = searchParams.get('upgrade');
    if (upgradeId) {
        setSelectedAuctionForUpgrade(upgradeId);
        setActiveTab('AUCTIONS');
    }
  }, [searchParams]);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsRazorpayLoaded(true);
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // Fetch Dynamic Plans or fallback to defaults matching the requested image (limited to 15 teams)
  useEffect(() => {
      const unsub = db.collection('subscriptionPlans').orderBy('price', 'asc').onSnapshot(snap => {
          if (snap.empty) {
              setDbPlans([
                  { id: 'plan_1', name: 'Plan 1 - Free', price: 0, teams: 2 },
                  { id: 'plan_2', name: 'Plan 2', price: 3000, teams: 4 },
                  { id: 'plan_3', name: 'Plan 3', price: 4000, teams: 6 },
                  { id: 'plan_4', name: 'Plan 4', price: 5000, teams: 10 },
                  { id: 'plan_5', name: 'Plan 5', price: 6000, teams: 15 },
              ]);
          } else {
              setDbPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.teams <= 15));
          }
      });
      return () => unsub();
  }, []);

  const setupListener = () => {
        if (!userProfile?.uid) return () => {};
        setLoading(true);
        setError(null);
        try {
            const unsubscribe = db.collection('auctions')
                .where('createdBy', '==', userProfile.uid)
                .onSnapshot(async (snapshot) => {
                    const auctionsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
                    
                    // Fetch team counts for each auction to validate plans
                    const auctionsWithCounts = await Promise.all(auctionsData.map(async (a) => {
                        const teamsSnap = await db.collection('auctions').doc(a.id).collection('teams').get();
                        return { ...a, currentTeamCount: teamsSnap.size };
                    }));

                    auctionsWithCounts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    setAuctions(auctionsWithCounts);
                    setLoading(false);
                }, (error: any) => {
                    setLoading(false);
                    setError("Failed to load auctions: " + error.message);
                });
            return unsubscribe;
        } catch (e: any) {
            setError(e.message);
            setLoading(false);
            return () => {};
        }
  };

  useEffect(() => {
    let unsubscribe: any;
    if (userProfile?.uid) { unsubscribe = setupListener(); }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [userProfile]);

  const handleValidatePromo = async () => {
      if (!promoInput) return;
      setIsValidatingPromo(true);
      setPromoError('');
      setAppliedPromo(null);
      try {
          const snap = await db.collection('promoCodes').where('code', '==', promoInput.toUpperCase()).get();
          if (snap.empty) throw new Error("Invalid Promo Code");
          const promo = { id: snap.docs[0].id, ...snap.docs[0].data() } as PromoCode;
          if (!promo.active) throw new Error("Promo Code Inactive");
          if (promo.expiryDate < Date.now()) throw new Error("Promo Code Expired");
          if (promo.currentClaims >= promo.maxClaims) throw new Error("Promo Claim Limit Reached");
          setAppliedPromo(promo);
      } catch (err: any) {
          setPromoError(err.message);
      } finally {
          setIsValidatingPromo(false);
      }
  };

  const calculateDiscountedPrice = (originalPrice: number) => {
      if (!appliedPromo) return originalPrice;
      if (appliedPromo.discountType === 'FLAT') return Math.max(0, originalPrice - appliedPromo.discountValue);
      return Math.max(0, Math.round(originalPrice * (1 - appliedPromo.discountValue / 100)));
  };

  const handleAuctionSubscription = (auctionId: string, plan: any) => {
      if (!isRazorpayLoaded) return alert("Payment system is loading...");
      if (plan.price === 0) return alert("This auction is already on the Free Plan.");

      const finalPrice = calculateDiscountedPrice(plan.price);
      
      // If price becomes zero due to promo, bypass Razorpay
      if (finalPrice === 0) {
          (async () => {
              await db.collection('auctions').doc(auctionId).update({
                  isPaid: true,
                  planId: plan.id,
                  totalTeams: plan.teams 
              });
              if (appliedPromo) {
                  await db.collection('promoCodes').doc(appliedPromo.id).update({
                      currentClaims: (appliedPromo.currentClaims || 0) + 1
                  });
              }
              alert("Protocol Authorized! Full Discount Applied.");
              setSelectedAuctionForUpgrade(null);
          })();
          return;
      }

      const options = {
          key: "rzp_test_pnZyMfa3h3mMXR",
          amount: finalPrice * 100,
          currency: "INR",
          name: "SM SPORTS",
          description: `Upgrade Auction: ${plan.name} ${appliedPromo ? '(Promo Applied)' : ''}`,
          handler: async (response: any) => {
              await db.collection('auctions').doc(auctionId).update({
                  isPaid: true,
                  planId: plan.id,
                  totalTeams: plan.teams 
              });
              if (appliedPromo) {
                  await db.collection('promoCodes').doc(appliedPromo.id).update({
                      currentClaims: (appliedPromo.currentClaims || 0) + 1
                  });
              }
              alert("Success! Your auction has been upgraded.");
              setSelectedAuctionForUpgrade(null);
          },
          prefill: { email: userProfile?.email },
          theme: { color: "#16a34a" }
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
  };

  const copyRegLink = (auctionId: string) => {
      const baseUrl = window.location.href.split('#')[0];
      const url = `${baseUrl}#/auction/${auctionId}/register`;
      navigator.clipboard.writeText(url);
      alert("✅ Registration link copied!");
  };

  const handleDeleteAuction = async (auctionId: string, title: string) => {
      if (window.confirm(`Delete auction "${title}"?`)) {
          try { await db.collection('auctions').doc(auctionId).delete(); } 
          catch (e: any) { alert("Delete failed: " + e.message); }
      }
  };

  const renderAuctions = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-800 tracking-tight">My Auctions ({auctions.length})</h2>
              <div className="flex gap-2">
                  <button onClick={() => navigate('/scoring')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl shadow shadow-blue-900/10 transition-all flex items-center text-xs"><Activity className="w-4 h-4 mr-2" /> SCORING</button>
                  <button onClick={() => navigate('/admin/new')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl shadow shadow-green-900/10 transition-all flex items-center text-xs"><Plus className="w-4 h-4 mr-2" /> NEW AUCTION</button>
              </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <RefreshCw className="animate-spin h-8 w-8 text-green-600 mb-2"/>
                        Loading auctions...
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {auctions.length > 0 ? auctions.map((auction) => (
                            <div key={auction.id} id={`auction-${auction.id}`} className={`p-0 transition-colors group ${selectedAuctionForUpgrade === auction.id ? 'bg-blue-50/20' : 'hover:bg-gray-50/50'}`}>
                                <div className="p-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div className="flex-1 flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${auction.isPaid ? 'bg-gradient-to-br from-green-500 to-green-700' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                                            {auction.isPaid ? <ShieldCheck className="w-6 h-6"/> : <Gavel className="w-6 h-6"/>}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-lg">{auction.title}</h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                <p className="text-xs text-gray-400 font-semibold">{auction.sport} • {auction.date}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${auction.isPaid ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
                                                    {auction.isPaid ? 'Paid Version' : 'Free Version'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {!auction.isPaid && userProfile?.role !== UserRole.SUPER_ADMIN && (
                                            <button 
                                                onClick={() => { setSelectedAuctionForUpgrade(selectedAuctionForUpgrade === auction.id ? null : auction.id!); setPromoInput(''); setAppliedPromo(null); setPromoError(''); }}
                                                className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${selectedAuctionForUpgrade === auction.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
                                            >
                                                <CreditCard className="w-3 h-3" /> Upgrade
                                            </button>
                                        )}
                                        <button onClick={() => copyRegLink(auction.id!)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-100 flex items-center transition-all"><LinkIcon className="w-3 h-3 mr-1" /> Reg Link</button>
                                        <button onClick={() => navigate(`/auction/${auction.id}`)} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-100 transition-all">Live Room</button>
                                        <button onClick={() => navigate(`/admin/auction/${auction.id}/manage`)} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-100 transition-all">Manage</button>
                                        <button onClick={() => handleDeleteAuction(auction.id!, auction.title)} className="text-red-400 hover:text-red-600 p-2 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                
                                {/* Inline Plan Selector - Restricted to 15 teams */}
                                {selectedAuctionForUpgrade === auction.id && (
                                    <div className="bg-blue-50/50 p-6 border-t border-blue-100 animate-slide-up">
                                        <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
                                            <div className="flex items-start gap-3">
                                                <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-900/20 mt-1"><Sparkles className="w-4 h-4"/></div>
                                                <div>
                                                    <h5 className="font-bold text-blue-900 text-sm">Select Your Tournament Scale</h5>
                                                    <p className="text-xs text-blue-400 font-medium">Unlock pro overlays, WhatsApp updates, and LED screen support.</p>
                                                    {auction.currentTeamCount! > 2 && (
                                                        <p className="text-[10px] text-orange-600 font-black uppercase mt-1">Supporting {auction.currentTeamCount} teams or more.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* PROMO CODE BOX */}
                                            <div className="w-full md:w-64 bg-white p-3 rounded-2xl shadow-sm border border-blue-100">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1"><Tag className="w-2.5 h-2.5"/> Promo Code</label>
                                                    {appliedPromo && <span className="text-[8px] font-black text-green-500 uppercase flex items-center gap-0.5"><Check className="w-2 h-2"/> APPLIED</span>}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <input 
                                                        placeholder="ENTER CODE" 
                                                        className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-400"
                                                        value={promoInput}
                                                        onChange={e => setPromoInput(e.target.value.toUpperCase())}
                                                    />
                                                    <button 
                                                        onClick={handleValidatePromo}
                                                        disabled={isValidatingPromo || !promoInput}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-all active:scale-90 disabled:opacity-50"
                                                    >
                                                        {isValidatingPromo ? <RefreshCw className="w-3 h-3 animate-spin"/> : <ChevronRight className="w-3 h-3"/>}
                                                    </button>
                                                </div>
                                                {promoError && <p className="text-[8px] text-red-500 font-bold mt-1 uppercase tracking-tight">{promoError}</p>}
                                                {appliedPromo && (
                                                    <p className="text-[9px] text-green-600 font-black mt-1 uppercase tracking-widest">
                                                        DISCOUNT: {appliedPromo.discountType === 'PERCENT' ? `${appliedPromo.discountValue}% OFF` : `₹${appliedPromo.discountValue} OFF`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                            {dbPlans
                                                .filter(p => p.price > 0 && p.teams >= (auction.currentTeamCount || 0))
                                                .map(plan => {
                                                    const discPrice = calculateDiscountedPrice(plan.price);
                                                    return (
                                                        <div key={plan.id} className="bg-white p-4 rounded-2xl border-2 border-white hover:border-blue-300 transition-all shadow-sm flex flex-col group relative">
                                                            {plan.price === 5000 && <div className="absolute top-2 right-2"><Star className="w-3 h-3 text-yellow-400 fill-current"/></div>}
                                                            <h6 className="font-black text-gray-800 text-[10px] uppercase mb-1">{plan.name}</h6>
                                                            <div className="flex flex-col mb-3">
                                                                <div className="flex items-baseline">
                                                                    <span className="text-blue-600 font-black text-xl">₹{discPrice}</span>
                                                                    <span className="text-[8px] text-gray-400 font-bold ml-1">/Auction</span>
                                                                </div>
                                                                {appliedPromo && (
                                                                    <span className="text-[9px] text-gray-300 line-through font-bold decoration-red-400">WAS ₹{plan.price}</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 font-bold mb-4 flex items-center gap-1">
                                                                <Users className="w-3 h-3 text-blue-400"/> Upto {plan.teams} Teams
                                                            </div>
                                                            <button 
                                                                onClick={() => handleAuctionSubscription(auction.id!, plan)}
                                                                className="w-full bg-blue-900 hover:bg-black text-white font-black py-2 rounded-lg text-[9px] uppercase tracking-widest transition-all active:scale-95 shadow-md"
                                                            >
                                                                {discPrice === 0 ? 'CLAIM FREE' : 'Upgrade'}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-2xl flex flex-col justify-center items-center text-center group cursor-pointer hover:scale-105 transition-all" onClick={() => window.location.href='mailto:support@theplayerauction.com'}>
                                                <p className="text-white font-black text-[10px] uppercase tracking-widest mb-1">Large Scale</p>
                                                <p className="text-gray-400 text-[8px] font-bold">Contact Sales</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="p-20 text-center text-gray-400 font-medium text-sm">You haven't created any auctions yet.</div>
                        )}
                    </div>
                )}
          </div>
      </div>
  );

  const renderPlans = () => (
      <div className="animate-fade-in">
          <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl font-black text-gray-800 tracking-tighter mb-2 uppercase">Subscription Protocols</h2>
              <p className="text-gray-500 text-sm font-medium">Standardized tiers for small and mid-scale tournaments (Max 15 Teams).</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
              {/* Premium Features Highlight */}
              <div className="lg:col-span-1 space-y-4">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-8 text-white shadow-2xl h-full flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-6 border-b border-white/20 pb-4">Standard Features</h3>
                        <ul className="space-y-4">
                            {COMMON_FEATURES.map((f, idx) => (
                                <li key={idx} className="flex items-center gap-3 text-xs font-bold opacity-90 group">
                                    <div className="bg-white/20 p-1.5 rounded-lg group-hover:bg-white group-hover:text-blue-600 transition-all">{f.icon}</div>
                                    {f.name}
                                </li>
                            ))}
                        </ul>
                      </div>
                      <div className="mt-8 text-[10px] font-black uppercase tracking-widest opacity-50 text-center">Verified Tournament Suite</div>
                  </div>
              </div>

              {/* Tiers Grid - Restricted to 15 Teams */}
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {dbPlans.map(plan => (
                      <div key={plan.id} className={`bg-white rounded-3xl p-6 border-2 transition-all relative flex flex-col ${plan.price === 5000 ? 'border-blue-500 shadow-xl scale-105 z-10' : 'border-gray-100 hover:shadow-lg'}`}>
                          {plan.price === 5000 && <div className="absolute top-4 right-4 bg-blue-500 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase">Optimal</div>}
                          <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">{plan.name}</h3>
                          <div className="flex items-baseline mb-6">
                              <span className="text-3xl font-black text-gray-900">₹{plan.price}</span>
                              <span className="text-gray-400 text-[10px] font-bold ml-1">/Auction</span>
                          </div>
                          <div className="space-y-4 mb-10 flex-grow">
                              <div className="flex items-center gap-3 text-xs text-gray-800 font-bold">
                                  <Users className="w-4 h-4 text-blue-500" /> Upto {plan.teams} Teams
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                                  <CheckCircle className="w-3 h-3 text-green-400" /> {plan.price === 0 ? 'Basic Views' : 'Full Pro Overlays'}
                              </div>
                          </div>
                          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select in "Auctions" Tab</p>
                          </div>
                      </div>
                  ))}

                  {/* Contact Card for Large Tournaments */}
                  <div className="bg-zinc-900 rounded-3xl p-6 border-2 border-zinc-800 flex flex-col justify-center items-center text-center">
                      <Trophy className="w-8 h-8 text-highlight mb-4" />
                      <h3 className="text-white font-black text-lg uppercase mb-2">Mega Leagues</h3>
                      <p className="text-gray-500 text-[10px] font-bold mb-6">For 16+ teams, custom branding, and onsite support.</p>
                      <button onClick={() => window.location.href='mailto:support@theplayerauction.com'} className="bg-white text-black font-black px-6 py-2 rounded-xl text-[10px] uppercase tracking-widest hover:bg-highlight hover:text-primary transition-all">Inquire Now</button>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderLegal = () => (
      <div className="space-y-8 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white relative">
                  <div className="relative z-10">
                      <h2 className="text-3xl font-black tracking-tighter mb-2 uppercase">Platform Legal Protocol</h2>
                      <p className="text-slate-400 text-sm font-medium">Terms of Service, Privacy & Organizer Guidelines</p>
                  </div>
                  <Book className="absolute right-8 top-1/2 -translate-y-1/2 w-16 h-16 text-white/5" />
              </div>
              
              <div className="p-8 md:p-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-2">
                              <div className="bg-blue-50 p-2 rounded-lg"><Scale className="w-5 h-5 text-blue-600"/></div>
                              <h3 className="text-lg font-bold text-gray-800">1. Organizer Terms</h3>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                              As an auction organizer, you are solely responsible for the integrity of your event. SM SPORTS provides the technical platform for bidding, squad management, and broadcasting. We do not facilitate or handle financial transactions between teams and players.
                          </p>
                      </div>

                      <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-2">
                              <div className="bg-emerald-50 p-2 rounded-lg"><ShieldCheck className="w-5 h-5 text-emerald-600"/></div>
                              <h3 className="text-lg font-bold text-gray-800">2. Privacy Policy</h3>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                              We take player data privacy seriously. All mobile numbers and personal details collected via our registration forms are encrypted and accessible only by the respective auction organizer. We do not sell or share this data with third-party advertisers.
                          </p>
                      </div>

                      <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-2">
                              <div className="bg-red-50 p-2 rounded-lg"><CreditCard className="w-5 h-5 text-red-600"/></div>
                              <h3 className="text-lg font-bold text-gray-800">3. Refund Protocol</h3>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                              Subscription payments for auction upgrades are non-refundable once the features are activated. If an auction is canceled before any bids are placed, organizers may request a platform credit for a future event.
                          </p>
                      </div>

                      <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-2">
                              <div className="bg-amber-50 p-2 rounded-lg"><FileText className="w-5 h-5 text-amber-600"/></div>
                              <h3 className="text-lg font-bold text-gray-800">4. Content Guidelines</h3>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                              All tournament names, logos, and player photos uploaded must comply with local copyright and community standards. SM SPORTS reserves the right to suspend any auction found to be hosting illegal, offensive, or fraudulent content.
                          </p>
                      </div>
                  </div>
                  
                  <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                      <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">Last Updated: January 2025</p>
                      <div className="flex gap-4">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Shield className="w-3 h-3"/> System Secured</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Gavel className="w-3 h-3"/> Legal Approved</span>
                      </div>
                  </div>
              </div>
          </div>
          
          <div className="bg-blue-600 p-8 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-blue-600/20">
              <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-2xl"><HelpCircle className="w-8 h-8 text-white"/></div>
                  <div>
                      <h4 className="text-xl font-bold uppercase tracking-tight">Need Legal Clarification?</h4>
                      <p className="text-blue-100 text-sm opacity-80">Our specialized support team is here to help with your concerns.</p>
                  </div>
              </div>
              <button onClick={() => window.location.href='mailto:support@theplayerauction.com'} className="bg-white text-blue-600 font-black px-8 py-3 rounded-xl text-xs uppercase tracking-widest shadow-xl hover:bg-gray-100 transition-all active:scale-95">
                  Contact Compliance
              </button>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="bg-slate-800 p-2 rounded-xl text-white"><Crown className="w-5 h-5" /></div>
                <h1 className="text-xl font-bold text-gray-700 tracking-tighter">SM SPORTS <span className="text-gray-300 font-medium">| Dashboard</span></h1>
            </div>
            
            <div className="flex items-center gap-6">
                {isSuperAdmin && (
                    <button 
                        onClick={() => navigate('/super-admin')}
                        className="hidden md:flex items-center gap-2 bg-slate-900 hover:bg-black text-highlight font-black py-2 px-4 rounded-xl text-[10px] uppercase tracking-widest shadow-lg transition-all border border-highlight/30 active:scale-95"
                    >
                        <ShieldAlert className="w-4 h-4"/> MASTER CONTROL
                    </button>
                )}

                <div className="hidden lg:flex bg-gray-100 rounded-xl p-1">
                    {[
                        { id: 'AUCTIONS', icon: <Gavel className="w-4 h-4"/>, label: 'Auctions' },
                        { id: 'PLANS', icon: <Zap className="w-4 h-4"/>, label: 'Plans' },
                        { id: 'LEGAL', icon: <Scale className="w-4 h-4"/>, label: 'Legal' }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
                <div onClick={logout} className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-red-600 transition-colors shadow-lg">
                    {userProfile?.name?.charAt(0) || 'A'}
                </div>
            </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 flex-grow max-w-6xl">
        {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold">{error}</p>
            </div>
        )}

        {activeTab === 'AUCTIONS' && renderAuctions()}
        {activeTab === 'PLANS' && renderPlans()}
        {activeTab === 'LEGAL' && renderLegal()}
      </main>
    </div>
  );
};

export default AdminDashboard;