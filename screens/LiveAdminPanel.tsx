
import React, { useState, useEffect, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, Team, Player, ProjectorLayout, OBSLayout } from '../types';
import TeamStatusCard from '../components/TeamStatusCard';
import { Play, Check, X, ArrowLeft, Loader2, RotateCcw, AlertOctagon, DollarSign, Cast, Lock, Unlock, Monitor, ChevronDown, Shuffle, Search, User, Palette, Trophy, Gavel, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LiveAdminPanel: React.FC = () => {
  const { state, sellPlayer, passPlayer, startAuction, endAuction, resetAuction, resetCurrentPlayer, resetUnsoldPlayers, updateBiddingStatus, toggleSelectionMode, updateTheme, activeAuctionId, placeBid, nextBid } = useAuction();
  const { teams, players, biddingStatus, playerSelectionMode, categories } = state;
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Inline Sell State
  const [isSellingMode, setIsSellingMode] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<number>(0);

  // Manual Player Selection State
  const [manualPlayerId, setManualPlayerId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState(''); // New search state

  // Auto-fill price and leader when entering sell mode or when bid updates
  useEffect(() => {
      // 1. Determine Price
      if (state.currentBid !== null && state.currentBid > 0) {
          setFinalPrice(Number(state.currentBid));
      } else if (state.currentPlayerId) {
          // Fallback to Base Price if no bids
          const p = players.find(player => String(player.id) === String(state.currentPlayerId));
          if (p) setFinalPrice(p.basePrice);
      }

      // 2. Determine Team
      if (state.highestBidder) {
          setSelectedTeamId(String(state.highestBidder.id));
      } else if (!isSellingMode) {
          // Reset selection only if we aren't currently editing
          setSelectedTeamId('');
      }
  }, [state.currentBid, state.highestBidder, isSellingMode, state.currentPlayerId, players]);

  const handleStart = async (specificId?: string) => {
      if (teams.length === 0) {
          alert("Cannot start auction: No teams added. Please go back to Dashboard > Edit Auction > Teams to add teams.");
          return;
      }

      const availablePlayers = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
      if (availablePlayers.length === 0) {
          alert("Cannot start auction: No more players available.");
          return;
      }

      setIsProcessing(true);
      const hasNextPlayer = await startAuction(specificId);
      
      if (!hasNextPlayer) {
          if (window.confirm("No more players available in the pool.\n\nDo you want to MARK AUCTION AS COMPLETED?")) {
              await endAuction();
          }
      } else {
          // Clear manual selection
          setManualPlayerId('');
          setSearchTerm('');
      }
      setIsProcessing(false);
  }

  const handleResetFull = async () => {
      if(!window.confirm("WARNING: This will reset the auction status to 'Not Started'. It will NOT remove sold players from teams. Proceed?")) return;
      setIsProcessing(true);
      await resetAuction();
      setIsProcessing(false);
  }

  const handleResetPlayer = async () => {
      if(!window.confirm("This will clear the current bid and timer for this player. Proceed?")) return;
      setIsProcessing(true);
      await resetCurrentPlayer();
      setIsProcessing(false);
  }
  
  const copyOBSLink = (type: 'transparent' | 'green') => {
      if (!activeAuctionId) return;
      const baseUrl = window.location.href.split('#')[0];
      const route = type === 'green' ? 'obs-green' : 'obs-overlay';
      const url = `${baseUrl}#/${route}/${activeAuctionId}`;
      navigator.clipboard.writeText(url);
      
      if (type === 'green') {
          alert("PROJECTOR VIEW URL Copied!\n\nOpen this link on the projector screen.");
      } else {
          alert("OBS OVERLAY URL Copied!\n\nPaste this into OBS Browser Source.");
      }
  };
  
  const handleSellClick = () => {
      setIsSellingMode(true);
  };

  const cancelSell = () => {
      setIsSellingMode(false);
  };

  const confirmSell = async () => {
      if (!selectedTeamId) {
          alert("Please select a team to sell to.");
          return;
      }
      if (finalPrice <= 0) {
          alert("Price must be greater than 0.");
          return;
      }

      setIsProcessing(true);
      try {
          await sellPlayer(selectedTeamId, finalPrice);
          setIsSellingMode(false);
      } catch(e) {
          console.error(e);
          alert("Failed to sell player. Check console.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handlePass = async () => {
      if (window.confirm("Confirm UNSOLD?")) {
          setIsProcessing(true);
          await passPlayer();
          setIsProcessing(false);
      }
  }

  const handleQuickBid = async (teamId: string | number) => {
      try {
          await placeBid(teamId, nextBid);
      } catch (e) {
          console.error(e);
      }
  };

  const selectedPlayerObj = players.find(p => p.id === manualPlayerId);
  const currentPlayer = state.currentPlayerIndex !== null ? state.unsoldPlayers[state.currentPlayerIndex] : null;

  // Helper to check category limits
  const isTeamLimitReached = (team: Team) => {
      if (!currentPlayer || !currentPlayer.category) return false;
      const catConfig = categories.find(c => c.name === currentPlayer.category);
      if (catConfig && catConfig.maxPerTeam > 0) {
          const count = team.players.filter(p => p.category === currentPlayer.category).length;
          return count >= catConfig.maxPerTeam;
      }
      return false;
  };

  const getControlButtons = () => {
      const isRoundActive = state.status === AuctionStatus.InProgress && state.currentPlayerId;
      const availablePlayersCount = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD').length;
      const isStartDisabled = isProcessing || (state.status === AuctionStatus.NotStarted && (teams.length === 0 || availablePlayersCount === 0));
      const unsoldCount = players.filter(p => p.status === 'UNSOLD').length;

      // NEW: Finish Auction Option
      // Show this if no players are left AND we are not currently bidding on one (isRoundActive is false)
      if (availablePlayersCount === 0 && state.status !== AuctionStatus.NotStarted && !isRoundActive) {
          return (
             <div className="space-y-4 animate-fade-in">
                 {unsoldCount > 0 && (
                     <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-xl text-center shadow-inner">
                        <h3 className="text-white font-bold text-lg mb-2">Unsold Players Available</h3>
                        <p className="text-gray-300 text-xs mb-4">There are {unsoldCount} unsold players. Do you want to bring them back into the bidding pool?</p>
                        <button 
                            onClick={async () => {
                                if(window.confirm(`Bring back ${unsoldCount} unsold players to the pool?`)) {
                                    setIsProcessing(true);
                                    await resetUnsoldPlayers();
                                    setIsProcessing(false);
                                }
                            }}
                            disabled={isProcessing}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all active:scale-95 flex items-center justify-center"
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4"/>}
                            BRING BACK UNSOLD ({unsoldCount})
                        </button>
                     </div>
                 )}
                 
                 <div className="bg-green-900/30 border border-green-500/50 p-6 rounded-xl text-center shadow-inner">
                    <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3 drop-shadow-lg" />
                    <h3 className="text-white font-bold text-xl mb-2">Auction Completed!</h3>
                    <p className="text-gray-300 text-sm mb-6">All players have been auctioned. You can now finalize the event.</p>
                    <button 
                        onClick={async () => {
                            if(window.confirm("Are you sure you want to finish the auction? This will enable the summary view for all users.")) {
                                setIsProcessing(true);
                                await endAuction();
                                setIsProcessing(false);
                            }
                        }}
                        disabled={isProcessing}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg shadow-lg shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center tracking-wide"
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : "GENERATE SUMMARY & FINISH"}
                    </button>
                </div>
            </div>
          );
      }

      // 1. ACTIVE ROUND CONTROLS (SOLD / UNSOLD)
      if (isRoundActive) {
          if (isSellingMode) {
              return (
                  <div className="bg-primary/20 p-3 rounded-lg border border-gray-600 animate-fade-in space-y-3">
                      <div className="flex items-center gap-2 mb-2 text-white font-bold border-b border-gray-600 pb-1">
                          <Check className="w-4 h-4 text-green-500" /> Confirm Sale
                      </div>
                      
                      {/* Inline Form */}
                      <div>
                          <label className="block text-[10px] text-text-secondary uppercase font-bold mb-1">Sold To Team</label>
                          <div className="relative">
                            <select 
                                value={selectedTeamId} 
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="w-full bg-primary border border-gray-600 rounded p-2 text-sm text-white outline-none focus:border-green-500 appearance-none"
                            >
                                <option value="">-- Select Team --</option>
                                {teams.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.budget})</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-[10px] text-text-secondary uppercase font-bold mb-1">Final Price</label>
                          <div className="relative">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                              <input 
                                type="number" 
                                value={finalPrice} 
                                onChange={(e) => setFinalPrice(Number(e.target.value))}
                                className="w-full bg-primary border border-gray-600 rounded p-2 pl-8 text-sm text-white font-bold outline-none focus:border-green-500"
                              />
                          </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                          <button 
                            onClick={cancelSell}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded text-sm font-bold transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={confirmSell}
                            disabled={isProcessing}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm font-bold shadow-lg flex items-center justify-center transition-colors"
                          >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Confirm'}
                          </button>
                      </div>
                  </div>
              );
          }

          return (
              <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleSellClick}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-4 px-2 rounded-lg transition-all shadow-md active:scale-95"
                  >
                      {isProcessing ? <Loader2 className="mb-1 h-6 w-6 animate-spin"/> : <Check className="mb-1 h-6 w-6"/>}
                      {isProcessing ? 'SELLING...' : 'SOLD'}
                  </button>
                  <button 
                    onClick={handlePass}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-2 rounded-lg transition-all shadow-md active:scale-95"
                  >
                      {isProcessing ? <Loader2 className="mb-1 h-6 w-6 animate-spin"/> : <X className="mb-1 h-6 w-6"/>}
                      UNSOLD
                  </button>
              </div>
          );
      }

      // 2. NEXT PLAYER SELECTION (Based on Mode)
      if (playerSelectionMode === 'MANUAL') {
           const availablePlayers = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
           availablePlayers.sort((a, b) => a.name.localeCompare(b.name));

           // Filter based on search term
           const filteredPlayers = availablePlayers.filter(p => 
               p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               p.category.toLowerCase().includes(searchTerm.toLowerCase())
           );

           return (
               <div className="space-y-3 bg-primary/20 p-3 rounded-lg border border-gray-600">
                   <div>
                       <label className="block text-[10px] text-text-secondary uppercase font-bold mb-1">Select Next Player</label>
                       
                       {/* Search Input */}
                       <div className="relative mb-2">
                           <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                           <input 
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 pl-7 text-xs text-white focus:border-highlight outline-none"
                                placeholder="Search player name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                           />
                       </div>

                       <div className="relative">
                           <select 
                               className="w-full bg-gray-900 text-white text-xs p-3 rounded border border-gray-700 focus:border-highlight outline-none appearance-none cursor-pointer"
                               value={manualPlayerId}
                               onChange={(e) => setManualPlayerId(e.target.value)}
                           >
                               <option value="">-- Choose Player ({filteredPlayers.length}) --</option>
                               {filteredPlayers.map(p => (
                                   <option key={p.id} value={p.id}>
                                       {p.name} ({p.category}) - Base: {p.basePrice}
                                   </option>
                               ))}
                           </select>
                           <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                       </div>
                   </div>

                   <button 
                     onClick={() => handleStart(manualPlayerId)} 
                     disabled={isStartDisabled || !manualPlayerId}
                     className={`w-full flex items-center justify-center font-bold py-3 px-4 rounded-lg transition-colors duration-300 shadow-lg shadow-highlight/20 active:scale-95
                         ${isStartDisabled || !manualPlayerId
                             ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                             : 'bg-highlight hover:bg-teal-500 text-primary'}`
                     }
                   >
                       {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Play className="mr-2 h-5 w-5"/>} 
                       Start Bidding
                   </button>
               </div>
           );
      }

      // AUTO MODE
      return (
          <button 
            onClick={() => handleStart()} 
            disabled={isStartDisabled}
            className={`w-full flex items-center justify-center font-bold py-4 px-4 rounded-lg transition-colors duration-300 shadow-lg shadow-highlight/20 active:scale-95
                ${isStartDisabled 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-highlight hover:bg-teal-500 text-primary'}`
            }
          >
              {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Shuffle className="mr-2 h-5 w-5"/>} 
              {state.status === AuctionStatus.NotStarted ? 'Start Auction (Auto Random)' : 'Next Random Player'}
          </button>
      );
  }

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg h-full flex flex-col border border-gray-700 relative">
      
      <div className="flex justify-between items-center mb-4 border-b border-accent pb-2">
          <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-center w-full">
                <h2 className="text-xl font-bold text-highlight uppercase tracking-wider">Auctioneer</h2>
                <button onClick={() => navigate('/admin')} className="text-xs text-text-secondary hover:text-white flex items-center">
                    <ArrowLeft className="w-3 h-3 mr-1"/> Dashboard
                </button>
              </div>
              
              {/* Quick Actions & Theme Selectors */}
              <div className="flex flex-wrap gap-2 items-center bg-primary/50 rounded-lg p-2 w-full">
                  <div className="flex items-center gap-1">
                    <button 
                        onClick={(e) => { e.stopPropagation(); copyOBSLink('transparent'); }}
                        className="p-1.5 rounded hover:bg-white/10 text-highlight transition-colors"
                        title="Copy OBS Transparent Link"
                    >
                        <Cast className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); copyOBSLink('green'); }}
                        className="p-1.5 rounded hover:bg-white/10 text-green-400 transition-colors"
                        title="Copy Projector View Link"
                    >
                        <Monitor className="w-4 h-4" />
                    </button>
                    
                    {/* Bidding Dropdown */}
                    <div className="relative ml-1">
                        <select
                            value={biddingStatus === 'ON' ? 'ON' : 'OFF'}
                            onChange={(e) => {
                                const newVal = e.target.value === 'ON';
                                updateBiddingStatus(newVal ? 'ON' : 'PAUSED');
                            }}
                            className={`appearance-none pl-6 pr-6 py-1 rounded text-xs font-bold border outline-none cursor-pointer ${biddingStatus === 'ON' ? 'bg-green-900/30 text-green-400 border-green-500/50' : 'bg-red-900/30 text-red-400 border-red-500/50'}`}
                        >
                            <option value="ON">BIDDING ON</option>
                            <option value="OFF">BIDDING PAUSED</option>
                        </select>
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            {biddingStatus === 'ON' ? <Unlock className="w-3 h-3 text-green-400"/> : <Lock className="w-3 h-3 text-red-400"/>}
                        </div>
                    </div>
                  </div>

                  <div className="w-px h-6 bg-gray-600 mx-1"></div>

                  {/* Theme Selectors with Clearer Labels */}
                  <div className="flex flex-1 gap-2">
                      <div className="flex-1">
                          <label className="block text-[8px] text-gray-400 uppercase font-bold mb-0.5">Projector</label>
                          <select 
                            value={state.projectorLayout || 'STANDARD'} 
                            onChange={(e) => updateTheme('PROJECTOR', e.target.value)}
                            className="w-full bg-gray-800 text-white text-xs p-1 rounded border border-gray-600 outline-none hover:border-highlight cursor-pointer"
                          >
                              <option value="STANDARD">Standard</option>
                              <option value="IPL">Gold/Blue</option>
                              <option value="MODERN">Modern</option>
                          </select>
                      </div>
                      <div className="flex-1">
                          <label className="block text-[8px] text-gray-400 uppercase font-bold mb-0.5">OBS</label>
                          <select 
                            value={state.obsLayout || 'STANDARD'} 
                            onChange={(e) => updateTheme('OBS', e.target.value)}
                            className="w-full bg-gray-800 text-white text-xs p-1 rounded border border-gray-600 outline-none hover:border-highlight cursor-pointer"
                          >
                              <option value="STANDARD">Standard</option>
                              <option value="MINIMAL">Minimal</option>
                              <option value="VERTICAL">Vertical</option>
                          </select>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      
      {/* SELECTION MODE TOGGLE */}
      <div className="bg-primary/40 rounded-lg p-2 mb-4 flex justify-between items-center border border-gray-700">
          <span className="text-xs font-bold text-text-secondary uppercase ml-1">Selection Mode</span>
          <div className="flex bg-gray-800 rounded p-1">
              <button 
                onClick={playerSelectionMode !== 'MANUAL' ? toggleSelectionMode : undefined}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${playerSelectionMode === 'MANUAL' ? 'bg-highlight text-primary shadow' : 'text-gray-400 hover:text-white'}`}
              >
                  Manual
              </button>
              <button 
                onClick={playerSelectionMode !== 'AUTO' ? toggleSelectionMode : undefined}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${playerSelectionMode === 'AUTO' ? 'bg-highlight text-primary shadow' : 'text-gray-400 hover:text-white'}`}
              >
                  Auto
              </button>
          </div>
      </div>

      <div className="mb-6 space-y-3">
         {getControlButtons()}
         
         {!isSellingMode && (
             <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-accent/30">
                 <button 
                    onClick={handleResetPlayer} 
                    disabled={isProcessing || !state.currentPlayerId}
                    className="flex flex-col items-center justify-center bg-yellow-600 hover:bg-yellow-700 text-xs text-white py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Clears bids for current player only"
                 >
                    <RotateCcw className={`mb-1 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`}/>
                    Reset Current
                 </button>
                 <button 
                    onClick={handleResetFull} 
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center bg-red-900/80 hover:bg-red-900 text-xs text-red-200 border border-red-800 py-2 rounded transition-colors disabled:opacity-50"
                    title="Resets auction status to Not Started"
                 >
                    <AlertOctagon className={`mb-1 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`}/>
                    Reset Full
                 </button>
             </div>
         )}
      </div>

      {/* QUICK BID BAR */}
      {state.status === AuctionStatus.InProgress && currentPlayer && (
          <div className="mb-4 animate-slide-up">
              <h3 className="text-xs font-bold text-text-secondary uppercase mb-2 flex items-center">
                  <Gavel className="w-3 h-3 mr-1 text-yellow-400" /> Quick Bid
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x">
                  {teams.map(team => {
                      const isLimitReached = isTeamLimitReached(team);
                      const isHighest = state.highestBidder?.id === team.id;
                      const canAfford = team.budget >= nextBid;
                      const disabled = isLimitReached || isHighest || !canAfford;

                      return (
                          <button
                              key={team.id}
                              onClick={() => handleQuickBid(team.id)}
                              disabled={disabled}
                              className={`
                                  flex-shrink-0 w-24 flex flex-col items-center p-2 rounded-lg border-2 transition-all active:scale-95 snap-start
                                  ${isHighest 
                                      ? 'bg-green-600 border-green-400 shadow-[0_0_10px_rgba(22,163,74,0.5)]' 
                                      : disabled 
                                          ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed' 
                                          : 'bg-primary border-gray-600 hover:border-highlight hover:bg-gray-800'}
                              `}
                          >
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mb-1 overflow-hidden">
                                  {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-contain"/> : <span className="text-black font-bold text-xs">{team.name.charAt(0)}</span>}
                              </div>
                              <div className="text-[10px] font-bold text-white truncate w-full text-center mb-0.5">{team.name}</div>
                              <div className={`text-[10px] font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>{team.budget}</div>
                              
                              <div className={`mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded w-full text-center ${isHighest ? 'bg-white text-green-700' : disabled ? 'text-gray-500' : 'bg-highlight text-primary'}`}>
                                  {isHighest ? 'LEADING' : isLimitReached ? 'FULL' : `+${nextBid - (Number(state.currentBid) || 0)}`}
                              </div>
                          </button>
                      );
                  })}
              </div>
          </div>
      )}

      <h3 className="text-sm font-bold mb-3 text-text-secondary uppercase Teams Overview">Teams Overview</h3>
      <div className="flex-grow overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {teams.map((team: Team) => (
          <TeamStatusCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
};

export default LiveAdminPanel;
