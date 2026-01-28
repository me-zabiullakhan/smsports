import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { Plus, Search, Menu, AlertCircle, RefreshCw, Database, Trash2, Cast, Monitor, Activity, UserPlus, Link as LinkIcon, ShieldCheck, CreditCard, Scale, FileText, ChevronRight, CheckCircle, Info, Zap, Crown, Users, Gavel, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { AuctionSetup, UserPlan, UserRole } from '../types';

const AdminDashboard: React.FC = () => {
  const { userProfile, logout } = useAuction();
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<AuctionSetup[]>([]);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'AUCTIONS' | 'PLANS' | 'LEGAL'>('AUCTIONS');
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);
  const [selectedAuctionForUpgrade, setSelectedAuctionForUpgrade] = useState<string | null>(null);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsRazorpayLoaded(true);
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // Fetch Dynamic Plans or fallback to defaults
  useEffect(() => {
      const unsub = db.collection('subscriptionPlans').orderBy('price', 'asc').onSnapshot(snap => {
          if (snap.empty) {
              setDbPlans([
                  { id: 'free', name: 'Free Plan', price: 0, teams: 2, features: ['Up to 2 Teams', 'Standard Overlays'] },
                  { id: 'basic', name: 'Basic Plan', price: 499, teams: 10, features: ['Up to 10 Teams', 'OBS Overlays'] },
                  { id: 'premium', name: 'Premium Plan', price: 999, teams: 25, features: ['Up to 25 Teams', 'Projector Mode'] }
              ]);
          } else {
              setDbPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
                .onSnapshot((snapshot) => {
                    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
                    data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    setAuctions(data);
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

  const handleAuctionSubscription = (auctionId: string, plan: any) => {
      if (!isRazorpayLoaded) return alert("Payment system is loading...");
      if (plan.price === 0) return alert("This auction is already on the Free Plan.");

      const options = {
          key: "rzp_test_pnZyMfa3h3mMXR",
          amount: plan.price * 100,
          currency: "INR",
          name: "SM SPORTS",
          description: `Upgrade Auction: ${plan.name}`,
          handler: async (response: any) => {
              await db.collection('auctions').doc(auctionId).update({
                  isPaid: true,
                  planId: plan.id,
                  totalTeams: plan.teams 
              });
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
                            <div key={auction.id} className="p-0 hover:bg-gray-50/50 transition-colors group">
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
                                                onClick={() => setSelectedAuctionForUpgrade(selectedAuctionForUpgrade === auction.id ? null : auction.id!)}
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
                                
                                {/* Inline Plan Selector */}
                                {selectedAuctionForUpgrade === auction.id && (
                                    <div className="bg-blue-50/50 p-6 border-t border-blue-100 animate-slide-up">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-900/20"><Sparkles className="w-4 h-4"/></div>
                                            <div>
                                                <h5 className="font-bold text-blue-900 text-sm">Choose a Plan</h5>
                                                <p className="text-xs text-blue-400 font-medium">Unlock full features for this auction.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                            {dbPlans.filter(p => p.price > 0).map(plan => (
                                                <div key={plan.id} className="bg-white p-5 rounded-2xl border-2 border-white hover:border-blue-300 transition-all shadow-sm flex flex-col group">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h6 className="font-bold text-gray-800 text-xs">{plan.name}</h6>
                                                        <span className="text-blue-600 font-bold text-lg">₹{plan.price}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mb-4">Up to {plan.teams} Teams</p>
                                                    <button 
                                                        onClick={() => handleAuctionSubscription(auction.id!, plan)}
                                                        className="w-full bg-blue-900 hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-lg"
                                                    >
                                                        Upgrade Now
                                                    </button>
                                                </div>
                                            ))}
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
              <h2 className="text-3xl font-bold text-gray-800 tracking-tighter mb-2">Auction Plans</h2>
              <p className="text-gray-500 text-sm font-medium">Professional features for your cricket tournament.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {dbPlans.map(plan => (
                  <div key={plan.id} className={`bg-white rounded-3xl p-8 border-2 transition-all relative flex flex-col border-gray-100 hover:shadow-xl`}>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                      <div className="flex items-baseline mb-6">
                          <span className="text-4xl font-bold text-gray-900">₹{plan.price}</span>
                          <span className="text-gray-400 text-xs font-bold ml-1">/Auction</span>
                      </div>
                      <div className="space-y-4 mb-10 flex-grow">
                          <div className="flex items-center gap-3 text-sm text-gray-800 font-bold">
                              <Users className="w-4 h-4 text-blue-500" /> Up to {plan.teams} Teams
                          </div>
                          {(plan.features || []).map((f: string, i: number) => (
                              <div key={i} className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                                  <CheckCircle className="w-4 h-4 text-green-400" /> {f}
                              </div>
                          ))}
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                          <p className="text-xs font-semibold text-gray-400 text-center mb-0">Choose an auction to upgrade from the "Auctions" tab.</p>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderLegal = () => (
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in">
          <div className="bg-slate-800 p-8 text-white">
              <h2 className="text-3xl font-bold tracking-tighter mb-2">Terms & Privacy</h2>
              <p className="text-slate-400 text-sm">Rules for organizing auctions on SM SPORTS.</p>
          </div>
          <div className="p-10 space-y-10 max-h-[600px] overflow-y-auto custom-scrollbar text-gray-600">
              <section>
                  <h3 className="text-lg font-bold text-blue-600 mb-4 flex items-center gap-2"><Scale className="w-5 h-5"/> 1. General Rules</h3>
                  <p className="text-sm leading-relaxed">By using this platform, you agree to host your sports auctions fairly. We provide the tools, but you are responsible for the auction results and player payments.</p>
              </section>
              <section>
                  <h3 className="text-lg font-bold text-emerald-600 mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5"/> 2. Privacy</h3>
                  <p className="text-sm leading-relaxed">We protect your data and do not share player mobile numbers with third parties. Admins must handle player data responsibly.</p>
              </section>
              <section>
                  <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5"/> 3. Refunds</h3>
                  <p className="text-sm leading-relaxed">Upgrade payments are non-refundable once activated. If you have technical issues, our support team will help you.</p>
              </section>
              <div className="pt-8 border-t text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Updated January 2025</div>
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
                <div className="hidden lg:flex bg-gray-100 rounded-xl p-1">
                    {[
                        { id: 'AUCTIONS', icon: <Gavel className="w-4 h-4"/>, label: 'Auctions' },
                        { id: 'PLANS', icon: <Zap className="w-4 h-4"/>, label: 'Plans' },
                        { id: 'LEGAL', icon: <Scale className="w-4 h-4"/>, label: 'Terms' }
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