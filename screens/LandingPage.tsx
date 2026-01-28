import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, AuctionSetup } from '../types';
import { Play, Calendar, History, ArrowRight, Shield, Trophy, Users, BookOpen, CheckCircle, Scale, CreditCard, ShieldCheck, FileText, Zap, Star, Monitor, MessageSquare, Smartphone, Layout, Youtube, ChevronRight, UserPlus } from 'lucide-react';
import { db } from '../firebase';

const AuctionCard: React.FC<{ auction: AuctionSetup, navigate: (path: string) => void, getStatusBadge: (status: string) => React.ReactNode }> = ({ auction, navigate, getStatusBadge }) => {
    const [teamCount, setTeamCount] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;
        const fetchCount = async () => {
            if (!auction.id) return;
            try {
                const snap = await db.collection('auctions').doc(auction.id).collection('teams').get();
                if (mounted) setTeamCount(snap.size);
            } catch (e) { console.error("Error fetching team count", e); }
        };
        fetchCount();
        return () => { mounted = false; };
    }, [auction.id]);

    const isRegOpen = auction.registrationConfig?.isEnabled;
    const isPublicReg = auction.registrationConfig?.isPublic ?? true;

    return (
        <div className="bg-secondary border border-accent rounded-xl p-6 hover:border-highlight transition-all flex flex-col relative overflow-hidden group">
            {getStatusBadge(auction.status)}
            <div className="flex justify-between items-start mb-2 mt-2">
                <h3 className="text-xl font-bold text-white">{auction.title}</h3>
                <button onClick={() => navigate(`/auction/${auction.id}`)} className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded">View Room</button>
            </div>
            <div className="text-text-secondary text-sm mb-4 flex items-center gap-2">
                {(isRegOpen && isPublicReg) ? <span className="text-green-400 font-bold text-[10px] uppercase border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded">Reg Open</span> : (isRegOpen && !isPublicReg) ? <span className="text-blue-400 font-bold text-[10px] uppercase border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded">Private Reg</span> : <span className="text-gray-500 font-bold text-[10px] uppercase border border-gray-500/30 bg-gray-500/10 px-2 py-0.5 rounded">Reg Closed</span>}
                <span className="text-gray-600">•</span>
                <span>{teamCount !== null ? teamCount : '-'} / {auction.totalTeams} Teams</span>
            </div>
            <div className="mt-auto pt-4 border-t border-gray-700 flex justify-between items-center text-xs text-text-secondary">
                <span>Starts: {auction.date || 'TBA'}</span>
                <div className="flex gap-2">
                <span className="bg-accent px-2 py-1 rounded text-white">{auction.sport}</span>
                {isRegOpen && isPublicReg && <button onClick={() => navigate(`/auction/${auction.id}/register`)} className="text-highlight hover:underline font-bold">Register Player</button>}
                </div>
            </div>
        </div>
    );
};

