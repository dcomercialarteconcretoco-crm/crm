"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

// --- Interfaces ---

export interface Activity {
    id: string;
    type: 'email' | 'call' | 'whatsapp' | 'note' | 'system';
    content: string;
    timestamp: Date;
}

export interface Task {
    id: string;
    title: string;
    client: string;
    clientId: string;
    contactName: string;
    value: string;
    numericValue: number;
    priority: 'High' | 'Medium' | 'Low';
    tags: string[];
    aiScore: number;
    source: string;
    assignedTo?: string;
    email?: string;
    phone?: string;
    city?: string;
    category?: string;
    activities: Activity[];
    quoteId?: string;
    stageId?: string;
}

export interface Client {
    id: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    status: 'Active' | 'Lead' | 'Inactive';
    value: string;
    ltv: number;
    lastContact: string;
    city: string;
    score: number;
    category: string;
    registrationDate: string;
}

export interface Quote {
    id: string;
    number: string;
    client: string;
    clientId: string;
    date: string;
    total: string;
    numericTotal: number;
    status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
    taskId?: string;
    opens?: number;
}

export interface Seller {
    id: string;
    name: string;
    avatar?: string;
    role: 'Vendedor' | 'Manager' | 'SuperAdmin';
    email: string;
    phone?: string;
    username?: string;
    status: 'Activo' | 'Inactivo';
    sales?: string;
    commission?: string;
    password?: string;
}

export interface Notification {
    id: string;
    title: string;
    description: string;
    time: string;
    type: 'lead' | 'ai' | 'alert' | 'success' | 'task' | 'order';
    read: boolean;
}

export interface AuditLog {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    action: 'QUOTE_SENT' | 'SALE_REGISTERED' | 'CLIENT_CONTACTED' | 'LEAD_CREATED' | 'SYSTEM_LOGIN' | 'TASK_DELETED' | 'SETTINGS_CHANGED' | 'WHATSAPP_SENT' | 'CALL_MADE' | 'LEAD_STATUS_CHANGE';
    targetId?: string;
    targetName?: string;
    timestamp: Date;
    details: string;
    verified: boolean;
}

export interface Anomaly {
    id: string;
    type: 'NO_OPEN_OPEN' | 'MANUAL_REPORT_ONLY' | 'SUSPICIOUS_DELETION' | 'LATE_NIGHT_SYSTEM_ACCESS';
    severity: 'low' | 'medium' | 'high';
    userName: string;
    targetName: string;
    timestamp: Date;
    description: string;
    status: 'pending' | 'reviewed';
}

export interface City {
    name: string;
    department: string;
}

export interface Product {
    id: string;
    name: string;
    category: string;
    sku: string;
    stock: number;
    isStockTracked: boolean;
    price: number;
    salePrice?: number;
    saleDateStart?: string;
    saleDateEnd?: string;
    shortDescription?: string;
    image?: string;
    gallery?: string[];
    dimensions: string;
    status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Production';
    wooId?: number;
    slug?: string;
    isActive?: boolean;
    isDeleted?: boolean;
}

export interface Invitee {
    id: string;
    name: string;
    email: string;
    type: 'vendedor' | 'lead' | 'externo';
}

export interface CalendarEvent {
    id: string;
    title: string;
    time: string;
    date: string;
    type: 'visit' | 'delivery' | 'call' | 'meeting';
    client: string;
    ownerUserId?: string;
    ownerName?: string;
    location?: string;
    meetingLink?: string;
    invitees: Invitee[];
    description?: string;
    googleEventId?: string;
    googleCalendarId?: string;
    syncedAt?: string;
    source?: 'local' | 'google' | 'local+google';
}

export interface AppSettings {
    cities: City[];
    sectors: string[];
    allowExports: boolean;
    blockScreenshots: boolean;
    productionEmails: string[];
    fromEmail: string;
    geminiKey?: string;
    resendKey?: string;
    whatsapp: WhatsAppConfig;
    botSettings?: BotSettings;
}

