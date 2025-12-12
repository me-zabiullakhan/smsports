
import React, { useState, useMemo, useEffect } from 'react';
import { useAuction } from '../hooks/useAuction';
import { Player } from '../types';
import { Search, Filter, X, Clock, CheckCircle } from 'lucide-react';
import { db } from '../firebase';

type PlayerStatus = 'upcoming' | 'sold';

const PlayerPool: React.FC = () => {
  const { state, activeAuctionId } = useAuction();
  const { players, teams, currentPlayerIndex, unsoldPlayers } = state;
  const [activeTab, setActiveTab] = useState<PlayerStatus>('upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  // Fetch Roles dynamically to populate filter
  useEffect(() => {
      if(!activeAuctionId) return;
      const unsub = db.collection('auctions').doc(activeAuctionId).collection('roles').onSnapshot(s => {
          setAvailableRoles(s.docs.map(d => d.data().name));
      });
      return () => unsub();
  }, [activeAuctionId]);

  const soldPlayerIds = useMemo(() => new Set(teams.flatMap(team => team.players.map(p => p.id))), [teams]);
  const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

  const filteredPlayers = useMemo(() => {
    let list: (Omit<Player, 'status'> & { status: PlayerStatus, soldTo?: string, teamLogo?: string })[] = [];

    if (activeTab === 'upcoming') {
        list = unsoldPlayers.filter(p => !soldPlayerIds.has(p.id)).map(p => ({ ...p, status: 'upcoming' as PlayerStatus }));
    } else if (activeTab === 'sold') {
        teams.forEach(team => {
            team.players.forEach(player => {
                list.push({ ...player, status: 'sold' as PlayerStatus, soldTo: team.name, teamLogo: team.logoUrl });
            });
        });
    }

    if (selectedRole !== 'All') {
        list = list.filter(p => p.role === selectedRole || (!p.role && p.category === selectedRole)); // Fallback to category if role undefined
    }

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(term));
    }
    
    return list;
  }, [activeTab, players, teams, soldPlayerIds, unsoldPlayers, searchTerm, selectedRole]);

  const TabButton: React.FC<{tab: PlayerStatus, label: string, icon: React.ReactNode}> = ({tab, label, icon}) => (
      <button 
        onClick={() => setActiveTab(tab)}
        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 border-b-2 ${activeTab === tab ? 'border-highlight text-highlight bg-highlight/5' : 'border-transparent text-text-secondary hover:text-white hover:bg-white/5'}`}
      >
          {icon} {label}
      </button>
  );

  return (
    <div className="bg-secondary rounded-xl shadow-xl h-full flex flex-col border border-gray-700 overflow-hidden">
      <div className="p-4 bg-primary/30 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span className="w-1 h-6 bg-highlight rounded-full"></span>Player Pool</h2>
        
        <div className="space-y-3">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-highlight transition-colors" />
                <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-primary border border-gray-600 rounded-lg py-2.5 pl-10 pr-10 text-text-main text-sm focus:outline-none focus:ring-1 focus:ring-highlight focus:border-highlight transition-all" />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400 transition-colors"><X className="h-4 w-4" /></button>}
            </div>

            <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full bg-primary border border-gray-600 rounded-lg py-2.5 pl-10 pr-8 text-text-main text-sm focus:outline-none focus:ring-1 focus:ring-highlight focus:border-highlight appearance-none cursor-pointer transition-all">
                    <option value="All">All Roles</option>
                    {availableRoles.length > 0 ? availableRoles.map((role) => <option key={role} value={role}>{role}</option>) : (
                        // Fallback if no roles defined yet
                        ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'].map(r => <option key={r} value={r}>{r}</option>)
                    )}
                </select>
            </div>
        </div>
      </div>

      <div className="flex border-b border-gray-700 bg-primary/20">
        <TabButton tab="upcoming" label="Upcoming" icon={<Clock className="w-4 h-4"/>} />
        <TabButton tab="sold" label="Sold" icon={<CheckCircle className="w-4 h-4"/>} />
      </div>

      <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
        {filteredPlayers.length > 0 ? (
            <div className="space-y-2">
                {filteredPlayers.map(player => (
                    <div key={player.id} className={`p-3 rounded-lg flex items-center gap-3 transition-all border ${player.id === currentPlayer?.id && activeTab === 'upcoming' ? 'bg-highlight/10 border-highlight shadow-[0_0_10px_rgba(56,178,172,0.2)]' : 'bg-primary/40 border-transparent hover:border-gray-600 hover:bg-primary/60'}`}>
                        <img src={player.photoUrl} alt={player.name} className="w-10 h-10 rounded-full object-cover border border-gray-600"/>
                        <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-text-main text-sm truncate">{player.name}</h4>
                            <div className="flex gap-2 text-xs">
                                <span className="text-highlight font-medium truncate">{player.role}</span>
                                <span className="text-gray-500">|</span>
                                <span className="text-text-secondary truncate">{player.category}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            {player.status === 'upcoming' ? (
                                <span className="inline-block px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 font-mono">{player.basePrice}</span>
                            ) : (
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Sold To</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {player.teamLogo && <img src={player.teamLogo} alt="" className="w-4 h-4 rounded-full bg-gray-800" />}
                                        <span className="text-xs font-bold text-highlight truncate max-w-[80px]">{player.soldTo}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50">
                <Search className="w-8 h-8 mb-2" />
                <p className="text-sm">No players found</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default PlayerPool;
