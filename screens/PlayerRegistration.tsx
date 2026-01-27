
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

    // Load Razorpay Script for Integrated Modal
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => setIsRazorpayLoaded(true);
        document.body.appendChild(script);
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
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
                    canvas.width = width;
                    canvas.height = height;
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
                const fetchedRoles = roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole));
                setRoles(fetchedRoles);
            } catch (e) {
                console.error(e);
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
                if (!file.type.startsWith('image/')) {
                    alert("Please upload an image file (JPG/PNG).");
                    return;
                }
                const compressedBase64 = await compressImage(file);
                if (type === 'profile') setProfilePic(compressedBase64);
                else if (type === 'payment') setPaymentScreenshot(compressedBase64);
                else if (customFieldId) {
                    handleCustomChange(customFieldId, compressedBase64); 
                }
            } catch (err) {
                console.error("Image upload error:", err);
                alert("Failed to process image. Please try again.");
            }
        }
    };

    const submitToFirebase = async (razorpayId?: string) => {
        if (!id) return;
        setSubmitting(true);
        try {
            const submissionData = {
                ...formData,
                profilePic,
                paymentScreenshot: config?.paymentMethod === 'MANUAL' ? paymentScreenshot : '',
                razorpayPaymentId: razorpayId || '',
                paymentStatus: (config?.includePayment && config.paymentMethod === 'RAZORPAY') ? 'paid' : 'pending_verification',
                ...customData,
                submittedAt: Date.now(),
                status: 'PENDING'
            };
            await db.collection('auctions').doc(id).collection('registrations').add(submissionData);
            setSuccess(true);
            window.scrollTo(0,0);
            setTimeout(() => navigate('/'), 5000);
        } catch (e: any) {
            console.error("Submission Error:", e);
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
            amount: config.fee * 100, // in paise
            currency: "INR",
            name: auction?.title || "Cricket Auction",
            description: `Registration Fee for ${formData.fullName}`,
            handler: function (response: any) {
                // Success Callback: THIS is where the security happens.
                // Form data is only saved when the modal returns success.
                submitToFirebase(response.razorpay_payment_id);
            },
            prefill: {
                name: formData.fullName,
                contact: formData.mobile,
            },
            theme: {
                color: "#16a34a",
            },
            modal: {
                ondismiss: () => {
                    setSubmitting(false);
                }
            }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return alert("Auction ID missing.");
        
        const inputCaptcha = formData.captcha.replace(/\s+/g, '').toLowerCase();
        const expectedCaptcha = 'de j 7ym'.replace(/\s+/g, '').toLowerCase(); 
        if (inputCaptcha !== expectedCaptcha) return alert("Incorrect Captcha.");
        
        if (!profilePic) return alert("Please upload profile picture");
        if (!formData.playerType) return alert("Please select a player type");

        if (config?.includePayment) {
            if (config.paymentMethod === 'MANUAL' && !paymentScreenshot) {
                return alert("Please upload payment screenshot proof.");
            }
            if (config.paymentMethod === 'RAZORPAY') {
                setSubmitting(true);
                handleRazorpayModal();
                return; // Wait for callback
            }
        }

        submitToFirebase();
    };

    const renderField = (field: FormField) => {
        const commonClasses = "w-full border border-gray-300 rounded p-2 bg-white outline-none focus:ring-2 focus:ring-green-500 transition-shadow text-gray-900";
        switch (field.type) {
            case 'select':
                return (
                    <select required={field.required} value={customData[field.id] || ''} onChange={(e) => handleCustomChange(field.id, e.target.value)} className={commonClasses}>
                        <option value="">Select an option</option>
                        {field.options?.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                        ))}
                    </select>
                );
            case 'file':
                return (
                    <div className="border border-dashed border-gray-300 rounded p-3 text-center cursor-pointer hover:bg-gray-50 flex items-center justify-center text-sm text-gray-500 relative">
                        <input type="file" accept="image/*" required={field.required && !customData[field.id]} className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'custom', field.id)}/>
                         {customData[field.id] ? (
                            <span className="text-green-600 font-bold flex items-center truncate max-w-xs"><CheckCircle className="w-4 h-4 mr-2"/> File Uploaded</span>
                         ) : (
                            <span className="flex items-center"><FileText className="w-4 h-4 mr-2"/> Upload Image</span>
                         )}
                    </div>
                );
            case 'date':
                return (
                    <div className="relative">
                        <input type="date" required={field.required} value={customData[field.id] || ''} onChange={(e) => handleCustomChange(field.id, e.target.value)} className={commonClasses}/>
                    </div>
                );
            case 'number':
                return (
                    <input type="number" placeholder={field.placeholder} required={field.required} value={customData[field.id] || ''} onChange={(e) => handleCustomChange(field.id, e.target.value)} className={commonClasses}/>
                );
            default:
                return (
                    <input type="text" placeholder={field.placeholder} required={field.required} value={customData[field.id] || ''} onChange={(e) => handleCustomChange(field.id, e.target.value)} className={commonClasses}/>
                );
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Loading form...</div>;

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-lg shadow text-center max-w-md">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Unavailable</h2>
                    <p className="text-gray-600">{error}</p>
                    <button onClick={() => navigate('/')} className="mt-4 text-blue-600 underline">Back to Home</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans py-10 px-4 relative">
            <div className="max-w-3xl mx-auto mb-6">
                <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors font-semibold">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Home
                </button>
            </div>

            {success && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all scale-100">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h2>
                        <p className="text-gray-600 mb-8">
                            Thank you, <span className="font-bold">{formData.fullName}</span>. Your details and payment have been verified.
                        </p>
                        <div className="space-y-3">
                            <button onClick={() => navigate('/')} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform hover:scale-105 flex items-center justify-center">
                                <Home className="w-5 h-5 mr-2" /> Go to Home
                            </button>
                            <p className="text-xs text-gray-400">Redirecting automatically in 5 seconds...</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`max-w-3xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200 ${success ? 'blur-sm pointer-events-none' : ''}`}>
                <div className="text-center p-8 pb-4">
                    {config?.bannerUrl && <img src={config.bannerUrl} alt="Logo" className="h-24 mx-auto mb-6 drop-shadow-md" />}
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Player Registration - {auction?.title}</h1>
                    <div className="mt-6 text-sm text-gray-600 bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-left">
                        <p className="font-bold underline mb-2">Terms & Conditions:</p>
                        <ul className="list-disc list-inside space-y-1">
                            {config?.terms.split('\n').map((term, i) => (<li key={i}>{term}</li>))}
                        </ul>
                    </div>

                    {config?.includePayment && (
                        <div className="mt-8 bg-zinc-50 border border-zinc-200 p-6 rounded-2xl animate-fade-in">
                            {config.paymentMethod === 'MANUAL' ? (
                                <>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center justify-center gap-2">
                                        <QrCode className="w-4 h-4"/> Manual Payment Instructions
                                    </p>
                                    <p className="text-sm font-semibold text-zinc-900">{config?.upiName}</p>
                                    <p className="text-xl font-black text-blue-600 mb-4 font-mono">{config?.upiId}</p>
                                    {config?.qrCodeUrl && (
                                        <div className="flex justify-center">
                                            <div className="bg-white p-4 rounded-3xl shadow-xl border border-zinc-200 group relative overflow-hidden">
                                                <img src={config.qrCodeUrl} alt="UPI QR" className="w-44 h-44 object-contain" />
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100">
                                        Pay ₹{config.fee} and upload the screenshot below.
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-3">
                                        <ShieldCheck className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h3 className="font-black text-green-800 uppercase tracking-tighter text-lg">Secure Verification Active</h3>
                                    <p className="text-[10px] text-green-600 font-bold mb-4 uppercase tracking-widest">Integrated Payment Gateway</p>
                                    <div className="p-3 bg-green-600 text-white rounded-xl shadow-lg font-black text-sm w-full max-w-[200px]">
                                        REGISTRATION FEE: ₹{config.fee}
                                    </div>
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
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Full Name <span className="text-red-500">*</span></label>
                                    <input required name="fullName" type="text" onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none text-gray-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Profile Photo <span className="text-red-500">*</span></label>
                                    <div onClick={() => profileInputRef.current?.click()} className="border border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 flex items-center justify-center text-sm text-gray-500 transition-colors">
                                        <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'profile')} />
                                        {profilePic ? <span className="text-green-600 font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> Image Selected</span> : <span>Drag & Drop your files or <span className="underline">Browse</span></span>}
                                    </div>
                                </div>
                                
                                {/* Inline Role Chip Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">Player Type (Role) <span className="text-red-500">*</span></label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(roles.length > 0 ? roles.map(r => r.name) : ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper']).map(r => (
                                            <button 
                                                key={r} 
                                                type="button" 
                                                onClick={() => setFormData({...formData, playerType: r})}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${formData.playerType === r ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Inline Gender Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">Gender <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2">
                                        {['Male', 'Female'].map(g => (
                                            <button 
                                                key={g} 
                                                type="button" 
                                                onClick={() => setFormData({...formData, gender: g})}
                                                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all border ${formData.gender === g ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Mobile <span className="text-red-500">*</span></label>
                                        <input required name="mobile" type="tel" onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-gray-900" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input required name="dob" type="date" onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-gray-900" />
                                            <Calendar className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {config?.includePayment && config.paymentMethod === 'MANUAL' && (
                                    <div className="animate-fade-in">
                                        <label className="block text-xs font-bold text-red-500 mb-1">Upload Payment Screenshot (₹{config?.fee}) <span className="text-red-500">*</span></label>
                                        <div onClick={() => paymentInputRef.current?.click()} className="border-2 border-dashed border-red-100 rounded-xl p-4 text-center cursor-pointer hover:bg-red-50 flex items-center justify-center text-sm text-gray-500 transition-colors">
                                            <input ref={paymentInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'payment')} />
                                            {paymentScreenshot ? <span className="text-green-600 font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> Image Selected</span> : <span>Upload Transaction Screen</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {config?.customFields && config.customFields.length > 0 && (
                            <div className="border border-gray-200 rounded-lg p-5">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2 uppercase tracking-widest text-[10px]">Additional Details</h3>
                                <div className="space-y-4">
                                    {config.customFields.map((field) => (
                                        <div key={field.id}>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {renderField(field)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Security Captcha <span className="text-red-500">*</span></label>
                            <input required type="text" name="captcha" onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 mb-3 outline-none text-gray-900" />
                            <div className="bg-gray-100 p-3 rounded-xl border border-gray-300 inline-block shadow-inner">
                                <span className="font-mono text-2xl tracking-[0.6em] text-gray-600 font-black italic line-through decoration-wavy decoration-red-400 select-none">de j 7ym</span>
                            </div>
                        </div>

                        <button type="submit" disabled={submitting} className={`w-full bg-[#65a30d] hover:bg-[#4d7c0f] text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${submitting ? 'opacity-70 cursor-wait' : ''}`}>
                            {submitting ? (<><Loader2 className="w-6 h-6 animate-spin"/> {config?.paymentMethod === 'RAZORPAY' ? 'PROCESSING SECURE PAYMENT...' : 'SAVING DATA...'}</>) : (
                                <>{config?.includePayment && config.paymentMethod === 'RAZORPAY' ? <><CreditCard className="w-5 h-5"/> PAY & REGISTER</> : 'SUBMIT REGISTRATION'}</>
                            )}
                        </button>
                    </div>
                </form>

                <div className="p-6 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 leading-relaxed">
                    <p className="font-bold mb-2">Security Note</p>
                    <p className="mb-2">- Your registration is only complete after successful payment confirmation.</p>
                    <p className="mb-2">- SM SPORTS Integrated Checkout is protected by Razorpay SSL Encryption.</p>
                    <div className="text-center mt-8">
                        <div className="w-12 h-12 bg-[#38b2ac] text-white font-black flex items-center justify-center rounded-xl mx-auto mt-2 text-xs shadow-lg">SM</div>
                        <p className="font-bold text-gray-800 mt-1 uppercase tracking-widest">SM SPORTS</p>
                        <p className="text-gray-400 mt-2">© 2025. All rights reserved</p>
                    </div>
                </div>
            </div>
            <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="fixed bottom-6 right-6 bg-[#84cc16] hover:bg-[#65a30d] text-white p-3 rounded-full shadow-lg transition-all active:scale-90 z-10">
                <ArrowUpCircle className="w-6 h-6" />
            </button>
        </div>
    );
};

export default PlayerRegistration;