export interface BotSettings {
    deliveryTimes: string;
    shippingCost: string;
    coverageArea: string;
    faqs: string[];
    systemPrompt: string;
    escalationRules: {
        largeSale: boolean;
        anger: boolean;
        unknownAnswer: boolean;
        catalogOnly: boolean;
    };
    captureFields: {
        name: boolean;
        email: boolean;
        phone: boolean;
        city: boolean;
        company: boolean;
    };
    widget: {
        apiKey: string;
        primaryColor: string;
        botName: string;
        position: 'right-bottom' | 'left-bottom';
        authorizedDomain: string;
        whatsappSync: boolean;
    };
}

export interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    businessAccountId: string;
    verifyToken: string;
    appId?: string;
    displayPhoneNumber?: string;
    webhookUrl?: string;
    status: 'disconnected' | 'configured' | 'connected' | 'error';
    lastVerifiedAt?: string;
    lastError?: string;
}

export interface ProductSyncStatus {
    lastAttemptAt?: string;
    lastSuccessAt?: string;
    lastResult: 'idle' | 'success' | 'error';
    syncedCount: number;
    message?: string;
}

// --- Context Definition ---

export interface FormDefinition {
    id: string;
    title: string;
    description: string;
    fields: string[];
    customFields?: Array<{
        id: string;
        label: string;
        type: 'text' | 'email' | 'phone' | 'textarea' | 'number';
        required: boolean;
        placeholder?: string;
    }>;
    primaryColor: string;
    theme: string;
    buttonText: string;
    submissions: number;
    createdAt: string;
}

interface AppContextType {
    clients: Client[];
    tasks: Task[];
    quotes: Quote[];
    sellers: Seller[];
    notifications: Notification[];
    auditLogs: AuditLog[];
    anomalies: Anomaly[];
    settings: AppSettings;
    events: CalendarEvent[];
    products: Product[];
    forms: FormDefinition[];
    currentUser: Seller | null;
    productSyncStatus: ProductSyncStatus;
    refreshProducts: () => Promise<void>;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;

    addClient: (client: Omit<Client, 'id'>) => string;
    addTask: (task: Omit<Task, 'id'>) => string;
    addQuote: (quote: Omit<Quote, 'id'>) => string;
    addSeller: (seller: Omit<Seller, 'id'>) => string;
    addNotification: (notification: Omit<Notification, 'id' | 'time' | 'read'>) => void;
    addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
    addEvent: (event: Omit<CalendarEvent, 'id'>) => string;
    addForm: (form: Omit<FormDefinition, 'id' | 'submissions' | 'createdAt'>) => string;

    updateClient: (clientId: string, updates: Partial<Client>) => void;
    deleteClient: (clientId: string) => void;
    updateTask: (taskId: string, updates: Partial<Task>) => void;
    deleteTask: (taskId: string) => void;
    updateQuote: (quoteId: string, updates: Partial<Quote>) => void;
    deleteQuote: (quoteId: string) => void;
    updateEvent: (eventId: string, updates: Partial<CalendarEvent>) => void;
    deleteEvent: (eventId: string) => void;
    updateSeller: (sellerId: string, updates: Partial<Seller>) => void;
    deleteSeller: (sellerId: string) => void;
    updateSettings: (updates: Partial<AppSettings>) => void;
    updateForm: (id: string, form: Partial<FormDefinition>) => void;
    deleteForm: (id: string) => void;

