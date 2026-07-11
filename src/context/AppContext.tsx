"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

// Build the displayed quote number from base + version + AIU flag.
// base: "ART-250-2026" (prefix-number-year).
// version 1 → "ART-250-2026", version 2 → "ART-250-V1-2026", version 3 → "ART-250-V2-2026", ...
// isAIU appends "-AIU" at the end.
export function formatQuoteNumber(base: string, version: number, isAIU: boolean): string {
    if (!base) return '';
    const match = base.match(/^(.+)-(\d{4})$/);
    const [stem, year] = match ? [match[1], match[2]] : [base, ''];
    const v = Math.max(1, version || 1);
    const vSuffix = v > 1 ? `-V${v - 1}` : '';
    const aiuSuffix = isAIU ? '-AIU' : '';
    return year ? `${stem}${vSuffix}-${year}${aiuSuffix}` : `${base}${vSuffix}${aiuSuffix}`;
}

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
    // Motivo de pérdida cuando el negocio se descarta/marca perdido —
    // requerido por gerencia para saber por qué se pierden los negocios.
    lossReason?: string;
    // Fecha en la que el negocio se activó en el tablero del mes en curso: se
    // estampa al crear el deal (abrir negocio / cotización nueva) y al retomar
    // una cotización antigua desde el archivo. El pipeline la prioriza sobre el
    // año que aparezca escrito en el número de cotización (ej: ART-943-2025-V4
    // creada en 2026 debe verse en el tablero actual, no en el archivo de 2025).
    retakenAt?: string;
    notes?: { text: string; date: string; author: string }[];
}

export interface ClientNote {
    text: string;
    date: string;
    author: string;
}

/**
 * Empresa (cliente corporativo). Una empresa agrupa varios contactos (Client).
 * El nombre se mantiene en `Client.company` como denormalización para no
 * romper PDFs, listados y dashboards que ya lo leen, pero la fuente de verdad
 * cuando existe es `Client.companyId` → `Company.id`.
 */
export interface Company {
    id: string;
    name: string;
    createdAt?: string;
    /** Solo lo carga el GET de /api/companies — útil para el listado. */
    clientCount?: number;
}

export interface Client {
    id: string;
    name: string;
    company: string;
    /** FK opcional a Company.id. Los leads viejos (sin asignación) llevan undefined. */
    companyId?: string;
    /**
     * Cargo o rol del contacto dentro de la empresa. Texto libre porque los
     * títulos en B2B son demasiado heterogéneos para una taxonomía cerrada
     * ("Director de Compras", "Asistente Administrativo", "Gerente General",
     * "Coordinador de Proyectos"). El asesor lo escribe a mano.
     */
    position?: string;
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
    notes?: ClientNote[];
    assignedTo?: string;
    assignedToName?: string;
    source?: 'Manual' | 'WooCommerce' | 'ConcreBot' | 'Importación' | string;
}

export interface QuoteItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
    total: number;
    productId?: string;    // WooCommerce product ID
    image?: string;        // product image URL or base64
    dimensions?: string;   // e.g. "120×60×5 cm"
    isCustom?: boolean;    // manually typed, not from catalog
    priceBeforeTax?: number; // precio unitario digitado antes de IVA (personalizados)
    taxRate?: number;        // 0, 0.05, 0.19, etc.
    weight?: number;       // kg por unidad (snapshot del producto al cotizar)
    length?: number;       // cm
    width?: number;        // cm
    height?: number;       // cm
}

export interface Quote {
    id: string;
    /**
     * Número legacy/display de la cotización. Antes era obligatorio, pero
     * desde 14-may-2026 (fix del race del contador) `addQuote` puede recibir
     * solo `quoteNumber` y resolver `number` server-side. Lo dejamos opcional
     * para que callers como el pipeline no tengan que duplicar el string al
     * pasárselo. addQuote garantiza que `number === quoteNumber` al persistir.
     */
    number?: string;
    client: string;
    clientId: string;
    clientEmail?: string;
    clientCompany?: string;
    /**
     * FK opcional a Company.id. Se resuelve desde el cliente al guardar la
     * cotización para que el detalle de empresa pueda mostrar todas sus
     * cotizaciones agrupadas. `clientCompany` (string) se mantiene como
     * snapshot para el PDF, que es congelado en el momento del envío.
     */
    companyId?: string;
    date: string;
    total: string;
    numericTotal: number;
    subtotal?: number;
    tax?: number;
    items?: QuoteItem[];
    notes?: string;
    shipping?: number;          // Costo de envío en COP (sumado antes del IVA)
    shippingCity?: string;      // Ciudad usada para calcular el envío
    shippingMode?: 'auto' | 'manual';  // 'auto' = calculado por reglas, 'manual' = override del vendedor
    totalWeight?: number;       // kg total del carrito (snapshot)
    totalVolume?: number;       // cm³ total del carrito (snapshot)
    // Campos comerciales (Word format)
    referencia?: string;        // REFERENCIA: descripción del proyecto
    validUntil?: string;        // Vigencia: "15 de Abril de 2026"
    deliveryTime?: string;      // Plazo de entrega
    paymentTerms?: string;      // Forma de pago (texto libre)
    /** Notas extras del vendedor — bloque opcional con bullets al final del PDF. */
    observations?: string;
    /**
     * Si true, el PDF no muestra el nombre del contacto (persona) — solo
     * empresa + ciudad. Default false (muestra ambos). Pedido del cliente
     * 16-may-2026 sobre cotizaciones a instituciones donde el destinatario
     * es la empresa sin persona específica.
     */
    hideContactName?: boolean;
    sellerPhone?: string;       // Teléfono del asesor
    sellerId?: string;
    sellerName?: string;
    // Ciclo de vida de aprobación:
    //   Draft → PendingApproval → Approved → Sent → Won/Lost
    //              │                 │
    //              ▼                 ▼ (si Resend falla: deliveryFailed=true)
    //         ChangesRequested    Sent (deliveryFailed? → retry)
    status: 'Draft' | 'PendingApproval' | 'ChangesRequested' | 'Approved' | 'Sent' | 'Rejected' | 'Expired' | 'PENDING_APPROVAL';
    // Fecha del último cambio de status — la estampa updateQuote. Permite
    // medir el ciclo real cotización→cierre (auditoría de gestión, jul-2026).
    statusChangedAt?: string;
    // Motivo de pérdida — se pide al marcar Rejected. Sin esto la gerencia no
    // sabe si se pierde por precio, tiempo de respuesta o producto.
    lossReason?: string;
    taskId?: string;
    // Estampa de "el negocio del pipeline se eliminó a propósito": la pone
    // deleteTask al borrar una task vinculada a esta cotización, y la
    // migración de huérfanos la respeta para NO re-crear el negocio en cada
    // boot (antes el deal borrado resucitaba con id t-mig-<quoteId>).
    pipelineTaskDeletedAt?: string;
    opens?: number;
    sentAt?: string;
    sentByName?: string;
    sentById?: string;
    // Legacy (fase anterior donde cada acción pedía aprobación individual). Se mantiene
    // para no romper datos históricos pero el flujo nuevo usa el `status` por cotización.
    pendingAction?: 'send_email' | 'send_whatsapp' | 'generate_pdf';
    requestedBy?: string;
    requestedByName?: string;
    requestedAt?: string;
    // ── Aprobación por cotización (flujo nuevo) ──────────────────────────────
    reviewNotes?: Array<{
        id: string;
        by: string;              // id del SuperAdmin
        byName: string;
        at: string;              // ISO timestamp
        action: 'approved' | 'changes_requested';
        comment?: string;        // obligatorio si action === 'changes_requested'
    }>;
    approvedBy?: string;
    approvedByName?: string;
    approvedAt?: string;
    // Si Resend falló después de aprobar, el vendedor ve botón "Reintentar envío"
    // sin tener que pasar de nuevo por aprobación.
    deliveryFailed?: boolean;
    deliveryError?: string;
    // Numeración ART-XXX-YYYY + versioning
    quoteNumber?: string;   // e.g. "ART-250-2026" (v1), "ART-250-V1-2026" (v2), "ART-250-V2-2026-AIU" (final)
    baseNumber?: string;    // base without version: "ART-250-2026"
    version?: number;       // 1=original (no V suffix), 2=V1, 3=V2...
    isAIU?: boolean;        // final AIU version (appends "-AIU")
    // Legacy AIU data (formato anterior donde AIU significaba "agregar transporte/descargue/
    // instalación con montos"). NUEVAS cotizaciones NO usan este objeto — el modelo nuevo es
    // adminPercent + utilityPercent + IVA-solo-sobre-utilidad. Se mantiene para que las
    // cotizaciones históricas (las pocas que ya salieron antes del cambio de modelo) sigan
    // viéndose correctamente con el PDF legacy.
    aiuData?: {
        supply?: string;
        transport?: string;
        installation?: string;
        transportPrice?: number;
        unloadPrice?: number;
        installationPrice?: number;
        totalAIU?: number;
    };

