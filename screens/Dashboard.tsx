
import React, { useEffect } from 'react';
import LiveAdminPanel from '../components/LiveAdminPanel';
import AuctionRoom from './AuctionRoom';
import TeamPostAuctionView from '../components/TeamPostAuctionView';
import AdminPostAuctionView from '../components/AdminPostAuctionView';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, UserRole } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Wallet, Users, LogOut } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { state, userProfile, logout, error, joinAuction } = useAuction();
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();

  // Initialize Auction Room with ID
  useEffect(() => {
      if (auctionId) {
          joinAuction(auctionId);
      }
  }, [auctionId]);

  const isAdmin = userProfile?.role === UserRole.ADMIN;
  const isTeamOwner = userProfile?.role === UserRole.TEAM_OWNER;
  
  // Get User's Team Data if Owner
  const myTeam = isTeamOwner ? state.teams.find(t => t.id === userProfile.teamId) : null;
  const roleDisplay = myTeam ? myTeam.name : (userProfile ? userProfile.role.replace('_', ' ') : 'Viewer');

  return (
    <div className="min-h-screen bg-primary font-sans flex flex-col">
      {error && (
        <div className="bg-red-600 text-white p-3 text-center font-bold flex items-center justify-center gap-2">
           <AlertTriangle className="w-5 h-5" />
           <span>{error}</span>
           <a 
             href="https://console.firebase.google.com" 
             target="_blank" 
             rel="noreferrer" 
             className="underline ml-2 text-red-100 hover:text-white"
           >
             Open Firebase Console
           </a>
        </div>
      )}
      <header className="bg-secondary shadow-md border-b border-accent sticky top-0 z-40">
        <div className="container mx-auto px-4 py-2 flex justify-between items-center">
          
          {/* Left: Branding / Team Info */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
             {isTeamOwner && myTeam && myTeam.logoUrl ? (
                 <img 
                    src={myTeam.logoUrl} 
                    alt={myTeam.name} 
                    className="w-12 h-12 rounded-full bg-white p-1 object-contain border-2 border-highlight" 
                 />
             ) : (
                 <h1 className="text-2xl font-bold text-highlight tracking-wider hidden sm:block">🏏 SM SPORTS</h1>
             )}
             
             <div className="flex flex-col">
                 {isTeamOwner && myTeam ? (
                     <>
                        <span className="text-lg md:text-xl font-black text-white leading-tight uppercase tracking-wide">{myTeam.name}</span>
                        <span className="text-[10px] text-highlight uppercase font-bold tracking-widest">Team Owner Dashboard</span>
                     </>
                 ) : (
                     <>
                        <span className="text-lg font-bold text-white sm:hidden">SM SPORTS</span>
                        <span className="text-xs text-text-secondary uppercase bg-accent/50 px-2 py-0.5 rounded w-fit">
                            {userProfile?.role === UserRole.ADMIN ? 'Administrator' : 'Spectator View'}
                        </span>
                     </>
                 )}
             </div>
          </div>

           {/* Center/Right: Stats for Team Owner */}
           {isTeamOwner && myTeam && state.status !== AuctionStatus.Finished && (
               <div className="flex items-center gap-2 md:gap-6 bg-gray-800/80 px-4 py-2 rounded-lg border border-gray-600 shadow-inner ml-auto mr-2">
                   <div className="flex flex-col md:flex-row md:items-center text-sm text-text-secondary">
                       <div className="flex items-center">
                           <Wallet className="w-4 h-4 mr-1 md:mr-2 text-green-400" />
                           <span className="hidden md:inline mr-1 uppercase text-xs font-bold">Remaining:</span>
                       </div>
                       <b className="text-green-400 text-lg md:text-xl font-mono leading-none">{myTeam.budget}</b>
                   </div>
                   
                   <div className="w-px h-6 bg-gray-600 hidden md:block"></div>
                   
                   <div className="hidden md:flex items-center text-sm text-text-secondary">
                       <Users className="w-4 h-4 mr-2 text-blue-400" />
                       <span className="mr-1 uppercase text-xs font-bold">Squad:</span>
                       <b className="text-white text-xl font-mono leading-none">{myTeam.players.length}</b>
                   </div>
               </div>
           )}

           {/* Right: Actions */}
           <div className="flex items-center space-x-4">
             {/* Status Badge */}
             <div className="hidden lg:block text-right">
                <p className="text-[10px] text-text-secondary uppercase tracking-widest">Auction Status</p>
                <div className="flex items-center justify-end gap-2">
                    <span className={`h-2 w-2 rounded-full ${state.status === AuctionStatus.InProgress ? 'bg-green-500 animate-pulse-fast' : state.status === AuctionStatus.Finished ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                    <p className={`font-bold text-sm ${state.status === AuctionStatus.InProgress ? 'text-green-400' : state.status === AuctionStatus.Finished ? 'text-red-400' : 'text-yellow-400'}`}>
                        {state.status.replace('_', ' ')}
                    </p>
                </div>
             </div>
             
             {userProfile ? (
                 <button 
                    onClick={() => { logout(); navigate('/'); }} 
                    className="text-gray-400 hover:text-red-400 transition-colors p-2"
                    title="Sign Out"
                 >
                    <LogOut className="w-5 h-5" />
                 </button>
             ) : (
                 <button onClick={() => navigate('/auth')} className="bg-highlight hover:bg-teal-400 text-primary font-bold py-2 px-4 rounded-lg text-sm transition-all">
                    Login
                 </button>
             )}
           </div>
        </div>
      </header>
      
      {/* Mobile Status Bar */}
      <div className="lg:hidden bg-secondary/50 border-b border-gray-700 px-4 py-1 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${state.status === AuctionStatus.InProgress ? 'bg-green-500 animate-pulse-fast' : 'bg-yellow-500'}`}></span>
                <span className="text-gray-300 uppercase font-semibold">{state.status.replace('_', ' ')}</span>
          </div>
          <div className="text-gray-400">
              {isAdmin ? 'Admin Mode' : (isTeamOwner ? 'Live Bidding Enabled' : 'Read Only')}
          </div>
      </div>

      <main className="container mx-auto p-2 md:p-6 flex-grow">
        {state.status === AuctionStatus.Finished ? (
            // Finished View Logic
            isTeamOwner && myTeam ? (
                <TeamPostAuctionView team={myTeam} />
            ) : (
                // Use AdminPostAuctionView for BOTH Admins and Public Viewers.
                // The component internally handles Admin-only features (like Export).
                <AdminPostAuctionView />
            )
        ) : isAdmin ? (
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                <div className="lg:col-span-3">
                    <AuctionRoom />
                </div>
                <div className="lg:col-span-1">
                    <LiveAdminPanel />
                </div>
            </div>
        ) : (
            <div className="h-full">
                 <AuctionRoom />
            </div>
        )}
      </main>
      <footer className="text-center py-3 border-t border-accent text-text-secondary text-xs bg-secondary">
        <p>SM SPORTS • Live Auction System • <a href={`/#/obs-overlay/${auctionId}`} target="_blank" className="text-highlight hover:underline">Open OBS Overlay</a></p>
      </footer>
    </div>
  );
};

export default Dashboard;
