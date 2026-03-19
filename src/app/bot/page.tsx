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

const chats: Message[] = [];

export default function MiWiBotPage() {
    const { products } = useApp();
    const [activeTab, setActiveTab] = useState<'monitor' | 'programming' | 'capture' | 'widget'>('monitor');
    const [selectedChat, setSelectedChat] = useState<Message | null>(null);
    const [isHumanInControl, setIsHumanInControl] = useState(false);
    const [activeAlert, setActiveAlert] = useState<{ type: 'help' | 'sale'; visible: boolean }>({ type: 'help', visible: false });

    const [captureFields, setCaptureFields] = useState({
        name: true,
        email: true,
        phone: true,
        city: true,
        company: true
    });

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
        // Simulate a "Needs Help" alert
        const helpTimer = setTimeout(() => setActiveAlert({ type: 'help', visible: true }), 5000);
        // Simulate a "Big Sale" alert
        const saleTimer = setTimeout(() => setActiveAlert({ type: 'sale', visible: true }), 15000);

        return () => {
            clearTimeout(helpTimer);
            clearTimeout(saleTimer);
        };
    }, []);

    useEffect(() => {
        if (activeAlert.visible) {
            const playSound = () => {
                const sounds = {
                    help: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Subtle message ping
                    sale: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'  // Success/Coin sound
                };
                const audio = new Audio(sounds[activeAlert.type as 'help' | 'sale']);
                audio.volume = activeAlert.type === 'sale' ? 0.5 : 0.3;
                audio.play().catch(err => console.log("Audio interaction required", err));
            };
            playSound();
        }
    }, [activeAlert.visible, activeAlert.type]);

    const toggleField = (field: keyof typeof captureFields) => {
        setCaptureFields(prev => ({ ...prev, [field]: !prev[field] }));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
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
                        <div className="flex items-center gap-2 opacity-60">
                            <span className="text-[8px] font-black uppercase tracking-widest">Powered by</span>
                            <img src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png" alt="MiWibi" className="h-2.5 object-contain opacity-80" />
                        </div>
                    </div>
                </div>

                <div className="flex bg-card p-1 lg:p-1.5 rounded-2xl border border-border/40 overflow-x-auto scrollbar-hide">
                    {[
                        { id: 'monitor', label: 'En vivo', icon: MonitorPlay },
                        { id: 'programming', label: 'Programación', icon: Cpu },
                        { id: 'capture', label: 'Pre-captura', icon: Shield },
                        { id: 'widget', label: 'Widget', icon: Code },
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
                                <>MiWi ha detectado una intención de <span className="text-emerald-500 font-black italic">Venta de Alto Valor</span> en Constructora Alpha</>
                            ) : (
                                <>MiWi requiere intervención humana en el chat de <span className="text-foreground font-black underline decoration-rose-500/30 underline-offset-4">Adriana Torres</span></>
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

            {/* Main Area */}
            <div className="bg-card border border-border/40 lg:rounded-[3rem] overflow-hidden shadow-2xl h-[calc(100vh-12rem)] lg:h-[700px] flex relative">

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
                                {chats.map((chat) => (
                                    <div
                                        key={chat.id}
                                        onClick={() => setSelectedChat(chat)}
                                        className={clsx(
                                            "p-5 lg:p-6 cursor-pointer transition-all hover:bg-muted/10 relative group",
                                            selectedChat?.id === chat.id ? "bg-primary/[0.03]" : ""
                                        )}
                                    >
                                        {selectedChat?.id === chat.id && <div className="absolute left-0 top-0 w-1 h-full bg-primary"></div>}
                                        <div className="flex gap-4">
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-muted border border-border/40 flex items-center justify-center font-black text-[10px] lg:text-xs text-foreground uppercase overflow-hidden">
                                                    {chat.online ? (
                                                        <div className="w-full h-full bg-primary/20 text-primary flex items-center justify-center">{chat.sender[0]}</div>
                                                    ) : chat.sender[0]}
                                                </div>
                                                {chat.online && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full"></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-xs lg:text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">{chat.sender}</p>
                                                    <span className="text-[8px] lg:text-[9px] font-bold text-muted-foreground uppercase shrink-0 ml-2">{chat.time}</span>
                                                </div>
                                                <p className="text-[10px] lg:text-[11px] text-muted-foreground truncate font-medium">{chat.preview}</p>

                                                <div className="mt-2.5 flex items-center gap-2">
                                                    <div className={clsx(
                                                        "px-2 py-0.5 rounded-md border text-[7px] lg:text-[8px] font-black uppercase tracking-tighter",
                                                        chat.type === 'WhatsApp' ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" : "text-sky-500 border-sky-500/20 bg-sky-500/5"
                                                    )}>
                                                        {chat.type}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className={clsx(
                            "flex-1 flex flex-col bg-card duration-300",
                            !selectedChat && "hidden lg:flex"
                        )}>
                            {!selectedChat ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                    <div className="w-24 h-24 rounded-[2.5rem] bg-muted/50 border border-border/40 flex items-center justify-center mb-6">
                                        <MessageCircle className="w-10 h-10 text-muted-foreground/20" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Selecciona un chat</h3>
                                    <p className="text-xs text-muted-foreground/40 mt-2">Para comenzar a monitorear en tiempo real</p>
                                </div>
                            ) : (
                                <React.Fragment>
                                    <div className="h-20 border-b border-border/40 px-6 lg:px-8 flex items-center justify-between bg-card shrink-0">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => setSelectedChat(null)}
                                                className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-xl transition-colors"
                                            >
                                                <ChevronRight className="w-5 h-5 rotate-180" />
                                            </button>
                                            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] lg:text-xs border border-primary/20 shrink-0">
                                                {selectedChat.sender[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs lg:text-sm font-black text-foreground tracking-tight truncate">{selectedChat.sender}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx(
                                                        "w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full shrink-0",
                                                        selectedChat.status === 'Needs Help' ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                                                    )}></span>
                                                    <span className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate">
                                                        {selectedChat.status === 'Needs Help' ? 'Ayuda requerida' : (isHumanInControl ? 'Modo Humano' : 'Bot Activo')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 lg:gap-3">
                                            <button
                                                onClick={() => setIsHumanInControl(!isHumanInControl)}
                                                className={clsx(
                                                    "hidden lg:flex px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all items-center gap-2",
                                                    isHumanInControl ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : "bg-muted border border-border text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <User className="w-3.5 h-3.5" />
                                                {isHumanInControl ? 'En Control' : 'Intervenir'}
                                            </button>
                                            <button
                                                onClick={() => setIsHumanInControl(!isHumanInControl)}
                                                className={clsx(
                                                    "lg:hidden p-2.5 rounded-xl transition-all border shrink-0",
                                                    isHumanInControl ? "bg-sky-500 text-white border-sky-500" : "bg-card border-border/40 text-muted-foreground"
                                                )}
                                            >
                                                <User className="w-4 h-4" />
                                            </button>
                                            <button className="p-2.5 bg-card border border-border/40 rounded-xl text-muted-foreground hover:text-foreground transition-all shrink-0">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 custom-scrollbar bg-background/30 transition-all">
                                        {/* Sample Messages */}
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-muted border border-border shrink-0 flex items-center justify-center">
                                                <User className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <div className="max-w-[70%] bg-card border border-border p-6 rounded-[2rem] rounded-tl-none shadow-xl space-y-3">
                                                <p className="text-sm leading-relaxed text-foreground font-bold opacity-80">
                                                    Me gustaría ver opciones de mobiliario urbano para un proyecto en Bogotá. ¿Me recomiendas algo?
                                                </p>
                                                <div className="flex items-center justify-between text-[8px] font-black uppercase text-muted-foreground">
                                                    <span>Hace 10 min</span>
                                                    <span className="text-sky-500">Vía WhatsApp</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 flex-row-reverse">
                                            <div className="w-10 h-10 rounded-xl bg-primary shrink-0 flex items-center justify-center">
                                                <Bot className="w-6 h-6 text-black" />
                                            </div>
                                            <div className="max-w-[70%] space-y-4">
                                                <div className="bg-primary/10 border border-primary/30 p-6 rounded-[2rem] rounded-tr-none shadow-lg space-y-3">
                                                    <p className="text-sm leading-relaxed text-primary font-black">
                                                        ¡Claro! Basado en el perfil de tu proyecto, te recomiendo nuestras piezas icónicas de concreto reforzado. Aquí tienes algunos detalles:
                                                    </p>
                                                </div>

                                                {/* Product Card In Chat */}
                                                <div className="bg-[#141417] border border-white/10 p-4 rounded-[2rem] overflow-hidden group hover:border-primary/50 transition-all">
                                                    <div className="aspect-video rounded-2xl overflow-hidden mb-4 relative">
                                                        <img
                                                            src="https://images.unsplash.com/photo-1594913366159-1832ebbee3f4?w=400&h=225&fit=crop"
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                        />
                                                        <div className="absolute top-3 left-3 px-3 py-1 bg-primary text-black text-[8px] font-black uppercase rounded-full">
                                                            Best Seller
                                                        </div>
                                                    </div>
                                                    <div className="px-2 space-y-2">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="text-sm font-black text-foreground italic">Banca Hexagonal H-20</h4>
                                                            <span className="text-primary font-black text-xs">$450.000</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground font-bold line-clamp-2">
                                                            Diseño icónico con estructura de concreto reforzado de alta resistencia.
                                                        </p>
                                                        <div className="pt-2 flex flex-col gap-2">
                                                            <a
                                                                href="/catalog/banca-hexagonal-h20"
                                                                target="_blank"
                                                                className="w-full bg-muted/10 border border-border/40 hover:bg-muted/30 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-center transition-all"
                                                            >
                                                                Ver Fotos y Detalles
                                                            </a>
                                                            <button className="w-full bg-primary text-black py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all">
                                                                Ordenar Ahora
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[8px] font-black uppercase text-primary/40">
                                                    <span>Hace 9 min</span>
                                                    <span>MiWi Intelligence Engine</span>
                                                </div>
                                            </div>
                                        </div>

                                        {isHumanInControl && (
                                            <div className="flex justify-center">
                                                <div className="px-6 py-2 bg-sky-500/10 border border-sky-500/20 rounded-full text-[9px] font-black text-sky-500 uppercase tracking-widest">
                                                    SISTEMA: El administrador ha tomado el control de la conversación.
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 lg:p-8 bg-card border-t border-border/40 relative shrink-0">
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
                                                placeholder={isHumanInControl ? "Modo Humano..." : "Escribe al bot..."}
                                                className="flex-1 bg-transparent border-none outline-none text-xs lg:text-sm px-1 lg:px-2 font-bold text-foreground placeholder:text-muted-foreground/30"
                                            />
                                            <button className="hidden lg:block p-3 hover:bg-muted rounded-xl transition-colors text-muted-foreground/30">
                                                <Smile className="w-5 h-5" />
                                            </button>
                                            <button className="bg-primary text-black p-3.5 lg:p-4 rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary/10">
                                                <Send className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </React.Fragment>
                            )}
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
                                            strokeDashoffset="15"
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">85%</span>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-primary">Score de Entrenamiento</p>
                                        <p className="text-xs font-black text-foreground">Nivel: Avanzado</p>
                                    </div>
                                </div>
                                <button className="bg-primary text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(250,181,16,0.2)]">
                                    <Save className="w-4 h-4" />
                                    <span className="text-[10px] uppercase tracking-widest">Guardar Todo</span>
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
                                                defaultValue="10 a 15 días hábiles"
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
                                                defaultValue="Gratis en Medellín y Bogotá. Resto del país: Cotización personalizada."
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
                                                defaultValue="Despachamos a nivel nacional. Instalación en sitio disponible según volumen de compra."
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-primary">
                                                <HelpCircle className="w-4 h-4" />
                                                <label className="text-[10px] font-black uppercase tracking-widest">Preguntas Frecuentes (FAQ)</label>
                                            </div>
                                            <div className="space-y-3">
                                                <button className="w-full p-4 bg-muted/10 border border-border/40 rounded-xl text-left hover:bg-muted/20 transition-colors">
                                                    <span className="text-[11px] font-bold text-muted-foreground/60">¿Fabrican diseños a medida?</span>
                                                </button>
                                                <button className="w-full p-4 bg-muted/10 border border-border/40 rounded-xl text-left hover:bg-muted/20 transition-colors">
                                                    <span className="text-[11px] font-bold text-muted-foreground/60">¿Tienen descuentos por volumen?</span>
                                                </button>
                                                <button className="w-full p-4 text-primary text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-primary/10 rounded-xl hover:bg-primary/5 transition-all">
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
                                            defaultValue={`Eres el Bot oficial de Arte Concreto. 
Tu misión es recibir al cliente, capturar sus datos y cotizar mobiliario urbano.

REGLAS DE ORO:
1. Siempre captura Nombre, Empresa y Ciudad.
2. Si el cliente pide productos personalizados, solicita ayuda humana.
3. El tiempo de despacho de concreto es de 10-15 días.
4. No hables de precios de obra civil, solo suministros de productos.`}
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
                                            { id: '1', label: 'Alertar por "Venta Grande"', active: true },
                                            { id: '2', label: 'Pasar a Humano por Enojo', active: true },
                                            { id: '3', label: 'Pedir ayuda si no sé la respuesta', active: true },
                                            { id: '4', label: 'Modo Solo Catalogo (No IA)', active: false },
                                        ].map((cap) => (
                                            <div key={cap.id} className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-muted-foreground">{cap.label}</span>
                                                <button className={clsx(
                                                    "w-10 h-5 rounded-full relative transition-all",
                                                    cap.active ? "bg-primary" : "bg-muted-foreground/10"
                                                )}>
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
                                            <div className="h-full bg-emerald-500 w-[92%]" />
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-muted-foreground/40">
                                            <span>Modelo Entrenado</span>
                                            <span>92% Precisión</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'capture' && (
                    <div className="flex-1 p-10 lg:p-20 space-y-12 lg:space-y-16 flex flex-col items-center overflow-y-auto custom-scrollbar">
                        <div className="text-center space-y-4 max-w-2xl">
                            <Shield className="w-12 h-12 lg:w-16 lg:h-16 text-primary mx-auto mb-6" />
                            <h2 className="text-2xl lg:text-4xl font-black text-foreground tracking-tighter uppercase italic">Formulario de Pre-Chat</h2>
                            <p className="text-xs lg:text-base text-muted-foreground font-bold leading-relaxed">
                                Captura los datos del cliente automáticamente antes de iniciar la conversación con MiWi. Esto garantiza que todos los contactos se registren como Leads.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 w-full max-w-5xl">
                            <div className="space-y-6">
                                <h3 className="text-[10px] lg:text-xs font-black uppercase text-primary tracking-[0.3em] pl-4 border-l-4 border-primary">Campos del Chatbot</h3>
                                <div className="space-y-2">
                                    {Object.entries(captureFields).map(([key, val]) => (
                                        <div
                                            key={key}
                                            onClick={() => toggleField(key as any)}
                                            className={clsx(
                                                "flex items-center justify-between p-5 lg:p-6 rounded-2xl lg:rounded-3xl border cursor-pointer transition-all",
                                                val ? "bg-primary/10 border-primary/40 text-foreground" : "bg-muted/10 border-border/40 text-muted-foreground opacity-20"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                {val ? <CheckCircle2 className="w-5 h-5 lg:w-6 lg:h-6 text-primary" /> : <Circle className="w-5 h-5 lg:w-6 lg:h-6" />}
                                                <span className="text-[11px] lg:text-sm font-black uppercase tracking-widest">{key === 'name' ? 'Nombre Completo' : key === 'email' ? 'Correo Electrónico' : key === 'phone' ? 'WhatsApp' : key === 'city' ? 'Ciudad' : 'Empresa'}</span>
                                            </div>
                                            <span className="text-[8px] lg:text-[10px] font-black opacity-40 uppercase">{val ? 'Requerido' : 'Off'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-[10px] lg:text-xs font-black uppercase text-muted-foreground/30 tracking-[0.3em] pl-4 border-l-4 border-border">Preview del Saludo</h3>
                                <div className="bg-card border border-border/60 rounded-[3rem] p-8 lg:p-10 shadow-2xl space-y-8 relative overflow-hidden">
                                    <div className="space-y-4">
                                        <div className="w-12 h-12 lg:w-14 lg:h-14 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
                                            <Bot className="w-7 h-7 lg:w-8 lg:h-8 text-black animate-pulse" />
                                        </div>
                                        <div>
                                            <h4 className="text-base lg:text-lg font-black text-foreground tracking-tighter uppercase italic">MiWi AI Bot</h4>
                                            <p className="text-[10px] lg:text-xs text-muted-foreground font-bold leading-relaxed mt-1">¡Hola! Para brindarte una mejor atención, por favor déjanos tus datos básicos antes de empezar.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {Object.entries(captureFields).filter(([_, v]) => v).map(([k]) => (
                                            <div key={k} className="h-12 bg-muted/20 border border-border/40 rounded-xl px-5 flex items-center border-dashed">
                                                <span className="text-[9px] lg:text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">{k === 'name' ? 'Escribe tu nombre' : k === 'email' ? 'Tu correo electrónico' : 'Completar campo'}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full bg-primary text-black font-black py-4 lg:py-5 rounded-2xl text-[10px] lg:text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                                        Iniciar Conversación
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
                                        <button className="p-3 bg-muted/10 rounded-xl border border-border transition-all text-muted-foreground/40 hover:text-foreground">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button className="p-3 bg-muted/10 rounded-xl border border-border transition-all text-muted-foreground/40 hover:text-foreground">
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <pre className="text-xs font-mono text-primary/80 leading-relaxed overflow-x-auto pt-10">
                                        {`<script>
  window.miwiSettings = {
    apiKey: "AC-5882-XT90",
    primaryColor: "#FAB510",
    botName: "MiWi AI",
    position: "right-bottom"
  };
</script>
<script src="https://cdn.miwibi.com/widget.js" async></script>`}
                                    </pre>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 bg-muted/10 border border-border/50 rounded-3xl flex flex-col gap-3">
                                        <Globe className="text-sky-500 w-8 h-8" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Dominio Autorizado</p>
                                        <p className="text-xs font-bold text-muted-foreground">arteconcreto.co</p>
                                    </div>
                                    <div className="p-6 bg-muted/10 border border-border/50 rounded-3xl flex flex-col gap-3">
                                        <MessageCircle className="text-emerald-500 w-8 h-8" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground">WhatsApp Sync</p>
                                        <p className="text-xs font-bold text-muted-foreground">API Conectada</p>
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
                                                                    alert(`Enviando ${product.name} al chat...`);
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
                                                                alert(`Enviando Combo ${combo.name} al chat...`);
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
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="group p-8 bg-white/[0.02] border border-white/10 rounded-[2.5rem] hover:border-primary/50 transition-all flex flex-col gap-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20">
                                                        <FileText className="w-6 h-6 text-rose-500" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest group-hover:text-primary transition-colors">Válido por 15 días</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-black text-foreground italic">Cotización #AC-2026-00{i}</h4>
                                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">Cliente: {['Robert J.', 'Constructora Alpha', 'Alcaldía Bogotá', 'Adriana T.', 'Parques S.A'][i - 1]}</p>
                                                </div>
                                                <div className="flex items-center justify-between pt-4 border-t border-border">
                                                    <span className="text-xl font-black text-foreground">$ {i * 125}.500.000</span>
                                                    <button
                                                        onClick={() => {
                                                            alert(`Enviando Cotización PDF #00${i} al chat...`);
                                                            setIsProductModalOpen(false);
                                                            setIsAttachmentMenuOpen(false);
                                                        }}
                                                        className="bg-muted/10 border border-border px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
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
                                            alert(`Enviando ${selectedProducts.length} productos al chat...`);
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
                                                Al generar esta cotización, el sistema creará automáticamente un Lead en "Arte Concreto Master CRM" y notificará al equipo comercial.
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
                                                    window.alert("PDF Generado y Enviado al Chat. Lead creado en el sistema.");
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
        </div>
    );
}
