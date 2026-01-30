import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { SupportTicket, SupportMessage, UserRole } from '../types';
import { useAuction } from '../hooks/useAuction';
import { Headset, X, Send, MessageCircle, RefreshCw, ChevronRight, HelpCircle, ShieldAlert, Zap, AlertCircle } from 'lucide-react';

const SupportWidget: React.FC = () => {
    const { userProfile, activeAuctionId } = useAuction();
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'BOT' | 'CHAT' | 'TICKET_FORM'>('BOT');
    const [ticket, setTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Common bot replies
    const QUICK_REPLIES = [
        { id: 'obs', label: 'OBS Setup Help', response: 'Our professional OBS overlays can be added as a "Browser Source". Would you like a live staff member to guide you?' },
        { id: 'bid', label: 'Bid Corrections', response: 'If a bid was entered incorrectly, use the "Undo Last Action" button on your admin panel. Still need help?' },
        { id: 'budget', label: 'Budget/Purse Issue', response: 'Budgets are auto-calculated. If you manually changed a sale price, it updates immediately. Should I connect you to staff?' },
        { id: 'staff', label: 'Speak to Staff', response: 'Connecting you to our team. Please describe your issue clearly.' }
    ];

    useEffect(() => {
        if (!isOpen || !userProfile?.uid) return;
        
        // Listen for user's active open ticket
        const unsub = db.collection('supportTickets')
            .where('userId', '==', userProfile.uid)
            .where('status', 'in', ['OPEN', 'IN_PROGRESS'])
            .limit(1)
            .onSnapshot(snap => {
                if (!snap.empty) {
                    const t = { id: snap.docs[0].id, ...snap.docs[0].data() } as SupportTicket;
                    setTicket(t);
                    setView('CHAT');
                } else {
                    setTicket(null);
                    if (view === 'CHAT') setView('BOT');
                }
            });
        return () => unsub();
    }, [isOpen, userProfile?.uid]);

    useEffect(() => {
        if (!ticket?.id || view !== 'CHAT') return;
        const unsub = db.collection('supportTickets').doc(ticket.id).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snap => {
                setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage)));
                setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            });
        return () => unsub();
    }, [ticket?.id, view]);

    const createTicket = async (subject: string, initialMessage?: string) => {
        if (!userProfile) return;
        setIsProcessing(true);
        try {
            const ticketId = `TIC-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            // Fix: Change type from Omit<SupportTicket, 'id'> to SupportTicket because id is explicitly provided
            const newTicket: SupportTicket = {
                id: ticketId,
                userId: userProfile.uid,
                userName: userProfile.name || 'Anonymous',
                userEmail: userProfile.email,
                auctionId: activeAuctionId || '',
                subject,
                status: 'OPEN',
                priority: 'MEDIUM',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await db.collection('supportTickets').doc(ticketId).set(newTicket);
            
            if (initialMessage) {
                await db.collection('supportTickets').doc(ticketId).collection('messages').add({
                    ticketId,
                    senderId: userProfile.uid,
                    senderName: userProfile.name || 'User',
                    senderRole: userProfile.role,
                    text: initialMessage,
                    timestamp: Date.now()
                });
            }
            setView('CHAT');
        } catch (e) { alert("Ticket system offline."); }
        finally { setIsProcessing(false); }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !ticket || !userProfile || isProcessing) return;
        setIsProcessing(true);
        try {
            await db.collection('supportTickets').doc(ticket.id).collection('messages').add({
                ticketId: ticket.id,
                senderId: userProfile.uid,
                senderName: userProfile.name || 'User',
                senderRole: userProfile.role,
                text: input,
                timestamp: Date.now()
            });
            await db.collection('supportTickets').doc(ticket.id).update({ updatedAt: Date.now() });
            setInput('');
        } catch (e) { console.error(e); }
        finally { setIsProcessing(false); }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] font-sans">
            {!isOpen ? (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:rotate-12 border-4 border-white/20 relative group"
                >
                    <Headset className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full"></span>
                    <div className="absolute right-16 bg-slate-900 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none tracking-widest border border-white/10 shadow-xl">
                        HELP TERMINAL
                    </div>
                </button>
            ) : (
                <div className="bg-slate-900 w-80 h-[500px] rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden flex flex-col animate-slide-up">
                    {/* Header */}
                    <div className="bg-blue-600 p-6 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
                                <Headset className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-black uppercase text-xs tracking-widest">Support Portal</h3>
                                <p className="text-blue-100 text-[8px] font-black uppercase tracking-[0.3em] opacity-60">Status: Secure Line</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors relative z-10"><X className="w-5 h-5"/></button>
                    </div>

                    {/* Content View */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/20">
                        {view === 'BOT' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="bg-slate-800 p-4 rounded-2xl rounded-bl-none text-xs font-medium text-slate-300 leading-relaxed shadow-lg">
                                    Welcome to SM SPORTS Technical Hub. I can help with standard issues or connect you to our support staff.
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {QUICK_REPLIES.map(q => (
                                        <button 
                                            key={q.id}
                                            onClick={() => q.id === 'staff' ? setView('TICKET_FORM') : createTicket(q.label, q.response)}
                                            className="w-full text-left p-3 rounded-xl border border-white/5 bg-slate-900/50 hover:bg-blue-600/10 hover:border-blue-500/30 text-[10px] font-black text-slate-400 hover:text-blue-400 uppercase tracking-widest transition-all flex justify-between items-center"
                                        >
                                            {q.label} <ChevronRight className="w-3 h-3" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {view === 'TICKET_FORM' && (
                            <div className="space-y-4 animate-fade-in">
                                <button onClick={() => setView('BOT')} className="text-[8px] font-black text-slate-500 hover:text-white flex items-center gap-1 uppercase mb-4">
                                    <ChevronRight className="w-3 h-3 rotate-180" /> Go Back
                                </button>
                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">New Support Ticket</h4>
                                <div className="space-y-3">
                                    <input 
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-blue-500" 
                                        placeholder="ISSUE SUBJECT..." 
                                        id="sub"
                                    />
                                    <textarea 
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white min-h-[100px] outline-none focus:border-blue-500" 
                                        placeholder="DESCRIBE YOUR PROBLEM..." 
                                        id="desc"
                                    />
                                    <button 
                                        onClick={() => {
                                            const s = (document.getElementById('sub') as HTMLInputElement).value;
                                            const d = (document.getElementById('desc') as HTMLTextAreaElement).value;
                                            if (s && d) createTicket(s, d);
                                        }}
                                        disabled={isProcessing}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-900/20 uppercase text-[10px] tracking-widest transition-all"
                                    >
                                        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin mx-auto"/> : 'INITIALIZE TICKET'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {view === 'CHAT' && ticket && (
                            <div className="space-y-4 pb-4 animate-fade-in">
                                <div className="text-center pb-4 border-b border-white/5">
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">Ticket #{ticket.id}</p>
                                    <p className={`text-[8px] font-bold uppercase mt-1 ${ticket.status === 'OPEN' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                        Status: {ticket.status === 'OPEN' ? 'Waiting for Staff...' : `Connected to ${ticket.staffName}`}
                                    </p>
                                    {ticket.status === 'OPEN' && (
                                        <div className="mt-2 text-[8px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1">
                                            <Zap className="w-3 h-3 text-yellow-500" /> Est. wait: 2-3 mins
                                        </div>
                                    )}
                                </div>
                                {messages.map(m => (
                                    <div key={m.id} className={`flex ${m.senderRole === UserRole.SUPPORT ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] p-3 rounded-2xl text-[11px] font-medium leading-relaxed shadow-lg ${m.senderRole === UserRole.SUPPORT ? 'bg-slate-800 text-slate-200 rounded-bl-none' : 'bg-blue-600 text-white rounded-br-none'}`}>
                                            {m.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={scrollRef} />
                            </div>
                        )}
                    </div>

                    {/* Chat Input Area */}
                    {view === 'CHAT' && ticket && (
                        <div className="p-4 bg-slate-900 border-t border-white/5">
                            <form onSubmit={sendMessage} className="relative">
                                <input 
                                    value={input} 
                                    onChange={e => setInput(e.target.value)}
                                    placeholder="TYPE MESSAGE..." 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-full py-3 pl-4 pr-12 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all shadow-xl" 
                                />
                                <button 
                                    type="submit"
                                    disabled={isProcessing || !input.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-full transition-all disabled:opacity-50 active:scale-90"
                                >
                                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SupportWidget;