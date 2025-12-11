
import React, { useState, useEffect } from 'react';
import Dashboard from './screens/Dashboard';
import AuthScreen from './screens/AuthScreen';
import OBSOverlay from './screens/OBSOverlay';
import OBSGreen from './screens/OBSGreen';
import LandingPage from './screens/LandingPage';
import AdminDashboard from './screens/AdminDashboard';
import SuperAdminDashboard from './screens/SuperAdminDashboard';
import CreateAuction from './screens/CreateAuction';
import AuctionManage from './screens/AuctionManage';
import PlayerRegistration from './screens/PlayerRegistration';
import { useAuction } from './hooks/useAuction';
import { auth } from './firebase';
import firebase from 'firebase/compat/app';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from './types';

const AppContent: React.FC = () => {
  const { userProfile, activeAuctionId } = useAuction();
  const [user, setUser] = useState<firebase.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Wait for Auth Init AND User Profile (if logged in) to prevent redirect race conditions
  if (isLoading || (user && !userProfile)) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
         <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-highlight mb-4"></div>
            <p className="text-highlight text-xl animate-pulse">Loading SM SPORTS...</p>
        </div>
      </div>
    );
  }

  const isLoggedIn = !!user;
  const isSuperAdmin = userProfile?.role === UserRole.SUPER_ADMIN;
  const isAdmin = userProfile?.role === UserRole.ADMIN || isSuperAdmin; // Super Admin has Admin privileges
  const isTeamOwner = userProfile?.role === UserRole.TEAM_OWNER;

  // Determine Redirect for Logged In User
  const getAuthRedirect = () => {
      if (isSuperAdmin) return "/super-admin";
      if (isAdmin) return "/admin";
      // If team owner and we know their auction, send them there. Otherwise home.
      if (isTeamOwner && activeAuctionId) return `/auction/${activeAuctionId}`;
      return "/";
  };

  return (
    <Routes>
        {/* Public Route: Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Public Route: Main Auction Room (Dynamic ID) */}
        <Route path="/auction/:auctionId" element={<Dashboard />} />

        {/* Public Route: Player Registration */}
        <Route path="/auction/:id/register" element={<PlayerRegistration />} />

        {/* Auth Route */}
        <Route path="/auth" element={
            isLoggedIn ? <Navigate to={getAuthRedirect()} replace /> : <AuthScreen />
        } />

        {/* Super Admin Route */}
        <Route path="/super-admin" element={
            isSuperAdmin ? <SuperAdminDashboard /> : <Navigate to="/auth" replace />
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={
            isAdmin ? <AdminDashboard /> : <Navigate to="/auth" replace />
        } />
        
        <Route path="/admin/new" element={
            isAdmin ? <CreateAuction /> : <Navigate to="/auth" replace />
        } />
        
        <Route path="/admin/auction/:id/manage" element={
            isAdmin ? <AuctionManage /> : <Navigate to="/auth" replace />
        } />

        {/* Utility Route: OBS Overlay (Transparent) */}
        <Route path="/obs-overlay/:auctionId" element={<OBSOverlay />} />

        {/* Utility Route: OBS Overlay (Green Screen) */}
        <Route path="/obs-green/:auctionId" element={<OBSGreen />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App: React.FC = () => {
  return (
      <AppContent />
  );
};

export default App;