    // ── MODELO NUEVO (abril 2026) ──────────────────────────────────────────────
    //
    // El precio que viene de WooCommerce (price/regular_price) YA INCLUYE IVA del 19%.
    // En el PDF se muestra "valor unitario antes de IVA", que es precio_woo / 1.19.
    //
    // Tipos de cotización:
    //
    //   - 'simple': cotización normal. Productos + (transporte opcional). IVA 19% sobre
    //     todo el subtotal. Alcance dice "Sí/No incluye transporte" según el checkbox;
    //     descargue e instalación SIEMPRE dicen "No incluye".
    //
    //   - 'aiu': cotización bajo régimen de Administración + Utilidad (Estatuto
    //     Tributario, contratos asimilados a obra). El IVA del 19% aplica SÓLO sobre
    //     la línea de Utilidad — eso es lo que la hace "más barata" para el cliente
    //     final cuando el cliente patalea por el IVA full. El alcance dice "Sí incluye"
    //     en las 3 líneas porque transporte/descargue/instalación están absorbidos
    //     dentro del % de Administración (lo negocia el vendedor a mano). El número
    //     de la cotización lleva sufijo "-AIU".
    //
    // Si quoteMode es undefined → cotización heredada del modelo viejo. El PDF y los
    // listados las siguen renderizando con el formato legacy para no romper histórico.
    quoteMode?: 'simple' | 'aiu';

    // (modo simple) — el vendedor decide si la oferta cubre el transporte. Si está en
    // false o undefined, el alcance dice "No incluye transporte" y no aparece fila en
    // la tabla. Si está en true, se agrega una fila autogenerada
    // "TRANSPORTE DESDE FLORIDABLANCA HASTA {transportCity} SIN DESCARGUE" con el
    // monto `transportAmount`.
    includesTransport?: boolean;
    // Monto del transporte tal como lo escribe el vendedor. INCLUYE IVA — el sistema
    // lo divide entre 1.19 al armar el "antes de IVA" del PDF, igual que con los
    // productos de Woo.
    transportAmount?: number;
    // Ciudad destino del transporte (override). Si está vacío, se usa client.city.
    transportCity?: string;

    // (modo aiu) — porcentajes que el vendedor negocia con el cliente. Pueden ser 0.
    adminPercent?: number;
    utilityPercent?: number;

    // Texto que reemplaza el "se entrega en la ciudad de {client.city}" del Alcance.
    // Vacío → se autogenera con la ciudad. Útil cuando el vendedor quiere poner una
    // dirección específica (Calle 24 # 25-68 Bucaramanga, etc.).
    deliveryLocation?: string;

    // Días de validez de la oferta. Default 30, editable. La fecha mostrada en el PDF
    // se calcula como cotización.date + validityDays.
    validityDays?: number;
}

export interface Seller {
    id: string;
    name: string;
    avatar?: string;
    role: 'Vendedor' | 'Manager' | 'Admin' | 'SuperAdmin' | 'Auditor';
    email: string;
    phone?: string;
    username?: string;
    status: 'Activo' | 'Inactivo';
    sales?: string;
    commission?: string;
    password?: string;
    permissions?: Record<string, boolean>;
    /** When false this seller is skipped by the round-robin rotation for public leads.
     *  They can still use the CRM normally and register their own leads. Default true. */
    receivesLeads?: boolean;
    // Onboarding wizard progression:
    //   0 → never ran (next login triggers MANDATORY run — no skip button)
    //   1 → ran once (next login triggers OPTIONAL run — skip allowed)
    //   2+ → done forever, never shown again
    onboardingCount?: number;
}

export interface Notification {
    id: string;
    title: string;
    description: string;
    time: string;
    type: 'lead' | 'ai' | 'alert' | 'success' | 'task' | 'order';
    read: boolean;
    forAdmin?: boolean;
    quoteId?: string;
    targetUserId?: string;
    clientId?: string;
}

export interface AuditLog {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    action: 'QUOTE_CREATED' | 'QUOTE_SENT' | 'SALE_REGISTERED' | 'CLIENT_CONTACTED' | 'LEAD_CREATED' | 'SYSTEM_LOGIN' | 'SYSTEM_LOGOUT' | 'TASK_DELETED' | 'SETTINGS_CHANGED' | 'WHATSAPP_SENT' | 'CALL_MADE' | 'LEAD_STATUS_CHANGE' | 'QUOTE_APPROVAL_REQUESTED' | 'QUOTE_APPROVED' | 'QUOTE_REJECTED' | 'QUOTE_CHANGES_REQUESTED';
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
    dimensions: string;          // Formato display "LxWxH cm" (retrocompatible)
    length?: number;             // cm — viene de WooCommerce dimensions.length
    width?: number;              // cm — viene de WooCommerce dimensions.width
    height?: number;             // cm — viene de WooCommerce dimensions.height
    weight?: number;             // kg — viene de WooCommerce weight
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

/**
 * Configuración de una etapa del pipeline. El equipo puede agregar, renombrar
 * o reordenar etapas desde /settings sin tocar código. Reglas de negocio:
 *
 *  - El pipeline arranca cuando una cotización entra al sistema (default
 *    "Cotizado"). Los leads sin cotización viven sólo en /clients, no en el
 *    kanban — ahí el vendedor los enriquece y dispara la cotización.
 *
 *  - `autoOnQuoteOpen`: cuando el cliente abre el correo/PDF de la cotización
 *    (vía /api/track-open), la tarjeta salta automáticamente a esta etapa.
 *    Sólo una etapa puede tener este flag activo a la vez (la primera que lo
 *    tenga gana).
 *
 *  - `isWinStage`: marcar la etapa "ganada" o "facturada" — al mover una
 *    tarjeta a esta columna se actualiza la cotización a `Approved`. También
 *    una sola etapa puede tener este flag.
 *
 *  - "Perdido" no es una etapa propia del kanban: se registra como un estado
 *    aparte en la cotización (status='Rejected') que aparece en la ficha del
 *    cliente pero no infla el pipeline visible.
 */
export interface PipelineStage {
    id: string;
    label: string;
    /** Tailwind color name (ej. 'blue', 'amber', 'emerald') — se mapea a clases pre-tokeneadas. */
    color: string;
    autoOnQuoteOpen?: boolean;
    isWinStage?: boolean;
}

/** Default que se usa cuando no hay nada guardado todavía. */
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
    { id: 'cotizado',  label: 'Cotizado',    color: 'blue' },
    { id: 'caliente',  label: 'En caliente', color: 'amber',   autoOnQuoteOpen: true },
    { id: 'facturado', label: 'Facturado',   color: 'emerald', isWinStage: true },
];

export interface AppSettings {
    cities: City[];
    sectors: string[];
    allowExports: boolean;
    blockScreenshots: boolean;
    productionEmails: string[];
    fromEmail: string;
    businessWhatsapp?: string;
    geminiKey?: string;
    resendKey?: string;
    wooUrl?: string;
    wooKey?: string;
    wooSecret?: string;
    googleClientId?: string;
    googleAdsId?: string;
    ga4PropertyId?: string;
    whatsapp: WhatsAppConfig;
    botSettings?: BotSettings;
    // Quote numbering
    quotePrefix?: string;       // default 'ART'
    quoteNextNumber?: number;   // next sequential number, starts at 250
    quoteYear?: number;         // current year for numbering
    // Master ON/OFF for automatic quote sending across public digital channels.
    // OFF (default): every incoming quote stays as 'Draft', the lead is assigned to the next
    //                vendor in rotation, and the seller reviews + sends manually.
    // ON: quotes are created as 'Sent' AND the email is dispatched automatically.
    // Granular per-channel overrides live in `autoSendChannels`.
    autoSendPublicQuotes?: boolean;
    // Per-channel toggles. Only take effect when `autoSendPublicQuotes` is true.
    // Missing/undefined channel = treated as true (auto-send when master is ON).
    autoSendChannels?: {
        web?: boolean;          // cotizador web (/api/public/quote-request)
        woo?: boolean;          // WooCommerce (/api/woo-quote)
        whatsapp?: boolean;     // reservado — hoy WhatsApp solo crea leads
        bot?: boolean;          // reservado — hoy ConcreBOT solo crea leads
    };
    // CC interno que recibe copia cuando se dispara un envío automático.
    // Si queda vacío, se usa el default hardcoded del endpoint (marketing@arteconcreto.co).
    autoSendCopyEmail?: string;
    // Cálculo de envío para cotizaciones finales
    shipping?: ShippingSettings;
    // Informe Diario — correo automático con resumen de actividad por vendedor
    dailyReport?: DailyReportSettings;
    // Pipeline configurable. Si está vacío/undefined, el pipeline usa
    // DEFAULT_PIPELINE_STAGES (Cotizado → En caliente → Facturado).
    pipelineStages?: PipelineStage[];
}

