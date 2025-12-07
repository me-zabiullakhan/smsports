
import React, { useState, useEffect } from 'react';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, Team } from '../types';
import TeamStatusCard from '../components/TeamStatusCard';
import { Play, Check, X, ArrowLeft, Loader2, RotateCcw, AlertOctagon, DollarSign, Cast } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LiveAdminPanel: React.FC = () => {
  const { state, sellPlayer, passPlayer, startAuction, resetAuction, resetCurrentPlayer, activeAuctionId, state: { teams } } = useAuction();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Sell Modal State
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<number>(0);

  // Sync modal defaults with current auction state when it opens
  useEffect(() => {
      if (showSellModal && state.currentBid !== null) {
          setFinalPrice(Number(state.currentBid));
          if (state.highestBidder) {
              setSelectedTeamId(String(state.highestBidder.id));
          } else {
              setSelectedTeamId('');
          }
      }
  }, [showSellModal, state.currentBid, state.highestBidder]);

  const handleStart = async () => {
      setIsProcessing(true);
      await startAuction();
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
  
  const copyOBSLink = () => {
      if (!activeAuctionId) return;
      const url = `${window.location.origin}/#/obs-overlay/${activeAuctionId}`;
      navigator.clipboard.writeText(url);
      alert("🎥 OBS Overlay URL Copied!\n\n1. Open OBS Studio\n2. Add Source > Browser\n3. Paste this URL\n4. Set Width: 1920, Height: 1080");
  };
  
  // Open Modal instead of selling immediately
  const handleSellClick = () => {
      setShowSellModal(true);
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
          setShowSellModal(false);
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

  const getControlButtons = () => {
      const isRoundActive = state.status === AuctionStatus.InProgress && state.currentPlayerId;

      if (isRoundActive) {
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

      return (
          <button 
            onClick={handleStart} 
            disabled={isProcessing}
            className="w-full flex items-center justify-center bg-highlight hover:bg-teal-500 text-primary font-bold py-4 px-4 rounded-lg transition-colors duration-300 shadow-lg shadow-highlight/20 disabled:opacity-50 active:scale-95"
          >
              {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Play className="mr-2 h-5 w-5"/>} 
              {state.status === AuctionStatus.NotStarted ? 'Start Auction' : 'Next Player'}
          </button>
      );
  }

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg h-full flex flex-col border border-gray-700 relative">
      
      {/* SELL MODAL OVERLAY */}
      {showSellModal && (
          <div className="absolute inset-0 z-50 bg-secondary/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 rounded-lg animate-fade-in">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center"><Check className="w-5 h-5 text-green-500 mr-2"/> Confirm Sale</h3>
              
              <div className="w-full space-y-4">
                  <div>
                      <label className="block text-xs text-text-secondary uppercase font-bold mb-1">Sold To</label>
                      <select 
                        value={selectedTeamId} 
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="w-full bg-primary border border-gray-600 rounded p-2 text-white outline-none focus:border-green-500"
                      >
                          <option value="">-- Select Team --</option>
                          {teams.map(t => (
                              <option key={t.id} value={t.id}>{t.name} (Budget: {t.budget})</option>
                          ))}
                      </select>
                  </div>
                  
                  <div>
                      <label className="block text-xs text-text-secondary uppercase font-bold mb-1">Final Price</label>
                      <div className="relative">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            type="number" 
                            value={finalPrice} 
                            onChange={(e) => setFinalPrice(Number(e.target.value))}
                            className="w-full bg-primary border border-gray-600 rounded p-2 pl-8 text-white font-bold outline-none focus:border-green-500"
                          />
                      </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => setShowSellModal(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded font-bold"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={confirmSell}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold shadow-lg"
                      >
                          Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex justify-between items-center mb-4 border-b border-accent pb-2">
          <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-highlight uppercase tracking-wider">Auctioneer</h2>
              <button 
                onClick={copyOBSLink}
                className="bg-highlight/10 hover:bg-highlight/20 text-highlight p-1.5 rounded transition-colors"
                title="Copy OBS Overlay Link"
              >
                  <Cast className="w-4 h-4" />
              </button>
          </div>
          <button onClick={() => navigate('/admin')} className="text-xs text-text-secondary hover:text-white flex items-center">
              <ArrowLeft className="w-3 h-3 mr-1"/> Dashboard
          </button>
      </div>
      
      <div className="mb-6 space-y-3">
         {getControlButtons()}
         
         {/* Reset Options */}
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
