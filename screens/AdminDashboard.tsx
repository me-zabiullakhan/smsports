import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { Plus, Search, Menu, AlertCircle, RefreshCw, Database, Trash2, Cast, Monitor, Activity, UserPlus, Link as LinkIcon, ShieldCheck, CreditCard, Scale, FileText, ChevronRight, CheckCircle, Info, Zap, Crown, Users, Gavel } from 'lucide-react';
import { db } from '../firebase';
import { AuctionSetup, UserPlan } from '../types';

const AdminDashboard: React.FC = () => {
  const { userProfile, logout } = useAuction();
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<AuctionSetup[]>([]);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'AUCTIONS' | 'PLANS' | 'LEGAL'>('AUCTIONS');
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsRazorpayLoaded(true);
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // Fetch Dynamic Plans
  useEffect(() => {
      const unsub = db.collection('subscriptionPlans').orderBy('price', 'asc').onSnapshot(snap => {
          setDbPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const handleSubscription = (plan: any) => {
      if (!isRazorpayLoaded) return alert("Payment system initializing...");
      if (plan.price === 0) return alert("You are already on the Free Plan.");

      const options = {
          key: "rzp_test_replace_me", 
          amount: plan.price * 100,
          currency: "INR",
          name: "SM SPORTS",
          description: `Upgrade to ${plan.name}`,
          handler: async (response: any) => {
              const newPlan: UserPlan = {
                  type: plan.id as any,
                  maxAuctions: 1, 
                  maxTeams: plan.teams,
                  expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000)
              };
              await db.collection('users').doc(userProfile?.uid).set({ plan: newPlan }, { merge: true });
              alert("Payment Successful! Your plan has been upgraded.");
              window.location.reload();
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
      alert("✅ Registration Link Copied!");
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
              <h2 className="text-2xl font-bold text-gray-800">My Auctions ({auctions.length})</h2>
              <div className="flex gap-2">
                  <button onClick={() => navigate('/scoring')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow transition-all flex items-center text-sm"><Activity className="w-4 h-4 mr-2" /> Scoring</button>
                  <button onClick={() => navigate('/admin/new')} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow transition-all flex items-center text-sm"><Plus className="w-4 h-4 mr-2" /> New Auction</button>
              </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <RefreshCw className="animate-spin h-8 w-8 text-green-600 mb-2"/>
                        Syncing registry...
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {auctions.length > 0 ? auctions.map((auction) => (
                            <div key={auction.id} className="p-6 hover:bg-gray-50 transition-colors group">
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-700 text-lg">{auction.title}</h4>
                                        <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{auction.sport} • {auction.date}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button onClick={() => copyRegLink(auction.id!)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border border-emerald-100 flex items-center transition-all"><LinkIcon className="w-3 h-3 mr-1" /> Registration</button>
                                        <button onClick={() => navigate(`/auction/${auction.id}`)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded text-xs font-bold transition-all uppercase">Live</button>
                                        <button onClick={() => navigate(`/admin/auction/${auction.id}/manage`)} className="text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded text-xs font-bold transition-all uppercase">Manage</button>
                                        <button onClick={() => handleDeleteAuction(auction.id!, auction.title)} className="text-red-400 hover:text-red-600 p-2 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-20 text-center text-gray-400 italic">No auctions detected in your account.</div>
                        )}
                    </div>
                )}
          </div>
      </div>
  );

  const renderPlans = () => (
      <div className="animate-fade-in">
          <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter mb-2">Elevate Your Auctions</h2>
              <p className="text-gray-500 text-sm font-medium">Professional grade features for every tournament size.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {dbPlans.length > 0 ? dbPlans.map(plan => (
                  <div key={plan.id} className={`bg-white rounded-3xl p-8 border-2 transition-all relative flex flex-col border-gray-100`}>
                      <h3 className="text-xl font-black text-gray-800 uppercase mb-2">{plan.name}</h3>
                      <div className="flex items-baseline mb-6">
                          <span className="text-4xl font-black text-gray-900">₹{plan.price}</span>
                          <span className="text-gray-400 text-xs font-bold ml-1">/Auction</span>
                      </div>
                      <div className="space-y-4 mb-10 flex-grow">
                          <div className="flex items-center gap-3 text-sm text-gray-800 font-black uppercase tracking-tight">
                              <Users className="w-4 h-4 text-blue-500" /> Limit: Up to {plan.teams} Teams
                          </div>
                          {(plan.features || []).map((f: string, i: number) => (
                              <div key={i} className="flex items-center gap-3 text-sm text-gray-500">
                                  <CheckCircle className="w-4 h-4 text-green-400" /> {f}
                              </div>
                          ))}
                      </div>
                      <button 
                        onClick={() => handleSubscription(plan)}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${plan.price > 0 ? 'bg-green-600 text-white shadow-xl hover:bg-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                          {plan.price === 0 ? 'Current Plan' : 'Purchase Plan'}
                      </button>
                  </div>
              )) : (
                  <div className="col-span-full py-20 text-center text-gray-400 italic">No subscription protocols available at this time.</div>
              )}
          </div>
      </div>
  );

  const renderLegal = () => (
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden animate-fade-in">
          <div className="bg-slate-900 p-8 text-white">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Legal Protocol</h2>
              <p className="text-slate-400 text-sm">Terms of Service and Operational Guidelines for SM SPORTS Developers & Hosts.</p>
          </div>
          <div className="p-10 space-y-10 max-h-[600px] overflow-y-auto custom-scrollbar">
              <section>
                  <h3 className="text-lg font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2"><Scale className="w-5 h-5"/> 1. Service Agreement</h3>
                  <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
                      <p>By using the SM SPORTS platform, you agree to organize sports auctions in a fair and transparent manner. We provide the technical infrastructure, but the outcome and financial management of your local auctions are your responsibility.</p>
                      <p>You may not use the platform for illegal gambling, betting, or any activity prohibited by your local jurisdiction.</p>
                  </div>
              </section>
              <section>
                  <h3 className="text-lg font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5"/> 2. Data Privacy</h3>
                  <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
                      <p>User data, player registration details, and team information are stored securely in our cloud database. SM SPORTS does not sell your auction data to third parties.</p>
                      <p>Admins are responsible for the privacy of the players who register through their custom registration links. Ensure you handle player mobile numbers and IDs with discretion.</p>
                  </div>
              </section>
              <section>
                  <h3 className="text-lg font-black uppercase tracking-widest text-red-600 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5"/> 3. Refund Policy</h3>
                  <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
                      <p>Subscription fees for professional plans are non-refundable once the service has been activated. If you encounter technical issues that prevent your auction from proceeding, our support team will provide credits or extension of service.</p>
                  </div>
              </section>
              <section>
                  <h3 className="text-lg font-black uppercase tracking-widest text-orange-600 mb-4 flex items-center gap-2"><FileText className="w-5 h-5"/> 4. Content Ownership</h3>
                  <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
                      <p>Logos, player photos, and auction titles uploaded by you remain your property. However, you grant SM SPORTS a non-exclusive license to display this content on our platform for your auction participants.</p>
                  </div>
              </section>
              <div className="pt-8 border-t text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Last Updated: January 2025</div>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="bg-slate-900 p-2 rounded-xl text-white"><Crown className="w-5 h-5" /></div>
                <h1 className="text-xl font-black text-gray-700 uppercase tracking-tighter">SM SPORTS <span className="text-gray-300 font-medium">| Dashboard</span></h1>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="hidden lg:flex bg-gray-100 rounded-xl p-1">
                    {[
                        { id: 'AUCTIONS', icon: <Gavel className="w-4 h-4"/>, label: 'Auctions' },
                        { id: 'PLANS', icon: <Zap className="w-4 h-4"/>, label: 'Plans' },
                        { id: 'LEGAL', icon: <Scale className="w-4 h-4"/>, label: 'Legal' }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
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

      {/* Mobile Nav */}
      <div className="lg:hidden flex bg-white border-b overflow-x-auto p-2 gap-2 sticky top-[73px] z-40">
          {['AUCTIONS', 'PLANS', 'LEGAL'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${activeTab === tab ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{tab}</button>
          ))}
      </div>

      <main className="container mx-auto px-6 py-10 flex-grow max-w-6xl">
        {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-center gap-3 text-red-700 animate-pulse">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold">{error}</p>
            </div>
        )}

        {activeTab === 'AUCTIONS' && renderAuctions()}
        {activeTab === 'PLANS' && renderPlans()}
        {activeTab === 'LEGAL' && renderLegal()}
      </main>

      <footer className="bg-white border-t py-8 mt-10">
          <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <p>© 2025 SM SPORTS OPERATIONAL CORE</p>
              <div className="flex gap-6">
                  <button onClick={() => setActiveTab('LEGAL')} className="hover:text-gray-600">Privacy Protocol</button>
                  <button onClick={() => setActiveTab('LEGAL')} className="hover:text-gray-600">Operations Terms</button>
                  <a href="mailto:support@smsports.com" className="hover:text-gray-600">Technical Support</a>
              </div>
          </div>
      </footer>
    </div>
  );
};

export default AdminDashboard;