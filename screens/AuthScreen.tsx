
import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, ArrowLeft, Key, Hash, Info, AlertTriangle, User, Chrome, ShieldAlert, ChevronRight, RefreshCw } from 'lucide-react';
import { auth, db } from '../firebase';
import firebase from 'firebase/compat/app';
import { useAuction } from '../hooks/useAuction';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const AuthScreen: React.FC = () => {
    const { setUserProfile } = useAuction();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'team' | 'admin'>('team');
    
    // Admin State
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isAdminRegister, setIsAdminRegister] = useState(false);

    // Handle deep linking for tabs/registration
    useEffect(() => {
        const tab = searchParams.get('tab');
        const mode = searchParams.get('mode');
        
        if (tab === 'admin') {
            setActiveTab('admin');
            if (mode === 'register') {
                setIsAdminRegister(true);
            }
        } else if (tab === 'team') {
            setActiveTab('team');
        }
    }, [searchParams]);

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
            
            <div className="w-full max-w-md relative z-10 flex flex-col items-center">
                <div className="w-full">
                    <Link to="/" className="inline-flex items-center text-text-secondary hover:text-white mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                    </Link>

                    <div className="text-center mb-8">
                        <h1 className="text-5xl font-bold text-highlight mb-2 tracking-tighter">🏏 SM SPORTS</h1>
                        <p className="text-text-secondary uppercase tracking-[0.3em] text-[10px] font-black opacity-60">Your Streaming Partner</p>
                    </div>

                    <div className="bg-secondary/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-accent/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-highlight/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                        
                        {/* Tabs */}
                        <div className="flex mb-8 bg-primary/50 rounded-xl p-1.5 border border-white/5">
                            <button 
                                onClick={() => { setActiveTab('team'); setError(null); setIsConfigError(false); setShowForgotPassword(false); }}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'team' ? 'bg-highlight text-primary shadow-xl' : 'text-text-secondary hover:text-white'}`}
                            >
                                Team Owner
                            </button>
                            <button 
                                onClick={() => { setActiveTab('admin'); setError(null); setIsConfigError(false); setShowForgotPassword(false); }}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'admin' ? 'bg-highlight text-primary shadow-xl' : 'text-text-secondary hover:text-white'}`}
                            >
                                Admin
                            </button>
                        </div>

                        <h2 className="text-xl font-black text-center text-white mb-8 uppercase tracking-tight">
                            {activeTab === 'team' ? 'Terminal Access' : (showForgotPassword ? 'Security Reset' : (isAdminRegister ? 'Create Account' : 'Authority Login'))}
                        </h2>

                        {/* Critical Config Error Alert */}
                        {isConfigError && (
                            <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 p-4 rounded-xl mb-6 text-sm">
                                <div className="flex items-center font-bold mb-2 text-yellow-400">
                                    <AlertTriangle className="w-4 h-4 mr-2" /> SETUP REQUIRED
                                </div>
                                <p className="mb-2 font-semibold">{configErrorMsg || "Configuration missing in Firebase."}</p>
                                <ol className="list-decimal list-inside space-y-1 text-xs text-yellow-100/80">
                                    <li>Go to Firebase Console &gt; <b>Authentication</b></li>
                                    <li>Click <b>Sign-in method</b> tab</li>
                                    {activeTab === 'team' ? (
                                         <li>Enable <b>Anonymous</b> provider.</li>
                                    ) : (
                                         <li>Enable <b>Email/Password</b> and <b>Google</b>.</li>
                                    )}
                                </ol>
                            </div>
                        )}

                        {/* Forgot Password Message */}
                        {resetMessage && (
                            <div className="bg-green-500/20 border border-green-500 text-green-200 p-4 rounded-xl mb-6 text-sm text-center font-bold">
                                {resetMessage}
                            </div>
                        )}

                        {activeTab === 'team' ? (
                            <form onSubmit={handleTeamSubmit} className="space-y-5">
                                <div className="relative group">
                                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary group-focus-within:text-highlight transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="ENTER TEAM ID (T001)"
                                        value={selectedTeamId}
                                        onChange={(e) => setSelectedTeamId(e.target.value.toUpperCase())}
                                        className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 pl-12 pr-4 text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/30 uppercase tracking-widest transition-all"
                                        required
                                    />
                                </div>

                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary group-focus-within:text-highlight transition-colors" />
                                    <input
                                        type="password"
                                        placeholder="ACCESS PASSWORD"
                                        value={teamPassword}
                                        onChange={(e) => setTeamPassword(e.target.value)}
                                        required
                                        className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 pl-12 pr-4 text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/30 tracking-widest transition-all"
                                    />
                                </div>

                                {error && !isConfigError && <p className="text-red-400 text-xs font-bold text-center bg-red-400/10 py-3 rounded-xl border border-red-500/20">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center bg-highlight hover:bg-teal-400 text-primary font-black py-5 px-6 rounded-2xl transition-all duration-500 transform hover:scale-[1.02] disabled:opacity-50 shadow-[0_15px_30px_rgba(56,178,172,0.3)] active:scale-95 uppercase tracking-[0.2em] text-sm"
                                >
                                   {isLoading ? <RefreshCw className="animate-spin w-5 h-5"/> : <><LogIn className="mr-2 h-5 w-5"/> ENTER TERMINAL</>}
                                </button>
                            </form>
                        ) : showForgotPassword ? (
                             <form onSubmit={handlePasswordReset} className="space-y-5 animate-fade-in">
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                    <input
                                        type="email"
                                        placeholder="REGISTERED EMAIL"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 pl-12 pr-4 text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/30 transition-all"
                                    />
                                </div>

                                {error && !isConfigError && <p className="text-red-400 text-xs font-bold text-center bg-red-400/10 py-3 rounded-xl border border-red-500/20">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center bg-highlight hover:bg-teal-400 text-primary font-black py-4 px-6 rounded-2xl transition-all uppercase tracking-widest text-xs"
                                >
                                   {isLoading ? 'PROCESSING...' : 'RECOVER ACCESS'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowForgotPassword(false)}
                                    className="w-full text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary hover:text-white"
                                >
                                    Return to Authentication
                                </button>
                             </form>
                        ) : (
                            <div className="space-y-6 animate-slide-up">
                                 <button
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center bg-white hover:bg-gray-100 text-gray-900 font-black py-4 px-6 rounded-2xl transition-all shadow-xl mb-4 text-sm active:scale-95"
                                >
                                    <Chrome className="mr-3 h-5 w-5 text-red-500" />
                                    SYNC WITH GOOGLE
                                </button>

                                <div className="relative flex py-1 items-center">
                                    <div className="flex-grow border-t border-gray-700"></div>
                                    <span className="flex-shrink-0 mx-4 text-gray-500 text-[9px] font-black uppercase tracking-[0.4em]">Secure Protocol</span>
                                    <div className="flex-grow border-t border-gray-700"></div>
                                </div>

                                <form onSubmit={handleAdminSubmit} className="space-y-4">
                                    {isAdminRegister && (
                                        <div className="relative animate-fade-in">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                            <input
                                                type="text"
                                                placeholder="FULL IDENTITY NAME"
                                                value={adminName}
                                                onChange={(e) => setAdminName(e.target.value)}
                                                required={isAdminRegister}
                                                className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 pl-12 pr-4 text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/30 transition-all"
                                            />
                                        </div>
                                    )}
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                        <input
                                            type="email"
                                            placeholder="OFFICIAL EMAIL"
                                            value={adminEmail}
                                            onChange={(e) => setAdminEmail(e.target.value)}
                                            required
                                            className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 pl-12 pr-4 text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/30 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                            <input
                                                type="password"
                                                placeholder="SECURE PASSWORD"
                                                value={adminPassword}
                                                onChange={(e) => setAdminPassword(e.target.value)}
                                                required
                                                className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 pl-12 pr-4 text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-highlight placeholder-text-secondary/30 transition-all"
                                            />
                                        </div>
                                        {!isAdminRegister && (
                                            <div className="text-right mt-3">
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setShowForgotPassword(true); setError(null); setResetMessage(null); }}
                                                    className="text-[9px] font-black uppercase tracking-widest text-text-secondary hover:text-highlight transition-colors"
                                                >
                                                    Credentials Lost?
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {error && !isConfigError && <p className="text-red-400 text-xs font-bold text-center bg-red-400/10 py-3 rounded-xl border border-red-500/20">{error}</p>}

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center bg-highlight hover:bg-teal-400 text-primary font-black py-5 px-6 rounded-2xl transition-all duration-500 shadow-[0_15px_30px_rgba(56,178,172,0.2)] active:scale-95 uppercase tracking-widest text-sm"
                                    >
                                    <LogIn className="mr-2 h-5 w-5"/> {isLoading ? 'AUTHORIZING...' : isAdminRegister ? 'INITIATE ACCOUNT' : 'LOGIN TO DASHBOARD'}
                                    </button>
                                    
                                    <div className="text-center mt-6">
                                        <button
                                            type="button"
                                            onClick={() => { setIsAdminRegister(!isAdminRegister); setError(null); setIsConfigError(false); }}
                                            className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary hover:text-highlight underline underline-offset-4"
                                        >
                                            {isAdminRegister ? 'Establish existing login' : 'Establish new admin identity'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                {/* SUPER ADMIN LOGIN BUTTON - Bottom Anchor */}
                <div className="mt-12 w-full max-w-sm">
                    <button 
                        onClick={handleGoogleLogin}
                        className="w-full group bg-slate-900/50 hover:bg-slate-900 border border-white/5 hover:border-red-500/50 p-4 rounded-2xl flex items-center justify-between transition-all duration-500 hover:shadow-2xl"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-red-500/20 p-3 rounded-xl group-hover:bg-red-500 group-hover:rotate-12 transition-all">
                                <ShieldAlert className="w-5 h-5 text-red-500 group-hover:text-white" />
                            </div>
                            <div className="text-left">
                                <p className="text-white font-black text-xs uppercase tracking-widest">Super Admin</p>
                                <p className="text-slate-500 text-[10px] uppercase font-bold">System Override Login</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                    </button>
                    <p className="mt-4 text-center text-slate-600 text-[9px] font-black uppercase tracking-[0.4em] opacity-40">Access strictly monitored by SM SPORTS</p>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
