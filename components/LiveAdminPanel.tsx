
import React, { useState, useEffect, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, Team, Player, ProjectorLayout, OBSLayout, BiddingStatus } from '../types';
import { Play, Check, X, ArrowLeft, Loader2, RotateCcw, AlertOctagon, DollarSign, Cast, Lock, Unlock, Monitor, ChevronDown, ChevronUp, Shuffle, Search, User, Palette, Trophy, Gavel, Settings, List, TrendingUp, Users, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LiveAdminPanel: React.FC = () => {
  const { state, sellPlayer, passPlayer, startAuction, endAuction, resetAuction, resetCurrentPlayer, resetUnsoldPlayers, updateBiddingStatus, toggleSelectionMode, updateTheme, activeAuctionId, placeBid, nextBid, setAdminView } = useAuction();
  const { teams, players, biddingStatus, playerSelectionMode, adminViewOverride } = state;
  const navigate = useNavigate();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSellingMode, setIsSellingMode] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [manualPlayerId, setManualPlayerId] = useState<string>('');
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  
  // Settings Drawer State
  const [showSettings, setShowSettings] = useState(false);
  
  // Media Control State
  const [squadViewTeamId, setSquadViewTeamId] = useState('');

  // Derived State
  const availablePlayersCount = useMemo(() => players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD').length, [players]);
  const unsoldCount = useMemo(() => players.filter(p => p.status === 'UNSOLD').length, [players]);
  const isRoundActive = state.status === AuctionStatus.InProgress && state.currentPlayerId;
  const isStartDisabled = isProcessing || (state.status === AuctionStatus.NotStarted && (teams.length === 0 || availablePlayersCount === 0));

  // Filter Players for Manual Selection
  const filteredManualPlayers = useMemo(() => {
      const available = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
      if (!playerSearchTerm) return available;
      return available.filter(p => 
          p.name.toLowerCase().includes(playerSearchTerm.toLowerCase()) || 
          p.category.toLowerCase().includes(playerSearchTerm.toLowerCase())
      );
  }, [players, playerSearchTerm]);

  // Auto-fill price and leader
  useEffect(() => {
      if (state.currentBid !== null) {
          setFinalPrice(Number(state.currentBid));
          if (state.highestBidder) {
              setSelectedTeamId(String(state.highestBidder.id));
          } else if (!isSellingMode) {
              setSelectedTeamId('');
          }
      }
  }, [state.currentBid, state.highestBidder, isSellingMode]);

  const handleStart = async (specificId?: string) => {
      if (teams.length === 0) return alert("No teams added.");
      if (availablePlayersCount === 0) return alert("No players available.");

      setIsProcessing(true);
      const hasNextPlayer = await startAuction(specificId);
      
      if (!hasNextPlayer) {
          if (window.confirm("No more players available. Mark Auction as Completed?")) {
              await endAuction();
          }
      } else {
          setManualPlayerId('');
          setPlayerSearchTerm('');
      }
      setIsProcessing(false);
  }

  const handleAdminBid = async (team: Team) => {
       if (isProcessing) return;
       if (state.highestBidder?.id === team.id) return; // Already leading
       if (team.budget < nextBid) return; // Insufficient funds
       
       try {
           await placeBid(team.id, nextBid);
       } catch(e) {
           console.error(e);
       }
  };

  const confirmSell = async () => {
      if (!selectedTeamId || finalPrice <= 0) return alert("Invalid sale details.");
      setIsProcessing(true);
      try {
          await sellPlayer(selectedTeamId, finalPrice);
          setIsSellingMode(false);
      } catch(e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handlePass = async () => {
      if (window.confirm("Confirm UNSOLD?")) {
          setIsProcessing(true);
          await passPlayer();
          setIsProcessing(false);
      }
  }

  const handleResetPlayer = async () => {
      if(window.confirm("Reset current player round?")) {
          setIsProcessing(true);
          await resetCurrentPlayer();
          setIsProcessing(false);
      }
  }

  const handleResetFull = async () => {
      if(window.confirm("WARNING: Reset ENTIRE auction to Not Started?")) {
          setIsProcessing(true);
          await resetAuction();
          setIsProcessing(false);
      }
  }

  const copyOBSLink = (type: 'transparent' | 'green') => {
      if (!activeAuctionId) return;
      const baseUrl = window.location.href.split('#')[0];
      const route = type === 'green' ? 'obs-green' : 'obs-overlay';
      navigator.clipboard.writeText(`${baseUrl}#/${route}/${activeAuctionId}`);
      alert("Link copied to clipboard!");
  };

  // --- Broadcast Control Handlers ---
  const handleViewChange = async (type: string, data?: any) => {
      const isSameType = adminViewOverride?.type === type;
      let isSameData = true;
      if (type === 'SQUAD') {
          isSameData = adminViewOverride?.data?.teamId === data?.teamId;
      }
      if (isSameType && isSameData && type !== 'NONE') {
          await setAdminView(null);
          return;
      }
      if (type === 'NONE') {
          await setAdminView(null);
      } else {
          await setAdminView({ type: type as any, data });
      }
  };

  const renderMainControls = () => {
       // Finish Auction Option
       if (availablePlayersCount === 0 && state.status !== AuctionStatus.NotStarted && !isRoundActive) {
           return (
               <div className="bg-blue-900/40 p-3 rounded-lg border border-blue-500/30 text-center">
                   <p className="text-blue-200 text-xs mb-2 font-bold uppercase">Auction Pool Empty</p>
                   <div className="grid grid-cols-2 gap-2">
                      {unsoldCount > 0 && (
                           <button 
                               onClick={async () => { if(window.confirm(`Bring back ${unsoldCount} unsold?`)) { setIsProcessing(true); await resetUnsoldPlayers(); setIsProcessing(false); }}} 
                               className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-2 rounded flex items-center justify-center gap-1"
                           >
                               <RotateCcw className="w-3 h-3"/> Unsold ({unsoldCount})
                           </button>
                      )}
                      <button 
                          onClick={async () => { if(window.confirm("Finish Auction & Enable Stats?")) { setIsProcessing(true); await endAuction(); setIsProcessing(false); }}} 
                          className={`bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold py-2 rounded flex items-center justify-center gap-1 ${unsoldCount === 0 ? 'col-span-2' : ''}`}
                      >
                          <Trophy className="w-3 h-3"/> Finish & Stats
                      </button>
                   </div>
               </div>
           )
       }

       if (isRoundActive) {
           if (isSellingMode) {
               return (
                   <div className="bg-gray-800 p-2 rounded border border-gray-600 animate-fade-in">
                       <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-1">
                          <span className="text-white text-xs font-bold uppercase">Confirm Sale</span>
                          <button onClick={() => setIsSellingMode(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4"/></button>
                       </div>
                       <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} className="w-full bg-black text-white text-xs p-1.5 mb-2 rounded border border-gray-600 outline-none">
                           <option value="">Select Team</option>
                           {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                       </select>
                       <div className="relative mb-2">
                           <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-green-500"/>
                           <input type="number" value={finalPrice} onChange={e => setFinalPrice(Number(e.target.value))} className="w-full bg-black text-white text-xs p-1.5 pl-6 rounded border border-gray-600 outline-none font-bold" />
                       </div>
                       <button onClick={confirmSell} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 rounded shadow flex items-center justify-center">
                           {isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Confirm Sold'}
                       </button>
                   </div>
               )
           }
           
           return (
               <div className="grid grid-cols-2 gap-2 h-16">
                    <button onClick={() => setIsSellingMode(true)} disabled={isProcessing} className="bg-green-600 hover:bg-green-500 text-white font-bold rounded flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all">
                        <Check className="w-6 h-6 mb-1"/> <span className="text-xs uppercase tracking-wider">SOLD</span>
                    </button>
                    <button onClick={handlePass} disabled={isProcessing} className="bg-red-600 hover:bg-red-500 text-white font-bold rounded flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all">
                        <X className="w-6 h-6 mb-1"/> <span className="text-xs uppercase tracking-wider">UNSOLD</span>
                    </button>
               </div>
           )
       }

       // Start Controls
       if (playerSelectionMode === 'MANUAL') {
           return (
               <div className="space-y-2">
                   <div className="relative">
                       <input 
                           type="text" 
                           placeholder="Search player..." 
                           className="w-full bg-gray-900 text-white text-xs p-2.5 pl-8 rounded border border-gray-700 focus:border-highlight outline-none"
                           value={playerSearchTerm}
                           onChange={e => { setPlayerSearchTerm(e.target.value); setShowPlayerDropdown(true); }}
                           onFocus={() => setShowPlayerDropdown(true)}
                       />
                       <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-gray-500" />
                       {showPlayerDropdown && (
                           <div className="absolute top-full left-0 right-0 max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 z-50 rounded-b shadow-xl custom-scrollbar">
                               {filteredManualPlayers.length > 0 ? filteredManualPlayers.map(p => (
                                   <div key={p.id} onClick={() => { setManualPlayerId(String(p.id)); setPlayerSearchTerm(p.name); setShowPlayerDropdown(false); }} className="p-2 hover:bg-gray-700 text-xs text-white cursor-pointer border-b border-gray-700 last:border-0 flex justify-between">
                                       <span>{p.name}</span> <span className="text-gray-500">{p.category}</span>
                                   </div>
                               )) : <div className="p-2 text-xs text-gray-500 text-center">No matches</div>}
                           </div>
                       )}
                   </div>
                   <button onClick={() => handleStart(manualPlayerId)} disabled={isStartDisabled || !manualPlayerId} className="w-full bg-highlight hover:bg-teal-400 text-primary font-bold py-3 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95 transition-all">
                       {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Play className="w-4 h-4 mr-2"/>} Start Selected
                   </button>
               </div>
           )
       }

       return (
           <button onClick={() => handleStart()} disabled={isStartDisabled} className="w-full h-16 bg-highlight hover:bg-teal-400 text-primary font-bold rounded flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95 transition-all">
               {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mb-1"/> : <Shuffle className="w-6 h-6 mb-1"/>} 
               <span className="text-xs uppercase tracking-wider">{state.status === AuctionStatus.NotStarted ? "Start Auction" : "Next Random Player"}</span>
           </button>
       )
  }

  return (
    <div className="h-full flex flex-col bg-secondary rounded-xl shadow-2xl border border-gray-700 overflow-hidden" onClick={() => setShowPlayerDropdown(false)}>
        {/* TOP HEADER */}
        <div className="bg-gray-800 p-3 flex justify-between items-center border-b border-gray-700 shrink-0">
            <h2 className="text-highlight font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                <Gavel className="w-4 h-4"/> Admin
            </h2>
            
            <div className="flex gap-2 items-center">
                 {/* BIDDING STATUS DROPDOWN */}
                 <div className="relative">
                     <select 
                        value={biddingStatus} 
                        onChange={(e) => updateBiddingStatus(e.target.value as BiddingStatus)}
                        className={`appearance-none pl-6 pr-6 py-1 rounded text-[10px] font-bold uppercase tracking-wide border outline-none cursor-pointer transition-colors
                            ${biddingStatus === 'ON' ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' : 
                              biddingStatus === 'PAUSED' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20' :
                              'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'}`
                        }
                     >
                         <option value="ON">BIDDING ON</option>
                         <option value="PAUSED">PAUSED</option>
                         <option value="HIDDEN">HIDDEN</option>
                     </select>
                     <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {biddingStatus === 'ON' ? <Unlock className="w-3 h-3"/> : biddingStatus === 'PAUSED' ? <Lock className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>}
                     </div>
                 </div>

                 <button onClick={() => navigate('/admin')} className="p-1 text-gray-400 hover:text-white" title="Exit">
                    <ArrowLeft className="w-4 h-4"/>
                </button>
            </div>
        </div>

        {/* MAIN ACTION AREA */}
        <div className="p-3 bg-gray-900/50 border-b border-gray-700 shrink-0 relative z-20">
             {renderMainControls()}
        </div>

        {/* TEAM LIST (Fills Space) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-gray-900 relative">
            <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0 z-10">
                <span>Fast Bidding Console</span>
                <span>Next Bid: <span className="text-white text-xs">{nextBid}</span></span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {teams.map(team => {
                    const isLeading = state.highestBidder?.id === team.id;
                    const canAfford = team.budget >= nextBid;
                    
                    return (
                        <div key={team.id} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${isLeading ? 'bg-green-900/20 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                                    {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-contain"/> : <span className="text-black font-bold text-xs">{team.name.charAt(0)}</span>}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-white font-bold text-xs truncate max-w-[120px]">{team.name}</div>
                                    <div className="text-[10px] text-gray-400 flex items-center gap-3">
                                        <span className="flex items-center"><DollarSign className="w-3 h-3 text-green-500 mr-0.5"/> {team.budget}</span>
                                        <span className="flex items-center"><User className="w-3 h-3 text-blue-500 mr-0.5"/> {team.players.length}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Fast Bid Button - Only if ON or Admin wants to override (currently only allowed if ON based on context rules, so disabled here too) */}
                            {state.status === AuctionStatus.InProgress && state.currentPlayerId && (
                                 <button
                                     onClick={() => handleAdminBid(team)}
                                     disabled={!canAfford || isLeading || nextBid <= 0}
                                     className={`ml-2 px-3 py-0 rounded text-[10px] font-bold uppercase transition-all min-w-[75px] h-8 flex items-center justify-center
                                        ${isLeading 
                                            ? 'bg-green-600 text-white cursor-default opacity-80' 
                                            : (!canAfford)
                                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                : (nextBid <= 0)
                                                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                                                    : 'bg-highlight hover:bg-teal-400 text-primary hover:scale-105 active:scale-95 shadow-lg shadow-highlight/10'
                                        }
                                     `}
                                 >
                                     {isLeading ? 'Leading' : !canAfford ? 'No Funds' : (nextBid > 0 ? `BID ${nextBid}` : <Loader2 className="w-3 h-3 animate-spin"/>)}
                                 </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>

        {/* SETTINGS DRAWER (Bottom) */}
        <div className="bg-gray-800 border-t border-gray-700 shrink-0">
            <button onClick={() => setShowSettings(!showSettings)} className="w-full py-2 flex items-center justify-center text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-wider gap-1 hover:bg-gray-700 transition-colors">
                <Settings className="w-3 h-3"/> Broadcast & Tools {showSettings ? <ChevronDown className="w-3 h-3"/> : <ChevronUp className="w-3 h-3"/>}
            </button>
            
            {showSettings && (
                <div className="p-3 grid gap-3 animate-slide-up border-t border-gray-700 bg-gray-900/50 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    
                    {/* BROADCAST VIEWS - NEW SECTION */}
                    <div className="bg-black/40 p-2 rounded border border-gray-600">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] text-highlight font-bold uppercase flex items-center"><Monitor className="w-3 h-3 mr-1"/> Broadcast Views</span>
                            {adminViewOverride && adminViewOverride.type !== 'NONE' && (
                                <button onClick={() => handleViewChange('NONE')} className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded font-bold hover:bg-red-500 flex items-center">
                                    <EyeOff className="w-3 h-3 mr-1"/> Stop Override
                                </button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={() => handleViewChange('PURSES')} className={`p-2 rounded text-[10px] font-bold border ${adminViewOverride?.type === 'PURSES' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}>
                                All Purses
                            </button>
                            <button onClick={() => handleViewChange('TOP_5')} className={`p-2 rounded text-[10px] font-bold border ${adminViewOverride?.type === 'TOP_5' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}>
                                Top 5 Buys
                            </button>
                            <button onClick={() => handleViewChange('UNSOLD')} className={`p-2 rounded text-[10px] font-bold border ${adminViewOverride?.type === 'UNSOLD' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}>
                                Unsold List
                            </button>
                            <button onClick={() => handleViewChange('SOLD')} className={`p-2 rounded text-[10px] font-bold border ${adminViewOverride?.type === 'SOLD' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}>
                                Sold List
                            </button>
                        </div>

                        {/* Squad View Selector */}
                        <div className="flex gap-1">
                            <select 
                                className="flex-1 bg-gray-800 text-white text-[10px] p-1.5 rounded border border-gray-600 outline-none"
                                value={squadViewTeamId}
                                onChange={(e) => setSquadViewTeamId(e.target.value)}
                            >
                                <option value="">Select Team for Squad View</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <button 
                                onClick={() => squadViewTeamId && handleViewChange('SQUAD', { teamId: squadViewTeamId })}
                                disabled={!squadViewTeamId}
                                className={`px-2 py-1 rounded text-[10px] font-bold border ${adminViewOverride?.type === 'SQUAD' && adminViewOverride?.data?.teamId === squadViewTeamId ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50'}`}
                            >
                                Show
                            </button>
                        </div>
                    </div>

                    {/* 1. Selection Mode */}
                    <div className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                         <span className="text-xs text-gray-400 font-bold uppercase">Player Selection</span>
                         <div className="flex bg-gray-900 rounded p-0.5">
                             <button onClick={() => toggleSelectionMode()} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${playerSelectionMode === 'MANUAL' ? 'bg-highlight text-primary' : 'text-gray-500 hover:text-gray-300'}`}>Manual</button>
                             <button onClick={() => toggleSelectionMode()} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${playerSelectionMode === 'AUTO' ? 'bg-highlight text-primary' : 'text-gray-500 hover:text-gray-300'}`}>Auto</button>
                         </div>
                    </div>

                    {/* 2. Theme & OBS */}
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                             <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1">Projector</label>
                             <select value={state.projectorLayout || 'STANDARD'} onChange={e => updateTheme('PROJECTOR', e.target.value)} className="w-full bg-gray-800 text-white text-xs p-1.5 rounded border border-gray-600 outline-none">
                                 <option value="STANDARD">Standard</option>
                                 <option value="IPL">IPL Style</option>
                                 <option value="MODERN">Modern</option>
                             </select>
                         </div>
                         <div>
                             <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1">OBS Overlay</label>
                             <select value={state.obsLayout || 'STANDARD'} onChange={e => updateTheme('OBS', e.target.value)} className="w-full bg-gray-800 text-white text-xs p-1.5 rounded border border-gray-600 outline-none">
                                 <option value="STANDARD">Standard</option>
                                 <option value="MINIMAL">Minimal</option>
                                 <option value="VERTICAL">Vertical</option>
                             </select>
                         </div>
                    </div>

                    {/* 3. Links */}
                    <div className="flex gap-2">
                         <button onClick={() => copyOBSLink('green')} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-[10px] py-1.5 rounded flex items-center justify-center gap-1 font-bold"><Monitor className="w-3 h-3"/> Projector Link</button>
                         <button onClick={() => copyOBSLink('transparent')} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-[10px] py-1.5 rounded flex items-center justify-center gap-1 font-bold"><Cast className="w-3 h-3"/> OBS Link</button>
                    </div>
                    
                    {/* 4. Resets */}
                    <div className="flex gap-2 pt-2 border-t border-gray-700">
                         <button onClick={handleResetPlayer} className="flex-1 bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30 text-[10px] py-1.5 rounded border border-yellow-600/30 font-bold">Reset Round</button>
                         <button onClick={handleResetFull} className="flex-1 bg-red-600/20 text-red-500 hover:bg-red-600/30 text-[10px] py-1.5 rounded border border-red-600/30 font-bold">Reset Full</button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default LiveAdminPanel;
