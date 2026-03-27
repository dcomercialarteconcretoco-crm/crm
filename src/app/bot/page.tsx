"use client";

import React, { useState, useEffect } from 'react';
import {
    Search,
    Send,
    Phone,
    Video,
    MoreVertical,
    Paperclip,
    Smile,
    Circle,
    Mail,
    Instagram,
    Bot,
    User,
    Settings,
    Shield,
    Globe,
    Code,
    Zap,
    AlertTriangle,
    BellRing,
    CheckCircle2,
    Copy,
    Share2,
    MonitorPlay,
    Cpu,
    Layout,
    Key,
    Clock,
    Truck,
    MapPin,
    HelpCircle,
    BrainCircuit,
    Wand2,
    Save,
    MessageCircle,
    Image,
    FileText,
    Package,
    X,
    ChevronRight,
    Plus,
    Check,
    FilePlus,
    FilePlus2,
    CreditCard
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '@/context/AppContext';

interface Message {
    id: string;
    sender: string;
    preview: string;
    time: string;
    unread: boolean;
    type: 'WhatsApp' | 'Web Chat' | 'Messenger';
    status: 'Bot Active' | 'Human Control' | 'Needs Help';
    online?: boolean;
    productData?: {
        name: string;
        price: string;
        img: string;
        slug: string;
        description: string;
    };
}

interface WidgetConversation {
    id: string;
    lead: { name: string; email: string; phone: string; city: string; company: string; };
    messages: { role: 'user' | 'assistant'; content: string; timestamp: string; }[];
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'closed';
    source: 'widget' | 'whatsapp';
}

const DEFAULT_BOT_SETTINGS = {
    deliveryTimes: '10 a 15 días hábiles',
    shippingCost: 'Gratis en Medellín y Bogotá. Resto del país: Cotización personalizada.',
    coverageArea: 'Despachamos a nivel nacional. Instalación en sitio disponible según volumen de compra.',
    faqs: [
        '¿Fabrican diseños a medida?',
        '¿Tienen descuentos por volumen?',
    ],
    systemPrompt: `Eres el Bot oficial de ArteConcreto.
Tu misión es recibir al cliente, capturar sus datos y cotizar mobiliario urbano.

REGLAS DE ORO:
1. Siempre captura Nombre, Empresa y Ciudad.
2. Si el cliente pide productos personalizados, solicita ayuda humana.
3. El tiempo de despacho de concreto es de 10-15 días.
4. No hables de precios de obra civil, solo suministros de productos.`,
    escalationRules: {
        largeSale: true,
        anger: true,
        unknownAnswer: true,
        catalogOnly: false,
    },
    captureFields: {
        name: true,
        email: true,
        phone: true,
        city: true,
        company: true,
    },
    widget: {
        apiKey: 'AC-5882-XT90',
        primaryColor: '#FAB510',
        botName: 'ConcreBOT',
        position: 'left-bottom' as const,
        authorizedDomain: 'arteconcreto.co',
        whatsappSync: true,
    },
};

export default function MiWiBotPage() {
    const { products, quotes, settings, updateSettings, addNotification } = useApp();
    const [activeTab, setActiveTab] = useState<'monitor' | 'programming' | 'capture' | 'widget' | 'learning'>('monitor');
    const [selectedChat, setSelectedChat] = useState<Message | null>(null);
    const [liveConversations, setLiveConversations] = useState<WidgetConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<WidgetConversation | null>(null);
    const [isHumanInControl, setIsHumanInControl] = useState(false);
    const [activeAlert, setActiveAlert] = useState<{ type: 'help' | 'sale'; visible: boolean }>({ type: 'help', visible: false });
    const botSettings = settings.botSettings || DEFAULT_BOT_SETTINGS;
    const [captureFields, setCaptureFields] = useState(botSettings.captureFields);
    const [deliveryTimes, setDeliveryTimes] = useState(botSettings.deliveryTimes);
    const [shippingCost, setShippingCost] = useState(botSettings.shippingCost);
    const [coverageArea, setCoverageArea] = useState(botSettings.coverageArea);
    const [faqs, setFaqs] = useState(botSettings.faqs);
    const [systemPrompt, setSystemPrompt] = useState(botSettings.systemPrompt);
    const [escalationRules, setEscalationRules] = useState(botSettings.escalationRules);
    const [widgetConfig, setWidgetConfig] = useState(botSettings.widget);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    const DEFAULT_SCHEDULE = {
        enabled: false,
        timezone: 'America/Bogota',
        days: {
            mon: { enabled: true,  start: '08:00', end: '18:00' },
            tue: { enabled: true,  start: '08:00', end: '18:00' },
            wed: { enabled: true,  start: '08:00', end: '18:00' },
            thu: { enabled: true,  start: '08:00', end: '18:00' },
            fri: { enabled: true,  start: '08:00', end: '18:00' },
            sat: { enabled: false, start: '09:00', end: '13:00' },
            sun: { enabled: false, start: '09:00', end: '13:00' },
        },
        offlineMessage: 'Nuestro asistente no está disponible ahora. Te responderemos en nuestro próximo horario de atención.',
    };
    const [botSchedule, setBotSchedule] = useState(DEFAULT_SCHEDULE);

    // Attachment & Product States
    const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [searchProduct, setSearchProduct] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

    // Quotation Form State
    const [quoteForm, setQuoteForm] = useState({
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        clientCompany: '',
        items: [] as any[]
    });

    const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
    const [quoteSuccess, setQuoteSuccess] = useState(false);

    // Human reply state
    const [replyText, setReplyText] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);
    const chatEndRef = React.useRef<HTMLDivElement>(null);
    const selectedConvRef = React.useRef<WidgetConversation | null>(null);

    // Keep ref in sync so polling closure can access latest value
    React.useEffect(() => {
        selectedConvRef.current = selectedConversation;
    }, [selectedConversation]);

    // Auto-scroll chat to bottom on new messages
    React.useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedConversation?.messages?.length]);

    // ── ConcreBOT Learning Mode ──────────────────────────────────────────────
    interface LearningMsg { id: string; role: 'admin' | 'bot'; content: string; ts: string; }
    const LEARNING_KEY = 'concrebot_training_v1';
    const [learningMsgs, setLearningMsgs] = useState<LearningMsg[]>(() => {
        try { return JSON.parse(localStorage.getItem(LEARNING_KEY) || '[]'); } catch { return []; }
    });
    const [learningInput, setLearningInput] = useState('');
    const [isLearningTyping, setIsLearningTyping] = useState(false);
    const [learningStarted, setLearningStarted] = useState(false);
    const learningEndRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        learningEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [learningMsgs]);

    const persistLearning = (msgs: LearningMsg[]) => {
        try { localStorage.setItem(LEARNING_KEY, JSON.stringify(msgs)); } catch {}
    };

    const startLearningSession = async () => {
        if (learningStarted || isLearningTyping) return;
        setLearningStarted(true);
        setIsLearningTyping(true);
        const geminiKey = settings.geminiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
        if (!geminiKey) {
            const msg: LearningMsg = { id: `lm-${Date.now()}`, role: 'bot', content: '⚠️ Necesito una clave Gemini en Configuración para activar el modo aprendizaje.', ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) };
            setLearningMsgs(prev => { const next = [...prev, msg]; persistLearning(next); return next; });
            setIsLearningTyping(false);
            return;
        }
        const productNames = products.slice(0, 8).map(p => p.name).join(', ') || 'mobiliario urbano en concreto';
        const prompt = `Eres ConcreBOT en MODO APRENDIZAJE. Eres el asistente oficial de ArteConcreto S.A.S, empresa colombiana de mobiliario urbano en concreto. Estás siendo entrenado por los administradores de la empresa. Tu misión es hacer preguntas inteligentes para aprender sobre los productos, precios, políticas y procesos. Conoces estos productos del catálogo: ${productNames}. Preséntate brevemente y haz tu PRIMERA pregunta concreta sobre los productos o la empresa para comenzar a aprender. Sé curioso, entusiasta y específico. Una sola pregunta.`;
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.85, maxOutputTokens: 300 } })
            });
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '¡Hola! Soy ConcreBOT. ¿Cuáles son los productos estrella de ArteConcreto y qué los hace únicos frente a la competencia?';
            const msg: LearningMsg = { id: `lm-${Date.now()}`, role: 'bot', content: text, ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) };
            setLearningMsgs(prev => { const next = [...prev, msg]; persistLearning(next); return next; });
        } catch {
            const msg: LearningMsg = { id: `lm-${Date.now()}`, role: 'bot', content: '¡Hola! Soy ConcreBOT en modo aprendizaje. ¿Cuál es el producto más vendido de ArteConcreto y por qué los clientes lo prefieren?', ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) };
            setLearningMsgs(prev => { const next = [...prev, msg]; persistLearning(next); return next; });
        } finally {
            setIsLearningTyping(false);
        }
    };

    const sendLearningMessage = async () => {
        if (!learningInput.trim() || isLearningTyping) return;
        const adminMsg: LearningMsg = { id: `lm-${Date.now()}`, role: 'admin', content: learningInput.trim(), ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) };
        const newMsgs = [...learningMsgs, adminMsg];
        setLearningMsgs(newMsgs);
        persistLearning(newMsgs);
        setLearningInput('');
        setIsLearningTyping(true);
        const geminiKey = settings.geminiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
        if (!geminiKey) { setIsLearningTyping(false); return; }
        const productContext = products.slice(0, 8).map(p => `${p.name} ($${p.price?.toLocaleString('es-CO')})`).join(', ');
        const history = newMsgs.slice(-10).map(m => ({ role: m.role === 'admin' ? 'user' : 'model' as const, parts: [{ text: m.content }] }));
        const systemCtx = { role: 'user' as const, parts: [{ text: `CONTEXTO: Eres ConcreBOT en modo aprendizaje de ArteConcreto S.A.S. Productos: ${productContext || 'mobiliario urbano'}. Aprende lo que te enseña el admin, confirma que entendiste con una frase breve, y haz UNA nueva pregunta específica para seguir aprendiendo. Máximo 150 palabras.` }] };
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [systemCtx, ...history], generationConfig: { temperature: 0.8, maxOutputTokens: 250 } })
            });
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '¡Entendido! ¿Puedes contarme más sobre cómo se maneja la cotización para proyectos grandes?';
            const botMsg: LearningMsg = { id: `lm-${Date.now()}`, role: 'bot', content: text, ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) };
            setLearningMsgs(prev => { const next = [...prev, botMsg]; persistLearning(next); return next; });
        } catch {
            const botMsg: LearningMsg = { id: `lm-${Date.now()}`, role: 'bot', content: '¡Aprendido! Voy guardando esa información. ¿Qué más debo saber sobre los procesos de venta?', ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) };
            setLearningMsgs(prev => { const next = [...prev, botMsg]; persistLearning(next); return next; });
        } finally {
            setIsLearningTyping(false);
        }
    };

    const toggleProductSelection = (id: string) => {
        setSelectedProducts(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    const combos = [
        {
            id: 'c1',
            name: 'Kit Parque Moderno',
            products: ['p1', 'p2'],
            price: '$520.000',
            originalPrice: '$570.000',
            discount: '10% OFF',
            description: 'Pack de banca hexagonal + bolardo vial. Ideal para proyectos urbanos.',
            img: 'https://images.unsplash.com/photo-1594913366159-1832ebbee3f4?w=800&h=800&fit=crop'
        },
        {
            id: 'c2',
            name: 'Set Jardín Minimalista',
            products: ['p4', 'p4', 'p4'],
            price: '$480.000',
            originalPrice: '$555.000',
            discount: 'Bundle Price',
            description: 'Trío de macetas cilíndricas para ambientación de exteriores.',
            img: 'https://images.unsplash.com/photo-1485955900006-10f4d324d446?w=800&h=800&fit=crop'
        }
    ];

    const [modalTab, setModalTab] = useState<'products' | 'combos' | 'quotes'>('products');

    useEffect(() => {
        const merged = settings.botSettings || DEFAULT_BOT_SETTINGS;
        setCaptureFields(merged.captureFields);
        setDeliveryTimes(merged.deliveryTimes);
        setShippingCost(merged.shippingCost);
        setCoverageArea(merged.coverageArea);
        setFaqs(merged.faqs);
        setSystemPrompt(merged.systemPrompt);
        setEscalationRules(merged.escalationRules);
        setWidgetConfig(merged.widget);
    }, [settings.botSettings]);

    // Poll live widget conversations every 5 seconds
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const res = await fetch('/api/conversations', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    const convs: WidgetConversation[] = data.conversations || [];
                    setLiveConversations(convs);
                    // Update selected conversation using ref (avoids stale closure)
                    const current = selectedConvRef.current;
                    if (current) {
                        const updated = convs.find(c => c.id === current.id);
                        if (updated) setSelectedConversation(updated);
                    }
                }
            } catch { /* silent */ }
        };
        fetchConversations();
        const interval = setInterval(fetchConversations, 5000);
        return () => clearInterval(interval);
    }, []);

    const sendHumanReply = async () => {
        if (!replyText.trim() || !selectedConversation || isSendingReply) return;
        const text = replyText.trim();
        setReplyText('');
        setIsSendingReply(true);
        const updatedConv: WidgetConversation = {
            ...selectedConversation,
            messages: [
                ...selectedConversation.messages,
                { role: 'assistant', content: text, timestamp: new Date().toISOString() },
            ],
            updatedAt: new Date().toISOString(),
        };
        setSelectedConversation(updatedConv);
        setLiveConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
        try {
            await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation: updatedConv }),
            });
        } catch { /* silent */ }
        setIsSendingReply(false);
    };

    // Alerts are triggered only by real WhatsApp/chat events, never simulated

    const toggleField = (field: keyof typeof captureFields) => {
        setCaptureFields(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const toggleEscalationRule = (rule: keyof typeof escalationRules) => {
        setEscalationRules(prev => ({ ...prev, [rule]: !prev[rule] }));
    };

    const updateFaq = (index: number, value: string) => {
        setFaqs(prev => prev.map((faq, faqIndex) => faqIndex === index ? value : faq));
    };

    const addFaq = () => {
        setFaqs(prev => [...prev, '']);
    };

    const removeFaq = (index: number) => {
        setFaqs(prev => prev.filter((_, faqIndex) => faqIndex !== index));
    };

    const handleSaveBotConfig = () => {
        setIsSavingConfig(true);

        updateSettings({
            botSettings: {
                deliveryTimes: deliveryTimes.trim(),
                shippingCost: shippingCost.trim(),
                coverageArea: coverageArea.trim(),
                faqs: faqs.map((faq) => faq.trim()).filter(Boolean),
                systemPrompt: systemPrompt.trim(),
                escalationRules,
                captureFields,
                widget: widgetConfig,
                schedule: botSchedule,
            },
        });

        window.setTimeout(() => {
            setIsSavingConfig(false);
            addNotification({
                title: 'MiWi actualizado',
                description: 'La configuración del bot quedó guardada y persistida en el CRM.',
                type: 'success',
            });
        }, 250);
    };

    const widgetBaseUrl = typeof window !== "undefined"
        ? window.location.origin
        : "https://crm-intelligence-six.vercel.app";

    const widgetSnippet = `<script>
  window.miwiSettings = {
    apiKey: "${widgetConfig.apiKey}",
    primaryColor: "${widgetConfig.primaryColor}",
    botName: "${widgetConfig.botName}",
    position: "${widgetConfig.position}",
    authorizedDomain: "${widgetConfig.authorizedDomain}",
    whatsappSync: ${widgetConfig.whatsappSync}
  };
</script>
<script src="${widgetBaseUrl}/widget.js" async></script>`;

    const copyWidgetSnippet = async () => {
        await navigator.clipboard.writeText(widgetSnippet);
        addNotification({
            title: 'Código copiado',
            description: 'El snippet del widget quedó en el portapapeles.',
            type: 'success',
        });
    };

    const shareWidgetSnippet = async () => {
        if (navigator.share) {
            await navigator.share({
                title: 'Widget MiWi',
                text: widgetSnippet,
            });
            return;
        }

        await copyWidgetSnippet();
    };

    const trainingChecks = [
        deliveryTimes.trim().length > 0,
        shippingCost.trim().length > 0,
        coverageArea.trim().length > 0,
        faqs.map((faq) => faq.trim()).filter(Boolean).length >= 2,
        systemPrompt.trim().length > 40,
        Object.values(escalationRules).some(Boolean),
        Object.values(captureFields).filter(Boolean).length >= 3,
        widgetConfig.apiKey.trim().length > 0,
        widgetConfig.authorizedDomain.trim().length > 0,
        widgetConfig.botName.trim().length > 0,
    ];
    const trainingScore = Math.round((trainingChecks.filter(Boolean).length / trainingChecks.length) * 100);
    const trainingLevel = trainingScore >= 85 ? 'Avanzado' : trainingScore >= 65 ? 'Intermedio' : 'Base';
    const scoreStroke = 100 - trainingScore;

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-700" style={{ height: 'calc(100vh - 7rem)' }}>
            {/* Header / Tabs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2 lg:px-0">
                <div>
                    <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <Bot className="w-7 h-7 text-primary" />
                        MiWi Intelligence
                    </h1>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground mt-1">Control omnicanal con IA híbrida.</p>
                        <div className="hidden lg:block h-4 w-px bg-border mx-2" />
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Powered by</span>
                            <img
                                src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                                alt="MiWibi"
                                className="h-3.5 object-contain brightness-0 opacity-75"
                            />
                        </div>
                        {settings.whatsapp.status === 'connected' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                                <MessageCircle className="w-3 h-3" />
                                {`WhatsApp listo${settings.whatsapp.displayPhoneNumber ? ` · ${settings.whatsapp.displayPhoneNumber}` : ''}`}
                            </span>
                        )}
                        {settings.whatsapp.status === 'error' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 border border-red-200 text-red-700">
                                <MessageCircle className="w-3 h-3" />
                                WhatsApp con error
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-muted rounded-xl p-1 flex gap-1 overflow-x-auto">
                    {[
                        { id: 'monitor', label: 'En vivo', icon: MonitorPlay },
                        { id: 'programming', label: 'Programación', icon: Cpu },
                        { id: 'capture', label: 'Pre-captura', icon: Shield },
                        { id: 'widget', label: 'Widget', icon: Code },
                        { id: 'learning', label: 'Aprendizaje', icon: BrainCircuit },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap",
                                activeTab === tab.id
                                    ? "bg-white border border-border text-foreground font-bold shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeAlert.visible && (
                <div className={clsx(
                    "px-6 py-3 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500 border",
                    activeAlert.type === 'sale' ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                )}>
                    <div className="flex items-center gap-4">
                        <div className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            activeAlert.type === 'sale' ? "bg-emerald-100" : "bg-red-100"
                        )}>
                            {activeAlert.type === 'sale' ? (
                                <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
                            ) : (
                                <BellRing className="w-4 h-4 text-red-600 animate-pulse" />
                            )}
                        </div>
                        <p className="text-[11px] font-bold text-foreground">
                            <span className={clsx(
                                "font-black mr-2 uppercase tracking-widest text-[9px]",
                                activeAlert.type === 'sale' ? "text-emerald-600" : "text-red-600"
                            )}>
                                {activeAlert.type === 'sale' ? 'Oportunidad:' : 'Atención:'}
                            </span>
                            {activeAlert.type === 'sale' ? (
                                <>MiWi ha detectado una intención de <span className="text-emerald-600 font-black italic">Venta de Alto Valor</span> en el chat activo</>
                            ) : (
                                <>MiWi requiere <span className="text-foreground font-black">intervención humana</span> en el chat activo</>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setActiveAlert({ ...activeAlert, visible: false })}
                            className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Ignorar
                        </button>
                        <button
                            onClick={() => { setActiveAlert({ ...activeAlert, visible: false }); setActiveTab('monitor'); }}
                            className={clsx(
                                "text-white font-black px-5 py-2 rounded-xl text-[9px] uppercase tracking-widest transition-all",
                                activeAlert.type === 'sale' ? "bg-emerald-500 hover:brightness-105" : "bg-red-500 hover:brightness-105"
                            )}
                        >
                            {activeAlert.type === 'sale' ? 'Cerrar Venta' : 'Intervenir'}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Area — fills remaining height after header/tabs */}
            <div className="bg-white border border-border rounded-2xl shadow-sm flex-1 min-h-0 flex relative overflow-hidden">

                {activeTab === 'monitor' && (
                    <React.Fragment>
                        {/* Chat Sidebar */}
                        <div className={clsx(
                            "w-full lg:w-80 border-r border-border flex flex-col bg-white transition-all duration-300",
                            selectedChat && "hidden lg:flex"
                        )}>
                            <div className="p-5 space-y-3 border-b border-border">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Conversaciones</p>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">Online</span>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto divide-y divide-border custom-scrollbar">
                                {liveConversations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center">
                                            <Globe className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sin conversaciones aún</p>
                                        <p className="text-xs text-muted-foreground">Los chats del widget web aparecerán aquí en tiempo real</p>
                                    </div>
                                ) : liveConversations.map((conv) => {
                                    const lastMsg = conv.messages[conv.messages.length - 1];
                                    const isSelected = selectedConversation?.id === conv.id;
                                    const timeAgo = (() => {
                                        const d = new Date(conv.updatedAt);
                                        const diff = Math.floor((Date.now() - d.getTime()) / 60000);
                                        if (diff < 1) return 'Ahora';
                                        if (diff < 60) return `${diff}m`;
                                        return `${Math.floor(diff / 60)}h`;
                                    })();
                                    return (
                                        <div
                                            key={conv.id}
                                            onClick={() => setSelectedConversation(conv)}
                                            className={clsx(
                                                "p-4 cursor-pointer transition-all hover:bg-muted relative group",
                                                isSelected ? "bg-muted" : ""
                                            )}
                                        >
                                            {isSelected && <div className="absolute left-0 top-0 w-0.5 h-full bg-primary"></div>}
                                            <div className="flex gap-3">
                                                <div className="relative shrink-0">
                                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-xs text-primary uppercase">
                                                        {(conv.lead.name || 'W')[0].toUpperCase()}
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <p className="text-sm font-bold text-foreground truncate">{conv.lead.name || 'Lead Web'}</p>
                                                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{timeAgo}</span>
                                                    </div>
                                                    {conv.lead.company && <p className="text-xs text-muted-foreground truncate mb-0.5">{conv.lead.company}{conv.lead.city ? ` · ${conv.lead.city}` : ''}</p>}
                                                    <p className="text-xs text-muted-foreground truncate">{lastMsg?.content?.slice(0, 60) || '...'}</p>
                                                    <div className="mt-1.5 flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 border border-sky-200 text-sky-700">Web Chat</span>
                                                        <span className="text-[10px] text-muted-foreground">{conv.messages.length} msgs</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className={clsx(
                            "flex-1 flex flex-col bg-white duration-300",
                            !selectedConversation && "hidden lg:flex"
                        )}>
                            {!selectedConversation ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                    <div className="w-20 h-20 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
                                        <MessageCircle className="w-9 h-9 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Selecciona un chat</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Para comenzar a monitorear en tiempo real</p>
                                </div>
                            ) : (
                                <React.Fragment>
                                    {/* Chat header */}
                                    <div className="h-16 border-b border-border px-5 flex items-center justify-between bg-white shrink-0">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setSelectedConversation(null)} className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-xl transition-colors">
                                                <ChevronRight className="w-5 h-5 rotate-180" />
                                            </button>
                                            <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20 shrink-0">
                                                {(selectedConversation.lead.name || 'W')[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{selectedConversation.lead.name || 'Lead Web'}</p>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                        <span className="text-[10px] font-bold text-muted-foreground">Web Chat · En vivo</span>
                                                    </div>
                                                    {selectedConversation.lead.city && <span className="text-[10px] text-muted-foreground">{selectedConversation.lead.city}</span>}
                                                    {selectedConversation.lead.company && <span className="text-[10px] text-muted-foreground">{selectedConversation.lead.company}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedConversation.lead.phone && (
                                                <a href={`https://wa.me/${selectedConversation.lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                                                    className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 hover:bg-emerald-100 transition-all shrink-0">
                                                    <Phone className="w-4 h-4" />
                                                </a>
                                            )}
                                            {selectedConversation.lead.email && (
                                                <a href={`mailto:${selectedConversation.lead.email}`}
                                                    className="p-2 bg-sky-50 border border-sky-200 rounded-xl text-sky-700 hover:bg-sky-100 transition-all shrink-0">
                                                    <Mail className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lead info bar */}
                                    <div className="px-5 py-2 bg-muted border-b border-border flex items-center gap-4 flex-wrap">
                                        {selectedConversation.lead.email && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Mail className="w-3 h-3" />{selectedConversation.lead.email}
                                            </span>
                                        )}
                                        {selectedConversation.lead.phone && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Phone className="w-3 h-3" />{selectedConversation.lead.phone}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground ml-auto">
                                            {selectedConversation.messages.length} mensajes · {new Date(selectedConversation.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                    </div>

                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-background">
                                        {selectedConversation.messages.map((msg, i) => (
                                            <div key={i} className={clsx("flex gap-3", msg.role === 'assistant' ? 'flex-row-reverse' : '')}>
                                                <div className={clsx(
                                                    "w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold",
                                                    msg.role === 'assistant' ? 'bg-primary text-black' : 'bg-muted border border-border text-muted-foreground'
                                                )}>
                                                    {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                </div>
                                                <div className={clsx(
                                                    "max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                                                    msg.role === 'assistant'
                                                        ? 'bg-white border border-border text-foreground rounded-tr-none shadow-sm'
                                                        : 'bg-white border border-border text-foreground rounded-tl-none shadow-sm'
                                                )}>
                                                    <p className="font-medium">{msg.content}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                        {msg.role === 'assistant' ? 'Bot' : selectedConversation.lead.name || 'Lead'} · {new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>

                                    <div className="p-4 bg-white border-t border-border relative shrink-0">
                                        {/* Attachment Menu Overlay */}
                                        {isAttachmentMenuOpen && (
                                            <div className="absolute bottom-full mb-3 left-4 bg-white border border-border rounded-2xl p-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 z-50 w-60">
                                                <div className="space-y-1">
                                                    <button
                                                        onClick={() => {
                                                            setIsQuoteModalOpen(true);
                                                            setIsAttachmentMenuOpen(false);
                                                        }}
                                                        className="flex items-center gap-3 p-3 w-full hover:bg-muted rounded-xl transition-all text-left"
                                                    >
                                                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                                            <FilePlus className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground">Cotización</p>
                                                            <p className="text-[10px] text-muted-foreground">Generar PDF</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsProductModalOpen(true);
                                                            setIsAttachmentMenuOpen(false);
                                                        }}
                                                        className="flex items-center gap-3 p-3 w-full hover:bg-muted rounded-xl transition-all text-left"
                                                    >
                                                        <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center border border-sky-200">
                                                            <Package className="w-4 h-4 text-sky-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground">Productos</p>
                                                            <p className="text-[10px] text-muted-foreground">Enviar ficha</p>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-muted border border-border rounded-xl p-2 flex items-center gap-2 focus-within:border-primary focus-within:bg-white transition-all">
                                            <button
                                                onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                                                className={clsx(
                                                    "p-2 rounded-lg transition-all",
                                                    isAttachmentMenuOpen ? "bg-primary text-black" : "hover:bg-white text-muted-foreground"
                                                )}
                                            >
                                                <Paperclip className="w-5 h-5" />
                                            </button>
                                            <input
                                                type="text"
                                                value={replyText}
                                                onChange={e => setReplyText(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHumanReply(); } }}
                                                placeholder={isHumanInControl ? "Escribe como agente humano..." : "Responde al cliente..."}
                                                className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-foreground placeholder:text-muted-foreground"
                                            />
                                            <button
                                                onClick={sendHumanReply}
                                                disabled={!replyText.trim() || isSendingReply}
                                                className="bg-primary text-black p-2.5 rounded-lg hover:brightness-105 transition-all disabled:opacity-40"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </React.Fragment>
                            )}
                        </div>

                        {/* Product Catalog Panel — right column (desktop only) */}
                        <div className="hidden lg:flex w-56 xl:w-64 border-l border-border flex-col bg-white shrink-0">
                            <div className="p-4 border-b border-border space-y-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Catálogo de Productos</p>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchProduct}
                                        onChange={e => setSearchProduct(e.target.value)}
                                        className="w-full bg-muted border border-border rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-primary focus:bg-white transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                                {products
                                    .filter(p => !searchProduct || p.name.toLowerCase().includes(searchProduct.toLowerCase()))
                                    .slice(0, 30)
                                    .map(p => {
                                        const price = typeof p.price === 'number' ? p.price : Number(String(p.price).replace(/[^0-9.]/g, '')) || 0;
                                        const fmtPrice = price > 0
                                            ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price)
                                            : 'Consultar';
                                        const copyText = `*${p.name}*\nPrecio: ${fmtPrice}\nSKU: ${p.sku || 'N/A'}`;
                                        return (
                                            <div key={p.id} className="bg-white border border-border rounded-xl p-3 hover:border-primary/40 transition-colors">
                                                <div className="flex items-start gap-2">
                                                    {p.image ? (
                                                        <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0 border border-border" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                                                            <Package className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{p.name}</p>
                                                        <p className="text-xs text-primary font-bold mt-0.5">{fmtPrice}</p>
                                                        {p.sku && <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.sku}</p>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        try { await navigator.clipboard.writeText(copyText); } catch { /* ignore */ }
                                                        setReplyText(prev => prev ? `${prev}\n${copyText}` : copyText);
                                                        addNotification({ title: 'Producto copiado', description: p.name, type: 'success' });
                                                    }}
                                                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 transition-all text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                    Copiar al chat
                                                </button>
                                            </div>
                                        );
                                    })}
                                {products.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                                        <Package className="w-8 h-8 text-muted-foreground" />
                                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Sin productos sincronizados</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </React.Fragment>
                )}

                {activeTab === 'programming' && (
                    <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
                                    <BrainCircuit className="w-6 h-6 text-primary" />
                                    Entrenamiento de MiWi
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">Configura la lógica, el conocimiento y la voz de tu IA</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
                                    <div className="relative">
                                        <Circle className="w-12 h-12 text-muted" strokeWidth={4} />
                                        <Circle
                                            className="w-12 h-12 text-primary absolute top-0 left-0 -rotate-90"
                                            strokeWidth={4}
                                            strokeDasharray="100"
                                            strokeDashoffset={scoreStroke}
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{trainingScore}%</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Score de Entrenamiento</p>
                                        <p className="text-sm font-bold text-foreground">Nivel: {trainingLevel}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveBotConfig}
                                    className="bg-primary text-black font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:brightness-105 transition-all disabled:opacity-60"
                                    disabled={isSavingConfig}
                                >
                                    <Save className="w-4 h-4" />
                                    <span className="text-sm">{isSavingConfig ? 'Guardando...' : 'Guardar Todo'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Structured Knowledge Section */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white border border-border rounded-2xl shadow-sm p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                                <Wand2 className="w-5 h-5 text-primary" />
                                            </div>
                                            <h3 className="text-base font-bold text-foreground">Base de Datos de Negocio</h3>
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Prioridad Alta</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" />Tiempos de Entrega</label>
                                            <input
                                                type="text"
                                                placeholder="Ej: 10 a 15 días hábiles"
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                value={deliveryTimes}
                                                onChange={(e) => setDeliveryTimes(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground italic">MiWi mencionará este dato al preguntar sobre disponibilidad.</p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-primary" />Costo de Envío</label>
                                            <input
                                                type="text"
                                                placeholder="Ej: Gratis en Bogotá, resto del país contraentrega"
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                value={shippingCost}
                                                onChange={(e) => setShippingCost(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" />Zona de Cobertura</label>
                                            <textarea
                                                placeholder="Ej: Toda Colombia, especializado en zonas urbanas."
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all h-28 resize-none"
                                                value={coverageArea}
                                                onChange={(e) => setCoverageArea(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5 flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5 text-primary" />Preguntas Frecuentes (FAQ)</label>
                                            <div className="space-y-2">
                                                {faqs.map((faq, index) => (
                                                    <div key={`faq-${index}`} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={faq}
                                                            onChange={(e) => updateFaq(index, e.target.value)}
                                                            placeholder={`FAQ ${index + 1}`}
                                                            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                        />
                                                        <button
                                                            onClick={() => removeFaq(index)}
                                                            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all shrink-0"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={addFaq}
                                                    className="w-full py-2.5 text-primary text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-primary/20 rounded-xl hover:bg-primary/5 transition-all"
                                                >
                                                    <Zap className="w-3 h-3" /> Añadir Nueva FAQ
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Instrucciones Maestras (System Prompt)</label>
                                    <div className="relative group">
                                        <textarea
                                            className="w-full h-64 bg-muted border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary focus:bg-white outline-none transition-all text-foreground leading-relaxed custom-scrollbar resize-none"
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                        />
                                        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 bg-primary text-black rounded-xl hover:brightness-105 transition-all">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Config / Protocol */}
                            <div className="space-y-5">
                                <div className="bg-white border border-border rounded-2xl shadow-sm p-5 space-y-5">
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-4 h-4 text-primary" />
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Escalamiento Humano</h4>
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'largeSale', label: 'Alertar por "Venta Grande"', active: escalationRules.largeSale },
                                            { id: 'anger', label: 'Pasar a Humano por Enojo', active: escalationRules.anger },
                                            { id: 'unknownAnswer', label: 'Pedir ayuda si no sé la respuesta', active: escalationRules.unknownAnswer },
                                            { id: 'catalogOnly', label: 'Modo Solo Catalogo (No IA)', active: escalationRules.catalogOnly },
                                        ].map((cap) => (
                                            <div key={cap.id} className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">{cap.label}</span>
                                                <button
                                                    onClick={() => toggleEscalationRule(cap.id as keyof typeof escalationRules)}
                                                    className={clsx(
                                                        "w-10 h-5 rounded-full relative transition-all shrink-0",
                                                        cap.active ? "bg-primary" : "bg-muted border border-border"
                                                    )}
                                                >
                                                    <div className={clsx(
                                                        "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                                                        cap.active ? "left-6" : "left-1"
                                                    )}></div>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white border border-red-200 rounded-2xl shadow-sm p-5 space-y-4">
                                    <div className="flex items-center gap-3 text-red-600">
                                        <AlertTriangle className="w-4 h-4" />
                                        <h4 className="text-xs font-bold uppercase tracking-widest">Protocolo de Crisis</h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        "Si el bot detecta reclamaciones o términos legales, MiWi detendrá sus respuestas y te enviará un alerta roja inmediata."
                                    </p>
                                    <button className="w-full py-2.5 border border-red-200 rounded-xl text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-500 hover:text-white transition-all">
                                        Configurar Palabras Prohibidas
                                    </button>
                                </div>

                                <div className="bg-white border border-border rounded-2xl shadow-sm p-5 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Estado del Aprendizaje</h4>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${trainingScore}%` }} />
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Modelo Entrenado</span>
                                            <span>{trainingScore}% completitud</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── HORARIO DE ATENCIÓN ── */}
                        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                        <Clock className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-foreground">Horario de Atención del Bot</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">Fuera de este horario el bot responde con el mensaje offline</p>
                                    </div>
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                        {botSchedule.enabled ? 'Activo' : 'Desactivado'}
                                    </span>
                                    <div
                                        onClick={() => setBotSchedule(s => ({ ...s, enabled: !s.enabled }))}
                                        className={clsx(
                                            "relative w-12 h-6 rounded-full transition-colors cursor-pointer border-2",
                                            botSchedule.enabled ? "bg-primary border-primary" : "bg-muted border-border"
                                        )}
                                    >
                                        <div className={clsx(
                                            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                                            botSchedule.enabled ? "left-6" : "left-0.5"
                                        )} />
                                    </div>
                                </label>
                            </div>

                            {botSchedule.enabled && (
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        {([
                                            { key: 'mon', label: 'Lunes' },
                                            { key: 'tue', label: 'Martes' },
                                            { key: 'wed', label: 'Miércoles' },
                                            { key: 'thu', label: 'Jueves' },
                                            { key: 'fri', label: 'Viernes' },
                                            { key: 'sat', label: 'Sábado' },
                                            { key: 'sun', label: 'Domingo' },
                                        ] as const).map(({ key, label }) => {
                                            const day = botSchedule.days[key];
                                            return (
                                                <div key={key} className={clsx(
                                                    "flex items-center gap-4 p-3 rounded-xl border transition-all",
                                                    day.enabled ? "bg-white border-primary/30" : "bg-muted border-border opacity-60"
                                                )}>
                                                    <button
                                                        onClick={() => setBotSchedule(s => ({
                                                            ...s,
                                                            days: { ...s.days, [key]: { ...s.days[key], enabled: !day.enabled } }
                                                        }))}
                                                        className={clsx(
                                                            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                                            day.enabled ? "bg-primary border-primary text-black" : "border-border bg-white"
                                                        )}
                                                    >
                                                        {day.enabled && <Check className="w-3 h-3" />}
                                                    </button>
                                                    <span className="w-24 text-xs font-bold uppercase tracking-widest text-foreground shrink-0">{label}</span>
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input
                                                            type="time"
                                                            value={day.start}
                                                            disabled={!day.enabled}
                                                            onChange={e => setBotSchedule(s => ({
                                                                ...s,
                                                                days: { ...s.days, [key]: { ...s.days[key], start: e.target.value } }
                                                            }))}
                                                            className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all disabled:opacity-40"
                                                        />
                                                        <span className="text-muted-foreground text-sm">—</span>
                                                        <input
                                                            type="time"
                                                            value={day.end}
                                                            disabled={!day.enabled}
                                                            onChange={e => setBotSchedule(s => ({
                                                                ...s,
                                                                days: { ...s.days, [key]: { ...s.days[key], end: e.target.value } }
                                                            }))}
                                                            className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all disabled:opacity-40"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Zona Horaria</label>
                                            <select
                                                value={botSchedule.timezone}
                                                onChange={e => setBotSchedule(s => ({ ...s, timezone: e.target.value }))}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all"
                                            >
                                                <option value="America/Bogota">América/Bogotá (UTC-5)</option>
                                                <option value="America/New_York">América/New York (UTC-5/-4)</option>
                                                <option value="America/Mexico_City">América/Ciudad de México (UTC-6/-5)</option>
                                                <option value="Europe/Madrid">Europa/Madrid (UTC+1/+2)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Mensaje Offline</label>
                                            <input
                                                type="text"
                                                value={botSchedule.offlineMessage}
                                                onChange={e => setBotSchedule(s => ({ ...s, offlineMessage: e.target.value }))}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all"
                                                placeholder="Mensaje cuando el bot está fuera de horario..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'capture' && (
                    <div className="flex-1 p-8 space-y-8 flex flex-col items-center overflow-y-auto custom-scrollbar">
                        <div className="text-center space-y-2 max-w-2xl">
                            <Shield className="w-10 h-10 text-primary mx-auto" />
                            <h2 className="text-2xl font-black text-foreground tracking-tight">Formulario de Pre-Chat</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Captura los datos del cliente automáticamente antes de iniciar la conversación con MiWi. Esto garantiza que todos los contactos se registren como Leads.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-4xl items-start">
                            <div className="space-y-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Campos del Chatbot</p>
                                <div className="space-y-2">
                                    {Object.entries(captureFields).map(([key, val]) => (
                                        <div
                                            key={key}
                                            onClick={() => toggleField(key as any)}
                                            className={clsx(
                                                "flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all",
                                                val ? "bg-primary/5 border-primary/30 text-foreground" : "bg-white border-border text-muted-foreground opacity-50"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                {val ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5" />}
                                                <span className="text-sm font-bold">{key === 'name' ? 'Nombre Completo' : key === 'email' ? 'Correo Electrónico' : key === 'phone' ? 'WhatsApp' : key === 'city' ? 'Ciudad' : 'Empresa'}</span>
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                                                style={val ? { background: '#fef9e7', color: '#b45309', border: '1px solid #fde68a' } : { background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}>
                                                {val ? 'Requerido' : 'Off'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Preview del Saludo</p>
                                <div className="bg-white border border-border rounded-2xl shadow-sm p-5 space-y-4">
                                    <div className="space-y-2">
                                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                                            <Bot className="w-5 h-5 text-black" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-foreground">MiWi AI Bot</h4>
                                            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">¡Hola! Para brindarte una mejor atención, por favor déjanos tus datos básicos antes de empezar.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {Object.entries(captureFields).filter(([_, v]) => v).map(([k]) => (
                                            <div key={k} className="h-10 bg-muted border border-dashed border-border rounded-xl px-3 flex items-center">
                                                <span className="text-xs text-muted-foreground">{k === 'name' ? 'Escribe tu nombre' : k === 'email' ? 'Tu correo electrónico' : k === 'phone' ? 'Tu WhatsApp' : k === 'city' ? 'Tu ciudad' : 'Completar campo'}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full bg-primary text-black font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest hover:brightness-105 transition-all">
                                        Iniciar Conversación
                                    </button>
                                    <button
                                        onClick={handleSaveBotConfig}
                                        className="w-full bg-white border border-border text-foreground font-semibold py-2.5 rounded-xl text-xs uppercase tracking-widest hover:bg-muted transition-all disabled:opacity-60"
                                        disabled={isSavingConfig}
                                    >
                                        {isSavingConfig ? 'Guardando...' : 'Guardar Pre-captura'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'widget' && (
                    <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            <div className="flex-1 space-y-4">
                                <h2 className="text-2xl font-black text-foreground tracking-tight">Lleva a MiWi a cualquier lugar.</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Copia este fragmento de código y pégalo antes de la etiqueta <code className="text-primary font-mono">&lt;/body&gt;</code> de tu sitio web o landing page.
                                </p>
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <Zap className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Instalación en 1 minuto</span>
                                </div>
                            </div>

                            <div className="flex-1 w-full space-y-4">
                                <div className="bg-white border border-border rounded-2xl shadow-sm p-5 relative">
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button
                                            onClick={copyWidgetSnippet}
                                            className="p-2 bg-muted rounded-xl border border-border transition-all text-muted-foreground hover:text-foreground"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={shareWidgetSnippet}
                                            className="p-2 bg-muted rounded-xl border border-border transition-all text-muted-foreground hover:text-foreground"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <pre className="text-xs font-mono text-primary leading-relaxed overflow-x-auto pt-8">
                                        {widgetSnippet}
                                    </pre>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-primary"><Code className="w-4 h-4" /><p className="text-xs font-bold uppercase tracking-widest text-foreground">Bot Name</p></div>
                                        <input
                                            type="text"
                                            value={widgetConfig.botName}
                                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, botName: e.target.value }))}
                                            className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="bg-white border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-primary"><Key className="w-4 h-4" /><p className="text-xs font-bold uppercase tracking-widest text-foreground">API Key</p></div>
                                        <input
                                            type="text"
                                            value={widgetConfig.apiKey}
                                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                            className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="bg-white border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-sky-600"><Globe className="w-4 h-4" /><p className="text-xs font-bold uppercase tracking-widest text-foreground">Dominio Autorizado</p></div>
                                        <input
                                            type="text"
                                            value={widgetConfig.authorizedDomain}
                                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, authorizedDomain: e.target.value }))}
                                            className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="bg-white border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-emerald-600"><MessageCircle className="w-4 h-4" /><p className="text-xs font-bold uppercase tracking-widest text-foreground">WhatsApp Sync</p></div>
                                        <button
                                            onClick={() => setWidgetConfig(prev => ({ ...prev, whatsappSync: !prev.whatsappSync }))}
                                            className={clsx(
                                                "w-fit px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border",
                                                widgetConfig.whatsappSync ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"
                                            )}
                                        >
                                            {widgetConfig.whatsappSync ? 'Activo' : 'Inactivo'}
                                        </button>
                                        <p className="text-xs text-muted-foreground">
                                            {settings.whatsapp.status === 'connected'
                                                ? settings.whatsapp.displayPhoneNumber || 'API Conectada'
                                                : settings.whatsapp.status === 'configured'
                                                    ? 'Configurada, falta validar'
                                                    : settings.whatsapp.status === 'error'
                                                        ? 'Con error de conexión'
                                                        : 'Sin configurar'}
                                        </p>
                                    </div>
                                    <div className="md:col-span-2 flex justify-end">
                                        <button
                                            onClick={handleSaveBotConfig}
                                            className="bg-primary text-black font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:brightness-105 transition-all disabled:opacity-60"
                                            disabled={isSavingConfig}
                                        >
                                            <Save className="w-4 h-4" />
                                            <span className="text-sm">{isSavingConfig ? 'Guardando...' : 'Guardar Widget'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── LEARNING MODE TAB ─────────────────────────────────── */}
                {activeTab === 'learning' && (
                    <div className="flex flex-col w-full h-full">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <BrainCircuit className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">ConcreBOT · Modo Aprendizaje</h3>
                                    <p className="text-xs text-muted-foreground">Entrena al bot sobre productos, precios y procesos de venta</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 border border-primary/20 text-primary">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    Modo Aprendizaje
                                </span>
                                {learningMsgs.length > 0 && (
                                    <button
                                        onClick={() => { setLearningMsgs([]); setLearningStarted(false); persistLearning([]); }}
                                        className="text-xs font-bold text-muted-foreground hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200"
                                    >
                                        Borrar historial
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Chat area */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar bg-background">
                            {learningMsgs.length === 0 && !learningStarted && (
                                <div className="flex flex-col items-center justify-center h-full gap-5 px-6">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <BrainCircuit className="w-8 h-8 text-primary" />
                                    </div>
                                    <div className="text-center max-w-sm">
                                        <h4 className="text-base font-bold text-foreground mb-1">ConcreBOT quiere aprender</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">Inicia una sesión y ConcreBOT comenzará a hacerte preguntas sobre productos, precios y procesos de venta. Lo que enseñes aquí se usará cuando chatee con clientes.</p>
                                    </div>
                                    <button
                                        onClick={startLearningSession}
                                        className="flex items-center gap-2 bg-primary text-black font-bold px-6 py-3 rounded-xl hover:brightness-105 transition-all"
                                    >
                                        <BrainCircuit className="w-5 h-5" />
                                        Iniciar Sesión de Aprendizaje
                                    </button>
                                </div>
                            )}

                            {learningMsgs.map(msg => (
                                <div key={msg.id} className={clsx('flex gap-3', msg.role === 'admin' ? 'flex-row-reverse' : 'flex-row')}>
                                    <div className={clsx(
                                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                                        msg.role === 'bot' ? 'bg-primary/10 border border-primary/20 text-primary' : 'bg-foreground text-background'
                                    )}>
                                        {msg.role === 'bot' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                    </div>
                                    <div className={clsx(
                                        'max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                                        msg.role === 'bot'
                                            ? 'bg-white border border-border text-foreground rounded-tl-sm shadow-sm'
                                            : 'bg-primary text-black font-semibold rounded-tr-sm'
                                    )}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        <p className={clsx('text-[10px] mt-1.5', msg.role === 'bot' ? 'text-muted-foreground' : 'text-black/60')}>{msg.ts}</p>
                                    </div>
                                </div>
                            ))}

                            {isLearningTyping && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="px-4 py-3 bg-white border border-border rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            )}
                            <div ref={learningEndRef} />
                        </div>

                        {/* Knowledge stats */}
                        {learningMsgs.length > 0 && (
                            <div className="mx-5 mb-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <p className="text-xs font-bold text-emerald-700">
                                    {Math.floor(learningMsgs.filter(m => m.role === 'admin').length)} respuestas guardadas · ConcreBOT está aprendiendo sobre ArteConcreto
                                </p>
                            </div>
                        )}

                        {/* Input */}
                        {(learningStarted || learningMsgs.length > 0) && (
                            <div className="px-5 pb-5">
                                <div className="flex items-end gap-3 bg-muted border border-border rounded-xl p-3">
                                    <textarea
                                        value={learningInput}
                                        onChange={e => setLearningInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendLearningMessage(); } }}
                                        placeholder="Responde a ConcreBOT para enseñarle..."
                                        rows={2}
                                        className="flex-1 bg-transparent text-sm text-foreground resize-none outline-none placeholder:text-muted-foreground"
                                    />
                                    <button
                                        onClick={sendLearningMessage}
                                        disabled={!learningInput.trim() || isLearningTyping}
                                        className="bg-primary text-black p-2.5 rounded-xl hover:brightness-105 transition-all disabled:opacity-40 shrink-0"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Enter para enviar · Shift+Enter nueva línea</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Product Picker Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                    <div
                        className="absolute inset-0"
                        onClick={() => setIsProductModalOpen(false)}
                    />
                    <div className="relative bg-white border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[600px] animate-in zoom-in-95 duration-300">
                        {/* Modal header with tab switcher */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div className="bg-muted rounded-xl p-1 flex gap-1">
                                <button
                                    onClick={() => setModalTab('products')}
                                    className={clsx(
                                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                        modalTab === 'products' ? "bg-white border border-border text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Productos Individuales
                                </button>
                                <button
                                    onClick={() => setModalTab('combos')}
                                    className={clsx(
                                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                        modalTab === 'combos' ? "bg-white border border-border text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Zap className="w-3 h-3" />
                                    Combos
                                </button>
                                <button
                                    onClick={() => setModalTab('quotes')}
                                    className={clsx(
                                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                        modalTab === 'quotes' ? "bg-white border border-border text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <FileText className="w-3 h-3" />
                                    Cotizaciones PDF
                                </button>
                            </div>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Stats */}
                        <div className="px-6 py-4 border-b border-border flex flex-col md:flex-row gap-3 items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto por nombre o categoría..."
                                    className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                    value={searchProduct}
                                    onChange={(e) => setSearchProduct(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">Stock: 154 Items</span>
                                <button className="p-2 bg-muted rounded-xl border border-border text-muted-foreground hover:text-foreground">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* List Content */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {modalTab === 'products' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {products
                                        .filter(p =>
                                            p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                                            p.category.toLowerCase().includes(searchProduct.toLowerCase()) ||
                                            p.sku.toLowerCase().includes(searchProduct.toLowerCase())
                                        )
                                        .map(product => (
                                            <div
                                                key={product.id}
                                                onClick={() => toggleProductSelection(product.id)}
                                                className={clsx(
                                                    "p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 relative",
                                                    selectedProducts.includes(product.id)
                                                        ? "bg-primary/5 border-primary"
                                                        : "bg-white border-border hover:border-primary/40"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                                                    selectedProducts.includes(product.id)
                                                        ? "bg-primary border-primary text-black"
                                                        : "bg-white border-border"
                                                )}>
                                                    {selectedProducts.includes(product.id) && <Check className="w-3 h-3" strokeWidth={4} />}
                                                </div>
                                                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-border">
                                                    <img src={product.image || 'https://images.unsplash.com/photo-1594913366159-1832ebbee3f4?w=800&h=800&fit=crop'} alt={product.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 flex flex-col justify-between py-0.5">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-0.5">{product.category}</span>
                                                        <h4 className="text-sm font-bold text-foreground mb-0.5">{product.name}</h4>
                                                        <p className="text-xs text-muted-foreground line-clamp-1">{product.shortDescription}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-sm font-bold text-foreground">${product.price.toLocaleString()}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                addNotification({ title: 'Enviando al chat', description: `Producto "${product.name}" enviado al bot.`, type: 'success' });
                                                                setIsProductModalOpen(false);
                                                                setIsAttachmentMenuOpen(false);
                                                                setSelectedProducts([]);
                                                            }}
                                                            className="bg-white border border-border text-foreground font-semibold rounded-xl px-3 py-1.5 text-xs hover:bg-muted transition-all"
                                                        >
                                                            Enviar Solo Este
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : modalTab === 'combos' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {combos.map(combo => (
                                        <div
                                            key={combo.id}
                                            className="bg-white border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-all flex flex-col shadow-sm"
                                        >
                                            <div className="h-36 relative overflow-hidden">
                                                <img src={combo.img} alt={combo.name} className="w-full h-full object-cover" />
                                                <div className="absolute top-3 left-3 bg-primary text-black px-2.5 py-1 rounded-lg text-xs font-bold">
                                                    {combo.discount}
                                                </div>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div>
                                                    <h4 className="text-sm font-bold text-foreground">{combo.name}</h4>
                                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{combo.description}</p>
                                                </div>
                                                <div className="flex items-center justify-between pt-3 border-t border-border">
                                                    <div>
                                                        <p className="text-xs text-red-500 line-through">{combo.originalPrice}</p>
                                                        <p className="text-base font-bold text-foreground">{combo.price}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            addNotification({ title: 'Combo enviado', description: `Combo "${combo.name}" enviado al bot.`, type: 'success' });
                                                            setIsProductModalOpen(false);
                                                            setIsAttachmentMenuOpen(false);
                                                        }}
                                                        className="bg-primary text-black font-bold px-4 py-2 rounded-xl text-xs hover:brightness-105 transition-all"
                                                    >
                                                        Enviar Combo
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : quotes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <FileText className="w-10 h-10 text-muted-foreground mb-3" />
                                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Sin cotizaciones</p>
                                    <p className="text-xs text-muted-foreground mt-1">Crea cotizaciones desde el módulo de Cotizaciones</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {quotes.map(q => (
                                        <div key={q.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                                    <FileText className="w-4 h-4 text-primary" />
                                                </div>
                                                <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                                                    q.status === 'Approved' ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-muted border border-border text-muted-foreground"
                                                )}>{q.status}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-foreground">Cot. #{q.id.slice(-6).toUpperCase()}</h4>
                                                <p className="text-xs text-muted-foreground mt-0.5">Cliente: {q.client || '—'}</p>
                                            </div>
                                            <div className="flex items-center justify-between pt-3 border-t border-border">
                                                <span className="text-sm font-bold text-foreground">{q.total || '$0'}</span>
                                                <button
                                                    onClick={() => {
                                                        addNotification({ title: 'Cotización enviada al chat', description: `Cot. #${q.id.slice(-6).toUpperCase()} enviada a ${selectedChat?.sender || 'cliente'}`, type: 'success' });
                                                        setIsProductModalOpen(false);
                                                        setIsAttachmentMenuOpen(false);
                                                    }}
                                                    className="bg-white border border-border text-foreground font-semibold rounded-xl px-3 py-1.5 text-xs hover:bg-muted transition-all"
                                                >
                                                    Enviar PDF
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                            <div>
                                <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">MiWi Intelligence</span>
                                {selectedProducts.length > 0 && (
                                    <span className="block text-xs text-primary font-bold mt-0.5">{selectedProducts.length} productos seleccionados</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedProducts([])}
                                    className={clsx(
                                        "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all",
                                        selectedProducts.length > 0 ? "text-red-600 hover:bg-red-50 border border-red-200" : "text-muted-foreground opacity-40 pointer-events-none"
                                    )}
                                >
                                    Limpiar
                                </button>
                                <button
                                    onClick={() => {
                                        addNotification({ title: 'Productos enviados', description: `${selectedProducts.length} productos enviados al bot.`, type: 'success' });
                                        setIsProductModalOpen(false);
                                        setIsAttachmentMenuOpen(false);
                                        setSelectedProducts([]);
                                    }}
                                    className={clsx(
                                        "px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all",
                                        selectedProducts.length > 0
                                            ? "bg-primary text-black hover:brightness-105"
                                            : "bg-muted text-muted-foreground pointer-events-none"
                                    )}
                                >
                                    {selectedProducts.length > 0 ? `Enviar Selección (${selectedProducts.length})` : 'Selecciona productos'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Quotation Modal */}
            {isQuoteModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[110]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                    <div
                        className="absolute inset-0"
                        onClick={() => !isGeneratingQuote && setIsQuoteModalOpen(false)}
                    />

                    <div className="relative bg-white border border-border rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                    <FilePlus className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-foreground">Generador de Cotización</h3>
                                    <p className="text-xs text-muted-foreground">Convierte este chat en un Lead y una Propuesta Formal</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsQuoteModalOpen(false)}
                                className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden flex">
                            {/* Left: Client Info & Items */}
                            <div className="flex-1 px-6 py-5 overflow-y-auto custom-scrollbar space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <User className="w-3.5 h-3.5" /> Información del Prospecto
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Nombre Completo</label>
                                            <input
                                                type="text"
                                                value={quoteForm.clientName}
                                                onChange={(e) => setQuoteForm({ ...quoteForm, clientName: e.target.value })}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                placeholder="Ej: Juan Perez"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Empresa / Proyecto</label>
                                            <input
                                                type="text"
                                                value={quoteForm.clientCompany}
                                                onChange={(e) => setQuoteForm({ ...quoteForm, clientCompany: e.target.value })}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                placeholder="Ej: Constructora Capital"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">WhatsApp / Celular</label>
                                            <input
                                                type="text"
                                                value={quoteForm.clientPhone}
                                                onChange={(e) => setQuoteForm({ ...quoteForm, clientPhone: e.target.value })}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                placeholder="+57 321..."
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Correo Electrónico</label>
                                            <input
                                                type="email"
                                                value={quoteForm.clientEmail}
                                                onChange={(e) => setQuoteForm({ ...quoteForm, clientEmail: e.target.value })}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                placeholder="nombre@email.com"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5" /> Productos a Cotizar
                                        </h4>
                                        <button
                                            onClick={() => { setIsQuoteModalOpen(false); setIsProductModalOpen(true); }}
                                            className="text-xs font-bold text-primary hover:underline"
                                        >
                                            + Explorar Catálogo
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {products.slice(0, 2).map(product => (
                                            <div key={product.id} className="bg-white border border-border rounded-xl p-4 flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <img src={product.image || 'https://images.unsplash.com/photo-1594913366159-1832ebbee3f4?w=800&h=800&fit=crop'} className="w-14 h-14 rounded-xl object-cover border border-border" />
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground">{product.name}</p>
                                                        <p className="text-xs text-primary font-bold">${product.price.toLocaleString()} / Un.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 bg-muted p-1.5 rounded-xl border border-border">
                                                        <button className="w-7 h-7 rounded-lg bg-white border border-border hover:bg-muted text-foreground font-bold text-sm">-</button>
                                                        <span className="text-sm font-bold text-foreground w-4 text-center">1</span>
                                                        <button className="w-7 h-7 rounded-lg bg-white border border-border hover:bg-muted text-foreground font-bold text-sm">+</button>
                                                    </div>
                                                    <button className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Summary & Action */}
                            <div className="w-72 border-l border-border px-6 py-5 flex flex-col justify-between bg-muted">
                                <div className="space-y-5">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resumen de la Propuesta</h4>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Subtotal Bruto</span>
                                            <span className="text-sm font-bold text-foreground">$570.000</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wide">IVA (19%)</span>
                                            <span className="text-sm font-bold text-foreground">$108.300</span>
                                        </div>
                                        <div className="h-px bg-border" />
                                        <div>
                                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Inversión Final</p>
                                            <p className="text-3xl font-black text-foreground">$678.300</p>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-emerald-700">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Sincronización Automática</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Al generar esta cotización, el sistema creará un Lead en el CRM y notificará al equipo comercial.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setIsGeneratingQuote(true);
                                        setTimeout(() => {
                                            setIsGeneratingQuote(false);
                                            setQuoteSuccess(true);
                                            setTimeout(() => {
                                                setQuoteSuccess(false);
                                                setIsQuoteModalOpen(false);
                                                addNotification({ title: 'PDF generado', description: 'El catálogo PDF fue generado y enviado al chat del bot.', type: 'success' });
                                            }, 2000);
                                        }, 3000);
                                    }}
                                    className={clsx(
                                        "w-full py-4 rounded-xl flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-wide transition-all",
                                        quoteSuccess ? "bg-emerald-500 text-white" : "bg-primary text-black hover:brightness-105"
                                    )}
                                    disabled={isGeneratingQuote}
                                >
                                    {isGeneratingQuote ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                            <span>Generando...</span>
                                        </>
                                    ) : quoteSuccess ? (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            <span>¡Enviado con Éxito!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            <span>Generar y Enviar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

