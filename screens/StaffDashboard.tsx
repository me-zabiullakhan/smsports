import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { SupportTicket, SupportMessage, UserRole, UserProfile } from '../types';
import { useAuction } from '../hooks/useAuction';
import { 
    Headset, LogOut, MessageSquare, Clock, CheckCircle, Search, 
    Send, User, AlertCircle, ExternalLink, Activity, Users, 
    ShieldAlert, RefreshCw, ChevronRight, Hash, Mail, Monitor
} from 'lucide-react';

const StaffDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { userProfile, joinAuction } = useAuction();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [reply, setReply] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = db.collection('supportTickets')
            .orderBy('updatedAt', 'desc')
            .onSnapshot(snap => {
                setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket)));
                setLoading(false);
            });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!activeTicketId) return;
        const unsub = db.collection('supportTickets').doc(activeTicketId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snap => {
                setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage)));
                setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            });
        return () => unsub();
    }, [activeTicketId]);

    const handleAcceptTicket = async (ticketId: string) => {
        if (!userProfile) return;
        await db.collection('supportTickets').doc(ticketId).update({
            status: 'IN_PROGRESS',
            staffId: userProfile.uid,
            staffName: userProfile.name,
            updatedAt: Date.now()
        });
        setActiveTicketId(ticketId);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reply.trim() || !activeTicketId || !userProfile || isSending) return;
        setIsSending(true);
        try {
            const msg: Omit<SupportMessage, 'id'> = {
                ticketId: activeTicketId,
                senderId: userProfile.uid,
                senderName: userProfile.name || 'Staff',
                senderRole: UserRole.SUPPORT,
                text: reply,
                timestamp: Date.now()
            };
            await db.collection('supportTickets').doc(activeTicketId).collection('messages').add(msg);
            await db.collection('supportTickets').doc(activeTicketId).update({ updatedAt: Date.now() });
            setReply('');
        } catch (err) { alert("Fail to send"); }
        finally { setIsSending(false); }
    };

    const handleResolve = async (ticketId: string) => {
        if (window.confirm("Mark as resolved? User will be notified.")) {
            await db.collection('supportTickets').doc(ticketId).update({ status: 'RESOLVED', updatedAt: Date.now() });
            setActiveTicketId(null);
        }
    };

    const handleEnterInstance = (auctionId: string) => {
        if (!auctionId) return alert("No active auction instance linked to this user.");
        if (window.confirm("Entering Remote Assistance Mode. You will have full access to this auction's dashboard. Proceed?")) {
            joinAuction(auctionId);
            navigate(`/auction/${auctionId}`);
        }
    };

    const activeTicket = tickets.find(t => t.id === activeTicketId);

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
            <nav className="bg-slate-900 border-b border-white/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg">
                        <Headset className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tighter">Command Center</h1>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Operator: {userProfile?.name}</p>
                    </div>
                </div>
                <button onClick={() => auth.signOut()} className="bg-slate-800 hover:bg-red-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> TERMINATE SESSION
                </button>
            </nav>

            <main className="flex-1 flex overflow-hidden">
                {/* Left: Ticket Queue */}
                <div className="w-96 border-r border-white/5 flex flex-col bg-slate-900/30">
                    <div className="p-6 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input placeholder="SEARCH TICKET ID..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                        {tickets.map(t => (
                            <div 
                                key={t.id} 
                                onClick={() => setActiveTicketId(t.id)}
                                className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all ${activeTicketId === t.id ? 'bg-blue-600/10 border-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.2)]' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-black text-blue-400 tracking-widest">#{t.id}</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${t.status === 'OPEN' ? 'bg-emerald-500 text-white animate-pulse' : t.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                        {t.status}
                                    </span>
                                </div>
                                <h3 className="font-black text-sm uppercase leading-tight truncate mb-1">{t.subject}</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{t.userName}</p>
                                <div className="mt-4 flex items-center gap-2 text-[8px] font-black text-slate-600 uppercase border-t border-white/5 pt-4">
                                    <Clock className="w-3 h-3" /> {new Date(t.createdAt).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center: Chat Window */}
                <div className="flex-1 flex flex-col relative">
                    {activeTicket ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-6 bg-slate-900/80 backdrop-blur-md border-b border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-black text-blue-500 border border-white/10 shadow-xl">
                                        {activeTicket.userName.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="font-black uppercase tracking-tight text-lg">{activeTicket.userName}</h2>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                                            <Mail className="w-3 h-3" /> {activeTicket.userEmail}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => handleEnterInstance(activeTicket.auctionId || '')}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95"
                                    >
                                        <Monitor className="w-4 h-4" /> Remote Access
                                    </button>
                                    <button 
                                        onClick={() => handleResolve(activeTicket.id)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Close Ticket
                                    </button>
                                </div>
                            </div>

                            {/* Chat Feed */}
                            <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                                {messages.map(m => (
                                    <div key={m.id} className={`flex ${m.senderRole === UserRole.SUPPORT ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-md p-5 rounded-[2rem] shadow-xl ${m.senderRole === UserRole.SUPPORT ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                                            <p className="text-sm font-medium leading-relaxed">{m.text}</p>
                                            <div className="mt-3 flex items-center gap-2 text-[8px] font-black uppercase opacity-50">
                                                {m.senderName} • {new Date(m.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={scrollRef} />
                            </div>

                            {/* Chat Input */}
                            <div className="p-6 bg-slate-900 border-t border-white/5">
                                <form onSubmit={handleSendMessage} className="relative">
                                    <input 
                                        value={reply} 
                                        onChange={e => setReply(e.target.value)}
                                        placeholder="TYPE SECURE RESPONSE..." 
                                        className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] py-5 pl-8 pr-20 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-2xl" 
                                    />
                                    <button 
                                        type="submit"
                                        disabled={isSending || !reply.trim()}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-full transition-all disabled:opacity-50 active:scale-90"
                                    >
                                        {isSending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    </button>
                                </form>
                                <div className="mt-4 flex gap-2">
                                    {["Checking for you.", "Please refresh OBS.", "Bid reset done.", "Issue solved."].map(q => (
                                        <button key={q} onClick={() => setReply(q)} className="text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest border border-white/5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all">
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-700 opacity-20">
                            <Headset className="w-40 h-40 mb-6" />
                            <h2 className="text-4xl font-black uppercase tracking-[0.5em]">System Idle</h2>
                        </div>
                    )}
                </div>

                {/* Right: Quick Stats */}
                <div className="w-80 border-l border-white/5 p-8 space-y-10 bg-slate-900/30">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Staff Metrics</h4>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-slate-900 p-5 rounded-3xl border border-white/5">
                                <p className="text-xs font-bold text-slate-500 uppercase">Resolved Today</p>
                                <p className="text-3xl font-black text-emerald-500 mt-1">12</p>
                            </div>
                            <div className="bg-slate-900 p-5 rounded-3xl border border-white/5">
                                <p className="text-xs font-bold text-slate-500 uppercase">Avg Response</p>
                                <p className="text-3xl font-black text-blue-500 mt-1">1.4m</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Activity className="w-3 h-3 text-emerald-500" /> Active Registry
                        </h4>
                        <div className="space-y-4">
                            {tickets.filter(t => t.status === 'OPEN').slice(0, 3).map(t => (
                                <div key={t.id} className="flex items-center gap-4 group">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-white truncate max-w-[120px]">{t.subject}</p>
                                        <p className="text-[8px] font-bold text-slate-600 uppercase">WAITING: {Math.floor((Date.now() - t.createdAt) / 60000)}M</p>
                                    </div>
                                    <button onClick={() => handleAcceptTicket(t.id)} className="ml-auto opacity-0 group-hover:opacity-100 p-2 bg-blue-600 rounded-lg transition-all active:scale-90">
                                        <ChevronRight className="w-3 h-3 text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StaffDashboard;