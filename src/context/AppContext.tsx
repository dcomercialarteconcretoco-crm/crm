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
    role: 'Vendedor' | 'Manager' | 'Admin' | 'SuperAdmin';
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
    action: 'QUOTE_SENT' | 'SALE_REGISTERED' | 'CLIENT_CONTACTED' | 'LEAD_CREATED' | 'SYSTEM_LOGIN' | 'SYSTEM_LOGOUT' | 'TASK_DELETED' | 'SETTINGS_CHANGED' | 'WHATSAPP_SENT' | 'CALL_MADE' | 'LEAD_STATUS_CHANGE';
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
    isHydrating: boolean;
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
    const isProduction = process.env.NODE_ENV === 'production';

    // Helper to load from localStorage
    const loadData = <T,>(key: string, defaultValue: T): T => {
        if (typeof window === 'undefined') return defaultValue;
        if (isProduction && (
            key === 'crm_clients' ||
            key === 'crm_sellers' ||
            key === 'crm_tasks' ||
            key === 'crm_quotes' ||
            key === 'crm_notifications' ||
            key === 'crm_audit_logs_v_final' ||
            key === 'crm_anomalies_v_final' ||
            key === 'crm_events' ||
            key === 'crm_inventory_products' ||
            key === 'crm_forms' ||
            key === 'crm_current_user' ||
            key === 'crm_product_sync_status'
        )) return defaultValue;
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
    const [isHydrating, setIsHydrating] = useState(true);

    const persistSharedState = (patch: Record<string, unknown>) => {
        fetch('/api/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        }).catch((error) => console.warn('Failed to persist shared state:', error));
    };

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
            if (isProduction) {
                localStorage.setItem('crm_settings', JSON.stringify(sanitizeSettingsForStorage(settings)));
                return;
            }
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
                persistSharedState({ products: mapped });
            }

            const successStatus: ProductSyncStatus = {
                lastAttemptAt: attemptAt,
                lastSuccessAt: new Date().toISOString(),
                lastResult: 'success',
                syncedCount: mapped.length,
                message: `Catalogo sincronizado correctamente. ${mapped.length} productos recibidos.`,
            };
            setProductSyncStatus(successStatus);
            persistSharedState({ productSyncStatus: successStatus });
        } catch (error) {
            console.warn("WooCommerce sync failed:", error);
            setProductSyncStatus(prev => {
                const nextStatus: ProductSyncStatus = {
                    ...prev,
                    lastAttemptAt: attemptAt,
                    lastResult: 'error',
                    message: error instanceof Error ? error.message : 'No se pudo sincronizar el catalogo.',
                };
                persistSharedState({ productSyncStatus: nextStatus });
                return nextStatus;
            });
        }
    };

    useEffect(() => {
        const syncSharedData = async () => {
            try {
                const [meRes, teamRes, clientsRes, stateRes] = await Promise.all([
                    fetch('/api/auth/me', { cache: 'no-store' }),
                    fetch('/api/team', { cache: 'no-store' }),
                    fetch('/api/clients', { cache: 'no-store' }),
                    fetch('/api/state', { cache: 'no-store' })
                ]);

                if (meRes.ok) {
                    const meData = await meRes.json();
                    if (meData.user) setCurrentUser(meData.user);
                } else if (isProduction) {
                    setCurrentUser(null);
                }

                if (teamRes.ok) {
                    const teamData = await teamRes.json();
                    if (Array.isArray(teamData.users)) setSellers(teamData.users);
                }

                if (clientsRes.ok) {
                    const clientsData = await clientsRes.json();
                    if (Array.isArray(clientsData.clients)) setClients(clientsData.clients);
                }

                if (stateRes.ok) {
                    const stateData = await stateRes.json();
                    if (Array.isArray(stateData.tasks)) setTasks(stateData.tasks);
                    if (Array.isArray(stateData.quotes)) setQuotes(stateData.quotes);
                    if (Array.isArray(stateData.notifications)) setNotifications(stateData.notifications);
                    if (Array.isArray(stateData.auditLogs)) setAuditLogs(stateData.auditLogs);
                    if (Array.isArray(stateData.anomalies)) setAnomalies(stateData.anomalies);
                    if (Array.isArray(stateData.events)) setEvents(stateData.events);
                    if (Array.isArray(stateData.forms)) setForms(stateData.forms);
                    if (Array.isArray(stateData.products) && stateData.products.length > 0) setProducts(stateData.products);
                    if (stateData.productSyncStatus) setProductSyncStatus(stateData.productSyncStatus);
                    if (stateData.settings) setSettings(prev => ({ ...prev, ...stateData.settings }));
                }
            } catch (error) {
                console.warn('Shared data sync failed:', error);
            } finally {
                setIsHydrating(false);
                setIsInitialLoad(false);
            }
        };

        syncSharedData();
    }, [isProduction]);

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
                action: 'SYSTEM_LOGOUT',
                details: `Sesión cerrada`,
                verified: true
            });
        }
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        setCurrentUser(null);
    };

    // --- Actions ---

    const addClient = (client: Omit<Client, 'id'>) => {
        const id = `c-${Date.now()}`;
        const newClient = { ...client, id };
        setClients(prev => [...prev, newClient]);
        fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newClient),
        }).catch((error) => console.warn('Failed to persist client:', error));
        return id;
    };

    const addTask = (task: Omit<Task, 'id'>) => {
        const id = `t-${Date.now()}`;
        const newTask = { ...task, id };
        setTasks(prev => {
            const next = [...prev, newTask];
            persistSharedState({ tasks: next });
            return next;
        });
        return id;
    };

    const addQuote = (quote: Omit<Quote, 'id'>) => {
        const id = `q-${Date.now()}`;
        const newQuote = { ...quote, id };
        setQuotes(prev => {
            const next = [...prev, newQuote];
            persistSharedState({ quotes: next });
            return next;
        });
        return id;
    };

    const addSeller = (sellerData: Omit<Seller, 'id'>) => {
        const newSeller: Seller = { ...sellerData, id: `s-${Date.now()}` };
        setSellers(prev => [...prev, newSeller]);
        fetch('/api/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSeller),
        }).catch((error) => console.warn('Failed to persist seller:', error));
        return newSeller.id;
    };

    const addEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
        const newEvent: CalendarEvent = { ...eventData, id: `ev-${Date.now()}` };
        setEvents(prev => {
            const next = [...prev, newEvent];
            persistSharedState({ events: next });
            return next;
        });
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
        setForms(prev => {
            const next = [...prev, newForm];
            persistSharedState({ forms: next });
            return next;
        });
        return id;
    };

    const addNotification = (notif: Omit<Notification, 'id' | 'time' | 'read'>) => {
        const id = `n-${Date.now()}`;
        setNotifications(prev => {
            const next = [{
                ...notif,
                id,
                time: 'Ahora',
                read: false
            }, ...prev];
            persistSharedState({ notifications: next });
            return next;
        });
    };

    const addAuditLog = (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
        const id = `audit-${Date.now()}`;
        setAuditLogs(prev => {
            const next = [{
                ...log,
                id,
                timestamp: new Date()
            }, ...prev];
            persistSharedState({ auditLogs: next });
            return next;
        });
    };

    const addAnomaly = (anom: Omit<Anomaly, 'id' | 'timestamp' | 'status'>) => {
        const id = `anom-${Date.now()}`;
        setAnomalies(prev => {
            const next: Anomaly[] = [{
                ...anom,
                id,
                timestamp: new Date(),
                status: 'pending'
            }, ...prev];
            persistSharedState({ anomalies: next });
            return next;
        });
    };

    const updateClient = (clientId: string, updates: Partial<Client>) => {
        let mergedClient: Client | null = null;
        setClients(prev => prev.map(c => {
            if (c.id !== clientId) return c;
            mergedClient = { ...c, ...updates };
            return mergedClient;
        }));
        if (mergedClient) {
            fetch(`/api/clients/${clientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mergedClient),
            }).catch((error) => console.warn('Failed to update client:', error));
        }
    };

    const deleteClient = (clientId: string) => {
        setClients(prev => prev.filter(c => c.id !== clientId));
        fetch(`/api/clients/${clientId}`, {
            method: 'DELETE',
        }).catch((error) => console.warn('Failed to delete client:', error));
    };

    const updateTask = (taskId: string, updates: Partial<Task>) => {
        setTasks(prev => {
            const next = prev.map(t => t.id === taskId ? { ...t, ...updates } : t);
            persistSharedState({ tasks: next });
            return next;
        });
    };

    const deleteTask = (taskId: string) => {
        setTasks(prev => {
            const next = prev.filter(t => t.id !== taskId);
            persistSharedState({ tasks: next });
            return next;
        });
    };

    const updateQuote = (quoteId: string, updates: Partial<Quote>) => {
        setQuotes(prev => {
            const next = prev.map(q => q.id === quoteId ? { ...q, ...updates } : q);
            persistSharedState({ quotes: next });
            return next;
        });
    };

    const deleteQuote = (quoteId: string) => {
        setQuotes(prev => {
            const next = prev.filter(q => q.id !== quoteId);
            persistSharedState({ quotes: next });
            return next;
        });
    };

    const updateEvent = (eventId: string, updates: Partial<CalendarEvent>) => {
        setEvents(prev => {
            const next = prev.map(e => e.id === eventId ? { ...e, ...updates } : e);
            persistSharedState({ events: next });
            return next;
        });
    };

    const deleteEvent = (eventId: string) => {
        setEvents(prev => {
            const next = prev.filter(e => e.id !== eventId);
            persistSharedState({ events: next });
            return next;
        });
    };

    const updateSeller = (id: string, updates: Partial<Seller>) => {
        let mergedSeller: Seller | null = null;
        setSellers(prev => prev.map(s => {
            if (s.id !== id) return s;
            mergedSeller = { ...s, ...updates };
            return mergedSeller;
        }));

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

        if (mergedSeller) {
            fetch(`/api/team/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mergedSeller),
            }).catch((error) => console.warn('Failed to update seller:', error));
        }
    };

    const deleteSeller = (sellerId: string) => {
        const sellerToDelete = sellers.find(s => s.id === sellerId);
        if (sellerToDelete?.role === 'SuperAdmin' || sellerToDelete?.role === 'Admin') {
            alert('REGLA DE SEGURIDAD: Las cuentas de Super Administrador son críticas y no pueden ser eliminadas.');
            return;
        }
        setSellers(prev => prev.filter(s => s.id !== sellerId));
        fetch(`/api/team/${sellerId}`, {
            method: 'DELETE',
        }).catch((error) => console.warn('Failed to delete seller:', error));
    };

    const updateForm = (id: string, form: Partial<FormDefinition>) => {
        setForms(prev => {
            const next = prev.map(f => f.id === id ? { ...f, ...form } : f);
            persistSharedState({ forms: next });
            return next;
        });
    };

    const deleteForm = (id: string) => {
        setForms(prev => {
            const next = prev.filter(f => f.id !== id);
            persistSharedState({ forms: next });
            return next;
        });
    };

    const updateSettings = (updates: Partial<AppSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            persistSharedState({ settings: sanitizeSettingsForStorage(next) });
            return next;
        });
    };

    const markNotificationAsRead = (id: string) => {
        setNotifications(prev => {
            const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
            persistSharedState({ notifications: next });
            return next;
        });
    };

    const updateProduct = (id: string, updates: Partial<Product>) => {
        setProducts(prev => {
            const next = prev.map(p => p.id === id ? { ...p, ...updates } as Product : p);
            persistSharedState({ products: next });
            return next;
        });
    };

    const deleteProduct = (id: string) => {
        setProducts(prev => {
            const next = prev.filter(p => p.id !== id);
            persistSharedState({ products: next });
            return next;
        });
    };

    const clearNotifications = () => {
        setNotifications([]);
        persistSharedState({ notifications: [] });
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => {
            const next = prev.filter(n => n.id !== id);
            persistSharedState({ notifications: next });
            return next;
        });
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
            currentUser, isHydrating, login, logout
        }), [
            clients, tasks, quotes, sellers, notifications, settings, events, forms,
            auditLogs, anomalies, products, productSyncStatus, currentUser, isHydrating
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