const LandingPage: React.FC = () => {
  const { state } = useAuction();
  const navigate = useNavigate();
  const [upcomingAuctions, setUpcomingAuctions] = useState<AuctionSetup[]>([]);
  const [pastAuctions, setPastAuctions] = useState<AuctionSetup[]>([]);
  const [loading, setLoading] = useState(true);

  const PLANS = [
      { name: 'Plan 1 - Free', price: 0, teams: 2, badge: 'Starter' },
      { name: 'Plan 2', price: 3000, teams: 4, badge: 'Standard' },
      { name: 'Plan 3', price: 4000, teams: 6, badge: 'Pro' },
      { name: 'Plan 4', price: 5000, teams: 10, badge: 'Elite' },
      { name: 'Plan 5', price: 6000, teams: 15, badge: 'Master' },
  ];

  useEffect(() => {
      setLoading(true);
      const unsubscribe = db.collection('auctions').onSnapshot((snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
          data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          const active = data.filter(a => { const s = (a.status || '').toUpperCase(); return s === 'DRAFT' || s === 'LIVE' || s === 'NOT_STARTED' || s === 'IN_PROGRESS'; });
          const past = data.filter(a => { const s = (a.status || '').toUpperCase(); return s === 'FINISHED' || s === 'COMPLETED'; });
          setUpcomingAuctions(active);
          setPastAuctions(past);
          setLoading(false);
      }, (error: any) => { setLoading(false); });
      return () => unsubscribe();
  }, []);

  const getStatusBadge = (status: string) => {
      const s = (status || '').toUpperCase();
      if (s === 'IN_PROGRESS' || s === 'LIVE') return <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 animate-pulse">LIVE NOW</div>;
      if (s === 'NOT_STARTED') return <div className="absolute top-0 right-0 bg-green-600 text-white text-xs font-bold px-3 py-1">READY TO START</div>;
      return null;
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col font-sans">
      <nav className="border-b border-accent bg-secondary/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
            <div className="w-10 h-10 bg-black rounded-lg border-2 border-highlight p-1 shadow flex items-center justify-center overflow-hidden">
                {state.systemLogoUrl ? (
                    <img src={state.systemLogoUrl} className="max-w-full max-h-full object-contain" alt="SM Sports" />
                ) : (
                    <Trophy className="w-full h-full text-highlight" />
                )}
            </div>
            <span className="text-xl font-bold text-white tracking-wider hidden sm:inline">SM SPORTS</span>
          </div>
          <div className="flex items-center gap-4 md:gap-8">
            <button onClick={() => scrollToSection('pricing')} className="text-text-secondary hover:text-white transition-colors text-sm font-semibold hidden md:block">Pricing</button>
            <button onClick={() => scrollToSection('legal')} className="text-text-secondary hover:text-white transition-colors text-sm font-semibold hidden md:block">Terms</button>
            <Link to="/auth" className="bg-highlight hover:bg-teal-400 text-primary font-bold py-2 px-5 rounded-lg transition-all shadow-lg shadow-highlight/20 text-sm">Dashboard</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/20 via-primary to-primary"></div>
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-accent/50 border border-accent text-highlight text-xs font-bold tracking-widest uppercase">The Future of Sports Bidding</div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight">Manage Your <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-highlight to-teal-200">Cricket Auctions</span><br/> Professionally</h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">Experience the thrill of a real-time auction room. Organize players, manage team budgets, and bid live with our advanced auction platform.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/auth?tab=admin&mode=register" className="flex items-center justify-center bg-white text-primary font-bold py-4 px-8 rounded-xl hover:bg-gray-100 transition-all shadow-xl"><Play className="w-5 h-5 mr-2 fill-current" /> Get Started</Link>
            <button onClick={() => scrollToSection('pricing')} className="flex items-center justify-center bg-secondary border border-accent text-white font-bold py-4 px-8 rounded-xl hover:bg-accent transition-all shadow-lg">View Plans</button>
          </div>
        </div>
      </header>

      {/* Auction Center */}
      <section className="py-20 bg-secondary/30 border-t border-accent/50">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-10"><h2 className="text-3xl font-bold text-white">Live Matches</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
               <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center"><Calendar className="w-4 h-4 mr-2" /> Live & Upcoming</h4>
               {loading ? <div className="text-text-secondary text-sm animate-pulse">Loading upcoming events...</div> : upcomingAuctions.length > 0 ? upcomingAuctions.map(auction => <AuctionCard key={auction.id} auction={auction} navigate={navigate} getStatusBadge={getStatusBadge} />) : <div className="bg-secondary/50 border border-dashed border-gray-700 rounded-xl p-6 text-center text-text-secondary text-sm">No upcoming auctions scheduled.</div>}
            </div>
            <div className="flex flex-col gap-4">
               <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center"><History className="w-4 h-4 mr-2" /> Past Results</h4>
               {loading ? <div className="text-text-secondary text-sm animate-pulse">Loading results...</div> : pastAuctions.length > 0 ? pastAuctions.map(auction => <div key={auction.id} className="bg-secondary border border-accent rounded-xl p-6 opacity-80 hover:opacity-100 transition-all group"><h3 className="text-xl font-bold text-white mb-2">{auction.title}</h3><p className="text-text-secondary text-sm mb-4">Completed {auction.date}</p><div className="mt-auto pt-4 border-t border-gray-700 flex justify-between items-center text-xs text-text-secondary"><span>{auction.sport}</span><button onClick={() => navigate(`/auction/${auction.id}`)} className="text-green-400 hover:text-green-300 cursor-pointer font-bold hover:underline bg-transparent border-none p-0">View Stats</button></div></div>) : <div className="bg-secondary/50 border border-dashed border-gray-700 rounded-xl p-6 text-center text-text-secondary text-sm">No past auction results found.</div>}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-highlight/5 rounded-full blur-[100px] -mr-48 -mt-48"></div>
          <div className="container mx-auto px-6 relative z-10">
              <div className="text-center max-w-2xl mx-auto mb-16">
                  <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Select Your Plan</h2>
                  <p className="text-text-secondary">Scale your auction event with professional tools tailored to your tournament size.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
                  {PLANS.map((plan, i) => (
                      <div key={i} className={`bg-secondary border ${plan.price === 5000 ? 'border-highlight ring-2 ring-highlight/20 scale-[1.02]' : 'border-accent'} rounded-3xl p-8 flex flex-col hover:border-gray-500 transition-all group relative overflow-hidden`}>
                          {plan.price === 5000 && <div className="absolute top-6 right-6"><Zap className="w-6 h-6 text-highlight fill-current"/></div>}
                          <div className="text-highlight text-[10px] font-black uppercase tracking-widest mb-3">{plan.badge}</div>
                          <h3 className="text-2xl font-bold text-white mb-6">{plan.name}</h3>
                          <div className="flex items-baseline mb-8">
                              <span className="text-4xl font-black text-white">₹{plan.price}</span>
                              <span className="text-sm text-gray-500 font-bold ml-1">/auction</span>
                          </div>
                          <div className="space-y-4 mb-10 flex-grow">
                              <div className="flex items-center gap-3 text-base text-gray-300 font-medium">
                                  <Users className="w-5 h-5 text-highlight"/>
                                  Total Teams - Upto {plan.teams}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                  <CheckCircle className="w-4 h-4 text-green-500"/>
                                  {plan.price === 0 ? 'Standard Overlays' : 'Full Pro Suite'}
                              </div>
                          </div>
                          <Link to="/auth?tab=admin&mode=register" className={`w-full py-4 rounded-2xl text-center font-bold transition-all ${plan.price === 5000 ? 'bg-highlight text-primary hover:bg-teal-400 shadow-lg shadow-highlight/20' : 'bg-accent/50 text-white hover:bg-accent'}`}>
                              Get Started
                          </Link>
                      </div>
                  ))}

                  {/* Custom Plan */}
                  <div className="bg-gradient-to-br from-secondary to-zinc-900 border border-accent rounded-3xl p-8 flex flex-col hover:border-highlight transition-all">
                      <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Corporate</div>
                      <h3 className="text-2xl font-bold text-white mb-6">Custom Plan</h3>
                      <div className="text-4xl font-black text-white mb-10">Contact Us</div>
                      <p className="text-sm text-gray-500 font-medium mb-10 flex-grow leading-relaxed">For large scale federations, custom rule engines, and dedicated onsite support.</p>
                      <button onClick={() => window.location.href='mailto:support@theplayerauction.com'} className="w-full bg-white text-primary font-bold py-4 rounded-2xl text-center hover:bg-gray-100 transition-colors">
                          Contact Sales
                      </button>
                  </div>
              </div>

              {/* All Paid Plans Feature Highlight */}
              <div className="bg-secondary/40 border border-accent rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Star className="w-40 h-40 text-highlight" />
                  </div>
                  <div className="max-w-4xl relative z-10">
                      <h3 className="text-3xl font-black text-white mb-8 border-l-4 border-highlight pl-6">All Paid Plans Include</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          <div className="flex gap-4">
                              <div className="bg-highlight/10 p-3 rounded-2xl h-fit text-highlight"><UserPlus className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="text-white font-bold mb-1">Online Registration</h4>
                                  <p className="text-xs text-text-secondary leading-relaxed">One time Player Data entry if available in excel.</p>
                              </div>
                          </div>
                          <div className="flex gap-4">
                              <div className="bg-highlight/10 p-3 rounded-2xl h-fit text-highlight"><Layout className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="text-white font-bold mb-1">Public Auction Page</h4>
                                  <p className="text-xs text-text-secondary leading-relaxed">Dedicated page for team owners, players and audience.</p>
                              </div>
                          </div>
                          <div className="flex gap-4">
                              <div className="bg-highlight/10 p-3 rounded-2xl h-fit text-highlight"><Zap className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="text-white font-bold mb-1">Auto Calculation</h4>
                                  <p className="text-xs text-text-secondary leading-relaxed">Automatic points and budget calculation in real-time.</p>
                              </div>
                          </div>
                          <div className="flex gap-4">
                              <div className="bg-highlight/10 p-3 rounded-2xl h-fit text-highlight"><MessageSquare className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="text-white font-bold mb-1">WhatsApp Updates</h4>
                                  <p className="text-xs text-text-secondary leading-relaxed">Automated status updates directly to players.</p>
                              </div>
                          </div>
                          <div className="flex gap-4">
                              <div className="bg-highlight/10 p-3 rounded-2xl h-fit text-highlight"><Monitor className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="text-white font-bold mb-1">LED/Projector Screen</h4>
                                  <p className="text-xs text-text-secondary leading-relaxed">Real-time updating screen with multiple design options.</p>
                              </div>
                          </div>
                          <div className="flex gap-4">
                              <div className="bg-highlight/10 p-3 rounded-2xl h-fit text-highlight"><Youtube className="w-5 h-5"/></div>
                              <div>
                                  <h4 className="text-white font-bold mb-1">YouTube Overlay</h4>
                                  <p className="text-xs text-text-secondary leading-relaxed">Professional overlays for live streaming with multiple designs.</p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="mt-16 text-center">
                  <p className="text-text-secondary font-medium mb-6">For more details or to conduct your tournament auction on ThePlayerAuction.com</p>
                  <button onClick={() => window.location.href='mailto:support@theplayerauction.com'} className="bg-highlight hover:bg-teal-400 text-primary font-black px-12 py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm">
                      Contact Us Now
                  </button>
              </div>
          </div>
      </section>

      {/* Legal Section */}
      <section id="legal" className="py-24 bg-secondary/20 border-t border-accent/30">
          <div className="container mx-auto px-6">
              <div className="flex flex-col md:flex-row gap-16 items-start">
                  <div className="md:w-1/3">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="bg-white/10 p-2 rounded-lg"><Scale className="w-6 h-6 text-highlight"/></div>
                          <h2 className="text-3xl font-bold text-white">Platform Rules</h2>
                      </div>
                      <p className="text-text-secondary text-sm leading-relaxed mb-8">
                          To ensure a fair and professional experience for everyone, we've established simple guidelines for organizers and players.
                      </p>
                      <div className="space-y-4">
                          <div className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase tracking-widest"><ShieldCheck className="w-4 h-4 text-green-500"/> Secured Cloud Infrastructure</div>
                          <div className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase tracking-widest"><FileText className="w-4 h-4 text-blue-500"/> GDPR & Data Privacy Complaint</div>
                      </div>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                          <h4 className="text-white font-bold text-lg">Organizer Responsibilities</h4>
                          <p className="text-text-secondary text-sm leading-relaxed">
                              Organizers are responsible for managing their auctions fairly. SM SPORTS provides the tools for management but does not handle local team payments or player salaries.
                          </p>
                      </div>
                      <div className="space-y-4">
                          <h4 className="text-white font-bold text-lg">Privacy Policy</h4>
                          <p className="text-text-secondary text-sm leading-relaxed">
                              Your data is encrypted and secure. We do not sell player contact information or tournament data to third parties. All player photos are stored in secure cloud buckets.
                          </p>
                      </div>
                      <div className="space-y-4">
                          <h4 className="text-white font-bold text-lg">Refund Policy</h4>
                          <p className="text-text-secondary text-sm leading-relaxed">
                              Payments for auction upgrades are non-refundable once the auction features are activated. If you face technical issues, our support team will provide credits for future events.
                          </p>
                      </div>
                      <div className="space-y-4">
                          <h4 className="text-white font-bold text-lg">Content Guidelines</h4>
                          <p className="text-text-secondary text-sm leading-relaxed">
                              Tournament names, team logos, and player photos must comply with local laws. We reserve the right to remove any content that is offensive or illegal.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      <footer className="bg-secondary border-t border-accent py-12 mt-auto">
        <div className="container mx-auto px-6">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              <div><div className="bg-accent/30 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-highlight"><Users /></div><h4 className="text-white font-bold mb-2">Team Management</h4><p className="text-text-secondary text-sm">Owners can manage squads, view budgets, and strategize in real-time.</p></div>
              <div><div className="bg-accent/30 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-highlight"><Trophy /></div><h4 className="text-white font-bold mb-2">Live Bidding</h4><p className="text-text-secondary text-sm">Instant bid reflection for a real-world auction experience.</p></div>
              <div><div className="bg-accent/30 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-highlight"><ShieldCheck /></div><h4 className="text-white font-bold mb-2">Admin Controls</h4><p className="text-text-secondary text-sm">Full control for auctioneers to manage lots and results.</p></div>
              <div><div className="bg-accent/30 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-highlight"><Monitor /></div><h4 className="text-white font-bold mb-2">Live Broadcast</h4><p className="text-text-secondary text-sm">Professional overlays for OBS and Projector screens.</p></div>
           </div>
           
           <div className="border-t border-gray-700 pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="text-text-secondary text-sm font-medium">&copy; 2025 SM SPORTS. All rights reserved.</div>
               <div className="flex flex-wrap justify-center gap-8">
                   <Link to="/guide" className="text-highlight hover:underline text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                       <BookOpen className="w-4 h-4"/> User Manual
                   </Link>
                   <button onClick={() => scrollToSection('pricing')} className="text-text-secondary hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">Pricing</button>
                   <button onClick={() => scrollToSection('legal')} className="text-text-secondary hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">Legal Terms</button>
                   <Link to="/auth" className="text-text-secondary hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">Admin Login</Link>
               </div>
           </div>
        </div>
      </footer>
      <button onClick={() => window.scrollTo({top:0, behavior:'smooth'})} className="fixed bottom-6 right-6 bg-highlight text-primary p-3 rounded-full shadow-2xl z-50 hover:scale-110 active:scale-95 transition-transform"><Smartphone className="w-6 h-6"/></button>
    </div>
  );
};

export default LandingPage;