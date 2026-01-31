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
        if (!isRazorpayLoaded || !config?.razorpayKey) {
            alert("Payment system not ready.");
            setSubmitting(false);
            return;
        }
        const options = {
            key: config.razorpayKey, amount: config.fee * 100, currency: "INR",
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
        if (config?.includePayment && config.paymentMethod === 'RAZORPAY') {
            setSubmitting(true);
            handleRazorpayModal();
            return;
        }
        submitToFirebase();
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    if (error) return <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-white p-8 rounded-lg shadow text-center max-w-md"><h2 className="text-xl font-bold mb-2">Notice</h2><p>{error}</p></div></div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans py-10 px-4">
            {success && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 text-center max-w-md w-full">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold mb-2">Registered Successfully!</h2>
                        <button onClick={() => navigate('/')} className="w-full bg-green-600 text-white py-3 rounded-xl mt-6">Go Home</button>
                    </div>
                </div>
            )}

            <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
                <div className="bg-blue-600 p-8 text-white text-center">
                    <h1 className="text-2xl font-black uppercase">{auction?.title}</h1>
                    <p className="text-[10px] font-bold tracking-widest mt-1 opacity-80">OFFICIAL REGISTRATION PORTAL</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Full Name</label>
                            <input required className="w-full border rounded-xl p-3" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Player Role</label>
                            <div className="flex flex-wrap gap-2">
                                {roles.map(r => (
                                    <button key={r.id} type="button" onClick={() => setFormData({...formData, playerType: r.name})} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${formData.playerType === r.name ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>
                                        {r.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Mobile</label><input required type="tel" className="w-full border rounded-xl p-3" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} /></div>
                            <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Date of Birth</label><input required type="date" className="w-full border rounded-xl p-3" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} /></div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Profile Photo</label>
                            <div onClick={() => profileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50">
                                {profilePic ? <span className="text-green-600 font-bold">Photo Captured</span> : <span className="text-gray-400">Click to upload</span>}
                                <input ref={profileInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setProfilePic(await compressImage(e.target.files[0])); }} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Verification (dej7ym)</label>
                        <input required className="w-full border rounded-xl p-3 uppercase font-black text-center" value={formData.captcha} onChange={e => setFormData({...formData, captcha: e.target.value})} />
                    </div>

                    <button disabled={submitting} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3">
                        {submitting ? <Loader2 className="animate-spin" /> : (config?.includePayment && config.paymentMethod === 'RAZORPAY' ? <><CreditCard className="w-5 h-5"/> PAY ₹{config.fee} & REGISTER</> : 'SUBMIT REGISTRATION')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PlayerRegistration;