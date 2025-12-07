
import React, { useState } from 'react';
import { Mail, Lock, LogIn, ArrowLeft, Key, Hash, Info, AlertTriangle, User } from 'lucide-react';
import { auth, db } from '../firebase';
import { useAuction } from '../hooks/useAuction';
import { Link, useNavigate } from 'react-router-dom';
import { Team } from '../types';

const AuthScreen: React.FC = () => {
    const { setUserProfile } = useAuction();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'team' | 'admin'>('team');
    
    // Admin State
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isAdminRegister, setIsAdminRegister] = useState(false);

    // Team State
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [teamPassword, setTeamPassword] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [isConfigError, setIsConfigError] = useState(false);
    const [configErrorMsg, setConfigErrorMsg] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const getFriendlyErrorMessage = (err: any) => {
        const code = err.code;
        console.error("Auth Error:", code, err.message);
        
        if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
            setIsConfigError(true);
            return "Firebase Authentication provider is disabled.";
        }
        if (code === 'auth/admin-restricted-operation') {
            setIsConfigError(true);
            // Distinguish between Email registration and Anonymous login
            if (activeTab === 'team') {
                setConfigErrorMsg("Anonymous Authentication is disabled.");
                return "Team Login requires Anonymous Auth to be enabled.";
            } else {
                setConfigErrorMsg("Create (sign-up) is disabled.");
                return "Client-side sign-up is disabled.";
            }
        }
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
            return "Incorrect Email or Password.";
        }
        if (code === 'auth/user-not-found') {
            return "User not found. Please register first.";
        }
        if (code === 'auth/email-already-in-use') {
            return "This email is already currently used by another account.";
        }
        if (code === 'auth/weak-password') {
            return "Password should be at least 6 characters.";
        }
        return err.message || "An unknown error occurred.";
    };

    const handleAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsConfigError(false);
        setIsLoading(true);

        try {
            // Ensure no previous session exists
            await auth.signOut();

            // Admin Login Logic
            if (isAdminRegister) {
                if (!adminName.trim()) {
                    throw new Error("Full Name is required for registration.");
                }
                const userCredential = await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
                // Update Profile with Name
                if (userCredential.user) {
                    await userCredential.user.updateProfile({
                        displayName: adminName
                    });
                }
            } else {
                await auth.signInWithEmailAndPassword(adminEmail, adminPassword);
            }
            // App.tsx will handle redirection via Auth State listener
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            setIsLoading(false);
        }
    };

    const handleTeamSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsConfigError(false);
        setIsLoading(true);

        try {
            // TEAM LOGIN LOGIC (Refactored to avoid Index requirement):
            // 1. Fetch all auctions first
            const auctionsSnapshot = await db.collection('auctions').get();
            
            if (auctionsSnapshot.empty) {
                throw new Error("No auctions found.");
            }

            let matchedTeam: any = null;
            let auctionId: string = "";

            // 2. Search for the team in each auction
            // We iterate because we don't know which auction the team belongs to
            for (const doc of auctionsSnapshot.docs) {
                // Try to find the team in this auction's subcollection
                const teamQuery = await doc.ref.collection('teams').where('id', '==', selectedTeamId).limit(1).get();
                
                if (!teamQuery.empty) {
                    matchedTeam = teamQuery.docs[0].data();
                    auctionId = doc.id;
                    break; // Found the team, stop searching
                }
            }

            if (!matchedTeam) {
                throw new Error("Team ID not found.");
            }

            // 3. Verify Password manually (Client-side verification)
            // If password field exists on team data, verify it.
            if (matchedTeam.password && matchedTeam.password !== teamPassword) {
                throw new Error("Incorrect Password.");
            }

            // 4. Save Session locally BEFORE auth trigger to avoid race condition
            // This ensures Context picks up the right role/auction immediately
            const sessionData = {
                role: 'TEAM_OWNER',
                teamId: selectedTeamId,
                auctionId: auctionId
            };
            localStorage.setItem('sm_sports_team_session', JSON.stringify(sessionData));

            // Ensure no previous session exists
            await auth.signOut();

            // 5. Login Anonymously to Firebase to satisfy security rules (request.auth != null)
            await auth.signInAnonymously();
            
            // 6. Force Redirect to specific auction dashboard
            // Although App.tsx has redirect logic, this acts as a failsafe
            navigate(`/auction/${auctionId}`);

        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-primary font-sans flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=2067&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat relative">
            <div className="absolute inset-0 bg-primary/90 backdrop-blur-sm"></div>
            
            <div className="w-full max-w-md relative z-10">
                <Link to="/" className="inline-flex items-center text-text-secondary hover:text-white mb-6 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold text-highlight mb-2">🏏 SM SPORTS</h1>
                    <p className="text-text-secondary uppercase tracking-widest text-sm">Premier Auction League</p>
                </div>

                <div className="bg-secondary/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-accent">
                    
                    {/* Tabs */}
                    <div className="flex mb-6 bg-primary/50 rounded-lg p-1">
                        <button 
                            onClick={() => { setActiveTab('team'); setError(null); setIsConfigError(false); }}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'team' ? 'bg-highlight text-primary shadow-lg' : 'text-text-secondary hover:text-white'}`}
                        >
                            Team Owner
                        </button>
                        <button 
                            onClick={() => { setActiveTab('admin'); setError(null); setIsConfigError(false); }}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-highlight text-primary shadow-lg' : 'text-text-secondary hover:text-white'}`}
                        >
                            Admin
                        </button>
                    </div>

                    <h2 className="text-xl font-bold text-center text-white mb-6">
                        {activeTab === 'team' ? 'Team Terminal Access' : (isAdminRegister ? 'Create Admin Account' : 'Administrator Login')}
                    </h2>

                    {/* Critical Config Error Alert */}
                    {isConfigError && (
                        <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 p-4 rounded-lg mb-6 text-sm">
                            <div className="flex items-center font-bold mb-2 text-yellow-400">
                                <AlertTriangle className="w-4 h-4 mr-2" /> SETUP REQUIRED
                            </div>
                            <p className="mb-2 font-semibold">{configErrorMsg || "Configuration missing in Firebase."}</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs text-yellow-100/80">
                                <li>Go to <a href="https://console.firebase.google.com" target="_blank" className="underline hover:text-white">Firebase Console</a> &gt; <b>Authentication</b></li>
                                <li>Click <b>Sign-in method</b> tab</li>
                                {activeTab === 'team' ? (
                                     <li>Enable <b>Anonymous</b> provider and Save.</li>
                                ) : (
                                     <li>Go to <b>Settings</b> &gt; <b>User actions</b> &gt; Enable <b>Create (sign-up)</b>.</li>
                                )}
                            </ol>
                        </div>
                    )}

                    {activeTab === 'team' ? (
                        <form onSubmit={handleTeamSubmit} className="space-y-5">
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                <input
                                    type="text"
                                    placeholder="Enter Team ID (e.g., T001)"
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value.toUpperCase())}
                                    className="w-full bg-primary border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-text-main focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/50 uppercase"
                                    required
                                />
                            </div>

                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                <input
                                    type="password"
                                    placeholder="Team Password"
                                    value={teamPassword}
                                    onChange={(e) => setTeamPassword(e.target.value)}
                                    required
                                    className="w-full bg-primary border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-text-main focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/50"
                                />
                            </div>

                            {error && !isConfigError && <p className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center bg-highlight hover:bg-teal-400 text-primary font-extrabold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 shadow-[0_0_15px_rgba(56,178,172,0.5)]"
                            >
                               <LogIn className="mr-2 h-5 w-5"/> {isLoading ? 'VERIFYING...' : 'ENTER AUCTION'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleAdminSubmit} className="space-y-5">
                            {isAdminRegister && (
                                <div className="relative animate-fade-in">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        value={adminName}
                                        onChange={(e) => setAdminName(e.target.value)}
                                        required={isAdminRegister}
                                        className="w-full bg-primary border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-text-main focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/50"
                                    />
                                </div>
                            )}
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                <input
                                    type="email"
                                    placeholder="Admin Email"
                                    value={adminEmail}
                                    onChange={(e) => setAdminEmail(e.target.value)}
                                    required
                                    className="w-full bg-primary border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-text-main focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/50"
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    required
                                    className="w-full bg-primary border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-text-main focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/50"
                                />
                            </div>

                            {error && !isConfigError && <p className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center bg-highlight hover:bg-teal-400 text-primary font-extrabold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 shadow-[0_0_15px_rgba(56,178,172,0.5)]"
                            >
                               <LogIn className="mr-2 h-5 w-5"/> {isLoading ? 'CONNECTING...' : isAdminRegister ? 'REGISTER ADMIN' : 'LOGIN ADMIN'}
                            </button>
                            
                            <div className="text-center mt-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsAdminRegister(!isAdminRegister); setError(null); setIsConfigError(false); }}
                                    className="text-xs text-text-secondary hover:text-highlight underline"
                                >
                                    {isAdminRegister ? 'Back to Login' : 'Register new Admin?'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Demo Credentials Box */}
                    <div className="mt-8 bg-primary/40 p-4 rounded-lg border border-white/5 text-xs text-text-secondary">
                        <div className="flex items-center mb-2 text-highlight font-bold">
                            <Info className="w-3 h-3 mr-1" /> CREDENTIALS INFO
                        </div>
                        <ul className="space-y-1 list-disc list-inside text-gray-400">
                            <li><span className="text-white font-semibold">Admin:</span> Login with your registered email/password.</li>
                            <li><span className="text-white font-semibold">Team Owner:</span> Use the <span className="text-highlight">Team ID</span> (e.g. T001) and <span className="text-highlight">Password</span> provided by Admin.</li>
                        </ul>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AuthScreen;