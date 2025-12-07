
import React, { useEffect, useState, useRef } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe, AlertTriangle, Shield, User, Gavel } from 'lucide-react';
import { Player, Team, AuctionStatus } from '../types';

// Types for our local frozen state
interface OverlayState {
    player: Player | null;
    bid: number;
    bidder: Team | null;
    status: 'WAITING' | 'LIVE' | 'SOLD' | 'UNSOLD';
}

const OBSOverlay: React.FC = () => {
  const { state, joinAuction } = useAuction();
  const { auctionId } = useParams<{ auctionId: string }>();
  
  // Local state to handle persistence (keeping the player on screen after Sold)
  const [display, setDisplay] = useState<OverlayState>({
      player: null,
      bid: 0,
      bidder: null,
      status: 'WAITING'
  });

  // Ref to track cleanup timer
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Force Transparency on Mount
  useEffect(() => {
      const originalBodyBg = document.body.style.backgroundColor;
      const originalHtmlBg = document.documentElement.style.backgroundColor;
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      return () => {
          document.body.style.backgroundColor = originalBodyBg;
          document.documentElement.style.backgroundColor = originalHtmlBg;
      };
  }, []);

  useEffect(() => {
      if (auctionId) joinAuction(auctionId);
  }, [auctionId]);

  // --- SYNC LOGIC ---
  useEffect(() => {
      const { currentPlayerId, currentPlayerIndex, unsoldPlayers, currentBid, highestBidder, status } = state;
      const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

      if (currentPlayer) {
          // Player is present on screen
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
          let derivedStatus: 'LIVE' | 'SOLD' | 'UNSOLD' = 'LIVE';
          
          if (status === AuctionStatus.Sold || currentPlayer.status === 'SOLD') derivedStatus = 'SOLD';
          else if (status === AuctionStatus.Unsold || currentPlayer.status === 'UNSOLD') derivedStatus = 'UNSOLD';

          setDisplay({
              player: currentPlayer,
              bid: currentBid || currentPlayer.basePrice,
              bidder: highestBidder,
              status: derivedStatus
          });
      } else {
          // No player (e.g., reset or fully cleared)
          // Only clear display if we aren't already waiting, to avoid flicker
          if (display.status !== 'WAITING') {
              // Wait a bit before clearing to allow for "Sold" animation if transition happened too fast
              // But usually currentPlayerId is kept in Manual mode, so this block is mostly for full resets
              timeoutRef.current = setTimeout(() => {
                  setDisplay({ player: null, bid: 0, bidder: null, status: 'WAITING' });
              }, 2000); 
          }
      }

  }, [state]);


  // Check for Preview/Blob environment
  if (window.location.protocol === 'blob:') {
      return (
          <div className="min-h-screen w-full flex items-center justify-center bg-black/90 p-10">
              <div className="bg-red-600/20 border border-red-500 text-white p-8 rounded-xl text-center">
                  <h1 className="text-2xl font-bold mb-2">Preview Mode Detected</h1>
                  <p>Please deploy the app to use the OBS Overlay.</p>
              </div>
          </div>
      );
  }

  // Waiting State
  if (display.status === 'WAITING' || !display.player) {
      return (
          <div className="min-h-screen w-full flex items-end justify-center pb-20">
              <div className="bg-slate-900/90 text-white px-12 py-4 rounded-full border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse">
                  <h1 className="text-2xl font-bold tracking-[0.5em] uppercase text-cyan-400">Waiting for Auction</h1>
              </div>
          </div>
      );
  }

  const { player, bid, bidder, status } = display;

  return (
    <div className="min-h-screen w-full overflow-hidden relative font-sans">
        {/* LOWER THIRDS BAR CONTAINER */}
        <div className="absolute bottom-10 left-4 right-4 md:left-10 md:right-10 h-32 bg-slate-900/95 rounded-2xl border border-slate-700 shadow-2xl flex items-center overflow-visible animate-slide-up max-w-[95vw] mx-auto">
            
            {/* 1. PLAYER SECTION (Left) - Fixed Width */}
            <div className="relative w-[28%] md:w-[25%] h-full shrink-0">
                {/* Pop-up Image */}
                <div className="absolute bottom-0 left-0 w-48 md:w-64 h-64 md:h-80 z-20 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-transform duration-500">
                    <img 
                        src={player.photoUrl} 
                        alt={player.name} 
                        className="w-full h-full object-cover object-top mask-image-gradient"
                        style={{ maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)' }}
                    />
                    
                    {/* Status Stamp */}
                    {status === 'SOLD' && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-600 text-white font-black text-2xl md:text-3xl px-4 md:px-6 py-2 rounded border-4 border-white -rotate-12 shadow-xl animate-bounce-in">
                            SOLD
                        </div>
                    )}
                    {status === 'UNSOLD' && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white font-black text-2xl md:text-3xl px-4 md:px-6 py-2 rounded border-4 border-white -rotate-12 shadow-xl animate-bounce-in">
                            UNSOLD
                        </div>
                    )}
                </div>

                {/* Name Plate (Behind Image somewhat) */}
                <div className="absolute bottom-4 left-32 md:left-48 z-10 w-[150%] pointer-events-none">
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-1 rounded-t-lg w-fit min-w-[150px]">
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center truncate">
                            <User className="w-3 h-3 mr-1"/> {player.category}
                        </span>
                    </div>
                    <div className="bg-white text-slate-900 px-4 md:px-6 py-2 rounded-b-lg rounded-tr-lg shadow-lg w-fit max-w-full">
                        <h1 className="text-2xl md:text-3xl font-black uppercase leading-none truncate">{player.name}</h1>
                        <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center mt-1 truncate">
                            {player.nationality} {player.speciality && `• ${player.speciality}`}
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. BIDDING SECTION (Center) - Flexible */}
            <div className="flex-1 flex flex-col items-center justify-center z-10 px-2 border-l border-r border-slate-700/50 h-3/4 my-auto min-w-0">
                <p className="text-cyan-400 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-1 whitespace-nowrap">Current Bid</p>
                <div className="flex items-baseline justify-center w-full">
                    <span className="text-5xl md:text-6xl font-black text-white tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] truncate">
                        {bid.toLocaleString()}
                    </span>
                </div>
                <div className="mt-1 flex gap-4 text-xs font-medium text-slate-400 whitespace-nowrap">
                    <span>BASE: {player.basePrice}</span>
                </div>
            </div>

            {/* 3. TEAM SECTION (Right) - Fixed Width or Flexible but controlled */}
            <div className="w-[35%] md:w-[33%] h-full flex items-center px-4 md:px-6 justify-end relative overflow-hidden shrink-0">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-l from-blue-900/50 to-transparent opacity-50"></div>

                {bidder ? (
                    <div className="flex items-center gap-3 md:gap-6 z-10 text-right animate-fade-in w-full justify-end">
                        <div className="min-w-0 flex-1 flex flex-col items-end">
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 whitespace-nowrap">Winning Bidder</p>
                            <h2 className="text-xl md:text-2xl font-black text-white uppercase leading-none mb-1 text-shadow w-full truncate">{bidder.name}</h2>
                            <p className="text-[10px] md:text-sm font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded inline-block border border-green-500/30 whitespace-nowrap">
                                BAL: {bidder.budget.toLocaleString()}
                            </p>
                        </div>
                        <div className="w-14 h-14 md:w-20 md:h-20 bg-white p-1 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)] shrink-0 border-4 border-slate-800">
                            {bidder.logoUrl ? (
                                <img src={bidder.logoUrl} className="w-full h-full object-contain rounded-full" alt={bidder.name} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-800 font-black text-lg md:text-2xl rounded-full">
                                    {bidder.name.charAt(0)}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4 z-10 opacity-50 justify-end w-full">
                        <div className="text-right hidden sm:block">
                            <h2 className="text-xl md:text-2xl font-black text-slate-500 uppercase">Waiting for Bid</h2>
                            <p className="text-xs md:text-sm font-bold text-slate-600">Floor is open</p>
                        </div>
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-slate-700 flex items-center justify-center shrink-0">
                            <Gavel className="w-6 h-6 md:w-8 md:h-8 text-slate-600" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default OBSOverlay;
