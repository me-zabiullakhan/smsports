
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { SupportTicket, SupportMessage, UserRole } from '../types';
import { useAuction } from '../hooks/useAuction';
import { 
    Headset, LogOut, MessageSquare, Clock, CheckCircle, Search, 
    Send, RefreshCw, ChevronRight, Mail, Monitor, X
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
    const [showResolved, setShowResolved] = useState(false);
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
        if (!activeTicketId) {
            setMessages([]);
            return;
        }
        const unsub = db.collection('supportTickets').doc(activeTicketId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snap => {
                setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage)));
                setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            });
        return () => unsub();
    }, [activeTicketId]);

    const handleSelectTicket = async (ticket: SupportTicket) => {
        setActiveTicketId(ticket.id);
        if (ticket.status === 'OPEN' && userProfile) {
            try {
                await db.collection('supportTickets').doc(ticket.id).update({
                    status: 'IN_PROGRESS',
                    staffId: userProfile.uid,
                    staffName: userProfile.name || 'Staff',
                    updatedAt: Date.now()
                });
            } catch (err) { console.error(err); }
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanReply = reply.trim();
        if (!cleanReply || !activeTicketId || !userProfile || isSending) return;
        
        const currentTicket = tickets.find(t => t.id === activeTicketId);
        if (!currentTicket || currentTicket.status === 'RESOLVED') return;

        setIsSending(true);
        try {
            await db.collection('supportTickets').doc(activeTicketId).collection('messages').add({
                ticketId: activeTicketId,
                senderId: userProfile.uid,
                senderName: userProfile.name || 'Staff',
                senderRole: UserRole.SUPPORT,
                text: cleanReply,
                timestamp: Date.now()
            });
            
            await db.collection('supportTickets').doc(activeTicketId).update({ 
                updatedAt: Date.now(),
                status: 'IN_PROGRESS' 
            });
            setReply('');
        } catch (err) { alert("Failed to send message."); }
        finally { setIsSending(false); }
    };

    const handleResolve = async (ticketId: string) => {
        if (!ticketId) return;
        if (window.confirm("Archive this conversation and mark as Resolved?")) {
            try {
                await db.collection('supportTickets').doc(ticketId).update({ 
                    status: 'RESOLVED', 
                    updatedAt: Date.now() 
                });
                if (activeTicketId === ticketId) setActiveTicketId(null);
                setShowResolved(true);
            } catch (err) { alert("Failed to resolve ticket."); }
        }
    };

    const handleEnterInstance = (auctionId: string) => {
        if (!auctionId) return alert("No instance ID linked.");
        if (window.confirm("Entering Remote Admin Mode. Proceed?")) {
            joinAuction(auctionId);
            navigate(`/auction/${auctionId}`);
        }
    };

    const filteredTickets = tickets.filter(t => showResolved ? t.status === 'RESOLVED' : t.status !== 'RESOLVED');
    const activeTicket = tickets.find(t => t.id === activeTicketId);

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
            <nav className="bg-slate-900 border-b border-white/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg"><Headset className="w-6 h-6 text-white" /></div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tighter text-blue-50">Support Dashboard</h1>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1 opacity-60">System Protocol Engine</p>
                    </div>
                </div>
                <button onClick={() => auth.signOut()} className="bg-slate-800 hover:bg-red-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">Logout</button>
            </nav>

            <main className="flex-1 flex overflow-hidden">
                <div className="w-96 border-r border-white/5 flex flex-col bg-slate-900/30">
                    <div className="p-6 border-b border-white/5 space-y-4">
                        <div className="flex items-center justify-between bg-black/20 p-1 rounded-xl border border-white/5">
                            <button onClick={() => setShowResolved(false)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${!showResolved ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Active</button>
                            <button onClick={() => setShowResolved(true)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${showResolved ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Archived</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                        {filteredTickets.map(t => (
                            <div key={t.id} onClick={() => handleSelectTicket(t)} className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all ${activeTicketId === t.id ? 'bg-blue-600/10 border-blue-600 shadow-xl' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-blue-400">#{t.id.split('-').pop()}</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${t.status === 'OPEN' ? 'bg-emerald-500 text-white animate-pulse' : t.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>{t.status}</span>
                                </div>
                                <h3 className="font-black text-sm uppercase leading-tight truncate">{t.subject}</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase truncate mt-1">{t.userName}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                    {activeTicket ? (
                        <>
                            <div className="p-6 bg-slate-900/90 backdrop-blur-md border-b border-white/5 flex justify-between items-center z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center font-black text-white">{activeTicket.userName.charAt(0)}</div>
                                    <div>
                                        <h2 className="font-black uppercase text-lg leading-none mb-1">{activeTicket.userName}</h2>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{activeTicket.userEmail}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {activeTicket.auctionId && <button onClick={() => handleEnterInstance(activeTicket.auctionId || '')} className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg flex items-center gap-2"><Monitor className="w-4 h-4" /> Remote</button>}
                                    {activeTicket.status !== 'RESOLVED' && <button onClick={() => handleResolve(activeTicket.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg flex items-center gap-2 transition-all active:scale-95"><CheckCircle className="w-4 h-4" /> Resolve</button>}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                                {messages.map(m => (
                                    <div key={m.id} className={`flex ${m.senderRole === UserRole.SUPPORT ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-md p-5 rounded-[2rem] shadow-xl ${m.senderRole === UserRole.SUPPORT ? 'bg-blue-600 text-white rounded-br-none border border-blue-400/30' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'}`}>
                                            <p className="text-sm font-medium leading-relaxed">{m.text}</p>
                                            <div className="mt-3 text-[8px] font-black uppercase opacity-50">{m.senderName} • {new Date(m.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={scrollRef} />
                            </div>
                            <div className={`p-6 bg-slate-900 border-t border-white/5 ${activeTicket.status === 'RESOLVED' ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                <form onSubmit={handleSendMessage} className="relative">
                                    <input value={reply} onChange={e => setReply(e.target.value)} placeholder="PROTOCOL RESPONSE..." className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] py-5 pl-8 pr-20 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                                    <button type="submit" disabled={isSending || !reply.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-3 rounded-full shadow-lg transition-all active:scale-90">{isSending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-700 opacity-20">
                            <Headset className="w-40 h-40 mb-6" />
                            <h2 className="text-4xl font-black uppercase tracking-[0.5em]">Terminal Standby</h2>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default StaffDashboard;
