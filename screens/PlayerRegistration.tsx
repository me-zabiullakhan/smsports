
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
        fullName: '',
        playerType: '',
        gender: '',
        mobile: '',
        dob: '',
        captcha: ''
    });
    
    const [customData, setCustomData] = useState<Record<string, any>>({});
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
                    if (data.registrationConfig && data.registrationConfig.isEnabled) {
                        setConfig(data.registrationConfig);
                    } else {
                        setError("Registration is currently closed for this auction.");
                    }
                } else {
                    setError("Auction not found.");
                }
                const roleSnap = await db.collection('auctions').doc(id).collection('roles').get();
                setRoles(roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole)));
            } catch (e) {
                setError("Failed to load registration form.");
            } finally {
                setLoading(false);
            }
        };
        fetchAuction();
    }, [id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCustomChange = (id: string, value: any) => {
        setCustomData(prev => ({ ...prev, [id]: value }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'payment' | 'custom', customFieldId?: string) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                if (!file.type.startsWith('image/')) { alert("Please upload an image file (JPG/PNG)."); return; }
                const compressedBase64 = await compressImage(file);
                if (type === 'profile') setProfilePic(compressedBase64);
                else if (type === 'payment') setPaymentScreenshot(compressedBase64);
                else if (customFieldId) handleCustomChange(customFieldId, compressedBase64); 
            } catch (err) { alert("Failed to process image."); }
        }
    };

    const submitToFirebase = async (razorpayId?: string) => {
        if (!id) return;
        setSubmitting(true);
        try {
            const submissionData = {
                ...formData, profilePic,
                paymentScreenshot: config?.paymentMethod === 'MANUAL' ? paymentScreenshot : '',
                razorpayPaymentId: razorpayId || '',
                paymentStatus: (config?.includePayment && config.paymentMethod === 'RAZORPAY') ? 'paid' : 'pending_verification',
                ...customData, submittedAt: Date.now(), status: 'PENDING'
            };
            await db.collection('auctions').doc(id).collection('registrations').add(submissionData);
            setSuccess(true);
            window.scrollTo(0,0);
            setTimeout(() => navigate('/'), 5000);
        } catch (e: any) {
            alert("Database Error: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRazorpayModal = () => {
        if (!isRazorpayLoaded || !config?.razorpayKey) {
            alert("Payment gateway not initialized. Check your Admin settings.");
            setSubmitting(false);
            return;
        }

        const options = {
            key: config.razorpayKey,
            amount: config.fee * 100, 
            currency: "INR",
            name: auction?.title || "Cricket Auction",
            description: `Registration Fee for ${formData.fullName}`,
            handler: function (response: any) {
                submitToFirebase(response.razorpay_payment_id);
            },
            prefill: { name: formData.fullName, contact: formData.mobile },
            theme: { color: "#16a34a" },
            modal: { ondismiss: () => setSubmitting(false) }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const inputCaptcha = formData.captcha.replace(/\s+/g, '').toLowerCase();
        if (inputCaptcha !== 'dej7ym') return alert("Incorrect Captcha.");
        if (!profilePic) return alert("Please upload profile picture");
        if (!formData.playerType) return alert("Please select a player type");

        if (config?.includePayment) {
            if (config.paymentMethod === 'MANUAL' && !paymentScreenshot) return alert("Please upload payment screenshot proof.");
            if (config.paymentMethod === 'RAZORPAY') {
                setSubmitting(true);
                handleRazorpayModal();
                return;
            }
        }
        submitToFirebase();
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Loading form...</div>;
    if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4"><div className="bg-white p-8 rounded-lg shadow text-center max-w-md"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-gray-800 mb-2">Unavailable</h2><p className="text-gray-600">{error}</p><button onClick={() => navigate('/')} className="mt-4 text-blue-600 underline">Back to Home</button></div></div>;

    const useIntegratedPayment = config?.includePayment && config.paymentMethod === 'RAZORPAY' && auction?.razorpayAuthorized;

    return (
        <div className="min-h-screen bg-gray-50 font-sans py-10 px-4 relative">
            <div className="max-w-3xl mx-auto mb-6">
                <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors font-semibold"><ArrowLeft className="w-5 h-5 mr-2" /> Back to Home</button>
            </div>

            {success && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-600" /></div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h2>
                        <p className="text-gray-600 mb-8">Thank you, <span className="font-bold">{formData.fullName}</span>. Your details and payment have been verified.</p>
                        <button onClick={() => navigate('/')} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center"><Home className="w-5 h-5 mr-2" /> Go to Home</button>
                    </div>
                </div>
            )}

            <div className={`max-w-3xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200 ${success ? 'blur-sm pointer-events-none' : ''}`}>
                <div className="text-center p-8 pb-4">
                    {config?.bannerUrl && <img src={config.bannerUrl} alt="Logo" className="h-24 mx-auto mb-6 drop-shadow-md" />}
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Player Registration - {auction?.title}</h1>
                    
                    {config?.includePayment && (
                        <div className="mt-8 bg-zinc-50 border border-zinc-200 p-6 rounded-2xl animate-fade-in">
                            {config.paymentMethod === 'MANUAL' || !auction?.razorpayAuthorized ? (
                                <>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center justify-center gap-2"><QrCode className="w-4 h-4"/> Manual Payment Instructions</p>
                                    <p className="text-sm font-semibold text-zinc-900">{config?.upiName}</p>
                                    <p className="text-xl font-black text-blue-600 mb-4 font-mono">{config?.upiId}</p>
                                    {config?.qrCodeUrl && <div className="flex justify-center"><div className="bg-white p-4 rounded-3xl shadow-xl border border-zinc-200"><img src={config.qrCodeUrl} alt="UPI QR" className="w-44 h-44 object-contain" /></div></div>}
                                    <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100">Pay ₹{config.fee} and upload the screenshot below.</div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-3"><ShieldCheck className="w-8 h-8 text-green-600" /></div>
                                    <h3 className="font-black text-green-800 uppercase tracking-tighter text-lg">Integrated Secure Payments</h3>
                                    <p className="text-[10px] text-green-600 font-bold mb-4 uppercase tracking-widest">Powered by Razorpay Encryption</p>
                                    <div className="p-3 bg-green-600 text-white rounded-xl shadow-lg font-black text-sm w-full max-w-[200px]">FEE: ₹{config.fee}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="p-8 pt-4">
                    <div className="space-y-6">
                        <div className="border border-gray-200 rounded-lg p-5">
                            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2 uppercase tracking-widest text-[10px]">Personal Information</h3>
                            <div className="space-y-4">
                                <div><label className="block text-xs font-bold text-gray-500 mb-1">Full Name <span className="text-red-500">*</span></label><input required name="fullName" type="text" onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-gray-900" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 mb-1">Profile Photo <span className="text-red-500">*</span></label><div onClick={() => profileInputRef.current?.click()} className="border border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 flex items-center justify-center text-sm text-gray-500"><input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'profile')} />{profilePic ? <span className="text-green-600 font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> Image Selected</span> : <span>Drag & Drop or <span className="underline">Browse</span></span>}</div></div>
                                <div><label className="block text-xs font-bold text-gray-500 mb-2">Player Type <span className="text-red-500">*</span></label><div className="flex flex-wrap gap-2 p-2 bg-gray-50 border rounded-xl">{roles.map(r => <button key={r.id} type="button" onClick={() => setFormData({...formData, playerType: r.name})} className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${formData.playerType === r.name ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400'}`}>{r.name}</button>)}</div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Mobile <span className="text-red-500">*</span></label><input required name="mobile" type="tel" onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900" /></div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">D.O.B <span className="text-red-500">*</span></label><input required name="dob" type="date" onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900" /></div>
                                </div>
                                {config?.includePayment && config.paymentMethod === 'MANUAL' && (
                                    <div className="animate-fade-in"><label className="block text-xs font-bold text-red-500 mb-1">Upload Payment Screenshot (₹{config?.fee}) <span className="text-red-500">*</span></label><div onClick={() => paymentInputRef.current?.click()} className="border-2 border-dashed border-red-100 rounded-xl p-4 text-center cursor-pointer hover:bg-red-50 flex items-center justify-center text-sm text-gray-500"><input ref={paymentInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'payment')} />{paymentScreenshot ? <span className="text-green-600 font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> Image Selected</span> : <span>Upload Transaction Screen</span>}</div></div>
                                )}
                            </div>
                        </div>

                        <div><label className="block text-xs font-bold text-gray-500 mb-1">Captcha: de j 7ym <span className="text-red-500">*</span></label><input required type="text" name="captcha" onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 mb-3 text-gray-900" /></div>

                        <button type="submit" disabled={submitting} className={`w-full bg-[#65a30d] hover:bg-[#4d7c0f] text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${submitting ? 'opacity-70 cursor-wait' : ''}`}>
                            {submitting ? <><Loader2 className="w-6 h-6 animate-spin"/> {useIntegratedPayment ? 'PROCESSING SECURE PAYMENT...' : 'SAVING...'}</> : <>{useIntegratedPayment ? <><CreditCard className="w-5 h-5"/> PAY & REGISTER</> : 'SUBMIT REGISTRATION'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PlayerRegistration;
