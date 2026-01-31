
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { AuctionSetup } from '../types';
import { Play, Calendar, History, Trophy, Users, BookOpen, CheckCircle, Scale, CreditCard, ShieldCheck, FileText, Zap, Star, Monitor, MessageSquare, Smartphone, Layout, Youtube, ChevronRight, UserPlus } from 'lucide-react';
import { db } from '../firebase';

const CricketBallIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2C12 2 15 7 15 12C15 17 12 22 12 22" fill="none" stroke="white" strokeWidth="0.5" opacity="0.5" />
        <path d="M12 2C12 2 9 7 9 12C9 17 12 22 12 22" fill="none" stroke="white" strokeWidth="0.5" opacity="0.5" />
    </svg>
);

const AuctionCard: React.FC<{ auction: AuctionSetup, navigate: (path: string) => void, getStatusBadge: (status: string) => React.ReactNode, index: number }> = ({ auction, navigate, getStatusBadge, index }) => {
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
        <div 
            className="bg-secondary border border-accent rounded-xl p-6 hover:border-highlight transition-all flex flex-col relative overflow-hidden group shadow-lg reveal-element"
            style={{ transitionDelay: `${(index % 4) * 150}ms` }}
        >
            {getStatusBadge(auction.status)}
            <div className="flex justify-between items-start mb-2 mt-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{auction.title}</h3>
                <button onClick={() => navigate(`/auction/${auction.id}`)} className="bg-white/10 hover:bg-highlight hover:text-primary text-white text-[10px] font-black uppercase px-3 py-1.5 rounded transition-colors">Terminal</button>
            </div>
            <div className="text-text-secondary text-sm mb-4 flex items-center gap-2 font-medium">
                {(isRegOpen && isPublicReg) ? <span className="text-green-400 font-bold text-[9px] uppercase border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded tracking-widest">Reg Open</span> : (isRegOpen && !isPublicReg) ? <span className="text-blue-400 font-bold text-[9px] uppercase border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded tracking-widest">Private</span> : <span className="text-gray-500 font-bold text-[9px] uppercase border border-gray-500/30 bg-gray-500/10 px-2 py-0.5 rounded tracking-widest">Closed</span>}
                <span className="text-gray-600 opacity-30">•</span>
                <span className="text-[11px] font-bold uppercase tracking-wider">{teamCount !== null ? teamCount : '-'} / {auction.totalTeams} Teams</span>
            </div>
            <div className="mt-auto pt-4 border-t border-gray-700/50 flex justify-between items-center text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                <span>Starts: {auction.date || 'TBA'}</span>
                <div className="flex gap-2">
                    {isRegOpen && isPublicReg && <button onClick={() => navigate(`/auction/${auction.id}/register`)} className="text-highlight hover:text-white transition-colors">Join League</button>}
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
      { name: 'Starter Free', price: 0, teams: 2, badge: 'Standard' },
      { name: 'Silver Pro', price: 3000, teams: 4, badge: 'Professional' },
      { name: 'Gold Elite', price: 4000, teams: 6, badge: 'Premium' },
      { name: 'Diamond Master', price: 5000, teams: 10, badge: 'Elite' },
      { name: 'Platinum Ultimate', price: 6000, teams: 15, badge: 'Master' },
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
      if (s === 'IN_PROGRESS' || s === 'LIVE') return <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black tracking-[0.2em] px-3 py-1 animate-pulse z-10">LIVE PROTOCOL</div>;
      if (s === 'NOT_STARTED') return <div className="absolute top-0 right-0 bg-green-600 text-white text-[8px] font-black tracking-[0.2em] px-3 py-1 z-10">UPCOMING</div>;
      return null;
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[20%] left-[5%] animate-float opacity-10">
              <CricketBallIcon className="w-16 h-16 text-red-500" />
          </div>
          <div className="absolute top-[60%] right-[10%] animate-float opacity-10" style={{ animationDelay: '2s' }}>
              <Zap className="w-24 h-24 text-highlight" />
          </div>
          <div className="absolute top-[40%] left-[50%] animate-drift text-highlight font-black text-6xl select-none" style={{ animationDelay: '0s' }}>6</div>
          <div className="absolute top-[15%] left-[20%] animate-drift text-white font-black text-4xl select-none" style={{ animationDelay: '4s' }}>4</div>
          <div className="absolute top-[75%] left-[30%] animate-drift text-red-500 font-black text-5xl select-none" style={{ animationDelay: '8s' }}>W</div>
      </div>

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
            <span className="text-xl font-bold text-white tracking-wider hidden sm:inline uppercase">SM SPORTS</span>
          </div>
          <div className="flex items-center gap-4 md:gap-8">
            <button onClick={() => scrollToSection('pricing')} className="text-text-secondary hover:text-white transition-colors text-[11px] font-black uppercase tracking-widest hidden md:block">Pricing</button>
            <button onClick={() => scrollToSection('legal')} className="text-text-secondary hover:text-white transition-colors text-[11px] font-black uppercase tracking-widest hidden md:block">Policies</button>
            <Link to="/auth" className="bg-highlight hover:bg-teal-400 text-primary font-black py-2 px-6 rounded-xl transition-all shadow-lg shadow-highlight/20 text-[11px] uppercase tracking-[0.2em]">Launch OS</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden py-24 lg:py-40">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/20 via-primary to-primary"></div>
        
        <div className="absolute top-1/2 left-0 w-full flex justify-around opacity-5 pointer-events-none">
             <div className="animate-spin-slow"><CricketBallIcon className="w-64 h-64 text-red-600" /></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="reveal-element inline-block mb-6 px-4 py-1.5 rounded-full bg-accent/30 border border-highlight/30 text-highlight text-[10px] font-black tracking-[0.3em] uppercase">The Digital Pitch is Ready</div>
          <h1 className="reveal-element text-5xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-none" style={{ transitionDelay: '200ms' }}>
            YOUR AUCTION <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-highlight to-teal-100 italic">TRANSMITTED LIVE</span>
          </h1>
          <p className="reveal-element text-lg text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed font-medium" style={{ transitionDelay: '400ms' }}>
            Professional-grade cricket auction management with real-time budgets, OBS integration, and automated player registration protocols.
          </p>
          <div className="reveal-element flex flex-col sm:flex-row justify-center gap-5" style={{ transitionDelay: '600ms' }}>
            <Link to="/auth?tab=admin&mode=register" className="flex items-center justify-center bg-white text-primary font-black py-5 px-10 rounded-2xl hover:bg-highlight hover:text-white transition-all shadow-2xl group text-xs uppercase tracking-widest">
                <Play className="w-4 h-4 mr-3 fill-current group-hover:scale-125 transition-transform" /> Initialize Event
            </Link>
            <button onClick={() => scrollToSection('pricing')} className="flex items-center justify-center bg-secondary border border-accent text-white font-black py-5 px-10 rounded-2xl hover:bg-accent transition-all shadow-xl text-xs uppercase tracking-widest">
                Explore Protocols
            </button>
          </div>
        </div>
      </header>

      {/* Auction Center */}
      <section className="py-24 bg-secondary/30 border-t border-accent/50 relative">
        <div className="container mx-auto px-6">
          <div className="reveal-element flex items-center justify-between mb-16 border-l-4 border-highlight pl-8">
            <div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Match Registry</h2>
              <p className="text-text-secondary text-xs font-bold uppercase tracking-widest mt-2">Active Tournament Instances</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="flex flex-col gap-6">
               <h4 className="reveal-element text-[10px] font-black text-highlight uppercase tracking-[0.4em] flex items-center mb-2"><Calendar className="w-4 h-4 mr-3" /> Live & Upcoming Transmission</h4>
               {loading ? (
                 <div className="space-y-4">
                    {[1,2].map(i => <div key={i} className="h-32 bg-secondary animate-pulse rounded-xl border border-accent/20"></div>)}
                 </div>
               ) : upcomingAuctions.length > 0 ? (
                   upcomingAuctions.map((auction, idx) => (
                       <AuctionCard key={auction.id} auction={auction} navigate={navigate} getStatusBadge={getStatusBadge} index={idx} />
                   ))
               ) : (
                   <div className="reveal-element bg-secondary/50 border border-dashed border-gray-700 rounded-2xl p-10 text-center text-text-secondary text-xs font-black uppercase tracking-widest opacity-50">No active events in transmission</div>
               )}
            </div>
            <div className="flex flex-col gap-6">
               <h4 className="reveal-element text-[10px] font-black text-text-secondary uppercase tracking-[0.4em] flex items-center mb-2"><History className="w-4 h-4 mr-3" /> Historical Archive</h4>
               {loading ? (
                 <div className="space-y-4">
                    {[1,2].map(i => <div key={i} className="h-32 bg-secondary animate-pulse rounded-xl border border-accent/10 opacity-30"></div>)}
                 </div>
               ) : pastAuctions.length > 0 ? (
                   pastAuctions.map((auction, idx) => (
                    <div 
                        key={auction.id} 
                        className="bg-secondary border border-accent rounded-xl p-6 opacity-60 hover:opacity-100 transition-all group shadow-md reveal-element"
                        style={{ transitionDelay: `${(idx % 4) * 150}ms` }}
                    >
                        <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tight">{auction.title}</h3>
                        <p className="text-text-secondary text-[10px] font-bold uppercase tracking-widest mb-4">Transmission Ended • {auction.date}</p>
                        <div className="mt-auto pt-4 border-t border-gray-700/50 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                            <span className="bg-accent/50 px-2 py-1 rounded text-gray-400">{auction.sport}</span>
                            <button onClick={() => navigate(`/auction/${auction.id}`)} className="text-green-400 hover:text-white transition-colors flex items-center gap-2">Protocol Logs <ChevronRight className="w-3 h-3"/></button>
                        </div>
                    </div>
                   ))
               ) : (
                   <div className="reveal-element bg-secondary/50 border border-dashed border-gray-700 rounded-2xl p-10 text-center text-text-secondary text-xs font-black uppercase tracking-widest opacity-50">Archive directory empty</div>
               )}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 bg-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-highlight/5 rounded-full blur-[150px] -mr-64 -mt-64"></div>
          <div className="container mx-auto px-6 relative z-10 text-center">
              <div className="reveal-element max-w-2xl mx-auto mb-20">
                  <h2 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter">SELECT YOUR TIER</h2>
                  <p className="text-text-secondary font-medium tracking-wide">Standardized operational protocols for tournaments of every magnitude.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
                  {PLANS.map((plan, i) => (
                      <div 
                        key={i} 
                        className={`bg-secondary border ${plan.price === 5000 ? 'border-highlight ring-4 ring-highlight/10 scale-[1.05]' : 'border-accent'} rounded-[2.5rem] p-10 flex flex-col hover:border-gray-500 transition-all group relative overflow-hidden shadow-2xl reveal-element`}
                        style={{ transitionDelay: `${i * 150}ms` }}
                      >
                          {plan.price === 5000 && <div className="absolute top-6 right-8"><Zap className="w-6 h-6 text-highlight fill-current animate-pulse"/></div>}
                          <div className="text-highlight text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-left">{plan.badge} Protocol</div>
                          <h3 className="text-3xl font-black text-white mb-10 text-left uppercase tracking-tight">{plan.name}</h3>
                          <div className="flex items-baseline mb-12 border-b border-white/5 pb-8">
                              <span className="text-5xl font-black text-white">₹{plan.price}</span>
                              <span className="text-[10px] text-gray-500 font-black ml-2 uppercase tracking-widest">/ instance</span>
                          </div>
                          <div className="space-y-5 mb-12 flex-grow text-left">
                              <div className="flex items-center gap-4 text-sm text-gray-300 font-bold uppercase tracking-widest">
                                  <Users className="w-5 h-5 text-highlight"/>
                                  Capacity: {plan.teams} Teams
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500 font-bold uppercase tracking-widest">
                                  <CheckCircle className="w-4 h-4 text-green-500"/>
                                  {plan.price === 0 ? 'Standard Interface' : 'Full Command Suite'}
                              </div>
                          </div>
                          <Link to="/auth?tab=admin&mode=register" className={`w-full py-5 rounded-2xl text-center text-[10px] font-black uppercase tracking-[0.2em] transition-all ${plan.price === 5000 ? 'bg-highlight text-primary hover:bg-white shadow-xl' : 'bg-accent/40 text-white hover:bg-accent'}`}>
                              Deploy License
                          </Link>
                      </div>
                  ))}

                  <div 
                    className="bg-gradient-to-br from-secondary to-black border border-accent rounded-[2.5rem] p-10 flex flex-col hover:border-highlight transition-all shadow-2xl reveal-element"
                    style={{ transitionDelay: '600ms' }}
                  >
                      <div className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-left">Enterprise Protocol</div>
                      <h3 className="text-3xl font-black text-white mb-10 text-left uppercase tracking-tight">MEGALEAGUE</h3>
                      <div className="text-2xl font-black text-white mb-12 h-[61px] flex items-center">Secure Custom Quote</div>
                      <p className="text-[11px] text-gray-500 font-bold mb-12 flex-grow leading-relaxed uppercase tracking-widest text-left">Unlimited teams, dedicated field support, and custom broadcast overlays for large scale federations.</p>
                      <button onClick={() => window.location.href='mailto:send.smsports@gmail.com'} className="w-full bg-white text-primary font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-highlight hover:text-white transition-all">
                          Contact Staff
                      </button>
                  </div>
              </div>

              {/* All Paid Plans Feature Highlight */}
              <div className="bg-secondary/20 border border-highlight/20 rounded-[3rem] p-12 md:p-20 relative overflow-hidden backdrop-blur-xl reveal-element">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Star className="w-64 h-64 text-highlight" />
                  </div>
                  <div className="max-w-4xl mx-auto relative z-10">
                      <h3 className="text-3xl md:text-5xl font-black text-white mb-16 border-l-8 border-highlight pl-10 text-left uppercase tracking-tighter reveal-element">AUTHORIZED <br/> COMMAND FEATURES</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 text-left">
                          {[
                              { icon: <UserPlus className="w-6 h-6"/>, title: "Automated Enrollment", desc: "Public player registration portals with verified payment protocols." },
                              { icon: <Layout className="w-6 h-6"/>, title: "Spectator Hub", desc: "Dedicated web interfaces for team owners and live audiences." },
                              { icon: <Zap className="w-6 h-6"/>, title: "Logic Engine", desc: "Real-time budget tracking and automated squad verification." },
                              { icon: <MessageSquare className="w-6 h-6"/>, title: "Broadcast Sync", desc: "Automated WhatsApp status updates and match logs for participants." },
                              { icon: <Monitor className="w-6 h-6"/>, title: "Stadium Views", desc: "Ultra-low latency projector views and live bidding visualizers." },
                              { icon: <Youtube className="w-6 h-6"/>, title: "OBS Integration", desc: "Professional stream overlays with dynamic player cards for OBS." }
                          ].map((feat, idx) => (
                              <div key={idx} className="flex gap-6 group reveal-element" style={{ transitionDelay: `${idx * 100}ms` }}>
                                  <div className="bg-highlight/10 p-4 rounded-2xl h-fit text-highlight border border-highlight/20 group-hover:bg-highlight group-hover:text-primary transition-all">{feat.icon}</div>
                                  <div>
                                      <h4 className="text-white font-black text-xs uppercase tracking-widest mb-2">{feat.title}</h4>
                                      <p className="text-[10px] text-text-secondary leading-relaxed font-bold uppercase opacity-60">{feat.desc}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="mt-24 text-center">
                  <p className="text-text-secondary font-black text-[10px] uppercase tracking-[0.5em] mb-10 reveal-element">Transmission Authority verified</p>
                  <button onClick={() => window.location.href='mailto:send.smsports@gmail.com'} className="bg-white hover:bg-highlight text-primary hover:text-white font-black px-16 py-5 rounded-2xl shadow-2xl transition-all active:scale-95 uppercase tracking-[0.2em] text-xs reveal-element">
                      Consult Protocol Officer
                  </button>
              </div>
          </div>
      </section>

      {/* Legal Section */}
      <section id="legal" className="py-32 bg-secondary/10 border-t border-accent/20 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 opacity-5 translate-y-1/2">
               <CricketBallIcon className="w-full h-full text-white" />
          </div>
          <div className="container mx-auto px-6 relative z-10">
              <div className="flex flex-col md:flex-row gap-20 items-start">
                  <div className="md:w-1/3 reveal-element">
                      <div className="flex items-center gap-4 mb-8">
                          <div className="bg-highlight/10 p-3 rounded-xl border border-highlight/20"><Scale className="w-8 h-8 text-highlight"/></div>
                          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Security <br/> Protocols</h2>
                      </div>
                      <p className="text-text-secondary text-sm leading-relaxed mb-10 font-medium italic opacity-70">
                          Ensuring technical integrity and operational compliance across all digital tournament environments.
                      </p>
                      <div className="space-y-5">
                          <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"><ShieldCheck className="w-5 h-5 text-green-500"/> Secured Cloud Infrastructure v4</div>
                          <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"><FileText className="w-5 h-5 text-blue-500"/> Privacy Shield Authorized</div>
                      </div>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-12">
                      {[
                        { title: "Operational Responsibility", desc: "Event leads are authorized to manage their local instances. SM SPORTS provides the OS and hardware bridges but does not regulate independent financial contracts." },
                        { title: "Data Retention", desc: "System telemetry and player profiles are encrypted. Registry data is archived strictly for administrative verification and historical match logging." },
                        { title: "Refund Protocol", desc: "License deployments are final once instance transmission begins. Operational credits may be issued for system-side interruptions only." },
                        { title: "Content Authority", desc: "Administrator accounts must verify that all tournament assets (logos, photos) comply with the Standard Integrity Guidelines." }
                      ].map((policy, idx) => (
                        <div key={idx} className="space-y-5 reveal-element" style={{ transitionDelay: `${idx * 150}ms` }}>
                            <h4 className="text-highlight font-black text-[10px] uppercase tracking-[0.3em]">{policy.title}</h4>
                            <p className="text-text-secondary text-xs leading-relaxed font-bold uppercase opacity-60">{policy.desc}</p>
                        </div>
                      ))}
                  </div>
              </div>
          </div>
      </section>

      <footer className="bg-secondary border-t border-accent/50 py-20 mt-auto relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
              {[
                { icon: <Users />, title: "Command Center", desc: "Remote team management and budget synchronization terminals." },
                { icon: <Trophy />, title: "Live Transmission", desc: "Instant visual reflection of all bidding activity across the OS." },
                { icon: <ShieldCheck />, title: "Root Control", desc: "Master override authority for auctioneers and field stewards." },
                { icon: <Monitor />, title: "Broadcast Engine", desc: "Industrial-grade stream overlays for professional broadcasting." }
              ].map((item, idx) => (
                <div key={idx} className="reveal-element" style={{ transitionDelay: `${idx * 150}ms` }}>
                    <div className="bg-accent/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-highlight border border-white/5">{item.icon}</div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-4">{item.title}</h4>
                    <p className="text-text-secondary text-[11px] font-bold uppercase opacity-60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
           </div>
           
           <div className="border-t border-gray-800 pt-12 flex flex-col lg:flex-row justify-between items-center gap-10">
               <div className="text-gray-500 text-[11px] font-black uppercase tracking-[0.2em] reveal-element">&copy; 2025 SM SPORTS. All digital assets protected.</div>
               <div className="flex flex-wrap justify-center gap-8 reveal-element">
                   <Link to="/guide" className="text-highlight hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
                       <BookOpen className="w-4 h-4"/> Field Guide
                   </Link>
                   <button onClick={() => scrollToSection('pricing')} className="text-text-secondary hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Licensing</button>
                   <button onClick={() => scrollToSection('legal')} className="text-text-secondary hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Integrity</button>
                   <Link to="/stafflogin" className="text-gray-600 hover:text-blue-400 text-[10px] font-black uppercase tracking-widest transition-colors">Staff Entrance</Link>
               </div>
           </div>
        </div>
      </footer>

      {/* Owner Attribution Highlighting */}
      <div className="bg-highlight/10 py-8 border-t border-highlight/20 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-highlight/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          <p className="text-text-secondary text-[10px] font-black uppercase tracking-[0.6em] relative z-10 reveal-element">
              System Architecture by <span className="text-highlight font-black border-b-2 border-highlight/30 pb-0.5 group-hover:border-highlight transition-colors">Zabiulla Khan</span>
          </p>
      </div>

      <button onClick={() => window.scrollTo({top:0, behavior:'smooth'})} className="fixed bottom-6 right-6 bg-highlight text-primary p-4 rounded-full shadow-2xl z-50 hover:scale-110 active:scale-95 transition-transform hover:bg-white shadow-highlight/20 border-4 border-primary"><Smartphone className="w-5 h-5"/></button>
    </div>
  );
};

export default LandingPage;