export interface DailyReportSettings {
    enabled: boolean;               // master switch
    recipients: string[];           // sellerIds que reciben el correo (además de los emails extra)
    extraEmails: string[];          // emails externos que NO están en la lista de vendedores
    sendTime: string;               // "HH:MM" — legado (ya no se usa para gating; el cron de Vercel define la hora)
    weekdaysOnly: boolean;          // true = lun-vie, false = todos los días
    /**
     * Último envío de cada tipo de cierre. Antes era un string ISO único (sólo
     * cierre diario). Ahora soportamos cierre diario, semanal y mensual con
     * dedup independiente. El cron persiste el formato nuevo; los settings
     * legados se siguen leyendo como `{ daily: <string viejo> }`.
     */
    lastSentAt?: string | { daily?: string; weekly?: string; monthly?: string };
}

export interface ShippingCityRate {
    city: string;           // nombre de la ciudad (match con client.city, case-insensitive)
    ratePerKg: number;      // COP por kg en esta ciudad
    minimumCharge?: number; // cargo mínimo si el peso calculado da muy bajo
}

export interface ShippingSettings {
    enabled: boolean;              // si false, no se muestra línea de envío
    defaultRatePerKg: number;      // COP/kg para ciudades no listadas (fallback)
    defaultMinimumCharge: number;  // cargo mínimo global (COP)
    volumetricDivisor: number;     // cm³ por kg volumétrico (estándar 5000 para terrestre)
    cityRates: ShippingCityRate[]; // override por ciudad
}

export interface BotScheduleDay {
    enabled: boolean;
    start: string; // "HH:MM"
    end: string;   // "HH:MM"
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
    schedule?: {
        enabled: boolean;
        timezone: string;
        days: {
            mon: BotScheduleDay;
            tue: BotScheduleDay;
            wed: BotScheduleDay;
            thu: BotScheduleDay;
            fri: BotScheduleDay;
            sat: BotScheduleDay;
            sun: BotScheduleDay;
        };
        offlineMessage: string;
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
    companies: Company[];
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
    /** Re-fetch /api/clients y reemplaza el state local. Útil cuando otra
     *  pestaña o usuario sube/edita contactos y la pestaña actual quedó
     *  con un snapshot viejo (la app sólo hace syncSharedData al boot). */
    refreshClients: () => Promise<void>;
    /** Re-fetch /api/companies idem. */
    refreshCompanies: () => Promise<void>;
    /** Cuántos leads crudos tiene asignados el usuario logueado y todavía no
     *  trabajó (status='assigned'). Alimenta el badge "tenés N por trabajar"
     *  en el sidebar y el mobile nav para que sea EVIDENTE qué le asignaron. */
    assignedLeadsCount: number;
    /** Re-fetch del conteo de leads asignados (badge). Se llama al boot, al
     *  volver al tab, y después de que el vendedor trabaja un lead. */
    refreshAssignedLeadsCount: () => Promise<void>;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;

    addClient: (client: Omit<Client, 'id'>) => string;
    /** Crea una empresa (o devuelve la existente si el nombre ya está registrado). */
    addCompany: (name: string) => Promise<Company | null>;
    /** Renombra una empresa. Devuelve `{ ok: true }` o un mensaje de error legible (e.g. nombre duplicado). */
    updateCompany: (id: string, name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
    /** Borra la empresa. Los contactos asociados pierden el FK pero conservan el nombre como snapshot. */
    deleteCompany: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
    addTask: (task: Omit<Task, 'id'>) => string;
    addQuote: (quote: Omit<Quote, 'id'>) => Promise<string>;
    createQuoteVersion: (quoteId: string) => Promise<string>;
    createAIUVersion: (quoteId: string) => Promise<string>;
    importClients: (rows: Omit<Client, 'id'>[]) => void;
    importQuotes: (rows: Omit<Quote, 'id'>[]) => void;
    clearTestData: () => void;
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
    updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
    updateForm: (id: string, form: Partial<FormDefinition>) => void;
    deleteForm: (id: string) => void;

    markNotificationAsRead: (id: string) => void;
    clearNotifications: () => void;
    removeNotification: (id: string) => void;
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    addAnomaly: (anomaly: Omit<Anomaly, 'id' | 'timestamp' | 'status'>) => void;
    updateAnomaly: (anomalyId: string, updates: Partial<Anomaly>) => void;
    deleteAnomaly: (anomalyId: string) => void;
    updateProduct: (id: string, updates: Partial<Product>) => void;
    deleteProduct: (id: string) => void;
    purgeOldAuditLogs: () => void;
    // Onboarding wizard — persists the user's run count to the server and updates local state.
    incrementOnboardingCount: () => Promise<number>;
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

// Score-based dedup para `quotes`. Si dos cotizaciones comparten el mismo
// quoteNumber (race condition del contador entre dos sesiones, p.ej. Juan
// en QuoteEngine + Lisseth en pipeline al mismo tiempo), elegimos la que
// tiene MÁS data — no la que tiene el id más nuevo. Antes el algoritmo
// "higher id wins" descartaba cotizaciones llenas (con items, subtotal,
// tax) en favor de versiones minimal-shape del pipeline.
//
// Score: 1 punto por cada campo "significativo" presente. Si empate,
// gana la de id más alto (tiebreaker estable).
function scoreQuoteCompleteness(q: Quote): number {
    let s = 0;
    if (Array.isArray(q.items) && q.items.length > 0) s += 5; // items pesa más
    if (typeof q.subtotal === 'number' && q.subtotal > 0) s += 2;
    if (typeof q.tax === 'number' && q.tax > 0) s += 2;
    if (q.clientEmail && q.clientEmail.trim()) s += 1;
    if (q.clientCompany && q.clientCompany.trim()) s += 1;
    if (q.sellerPhone && q.sellerPhone.trim()) s += 1;
    if (q.referencia && q.referencia.trim()) s += 1;
    if (q.validUntil && q.validUntil.trim()) s += 1;
    if (q.observations && q.observations.trim()) s += 1;
    return s;
}

export function dedupQuotesByCompleteness(quotes: Quote[]): Quote[] {
    const byNumber = new Map<string, Quote>();
    for (const q of quotes) {
        const key = q.quoteNumber || q.id;
        const prev = byNumber.get(key);
        if (!prev) {
            byNumber.set(key, q);
            continue;
        }
        const scoreQ = scoreQuoteCompleteness(q);
        const scorePrev = scoreQuoteCompleteness(prev);
        if (scoreQ > scorePrev) {
            byNumber.set(key, q);
        } else if (scoreQ === scorePrev && (q.id || '') > (prev.id || '')) {
            byNumber.set(key, q);
        }
    }
    return Array.from(byNumber.values());
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
    // Las empresas viven en crm_companies (Postgres). En localStorage sólo
    // las cacheamos para el primer paint mientras llega el GET; la fuente de
    // verdad es siempre el server.
    const [companies, setCompanies] = useState<Company[]>(() => loadData('crm_companies_cache', []));
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
    // Badge "leads por trabajar": cuántos leads crudos tiene asignados el
    // vendedor logueado y aún no contactó (status='assigned').
    const [assignedLeadsCount, setAssignedLeadsCount] = useState(0);

    const persistSharedState = (patch: Record<string, unknown>) => {
        // Antes este fetch tragaba TODO error en silencio (`.catch(console.warn)`).
        // Eso ocultó por meses el bug del informe diario: el toggle se veía ON en
        // la UI (state local) pero el PUT a /api/state retornaba 503 en algún
        // momento y el dailyReport.enabled nunca llegó al row de Postgres. El cron
        // leía el row viejo y se saltaba el envío con "disabled".
        //
        // Ahora: verificamos status. Si falla, lo logueamos visiblemente (console.error)
        // y para los settings críticos disparamos una notificación. No reintentamos
        // automáticamente — la UI siguiente cambio fuerza otra escritura.
        fetch('/api/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        }).then(async (res) => {
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                console.error('[persistSharedState] PUT /api/state failed:', res.status, body, 'patch keys:', Object.keys(patch));
                if (patch.settings) {
                    // Settings es el patch que activa el informe diario y otros toggles
                    // críticos; si no se guardó, el user debe saberlo en vez de creer
                    // que está activo cuando en realidad la DB tiene el valor viejo.
                    addNotification({
                        title: 'No se pudo guardar la configuración',
                        description: `Error ${res.status} al persistir cambios. Recargá y volvé a tocar el toggle.`,
                        type: 'alert',
                    });
                }
            }
        }).catch((error) => {
            console.error('[persistSharedState] network error:', error, 'patch keys:', Object.keys(patch));
        });
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
        autoSendPublicQuotes: false,
        autoSendChannels: { web: true, woo: true, whatsapp: true, bot: true },
        autoSendCopyEmail: '',
        productionEmails: [],
        fromEmail: 'ordenes@arteconcreto.co',
        businessWhatsapp: '573178929477',
        quotePrefix: 'ART',
        quoteNextNumber: 300,
        quoteYear: new Date().getFullYear(),
        geminiKey: '',
        resendKey: '',
        dailyReport: {
            enabled: false,
            recipients: [],
            extraEmails: [],
            sendTime: '19:00',
            weekdaysOnly: true,
        },
        pipelineStages: DEFAULT_PIPELINE_STAGES,
        shipping: {
            enabled: true,
            defaultRatePerKg: 3500,        // COP/kg fallback nacional
            defaultMinimumCharge: 80000,   // cargo mínimo COP
            volumetricDivisor: 5000,       // estándar terrestre: 1 kg volumétrico = 5000 cm³
            cityRates: [
                { city: 'Bucaramanga', ratePerKg: 1500, minimumCharge: 40000 },
                { city: 'Floridablanca', ratePerKg: 1500, minimumCharge: 40000 },
                { city: 'Girón', ratePerKg: 1500, minimumCharge: 40000 },
                { city: 'Piedecuesta', ratePerKg: 1500, minimumCharge: 40000 },
                { city: 'Bogotá', ratePerKg: 2800, minimumCharge: 70000 },
                { city: 'Medellín', ratePerKg: 2800, minimumCharge: 70000 },
                { city: 'Cali', ratePerKg: 3200, minimumCharge: 80000 },
            ],
        },
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

    const refreshClients = async () => {
        try {
            const res = await fetch('/api/clients', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data.clients)) setClients(data.clients);
        } catch (error) {
            console.warn('refreshClients failed:', error);
        }
    };

    const refreshCompanies = async () => {
        try {
            const res = await fetch('/api/companies', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data.companies)) {
                setCompanies(data.companies);
                try { localStorage.setItem('crm_companies_cache', JSON.stringify(data.companies)); } catch {}
            }
        } catch (error) {
            console.warn('refreshCompanies failed:', error);
        }
    };

