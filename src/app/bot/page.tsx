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
        botName: 'MiWi AI',
        position: 'right-bottom' as const,
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
        <div className="flex flex-col gap-3 animate-in fade-in duration-700" style={{ height: 'calc(100vh - 7rem)' }}>
            {/* Header / Tabs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2 lg:px-0">
                <div>
                    <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-foreground flex items-center gap-3">
                        <Bot className="w-8 h-8 lg:w-10 lg:h-10 text-primary animate-pulse" />
                        MiWi Intelligence
                    </h1>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2 mt-1">
                        <p className="text-[10px] lg:text-sm text-muted-foreground font-medium">
                            Control omnicanal con IA híbrida.
                        </p>
                        <div className="hidden lg:block h-4 w-px bg-border mx-2" />
                        <div className="flex items-center gap-2 opacity-80">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Powered by</span>
                            <img
                                src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                                alt="MiWibi"
                                className="h-3.5 object-contain brightness-0 opacity-75"
                            />
                        </div>
                        <div className={clsx(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-widest w-fit",
                            settings.whatsapp.status === 'connected'
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                                : settings.whatsapp.status === 'error'
                                    ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                                    : "border-amber-500/20 bg-amber-500/10 text-amber-500"
                        )}>
                            <MessageCircle className="w-3 h-3" />
                            {settings.whatsapp.status === 'connected'
                                ? `WhatsApp listo${settings.whatsapp.displayPhoneNumber ? ` · ${settings.whatsapp.displayPhoneNumber}` : ''}`
                                : settings.whatsapp.status === 'error'
                                    ? 'WhatsApp con error'
                                    : 'WhatsApp pendiente'}
                        </div>
                    </div>
                </div>

                <div className="flex bg-card p-1 lg:p-1.5 rounded-2xl border border-border/40 overflow-x-auto scrollbar-hide">
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
                                "flex items-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                activeTab === tab.id ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
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
                    "px-8 py-3 rounded-2xl flex items-center justify-between group animate-in slide-in-from-top-4 duration-500 border",
                    activeAlert.type === 'sale' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
                )}>
                    <div className="flex items-center gap-4">
                        <div className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            activeAlert.type === 'sale' ? "bg-emerald-500/20" : "bg-rose-500/20"
                        )}>
                            {activeAlert.type === 'sale' ? (
                                <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
                            ) : (
                                <BellRing className="w-4 h-4 text-rose-500 animate-pulse" />
                            )}
                        </div>
                        <p className="text-[11px] font-bold text-foreground/90">
                            <span className={clsx(
                                "font-black mr-2 uppercase tracking-widest text-[9px]",
                                activeAlert.type === 'sale' ? "text-emerald-500" : "text-rose-500"
                            )}>
                                {activeAlert.type === 'sale' ? 'Oportunidad:' : 'Atención:'}
                            </span>
                            {activeAlert.type === 'sale' ? (
                                <>MiWi ha detectado una intención de <span className="text-emerald-500 font-black italic">Venta de Alto Valor</span> en el chat activo</>
                            ) : (
                                <>MiWi requiere <span className="text-foreground font-black">intervención humana</span> en el chat activo</>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setActiveAlert({ ...activeAlert, visible: false })}
                            className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Ignorar
                        </button>
                        <button
                            onClick={() => { setActiveAlert({ ...activeAlert, visible: false }); setActiveTab('monitor'); }}
                            className={clsx(
                                "text-white font-black px-6 py-2 rounded-xl text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg",
                                activeAlert.type === 'sale' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-500 shadow-rose-500/20"
                            )}
                        >
                            {activeAlert.type === 'sale' ? 'Cerrar Venta' : 'Intervenir'}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Area — fills remaining height after header/tabs */}
            <div className="bg-card border border-border/40 lg:rounded-[3rem] overflow-hidden shadow-2xl flex-1 min-h-0 flex relative">

                {activeTab === 'monitor' && (
                    <React.Fragment>
                        {/* Chat Sidebar */}
                        <div className={clsx(
                            "w-full lg:w-80 border-r border-border/40 flex flex-col bg-card lg:bg-muted/5 transition-all duration-300",
                            selectedChat && "hidden lg:flex"
                        )}>
                            <div className="p-6 lg:p-8 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-muted-foreground/50">Conversaciones</h3>
                                    <div className="px-2 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                                        <span className="text-[8px] font-black text-emerald-500 uppercase">Online</span>
                                    </div>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        className="w-full bg-muted/20 border border-border/40 rounded-xl pl-10 pr-4 py-2.5 lg:py-3 text-[11px] lg:text-xs outline-none focus:border-primary/50 text-foreground transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto divide-y divide-border/10 custom-scrollbar">
                                {liveConversations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/30 flex items-center justify-center">
                                            <Globe className="w-5 h-5 text-muted-foreground/30" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Sin conversaciones aún</p>
                                        <p className="text-[9px] text-muted-foreground/30 font-medium">Los chats del widget web aparecerán aquí en tiempo real</p>
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
                                                "p-5 lg:p-6 cursor-pointer transition-all hover:bg-muted/10 relative group",
                                                isSelected ? "bg-primary/[0.03]" : ""
                                            )}
                                        >
                                            {isSelected && <div className="absolute left-0 top-0 w-1 h-full bg-primary"></div>}
                                            <div className="flex gap-4">
                                                <div className="relative shrink-0">
                                                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-[10px] lg:text-xs text-primary uppercase">
                                                        {(conv.lead.name || 'W')[0].toUpperCase()}
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full"></div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p className="text-xs lg:text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">{conv.lead.name || 'Lead Web'}</p>
                                                        <span className="text-[8px] lg:text-[9px] font-bold text-muted-foreground uppercase shrink-0 ml-2">{timeAgo}</span>
                                                    </div>
                                                    {conv.lead.company && <p className="text-[9px] text-muted-foreground/60 font-bold truncate mb-1">{conv.lead.company}{conv.lead.city ? ` · ${conv.lead.city}` : ''}</p>}
                                                    <p className="text-[10px] lg:text-[11px] text-muted-foreground truncate font-medium">{lastMsg?.content?.slice(0, 60) || '...'}</p>
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <div className="px-2 py-0.5 rounded-md border text-[7px] lg:text-[8px] font-black uppercase tracking-tighter text-sky-500 border-sky-500/20 bg-sky-500/5">
                                                            Web Chat
                                                        </div>
                                                        <span className="text-[7px] font-bold text-muted-foreground/40">{conv.messages.length} msgs</span>
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
                            "flex-1 flex flex-col bg-card duration-300",
                            !selectedConversation && "hidden lg:flex"
                        )}>
                            {!selectedConversation ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                    <div className="w-24 h-24 rounded-[2.5rem] bg-muted/50 border border-border/40 flex items-center justify-center mb-6">
                                        <MessageCircle className="w-10 h-10 text-muted-foreground/20" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Selecciona un chat</h3>
                                    <p className="text-xs text-muted-foreground/40 mt-2">Para comenzar a monitorear en tiempo real</p>
                                </div>
                            ) : (
                                <React.Fragment>
                                    {/* Chat header */}
                                    <div className="h-20 border-b border-border/40 px-6 lg:px-8 flex items-center justify-between bg-card shrink-0">
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => setSelectedConversation(null)} className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-xl transition-colors">
                                                <ChevronRight className="w-5 h-5 rotate-180" />
                                            </button>
                                            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] lg:text-xs border border-primary/20 shrink-0">
                                                {(selectedConversation.lead.name || 'W')[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs lg:text-sm font-black text-foreground tracking-tight truncate">{selectedConversation.lead.name || 'Lead Web'}</p>
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Web Chat · En vivo</span>
                                                    </div>
                                                    {selectedConversation.lead.city && <span className="text-[8px] text-muted-foreground/50 font-bold">{selectedConversation.lead.city}</span>}
                                                    {selectedConversation.lead.company && <span className="text-[8px] text-muted-foreground/50 font-bold">{selectedConversation.lead.company}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedConversation.lead.phone && (
                                                <a href={`https://wa.me/${selectedConversation.lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                                                    className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 hover:bg-emerald-500/20 transition-all shrink-0">
                                                    <Phone className="w-4 h-4" />
                                                </a>
                                            )}
                                            {selectedConversation.lead.email && (
                                                <a href={`mailto:${selectedConversation.lead.email}`}
                                                    className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-500 hover:bg-sky-500/20 transition-all shrink-0">
                                                    <Mail className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lead info bar */}
                                    <div className="px-6 py-3 bg-muted/10 border-b border-border/30 flex items-center gap-4 flex-wrap">
                                        {selectedConversation.lead.email && (
                                            <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                                                <Mail className="w-3 h-3" />{selectedConversation.lead.email}
                                            </span>
                                        )}
                                        {selectedConversation.lead.phone && (
                                            <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                                                <Phone className="w-3 h-3" />{selectedConversation.lead.phone}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold text-muted-foreground ml-auto">
                                            {selectedConversation.messages.length} mensajes · {new Date(selectedConversation.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                    </div>

                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-4 custom-scrollbar bg-background/30">
                                        {selectedConversation.messages.map((msg, i) => (
                                            <div key={i} className={clsx("flex gap-3", msg.role === 'assistant' ? 'flex-row-reverse' : '')}>
                                                <div className={clsx(
                                                    "w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black",
                                                    msg.role === 'assistant' ? 'bg-primary text-black' : 'bg-muted border border-border text-muted-foreground'
                                                )}>
                                                    {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                </div>
                                                <div className={clsx(
                                                    "max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                                                    msg.role === 'assistant'
                                                        ? 'bg-primary/10 border border-primary/20 text-foreground rounded-tr-none'
                                                        : 'bg-card border border-border text-foreground rounded-tl-none'
                                                )}>
                                                    <p className="font-medium">{msg.content}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground/50 mt-1 uppercase tracking-wider">
                                                        {msg.role === 'assistant' ? 'Bot' : selectedConversation.lead.name || 'Lead'} · {new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>

                                    <div className="p-4 lg:p-5 bg-card border-t border-border/40 relative shrink-0">
                                        {/* Attachment Menu Overlay */}
                                        {isAttachmentMenuOpen && (
                                            <div className="absolute bottom-full mb-4 left-6 lg:left-8 bg-card border border-border/40 rounded-[2rem] p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 z-50 w-[calc(100%-3rem)] lg:w-64">
                                                <div className="grid grid-cols-1 lg:grid-cols-1 gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setIsQuoteModalOpen(true);
                                                            setIsAttachmentMenuOpen(false);
                                                        }}
                                                        className="flex items-center gap-4 p-4 hover:bg-muted/50 rounded-2xl transition-all group"
                                                    >
                                                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                                                            <FilePlus className="w-5 h-5 text-primary" />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[11px] font-black text-foreground">Cotización</p>
                                                            <p className="text-[9px] text-muted-foreground font-bold">Generar PDF</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsProductModalOpen(true);
                                                            setIsAttachmentMenuOpen(false);
                                                        }}
                                                        className="flex items-center gap-4 p-4 hover:bg-muted/50 rounded-2xl transition-all group"
                                                    >
                                                        <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center border border-sky-500/20 group-hover:scale-110 transition-transform">
                                                            <Package className="w-5 h-5 text-sky-500" />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[11px] font-black text-foreground">Productos</p>
                                                            <p className="text-[9px] text-muted-foreground font-bold">Enviar ficha</p>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-muted/20 border-2 border-border/40 rounded-2xl lg:rounded-[1.5rem] p-2 lg:p-3 flex items-center gap-2 lg:gap-3 focus-within:border-primary/50 transition-all">
                                            <button
                                                onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                                                className={clsx(
                                                    "p-2.5 lg:p-3 rounded-xl transition-all",
                                                    isAttachmentMenuOpen ? "bg-primary text-black" : "hover:bg-muted text-muted-foreground/40"
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
                                                className="flex-1 bg-transparent border-none outline-none text-xs lg:text-sm px-1 lg:px-2 font-bold text-foreground placeholder:text-muted-foreground/30"
                                            />
                                            <button
                                                onClick={sendHumanReply}
                                                disabled={!replyText.trim() || isSendingReply}
                                                className="bg-primary text-black p-3.5 lg:p-4 rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary/10 disabled:opacity-40 disabled:hover:scale-100"
                                            >
                                                <Send className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </React.Fragment>
                            )}
                        </div>

                        {/* Product Catalog Panel — right column (desktop only) */}
                        <div className="hidden xl:flex w-64 border-l border-border/40 flex-col bg-muted/5 shrink-0">
                            <div className="p-4 border-b border-border/40 space-y-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Catálogo de Productos</p>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchProduct}
                                        onChange={e => setSearchProduct(e.target.value)}
                                        className="w-full bg-card border border-border/40 rounded-xl pl-9 pr-3 py-2 text-[11px] outline-none focus:border-primary/50 text-foreground transition-all"
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
                                            <div key={p.id} className="bg-card border border-border/40 rounded-xl p-3 hover:border-primary/30 transition-colors group">
                                                <div className="flex items-start gap-2">
                                                    {p.image ? (
                                                        <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0 border border-border/30" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border/30 flex items-center justify-center shrink-0">
                                                            <Package className="w-4 h-4 text-muted-foreground/30" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-foreground leading-tight line-clamp-2">{p.name}</p>
                                                        <p className="text-[10px] text-primary font-black mt-0.5">{fmtPrice}</p>
                                                        {p.sku && <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{p.sku}</p>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        try { await navigator.clipboard.writeText(copyText); } catch { /* ignore */ }
                                                        setReplyText(prev => prev ? `${prev}\n${copyText}` : copyText);
                                                        addNotification({ title: 'Producto copiado', description: p.name, type: 'success' });
                                                    }}
                                                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/30 hover:border-primary/30 transition-all text-[9px] font-black uppercase tracking-wider text-muted-foreground"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                    Copiar al chat
                                                </button>
                                            </div>
                                        );
                                    })}
                                {products.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                                        <Package className="w-8 h-8 text-muted-foreground/20" />
                                        <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">Sin productos sincronizados</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </React.Fragment>
                )}

                {activeTab === 'programming' && (
                    <div className="flex-1 p-16 space-y-12 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div>
                                <h2 className="text-3xl font-black text-foreground tracking-tighter flex items-center gap-3">
                                    <BrainCircuit className="w-8 h-8 text-primary" />
                                    Entrenamiento de MiWi
                                </h2>
                                <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-2">Configura la lógica, el conocimiento y la voz de tu IA</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-primary/5 rounded-3xl border border-primary/20 flex items-center gap-4 h-fit">
                                    <div className="relative">
                                        <Circle className="w-12 h-12 text-muted-foreground/10" strokeWidth={4} />
                                        <Circle
                                            className="w-12 h-12 text-primary absolute top-0 left-0 -rotate-90"
                                            strokeWidth={4}
                                            strokeDasharray="100"
                                            strokeDashoffset={scoreStroke}
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{trainingScore}%</span>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-primary">Score de Entrenamiento</p>
                                        <p className="text-xs font-black text-foreground">Nivel: {trainingLevel}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveBotConfig}
                                    className="bg-primary text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(250,181,16,0.2)] disabled:opacity-60 disabled:hover:scale-100"
                                    disabled={isSavingConfig}
                                >
                                    <Save className="w-4 h-4" />
                                    <span className="text-[10px] uppercase tracking-widest">{isSavingConfig ? 'Guardando...' : 'Guardar Todo'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            {/* Structured Knowledge Section */}
                            <div className="lg:col-span-2 space-y-8">
                                <div className="p-10 bg-muted/10 border border-border rounded-[2.5rem] space-y-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                                <Wand2 className="w-6 h-6 text-primary" />
                                            </div>
                                            <h3 className="text-xl font-black text-foreground">Base de Datos de Negocio</h3>
                                        </div>
                                        <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Prioridad Alta</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-primary">
                                                <Clock className="w-4 h-4" />
                                                <label className="text-[10px] font-black uppercase tracking-widest">Tiempos de Entrega</label>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Ej: 10 a 15 días hábiles"
                                                className="w-full bg-muted/10 border border-border/40 rounded-2xl p-5 text-sm font-bold text-foreground outline-none focus:border-primary/50 transition-all"
                                                value={deliveryTimes}
                                                onChange={(e) => setDeliveryTimes(e.target.value)}
                                            />
                                            <p className="text-[9px] text-muted-foreground/50 font-medium italic">MiWi mencionará este dato al preguntar sobre disponibilidad.</p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-primary">
                                                <Truck className="w-4 h-4" />
                                                <label className="text-[10px] font-black uppercase tracking-widest">Costo de Envío</label>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Ej: Gratis en Bogotá, resto del país contraentrega"
                                                className="w-full bg-muted/10 border border-border/40 rounded-2xl p-5 text-sm font-bold text-foreground outline-none focus:border-primary/50 transition-all"
                                                value={shippingCost}
                                                onChange={(e) => setShippingCost(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-primary">
                                                <MapPin className="w-4 h-4" />
                                                <label className="text-[10px] font-black uppercase tracking-widest">Zona de Cobertura</label>
                                            </div>
                                            <textarea
                                                placeholder="Ej: Toda Colombia, especializado en zonas urbanas."
                                                className="w-full bg-muted/10 border border-border/40 rounded-2xl p-5 text-sm font-bold text-foreground outline-none focus:border-primary/50 transition-all h-32"
                                                value={coverageArea}
                                                onChange={(e) => setCoverageArea(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-primary">
                                                <HelpCircle className="w-4 h-4" />
                                                <label className="text-[10px] font-black uppercase tracking-widest">Preguntas Frecuentes (FAQ)</label>
                                            </div>
                                            <div className="space-y-3">
                                                {faqs.map((faq, index) => (
                                                    <div key={`faq-${index}`} className="flex items-center gap-3">
                                                        <input
                                                            type="text"
                                                            value={faq}
                                                            onChange={(e) => updateFaq(index, e.target.value)}
                                                            placeholder={`FAQ ${index + 1}`}
                                                            className="w-full p-4 bg-muted/10 border border-border/40 rounded-xl text-[11px] font-bold text-foreground outline-none focus:border-primary/50 transition-colors"
                                                        />
                                                        <button
                                                            onClick={() => removeFaq(index)}
                                                            className="p-3 rounded-xl border border-border/40 text-muted-foreground hover:text-rose-500 hover:border-rose-500/30 transition-all"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={addFaq}
                                                    className="w-full p-4 text-primary text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-primary/10 rounded-xl hover:bg-primary/5 transition-all"
                                                >
                                                    <Zap className="w-3 h-3" /> Añadir Nueva FAQ
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-primary tracking-[0.3em] pl-6 h-fit">Instrucciones Maestras (System Prompt)</label>
                                    <div className="relative group">
                                        <textarea
                                            className="w-full h-80 bg-muted/10 border border-border rounded-[2.5rem] p-10 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground leading-relaxed custom-scrollbar"
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                        />
                                        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-3 bg-primary text-black rounded-xl shadow-lg hover:scale-110 transition-all">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Config / Protocol */}
                            <div className="space-y-10">
                                <div className="p-10 bg-muted/10 border border-border rounded-[2.5rem] space-y-8">
                                    <div className="flex items-center gap-4 mb-2">
                                        <Shield className="w-5 h-5 text-primary" />
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Escalamiento Humano</h4>
                                    </div>
                                    <div className="space-y-6">
                                        {[
                                            { id: 'largeSale', label: 'Alertar por "Venta Grande"', active: escalationRules.largeSale },
                                            { id: 'anger', label: 'Pasar a Humano por Enojo', active: escalationRules.anger },
                                            { id: 'unknownAnswer', label: 'Pedir ayuda si no sé la respuesta', active: escalationRules.unknownAnswer },
                                            { id: 'catalogOnly', label: 'Modo Solo Catalogo (No IA)', active: escalationRules.catalogOnly },
                                        ].map((cap) => (
                                            <div key={cap.id} className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-muted-foreground">{cap.label}</span>
                                                <button
                                                    onClick={() => toggleEscalationRule(cap.id as keyof typeof escalationRules)}
                                                    className={clsx(
                                                    "w-10 h-5 rounded-full relative transition-all",
                                                    cap.active ? "bg-primary" : "bg-muted-foreground/10"
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

                                <div className="p-10 bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/20 rounded-[2.5rem] space-y-6">
                                    <div className="flex items-center gap-4 text-rose-500">
                                        <AlertTriangle className="w-6 h-6" />
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Protocolo de Crisis</h4>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground font-bold leading-relaxed italic">
                                        "Si el bot detecta reclamaciones o términos legales, MiWi detendrá sus respuestas y te enviará un alerta roja inmediata."
                                    </p>
                                    <button className="w-full py-4 border border-rose-500/20 rounded-2xl text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500 hover:text-white transition-all">
                                        Configurar Palabras Prohibidas
                                    </button>
                                </div>

                                <div className="p-10 bg-muted/10 border border-border rounded-[2.5rem] space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Estado del Aprendizaje</h4>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-1.5 w-full bg-muted/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${trainingScore}%` }} />
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-muted-foreground/40">
                                            <span>Modelo Entrenado</span>
                                            <span>{trainingScore}% completitud</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'capture' && (
                    <div className="flex-1 p-6 lg:p-8 space-y-6 lg:space-y-8 flex flex-col items-center overflow-y-auto custom-scrollbar">
                        <div className="text-center space-y-2 max-w-2xl">
                            <Shield className="w-9 h-9 lg:w-11 lg:h-11 text-primary mx-auto mb-2" />
                            <h2 className="text-xl lg:text-3xl font-black text-foreground tracking-tighter uppercase italic">Formulario de Pre-Chat</h2>
                            <p className="text-[11px] lg:text-sm text-muted-foreground font-bold leading-relaxed">
                                Captura los datos del cliente automáticamente antes de iniciar la conversación con MiWi. Esto garantiza que todos los contactos se registren como Leads.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 w-full max-w-5xl items-start">
                            <div className="space-y-4">
                                <h3 className="text-[10px] lg:text-xs font-black uppercase text-primary tracking-[0.3em] pl-4 border-l-4 border-primary">Campos del Chatbot</h3>
                                <div className="space-y-2">
                                    {Object.entries(captureFields).map(([key, val]) => (
                                        <div
                                            key={key}
                                            onClick={() => toggleField(key as any)}
                                            className={clsx(
                                                "flex items-center justify-between p-4 lg:p-4.5 rounded-2xl border cursor-pointer transition-all",
                                                val ? "bg-primary/10 border-primary/40 text-foreground" : "bg-muted/10 border-border/40 text-muted-foreground opacity-20"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                {val ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5" />}
                                                <span className="text-[11px] lg:text-[13px] font-black uppercase tracking-[0.14em]">{key === 'name' ? 'Nombre Completo' : key === 'email' ? 'Correo Electrónico' : key === 'phone' ? 'WhatsApp' : key === 'city' ? 'Ciudad' : 'Empresa'}</span>
                                            </div>
                                            <span className="text-[8px] lg:text-[9px] font-black opacity-40 uppercase">{val ? 'Requerido' : 'Off'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[10px] lg:text-xs font-black uppercase text-muted-foreground/30 tracking-[0.3em] pl-4 border-l-4 border-border">Preview del Saludo</h3>
                                <div className="bg-card border border-border/60 rounded-[2.2rem] p-5 lg:p-6 shadow-xl space-y-5 relative overflow-hidden">
                                    <div className="space-y-3">
                                        <div className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                                            <Bot className="w-6 h-6 text-black animate-pulse" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm lg:text-base font-black text-foreground tracking-tighter uppercase italic">MiWi AI Bot</h4>
                                            <p className="text-[10px] lg:text-[11px] text-muted-foreground font-bold leading-relaxed mt-1">¡Hola! Para brindarte una mejor atención, por favor déjanos tus datos básicos antes de empezar.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {Object.entries(captureFields).filter(([_, v]) => v).map(([k]) => (
                                            <div key={k} className="h-11 bg-muted/20 border border-border/40 rounded-xl px-4 flex items-center border-dashed">
                                                <span className="text-[9px] lg:text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.12em]">{k === 'name' ? 'Escribe tu nombre' : k === 'email' ? 'Tu correo electrónico' : k === 'phone' ? 'Tu WhatsApp' : k === 'city' ? 'Tu ciudad' : 'Completar campo'}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full bg-primary text-black font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                                        Iniciar Conversación
                                    </button>
                                    <button
                                        onClick={handleSaveBotConfig}
                                        className="w-full bg-card border border-border/40 text-foreground font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-muted/20 transition-all disabled:opacity-60"
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
                    <div className="flex-1 p-20 space-y-16 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col md:flex-row gap-16 items-center">
                            <div className="flex-1 space-y-8">
                                <h2 className="text-5xl font-black text-foreground tracking-tighter">Lleva a MiWi a cualquier lugar.</h2>
                                <p className="text-xl text-muted-foreground font-bold leading-relaxed">
                                    Copia este fragmento de código y pégalo antes de la etiqueta <code className="text-primary font-mono">&lt;/body&gt;</code> de tu sitio web o landing page.
                                </p>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 text-emerald-500">
                                        <Zap className="w-6 h-6" />
                                        <span className="text-xs font-black uppercase tracking-widest">Instalación en 1 minuto</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 w-full space-y-6">
                                <div className="bg-card border border-border rounded-[2.5rem] p-10 relative group">
                                    <div className="absolute top-6 right-6 flex gap-2">
                                        <button
                                            onClick={copyWidgetSnippet}
                                            className="p-3 bg-muted/10 rounded-xl border border-border transition-all text-muted-foreground/40 hover:text-foreground"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={shareWidgetSnippet}
                                            className="p-3 bg-muted/10 rounded-xl border border-border transition-all text-muted-foreground/40 hover:text-foreground"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <pre className="text-xs font-mono text-primary/80 leading-relaxed overflow-x-auto pt-10">
                                        {widgetSnippet}
                                    </pre>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-6 bg-muted/10 border border-border/50 rounded-3xl flex flex-col gap-3">
                                        <Code className="text-primary w-8 h-8" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Bot Name</p>
                                        <input
                                            type="text"
                                            value={widgetConfig.botName}
                                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, botName: e.target.value }))}
                                            className="bg-transparent border border-border/40 rounded-xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:border-primary/50"
                                        />
                                    </div>
                                    <div className="p-6 bg-muted/10 border border-border/50 rounded-3xl flex flex-col gap-3">
                                        <Key className="text-primary w-8 h-8" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground">API Key</p>
                                        <input
                                            type="text"
                                            value={widgetConfig.apiKey}
                                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                            className="bg-transparent border border-border/40 rounded-xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:border-primary/50"
                                        />
                                    </div>
                                    <div className="p-6 bg-muted/10 border border-border/50 rounded-3xl flex flex-col gap-3">
                                        <Globe className="text-sky-500 w-8 h-8" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Dominio Autorizado</p>
                                        <input
                                            type="text"
                                            value={widgetConfig.authorizedDomain}
                                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, authorizedDomain: e.target.value }))}
                                            className="bg-transparent border border-border/40 rounded-xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:border-primary/50"
                                        />
                                    </div>
                                    <div className="p-6 bg-muted/10 border border-border/50 rounded-3xl flex flex-col gap-3">
                                        <MessageCircle className="text-emerald-500 w-8 h-8" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground">WhatsApp Sync</p>
                                        <button
                                            onClick={() => setWidgetConfig(prev => ({ ...prev, whatsappSync: !prev.whatsappSync }))}
                                            className={clsx(
                                                "w-fit px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                widgetConfig.whatsappSync ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-muted/20 text-muted-foreground border border-border/40"
                                            )}
                                        >
                                            {widgetConfig.whatsappSync ? 'Activo' : 'Inactivo'}
                                        </button>
                                        <p className="text-xs font-bold text-muted-foreground">
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
                                        className="bg-primary text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-60 disabled:hover:scale-100"
                                        disabled={isSavingConfig}
                                    >
                                        <Save className="w-4 h-4" />
                                        <span className="text-[10px] uppercase tracking-widest">{isSavingConfig ? 'Guardando...' : 'Guardar Widget'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Product Picker Modal */}
            {
                isProductModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <div
                            className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300"
                            onClick={() => setIsProductModalOpen(false)}
                        />
                        <div className="relative w-full max-w-4xl bg-card border border-border rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[600px] animate-in zoom-in-95 duration-300">
                            {/* Tab Switcher */}
                            <div className="flex px-8 border-b border-border bg-muted/10">
                                <button
                                    onClick={() => setModalTab('products')}
                                    className={clsx(
                                        "px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                                        modalTab === 'products' ? "text-primary" : "text-muted-foreground/30 hover:text-foreground"
                                    )}
                                >
                                    Productos Individuales
                                    {modalTab === 'products' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_-2px_10px_rgba(250,181,16,0.5)]" />}
                                </button>
                                <button
                                    onClick={() => setModalTab('combos')}
                                    className={clsx(
                                        "px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative flex items-center gap-2",
                                        modalTab === 'combos' ? "text-primary" : "text-muted-foreground/30 hover:text-foreground"
                                    )}
                                >
                                    <Zap className="w-3 h-3" />
                                    Combos / Paquetes
                                    {modalTab === 'combos' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_-2px_10px_rgba(250,181,16,0.5)]" />}
                                </button>
                                <button
                                    onClick={() => setModalTab('quotes')}
                                    className={clsx(
                                        "px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative flex items-center gap-2",
                                        modalTab === 'quotes' ? "text-primary" : "text-muted-foreground/30 hover:text-foreground"
                                    )}
                                >
                                    <FileText className="w-3 h-3" />
                                    Cotizaciones PDF
                                    {modalTab === 'quotes' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_-2px_10px_rgba(250,181,16,0.5)]" />}
                                </button>
                            </div>

                            {/* Search & Statistics */}
                            <div className="p-8 border-b border-white/5 bg-white/[0.01] grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                    <input
                                        type="text"
                                        placeholder="Buscar producto por nombre o categoría..."
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all"
                                        value={searchProduct}
                                        onChange={(e) => setSearchProduct(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-3">
                                    <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                        <span className="text-[10px] font-black text-emerald-500 uppercase">Stock Actual: 154 Items</span>
                                    </div>
                                    <button className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/40 hover:text-white">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* List Content */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {modalTab === 'products' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                        "group p-6 rounded-[2rem] border transition-all cursor-pointer flex gap-6 relative",
                                                        selectedProducts.includes(product.id)
                                                            ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(250,181,16,0.1)]"
                                                            : "bg-white/[0.02] border-white/5 hover:border-primary/30"
                                                    )}
                                                >
                                                    {/* Selection Checkbox */}
                                                    <div className={clsx(
                                                        "absolute top-4 right-4 w-6 h-6 rounded-lg border flex items-center justify-center transition-all",
                                                        selectedProducts.includes(product.id)
                                                            ? "bg-primary border-primary text-black"
                                                            : "bg-white/5 border-white/10 text-transparent"
                                                    )}>
                                                        <Check className="w-4 h-4" strokeWidth={4} />
                                                    </div>

                                                    <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-white/5 group-hover:scale-105 transition-transform">
                                                        <img src={product.image || 'https://images.unsplash.com/photo-1594913366159-1832ebbee3f4?w=800&h=800&fit=crop'} alt={product.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 flex flex-col justify-between py-1">
                                                        <div>
                                                            <span className="text-[9px] font-black text-primary uppercase tracking-widest block mb-1">{product.category}</span>
                                                            <h4 className="text-sm font-black text-white mb-1">{product.name}</h4>
                                                            <p className="text-[10px] font-bold text-white/40 leading-tight line-clamp-2">{product.shortDescription}</p>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-4">
                                                            <span className="text-sm font-black text-white">${product.price.toLocaleString()}</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    addNotification({ title: 'Enviando al chat', description: `Producto "${product.name}" enviado al bot.`, type: 'success' });
                                                                    setIsProductModalOpen(false);
                                                                    setIsAttachmentMenuOpen(false);
                                                                    setSelectedProducts([]);
                                                                }}
                                                                className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                                                            >
                                                                Enviar Solo Este
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                ) : modalTab === 'combos' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {combos.map(combo => (
                                            <div
                                                key={combo.id}
                                                className="group bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-primary/50 transition-all flex flex-col"
                                            >
                                                <div className="h-41 relative overflow-hidden">
                                                    <img src={combo.img} alt={combo.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                    <div className="absolute top-4 left-4 bg-primary text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                                                        {combo.discount}
                                                    </div>
                                                </div>
                                                <div className="p-8 space-y-4">
                                                    <div>
                                                        <h4 className="text-xl font-black text-white">{combo.name}</h4>
                                                        <p className="text-xs text-white/40 font-bold mt-2 leading-relaxed">{combo.description}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                        <div>
                                                            <p className="text-[10px] text-rose-500 font-black line-through opacity-50">{combo.originalPrice}</p>
                                                            <p className="text-2xl font-black text-white">{combo.price}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                addNotification({ title: 'Combo enviado', description: `Combo "${combo.name}" enviado al bot.`, type: 'success' });
                                                                setIsProductModalOpen(false);
                                                                setIsAttachmentMenuOpen(false);
                                                            }}
                                                            className="bg-primary text-black px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_10px_20px_rgba(250,181,16,0.2)]"
                                                        >
                                                            Enviar Combo
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : quotes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                        <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Sin cotizaciones</p>
                                        <p className="text-xs text-muted-foreground/50 mt-1">Crea cotizaciones desde el módulo de Cotizaciones</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {quotes.map(q => (
                                            <div key={q.id} className="group p-6 bg-white/[0.02] border border-white/10 rounded-2xl hover:border-primary/50 transition-all flex flex-col gap-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                                        <FileText className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${q.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/20 text-muted-foreground'}`}>{q.status}</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-foreground italic">Cot. #{q.id.slice(-6).toUpperCase()}</h4>
                                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">Cliente: {q.client || '—'}</p>
                                                </div>
                                                <div className="flex items-center justify-between pt-3 border-t border-border">
                                                    <span className="text-base font-black text-foreground">{q.total || '$0'}</span>
                                                    <button
                                                        onClick={() => {
                                                            addNotification({ title: 'Cotización enviada al chat', description: `Cot. #${q.id.slice(-6).toUpperCase()} enviada a ${selectedChat?.sender || 'cliente'}`, type: 'success' });
                                                            setIsProductModalOpen(false);
                                                            setIsAttachmentMenuOpen(false);
                                                        }}
                                                        className="bg-muted/10 border border-border px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
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
                            <div className="p-8 border-t border-border bg-muted/5 flex items-center justify-between">
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-muted-foreground/30 font-black uppercase tracking-[0.4em]">MiWi Intelligence Database System</span>
                                    {selectedProducts.length > 0 && (
                                        <span className="text-[10px] text-primary font-black uppercase mt-1">{selectedProducts.length} productos seleccionados</span>
                                    )}
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setSelectedProducts([])}
                                        className={clsx(
                                            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                            selectedProducts.length > 0 ? "text-rose-500 hover:bg-rose-500/10" : "text-muted-foreground/20 pointer-events-none"
                                        )}
                                    >
                                        Limpiar Selección
                                    </button>
                                    <button
                                        onClick={() => {
                                            addNotification({ title: 'Productos enviados', description: `${selectedProducts.length} productos enviados al bot.`, type: 'success' });
                                            setIsProductModalOpen(false);
                                            setIsAttachmentMenuOpen(false);
                                            setSelectedProducts([]);
                                        }}
                                        className={clsx(
                                            "px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl",
                                            selectedProducts.length > 0
                                                ? "bg-primary text-black shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                                                : "bg-muted/10 text-muted-foreground/20 pointer-events-none"
                                        )}
                                    >
                                        {selectedProducts.length > 0 ? `Enviar Selección (${selectedProducts.length})` : 'Selecciona productos'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Quotation Modal */}
            {
                isQuoteModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <div
                            className="absolute inset-0 bg-background/90 backdrop-blur-2xl animate-in fade-in duration-500"
                            onClick={() => !isGeneratingQuote && setIsQuoteModalOpen(false)}
                        />

                        <div className="relative w-full max-w-5xl bg-card border border-border rounded-[4rem] shadow-2xl overflow-hidden flex flex-col h-[800px] animate-in zoom-in-95 duration-500">
                            {/* Modal Header */}
                            <div className="p-10 border-b border-border flex items-center justify-between bg-muted/5">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-[2rem] bg-primary/20 flex items-center justify-center border border-primary/30">
                                        <FilePlus className="w-8 h-8 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-foreground tracking-tighter">Generador de Inteligencia de Cotización</h3>
                                        <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em]">Convierte este chat en un Lead y una Propuesta Formal</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsQuoteModalOpen(false)}
                                    className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-rose-500 text-white transition-all shadow-xl"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden flex">
                                {/* Left: Client Info & Items */}
                                <div className="flex-1 p-12 overflow-y-auto custom-scrollbar space-y-12">
                                    <div className="space-y-8">
                                        <h4 className="text-xs font-black uppercase text-muted-foreground tracking-[0.3em] flex items-center gap-3">
                                            <User className="w-4 h-4" /> Información del Prospecto (Lead)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-primary tracking-widest ml-4">Nombre Completo</label>
                                                <input
                                                    type="text"
                                                    value={quoteForm.clientName}
                                                    onChange={(e) => setQuoteForm({ ...quoteForm, clientName: e.target.value })}
                                                    className="w-full bg-muted/10 border border-border rounded-2xl p-5 text-sm font-bold text-foreground focus:border-primary transition-all outline-none"
                                                    placeholder="Ej: Juan Perez"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-primary tracking-widest ml-4">Empresa / Proyecto</label>
                                                <input
                                                    type="text"
                                                    value={quoteForm.clientCompany}
                                                    onChange={(e) => setQuoteForm({ ...quoteForm, clientCompany: e.target.value })}
                                                    className="w-full bg-muted/10 border border-border rounded-2xl p-5 text-sm font-bold text-foreground focus:border-primary transition-all outline-none"
                                                    placeholder="Ej: Constructora Capital"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-primary tracking-widest ml-4">WhatsApp / Celular</label>
                                                <input
                                                    type="text"
                                                    value={quoteForm.clientPhone}
                                                    onChange={(e) => setQuoteForm({ ...quoteForm, clientPhone: e.target.value })}
                                                    className="w-full bg-muted/10 border border-border rounded-2xl p-5 text-sm font-bold text-foreground focus:border-primary transition-all outline-none"
                                                    placeholder="+57 321..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-primary tracking-widest ml-4">Correo Electrónico</label>
                                                <input
                                                    type="email"
                                                    value={quoteForm.clientEmail}
                                                    onChange={(e) => setQuoteForm({ ...quoteForm, clientEmail: e.target.value })}
                                                    className="w-full bg-muted/10 border border-border rounded-2xl p-5 text-sm font-bold text-foreground focus:border-primary transition-all outline-none"
                                                    placeholder="nombre@email.com"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black uppercase text-muted-foreground/40 tracking-[0.3em] flex items-center gap-3">
                                                <Package className="w-4 h-4" /> Productos a Cotizar
                                            </h4>
                                            <button
                                                onClick={() => { setIsQuoteModalOpen(false); setIsProductModalOpen(true); }}
                                                className="text-[10px] font-black uppercase text-primary hover:underline"
                                            >
                                                + Explorar Catálogo
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {products.slice(0, 2).map(product => (
                                                <div key={product.id} className="p-6 bg-muted/5 border border-border/50 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all">
                                                    <div className="flex items-center gap-6">
                                                        <img src={product.image || 'https://images.unsplash.com/photo-1594913366159-1832ebbee3f4?w=800&h=800&fit=crop'} className="w-16 h-16 rounded-xl object-cover border border-border/10" />
                                                        <div>
                                                            <p className="text-sm font-black text-foreground">{product.name}</p>
                                                            <p className="text-xs font-bold text-primary">${product.price.toLocaleString()} / Un.</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-8">
                                                        <div className="flex items-center gap-4 bg-background/40 p-2 rounded-xl border border-border/50">
                                                            <button className="w-8 h-8 rounded-lg bg-muted/20 hover:bg-muted/30 text-foreground font-black">-</button>
                                                            <span className="text-sm font-black text-foreground w-4 text-center">1</span>
                                                            <button className="w-8 h-8 rounded-lg bg-muted/20 hover:bg-muted/30 text-foreground font-black">+</button>
                                                        </div>
                                                        <button className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Summary & Action */}
                                <div className="w-[400px] bg-white/[0.01] border-l border-white/5 p-12 flex flex-col justify-between">
                                    <div className="space-y-10">
                                        <h4 className="text-xs font-black uppercase text-white/40 tracking-[0.3em]">Resumen de la Propuesta</h4>

                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground/40 font-bold uppercase tracking-widest text-[10px]">Subtotal Bruto</span>
                                                <span className="font-black text-foreground">$570.000</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground/40 font-bold uppercase tracking-widest text-[10px]">IVA (19%)</span>
                                                <span className="font-black text-foreground">$108.300</span>
                                            </div>
                                            <div className="h-px bg-border" />
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-primary font-black uppercase tracking-[0.2em] text-[10px] mb-1">Inversión Final</p>
                                                    <p className="text-4xl font-black text-foreground tracking-tighter">$678.300</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl space-y-3">
                                            <div className="flex items-center gap-2 text-emerald-500">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Sincronización Automática</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-bold leading-relaxed italic">
                                                Al generar esta cotización, el sistema creará automáticamente un Lead en "ArteConcreto Master CRM" y notificará al equipo comercial.
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
                                            "w-full h-24 rounded-[2.5rem] flex items-center justify-center gap-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group shadow-2xl",
                                            quoteSuccess ? "bg-emerald-500 text-white" : "bg-primary text-black hover:scale-[1.02] active:scale-[0.98]"
                                        )}
                                        disabled={isGeneratingQuote}
                                    >
                                        {isGeneratingQuote ? (
                                            <>
                                                <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                                                <span>Generando Propuesta...</span>
                                            </>
                                        ) : quoteSuccess ? (
                                            <>
                                                <CheckCircle2 className="w-8 h-8 animate-in zoom-in duration-300" />
                                                <span>¡Enviado con Éxito!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                                <span>Generar y Enviar</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── LEARNING MODE TAB ─────────────────────────────────── */}
                {activeTab === 'learning' && (
                    <div className="flex flex-col w-full h-full">
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-5 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <BrainCircuit className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-foreground">ConcreBOT · Modo Aprendizaje</h3>
                                    <p className="text-[10px] text-muted-foreground font-medium">Entrena al bot sobre productos, precios y procesos de venta</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">Modo Aprendizaje</span>
                                </div>
                                {learningMsgs.length > 0 && (
                                    <button
                                        onClick={() => { setLearningMsgs([]); setLearningStarted(false); persistLearning([]); }}
                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 transition-colors px-3 py-2 rounded-lg hover:bg-rose-500/5 border border-transparent hover:border-rose-200"
                                    >
                                        Borrar historial
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Chat area */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                            {learningMsgs.length === 0 && !learningStarted && (
                                <div className="flex flex-col items-center justify-center h-full gap-5 px-6">
                                    <div className="w-16 h-16 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <BrainCircuit className="w-8 h-8 text-primary" />
                                    </div>
                                    <div className="text-center max-w-sm">
                                        <h4 className="text-base font-black text-foreground mb-1">ConcreBOT quiere aprender</h4>
                                        <p className="text-[12px] text-muted-foreground leading-relaxed">Inicia una sesión y ConcreBOT comenzará a hacerte preguntas sobre productos, precios y procesos de venta. Lo que enseñes aquí se usará cuando chatee con clientes.</p>
                                    </div>
                                    <button
                                        onClick={startLearningSession}
                                        className="flex items-center gap-3 bg-primary text-black font-black px-8 py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                                    >
                                        <BrainCircuit className="w-5 h-5" />
                                        Iniciar Sesión de Aprendizaje
                                    </button>
                                </div>
                            )}

                            {learningMsgs.map(msg => (
                                <div key={msg.id} className={clsx('flex gap-3', msg.role === 'admin' ? 'flex-row-reverse' : 'flex-row')}>
                                    {/* Avatar */}
                                    <div className={clsx(
                                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-black',
                                        msg.role === 'bot' ? 'bg-primary/10 border border-primary/20 text-primary' : 'bg-foreground/10 border border-foreground/10 text-foreground'
                                    )}>
                                        {msg.role === 'bot' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                    </div>
                                    {/* Bubble */}
                                    <div className={clsx(
                                        'max-w-[75%] px-4 py-3 rounded-2xl text-[12px] leading-relaxed',
                                        msg.role === 'bot'
                                            ? 'bg-muted/60 border border-border/40 text-foreground rounded-tl-sm'
                                            : 'bg-primary text-black font-semibold rounded-tr-sm'
                                    )}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        <p className={clsx('text-[9px] mt-1.5', msg.role === 'bot' ? 'text-muted-foreground' : 'text-black/60')}>{msg.ts}</p>
                                    </div>
                                </div>
                            ))}

                            {isLearningTyping && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="px-4 py-3 bg-muted/60 border border-border/40 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            )}
                            <div ref={learningEndRef} />
                        </div>

                        {/* Knowledge stats */}
                        {learningMsgs.length > 0 && (
                            <div className="mx-6 mb-3 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                <p className="text-[10px] font-bold text-emerald-700">
                                    {Math.floor(learningMsgs.filter(m => m.role === 'admin').length)} respuestas guardadas · ConcreBOT está aprendiendo sobre ArteConcreto
                                </p>
                            </div>
                        )}

                        {/* Input */}
                        {(learningStarted || learningMsgs.length > 0) && (
                            <div className="px-6 pb-6">
                                <div className="flex items-end gap-3 bg-muted/30 border border-border/60 rounded-2xl p-3">
                                    <textarea
                                        value={learningInput}
                                        onChange={e => setLearningInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendLearningMessage(); } }}
                                        placeholder="Responde a ConcreBOT para enseñarle..."
                                        rows={2}
                                        className="flex-1 bg-transparent text-sm text-foreground resize-none outline-none placeholder:text-muted-foreground font-medium"
                                    />
                                    <button
                                        onClick={sendLearningMessage}
                                        disabled={!learningInput.trim() || isLearningTyping}
                                        className="bg-primary text-black p-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 shrink-0"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-2 text-center">Enter para enviar · Shift+Enter nueva línea</p>
                            </div>
                        )}
                    </div>
                )}
        </div>
    );
}
