
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, AuctionSetup } from '../types';
import { Play, Calendar, History, ArrowRight, Shield, Trophy, Users } from 'lucide-react';
import { db } from '../firebase';

// Helper Component to fetch team count for individual cards
const AuctionCard: React.FC<{ auction: AuctionSetup, navigate: (path: string) => void, getStatusBadge: (status: string) => React.ReactNode }> = ({ auction, navigate, getStatusBadge }) => {
    const [teamCount, setTeamCount] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;
        const fetchCount = async () => {
            if (!auction.id) return;
            try {
                // COMPAT SYNTAX
                const snap = await db.collection('auctions').doc(auction.id).collection('teams').get();
                if (mounted) setTeamCount(snap.size);
            } catch (e) {
                console.error("Error fetching team count", e);
            }
        };
        fetchCount();
        return () => { mounted = false; };
    }, [auction.id]);

    const isRegOpen = auction.registrationConfig?.isEnabled;

    return (
        <div className="bg-secondary border border-accent rounded-xl p-6 hover:border-highlight transition-all flex flex-col relative overflow-hidden group">
            {getStatusBadge(auction.status)}
            
            <div className="flex justify-between items-start mb-2 mt-2">
                <h3 className="text-xl font-bold text-white">{auction.title}</h3>
                <button onClick={() => navigate(`/auction/${auction.id}`)} className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded">View Room</button>
            </div>
            
            <div className="text-text-secondary text-sm mb-4 flex items-center gap-2">
                {isRegOpen ? (
                    <span className="text-green-400 font-bold text-[10px] uppercase border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded">Reg Open</span>
                ) : (
                    <span className="text-gray-500 font-bold text-[10px] uppercase border border-gray-500/30 bg-gray-500/10 px-2 py-0.5 rounded">Reg Closed</span>
                )}
                <span className="text-gray-600">•</span>
                <span>{teamCount !== null ? teamCount : '-'} / {auction.totalTeams} Teams</span>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-700 flex justify-between items-center text-xs text-text-secondary">
                <span>Starts: {auction.date || 'TBA'}</span>
                <div className="flex gap-2">
                <span className="bg-accent px-2 py-1 rounded text-white">{auction.sport}</span>
                {isRegOpen && (
                    <button onClick={() => navigate(`/auction/${auction.id}/register`)} className="text-highlight hover:underline font-bold">Register Player</button>
                )}
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

  useEffect(() => {
      setLoading(true);
      // COMPAT SYNTAX - Real-time listener
      const unsubscribe = db.collection('auctions').onSnapshot((snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
          
          // Sort by createdAt descending (newest first)
          data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

          // Filter for active/upcoming auctions
          // We include DRAFT, NOT_STARTED, LIVE, and IN_PROGRESS
          const active = data.filter(a => {
              const s = (a.status || '').toUpperCase();
              return s === 'DRAFT' || s === 'LIVE' || s === 'NOT_STARTED' || s === 'IN_PROGRESS';
          });

          // Filter for completed auctions
          const past = data.filter(a => {
              const s = (a.status || '').toUpperCase();
              return s === 'COMPLETED' || s === 'FINISHED';
          });

          setUpcomingAuctions(active);
          setPastAuctions(past);
          setLoading(false);
      }, (error: any) => {
          console.error("Error fetching landing page data", error);
          setLoading(false);
      });

      return () => unsubscribe();
  }, []);

  const getStatusBadge = (status: string) => {
      const s = (status || '').toUpperCase();
      if (s === 'IN_PROGRESS' || s === 'LIVE') {
          return <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 animate-pulse">LIVE NOW</div>;
      }
      if (s === 'NOT_STARTED') {
          return <div className="absolute top-0 right-0 bg-green-600 text-white text-xs font-bold px-3 py-1">READY TO START</div>;
      }
      return null; // Draft doesn't need a badge
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col font-sans">
      {/* Navbar */}
      <nav className="border-b border-accent bg-secondary/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-highlight" />
            <span className="text-2xl font-bold text-white tracking-wider">SM SPORTS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-text-secondary hover:text-white transition-colors text-sm font-semibold">Team Login</Link>
            {/* Generic Link */}
            <Link to="/auth" className="bg-highlight hover:bg-teal-400 text-primary font-bold py-2 px-5 rounded-lg transition-all shadow-lg shadow-highlight/20 text-sm">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/20 via-primary to-primary"></div>
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-accent/50 border border-accent text-highlight text-xs font-bold tracking-widest uppercase">
            The Future of Sports Bidding
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight">
            Manage Your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-highlight to-teal-200">Cricket Auctions</span>
            <br/> Professionally
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Experience the thrill of a real-time auction room. Organize players, manage team budgets, and bid live with our advanced auction platform designed for sports enthusiasts.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/auth" className="flex items-center justify-center bg-white text-primary font-bold py-4 px-8 rounded-xl hover:bg-gray-100 transition-all shadow-xl">
              <Play className="w-5 h-5 mr-2 fill-current" /> Admin/Team Login
            </Link>
          </div>
        </div>
      </header>

      {/* Auctions Grid */}
      <section className="py-20 bg-secondary/30 border-t border-accent/50">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-bold text-white">Auction Center</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Upcoming / Live */}
            <div className="flex flex-col gap-4">
               <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center">
                 <Calendar className="w-4 h-4 mr-2" /> Live & Upcoming
               </h4>
               
               {loading ? (
                   <div className="text-text-secondary text-sm animate-pulse">Loading upcoming events...</div>
               ) : upcomingAuctions.length > 0 ? (
                   upcomingAuctions.map(auction => (
                       <AuctionCard 
                           key={auction.id} 
                           auction={auction} 
                           navigate={navigate} 
                           getStatusBadge={getStatusBadge} 
                       />
                   ))
               ) : (
                   <div className="bg-secondary/50 border border-dashed border-gray-700 rounded-xl p-6 text-center text-text-secondary text-sm">
                       No upcoming auctions scheduled.
                   </div>
               )}
            </div>

            {/* Past */}
            <div className="flex flex-col gap-4">
               <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center">
                 <History className="w-4 h-4 mr-2" /> Past Results
               </h4>
               
               {loading ? (
                   <div className="text-text-secondary text-sm animate-pulse">Loading results...</div>
               ) : pastAuctions.length > 0 ? (
                   pastAuctions.map(auction => (
                       <div key={auction.id} className="bg-secondary border border-accent rounded-xl p-6 opacity-80 hover:opacity-100 transition-all group">
                          <h3 className="text-xl font-bold text-white mb-2">{auction.title}</h3>
                          <p className="text-text-secondary text-sm mb-4">Completed {auction.date}</p>
                          <div className="mt-auto pt-4 border-t border-gray-700 flex justify-between items-center text-xs text-text-secondary">
                             <span>{auction.sport}</span>
                             <button 
                                onClick={() => navigate(`/auction/${auction.id}`)}
                                className="text-green-400 hover:text-green-300 cursor-pointer font-bold hover:underline bg-transparent border-none p-0"
                             >
                                View Stats
                             </button>
                          </div>
                       </div>
                   ))
               ) : (
                   <div className="bg-secondary/50 border border-dashed border-gray-700 rounded-xl p-6 text-center text-text-secondary text-sm">
                       No past auction results found.
                   </div>
               )}
            </div>

          </div>
        </div>
      </section>

      {/* Features Footer */}
      <footer id="features" className="bg-secondary border-t border-accent py-12 mt-auto">
        <div className="container mx-auto px-6">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                 <div className="bg-accent/30 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-highlight">
                    <Users />
                 </div>
                 <h4 className="text-white font-bold mb-2">Team Management</h4>
                 <p className="text-text-secondary text-sm">Owners can manage squads, view budgets, and strategize in real-time.</p>
              </div>
              <div>
                 <div className="bg-accent/30 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-highlight">
                    <Trophy />
                 </div>
                 <h4 className="text-white font-bold mb-2">Live Bidding</h4>
                 <p className="text-text-secondary text-sm">Low latency websocket-like updates powered by Firestore for instant bid reflection.</p>
              </div>
              <div>
                 <div className="bg-accent/30 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-highlight">
                    <Shield />
                 </div>
                 <h4 className="text-white font-bold mb-2">Admin Controls</h4>
                 <p className="text-text-secondary text-sm">Full control for auctioneers to sell, pass, or reset players instantly.</p>
              </div>
              <div>
                 <div className="bg-accent/30 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-highlight">
                    <Play />
                 </div>
                 <h4 className="text-white font-bold mb-2">OBS Integration</h4>
                 <p className="text-text-secondary text-sm">Broadcast professional overlays directly to your stream with our dedicated view.</p>
              </div>
           </div>
           <div className="border-t border-gray-700 pt-8 text-center text-text-secondary text-sm">
              &copy; 2025 SM SPORTS. All rights reserved.
           </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