    markNotificationAsRead: (id: string) => void;
    clearNotifications: () => void;
    removeNotification: (id: string) => void;
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    addAnomaly: (anomaly: Omit<Anomaly, 'id' | 'timestamp' | 'status'>) => void;
    updateProduct: (id: string, updates: Partial<Product>) => void;
    deleteProduct: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function sanitizeSettingsForStorage(settings: AppSettings): AppSettings {
    return {
        ...settings,
        geminiKey: '',
        resendKey: '',
        whatsapp: {
            ...settings.whatsapp,
            accessToken: '',
            verifyToken: '',
        },
    };
}

// --- Provider ---

export function AppProvider({ children }: { children: React.ReactNode }) {
    // Helper to load from localStorage
    const loadData = <T,>(key: string, defaultValue: T): T => {
        if (typeof window === 'undefined') return defaultValue;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultValue;
    };

    const [clients, setClients] = useState<Client[]>(() => loadData('crm_clients', []));
    const [tasks, setTasks] = useState<Task[]>(() => loadData('crm_tasks', []));
    const [quotes, setQuotes] = useState<Quote[]>(() => loadData('crm_quotes', []));
    const [sellers, setSellers] = useState<Seller[]>(() => loadData('crm_sellers', []));
    const [notifications, setNotifications] = useState<Notification[]>(() => loadData('crm_notifications', []));
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadData('crm_audit_logs_v_final', []));
    const [anomalies, setAnomalies] = useState<Anomaly[]>(() => loadData('crm_anomalies_v_final', []));
    const [events, setEvents] = useState<CalendarEvent[]>(() => loadData('crm_events', []));
    const [products, setProducts] = useState<Product[]>(() => loadData('crm_inventory_products', []));
    const [forms, setForms] = useState<FormDefinition[]>(() => loadData('crm_forms', []));
    const [currentUser, setCurrentUser] = useState<Seller | null>(() => loadData('crm_current_user', null));
    const [productSyncStatus, setProductSyncStatus] = useState<ProductSyncStatus>(() => loadData('crm_product_sync_status', {
        lastResult: 'idle',
        syncedCount: 0,
    }));
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const [settings, setSettings] = useState<AppSettings>(() => sanitizeSettingsForStorage(loadData('crm_settings', {
        cities: [
            { name: 'Bogotá', department: 'Cundinamarca' },
            { name: 'Medellín', department: 'Antioquia' },
            { name: 'Cali', department: 'Valle del Cauca' },
            { name: 'Barranquilla', department: 'Atlántico' },
            { name: 'Cartagena', department: 'Bolívar' },
            { name: 'Bucaramanga', department: 'Santander' },
            { name: 'Pereira', department: 'Risaralda' },
            { name: 'Cúcuta', department: 'Norte de Santander' },
            { name: 'Ibagué', department: 'Tolima' },
            { name: 'Santa Marta', department: 'Magdalena' },
            { name: 'Pasto', department: 'Nariño' },
            { name: 'Manizales', department: 'Caldas' },
            { name: 'Neiva', department: 'Huila' },
            { name: 'Villavicencio', department: 'Meta' },
            { name: 'Armenia', department: 'Quindío' },
            { name: 'Valledupar', department: 'Cesar' },
            { name: 'Montería', department: 'Córdoba' },
            { name: 'Sincelejo', department: 'Sucre' },
            { name: 'Popayán', department: 'Cauca' },
            { name: 'Tunja', department: 'Boyacá' },
            { name: 'Quibdó', department: 'Chocó' },
            { name: 'Riohacha', department: 'La Guajira' },
            { name: 'Florencia', department: 'Caquetá' },
            { name: 'Yopal', department: 'Casanare' },
            { name: 'Arauca', department: 'Arauca' },
            { name: 'Mocoa', department: 'Putumayo' },
            { name: 'Leticia', department: 'Amazonas' },
            { name: 'Inírida', department: 'Guainía' },
            { name: 'San José del Guaviare', department: 'Guaviare' },
            { name: 'Mitú', department: 'Vaupés' },
            { name: 'Puerto Carreño', department: 'Vichada' }
        ],
        sectors: [
            'Infraestructura', 'Gubernamental', 'Privado',
            'Educativo', 'Salud', 'Industrial', 'Comercial', 'Residencial'
        ],
        allowExports: false,
        blockScreenshots: false,
        productionEmails: [],
        fromEmail: 'ordenes@arteconcreto.co',
        geminiKey: '',
        resendKey: '',
        whatsapp: {
            accessToken: '',
            phoneNumberId: '',
            businessAccountId: '',
            verifyToken: '',
            appId: '',
            displayPhoneNumber: '',
            webhookUrl: '',
            status: 'disconnected',
            lastVerifiedAt: '',
            lastError: '',
        },
        botSettings: {
            deliveryTimes: '10 a 15 días hábiles',
            shippingCost: 'Gratis en Medellín y Bogotá. Resto del país: Cotización personalizada.',
            coverageArea: 'Despachamos a nivel nacional. Instalación en sitio disponible según volumen de compra.',
            faqs: [
                '¿Fabrican diseños a medida?',
                '¿Tienen descuentos por volumen?',
            ],
            systemPrompt: `Eres el Bot oficial de Arte Concreto.
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
                position: 'right-bottom',
                authorizedDomain: 'arteconcreto.co',
                whatsappSync: true,
            },
        },
    })));

    // Persist state with a small delay so UI interactions are not blocked by repeated JSON serialization.
    useEffect(() => {
        if (isInitialLoad) return;

        const persist = () => {
            localStorage.setItem('crm_clients', JSON.stringify(clients));
            localStorage.setItem('crm_tasks', JSON.stringify(tasks));
            localStorage.setItem('crm_quotes', JSON.stringify(quotes));
            localStorage.setItem('crm_sellers', JSON.stringify(sellers));
            localStorage.setItem('crm_notifications', JSON.stringify(notifications));
            localStorage.setItem('crm_audit_logs_v_final', JSON.stringify(auditLogs));
            localStorage.setItem('crm_anomalies_v_final', JSON.stringify(anomalies));
            localStorage.setItem('crm_settings', JSON.stringify(sanitizeSettingsForStorage(settings)));
            localStorage.setItem('crm_events', JSON.stringify(events));
            localStorage.setItem('crm_inventory_products', JSON.stringify(products));
            localStorage.setItem('crm_forms', JSON.stringify(forms));
            localStorage.setItem('crm_product_sync_status', JSON.stringify(productSyncStatus));
            if (currentUser) {
                localStorage.setItem('crm_current_user', JSON.stringify(currentUser));
            } else {
                localStorage.removeItem('crm_current_user');
            }
        };

        const timeoutId = window.setTimeout(persist, 120);
        return () => window.clearTimeout(timeoutId);
    }, [clients, tasks, quotes, sellers, notifications, auditLogs, anomalies, settings, events, products, forms, currentUser, productSyncStatus, isInitialLoad]);

    const refreshProducts = async () => {
        const attemptAt = new Date().toISOString();
        setProductSyncStatus(prev => ({
            ...prev,
            lastAttemptAt: attemptAt,
            message: 'Sincronizando catalogo desde WooCommerce...',
        }));

        try {
            const res = await fetch('/api/woocommerce');
            if (!res.ok) throw new Error('Error fetching WooCommerce products');
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            const mapped: Product[] = data.map((wooP: any) => ({
                id: wooP.id.toString(),
                name: wooP.name,
                category: wooP.categories?.[0]?.name || 'Urban',
                sku: wooP.sku || `SKU-${wooP.id}`,
                stock: wooP.stock_quantity || 0,
                isStockTracked: wooP.manage_stock,
                price: parseFloat(wooP.regular_price || wooP.price || '0'),
                salePrice: wooP.sale_price ? parseFloat(wooP.sale_price) : undefined,
                shortDescription: wooP.short_description?.replace(/<[^>]+>/g, '') || '',
                dimensions: wooP.dimensions ? (wooP.dimensions.length ? `${wooP.dimensions.length}x${wooP.dimensions.width}x${wooP.dimensions.height}` : '') : '',
                status: wooP.stock_status === 'instock' ? 'In Stock' : (wooP.stock_status === 'onbackorder' ? 'Production' : 'Out of Stock'),
                image: wooP.images?.[0]?.src || '',
                gallery: wooP.images?.map((img: any) => img.src) || [],
                wooId: wooP.id,
                slug: wooP.slug,
                isActive: wooP.status === 'publish',
                isDeleted: false
            }));

            if (mapped.length > 0) {
                setProducts(mapped);
            }

            setProductSyncStatus({
                lastAttemptAt: attemptAt,
                lastSuccessAt: new Date().toISOString(),
                lastResult: 'success',
                syncedCount: mapped.length,
                message: `Catalogo sincronizado correctamente. ${mapped.length} productos recibidos.`,
            });
        } catch (error) {
            console.warn("WooCommerce sync failed:", error);
            setProductSyncStatus(prev => ({
                ...prev,
                lastAttemptAt: attemptAt,
                lastResult: 'error',
                message: error instanceof Error ? error.message : 'No se pudo sincronizar el catalogo.',
            }));
        }
    };

    useEffect(() => {
        if (isInitialLoad) {
            setIsInitialLoad(false);
        }
    }, [isInitialLoad]);

    const login = async (username: string, password: string): Promise<boolean> => {
        const normalizedUsername = username.trim().toLowerCase();
        const normalizedPassword = password.trim();

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: normalizedUsername,
                    password: normalizedPassword,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const serverUser = data.user as Seller | undefined;

                if (serverUser) {
                    setCurrentUser(serverUser);
                    addAuditLog({
                        userId: serverUser.id,
                        userName: serverUser.name,
                        userRole: serverUser.role,
                        action: 'SYSTEM_LOGIN',
                        details: 'Sesión iniciada correctamente',
                        verified: true
                    });
                    return true;
                }
            }
        } catch (error) {
            console.warn('Server-side login failed.', error);
            if (process.env.NODE_ENV === 'production') {
                return false;
            }
        }

        if (process.env.NODE_ENV === 'production') {
            return false;
        }

        const user = sellers.find(
            (seller) =>
                seller.username?.trim().toLowerCase() === normalizedUsername &&
                seller.password === normalizedPassword
        );

        if (user) {
            setCurrentUser(user);
            addAuditLog({
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                action: 'SYSTEM_LOGIN',
                details: `Sesión iniciada correctamente`,
                verified: true
            });
            return true;
        }
        return false;
    };

    const logout = () => {
        if (currentUser) {
            addAuditLog({
                userId: currentUser.id,
                userName: currentUser.name,
                userRole: currentUser.role,
                action: 'SYSTEM_LOGIN',
                details: `Sesión cerrada`,
                verified: true
            });
        }
        setCurrentUser(null);
    };

    // --- Actions ---

    const addClient = (client: Omit<Client, 'id'>) => {
        const id = `c-${Date.now()}`;
        const newClient = { ...client, id };
        setClients(prev => [...prev, newClient]);
        return id;
    };

    const addTask = (task: Omit<Task, 'id'>) => {
        const id = `t-${Date.now()}`;
        const newTask = { ...task, id };
        setTasks(prev => [...prev, newTask]);
        return id;
    };

    const addQuote = (quote: Omit<Quote, 'id'>) => {
        const id = `q-${Date.now()}`;
        const newQuote = { ...quote, id };
        setQuotes(prev => [...prev, newQuote]);
        return id;
    };

    const addSeller = (sellerData: Omit<Seller, 'id'>) => {
        const newSeller: Seller = { ...sellerData, id: `s-${Date.now()}` };
        setSellers(prev => [...prev, newSeller]);
        return newSeller.id;
    };

    const addEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
        const newEvent: CalendarEvent = { ...eventData, id: `ev-${Date.now()}` };
        setEvents(prev => [...prev, newEvent]);
        return newEvent.id;
    };

    const addForm = (form: Omit<FormDefinition, 'id' | 'submissions' | 'createdAt'>): string => {
        const id = Math.random().toString(36).substr(2, 9);
        const newForm: FormDefinition = {
            ...form,
            id,
            submissions: 0,
            createdAt: new Date().toISOString()
        };
        setForms(prev => [...prev, newForm]);
        return id;
    };

    const addNotification = (notif: Omit<Notification, 'id' | 'time' | 'read'>) => {
        const id = `n-${Date.now()}`;
        setNotifications(prev => [{
            ...notif,
            id,
            time: 'Ahora',
            read: false
        }, ...prev]);
    };

    const addAuditLog = (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
        const id = `audit-${Date.now()}`;
        setAuditLogs(prev => [{
            ...log,
            id,
            timestamp: new Date()
        }, ...prev]);
    };

    const addAnomaly = (anom: Omit<Anomaly, 'id' | 'timestamp' | 'status'>) => {
        const id = `anom-${Date.now()}`;
        setAnomalies(prev => [{
            ...anom,
            id,
            timestamp: new Date(),
            status: 'pending'
        }, ...prev]);
    };

    const updateClient = (clientId: string, updates: Partial<Client>) => {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c));
    };

    const deleteClient = (clientId: string) => {
        setClients(prev => prev.filter(c => c.id !== clientId));
    };

    const updateTask = (taskId: string, updates: Partial<Task>) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    const deleteTask = (taskId: string) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
    };

    const updateQuote = (quoteId: string, updates: Partial<Quote>) => {
        setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, ...updates } : q));
    };

    const deleteQuote = (quoteId: string) => {
        setQuotes(prev => prev.filter(q => q.id !== quoteId));
    };

    const updateEvent = (eventId: string, updates: Partial<CalendarEvent>) => {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));
    };

    const deleteEvent = (eventId: string) => {
        setEvents(prev => prev.filter(e => e.id !== eventId));
    };

    const updateSeller = (id: string, updates: Partial<Seller>) => {
        setSellers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

        setCurrentUser(prev => {
            if (!prev) return prev;

            const normalizedPrevEmail = prev.email.trim().toLowerCase();
            const normalizedPrevUsername = (prev.username || "").trim().toLowerCase();
            const normalizedUpdateEmail = (updates.email || "").trim().toLowerCase();
            const normalizedUpdateUsername = (updates.username || "").trim().toLowerCase();

            const sameIdentity =
                prev.id === id ||
                (normalizedUpdateEmail && normalizedPrevEmail === normalizedUpdateEmail) ||
                (normalizedUpdateUsername && normalizedPrevUsername === normalizedUpdateUsername);

            if (!sameIdentity) return prev;

            return {
                ...prev,
                ...updates,
                role: updates.role ?? prev.role,
                status: updates.status ?? prev.status,
            } as Seller;
        });
    };

    const deleteSeller = (sellerId: string) => {
        const sellerToDelete = sellers.find(s => s.id === sellerId);
        if (sellerToDelete?.role === 'SuperAdmin') {
            alert('REGLA DE SEGURIDAD: Las cuentas de Super Administrador son críticas y no pueden ser eliminadas.');
            return;
        }
        setSellers(prev => prev.filter(s => s.id !== sellerId));
    };

    const updateForm = (id: string, form: Partial<FormDefinition>) => {
        setForms(prev => prev.map(f => f.id === id ? { ...f, ...form } : f));
    };

    const deleteForm = (id: string) => {
        setForms(prev => prev.filter(f => f.id !== id));
    };

    const updateSettings = (updates: Partial<AppSettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    };

    const markNotificationAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const updateProduct = (id: string, updates: Partial<Product>) => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } as Product : p));
    };

    const deleteProduct = (id: string) => {
        setProducts(prev => prev.filter(p => p.id !== id));
    };

    const clearNotifications = () => setNotifications([]);

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const contextValue = useMemo(() => ({
            clients, tasks, quotes, sellers, notifications, settings, events, forms,
            addClient, addTask, addQuote, addSeller, addNotification, addEvent, addForm,
            updateClient, deleteClient,
            updateTask, deleteTask,
            updateQuote, deleteQuote,
            updateEvent, deleteEvent,
            updateSeller, deleteSeller, updateSettings,
            updateForm, deleteForm,
            markNotificationAsRead, clearNotifications, removeNotification, setNotifications,
            auditLogs, addAuditLog, anomalies, addAnomaly,
            products, productSyncStatus, refreshProducts, updateProduct, deleteProduct,
            currentUser, login, logout
        }), [
            clients, tasks, quotes, sellers, notifications, settings, events, forms,
            auditLogs, anomalies, products, productSyncStatus, currentUser
        ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