    // Conteo de leads crudos asignados a MÍ y todavía sin trabajar
    // (status='assigned'). El GET de /api/raw-leads ya escopa por dueño cuando
    // el rol no es Admin/SuperAdmin, así que `counts.assigned` es exactamente la
    // cola pendiente del vendedor logueado. Pedimos pageSize=1 porque solo nos
    // interesa el número del badge, no las filas.
    const refreshAssignedLeadsCount = async () => {
        try {
            const res = await fetch('/api/raw-leads?status=assigned&pageSize=1', { cache: 'no-store' });
            if (!res.ok) { setAssignedLeadsCount(0); return; }
            const data = await res.json();
            setAssignedLeadsCount(data?.counts?.assigned || 0);
        } catch (error) {
            console.warn('refreshAssignedLeadsCount failed:', error);
        }
    };

    // Revalida quotes y tasks contra la DB. Útil al volver al tab para que
    // Valentina (que aprueba) vea cotizaciones nuevas que subieron los
    // vendedores, y para que los vendedores vean cambios de status que hizo
    // Valentina (Approved/ChangesRequested) sin necesidad de F5.
    //
    // Aplica la misma dedup-por-quoteNumber que el boot inicial — si dos rows
    // comparten quoteNumber, gana la de id más alto (la más reciente).
    const refreshQuotesAndTasks = async () => {
        try {
            const res = await fetch('/api/state?keys=quotes,tasks', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data.quotes)) {
                setQuotes(dedupQuotesByCompleteness(data.quotes as Quote[]));
            }
            if (Array.isArray(data.tasks)) setTasks(data.tasks);
        } catch (error) {
            console.warn('refreshQuotesAndTasks failed:', error);
        }
    };

    const refreshProducts = async () => {
        const attemptAt = new Date().toISOString();
        setProductSyncStatus(prev => ({
            ...prev,
            lastAttemptAt: attemptAt,
            message: 'Sincronizando catalogo desde WooCommerce...',
        }));

        try {
            const wooHeaders: Record<string, string> = {};
            if (settings.wooUrl) wooHeaders['x-woo-url'] = settings.wooUrl;
            if (settings.wooKey) wooHeaders['x-woo-key'] = settings.wooKey;
            if (settings.wooSecret) wooHeaders['x-woo-secret'] = settings.wooSecret;

            const res = await fetch('/api/woocommerce', { headers: wooHeaders });
            const data = await res.json();

            if (!res.ok || data.error) {
                const msg = data?.error || `HTTP ${res.status}`;
                throw new Error(msg);
            }

            const mapped: Product[] = data.map((wooP: any) => {
                // WooCommerce returns dimensions as strings ("0" si está vacío) — parsear a number o undefined
                const toNum = (v: any): number | undefined => {
                    if (v === undefined || v === null || v === '') return undefined;
                    const n = parseFloat(v);
                    return Number.isFinite(n) && n > 0 ? n : undefined;
                };
                const len = toNum(wooP.dimensions?.length);
                const wid = toNum(wooP.dimensions?.width);
                const hei = toNum(wooP.dimensions?.height);
                const wgt = toNum(wooP.weight);
                // Formato legible: "120 × 80 × 60 cm" (con espacios y signo de
                // multiplicar real). Sirve para mostrarse en tarjetas, PDF e
                // inventario sin más procesamiento.
                const dimsStr = (len && wid && hei) ? `${len} × ${wid} × ${hei} cm` : '';

                return {
                    id: wooP.id.toString(),
                    name: wooP.name,
                    category: wooP.categories?.[0]?.name || 'Urban',
                    sku: wooP.sku || `SKU-${wooP.id}`,
                    stock: wooP.stock_quantity || 0,
                    isStockTracked: wooP.manage_stock,
                    price: parseFloat(wooP.regular_price || wooP.price || '0'),
                    salePrice: wooP.sale_price ? parseFloat(wooP.sale_price) : undefined,
                    shortDescription: wooP.short_description?.replace(/<[^>]+>/g, '') || '',
                    dimensions: dimsStr,
                    length: len,
                    width: wid,
                    height: hei,
                    weight: wgt,
                    status: wooP.stock_status === 'instock' ? 'In Stock' : (wooP.stock_status === 'onbackorder' ? 'Production' : 'Out of Stock'),
                    image: wooP.images?.[0]?.src || '',
                    gallery: wooP.images?.map((img: any) => img.src) || [],
                    wooId: wooP.id,
                    slug: wooP.slug,
                    isActive: wooP.status === 'publish',
                    isDeleted: false
                };
            });

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
                const [meRes, teamRes, clientsRes, companiesRes, stateRes] = await Promise.all([
                    fetch('/api/auth/me', { cache: 'no-store' }),
                    fetch('/api/team', { cache: 'no-store' }),
                    fetch('/api/clients', { cache: 'no-store' }),
                    fetch('/api/companies', { cache: 'no-store' }),
                    fetch('/api/state', { cache: 'no-store' })
                ]);

                // /api/auth/me is THE source of truth for session validity.
                // If it returns 200 with a user, the cookie is good — even if
                // other endpoints are transiently returning 401 (cold start,
                // DB blip, rate limit). Only treat a 401 FROM /api/auth/me
                // ITSELF as a real logout signal, and never call
                // /api/auth/logout preemptively: destroying the cookie turns
                // every transient hiccup into a permanent sign-out.
                if (meRes.ok) {
                    const meData = await meRes.json();
                    if (meData.user) setCurrentUser(meData.user);
                } else if (meRes.status === 401 && isProduction) {
                    // Clear the in-memory user so protected routes don't
                    // render stale data — but leave the cookie alone. If it
                    // was a blip the next refresh will recover; if the cookie
                    // really is invalid the user will be redirected to /login
                    // by the route guards and re-authenticate normally.
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

                if (companiesRes.ok) {
                    const companiesData = await companiesRes.json();
                    if (Array.isArray(companiesData.companies)) {
                        setCompanies(companiesData.companies);
                        try { localStorage.setItem('crm_companies_cache', JSON.stringify(companiesData.companies)); } catch {}
                    }
                }

                if (stateRes.ok) {
                    const stateData = await stateRes.json();
                    if (Array.isArray(stateData.tasks)) setTasks(stateData.tasks);
                    if (Array.isArray(stateData.quotes)) {
                        // Dedup por quoteNumber: si dos sesiones generaron el
                        // mismo número por race condition del contador, elegimos
                        // la cotización con MÁS DATOS REALES (items, subtotal,
                        // tax, sellerName explícito) en vez de la "más reciente
                        // por id". Caso real 13-may-2026: Juan creó ART-353
                        // con productos vía QuoteEngine y Lisseth creó otro
                        // ART-353 vacío vía pipeline; el dedup viejo "higher
                        // id wins" tiraba la full de Juan a la basura.
                        //
                        // No persistimos el dedup de vuelta a DB — solo
                        // arreglamos la vista. Mantener los duplicados en
                        // crm_state nos da chance de recuperar data si el
                        // score-pick fue incorrecto.
                        setQuotes(dedupQuotesByCompleteness(stateData.quotes as Quote[]));
                    }
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
                // Badge de leads por trabajar (fire-and-forget; la cookie ya se
                // validó en el /api/auth/me de arriba).
                refreshAssignedLeadsCount();
            }
        };

        syncSharedData();
    }, [isProduction]);

    // ── Revalidate on tab focus ──────────────────────────────────────────────
    // Por qué: el syncSharedData de arriba sólo corre al montar el AppProvider
    // (una vez por SPA boot). Si Valentina deja la pestaña abierta horas y
    // mientras tanto otros vendedores suben contactos o cotizaciones, ella
    // sigue viendo el snapshot inicial. Cuando vuelve al tab, revalidamos
    // contra la DB para que la pantalla refleje la verdad sin necesidad de F5.
    //
    // Incluye quotes/tasks: caso reportado 13-may-2026 — Lisseth creó
    // ART-352/ART-353 y Valentina (que ya las había autorizado en otra
    // sesión) no las veía en /quotes hasta hacer F5 manual.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onFocus = () => { refreshClients(); refreshCompanies(); refreshQuotesAndTasks(); refreshAssignedLeadsCount(); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') onFocus();
        });
        return () => {
            window.removeEventListener('focus', onFocus);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Migration: auto-create pipeline tasks for quotes that don't have one ──
    useEffect(() => {
        if (isInitialLoad) return; // wait for data to fully load
        setQuotes(prevQuotes => {
            setTasks(prevTasks => {
                const quoteIdsWithTask = new Set(prevTasks.map(t => (t as any).quoteId).filter(Boolean));
                // pipelineTaskDeletedAt = el negocio se eliminó a propósito
                // desde el kanban; re-crearlo acá desharía ese borrado en cada
                // boot (bug de resurrección t-mig-<quoteId>, jul-2026).
                const orphanQuotes = prevQuotes.filter(q => q.id && !quoteIdsWithTask.has(q.id) && !q.pipelineTaskDeletedAt);
                if (orphanQuotes.length === 0) return prevTasks;

                const stageMap: Record<string, string> = {
                    Draft: 'proposal', Sent: 'proposal', Viewed: 'contacted',
                    Approved: 'won', Rejected: 'won',
                    PendingApproval: 'proposal', ChangesRequested: 'proposal',
                    PENDING_APPROVAL: 'proposal', // legacy
                };

                const newTasks: Task[] = orphanQuotes.map(q => ({
                    id: `t-mig-${q.id}`,
                    title: q.client || 'Lead',
                    client: q.clientCompany || q.client || '',
                    clientId: q.clientId || '',
                    contactName: q.client || '',
                    value: q.total || '$0',
                    numericValue: q.numericTotal || 0,
                    priority: 'Medium' as const,
                    tags: ['cotización'],
                    aiScore: (q as any).score || 50,
                    source: 'Cotización CRM',
                    assignedTo: (q as any).sellerName || '',
                    email: q.clientEmail || '',
                    activities: [{
                        id: `act-mig-${q.id}`,
                        type: 'system' as const,
                        content: `Cotización ${q.number || q.id} (migrada al pipeline automáticamente).`,
                        timestamp: new Date(),
                    }],
                    quoteId: q.id,
                    stageId: stageMap[q.status || 'Draft'] || 'proposal',
                }));

                const nextTasks = [...prevTasks, ...newTasks];
                persistSharedState({ tasks: nextTasks });
                return nextTasks;
            });
            return prevQuotes;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitialLoad]);

    // ── Migration: tag legacy quotes with `quoteMode` ────────────────────────
    // Antes de abril 2026 el modelo de cotización no tenía un campo `quoteMode`
    // explícito — la única señal era el flag booleano `isAIU`. El modelo nuevo
    // bifurca por `quoteMode = 'simple' | 'aiu'`. Este efecto corre una vez
    // después de que se hidrata la data y back-fill el campo en cualquier
    // cotización que todavía no lo tenga.
    //
    // Lo que NO toca:
    //   - `numericTotal`, `total`, `subtotal`, `tax` — esos quedan exactamente
    //     como se guardaron (los vendedores y los clientes ya vieron esos
    //     números, no podemos cambiarlos retroactivamente).
    //   - `aiuData` (objeto legacy con montos hardcoded) — se conserva. El PDF
    //     detecta `aiuData.totalAIU` y dispara la rama de render legacy aunque
    //     `quoteMode` esté seteado. Esto es lo que evita que las ~2-4 AIU
    //     viejas que ya se enviaron con el modelo viejo cambien de números.
    //   - El consecutivo (`number`, `quoteNumber`, `baseNumber`, `version`) —
    //     tagueamos sin tocar la numeración.
    //
    // Idempotente: una vez que todas tienen `quoteMode`, no hace nada.
    useEffect(() => {
        if (isInitialLoad) return;
        setQuotes(prev => {
            const needsMigration = prev.some(q => q.quoteMode === undefined);
            if (!needsMigration) return prev;
            const migrated = prev.map(q => {
                if (q.quoteMode !== undefined) return q;
                const inferredMode: 'simple' | 'aiu' = q.isAIU ? 'aiu' : 'simple';
                return { ...q, quoteMode: inferredMode };
            });
            persistSharedState({ quotes: migrated });
            return migrated;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                action: 'SYSTEM_LOGOUT',
                details: `Sesión cerrada`,
                verified: true
            });
        }
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);

        const keysToClear = [
            'crm_current_user',
            'crm_clients',
            'crm_tasks',
            'crm_quotes',
            'crm_sellers',
            'crm_notifications',
            'crm_audit_logs_v_final',
            'crm_anomalies_v_final',
            'crm_events',
            'crm_inventory_products',
            'crm_forms',
            'crm_product_sync_status',
        ];
        keysToClear.forEach(k => { try { localStorage.removeItem(k); } catch {} });

        setCurrentUser(null);
        setClients([]);
        setTasks([]);
        setQuotes([]);
        setSellers([]);
        setNotifications([]);
        setAuditLogs([]);
        setAnomalies([]);
        setEvents([]);
        setProducts([]);
        setForms([]);
    };

    // --- Actions ---

    const addClient = (client: Omit<Client, 'id'>) => {
        // ID con timestamp + sufijo aleatorio para evitar colisiones cuando el
        // user crea varios contactos en el mismo milisegundo (bulk import,
        // doble-click rápido). Antes era sólo Date.now() y dos creaciones
        // simultáneas pisaban la misma fila vía ON CONFLICT (id) DO UPDATE.
        const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        // Auto-assign to the logged-in seller if no explicit assignment was provided.
        // Admin/Manager/SuperAdmin can create clients on behalf of others by passing assignedTo,
        // but Vendedores always end up as the owner of their own creations.
        const autoAssignedTo = client.assignedTo || currentUser?.id;
        const autoAssignedToName = client.assignedToName || currentUser?.name;
        const newClient: Client = {
            ...client,
            id,
            assignedTo: autoAssignedTo,
            assignedToName: autoAssignedToName,
        };
        setClients(prev => [...prev, newClient]);
        // Persistencia + manejo de error visible para el user. Antes el .catch
        // sólo consoleaba — si el server rechazaba el insert (e.g. duplicado
        // de email) el cliente quedaba en localStorage pero nunca en DB, y al
        // refrescar desaparecía. Ahora si vuelve no-OK lo notificamos.
        fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newClient),
        }).then(async res => {
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                addNotification({
                    title: 'No se pudo guardar el contacto',
                    description: data?.error || `Error ${res.status} al persistir ${newClient.name}.`,
                    type: 'alert',
                });
                // Rollback local: si el server lo rechazó, sacamos al cliente
                // del state así no se ve en la UI un registro fantasma.
                setClients(prev => prev.filter(c => c.id !== id));
            }
        }).catch((error) => {
            console.warn('Failed to persist client:', error);
            // Rollback local también en error de red. Antes solo notificábamos
            // y dejábamos al cliente en state — el siguiente F5 lo barría
            // (porque /api/clients no lo tenía) y el vendedor sentía que "se
            // perdió el contacto". Síntoma reportado 14-may-2026: "a veces
            // suben clientes y nunca quedan guardados". Ahora si la red falla,
            // el cliente desaparece de la UI inmediatamente y la notificación
            // pide que se vuelva a intentar.
            setClients(prev => prev.filter(c => c.id !== id));
            addNotification({
                title: 'Error de red al guardar contacto',
                description: `No se pudo guardar ${newClient.name}. Revisá la conexión e intentalo otra vez.`,
                type: 'alert',
            });
        });

        // Taxonomy bootstrap: if the seller registered a client with a city/sector that
        // isn't in the shared catalog yet, add it. Works for every role — the whole team
        // benefits because this persists into crm_state.settings which everyone reads.
        const needsCity = newClient.city && !settings.cities.some(c => c.name.trim().toLowerCase() === newClient.city.trim().toLowerCase());
        const needsSector = newClient.category && !settings.sectors.some(s => s.trim().toLowerCase() === newClient.category.trim().toLowerCase());
        if (needsCity || needsSector) {
            setSettings(prev => {
                const next = {
                    ...prev,
                    cities: needsCity ? [...prev.cities, { name: newClient.city, department: '' }] : prev.cities,
                    sectors: needsSector ? [...prev.sectors, newClient.category] : prev.sectors,
                };
                persistSharedState({ settings: sanitizeSettingsForStorage(next) });
                return next;
            });
        }

        addNotification({
            title: newClient.status === 'Lead' ? 'Nuevo lead registrado' : 'Nuevo cliente registrado',
            description: `${newClient.name}${newClient.company ? ' · ' + newClient.company : ''}`,
            type: 'lead',
        });

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

    const addQuote = async (quote: Omit<Quote, 'id'>): Promise<string> => {
        const clientForQuote = quote.clientId ? clients.find(c => c.id === quote.clientId) : undefined;
        const sellerId = quote.sellerId || currentUser?.id || clientForQuote?.assignedTo || '';
        const sellerName = quote.sellerName || currentUser?.name || clientForQuote?.assignedToName || '';

        // ── DEDUP GUARD ─────────────────────────────────────────────────────
        // Si llega con un quoteNumber que YA existe en memoria, significa que
        // alguien clickeó el botón dos veces o está re-entrando desde un
        // estado stale. En vez de crear duplicado, actualizamos el existente
        // y devolvemos su id. Esto arregla el bug histórico donde un mismo
        // ART-XXX aparecía varias veces en la cola de aprobaciones.
        if (quote.quoteNumber) {
            const dup = quotes.find(q => q.quoteNumber === quote.quoteNumber);
            if (dup) {
                updateQuote(dup.id, { ...quote, sellerId, sellerName });
                return dup.id;
            }
        }

        const quoteId = `q-${Date.now()}`;
        const taskId = `t-qt-${quoteId}`;

        // Auto-generate quote number ART-XXX-YYYY si no vino explícito.
        // FIX DEFINITIVO 14-may-2026: usamos un endpoint server-side que
        // hace INCREMENT atómico del contador en una sola sentencia SQL.
        // Antes dos sesiones podían leer settings.quoteNextNumber=352
        // simultáneamente (cada tab tenía su propio React state stale),
        // ambas generaban ART-352, ambas guardaban → duplicate quote y
        // pérdida garantizada al primer dedup. Ahora el server serializa
        // los increments por row-lock de Postgres y cada llamada recibe
        // un número único garantizado.
        //
        // Fallback al método viejo (local counter) si el endpoint falla
        // — preferimos cotización con número potencialmente duplicado
        // antes que bloquear al vendedor por una falla de red.
        let quoteNumber = quote.quoteNumber;
        let baseNumber  = quote.baseNumber;
        if (!quoteNumber) {
            try {
                const r = await fetch('/api/quotes/reserve-number', {
                    method: 'POST',
                    cache: 'no-store',
                });
                if (r.ok) {
                    const data = await r.json();
                    if (typeof data.quoteNumber === 'string' && data.quoteNumber) {
                        quoteNumber = data.quoteNumber;
                        baseNumber = quoteNumber;
                        // Espejamos el contador en settings local para que la
                        // UI de /settings muestre el próximo número actualizado
                        // sin esperar al siguiente full-sync.
                        if (typeof data.number === 'number') {
                            setSettings(prev => ({ ...prev, quoteNextNumber: data.number + 1 }));
                        }
                    }
                }
            } catch (err) {
                console.warn('[addQuote] reserve-number failed, falling back to local counter', err);
            }
            // Fallback (local counter, race-prone — solo si el endpoint falló)
            if (!quoteNumber) {
                const prefix  = settings.quotePrefix  || 'ART';
                const year    = settings.quoteYear    || new Date().getFullYear();
                const num     = settings.quoteNextNumber ?? 300;
                quoteNumber = `${prefix}-${num}-${year}`;
                baseNumber  = quoteNumber;
                setSettings(prev => {
                    const next = { ...prev, quoteNextNumber: (prev.quoteNextNumber ?? 300) + 1 };
                    persistSharedState({ settings: sanitizeSettingsForStorage(next) });
                    return next;
                });
            }
        }

        // Auto-create a pipeline task in "Propuesta Enviada" stage
        const autoTask: Task = {
            id: taskId,
            title: quote.client || 'Lead',
            client: quote.clientCompany || quote.client || '',
            clientId: quote.clientId || '',
            contactName: quote.client || '',
            value: quote.total || '$0',
            numericValue: quote.numericTotal || 0,
            priority: 'Medium',
            tags: ['cotización'],
            aiScore: 50,
            source: 'Cotización CRM',
            assignedTo: sellerName,
            email: quote.clientEmail || '',
            activities: [{
                id: `act-${Date.now()}`,
                type: 'system',
                content: `Cotización ${quoteNumber} generada en el CRM.`,
                timestamp: new Date(),
            }],
            quoteId: quoteId,
            stageId: 'proposal',
            // El deal nace HOY aunque el número de la cotización traiga un año
            // viejo (re-versiones tipo ART-943-2025-V4): sin esta estampa el
            // tablero lo archivaría bajo ese año y desaparecería del mes actual.
            retakenAt: new Date().toISOString(),
        };

        setTasks(prev => {
            const next = [...prev, autoTask];
            persistSharedState({ tasks: next });
            return next;
        });

        setQuotes(prev => {
            const next = [...prev, {
                ...quote,
                id: quoteId,
                taskId,
                quoteNumber,
                // Si el caller no pasó `number` explícito (p.ej. el flujo del
                // pipeline "Crear nuevo negocio"), usar el quoteNumber generado
                // para que `number` y `quoteNumber` queden coherentes. Antes
                // pipeline pasaba `number="QT-YYYY-XXXXX"` y quedaba con dos
                // identificadores incoherentes en la misma cotización.
                number: quote.number || quoteNumber,
                baseNumber: baseNumber || quoteNumber,
                version: quote.version || 1,
                sellerId,
                sellerName,
            }];
            persistSharedState({ quotes: next });
            return next;
        });

        addNotification({
            title: 'Cotización creada',
            description: `${quoteNumber} · ${quote.client || 'Cliente'} · ${quote.total || ''}`,
            type: 'success',
            quoteId,
        });

        return quoteId;
    };

    // Create a new version of an existing quote (V1, V2, ... — inserted before the year)
    const createQuoteVersion = async (quoteId: string): Promise<string> => {
        const original = quotes.find(q => q.id === quoteId);
        if (!original) return '';
        const base = original.baseNumber || original.quoteNumber || original.number || '';
        const nextV = (original.version || 1) + 1;
        const newNumber = formatQuoteNumber(base, nextV, false);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...rest } = original;
        return addQuote({
            ...rest,
            quoteNumber: newNumber,
            baseNumber: base,
            version: nextV,
            isAIU: false,
            status: 'Draft',
            date: new Date().toISOString().split('T')[0],
            taskId: undefined,
        });
    };

    // Create AIU version from an approved/sent quote — bumps V to the next consecutive
    const createAIUVersion = async (quoteId: string): Promise<string> => {
        const original = quotes.find(q => q.id === quoteId);
        if (!original) return '';
        const base = original.baseNumber || original.quoteNumber || original.number || '';
        const nextV = (original.version || 1) + 1;
        const newNumber = formatQuoteNumber(base, nextV, true);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...rest } = original;
        return addQuote({
            ...rest,
            quoteNumber: newNumber,
            baseNumber: base,
            version: nextV,
            isAIU: true,
            aiuData: original.aiuData || {},
            status: 'Draft',
            date: new Date().toISOString().split('T')[0],
            taskId: undefined,
        });
    };

    // Bulk import clients (retroactive)
    const importClients = (rows: Omit<Client, 'id'>[]) => {
        setClients(prev => {
            const newClients = rows.map((r, i) => ({ ...r, id: `c-import-${Date.now()}-${i}` }));
            const next = [...prev, ...newClients];
            persistSharedState({ clients: next });
            return next;
        });
    };

    // Bulk import quotes (retroactive)
    const importQuotes = (rows: Omit<Quote, 'id'>[]) => {
        setQuotes(prev => {
            const newQuotes = rows.map((r, i) => ({
                ...r,
                id: `q-import-${Date.now()}-${i}`,
                quoteNumber: r.quoteNumber || r.number,
                baseNumber: r.baseNumber || r.quoteNumber || r.number,
                version: r.version || 1,
            }));
            const next = [...prev, ...newQuotes];
            persistSharedState({ quotes: next });
            return next;
        });
    };

    // Clear all test/demo data (keep sellers, settings, products)
    const clearTestData = () => {
        // Con el merge-por-id del server, persistir `[]` en quotes/tasks solo
        // ya no borra nada: los ids conocidos viajan en __deletes. El wipe
        // completo lo garantiza /api/admin/clear-test-data (tombstonea
        // server-side TODOS los ids antes de vaciar); esto es la doble capa
        // por si ese endpoint falló a mitad de camino.
        const quoteIds = quotes.map(q => q.id).filter(Boolean);
        const taskIds = tasks.map(t => t.id).filter(Boolean);
        setClients([]);
        setTasks([]);
        setQuotes([]);
        setAuditLogs([]);
        setNotifications([]);
        setAnomalies([]);
        setEvents([]);
        // OJO: auditLogs NO va en el persist — /api/admin/clear-test-data deja
        // un marcador de "quién borró todo" en esa clave y persistir [] acá lo
        // pisaría milisegundos después. El estado local sí se limpia; el
        // próximo GET trae el marcador.
        persistSharedState({
            clients: [], tasks: [], quotes: [], notifications: [], anomalies: [], events: [],
            __deletes: { quotes: quoteIds, tasks: taskIds },
        });
    };

    const addSeller = (sellerData: Omit<Seller, 'id'>) => {
        const newSeller: Seller = { ...sellerData, id: `s-${Date.now()}` };
        setSellers(prev => [...prev, newSeller]);
        fetch('/api/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSeller),
        }).catch((error) => console.warn('Failed to persist seller:', error));

        fetch('/api/biolinks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seller_id: newSeller.id,
                name: newSeller.name,
                title: newSeller.role,
                email: newSeller.email,
                phone: newSeller.phone || null,
                whatsapp: newSeller.phone || null,
                photo: newSeller.avatar || null,
                active: true,
            }),
        }).catch((error) => console.warn('Failed to auto-create biolink:', error));

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

    const purgeOldAuditLogs = () => {
        const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
        setAuditLogs(prev => {
            const next = prev.filter(l => new Date(l.timestamp).getTime() >= cutoff);
            if (next.length !== prev.length) persistSharedState({ auditLogs: next });
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

    const updateAnomaly = (anomalyId: string, updates: Partial<Anomaly>) => {
        setAnomalies(prev => {
            const next = prev.map(a => a.id === anomalyId ? { ...a, ...updates } : a);
            persistSharedState({ anomalies: next });
            return next;
        });
    };

    const deleteAnomaly = (anomalyId: string) => {
        setAnomalies(prev => {
            const next = prev.filter(a => a.id !== anomalyId);
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
            const merged = mergedClient as Client;
            fetch(`/api/clients/${clientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(merged),
            }).catch((error) => console.warn('Failed to update client:', error));

            // Auto-add new city / sector to the shared catalog (see addClient comment)
            const needsCity = merged.city && !settings.cities.some(c => c.name.trim().toLowerCase() === merged.city.trim().toLowerCase());
            const needsSector = merged.category && !settings.sectors.some(s => s.trim().toLowerCase() === merged.category.trim().toLowerCase());
            if (needsCity || needsSector) {
                setSettings(prev => {
                    const next = {
                        ...prev,
                        cities: needsCity ? [...prev.cities, { name: merged.city, department: '' }] : prev.cities,
                        sectors: needsSector ? [...prev.sectors, merged.category] : prev.sectors,
                    };
                    persistSharedState({ settings: sanitizeSettingsForStorage(next) });
                    return next;
                });
            }
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
        // Igual que deleteQuote: el merge-por-id del server exige el borrado
        // explícito en __deletes (tombstone anti-resurrección). Si la task
        // está vinculada a una cotización, tombstoneamos TAMBIÉN los ids
        // determinísticos que la migración de huérfanos podría re-acuñar
        // (t-qt-<quoteId> del addQuote y t-mig-<quoteId> de la migración) —
        // sin esto, el deal borrado resucitaba en el próximo boot con otro id.
        const victim = tasks.find(t => t.id === taskId);
        const quoteId = (victim as any)?.quoteId as string | undefined;
        const idsToDelete = quoteId
            ? Array.from(new Set([taskId, `t-qt-${quoteId}`, `t-mig-${quoteId}`]))
            : [taskId];

        setTasks(prev => {
            const next = prev.filter(t => !idsToDelete.includes(t.id));
            persistSharedState({ tasks: next, __deletes: { tasks: idsToDelete } });
            return next;
        });

        // Estampa en la cotización vinculada: la migración de huérfanos la
        // respeta y deja de re-crear el negocio en cada boot. La cotización
        // NO se toca en lo demás — sigue visible y editable en /quotes.
        if (quoteId) {
            setQuotes(prev => {
                if (!prev.some(q => q.id === quoteId)) return prev;
                const next = prev.map(q =>
                    q.id === quoteId ? { ...q, pipelineTaskDeletedAt: new Date().toISOString() } : q
                );
                persistSharedState({ quotes: next });
                return next;
            });
        }
    };

    const updateQuote = (quoteId: string, updates: Partial<Quote>) => {
        const prevQuote = quotes.find(q => q.id === quoteId);

        // Estampar la fecha de cada cambio de estado — es lo que permite medir
        // el ciclo cotización→cierre en la auditoría.
        if (updates.status && prevQuote && updates.status !== prevQuote.status && !updates.statusChangedAt) {
            updates = { ...updates, statusChangedAt: new Date().toISOString() };
        }

        // Toda transición a 'Sent' debe quedar con sentAt: el informe
        // diario/semanal/mensual filtra las cotizaciones por sentAt, así que
        // una marcada "Sent" sin estampa (p.ej. desde el dropdown de estado
        // en /quotes) nunca aparece en ningún reporte. Caso 9-jul-2026:
        // Jefferson marcó ART-509/511/508/488 como enviadas y el informe
        // le mostró 0 cotizaciones ese día.
        if (updates.status === 'Sent' && prevQuote && !prevQuote.sentAt && !updates.sentAt) {
            updates = {
                ...updates,
                sentAt: new Date().toISOString(),
                ...(!updates.sentById && !prevQuote.sentById && currentUser
                    ? { sentById: currentUser.id, sentByName: currentUser.name }
                    : {}),
            };
        }

        setQuotes(prev => {
            const next = prev.map(q => q.id === quoteId ? { ...q, ...updates } : q);
            persistSharedState({ quotes: next });
            return next;
        });

        // Auto-notify on meaningful status transitions
        if (updates.status && prevQuote && updates.status !== prevQuote.status) {
            const notifMap: Record<string, { title: string; type: Notification['type'] }> = {
                'Sent': { title: 'Cotización enviada', type: 'success' },
                'Viewed': { title: 'Cotización vista por cliente', type: 'lead' },
                'Approved': { title: 'Cotización aprobada', type: 'success' },
                'Rejected': { title: 'Cotización rechazada', type: 'alert' },
                'Expired': { title: 'Cotización vencida', type: 'alert' },
            };
            const cfg = notifMap[updates.status];
            if (cfg) {
                addNotification({
                    title: cfg.title,
                    description: `${prevQuote.quoteNumber || quoteId} · ${prevQuote.client || ''}`,
                    type: cfg.type,
                    quoteId,
                });
            }
        }

        // Sync pipeline stage when quote status changes
        if (updates.status) {
            const stageMap: Record<string, string> = {
                'Draft': 'proposal',
                'PendingApproval': 'proposal',
                'ChangesRequested': 'proposal',
                'Sent': 'proposal',
                'Viewed': 'contacted', // Client opened/viewed the quote → move to Contactado
                'Approved': 'won',
                'Rejected': 'won', // stays in won column but card can be styled as lost
                'PENDING_APPROVAL': 'proposal',
            };
            const newStage = stageMap[updates.status];
            if (newStage) {
                setTasks(prev => {
                    const linked = prev.find(t => (t as any).quoteId === quoteId);
                    if (!linked) return prev;
                    const next = prev.map(t =>
                        (t as any).quoteId === quoteId ? { ...t, stageId: newStage } : t
                    );
                    persistSharedState({ tasks: next });
                    return next;
                });
            }
        }

        // Sync pipeline task value/numericValue cuando la cotización cambia
        // de monto. Caso reportado 15-may-2026: ART-356 se editó (3 bancas
        // → 2 bancas) y /cotizaciones mostraba el nuevo total $4.644.000
        // pero el card del pipeline seguía mostrando $5.853.782 viejo
        // porque updateQuote solo sincronizaba `stageId`, no los campos
        // financieros de la task vinculada.
        //
        // No tocamos title/contactName/stageId/assignedTo aquí — el vendedor
        // pudo haberlos editado a mano en la card y no queremos pisarle.
        // Solo sincronizamos value (currency string) y numericValue (para
        // sumas del kanban) cuando la cotización los cambió.
        const totalChanged = updates.total !== undefined && updates.total !== prevQuote?.total;
        const numericChanged = updates.numericTotal !== undefined && updates.numericTotal !== prevQuote?.numericTotal;
        if (totalChanged || numericChanged) {
            setTasks(prev => {
                const linked = prev.find(t => (t as any).quoteId === quoteId);
                if (!linked) return prev;
                const next = prev.map(t => {
                    if ((t as any).quoteId !== quoteId) return t;
                    const patch: Partial<Task> = {};
                    if (totalChanged && updates.total !== undefined) patch.value = updates.total;
                    if (numericChanged && updates.numericTotal !== undefined) patch.numericValue = updates.numericTotal;
                    return { ...t, ...patch };
                });
                persistSharedState({ tasks: next });
                return next;
            });
        }
    };

    const deleteQuote = (quoteId: string) => {
        setQuotes(prev => {
            const next = prev.filter(q => q.id !== quoteId);
            // El server hace merge-por-id sobre `quotes`: mandar el arreglo sin
            // el registro ya no borra nada. El borrado real viaja en __deletes
            // y queda tombstoneado server-side, para que el snapshot de otra
            // sesión abierta no lo resucite.
            persistSharedState({ quotes: next, __deletes: { quotes: [quoteId] } });
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

        // If the seller isn't in the sellers list (e.g. SuperAdmin injected via currentUser),
        // fall back to currentUser as the base for the API call
        const payload = mergedSeller ?? (
            currentUser && currentUser.id === id
                ? { ...currentUser, ...updates } as Seller
                : null
        );

        if (payload) {
            fetch(`/api/team/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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

    // Settings es shared state crítico: las pipelineStages, sectores, ciudades,
    // toggles del informe diario, etc. afectan a TODO el equipo. Antes esto era
    // fire-and-forget — si la red fallaba al editar stages, el cambio quedaba
    // fantasma sólo en el browser de quien lo hizo (caso real: Valentina veía
    // sus columnas, los demás no). Ahora esperamos la respuesta del PUT y, si
    // falla, revertimos el cambio localmente y avisamos al usuario.
    const updateSettings = async (updates: Partial<AppSettings>) => {
        let prevSnapshot: AppSettings | null = null;
        setSettings(prev => {
            prevSnapshot = prev;
            return { ...prev, ...updates };
        });
        if (!prevSnapshot) return;
        try {
            const next = { ...(prevSnapshot as AppSettings), ...updates };
            const res = await fetch('/api/state', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: sanitizeSettingsForStorage(next) }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (error) {
            // Rollback al snapshot anterior — el user ve el cambio revertido y
            // sabe que tiene que reintentar (vs creer que se guardó cuando no).
            setSettings(prevSnapshot as AppSettings);
            console.error('[updateSettings] persist failed, reverting:', error);
            addNotification({
                title: 'No se pudieron guardar los ajustes',
                description: 'Hubo un problema con la red. El cambio fue revertido — volvé a intentarlo.',
                type: 'alert',
            });
        }
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

    const incrementOnboardingCount = async (): Promise<number> => {
        // Best-effort server persistence — the wizard still progresses locally if this fails,
        // but the user will see the wizard again on next login (which is acceptable).
        try {
            const res = await fetch('/api/users/me/onboarding', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                const newCount: number = typeof data?.onboardingCount === 'number'
                    ? data.onboardingCount
                    : (currentUser?.onboardingCount ?? 0) + 1;
                setCurrentUser(prev => prev ? { ...prev, onboardingCount: newCount } : prev);
                return newCount;
            }
        } catch {
            // swallow — fall through to local-only update
        }
        const fallback = (currentUser?.onboardingCount ?? 0) + 1;
        setCurrentUser(prev => prev ? { ...prev, onboardingCount: fallback } : prev);
        return fallback;
    };

    /**
     * Crea (o reusa, si ya existe por nombre case-insensitive) una empresa.
     * Devuelve el id de la empresa para enlazarla al cliente que se está
     * creando. Optimista: actualiza el state local inmediatamente para que el
     * combobox muestre la nueva opción sin esperar al server.
     */
    const addCompany = async (name: string): Promise<Company | null> => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        // Si ya existe en memoria por nombre exacto (case-insensitive), úsala.
        const existing = companies.find(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing;

        // Optimista: añade un placeholder con id temporal mientras llega la
        // respuesta del server. Si el server devuelve un id distinto, lo
        // reemplazamos. (Casi nunca pasa porque el server hace get-or-create.)
        const tempId = `cmp-tmp-${Date.now().toString(36)}`;
        setCompanies(prev => [...prev, { id: tempId, name: trimmed, clientCount: 0 }]);

        try {
            const res = await fetch('/api/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const company: Company = data.company;
            setCompanies(prev => {
                const next = prev.filter(c => c.id !== tempId);
                if (!next.some(c => c.id === company.id)) next.push({ ...company, clientCount: 0 });
                next.sort((a, b) => a.name.localeCompare(b.name));
                try { localStorage.setItem('crm_companies_cache', JSON.stringify(next)); } catch {}
                return next;
            });
            return company;
        } catch (error) {
            console.warn('Failed to create company:', error);
            // Revertir el placeholder optimista — el cliente verá un toast/error.
            setCompanies(prev => prev.filter(c => c.id !== tempId));
            return null;
        }
    };

    /**
     * Renombra una empresa. Actualiza el state local optimistamente y propaga
     * el nuevo nombre al campo denormalizado `company` de cada Client enlazado
     * para que listados/PDFs no tengan que esperar al próximo refresh.
     */
    const updateCompany = async (id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: 'El nombre no puede estar vacío.' };
        try {
            const res = await fetch(`/api/companies/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                return { ok: false, error: data?.error || `Error ${res.status}` };
            }
            const data = await res.json();
            const final: Company = data.company || { id, name: trimmed };
            setCompanies(prev => {
                const next = prev.map(c => c.id === id ? { ...c, name: final.name } : c);
                next.sort((a, b) => a.name.localeCompare(b.name));
                try { localStorage.setItem('crm_companies_cache', JSON.stringify(next)); } catch {}
                return next;
            });
            // Propagar el rename al campo denormalizado de cada cliente local
            setClients(prev => prev.map(c => c.companyId === id ? { ...c, company: final.name } : c));
            return { ok: true };
        } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : 'Error de red' };
        }
    };

    /**
     * Borra una empresa. En el server los clientes pierden el FK pero
     * conservan el `company` string. Localmente espejamos ese mismo cambio.
     */
    const deleteCompany = async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
        try {
            const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                return { ok: false, error: data?.error || `Error ${res.status}` };
            }
            setCompanies(prev => {
                const next = prev.filter(c => c.id !== id);
                try { localStorage.setItem('crm_companies_cache', JSON.stringify(next)); } catch {}
                return next;
            });
            // Los contactos quedan sueltos: dejamos el string `company` (snapshot)
            // pero les sacamos el companyId.
            setClients(prev => prev.map(c => c.companyId === id ? { ...c, companyId: undefined } : c));
            return { ok: true };
        } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : 'Error de red' };
        }
    };

    const contextValue = useMemo(() => ({
            clients, tasks, quotes, sellers, notifications, settings, events, forms,
            companies,
            addClient, addTask, addQuote, createQuoteVersion, createAIUVersion, importClients, importQuotes, clearTestData,
            addCompany, updateCompany, deleteCompany,
            addSeller, addNotification, addEvent, addForm,
            updateClient, deleteClient,
            updateTask, deleteTask,
            updateQuote, deleteQuote,
            updateEvent, deleteEvent,
            updateSeller, deleteSeller, updateSettings,
            updateForm, deleteForm,
            markNotificationAsRead, clearNotifications, removeNotification, setNotifications,
            auditLogs, addAuditLog, purgeOldAuditLogs, anomalies, addAnomaly, updateAnomaly, deleteAnomaly,
            products, productSyncStatus, refreshProducts, refreshClients, refreshCompanies, updateProduct, deleteProduct,
            assignedLeadsCount, refreshAssignedLeadsCount,
            currentUser, isHydrating, login, logout,
            incrementOnboardingCount,
        }), [
            clients, tasks, quotes, sellers, notifications, settings, events, forms,
            companies,
            auditLogs, anomalies, products, productSyncStatus, currentUser, isHydrating,
            assignedLeadsCount
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
