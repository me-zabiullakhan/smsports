
import React, { useState, useEffect, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, Team, Player, ProjectorLayout, OBSLayout } from '../types';
import TeamStatusCard from '../components/TeamStatusCard';
import { Play, Check, X, ArrowLeft, Loader2, RotateCcw, AlertOctagon, DollarSign, Cast, Lock, Unlock, Monitor, ChevronDown, Shuffle, Search, User, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LiveAdminPanel: React.FC = () => {
  const { state, sellPlayer, passPlayer, startAuction, endAuction, resetAuction, resetCurrentPlayer, toggleBidding, toggleSelectionMode, updateTheme, activeAuctionId } = useAuction();
  const { teams, players, biddingEnabled, playerSelectionMode } = state;
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Inline Sell State
  const [isSellingMode, setIsSellingMode] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<number>(0);

  // Manual Player Selection State
  const [manualPlayerId, setManualPlayerId] = useState<string>('');
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);

  // Auto-fill price and leader when entering sell mode or when bid updates
  useEffect(() => {
      if (state.currentBid !== null) {
          setFinalPrice(Number(state.currentBid));
          if (state.highestBidder) {
              setSelectedTeamId(String(state.highestBidder.id));
          } else if (!isSellingMode) {
              // Only reset if not already editing
              setSelectedTeamId('');
          }
      }
  }, [state.currentBid, state.highestBidder, isSellingMode]);

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
          setPlayerSearchTerm('');
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

  // Filter Players for Manual Selection
  const filteredManualPlayers = useMemo(() => {
      const available = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
      if (!playerSearchTerm) return available;
      return available.filter(p => 
          p.name.toLowerCase().includes(playerSearchTerm.toLowerCase()) || 
          p.category.toLowerCase().includes(playerSearchTerm.toLowerCase())
      );
  }, [players, playerSearchTerm]);

  const selectedPlayerObj = players.find(p => p.id === manualPlayerId);

  const getControlButtons = () => {
      const isRoundActive = state.status === AuctionStatus.InProgress && state.currentPlayerId;
      const availablePlayersCount = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD').length;
      const isStartDisabled = isProcessing || (state.status === AuctionStatus.NotStarted && (teams.length === 0 || availablePlayersCount === 0));

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
          return (
              <div className="space-y-3 bg-primary/30 p-3 rounded-lg border border-gray-600">
                  <div>
                      <label className="block text-[10px] text-text-secondary uppercase font-bold mb-1">Search & Select Next Player</label>
                      
                      {/* Search Dropdown */}
                      <div className="relative">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Search by name or category..."
                                className="w-full bg-primary border border-gray-600 rounded p-2 pl-9 text-sm text-white outline-none focus:border-highlight"
                                value={playerSearchTerm}
                                onChange={(e) => {
                                    setPlayerSearchTerm(e.target.value);
                                    setShowPlayerDropdown(true);
                                }}
                                onFocus={() => setShowPlayerDropdown(true)}
                            />
                            {manualPlayerId && (
                                <button 
                                    onClick={() => {
                                        setManualPlayerId('');
                                        setPlayerSearchTerm('');
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                          </div>

                          {/* Dropdown List */}
                          {showPlayerDropdown && (
                              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-20 custom-scrollbar">
                                  {filteredManualPlayers.length > 0 ? filteredManualPlayers.map(p => (
                                      <div 
                                        key={p.id}
                                        onClick={() => {
                                            setManualPlayerId(String(p.id));
                                            setPlayerSearchTerm(p.name);
                                            setShowPlayerDropdown(false);
                                        }}
                                        className="p-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-sm border-b border-gray-700 last:border-0"
                                      >
                                          <div className="flex items-center gap-2">
                                              {p.photoUrl ? (
                                                  <img src={p.photoUrl} className="w-6 h-6 rounded-full object-cover"/>
                                              ) : (
                                                  <User className="w-6 h-6 bg-gray-600 p-1 rounded-full"/>
                                              )}
                                              <span className="text-white font-medium">{p.name}</span>
                                          </div>
                                          <div className="text-xs text-gray-400">
                                              {p.category} • {p.basePrice}
                                          </div>
                                      </div>
                                  )) : (
                                      <div className="p-3 text-xs text-gray-500 text-center">No matching players found</div>
                                  )}
                              </div>
                          )}
                      </div>

                      {/* Selected Preview */}
                      {selectedPlayerObj && (
                          <div className="mt-2 p-2 bg-highlight/10 border border-highlight/30 rounded flex items-center gap-2 text-sm text-highlight">
                              <Check className="w-4 h-4" />
                              <span>Selected: <b>{selectedPlayerObj.name}</b></span>
                          </div>
                      )}
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
                      Start Bidding for Selected
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
    <div 
        className="bg-secondary p-4 rounded-lg shadow-lg h-full flex flex-col border border-gray-700 relative"
        onClick={() => setShowPlayerDropdown(false)} // Close dropdown on outside click
    >
      
      <div className="flex justify-between items-center mb-4 border-b border-accent pb-2">
          <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-center w-full">
                <h2 className="text-xl font-bold text-highlight uppercase tracking-wider">Auctioneer</h2>
                <button onClick={() => navigate('/admin')} className="text-xs text-text-secondary hover:text-white flex items-center">
                    <ArrowLeft className="w-3 h-3 mr-1"/> Dashboard
                </button>
              </div>
              
              {/* Quick Actions & Theme Selectors */}
              <div className="flex flex-wrap gap-2 items-center bg-primary/50 rounded-lg p-1.5 w-full">
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
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleBidding(); }}
                        className={`p-1.5 rounded transition-colors ${biddingEnabled ? 'text-green-400 hover:bg-green-900/30' : 'text-red-400 hover:bg-red-900/30'}`}
                        title={biddingEnabled ? "Disable Bidding for Teams" : "Enable Bidding for Teams"}
                    >
                        {biddingEnabled ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4"/>}
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-600 mx-1"></div>

                  {/* Theme Selectors */}
                  <div className="flex items-center gap-2 flex-1">
                      <select 
                        value={state.projectorLayout || 'STANDARD'} 
                        onChange={(e) => updateTheme('PROJECTOR', e.target.value)}
                        className="bg-gray-800 text-white text-xs p-1 rounded border border-gray-600 outline-none hover:border-highlight cursor-pointer"
                        title="Projector Theme"
                      >
                          <option value="STANDARD">Standard</option>
                          <option value="IPL">Gold/Blue</option>
                          <option value="MODERN">Modern</option>
                      </select>
                      <select 
                        value={state.obsLayout || 'STANDARD'} 
                        onChange={(e) => updateTheme('OBS', e.target.value)}
                        className="bg-gray-800 text-white text-xs p-1 rounded border border-gray-600 outline-none hover:border-highlight cursor-pointer"
                        title="OBS Theme"
                      >
                          <option value="STANDARD">Standard</option>
                          <option value="MINIMAL">Minimal</option>
                          <option value="VERTICAL">Vertical</option>
                      </select>
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

      <div className="mb-6 space-y-3" onClick={e => e.stopPropagation()}>
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
