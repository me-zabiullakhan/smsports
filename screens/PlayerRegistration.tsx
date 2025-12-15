
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, RegistrationConfig, FormField } from '../types';
import { Upload, Calendar, CheckCircle, AlertTriangle, ArrowUpCircle, FileText, Home, ArrowLeft } from 'lucide-react';

const PlayerRegistration: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [auction, setAuction] = useState<AuctionSetup | null>(null);
    const [config, setConfig] = useState<RegistrationConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fixed Form Data
    const [formData, setFormData] = useState({
        fullName: '',
        playerType: '',
        gender: '',
        mobile: '',
        dob: '',
        captcha: ''
    });
    
    // Dynamic Form Data (Map field ID -> Value)
    const [customData, setCustomData] = useState<Record<string, any>>({});

    // File Data
    const [profilePic, setProfilePic] = useState<string>('');
    const [paymentScreenshot, setPaymentScreenshot] = useState<string>('');

    const profileInputRef = useRef<HTMLInputElement>(null);
    const paymentInputRef = useRef<HTMLInputElement>(null);

    // Helper to compress images
    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Resize to max 800px
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG with 0.7 quality to reduce size
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
                // COMPAT SYNTAX
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
                // Simple validation
                if (!file.type.startsWith('image/')) {
                    alert("Please upload an image file (JPG/PNG).");
                    return;
                }

                // Compress image
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!id) {
            alert("Error: Auction ID is missing.");
            return;
        }

        // Robust Captcha Check: Remove ALL spaces and ignore case
        const inputCaptcha = formData.captcha.replace(/\s+/g, '').toLowerCase();
        const expectedCaptcha = 'dej7ym'; // 'de j 7ym' without spaces

        if (inputCaptcha !== expectedCaptcha) { 
            alert("Incorrect Captcha. Please enter the characters shown in the box.");
            return;
        }
        if (!profilePic) return alert("Please upload profile picture");
        
        // Conditionally check payment screenshot
        if (config?.includePayment && !paymentScreenshot) return alert("Please upload payment screenshot");

        setSubmitting(true);
        try {
            // Merge fixed fields and custom fields for submission
            const submissionData = {
                ...formData,
                profilePic,
                paymentScreenshot: config?.includePayment ? paymentScreenshot : '',
                ...customData,
                submittedAt: Date.now(),
                status: 'PENDING'
            };

            // COMPAT SYNTAX
            await db.collection('auctions').doc(id).collection('registrations').add(submissionData);
            
            setSuccess(true);
            window.scrollTo(0,0);

            // Auto redirect after 5 seconds
            setTimeout(() => {
                navigate('/');
            }, 5000);

        } catch (e: any) {
            console.error("Submission Error:", e);
            let msg = e.message;
            if (e.code === 'permission-denied') {
                msg = "Permission Denied. Please ensure Firestore Security Rules allow public 'create' on the registrations collection.";
            } else if (e.message.includes("maximum allowed size")) {
                msg = "Data too large. Please try uploading smaller images.";
            }
            alert("Submission failed: " + msg);
        } finally {
            setSubmitting(false);
        }
    };

    // --- Dynamic Field Renderer ---
    const renderField = (field: FormField) => {
        const commonClasses = "w-full border border-gray-300 rounded p-2 bg-white outline-none focus:ring-2 focus:ring-green-500 transition-shadow";
        
        switch (field.type) {
            case 'select':
                return (
                    <select 
                        required={field.required}
                        value={customData[field.id] || ''}
                        onChange={(e) => handleCustomChange(field.id, e.target.value)}
                        className={commonClasses}
                    >
                        <option value="">Select an option</option>
                        {field.options?.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                        ))}
                    </select>
                );
            case 'file':
                return (
                    <div className="border border-dashed border-gray-300 rounded p-3 text-center cursor-pointer hover:bg-gray-50 flex items-center justify-center text-sm text-gray-500 relative">
                        <input 
                            type="file" 
                            accept="image/*" 
                            required={field.required && !customData[field.id]} 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={(e) => handleFileUpload(e, 'custom', field.id)}
                        />
                         {customData[field.id] ? (
                            <span className="text-green-600 font-bold flex items-center truncate max-w-xs">
                                <CheckCircle className="w-4 h-4 mr-2"/> File Uploaded
                            </span>
                         ) : (
                            <span className="flex items-center"><FileText className="w-4 h-4 mr-2"/> Upload Image</span>
                         )}
                    </div>
                );
            case 'date':
                return (
                    <div className="relative">
                        <input 
                            type="date" 
                            required={field.required}
                            value={customData[field.id] || ''}
                            onChange={(e) => handleCustomChange(field.id, e.target.value)}
                            className={commonClasses}
                        />
                    </div>
                );
            case 'number':
                return (
                    <input 
                        type="number"
                        placeholder={field.placeholder}
                        required={field.required}
                        value={customData[field.id] || ''}
                        onChange={(e) => handleCustomChange(field.id, e.target.value)}
                        className={commonClasses}
                    />
                );
            default:
                return (
                    <input 
                        type="text"
                        placeholder={field.placeholder}
                        required={field.required}
                        value={customData[field.id] || ''}
                        onChange={(e) => handleCustomChange(field.id, e.target.value)}
                        className={commonClasses}
                    />
                );
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading form...</div>;

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
            
            {/* Back Button */}
            <div className="max-w-3xl mx-auto mb-6">
                <button 
                    onClick={() => navigate('/')} 
                    className="flex items-center text-gray-600 hover:text-gray-900 transition-colors font-semibold"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Home
                </button>
            </div>

            {/* SUCCESS MODAL POPUP */}
            {success && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all scale-100">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h2>
                        <p className="text-gray-600 mb-8">
                            Thank you, <span className="font-bold">{formData.fullName}</span>. Your details have been submitted to the organizer.
                        </p>
                        <div className="space-y-3">
                            <button 
                                onClick={() => navigate('/')}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform hover:scale-105 flex items-center justify-center"
                            >
                                <Home className="w-5 h-5 mr-2" /> Go to Home
                            </button>
                            <p className="text-xs text-gray-400">Redirecting automatically in 5 seconds...</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`max-w-3xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200 ${success ? 'blur-sm pointer-events-none' : ''}`}>
                
                {/* Header Section */}
                <div className="text-center p-8 pb-4">
                    {config?.bannerUrl && (
                        <img src={config.bannerUrl} alt="Logo" className="h-24 mx-auto mb-6 drop-shadow-md" />
                    )}
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Player Registration Form - {auction?.title}</h1>
                    
                    {/* Terms */}
                    <div className="mt-6 text-sm text-gray-600 bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-left">
                        <p className="font-bold underline mb-2">Terms & Conditions:</p>
                        <ul className="list-disc list-inside space-y-1">
                            {config?.terms.split('\n').map((term, i) => (
                                <li key={i}>{term}</li>
                            ))}
                        </ul>
                    </div>

                    {/* UPI Section - Conditionally Rendered */}
                    {config?.includePayment && (
                        <div className="mt-8">
                            <p className="text-sm font-bold underline mb-4">UPI Details:</p>
                            <p className="text-sm font-semibold">{config?.upiName}</p>
                            <p className="text-xl font-bold mb-4">{config?.upiId}</p>
                            {config?.qrCodeUrl && (
                                <div className="flex justify-center">
                                    <img src={config.qrCodeUrl} alt="UPI QR" className="w-48 h-48 object-contain border-2 border-gray-800 p-2 rounded-lg" />
                                </div>
                            )}
                            <p className="text-xs font-bold mt-2 uppercase text-gray-700">{config?.upiName}</p>
                        </div>
                    )}
                </div>

                {/* Form Section */}
                <form onSubmit={handleSubmit} className="p-8 pt-4">
                    <div className="space-y-6">
                        {/* Personal Info */}
                        <div className="border border-gray-200 rounded-lg p-5">
                            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">Personal Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name <span className="text-red-500">*</span></label>
                                    <input required name="fullName" type="text" onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-green-500 outline-none" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Profile pic <span className="text-red-500">*</span></label>
                                    <div 
                                        onClick={() => profileInputRef.current?.click()}
                                        className="border border-dashed border-gray-300 rounded p-3 text-center cursor-pointer hover:bg-gray-50 flex items-center justify-center text-sm text-gray-500"
                                    >
                                        <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'profile')} />
                                        {profilePic ? <span className="text-green-600 font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> Image Selected</span> : <span>Drag & Drop your files or <span className="underline">Browse</span></span>}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Player type <span className="text-red-500">*</span></label>
                                    <select required name="playerType" onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2 bg-white outline-none">
                                        <option value="">Select an option</option>
                                        <option value="Batsman">Batsman</option>
                                        <option value="Bowler">Bowler</option>
                                        <option value="All Rounder">All Rounder</option>
                                        <option value="Wicket Keeper">Wicket Keeper</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-red-500">*</span></label>
                                    <select required name="gender" onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2 bg-white outline-none">
                                        <option value="">Select an option</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile <span className="text-red-500">*</span> <span className="text-xs text-gray-400 float-right">Enter WhatsApp number</span></label>
                                    <input required name="mobile" type="tel" onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2 outline-none" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input required name="dob" type="date" onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2 outline-none" />
                                        <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Conditionally Render Payment Screenshot Upload */}
                                {config?.includePayment && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot of Successful Payment (Rs {config?.fee}) <span className="text-red-500">*</span></label>
                                        <div 
                                            onClick={() => paymentInputRef.current?.click()}
                                            className="border border-dashed border-gray-300 rounded p-3 text-center cursor-pointer hover:bg-gray-50 flex items-center justify-center text-sm text-gray-500"
                                        >
                                            <input ref={paymentInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'payment')} />
                                            {paymentScreenshot ? <span className="text-green-600 font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> Image Selected</span> : <span>Drag & Drop your files or <span className="underline">Browse</span></span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dynamic Custom Fields */}
                        {config?.customFields && config.customFields.length > 0 && (
                            <div className="border border-gray-200 rounded-lg p-5">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">Other Details</h3>
                                <div className="space-y-4">
                                    {config.customFields.map((field) => (
                                        <div key={field.id}>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {renderField(field)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Captcha */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Captcha <span className="text-red-500">*</span></label>
                            <input 
                                required 
                                type="text" 
                                name="captcha" 
                                onChange={handleInputChange}
                                className="w-full border border-gray-300 rounded p-2 mb-2 outline-none" 
                            />
                            <div className="bg-gray-100 p-2 rounded border border-gray-300 inline-block">
                                <span className="font-mono text-xl tracking-[0.5em] text-gray-600 font-bold italic line-through decoration-wavy decoration-red-400">de j 7ym</span>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={submitting}
                            className={`w-full bg-[#65a30d] hover:bg-[#4d7c0f] text-white font-bold py-3 rounded shadow transition-all ${submitting ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </div>
                </form>

                {/* Footer Disclaimer */}
                <div className="p-6 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 leading-relaxed">
                    <p className="font-bold mb-2">Important Disclaimer</p>
                    <p className="mb-2">- SM SPORTS is a platform for auction organizers to put their player auction online.</p>
                    <p className="mb-2">- We DO NOT accept payments or organize any auctions ourselves.</p>
                    <p className="mb-2">- Before registering for an auction, please carefully review all auction details...</p>
                    <p className="font-bold mt-2">Proceed with caution and at your own risk.</p>
                    
                    <div className="flex justify-center gap-4 mt-6 text-blue-600 font-semibold">
                         <span>Discover more</span>
                         <a href="#" className="flex items-center gap-1 hover:underline"><ArrowUpCircle className="w-3 h-3"/> SM SPORTS</a>
                    </div>

                    <div className="text-center mt-8">
                        <p className="font-bold text-gray-800">Player Registration Form Provided by</p>
                        <div className="w-12 h-12 bg-[#38b2ac] text-white font-black flex items-center justify-center rounded mx-auto mt-2 text-xs">
                            SM
                        </div>
                        <p className="font-bold text-gray-800 mt-1">SM SPORTS</p>
                        <p className="text-gray-400 mt-2">© 2025. All rights reserved</p>
                    </div>
                </div>
            </div>
            
            {/* Scroll to Top Button */}
            <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="fixed bottom-6 right-6 bg-[#84cc16] hover:bg-[#65a30d] text-white p-3 rounded-full shadow-lg transition-all">
                <ArrowUpCircle className="w-6 h-6" />
            </button>
        </div>
    );
};

export default PlayerRegistration;