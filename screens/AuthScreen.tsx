
import React, { useState } from 'react';
import { Mail, Lock, LogIn, ArrowLeft, Key, Hash, Info, AlertTriangle, User, Chrome, RefreshCw } from 'lucide-react';
import { auth, db } from '../firebase';
import firebase from 'firebase/compat/app';
import { useAuction } from '../hooks/useAuction';
import { Link, useNavigate } from 'react-router-dom';

const AuthScreen: React.FC = () => {
    const { setUserProfile } = useAuction();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'team' | 'admin'>('team');
    
    // Admin State
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isAdminRegister, setIsAdminRegister] = useState(false);

    // Forgot Password State
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetMessage, setResetMessage] = useState<string | null>(null);

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
            if (activeTab === 'team') {
                setConfigErrorMsg("Anonymous Authentication is disabled.");
                return "Team Login requires Anonymous Auth to be enabled.";
            } else {
                setConfigErrorMsg("Create (sign-up) is disabled.");
                return "Client-side sign-up is disabled.";
            }
        }
        if (code === 'auth/invalid-credential') {
            return "Invalid Credentials. If you are logging in, check your password. If you are new, please Register first.";
        }
        if (code === 'auth/wrong-password') {
            return "Incorrect Password.";
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
        if (code === 'auth/popup-closed-by-user') {
            return "Sign-in popup was closed.";
        }
        return err.message || "An unknown error occurred.";
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setIsConfigError(false);
        setIsLoading(true);
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
            // App.tsx auth listener will handle redirection
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetEmail) {
            setError("Please enter your email address.");
            return;
        }
        setError(null);
        setIsLoading(true);
        try {
            await auth.sendPasswordResetEmail(resetEmail);
            setResetMessage("Password reset email sent! Check your inbox.");
            setIsLoading(false);
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            setIsLoading(false);
        }
    };

    const handleAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsConfigError(false);
        setIsLoading(true);

        try {
            // Force clean slate before attempting login/register
            if (auth.currentUser) {
                await auth.signOut();
            }

            if (isAdminRegister) {
                if (!adminName.trim()) {
                    throw new Error("Full Name is required for registration.");
                }
                const userCredential = await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
                if (userCredential.user) {
                    await userCredential.user.updateProfile({
                        displayName: adminName
                    });
                }
            } else {
                await auth.signInWithEmailAndPassword(adminEmail, adminPassword);
            }
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
            const auctionsSnapshot = await db.collection('auctions').get();
            
            if (auctionsSnapshot.empty) {
                throw new Error("No auctions found.");
            }

            let matchedTeam: any = null;
            let auctionId: string = "";

            for (const doc of auctionsSnapshot.docs) {
                const teamQuery = await doc.ref.collection('teams').where('id', '==', selectedTeamId).limit(1).get();
                if (!teamQuery.empty) {
                    matchedTeam = teamQuery.docs[0].data();
                    auctionId = doc.id;
                    break;
                }
            }

            if (!matchedTeam) {
                throw new Error("Team ID not found.");
            }

            if (matchedTeam.password && matchedTeam.password !== teamPassword) {
                throw new Error("Incorrect Password.");
            }

            const sessionData = {
                role: 'TEAM_OWNER',
                teamId: selectedTeamId,
                auctionId: auctionId
            };
            localStorage.setItem('sm_sports_team_session', JSON.stringify(sessionData));

            // Force clean slate
            if (auth.currentUser) {
                await auth.signOut();
            }
            
            await auth.signInAnonymously();
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
                    <p className="text-text-secondary uppercase tracking-widest text-sm">Your Streaming Partner</p>
                </div>

                <div className="bg-secondary/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-accent">
                    
                    {/* Tabs */}
                    <div className="flex mb-6 bg-primary/50 rounded-lg p-1">
                        <button 
                            onClick={() => { setActiveTab('team'); setError(null); setIsConfigError(false); setShowForgotPassword(false); }}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'team' ? 'bg-highlight text-primary shadow-lg' : 'text-text-secondary hover:text-white'}`}
                        >
                            Team Owner
                        </button>
                        <button 
                            onClick={() => { setActiveTab('admin'); setError(null); setIsConfigError(false); setShowForgotPassword(false); }}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-highlight text-primary shadow-lg' : 'text-text-secondary hover:text-white'}`}
                        >
                            Admin
                        </button>
                    </div>

                    <h2 className="text-xl font-bold text-center text-white mb-6">
                        {activeTab === 'team' ? 'Team Terminal Access' : (showForgotPassword ? 'Reset Password' : (isAdminRegister ? 'Create Admin Account' : 'Administrator Login'))}
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
                                     <li>Enable <b>Email/Password</b> and <b>Google</b> providers.</li>
                                )}
                            </ol>
                        </div>
                    )}

                    {/* Forgot Password Message */}
                    {resetMessage && (
                        <div className="bg-green-500/20 border border-green-500 text-green-200 p-3 rounded-lg mb-4 text-sm text-center">
                            {resetMessage}
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

                            {error && !isConfigError && <p className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded border border-red-500/20">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center bg-highlight hover:bg-teal-400 text-primary font-extrabold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 shadow-[0_0_15px_rgba(56,178,172,0.5)]"
                            >
                               <LogIn className="mr-2 h-5 w-5"/> {isLoading ? 'VERIFYING...' : 'ENTER AUCTION'}
                            </button>
                        </form>
                    ) : showForgotPassword ? (
                         // FORGOT PASSWORD FORM
                         <form onSubmit={handlePasswordReset} className="space-y-5 animate-fade-in">
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                <input
                                    type="email"
                                    placeholder="Enter your registered email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    required
                                    className="w-full bg-primary border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-text-main focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/50"
                                />
                            </div>

                            {error && !isConfigError && <p className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded border border-red-500/20">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center bg-highlight hover:bg-teal-400 text-primary font-extrabold py-3 px-6 rounded-lg transition-all"
                            >
                               {isLoading ? 'SENDING...' : 'SEND RESET LINK'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(false)}
                                className="w-full text-sm text-text-secondary hover:text-white"
                            >
                                Back to Login
                            </button>
                         </form>
                    ) : (
                        // ADMIN LOGIN / REGISTER FORM
                        <div className="space-y-5 animate-slide-up">
                             <button
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center bg-white hover:bg-gray-100 text-gray-800 font-bold py-3 px-6 rounded-lg transition-all shadow-md mb-4"
                            >
                                <Chrome className="mr-2 h-5 w-5 text-red-500" />
                                Sign in with Google
                            </button>

                            <div className="relative flex py-1 items-center">
                                <div className="flex-grow border-t border-gray-600"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Or with Email</span>
                                <div className="flex-grow border-t border-gray-600"></div>
                            </div>

                            <form onSubmit={handleAdminSubmit} className="space-y-4">
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
                                <div>
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
                                    {!isAdminRegister && (
                                        <div className="text-right mt-2">
                                            <button 
                                                type="button" 
                                                onClick={() => { setShowForgotPassword(true); setError(null); setResetMessage(null); }}
                                                className="text-xs text-text-secondary hover:text-highlight transition-colors"
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {error && !isConfigError && <p className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded border border-red-500/20">{error}</p>}

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
                        </div>
                    )}

                    {/* Demo Credentials Box */}
                    <div className="mt-8 bg-primary/40 p-4 rounded-lg border border-white/5 text-xs text-text-secondary">
                        <div className="flex items-center mb-2 text-highlight font-bold">
                            <Info className="w-3 h-3 mr-1" /> CREDENTIALS INFO
                        </div>
                        <ul className="space-y-1 list-disc list-inside text-gray-400">
                            <li><span className="text-white font-semibold">Admin:</span> Use Google Sign-in or register an email.</li>
                            <li><span className="text-white font-semibold">Team Owner:</span> Use the <span className="text-highlight">Team ID</span> (e.g. T001) and <span className="text-highlight">Password</span> provided by Admin.</li>
                        </ul>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
