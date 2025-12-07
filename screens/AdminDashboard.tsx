
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { Plus, Search, Menu, AlertCircle, RefreshCw, Database, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { AuctionSetup } from '../types';

const AdminDashboard: React.FC = () => {
  const { userProfile, logout } = useAuction();
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<AuctionSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDbMissing, setIsDbMissing] = useState(false);

  // Function to setup the listener
  const setupListener = () => {
        if (!userProfile?.uid) return () => {};

        setLoading(true);
        setError(null);
        setIsDbMissing(false);

        try {
            // COMPAT SYNTAX FIX: db.collection()
            // FILTER: Only show auctions created by the logged-in admin
            const unsubscribe = db.collection('auctions')
                .where('createdBy', '==', userProfile.uid)
                .onSnapshot((snapshot) => {
                    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
                    // Sort by createdAt descending (newest first)
                    // Note: Sorting is done client-side to avoid needing a composite index for every query
                    data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    
                    setAuctions(data);
                    setLoading(false);
                }, (error: any) => {
                    console.error("Error fetching auctions:", error);
                    setLoading(false);
                    
                    if (error.message && (error.message.includes("The database (default) does not exist") || error.code === 'not-found')) {
                        setIsDbMissing(true);
                        setError("Firestore Database not created yet.");
                    } else if (error.code === 'permission-denied') {
                        setError("Permission Denied: Check Firestore Security Rules.");
                    } else if (error.code === 'unavailable') {
                        setError("Network unavailable. Trying to reconnect...");
                    } else {
                        setError("Failed to load auctions: " + error.message);
                    }
                });
            return unsubscribe;
        } catch (e: any) {
            console.error("Error setting up listener", e);
            setError(e.message);
            setLoading(false);
            return () => {};
        }
  };

  useEffect(() => {
    let unsubscribe: () => void | undefined;

    // Only fetch if we have a profile (auth confirmed)
    if (userProfile && userProfile.uid) {
        unsubscribe = setupListener();
    } else {
        // Wait briefly for auth to settle
        const timer = setTimeout(() => setLoading(false), 2000);
        return () => clearTimeout(timer);
    }

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, [userProfile]);

  const handleLive = (id: string) => {
      navigate(`/auction/${id}`);
  }

  const handleManualRefresh = () => {
      // Force re-mount of listener
      setupListener();
  };

  const handleDeleteAuction = async (auctionId: string, title: string) => {
      if (window.confirm(`Are you sure you want to delete the auction "${title}"?\n\nThis action cannot be undone.`)) {
          try {
              await db.collection('auctions').doc(auctionId).delete();
          } catch (e: any) {
              console.error("Error deleting auction:", e);
              alert("Failed to delete auction: " + e.message);
          }
      }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button className="text-gray-500 hover:text-gray-700 lg:hidden"><Menu /></button>
                <h1 className="text-xl font-bold text-gray-700 hidden sm:block">SM SPORTS<span className="text-gray-400 font-normal">/admin</span></h1>
            </div>
            
            <div className="flex-1 max-w-md mx-6 hidden md:block">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search" 
                        className="w-full bg-gray-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-gray-700 transition-colors">
                    {userProfile?.name?.charAt(0) || 'A'}
                </div>
            </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
            <button 
                onClick={() => navigate('/admin/new')}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow transition-all flex items-center"
            >
                <Plus className="w-4 h-4 mr-2" /> Create new auction
            </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
            {/* Welcome Card */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-lg">
                        {userProfile?.name?.charAt(0) || 'A'}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Welcome, {userProfile?.name || 'Admin'}</h3>
                        <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500 flex items-center mt-1 transition-colors">
                             Sign out
                        </button>
                    </div>
                </div>
            </div>

            {/* CRITICAL DATABASE ERROR BANNER */}
            {isDbMissing && (
                <div className="bg-red-600 text-white rounded-xl p-6 shadow-lg border-2 border-red-800 animate-pulse">
                    <div className="flex items-start gap-4">
                        <Database className="w-10 h-10 shrink-0" />
                        <div>
                            <h3 className="text-xl font-bold mb-2">Setup Required: Create Database</h3>
                            <p className="mb-4">The Firestore database does not exist yet. The app cannot save or load auctions until you create it.</p>
                            <ol className="list-decimal list-inside space-y-1 mb-4 text-sm bg-red-700/50 p-4 rounded-lg">
                                <li>Go to the <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline font-bold hover:text-red-200">Firebase Console</a></li>
                                <li>Click on your project (<b>sm-sports...</b>)</li>
                                <li>In the left sidebar, click <b>Firestore Database</b></li>
                                <li>Click the <b>Create Database</b> button</li>
                                <li>Select a location (e.g., us-central1) and Start in <b>Test Mode</b> (or Production)</li>
                            </ol>
                            <button onClick={handleManualRefresh} className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-100">
                                I've Created It - Refresh Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Standard Error Banner */}
            {error && !isDbMissing && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                    <button onClick={handleManualRefresh} className="ml-auto text-sm underline hover:text-red-900">Retry</button>
                </div>
            )}

            {/* Auctions List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">My Auctions</h3>
                    <button onClick={handleManualRefresh} className="text-gray-400 hover:text-green-600 transition-colors" title="Refresh List">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                {loading ? (
                    <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                        Loading auctions...
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {auctions.length > 0 ? auctions.map((auction) => (
                            <div key={auction.id} className="p-6 hover:bg-gray-50 transition-colors group">
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div>
                                        <h4 className="font-bold text-gray-700 text-lg group-hover:text-green-700 transition-colors">{auction.title}</h4>
                                        <p className="text-sm text-gray-400 uppercase tracking-wider mt-1">{auction.sport} • {auction.date}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => navigate(`/auction/${auction.id}`)} className="text-blue-500 hover:bg-blue-50 px-3 py-1 rounded text-sm font-medium transition-colors">
                                            View
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/admin/auction/${auction.id}/manage`)}
                                            className="text-yellow-600 hover:bg-yellow-50 px-3 py-1 rounded text-sm font-medium transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleLive(auction.id!)}
                                            className="text-green-600 hover:bg-green-50 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center"
                                        >
                                            Live
                                        </button>
                                        <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                        <button 
                                            onClick={() => handleDeleteAuction(auction.id!, auction.title)}
                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                            title="Delete Auction"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-gray-400 italic">
                                {error ? "Could not load auctions." : "No auctions created yet. Click 'Create new auction' to start."}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;