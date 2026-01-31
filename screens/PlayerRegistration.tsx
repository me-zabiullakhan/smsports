import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, RegistrationConfig, FormField, PlayerRole } from '../types';
import { Upload, Calendar, CheckCircle, AlertTriangle, ArrowUpCircle, FileText, Home, ArrowLeft, Loader2, CreditCard, QrCode, ShieldCheck } from 'lucide-react';

const PlayerRegistration: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [auction, setAuction] = useState<AuctionSetup | null>(null);
    const [config, setConfig] = useState<RegistrationConfig | null>(null);
    const [roles, setRoles] = useState<PlayerRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);

    const [formData, setFormData] = useState({
        fullName: '', playerType: '', gender: '', mobile: '', dob: '', captcha: ''
    });
    const [profilePic, setProfilePic] = useState<string>('');
    const [paymentScreenshot, setPaymentScreenshot] = useState<string>('');
    const profileInputRef = useRef<HTMLInputElement>(null);
    const paymentInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => setIsRazorpayLoaded(true);
        document.body.appendChild(script);
        return () => { if (document.body.contains(script)) document.body.removeChild(script); };
    }, []);

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); 
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    useEffect(() => {
        const fetchAuction = async () => {
            if (!id) return;
            try {
                const docSnap = await db.collection('auctions').doc(id).get();
                if (docSnap.exists) {
                    const data = docSnap.data() as AuctionSetup;
                    setAuction(data);
                    if (data.registrationConfig?.isEnabled) setConfig(data.registrationConfig);
                    else setError("Registration is currently closed.");
                } else setError("Auction not found.");
                const roleSnap = await db.collection('auctions').doc(id).collection('roles').get();
                setRoles(roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole)));
            } catch (e) { setError("Failed to load form."); }
            finally { setLoading(false); }
        };
        fetchAuction();
    }, [id]);

    const submitToFirebase = async (razorpayId?: string) => {
        if (!id) return;
        setSubmitting(true);
        try {
            const submissionData = {
                ...formData, profilePic,
                paymentScreenshot: config?.paymentMethod === 'MANUAL' ? paymentScreenshot : '',
                razorpayPaymentId: razorpayId || '',
                submittedAt: Date.now(), status: 'PENDING'
            };
            await db.collection('auctions').doc(id).collection('registrations').add(submissionData);
            setSuccess(true);
        } catch (e: any) { alert("Error: " + e.message); }
        finally { setSubmitting(false); }
    };

    const handleRazorpayModal = () => {
        if (!isRazorpayLoaded) { alert("Payment system not ready."); setSubmitting(false); return; }
        const options = {
            key: config?.razorpayKey || "rzp_test_YOUR_KEY", 
            amount: config!.fee * 100, 
            currency: "INR",
            name: auction?.title || "Auction Registration",
            handler: (res: any) => submitToFirebase(res.razorpay_payment_id),
            prefill: { name: formData.fullName, contact: formData.mobile },
            theme: { color: "#16a34a" },
            modal: { ondismiss: () => setSubmitting(false) }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.captcha.toLowerCase() !== 'dej7ym') return alert("Incorrect Captcha.");
        if (config?.includePayment) {
            if (config.paymentMethod === 'RAZORPAY') {
                setSubmitting(true);
                handleRazorpayModal();
                return;
            } else if (config.paymentMethod === 'MANUAL' && !paymentScreenshot) {
                return alert("Please upload proof of payment.");
            }
        }
        submitToFirebase();
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    if (error) return <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-white p-8 rounded-lg shadow text-center max-w-md"><h2 className="text-xl font-bold mb-2">Notice</h2><p>{error}</p></div></div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans py-10 px-4">
            {success && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2.5rem] p-10 text-center max-w-md w-full shadow-2xl border border-white/20 scale-in animate-fade-in">
                        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-500" /></div>
                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Success!</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-2">Registration Logged to Registry</p>
                        <button onClick={() => navigate('/')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl mt-8 shadow-xl uppercase tracking-widest transition-all active:scale-95">Return to Portal</button>
                    </div>
                </div>
            )}

            <div className="max-w-2xl mx-auto bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border border-gray-200 animate-fade-in">
                <div className="bg-blue-600 p-10 text-white text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter relative z-10">{auction?.title}</h1>
                    <p className="text-[10px] font-bold tracking-[0.4em] mt-2 opacity-60 relative z-10 uppercase">Registry Enrollment Terminal</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Legal Name</label>
                            <input required className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="As per Identity Document" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Mobile Primary</label>
                                <input required type="tel" className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} placeholder="+91 XXXX-XXXXXX" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Date of Birth</label>
                                <input required type="date" className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Select Skill Identity</label>
                            <div className="flex flex-wrap gap-2.5">
                                {roles.map(r => (
                                    <button key={r.id} type="button" onClick={() => setFormData({...formData, playerType: r.name})} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${formData.playerType === r.name ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                                        {r.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Profile Asset</label>
                                <div onClick={() => profileInputRef.current?.click()} className="w-full h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 transition-all overflow-hidden relative group">
                                    {profilePic ? (
                                        <img src={profilePic} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center">
                                            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Image</p>
                                        </div>
                                    )}
                                    <input ref={profileInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setProfilePic(await compressImage(e.target.files[0])); }} />
                                </div>
                            </div>
                            
                            {config?.includePayment && config.paymentMethod === 'MANUAL' && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Verify Payment (₹{config.fee})</label>
                                    <div className="space-y-4">
                                        {config.qrCodeUrl && (
                                            <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-inner flex flex-col items-center">
                                                <img src={config.qrCodeUrl} className="w-24 h-24 object-contain" />
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-2">Scan & Pay (UPI)</p>
                                            </div>
                                        )}
                                        <div onClick={() => paymentInputRef.current?.click()} className="w-full h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 transition-all overflow-hidden relative">
                                            {paymentScreenshot ? (
                                                <span className="text-[10px] font-black text-green-500 uppercase">Screenshot Uploaded</span>
                                            ) : (
                                                <div className="text-center">
                                                    <QrCode className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                                                    <p className="text-[8px] font-black text-gray-400 uppercase">Attach Proof</p>
                                                </div>
                                            )}
                                            <input ref={paymentInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setPaymentScreenshot(await compressImage(e.target.files[0])); }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-100 p-8 rounded-[2.5rem] border border-gray-200">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center">Validation Protocol (dej7ym)</label>
                        <input required className="w-full bg-white border-2 border-transparent rounded-2xl px-6 py-4 font-black text-gray-700 text-center uppercase text-xl focus:border-blue-500 outline-none transition-all shadow-inner" value={formData.captcha} onChange={e => setFormData({...formData, captcha: e.target.value})} placeholder="TYPE CODE" />
                    </div>

                    <button disabled={submitting} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[1.5rem] shadow-2xl shadow-blue-900/20 transition-all flex items-center justify-center gap-4 group active:scale-95 uppercase text-sm tracking-widest">
                        {submitting ? <Loader2 className="animate-spin" /> : (config?.includePayment && config.paymentMethod === 'RAZORPAY' ? <><CreditCard className="w-6 h-6"/> Authorize ₹{config.fee}</> : 'Submit Enrollment')}
                    </button>
                    
                    <p className="text-[9px] text-gray-400 font-bold text-center uppercase tracking-widest leading-relaxed">
                        By submitting, you agree to the tournament protocols <br/> and verify all information is legally accurate.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default PlayerRegistration;