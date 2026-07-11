"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Plus, Minus, Trash2, Search,
    CheckCircle, UserPlus, Box, RefreshCw, ShoppingCart,
    Building2, Package, Eye, X, FileText, Send, GitBranch, Hash, ImagePlus
} from 'lucide-react';
import { clsx } from 'clsx';
import { generateProposalPDF } from '@/lib/pdf-generator';
import { useApp, Product, formatQuoteNumber } from '@/context/AppContext';
import CompanyCombobox from '@/components/CompanyCombobox';
import {
    calculateQuoteTotals,
    computeValidUntil,
    formatSpanishLongDate,
    transportItemDescription,
    DEFAULT_VALIDITY_DAYS,
    type QuoteMode,
} from '@/lib/quote-calculations';

interface QuoteItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
    productId?: string;
    image?: string;
    dimensions?: string;
    isCustom?: boolean;
    priceBeforeTax?: number;
    taxRate?: number;
    weight?: number;   // kg por unidad
    length?: number;   // cm
    width?: number;    // cm
    height?: number;   // cm
}

interface QuoteEngineProps {
    defaultClientId?: string;
    editQuoteId?: string;
}

export default function QuoteEngine({ defaultClientId = '', editQuoteId }: QuoteEngineProps) {
    const { products, clients, addClient, refreshProducts, addQuote, createQuoteVersion, updateQuote, quotes, currentUser, isHydrating, settings, addNotification, addAuditLog } = useApp();
    const isEditMode = !!editQuoteId;
    const editQuote = editQuoteId ? quotes.find(q => q.id === editQuoteId) : undefined;
    const genId = () => `${Date.now().toString(36)}-${Math.round(Math.random() * 1e4)}`;

    const [selectedClientId, setSelectedClientId] = useState(defaultClientId);
    const [items, setItems] = useState<QuoteItem[]>([]);
    // ── Modelo nuevo (abril 2026) ──────────────────────────────────────────────
    // 'simple' = factura completa con IVA 19% sobre todo. 'aiu' = régimen
    // Administración + Utilidad, IVA SÓLO sobre la utilidad. La elección se
    // refleja en el sufijo "-AIU" del número y en el formato del PDF.
    // Para cotizaciones legacy (quoteMode === undefined) hereda 'aiu' si tenía
    // isAIU=true, si no 'simple', para que el modo de edición no rompa nada.
    const initialMode: QuoteMode = editQuote?.quoteMode ?? (editQuote?.isAIU ? 'aiu' : 'simple');
    const [quoteMode, setQuoteMode] = useState<QuoteMode>(initialMode);
    // El isAIU del número es derivado del mode; lo dejamos sincronizado con un
    // alias para no tocar el resto del flujo de numeración (formatQuoteNumber).
    const isAIU = quoteMode === 'aiu';
    // PDF: ocultar nombre del contacto (solo mostrar empresa + ciudad).
    // Pedido del cliente 16-may-2026 — cotizaciones a instituciones sin
    // persona específica como destinatario.
    const [hideContactName, setHideContactName] = useState<boolean>(
        editQuote?.hideContactName ?? false
    );
    // (modo simple) — checkbox + monto (CON IVA, lo escribe el vendedor) + ciudad
    const [includesTransport, setIncludesTransport] = useState<boolean>(
        editQuote?.includesTransport ?? false
    );
    const [transportAmount, setTransportAmount] = useState<number>(
        editQuote?.transportAmount ?? 0
    );
    const [transportCity, setTransportCity] = useState<string>(
        editQuote?.transportCity ?? ''
    );
    // (modo aiu) — porcentajes que negocia el vendedor con el cliente.
    const [adminPercent, setAdminPercent] = useState<number>(
        editQuote?.adminPercent ?? 10
    );
    const [utilityPercent, setUtilityPercent] = useState<number>(
        editQuote?.utilityPercent ?? 5
    );
    // Texto opcional que reemplaza el auto-generado "se entrega en {ciudad}".
    const [deliveryLocation, setDeliveryLocation] = useState<string>(
        editQuote?.deliveryLocation ?? ''
    );
    // Días de validez de la oferta. Default 30 — editable pero no obligatorio.
    const [validityDays, setValidityDays] = useState<number>(
        editQuote?.validityDays ?? DEFAULT_VALIDITY_DAYS
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [sentConfirm, setSentConfirm] = useState<{ quoteNumber: string; email: string; pending?: boolean; pendingAction?: 'send_email' | 'send_whatsapp' | 'generate_pdf' } | null>(null);
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const customImageInputRef = useRef<HTMLInputElement>(null);
    const [showCustomProductForm, setShowCustomProductForm] = useState(false);
    const [customProduct, setCustomProduct] = useState({
        name: '',
        dimensions: '',
        priceBeforeTax: 0,
        taxRate: 0.19,
        quantity: 1,
        image: '',
    });
    const [newClient, setNewClient] = useState({ name: '', company: '', companyId: '', position: '', email: '', phone: '', city: '' });
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);

    // Campos comerciales (formato Word oficial)
    const [referencia, setReferencia] = useState('');
    // Observaciones libres del vendedor — opcionales. Se persisten en la
    // cotización y aparecen como bloque destacado al final del PDF.
    // Caso de uso pedido 7-may-2026: notas sobre materiales, condiciones de
    // instalación, restricciones de transporte, etc.
    const [observations, setObservations] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [deliveryTime, setDeliveryTime] = useState('A convenir con el cliente.');
    const [paymentTerms, setPaymentTerms] = useState('- Anticipo del 50% del total de la orden.\n- El saldo deberá cancelarse en su totalidad antes de la entrega de los productos. El producto que no sea cancelado en su totalidad, no podrá ser entregado.');

    // Preview modal
    const [showPreview, setShowPreview] = useState(false);
    const [pendingAction, setPendingAction] = useState<'pdf' | 'email' | 'whatsapp' | null>(null);

    // Post-PDF reminder: después de generar el PDF, recordamos al vendedor que AÚN debe enviárselo al cliente.
    const [postGenReminder, setPostGenReminder] = useState<{ quoteNumber: string; quoteId: string } | null>(null);
    const [reminderBusy, setReminderBusy] = useState<'wa' | 'email' | 'download' | null>(null);

    // Envío: modo 'auto' calcula desde peso/dims + ciudad. 'manual' usa shippingOverride.
    const [shippingMode, setShippingMode] = useState<'auto' | 'manual'>(editQuote?.shippingMode || 'auto');
    const [shippingOverride, setShippingOverride] = useState<number>(
        editQuote?.shippingMode === 'manual' ? (editQuote?.shipping ?? 0) : 0
    );

    // Live preview of the quote number. Reacts to isAIU toggle.
    const versionForDisplay = editQuote?.version || 1;
    const newQuoteBase = `${settings.quotePrefix || 'ART'}-${settings.quoteNextNumber ?? 300}-${settings.quoteYear || new Date().getFullYear()}`;
    const autoPreviewNumber = (() => {
        if (editQuote?.baseNumber) return formatQuoteNumber(editQuote.baseNumber, versionForDisplay, isAIU);
        if (editQuote?.quoteNumber) {
            const stripped = editQuote.quoteNumber.replace(/-AIU$/, '');
            return isAIU ? `${stripped}-AIU` : stripped;
        }
        return formatQuoteNumber(newQuoteBase, 1, isAIU);
    })();

    // Override manual del número de cotización. Vacío = usar el consecutivo
    // automático (autoPreviewNumber). Solo aplica al crear cotizaciones nuevas
    // — al editar una existente NO se permite cambiar el número porque rompe
    // la trazabilidad de versiones (baseNumber, version, AIU sufijo).
    //
    // Caso de uso: el vendedor necesita usar la nomenclatura de la empresa
    // del cliente, una cotización paralela del ERP, o continuar una
    // numeración heredada. Antes esto era imposible y obligaba a meter el
    // número como referencia comercial — quedaba en mensajes pero nunca era
    // el "número de la cotización" real.
    const [customQuoteNumber, setCustomQuoteNumber] = useState<string>('');
    const previewNumber = (!editQuoteId && customQuoteNumber.trim())
        ? customQuoteNumber.trim()
        : autoPreviewNumber;
    const genQuoteNumber = () => previewNumber;

    // Validación de duplicado: SOLO aplica cuando el vendedor sobreescribió
    // el consecutivo con un número manual. Si está usando el auto-preview
    // (campo vacío), el contador del sistema garantiza unicidad y un
    // false-positive bloquearía al vendedor de generar cualquier cotización
    // (ej: contador desincronizado contra una cotización vieja con el mismo
    // número — caso reportado el 7 de mayo: "no deja enviar a aprobación").
    const isUsingCustomNumber = !editQuoteId && customQuoteNumber.trim().length > 0;
    const normalizedQuoteNumber = customQuoteNumber.trim().toLowerCase();
    const conflictingQuote = isUsingCustomNumber
        ? quotes.find(q =>
            (q.quoteNumber || q.number || '').trim().toLowerCase() === normalizedQuoteNumber
        )
        : null;
    const isQuoteNumberConflict = !!conflictingQuote;
    /** Bloquea el submit si hay conflicto y avisa por toast. Retorna true si todo bien. */
    const assertNoQuoteNumberConflict = (): boolean => {
        if (!isQuoteNumberConflict) return true;
        addNotification({
            title: 'Número de cotización duplicado',
            description: `Ya existe ${conflictingQuote?.quoteNumber || conflictingQuote?.number}. Cambialo o dejá el campo vacío para usar el consecutivo automático.`,
            type: 'alert',
        });
        return false;
    };

    useEffect(() => {
        const doSync = async () => {
            setIsSyncing(true);
            try { await refreshProducts(); } finally { setIsSyncing(false); }
        };
        doSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!editQuoteId) return;
        const existing = quotes.find(q => q.id === editQuoteId);
        if (!existing) return;
        if (existing.clientId) setSelectedClientId(existing.clientId);
        if (existing.items && existing.items.length > 0) {
            setItems(existing.items.map(i => ({
                id: i.id || `${Date.now().toString(36)}-${Math.round(Math.random() * 1e4)}`,
                name: i.name || '',
                price: i.price || (i as any).unitPrice || 0,
                quantity: i.quantity || 1,
                unit: (i as any).unit || 'Und',
                productId: (i as any).productId,
                image: (i as any).image,
                dimensions: (i as any).dimensions,
                isCustom: (i as any).isCustom,
                priceBeforeTax: (i as any).priceBeforeTax,
                taxRate: (i as any).taxRate,
                weight: (i as any).weight,
                length: (i as any).length,
                width: (i as any).width,
                height: (i as any).height,
            })));
        }
        // Load commercial fields
        if (existing.referencia) setReferencia(existing.referencia);
        if (existing.validUntil) setValidUntil(existing.validUntil);
        if (existing.deliveryTime) setDeliveryTime(existing.deliveryTime);
        if (existing.paymentTerms) setPaymentTerms(existing.paymentTerms);
        if ((existing as any).observations) setObservations((existing as any).observations);
        // Modelo nuevo — hidrata el modo y campos asociados. Para cotizaciones
        // legacy sin quoteMode definido, se infiere desde el flag isAIU previo.
        const mode: QuoteMode = existing.quoteMode ?? (existing.isAIU ? 'aiu' : 'simple');
        setQuoteMode(mode);
        setIncludesTransport(existing.includesTransport ?? false);
        setTransportAmount(existing.transportAmount ?? 0);
        setTransportCity(existing.transportCity ?? '');
        setAdminPercent(existing.adminPercent ?? 10);
        setUtilityPercent(existing.utilityPercent ?? 5);
        setDeliveryLocation(existing.deliveryLocation ?? '');
        setValidityDays(existing.validityDays ?? DEFAULT_VALIDITY_DAYS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editQuoteId]);

    const filteredProducts = useMemo(() => {
        const q = productSearch.toLowerCase().trim();
        if (!q) return products.filter(p => !p.isDeleted && p.isActive !== false);
        return products.filter(p =>
            !p.isDeleted &&
            p.isActive !== false &&
            (p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
        );
    }, [products, productSearch]);

    const filteredClients = useMemo(() => {
        const q = clientSearch.toLowerCase().trim();
        if (!q) return clients.slice(0, 20);
        return clients.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.company || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
        ).slice(0, 15);
    }, [clients, clientSearch]);

    const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const normalizeCustomProductImage = async (file: File) => {
        const dataUrl = await fileToDataUrl(file);
        if (/^image\/(png|jpeg|jpg)$/i.test(file.type)) return dataUrl;

        return new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const maxSide = 1200;
                const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
                canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas no disponible'));
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    };

    const handleCustomProductImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            addNotification({ title: 'Imagen no válida', description: 'Sube una imagen JPG, PNG, WEBP o SVG.', type: 'alert' });
            return;
        }
        try {
            const image = await normalizeCustomProductImage(file);
            setCustomProduct(prev => ({ ...prev, image }));
        } catch {
            addNotification({ title: 'No se pudo leer la imagen', description: 'Intenta con una imagen JPG o PNG.', type: 'alert' });
        }
    };

    const priceWithTax = (priceBeforeTax: number, taxRate: number) =>
        Math.round(Math.max(0, priceBeforeTax || 0) * (1 + Math.max(0, taxRate || 0)));

    const priceBeforeTaxForItem = (item: QuoteItem) => {
        if (typeof item.priceBeforeTax === 'number') return item.priceBeforeTax;
        const taxRate = item.taxRate ?? 0.19;
        return Math.round((item.price || 0) / (1 + Math.max(0, taxRate)));
    };

    const addCustomProduct = () => {
        const name = customProduct.name.trim();
        if (!name) {
            addNotification({ title: 'Nombre requerido', description: 'Escribe el nombre del producto personalizado.', type: 'alert' });
            return;
        }
        setItems(prev => [...prev, {
            id: genId(),
            name,
            price: priceWithTax(customProduct.priceBeforeTax, customProduct.taxRate),
            priceBeforeTax: Math.max(0, customProduct.priceBeforeTax || 0),
            taxRate: Math.max(0, customProduct.taxRate || 0),
            quantity: Math.max(1, Math.floor(customProduct.quantity || 1)),
            unit: 'Und',
            image: customProduct.image || undefined,
            dimensions: customProduct.dimensions.trim() || undefined,
            isCustom: true,
        }]);
        setCustomProduct({ name: '', dimensions: '', priceBeforeTax: 0, taxRate: 0.19, quantity: 1, image: '' });
        if (customImageInputRef.current) customImageInputRef.current.value = '';
        setShowCustomProductForm(false);
    };

    const updateItemName = (id: string, name: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, name } : i));
    const updateItemDimensions = (id: string, dimensions: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, dimensions } : i));
    const updateItemUnit = (id: string, unit: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, unit } : i));

    const addProductToQuote = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) {
                return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                id: genId(),
                name: product.name,
                price: product.price || 0,
                quantity: 1,
                unit: 'Und',
                productId: product.id,
                image: product.image,
                dimensions: product.dimensions || '',
                weight: product.weight,
                length: product.length,
                width: product.width,
                height: product.height,
            }];
        });
    };

    const updateQty = (id: string, delta: number) => {
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            const next = i.quantity + delta;
            return next <= 0 ? i : { ...i, quantity: next };
        }));
    };

    // Set directo de cantidad — pedido 20-may-2026: "que nos deje poner las
    // cantidades también manual, esa cotización lleva 200 unidades, nos toco
    // dar click 200 veces al +". Clampea a mínimo 1 (parseInt('') o 0 quedan
    // en 1 para no romper el total).
    const setQty = (id: string, val: number) => {
        const safe = Number.isFinite(val) && val >= 1 ? Math.floor(val) : 1;
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: safe } : i));
    };

    const updatePrice = (id: string, val: number) => {
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            if (!i.isCustom) return { ...i, price: val };
            const priceBeforeTax = Math.max(0, val || 0);
            const taxRate = i.taxRate ?? 0.19;
            return { ...i, priceBeforeTax, price: priceWithTax(priceBeforeTax, taxRate) };
        }));
    };

    const updateTaxRate = (id: string, taxRate: number) => {
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            const priceBeforeTax = priceBeforeTaxForItem(i);
            return { ...i, taxRate, price: priceWithTax(priceBeforeTax, taxRate) };
        }));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    // ── Cálculo unificado de la cotización ───────────────────────────────────
    // Todos los totales (lo que se ve en pantalla, lo que entra en el PDF, lo
    // que se guarda en `numericTotal`) salen de calculateQuoteTotals para que
    // un mismo input produzca exactamente el mismo número en todos lados.
    const calc = useMemo(() => calculateQuoteTotals({
        mode: quoteMode,
        items: items.map(i => ({ unitPrice: i.price, quantity: i.quantity, priceBeforeTax: i.priceBeforeTax, taxRate: i.taxRate })),
        includesTransport,
        transportAmount,
        adminPercent,
        utilityPercent,
    }), [quoteMode, items, includesTransport, transportAmount, adminPercent, utilityPercent]);

    // Aliases legacy mantenidos para no romper código que ya los referencia
    // (preview modal, mensajes WhatsApp, payload del email). En modo simple
    // `subtotal` es productos+transporte antes de IVA; en AIU es subtotal de
    // productos antes del bloque admin/utilidad.
    const subtotal = calc.subtotalLine1;
    const tax = calc.taxAmount;
    const total = calc.total;

    // Vigencia auto-derivada: hoy + validityDays (en es-CO).
    const computedValidUntil = useMemo(
        () => formatSpanishLongDate(computeValidUntil(new Date(), validityDays || DEFAULT_VALIDITY_DAYS)),
        [validityDays]
    );
    // Si el vendedor escribió uno manual lo respetamos; si no, mostramos el computado.
    const displayValidUntil = validUntil.trim() || computedValidUntil;

    // ── Cálculo de envío (peso real vs volumétrico × tarifa por ciudad) ──────
    // En el modelo nuevo el "transporte" lo escribe el vendedor a mano. Esta
    // calculadora se queda como SUGERENCIA: el botón "Sugerir" llena el campo
    // transportAmount con el valor estimado por ciudad para ese carrito.
    const selectedClient = clients.find(c => c.id === selectedClientId);
    const shippingEnabled = settings.shipping?.enabled ?? true;

    const shippingMetrics = useMemo(() => {
        const totalWeight = items.reduce((s, i) => s + ((i.weight || 0) * i.quantity), 0);
        const totalVolume = items.reduce((s, i) => {
            const v = (i.length || 0) * (i.width || 0) * (i.height || 0);
            return s + (v * i.quantity);
        }, 0);
        const divisor = settings.shipping?.volumetricDivisor || 5000;
        const volumetricWeight = totalVolume > 0 ? totalVolume / divisor : 0;
        const billableWeight = Math.max(totalWeight, volumetricWeight);
        // ¿Algún item con datos? Si ninguno tiene peso ni volumen, no calculamos.
        const hasShippingData = items.some(i => (i.weight || 0) > 0 || ((i.length || 0) * (i.width || 0) * (i.height || 0)) > 0);
        return { totalWeight, totalVolume, volumetricWeight, billableWeight, hasShippingData };
    }, [items, settings.shipping?.volumetricDivisor]);

    const autoShipping = useMemo(() => {
        if (!shippingEnabled) return 0;
        if (!shippingMetrics.hasShippingData) return 0;
        const cityRates = settings.shipping?.cityRates ?? [];
        const clientCity = (selectedClient?.city || '').trim().toLowerCase();
        const cityRate = clientCity
            ? cityRates.find(r => (r.city || '').trim().toLowerCase() === clientCity)
            : undefined;
        const ratePerKg = cityRate?.ratePerKg ?? settings.shipping?.defaultRatePerKg ?? 0;
        const minCharge = cityRate?.minimumCharge ?? settings.shipping?.defaultMinimumCharge ?? 0;
        const computed = shippingMetrics.billableWeight * ratePerKg;
        return Math.round(Math.max(computed, minCharge));
    }, [shippingEnabled, shippingMetrics, selectedClient?.city, settings.shipping?.cityRates, settings.shipping?.defaultRatePerKg, settings.shipping?.defaultMinimumCharge]);

    // `shipping` (legacy) — sigue exponiéndose porque la API de email/whatsapp y el snapshot
    // del Quote la siguen guardando como dato auxiliar. Guardamos la BASE COTIZADA
    // (calc.transportBeforeTax = gross-up /0.9 redondeado ↑ a $1.000), no el costo digitado:
    // la tarjeta de autorizaciones muestra este valor junto al subtotal que ya lo incluye,
    // y con el costo crudo los números no cuadraban (caso Silvia Rodríguez, 11 jul 2026:
    // mostraba Envío $700.000 pero el subtotal sumaba $777.778).
    const shipping = quoteMode === 'simple' && includesTransport ? (calc.transportBeforeTax || 0) : 0;

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    // Construye el string de dimensiones con etiquetas explícitas para el PDF.
    // Si los campos vienen separados (de WooCommerce), generamos
    // "Alto: Xcm\nAncho: Ycm\nLargo: Zcm\nPeso: Wkg". Si solo hay un string
    // libre (porque el vendedor lo editó), lo usamos tal cual. Si no hay nada,
    // retornamos undefined para que la celda quede limpia.
    const formatDimensions = (i: { fallback?: string; height?: number | string; width?: number | string; length?: number | string; weight?: number | string }): string | undefined => {
        const has = (v: any) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '0';
        if (has(i.height) || has(i.width) || has(i.length) || has(i.weight)) {
            const parts: string[] = [];
            if (has(i.height)) parts.push(`Alto: ${i.height}cm`);
            if (has(i.width))  parts.push(`Ancho: ${i.width}cm`);
            if (has(i.length)) parts.push(`Largo: ${i.length}cm`);
            if (has(i.weight)) parts.push(`Peso: ${i.weight}kg`);
            return parts.join('\n');
        }
        return i.fallback && i.fallback.trim() ? i.fallback : undefined;
    };

    const getQuoteOwner = (client: typeof clients[0]) => {
        const sellerId = currentUser?.id || client.assignedTo || '';
        const sellerName = currentUser?.name || client.assignedToName || '';
        return { sellerId, sellerName };
    };

    const ensureQuoteOwnerReady = () => {
        if (isHydrating) {
            addNotification({
                title: 'Sesión cargando',
                description: 'Espera un momento y vuelve a guardar la cotización.',
                type: 'alert',
            });
            return false;
        }
        if (!currentUser) {
            addNotification({
                title: 'Sesión requerida',
                description: 'Vuelve a iniciar sesión antes de crear la cotización.',
                type: 'alert',
            });
            return false;
        }
        return true;
    };

    const getCommonQuoteFields = (client: typeof clients[0], quoteNumber: string, mappedItems: typeof items) => {
        const owner = getQuoteOwner(client);
        return {
            number: quoteNumber, client: client.name, clientId: client.id,
            clientEmail: client.email || '', clientCompany: client.company || '',
            // Propagamos el companyId del cliente para que el detalle de empresa
            // pueda agrupar todas las cotizaciones de sus contactos. Si el lead no
            // tiene empresa asignada, queda undefined.
            companyId: client.companyId || undefined,
            date: new Date().toLocaleDateString('es-CO'),
            total: formatCurrency(total), numericTotal: total, subtotal, tax,
            items: mappedItems.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, unit: i.unit, total: i.price * i.quantity, productId: i.productId, image: i.image, dimensions: i.dimensions, isCustom: i.isCustom, priceBeforeTax: i.priceBeforeTax, taxRate: i.taxRate, weight: i.weight, length: i.length, width: i.width, height: i.height })),
            notes: '', sellerId: owner.sellerId, sellerName: owner.sellerName,
            referencia,
            // validUntil: si el vendedor no escribió uno manual, persistimos el computado
            // (formatSpanishLongDate(today + validityDays)) así el PDF y el listado coinciden.
            validUntil: validUntil.trim() || computedValidUntil,
            deliveryTime, paymentTerms,
            observations: observations.trim() || undefined,
            hideContactName,
            sellerPhone: currentUser?.phone || '',
            // Envío legacy (snapshot histórico — se queda por compatibilidad pero NO entra al total).
            shipping: shipping > 0 ? shipping : undefined,
            shippingCity: client.city || undefined,
            shippingMode,
            totalWeight: shippingMetrics.totalWeight || undefined,
            totalVolume: shippingMetrics.totalVolume || undefined,
            // Numbering
            quoteNumber,
            baseNumber: editQuote?.baseNumber || (editQuote ? undefined : newQuoteBase),
            version: versionForDisplay,
            // isAIU se mantiene por el sufijo "-AIU" del número y el listado de cotizaciones,
            // pero la fuente de verdad es quoteMode. aiuData (legacy) se conserva tal cual si
            // viene de una cotización vieja para que su PDF legacy siga renderizando bien.
            isAIU,
            aiuData: editQuote?.aiuData,
            // ── Modelo nuevo ──────────────────────────────────────────────────────
            quoteMode,
            includesTransport: quoteMode === 'simple' ? includesTransport : undefined,
            transportAmount: quoteMode === 'simple' && includesTransport ? (transportAmount || undefined) : undefined,
            transportCity: quoteMode === 'simple' && includesTransport
                ? (transportCity.trim() || client.city || undefined)
                : undefined,
            adminPercent: quoteMode === 'aiu' ? adminPercent : undefined,
            utilityPercent: quoteMode === 'aiu' ? utilityPercent : undefined,
            deliveryLocation: deliveryLocation.trim() || undefined,
            validityDays,
        };
    };

    // ── Datos para el PDF (un solo lugar) ───────────────────────────────────
    // Recibe quoteNumber porque puede ser nuevo o el mismo del editQuote, y
    // empaqueta todo lo que el generador del PDF necesita para decidir entre
    // plantilla simple/AIU. Se llama desde executeGeneratePDF y desde el
    // recordatorio post-descarga (re-download).
    const buildPdfData = (client: typeof clients[0], quoteNumber: string) => ({
        quoteNumber,
        date: new Date().toLocaleDateString('es-CO'),
        leadName: client.name,
        leadCompany: client.company,
        leadEmail: client.email,
        leadCity: client.city,
        hideContactName,
        referencia,
        validUntil: validUntil.trim() || computedValidUntil,
        deliveryTime,
        paymentTerms,
        sellerName: currentUser?.name || 'ArteConcreto',
        sellerPhone: currentUser?.phone || '',
        sellerEmail: currentUser?.email || '',
        // Modo + datos crudos: el PDF llama a calculateQuoteTotals internamente
        // para no duplicar el cálculo aquí.
        mode: quoteMode,
        items: items.map(i => ({
            name: i.name,
            unitPrice: i.price,
            priceBeforeTax: i.priceBeforeTax,
            taxRate: i.taxRate,
            quantity: i.quantity,
            unit: i.unit,
            image: i.image,
            // Construimos el bloque de dimensiones con etiquetas explícitas
            // (Alto/Ancho/Largo/Peso) — pedido del cliente 7-may-2026. Si
            // WooCommerce trajo los campos separados los usamos; si solo viene
            // el string libre, lo respetamos. Una persona puede haber editado
            // dimensions manualmente y no queremos pisarle el texto.
            dimensions: formatDimensions({
                fallback: i.dimensions,
                height: (i as any).height,
                width:  (i as any).width,
                length: (i as any).length,
                weight: (i as any).weight,
            }),
        })),
        includesTransport: quoteMode === 'simple' ? includesTransport : undefined,
        transportAmount: quoteMode === 'simple' && includesTransport ? transportAmount : undefined,
        transportCity: quoteMode === 'simple' && includesTransport
            ? (transportCity.trim() || client.city || '')
            : undefined,
        adminPercent: quoteMode === 'aiu' ? adminPercent : undefined,
        utilityPercent: quoteMode === 'aiu' ? utilityPercent : undefined,
        deliveryLocation: deliveryLocation.trim() || undefined,
        observations: observations.trim() || undefined,
    });

    // ── Helper único para enviar cotización a aprobación ────────────────────
    // Reemplaza el patrón anterior (3 variantes por acción) por un solo flujo
    // por cotización. Si la cotización ya existe y estaba en Approved/Sent, al
    // ser editada vuelve a PendingApproval automáticamente.
    const requestApproval = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) { addNotification({ title: 'Cliente requerido', description: 'Selecciona un cliente.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        if (!ensureQuoteOwnerReady()) return;
        if (!assertNoQuoteNumberConflict()) return;

        const quoteNumber = genQuoteNumber();
        const requestedAt = new Date().toISOString();
        const commonFields = getCommonQuoteFields(client, quoteNumber, items);

        if (isEditMode && editQuoteId) {
            // Re-enviar a aprobación (después de correcciones o editando una aprobada)
            updateQuote(editQuoteId, {
                ...commonFields,
                status: 'PendingApproval',
                requestedBy: currentUser?.id || '',
                requestedByName: currentUser?.name || '',
                requestedAt,
                // Limpiar estado de entrega previo — es una nueva revisión
                approvedBy: undefined,
                approvedByName: undefined,
                approvedAt: undefined,
                sentAt: undefined,
                sentByName: undefined,
                sentById: undefined,
                deliveryFailed: false,
                deliveryError: undefined,
                pendingAction: undefined,
            });
        } else {
            await addQuote({
                ...commonFields,
                status: 'PendingApproval',
                requestedBy: currentUser?.id || '',
                requestedByName: currentUser?.name || '',
                requestedAt,
            });
        }

        addNotification({
            title: '⏳ Enviada a aprobación',
            description: `El SuperAdmin revisará ${quoteNumber} y al aprobar, el sistema enviará el correo automáticamente.`,
            type: 'success',
        });
        addNotification({
            title: '🔔 Nueva cotización por aprobar',
            description: `${currentUser?.name} solicita aprobación — ${quoteNumber} para ${client.name} · ${formatCurrency(total)}`,
            type: 'alert',
            forAdmin: true,
        });
        addAuditLog({
            userId: currentUser?.id || '',
            userName: currentUser?.name || 'Vendedor',
            userRole: currentUser?.role || 'Vendedor',
            action: 'QUOTE_APPROVAL_REQUESTED',
            targetId: client.id,
            targetName: client.company || client.name,
            details: `Cotización ${quoteNumber} enviada a aprobación · Total: ${formatCurrency(total)}`,
            verified: true,
        });
        setSentConfirm({ quoteNumber, email: '', pending: true });
        setShowPreview(false);
    };

    // Reintentar el envío del email después de una aprobación donde Resend falló.
    // El vendedor lo dispara sin pasar de nuevo por aprobación.
    const retryDelivery = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!editQuote || !client?.email) return;
        setIsSendingEmail(true);
        try {
            const sentAt = new Date().toISOString();
            const res = await fetch('/api/quotes/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteNumber: editQuote.quoteNumber || editQuote.number,
                    clientName: client.name, clientEmail: client.email, clientCompany: client.company || '',
                    sellerName: editQuote.sellerName || 'ArteConcreto', sellerId: editQuote.sellerId || '',
                    sentAt, sentByName: editQuote.approvedByName || currentUser?.name || '', sentById: editQuote.approvedBy || currentUser?.id || '',
                    items: items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, unit: i.unit })),
                    subtotal, tax, total,
                    shipping: shipping > 0 ? shipping : 0,
                    shippingCity: client.city || '',
                    referencia, validUntil: displayValidUntil, deliveryTime, paymentTerms,
                    sellerPhone: currentUser?.phone || '',
                }),
            });
            const data = await res.json();
            if (res.ok) {
                updateQuote(editQuote.id, {
                    status: 'Sent', sentAt: data.sentAt || sentAt,
                    sentByName: editQuote.approvedByName || currentUser?.name || '',
                    sentById: editQuote.approvedBy || currentUser?.id || '',
                    deliveryFailed: false, deliveryError: undefined,
                });
                addNotification({ title: 'Email enviado', description: `Cotización ${editQuote.quoteNumber || editQuote.number} entregada.`, type: 'success' });
            } else {
                updateQuote(editQuote.id, { deliveryError: data.error || `HTTP ${res.status}` });
                addNotification({ title: 'Reintentar falló', description: data.error || 'Verifica la configuración de Resend.', type: 'alert' });
            }
        } catch (err: any) {
            updateQuote(editQuote.id, { deliveryError: String(err?.message || err) });
            addNotification({ title: 'Error de red', description: 'No se pudo enviar. Intenta otra vez.', type: 'alert' });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const executeGeneratePDF = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) return;
        if (!ensureQuoteOwnerReady()) return;
        const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

        if (!isAdmin) {
            requestApproval();
            return;
        }
        if (!assertNoQuoteNumberConflict()) return;

        setIsSaving(true);
        try {
            let quoteNumber: string;
            let quoteId: string;
            if (isEditMode && editQuoteId) {
                const existing = quotes.find(q => q.id === editQuoteId);
                // Recompute number so AIU toggle is reflected on the stored quote
                quoteNumber = genQuoteNumber();
                updateQuote(editQuoteId, { ...getCommonQuoteFields(client, quoteNumber, items), status: existing?.status || 'Draft' as const });
                quoteId = editQuoteId;
            } else {
                quoteNumber = genQuoteNumber();
                quoteId = await addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'Draft' as const });
            }
            await generateProposalPDF(buildPdfData(client, quoteNumber));
            addAuditLog({ userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema', userRole: currentUser?.role || 'Vendedor', action: 'QUOTE_SENT', targetId: client.id, targetName: client.company || client.name, details: `Cotización ${quoteNumber} ${isEditMode ? 'editada' : 'generada'} · Total: ${formatCurrency(total)}`, verified: true });
            addNotification({ title: `Cotización ${quoteNumber} lista`, description: 'PDF descargado. Recuerda enviársela al cliente.', type: 'success' });
            // El PDF ya se descargó pero aún no se envió al cliente — disparamos el recordatorio.
            setPostGenReminder({ quoteNumber, quoteId });
        } finally {
            setIsSaving(false);
            setShowPreview(false);
        }
    };

    const handleSaveAndGenerate = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) { addNotification({ title: 'Cliente requerido', description: 'Selecciona un cliente.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        setPendingAction('pdf');
        setShowPreview(true);
    };

    // ── Acciones del recordatorio post-PDF (la cotización YA existe, solo enviamos/re-descargamos) ──
    const reminderRedownloadPDF = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client || !postGenReminder) return;
        setReminderBusy('download');
        try {
            await generateProposalPDF(buildPdfData(client, postGenReminder.quoteNumber));
            addNotification({ title: 'PDF re-descargado', description: `Cotización ${postGenReminder.quoteNumber}`, type: 'success' });
        } finally {
            setReminderBusy(null);
        }
    };

    const reminderSendWhatsApp = () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client || !postGenReminder) return;
        if (!client.phone) { addNotification({ title: 'Teléfono requerido', description: 'El cliente no tiene número registrado.', type: 'alert' }); return; }
        setReminderBusy('wa');
        try {
            const quoteNumber = postGenReminder.quoteNumber;
            const phone = client.phone.replace(/\D/g, '');
            const intlPhone = phone.startsWith('57') ? phone : `57${phone}`;
            // El detalle de IVA/admin/utilidad va en el PDF; en WhatsApp el cliente
            // sólo necesita ver los productos y el TOTAL (igual que en el PDF que llega adjunto).
            const itemsList = items.map(i => `  • ${i.name} x${i.quantity}`).join('\n');
            const vigencia = `Vigencia hasta: ${displayValidUntil}`;
            const msg = [
                `Hola ${client.name.split(' ')[0]} 👋`,
                ``,
                `Adjunto encontrará la cotización *${quoteNumber}* de *ArteConcreto S.A.S*:`,
                referencia ? `📋 ${referencia}` : '',
                ``,
                itemsList,
                ``,
                quoteMode === 'aiu' ? `(Cotización bajo régimen AIU)` : '',
                `*TOTAL: ${formatCurrency(total)}*`,
                ``,
                vigencia,
                `📍 Km 1+800, Anillo Vial, Floridablanca, Santander`,
                currentUser?.phone ? `📞 ${currentUser.phone}` : '',
            ].filter(l => l !== '').join('\n');
            window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
            // Marcar la cotización como enviada (actualizamos en lugar de crear duplicado)
            updateQuote(postGenReminder.quoteId, { status: 'Sent', sentAt: new Date().toISOString(), sentByName: currentUser?.name || '', sentById: currentUser?.id || '' });
            addAuditLog({ userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema', userRole: currentUser?.role || 'Vendedor', action: 'WHATSAPP_SENT', targetId: client.id, targetName: client.company || client.name, details: `WhatsApp enviado con cotización ${quoteNumber} · Total: ${formatCurrency(total)} → ${client.phone}`, verified: true });
            addNotification({ title: 'WhatsApp abierto', description: 'Revisa el mensaje y envíalo desde WhatsApp.', type: 'success' });
            setPostGenReminder(null);
        } finally {
            setReminderBusy(null);
        }
    };

    const reminderSendEmail = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client || !postGenReminder) return;
        if (!client.email) { addNotification({ title: 'Email requerido', description: 'El cliente no tiene email.', type: 'alert' }); return; }
        setReminderBusy('email');
        try {
            const sentAt = new Date().toISOString();
            const quoteNumber = postGenReminder.quoteNumber;
            const res = await fetch('/api/quotes/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteNumber, clientName: client.name, clientEmail: client.email,
                    clientCompany: client.company || '', sellerName: currentUser?.name || 'ArteConcreto',
                    sellerId: currentUser?.id || '', sentAt, sentByName: currentUser?.name || '', sentById: currentUser?.id || '',
                    items: items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, unit: i.unit })),
                    subtotal, tax, total,
                    shipping: shipping > 0 ? shipping : 0,
                    shippingCity: client.city || '',
                    referencia, validUntil: displayValidUntil, deliveryTime, paymentTerms,
                    sellerPhone: currentUser?.phone || '',
                }),
            });
            const data = await res.json();
            if (res.ok) {
                updateQuote(postGenReminder.quoteId, { status: 'Sent', sentAt: data.sentAt || sentAt, sentByName: data.sentByName || currentUser?.name || '', sentById: data.sentById || currentUser?.id || '' });
                addAuditLog({ userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema', userRole: currentUser?.role || 'Vendedor', action: 'QUOTE_SENT', targetId: client.id, targetName: client.company || client.name, details: `Email enviado con cotización ${quoteNumber} → ${client.email}`, verified: true });
                addNotification({ title: `Cotización ${quoteNumber} enviada`, description: `Enviada a ${client.email}`, type: 'success' });
                setPostGenReminder(null);
            } else {
                addNotification({ title: 'Error al enviar', description: data.error || 'Verifica la clave Resend.', type: 'alert' });
            }
        } catch {
            addNotification({ title: 'Error de conexión', description: 'No se pudo enviar.', type: 'alert' });
        } finally {
            setReminderBusy(null);
        }
    };

    const executeWhatsApp = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.phone) return;
        const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';
        if (!isAdmin) {
            requestApproval();
            return;
        }
        if (!assertNoQuoteNumberConflict()) return;
        const quoteNumber = genQuoteNumber();
        await addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'Sent' as const });
        const phone = client.phone.replace(/\D/g, '');
        const intlPhone = phone.startsWith('57') ? phone : `57${phone}`;
        const itemsList = items.map(i => `  • ${i.name} x${i.quantity}`).join('\n');
        const vigencia = `Vigencia hasta: ${displayValidUntil}`;
        const msg = [
            `Hola ${client.name.split(' ')[0]} 👋`,
            ``,
            `Adjunto encontrará la cotización *${quoteNumber}* de *ArteConcreto S.A.S*:`,
            referencia ? `📋 ${referencia}` : '',
            ``,
            itemsList,
            ``,
            quoteMode === 'aiu' ? `(Cotización bajo régimen AIU)` : '',
            `*TOTAL: ${formatCurrency(total)}*`,
            ``,
            vigencia,
            `📍 Km 1+800, Anillo Vial, Floridablanca, Santander`,
            currentUser?.phone ? `📞 ${currentUser.phone}` : '',
        ].filter(l => l !== '').join('\n');
        window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        addAuditLog({ userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema', userRole: currentUser?.role || 'Vendedor', action: 'WHATSAPP_SENT', targetId: client.id, targetName: client.company || client.name, details: `WhatsApp enviado con cotización ${quoteNumber} · Total: ${formatCurrency(total)} → ${client.phone}`, verified: true });
        setShowPreview(false);
    };

    const handleSendWhatsApp = () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.phone) { addNotification({ title: 'Teléfono requerido', description: 'El cliente no tiene número registrado.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        setPendingAction('whatsapp');
        setShowPreview(true);
    };

    const executeEmail = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.email) return;
        if (!ensureQuoteOwnerReady()) return;
        const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

        if (!isAdmin) {
            requestApproval();
            return;
        }
        if (!assertNoQuoteNumberConflict()) return;

        setIsSendingEmail(true);
        try {
            const sentAt = new Date().toISOString();
            const quoteNumber = genQuoteNumber();
            const quoteId = await addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'Draft' as const, sentAt, sentByName: currentUser?.name || '', sentById: currentUser?.id || '' });
            const res = await fetch('/api/quotes/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteNumber, clientName: client.name, clientEmail: client.email,
                    clientCompany: client.company || '', sellerName: currentUser?.name || 'ArteConcreto',
                    sellerId: currentUser?.id || '', sentAt, sentByName: currentUser?.name || '', sentById: currentUser?.id || '',
                    items: items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, unit: i.unit })),
                    subtotal, tax, total,
                    shipping: shipping > 0 ? shipping : 0,
                    shippingCity: client.city || '',
                    referencia, validUntil: displayValidUntil, deliveryTime, paymentTerms,
                    sellerPhone: currentUser?.phone || '',
                }),
            });
            const data = await res.json();
            if (res.ok) {
                updateQuote(quoteId, { status: 'Sent', sentAt: data.sentAt || sentAt, sentByName: data.sentByName || currentUser?.name || '', sentById: data.sentById || currentUser?.id || '' });
                addAuditLog({ userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema', userRole: currentUser?.role || 'Vendedor', action: 'QUOTE_SENT', targetId: client.id, targetName: client.company || client.name, details: `Email enviado con cotización ${quoteNumber} → ${client.email}`, verified: true });
                addNotification({ title: `Cotización ${quoteNumber} enviada`, description: `Enviada a ${client.email}`, type: 'success' });
                setSentConfirm({ quoteNumber, email: client.email });
            } else {
                addNotification({ title: 'Error al enviar', description: data.error || 'Verifica la clave Resend.', type: 'alert' });
            }
        } catch {
            addNotification({ title: 'Error de conexión', description: 'No se pudo enviar.', type: 'alert' });
        } finally {
            setIsSendingEmail(false);
            setShowPreview(false);
        }
    };

    const handleSendEmail = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.email) { addNotification({ title: 'Email requerido', description: 'El cliente no tiene email.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        setPendingAction('email');
        setShowPreview(true);
    };


    const handleCreateClient = (e: React.FormEvent) => {
        e.preventDefault();
        const id = addClient({ ...newClient, status: 'Active', value: '$0', ltv: 0, lastContact: 'Ahora', city: newClient.city || '', score: 10, category: 'Construcción', registrationDate: new Date().toISOString() });
        setSelectedClientId(id);
        setShowNewClientForm(false);
        setNewClient({ name: '', company: '', companyId: '', position: '', email: '', phone: '', city: '' });
        addNotification({ title: 'Cliente creado', description: `${newClient.name} vinculado a la cotización.`, type: 'success' });
    };

    return (
        <>
        {/* Quote number badge — editable para cotizaciones nuevas.
            Si el vendedor deja el input vacío, usa el consecutivo automático
            (autoPreviewNumber). Si escribe algo, ese valor reemplaza al consecutivo
            y se guarda como quoteNumber real de la cotización. No incrementa el
            contador interno cuando hay override (para no saltarse números). */}
        {!isEditMode ? (
            <div className="mb-4 px-5 py-3 rounded-2xl bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4 text-primary shrink-0" />
                    <label className="text-sm font-black text-foreground">Nueva cotización:</label>
                    <input
                        type="text"
                        value={customQuoteNumber}
                        onChange={(e) => setCustomQuoteNumber(e.target.value)}
                        placeholder={autoPreviewNumber}
                        className="flex-1 min-w-[180px] bg-white/70 border border-primary/30 rounded-lg px-3 py-1.5 text-sm font-black text-primary outline-none focus:bg-white focus:border-primary transition-all placeholder:text-primary/60 placeholder:font-black"
                        title="Dejá vacío para usar el consecutivo automático, o escribí un número distinto"
                    />
                    {customQuoteNumber.trim() && (
                        <button
                            type="button"
                            onClick={() => setCustomQuoteNumber('')}
                            className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest shrink-0"
                            title="Volver al consecutivo automático"
                        >
                            Auto
                        </button>
                    )}
                </div>
                {customQuoteNumber.trim() && isQuoteNumberConflict && (
                    <p className="text-[10px] text-rose-600 font-bold mt-2 ml-7">
                        ⚠ Ya existe una cotización con este número. Cambialo o dejá el campo vacío para usar el consecutivo.
                    </p>
                )}
                {customQuoteNumber.trim() && !isQuoteNumberConflict && (
                    <p className="text-[10px] text-muted-foreground mt-2 ml-7">
                        Sobreescribiendo el consecutivo. El número automático <strong>{autoPreviewNumber}</strong> queda libre para la próxima cotización.
                    </p>
                )}
            </div>
        ) : editQuoteId && (() => {
            const editingQuote = quotes.find(q => q.id === editQuoteId);
            return editingQuote ? (
                <div className="mb-4 space-y-2">
                    <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-400/30">
                        <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        <p className="text-sm font-black text-amber-700">
                            Editando <span className="text-amber-900">{previewNumber}</span>
                            {editingQuote.version && editingQuote.version > 1 && <span className="ml-2 text-[10px] font-black bg-amber-400/30 text-amber-800 px-2 py-0.5 rounded-full uppercase">V{editingQuote.version - 1}</span>}
                            {isAIU && <span className="ml-2 text-[10px] font-black bg-blue-400/20 text-blue-700 px-2 py-0.5 rounded-full uppercase">AIU</span>}
                            {editingQuote.client && <span className="font-medium text-amber-600"> — {editingQuote.client}</span>}
                        </p>
                    </div>
                    {/* Version action button */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={async () => {
                                if (!editingQuote) return;
                                const newId = await createQuoteVersion(editingQuote.id);
                                if (newId) addNotification({ title: 'Nueva versión creada', description: `Se creó V${editingQuote.version || 1} (revisión) para seguir editando`, type: 'success' });
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white border border-border/60 text-foreground hover:bg-accent/50 hover:border-primary/30 transition-all"
                        >
                            <GitBranch className="w-3.5 h-3.5 text-primary" />
                            Crear V{(editingQuote.version || 1)} (nueva revisión)
                        </button>
                    </div>
                </div>
            ) : null;
        })()}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT: Client + Catalog ── */}
            <div className="lg:col-span-2 space-y-6">

                {/* Client Selector */}
                <div className="surface-panel rounded-[2rem] p-6 flex flex-col md:flex-row items-start gap-6 relative z-40 group overflow-visible">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-accent/70 flex items-center justify-center text-primary shrink-0 border border-primary/15 group-hover:scale-110 transition-transform duration-500">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <div className="flex-1 w-full space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Cliente vinculado a la oferta</label>
                            <button type="button" onClick={() => setShowNewClientForm(p => !p)}
                                className="text-[9px] font-black uppercase text-primary hover:text-foreground transition-colors flex items-center gap-1.5">
                                <UserPlus className="w-3 h-3" />
                                {showNewClientForm ? 'Cerrar' : 'Crear nuevo cliente'}
                            </button>
                        </div>
                        <div className="relative">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar cliente por nombre, empresa o email..."
                                    value={selectedClientId
                                        ? (() => { const c = clients.find(x => x.id === selectedClientId); return c ? `${c.name}${c.company ? ` — ${c.company}` : ''}` : clientSearch; })()
                                        : clientSearch}
                                    onChange={e => {
                                        setClientSearch(e.target.value);
                                        setSelectedClientId('');
                                        setShowClientDropdown(true);
                                    }}
                                    onFocus={() => setShowClientDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                                    className="w-full bg-white/75 border border-border/70 rounded-2xl pl-11 pr-10 py-4 text-sm focus:border-primary focus:bg-white outline-none transition-all font-black text-foreground italic"
                                />
                                {selectedClientId && (
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedClientId(''); setClientSearch(''); }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-rose-500 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                            {showClientDropdown && filteredClients.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border/60 rounded-2xl shadow-2xl z-[120] overflow-hidden max-h-[260px] overflow-y-auto">
                                    {filteredClients.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onMouseDown={() => {
                                                setSelectedClientId(c.id);
                                                setClientSearch('');
                                                setShowClientDropdown(false);
                                            }}
                                            className="w-full text-left px-5 py-3 hover:bg-primary/5 transition-colors flex items-center gap-3 border-b border-border/20 last:border-0"
                                        >
                                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                                                {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-foreground truncate">{c.name}</p>
                                                {c.company && <p className="text-[10px] text-muted-foreground truncate">{c.company}</p>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showClientDropdown && clientSearch && filteredClients.length === 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border/60 rounded-2xl shadow-2xl z-[120] px-5 py-4">
                                    <p className="text-sm text-muted-foreground font-bold">No se encontraron clientes</p>
                                </div>
                            )}
                        </div>

                        {/* Opción: ocultar nombre del contacto en el PDF.
                            Solo aparece cuando hay un cliente seleccionado (no tiene
                            sentido configurarlo antes de elegir destinatario).
                            Pedido del cliente 16-may-2026 — cotizaciones a
                            instituciones donde el destinatario es la empresa sin
                            persona específica (ej. "NM ARQUITECTOS" sin Valery). */}
                        {selectedClientId && !showNewClientForm && (
                            <label className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-border/60 bg-white/60 cursor-pointer hover:bg-white/80 transition-all">
                                <input
                                    type="checkbox"
                                    checked={hideContactName}
                                    onChange={e => setHideContactName(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-foreground">
                                        Ocultar nombre del contacto en el PDF
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        En el PDF solo aparece la empresa y la ciudad. Útil cuando la cotización va dirigida a la institución sin persona específica.
                                    </p>
                                </div>
                            </label>
                        )}

                        {showNewClientForm && (
                            <div className="rounded-2xl border border-primary/20 bg-white/80 p-5 space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Nuevo cliente rápido</p>
                                <form onSubmit={handleCreateClient} className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input required placeholder="Nombre completo" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all" />
                                        {/* Empresa: combobox con búsqueda + create-on-the-fly. */}
                                        <CompanyCombobox
                                            label=""
                                            value={newClient.companyId}
                                            valueName={newClient.company}
                                            onChange={({ companyId, companyName }) =>
                                                setNewClient({ ...newClient, companyId, company: companyName })
                                            }
                                        />
                                        <input type="email" required placeholder="Email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all" />
                                        <input required placeholder="Teléfono / WhatsApp" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all" />
                                        <input placeholder="Cargo (Director de Compras, Asistente, ...)" value={newClient.position} onChange={e => setNewClient({ ...newClient, position: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all col-span-2" />
                                        <input required placeholder="Ciudad" value={newClient.city} onChange={e => setNewClient({ ...newClient, city: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all col-span-2" />
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="submit" className="flex-1 bg-primary text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                            <CheckCircle className="w-4 h-4" /> Guardar y Vincular
                                        </button>
                                        <button type="button" onClick={() => setShowNewClientForm(false)}
                                            className="px-6 bg-white border border-border/70 text-muted-foreground font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-accent/50 transition-all">
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                {/* Product Catalog */}
                <div className="surface-panel rounded-[2rem] overflow-hidden">
                    {/* Catalog header */}
                    <div className="px-6 py-4 border-b border-border/40 bg-white/30 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Package className="w-5 h-5 text-primary" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Catálogo de Productos</h2>
                            {isSyncing ? (
                                <span className="text-[9px] font-black uppercase text-muted-foreground animate-pulse">Sincronizando...</span>
                            ) : (
                                <span className="text-[9px] font-black text-muted-foreground">{products.filter(p => !p.isDeleted && p.isActive !== false).length} productos</span>
                            )}
                        </div>
                        <button onClick={async () => { setIsSyncing(true); try { await refreshProducts(); } finally { setIsSyncing(false); } }}
                            disabled={isSyncing}
                            className="p-2 rounded-xl border border-border/60 hover:bg-accent/50 transition-all disabled:opacity-50">
                            <RefreshCw className={clsx("w-4 h-4 text-muted-foreground", isSyncing && "animate-spin")} />
                        </button>
                    </div>

                    {/* Search bar */}
                    <div className="px-6 py-3 border-b border-border/30 bg-white/20">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, SKU o categoría..."
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                className="w-full bg-white/80 border border-border/60 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>

                    {/* Custom product button */}
                    <div className="px-4 pt-3 pb-1">
                        <button
                            type="button"
                            onClick={() => setShowCustomProductForm(prev => !prev)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary font-black text-[10px] uppercase tracking-widest hover:bg-primary/10 hover:border-primary/60 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {showCustomProductForm ? 'Cerrar producto personalizado' : 'Agregar producto personalizado con imagen'}
                        </button>
                    </div>

                    {showCustomProductForm && (
                        <div className="mx-4 mt-3 mb-2 rounded-2xl border border-primary/25 bg-white/80 p-4 shadow-sm">
                            <div className="flex items-start gap-4">
                                <input
                                    ref={customImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleCustomProductImageUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => customImageInputRef.current?.click()}
                                    className="w-24 h-24 shrink-0 overflow-hidden rounded-2xl border border-dashed border-primary/40 bg-primary/5 flex items-center justify-center hover:bg-primary/10 transition-all"
                                    title="Subir imagen del producto personalizado"
                                >
                                    {customProduct.image ? (
                                        <img src={customProduct.image} alt="Producto personalizado" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-primary">
                                            <ImagePlus className="w-6 h-6" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Imagen</span>
                                        </div>
                                    )}
                                </button>
                                <div className="flex-1 min-w-0 space-y-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Producto personalizado</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Para productos fuera del catálogo o diseños especiales.</p>
                                    </div>
                                    <input
                                        type="text"
                                        value={customProduct.name}
                                        onChange={e => setCustomProduct({ ...customProduct, name: e.target.value })}
                                        placeholder="Nombre del producto"
                                        className="w-full bg-white border border-border/70 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-all"
                                    />
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-primary">
                                            Dimensiones del producto
                                        </label>
                                        <input
                                            type="text"
                                            value={customProduct.dimensions}
                                            onChange={e => setCustomProduct({ ...customProduct, dimensions: e.target.value })}
                                            placeholder="Ej: Alto 90 × Ancho 150 × Largo 300 cm"
                                            className="w-full bg-white border border-primary/30 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            value={customProduct.priceBeforeTax || ''}
                                            onChange={e => setCustomProduct({ ...customProduct, priceBeforeTax: parseFloat(e.target.value) || 0 })}
                                            placeholder="Precio antes de IVA"
                                            className="w-full bg-white border border-border/70 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-all"
                                        />
                                        <select
                                            value={customProduct.taxRate}
                                            onChange={e => setCustomProduct({ ...customProduct, taxRate: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-white border border-border/70 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-all"
                                        >
                                            <option value={0}>IVA 0%</option>
                                            <option value={0.05}>IVA 5%</option>
                                            <option value={0.19}>IVA 19%</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            value={customProduct.quantity}
                                            onChange={e => setCustomProduct({ ...customProduct, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                            placeholder="Cantidad"
                                            className="w-full bg-white border border-border/70 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-all"
                                        />
                                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Final unitario</p>
                                            <p className="text-xs font-black text-primary">
                                                {formatCurrency(priceWithTax(customProduct.priceBeforeTax, customProduct.taxRate))}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={addCustomProduct}
                                            className="flex-1 bg-primary text-black font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest hover:brightness-105 transition-all"
                                        >
                                            Agregar personalizado
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCustomProductForm(false);
                                                setCustomProduct({ name: '', dimensions: '', priceBeforeTax: 0, taxRate: 0.19, quantity: 1, image: '' });
                                                if (customImageInputRef.current) customImageInputRef.current.value = '';
                                            }}
                                            className="px-4 bg-white border border-border/70 text-muted-foreground font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest hover:bg-accent/50 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Product grid */}
                    <div className="p-4 max-h-[480px] overflow-y-auto custom-scrollbar">
                        {filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Box className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                                    {isSyncing ? 'Cargando catálogo...' : productSearch ? 'Sin resultados' : 'Sin productos — Sincroniza el catálogo web'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {filteredProducts.map(product => {
                                    const inCart = items.find(i => i.productId === product.id);
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => addProductToQuote(product)}
                                            className={clsx(
                                                "group/card relative text-left rounded-2xl border transition-all overflow-hidden hover:shadow-lg hover:-translate-y-0.5",
                                                inCart
                                                    ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/10"
                                                    : "border-border/50 bg-white/60 hover:border-primary/30"
                                            )}
                                        >
                                            {/* Product image */}
                                            <div className="relative aspect-[4/3] bg-accent/30 overflow-hidden">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name}
                                                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Box className="w-8 h-8 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                {/* SKU badge */}
                                                <div className="absolute top-2 left-2 bg-black/60 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide backdrop-blur-sm">
                                                    {product.sku || `#${product.id?.slice(-4)}`}
                                                </div>
                                                {/* In cart badge */}
                                                {inCart && (
                                                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                                                        <span className="text-[9px] font-black text-black">{inCart.quantity}</span>
                                                    </div>
                                                )}
                                                {/* Add overlay */}
                                                <div className="absolute inset-0 bg-primary/0 group-hover/card:bg-primary/10 transition-colors flex items-center justify-center">
                                                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 scale-75 group-hover/card:scale-100 transition-all shadow-xl">
                                                        <Plus className="w-5 h-5 text-black" />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Product info */}
                                            <div className="p-3">
                                                <p className="text-[10px] font-black text-foreground uppercase leading-tight line-clamp-2 mb-1">{product.name}</p>
                                                {/* Specs from WooCommerce — dimensions + weight when present */}
                                                {(product.dimensions || product.weight) && (
                                                    <p className="text-[8.5px] font-bold text-muted-foreground/80 leading-tight mb-1 line-clamp-1">
                                                        {product.dimensions}
                                                        {product.dimensions && product.weight ? ' · ' : ''}
                                                        {product.weight ? `${product.weight} kg` : ''}
                                                    </p>
                                                )}
                                                <p className="text-sm font-black text-primary">{formatCurrency(product.price)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── RIGHT: Commercial Conditions + Cart + Totals ── */}
            <div className="space-y-4">

                {/* Condiciones Comerciales */}
                <div className="surface-panel rounded-[2rem] overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/40 bg-white/30 flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest">Condiciones Comerciales</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Referencia del Proyecto *</label>
                            <input
                                type="text"
                                value={referencia}
                                onChange={e => setReferencia(e.target.value)}
                                placeholder="SUMINISTRO DE MOBILIARIO EN CONCRETO PARA..."
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Vigencia (días)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={validityDays}
                                    onChange={e => setValidityDays(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_VALIDITY_DAYS))}
                                    className="w-20 bg-white/80 border border-border/60 rounded-xl px-3 py-3 text-[11px] font-black text-center outline-none focus:border-primary transition-all text-foreground"
                                />
                                <span className="text-[10px] font-bold text-muted-foreground">
                                    días → válida hasta el <strong className="text-foreground">{computedValidUntil}</strong>
                                </span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/70">
                                Default 30. Si necesitas una fecha exacta diferente, edítala abajo.
                            </p>
                            <input
                                type="text"
                                value={validUntil}
                                onChange={e => setValidUntil(e.target.value)}
                                placeholder={`(opcional) sobreescribir: ${computedValidUntil}`}
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-2.5 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Lugar de Entrega (opcional)</label>
                            <input
                                type="text"
                                value={deliveryLocation}
                                onChange={e => setDeliveryLocation(e.target.value)}
                                placeholder={selectedClient?.city ? `Por defecto: ${selectedClient.city}` : 'Ciudad o dirección de entrega'}
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60"
                            />
                            <p className="text-[9px] text-muted-foreground/70">Reemplaza el “se entrega en {'{ciudad del cliente}'}” del alcance.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Plazo de Entrega</label>
                            <input
                                type="text"
                                value={deliveryTime}
                                onChange={e => setDeliveryTime(e.target.value)}
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Forma de Pago</label>
                            <textarea
                                value={paymentTerms}
                                onChange={e => setPaymentTerms(e.target.value)}
                                rows={4}
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground resize-none"
                            />
                        </div>
                        {/* Observaciones — bloque opcional que aparece como caja
                            destacada al final del PDF. Pedido del cliente 7-may-2026.
                            Una línea por punto; cada línea se renderiza con bullet. */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center justify-between">
                                <span>Observaciones <span className="opacity-50">(opcional)</span></span>
                                <span className="opacity-50">una línea por punto</span>
                            </label>
                            <textarea
                                value={observations}
                                onChange={e => setObservations(e.target.value)}
                                rows={4}
                                placeholder="Ej:&#10;Mobiliario fabricado en concreto arquitectónico de 4500PSI.&#10;Si las cantidades varían el precio podría estar sujeto a variación.&#10;Para la correcta instalación se requiere piso firme y nivelado."
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground resize-none placeholder:text-muted-foreground/50 placeholder:font-normal"
                            />
                        </div>
                    </div>
                </div>
                <div className="surface-panel rounded-[2rem] overflow-visible sticky top-6 z-30">

                    {/* Cart header */}
                    <div className="px-5 py-4 border-b border-border/40 bg-white/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-primary" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Productos Seleccionados</h3>
                        </div>
                        <span className={clsx(
                            "text-[9px] font-black px-2.5 py-1 rounded-full",
                            items.length > 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                            {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                        </span>
                    </div>

                    {/* Items list */}
                    <div className="max-h-[420px] overflow-y-auto custom-scrollbar divide-y divide-border/30">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                <ShoppingCart className="w-8 h-8 text-muted-foreground/20 mb-2" />
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                    Agrega productos del catálogo o personalizados
                                </p>
                            </div>
                        ) : (
                            items.map(item => (
                                <div key={item.id} className="px-4 py-3 bg-white/20 hover:bg-white/40 transition-colors">
                                    <div className="flex items-start gap-3">
                                        {/* Thumbnail */}
                                        <div className="w-10 h-10 rounded-xl bg-accent/40 border border-border/40 overflow-hidden shrink-0 mt-0.5">
                                            {item.image
                                                ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                : <Box className="w-4 h-4 text-muted-foreground m-auto mt-3" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            {/* Name — editable if custom */}
                                            {item.isCustom ? (
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={e => updateItemName(item.id, e.target.value)}
                                                    placeholder="Nombre del producto"
                                                    className="w-full bg-white border border-primary/30 rounded-lg px-2 py-1 text-[10px] font-black text-foreground uppercase outline-none focus:border-primary transition-all"
                                                />
                                            ) : (
                                                <p className="text-[10px] font-black text-foreground uppercase leading-tight line-clamp-2">{item.name}</p>
                                            )}
                                            {/* Dimensions */}
                                            <input
                                                type="text"
                                                value={item.dimensions || ''}
                                                onChange={e => updateItemDimensions(item.id, e.target.value)}
                                                placeholder="Dimensiones (ej: 60 × 40 × 45 cm)"
                                                className="w-full bg-transparent text-[10px] font-bold text-muted-foreground outline-none border-b border-transparent focus:border-primary/40 placeholder:text-muted-foreground/50 transition-all"
                                            />
                                            {/* Peso (read-only — viene de WooCommerce) */}
                                            {item.weight ? (
                                                <p className="text-[9px] font-bold text-muted-foreground/70 leading-none">
                                                    Peso: {item.weight} kg{item.quantity > 1 ? ` · Total: ${(item.weight * item.quantity).toFixed(1)} kg` : ''}
                                                </p>
                                            ) : null}
                                            {/* Unit + Price row */}
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={item.unit}
                                                    onChange={e => updateItemUnit(item.id, e.target.value)}
                                                    className="bg-transparent text-[10px] font-bold text-muted-foreground outline-none border-b border-transparent focus:border-primary/40 transition-all cursor-pointer"
                                                >
                                                    {['un','m²','m³','ml','kg','gl','lt','set','hr'].map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                                <span className="text-muted-foreground/40 text-[9px]">·</span>
                                                <input
                                                    type="number"
                                                    value={item.isCustom ? priceBeforeTaxForItem(item) : item.price}
                                                    onChange={e => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                                    title={item.isCustom ? 'Precio antes de IVA' : 'Precio unitario con IVA incluido'}
                                                    className="flex-1 bg-transparent text-[11px] font-black text-primary outline-none border-b border-transparent focus:border-primary/40 transition-all"
                                                />
                                            </div>
                                            {item.isCustom && (
                                                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                                    <select
                                                        value={item.taxRate ?? 0.19}
                                                        onChange={e => updateTaxRate(item.id, parseFloat(e.target.value) || 0)}
                                                        className="bg-white border border-border/60 rounded-lg px-2 py-1 text-[10px] font-black text-foreground outline-none focus:border-primary"
                                                    >
                                                        <option value={0}>IVA 0%</option>
                                                        <option value={0.05}>IVA 5%</option>
                                                        <option value={0.19}>IVA 19%</option>
                                                    </select>
                                                    <span className="text-[9px] font-black text-muted-foreground">
                                                        Final: {formatCurrency(item.price)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Qty stepper + delete */}
                                        <div className="flex flex-col items-center gap-1 shrink-0">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => updateQty(item.id, -1)}
                                                    className="w-6 h-6 rounded-lg bg-white border border-border/60 flex items-center justify-center hover:bg-rose-50 hover:border-rose-300 transition-all">
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    inputMode="numeric"
                                                    value={item.quantity}
                                                    onFocus={(e) => e.currentTarget.select()}
                                                    onChange={(e) => setQty(item.id, parseInt(e.target.value, 10))}
                                                    onBlur={(e) => {
                                                        // Si el vendedor borró todo y dejó vacío, restaurar a 1.
                                                        const v = parseInt(e.target.value, 10);
                                                        if (!Number.isFinite(v) || v < 1) setQty(item.id, 1);
                                                    }}
                                                    className="w-12 text-center text-xs font-black bg-white border border-border/60 rounded-lg outline-none focus:border-primary px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    aria-label={`Cantidad de ${item.name}`}
                                                />
                                                <button onClick={() => updateQty(item.id, 1)}
                                                    className="w-6 h-6 rounded-lg bg-white border border-border/60 flex items-center justify-center hover:bg-primary/10 hover:border-primary/40 transition-all">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <p className="text-[9px] font-black text-foreground/70">{formatCurrency(item.price * item.quantity)}</p>
                                            <button onClick={() => removeItem(item.id)}
                                                className="p-1 text-muted-foreground hover:text-rose-500 transition-colors">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ── Selector de modo: cotización normal vs AIU ────────────── */}
                    <div className="px-5 py-4 border-t border-border/40 bg-blue-50/30 space-y-3">
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Tipo de cotización</span>
                            <label className={clsx(
                                "flex items-start gap-3 rounded-xl border-2 px-3 py-3 cursor-pointer select-none transition-all",
                                quoteMode === 'aiu'
                                    ? "border-blue-500 bg-blue-500/10 shadow-sm"
                                    : "border-border/50 bg-white/70 hover:border-blue-400/40"
                            )}>
                                <input
                                    type="checkbox"
                                    checked={quoteMode === 'aiu'}
                                    onChange={e => setQuoteMode(e.target.checked ? 'aiu' : 'simple')}
                                    className="mt-0.5 w-4 h-4 rounded border-border/60 text-blue-500 focus:ring-blue-400 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <span className={clsx(
                                        "text-[10px] font-black uppercase tracking-widest",
                                        quoteMode === 'aiu' ? "text-blue-700" : "text-foreground"
                                    )}>
                                        Activar sistema AIU
                                    </span>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                        {quoteMode === 'aiu'
                                            ? 'AIU activo: Administración + Utilidad, IVA sólo sobre la utilidad y sufijo -AIU.'
                                            : 'Apagado: cotización normal con IVA sobre el subtotal.'}
                                    </p>
                                </div>
                            </label>
                            <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                                {quoteMode === 'simple'
                                    ? 'IVA 19% sobre todo el subtotal. Puedes incluir transporte como fila aparte.'
                                    : 'Régimen Administración + Utilidad. IVA aplica SÓLO sobre la utilidad. Sufijo -AIU al número.'}
                            </p>
                        </div>

                        {/* ── Modo SIMPLE: checkbox + monto + ciudad de transporte ── */}
                        {quoteMode === 'simple' && (
                            <div className="space-y-2 pt-2 border-t border-border/30">
                                <label className="flex items-start gap-3 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={includesTransport}
                                        onChange={e => setIncludesTransport(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded border-border/60 text-primary focus:ring-primary/40 cursor-pointer"
                                    />
                                    <div className="flex-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground">¿Incluye transporte?</span>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                            Si lo activas, sale como fila aparte “TRANSPORTE DESDE FLORIDABLANCA HASTA …”.
                                        </p>
                                    </div>
                                </label>
                                {includesTransport && (
                                    <div className="space-y-2 pt-1">
                                        <div>
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Monto base del transporte</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={transportAmount || ''}
                                                onChange={e => setTransportAmount(parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                                className="w-full px-3 py-2 rounded-xl border border-border/60 bg-white text-xs font-bold text-foreground outline-none focus:border-primary/60"
                                            />
                                            <p className="text-[9px] text-muted-foreground/70 mt-1">
                                                El sistema divide este valor entre 0.9, redondea hacia arriba al múltiplo de $1.000 y a esa base le suma IVA 19%. Ej: $630.000 → $700.000 + IVA.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Ciudad destino</label>
                                            <input
                                                type="text"
                                                value={transportCity}
                                                onChange={e => setTransportCity(e.target.value)}
                                                placeholder={selectedClient?.city || 'BUCARAMANGA'}
                                                className="w-full px-3 py-2 rounded-xl border border-border/60 bg-white text-xs font-bold text-foreground uppercase outline-none focus:border-primary/60"
                                            />
                                            <p className="text-[9px] text-muted-foreground/70 mt-1">
                                                Si lo dejas vacío se usa la ciudad del cliente: <strong>{selectedClient?.city || '(ninguna)'}</strong>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Modo AIU: Administración % + Utilidad % ────────────── */}
                        {quoteMode === 'aiu' && (
                            <div className="space-y-2 pt-2 border-t border-border/30">
                                <p className="text-[10px] text-muted-foreground leading-snug">
                                    Transporte, descargue e instalación están <strong>absorbidos en el % de Administración</strong> — los negocias internamente con el cliente.
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Administración %</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.01}
                                            value={adminPercent}
                                            onChange={e => setAdminPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                                            className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-bold text-foreground outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Utilidad %</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.01}
                                            value={utilityPercent}
                                            onChange={e => setUtilityPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                                            className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-bold text-foreground outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <p className="text-[9px] text-muted-foreground/70">
                                    El IVA del 19% se calcula <strong>sólo sobre la utilidad</strong>, no sobre todo el subtotal.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Totales (modelo nuevo, derivados de calculateQuoteTotals) ── */}
                    <div className="px-5 py-4 border-t border-border/40 bg-white/20 space-y-2">
                        {quoteMode === 'simple' ? (
                            <>
                                <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    <span>Productos (antes de IVA)</span>
                                    <span>{formatCurrency(calc.productsSubtotal)}</span>
                                </div>
                                {calc.transportBeforeTax !== undefined && (
                                    <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        <span>Transporte (antes de IVA)</span>
                                        <span>{formatCurrency(calc.transportBeforeTax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest pt-1 border-t border-border/30">
                                    <span>Valor total antes de IVA</span>
                                    <span>{formatCurrency(calc.subtotalLine1)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    <span>IVA 19%</span>
                                    <span>{formatCurrency(calc.taxAmount)}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    <span>Subtotal productos</span>
                                    <span>{formatCurrency(calc.productsSubtotal)}</span>
                                </div>
                                {calc.adminAmount !== undefined && (
                                    <div className="flex justify-between text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                        <span>Administración ({adminPercent}%)</span>
                                        <span>{formatCurrency(calc.adminAmount)}</span>
                                    </div>
                                )}
                                {calc.utilityAmount !== undefined && (
                                    <div className="flex justify-between text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                        <span>Utilidad ({utilityPercent}%)</span>
                                        <span>{formatCurrency(calc.utilityAmount)}</span>
                                    </div>
                                )}
                                {calc.subtotalAfterAiu !== undefined && (
                                    <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest pt-1 border-t border-border/30">
                                        <span>Subtotal acumulado</span>
                                        <span>{formatCurrency(calc.subtotalAfterAiu)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    <span>IVA 19% sólo sobre utilidad</span>
                                    <span>{formatCurrency(calc.taxAmount)}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between items-baseline pt-2 border-t border-border/40">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Total</span>
                            <span className="text-2xl font-black text-foreground tracking-tighter">{formatCurrency(calc.total)}</span>
                        </div>
                    </div>

                    {/* Actions — lógica de bloqueo por flujo de aprobación ────────── */}
                    {(() => {
                        const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';
                        const st = editQuote?.status;
                        // Admin tiene acceso directo siempre. Vendedor SOLO puede enviar/descargar
                        // cuando la cotización está Approved o Sent (= aprobada por SuperAdmin).
                        const isUnlocked   = isAdmin || st === 'Approved' || st === 'Sent';
                        const isPending    = st === 'PendingApproval' || st === 'PENDING_APPROVAL';
                        const hasChanges   = st === 'ChangesRequested';
                        // Vendedor en cotización aprobada pero el email falló → botón reintentar
                        const canRetry     = !isAdmin && st === 'Approved' && editQuote?.deliveryFailed;
                        // Vendedor en Draft o nueva cotización → CTA "Solicitar aprobación"
                        const needsRequest = !isAdmin && (!editQuote || st === 'Draft');

                        return (
                            <div className="px-5 pb-5 space-y-2.5">
                                {/* Banner: SuperAdmin pidió cambios */}
                                {hasChanges && editQuote?.reviewNotes && editQuote.reviewNotes.length > 0 && (() => {
                                    const last = [...editQuote.reviewNotes].reverse().find(n => n.action === 'changes_requested');
                                    if (!last) return null;
                                    return (
                                        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                <p className="text-xs font-black uppercase tracking-widest text-amber-900">{last.byName} pidió cambios</p>
                                            </div>
                                            {last.comment && <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{last.comment}</p>}
                                            <p className="text-[10px] text-amber-700">Corrige lo que indicó y vuelve a "Re-enviar a aprobación".</p>
                                        </div>
                                    );
                                })()}

                                {/* Banner: envío falló después de aprobación */}
                                {canRetry && (
                                    <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-widest text-rose-900">⚠️ El envío falló</p>
                                        <p className="text-sm text-rose-900">La cotización ya está aprobada pero el correo no se entregó. {editQuote?.deliveryError && (<span className="opacity-75">({editQuote.deliveryError})</span>)}</p>
                                        <button onClick={retryDelivery} disabled={isSendingEmail}
                                            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50">
                                            {isSendingEmail ? 'Reintentando...' : '🔄 Reintentar envío al cliente'}
                                        </button>
                                    </div>
                                )}

                                {/* Preview button — siempre disponible */}
                                <button
                                    onClick={() => { setPendingAction(null); setShowPreview(true); }}
                                    disabled={items.length === 0}
                                    className="w-full bg-muted/60 border border-border/60 text-foreground font-black py-3.5 rounded-2xl flex items-center justify-center gap-2.5 hover:bg-accent/40 transition-all text-[10px] uppercase tracking-widest disabled:opacity-40"
                                >
                                    <Eye className="w-4 h-4 text-primary" />
                                    Previsualizar Cotización
                                </button>

                                {/* Flujo vendedor: "Solicitar aprobación" en Draft o ChangesRequested */}
                                {(needsRequest || hasChanges) && (
                                    <button onClick={requestApproval} disabled={items.length === 0 || !selectedClientId}
                                        className="w-full bg-primary text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 text-[10px] uppercase tracking-widest disabled:opacity-60">
                                        <Send className="w-4 h-4" />
                                        {hasChanges ? 'Re-enviar a aprobación' : 'Solicitar aprobación'}
                                    </button>
                                )}

                                {/* Flujo vendedor: Pending → botón inhabilitado */}
                                {!isAdmin && isPending && (
                                    <div className="w-full bg-sky-50 border-2 border-sky-200 text-sky-900 font-black py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest">
                                        <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/></svg>
                                        Esperando aprobación del SuperAdmin
                                    </div>
                                )}

                                {/* Admin siempre ve las acciones directas. Vendedor solo cuando está Approved/Sent */}
                                {isUnlocked && (
                                    <>
                                        <button onClick={handleSaveAndGenerate} disabled={isSaving}
                                            className="w-full bg-primary text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 text-[10px] uppercase tracking-widest disabled:opacity-60">
                                            {isSaving
                                                ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>}
                                            {isSaving ? (isEditMode ? 'Guardando...' : 'Generando...') : (isEditMode ? 'Guardar Cambios' : 'Guardar y Generar PDF')}
                                        </button>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={handleSendWhatsApp}
                                                className="bg-[#25D366] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#1fba58] transition-all shadow-lg shadow-green-500/20 text-[10px] uppercase tracking-widest">
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                WhatsApp
                                            </button>
                                            <button onClick={handleSendEmail} disabled={isSendingEmail}
                                                className="bg-white border border-border/70 text-foreground font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-accent/40 transition-all text-[10px] uppercase tracking-widest disabled:opacity-60">
                                                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                {isSendingEmail ? 'Enviando...' : 'Email'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>

        {/* ── PREVIEW MODAL ── */}
        {showPreview && (() => {
            const client = clients.find(c => c.id === selectedClientId);
            const qNum = isEditMode && editQuoteId ? (quotes.find(q => q.id === editQuoteId)?.number || previewNumber) : previewNumber;
            const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
                <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-[#1a1a1d] shrink-0">
                            <div className="flex items-center gap-3">
                                <Eye className="w-5 h-5 text-[#fab510]" />
                                <span className="text-white font-black text-sm uppercase tracking-widest">Vista Previa de la Propuesta</span>
                            </div>
                            <button onClick={() => { setShowPreview(false); setPendingAction(null); }} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Quote Preview Content */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-5 text-sm text-gray-800 bg-[#faf9f6]">
                            {/* Letterhead */}
                            <div className="flex justify-between items-start border-b-2 border-[#fab510] pb-4">
                                <div>
                                    <img
                                        src="/api/logo"
                                        alt="Arte Concreto"
                                        className="h-10 object-contain mb-1"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                    <p className="text-xs text-gray-500">Km 1+800, Anillo Vial · Floridablanca, Santander</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest">Cotización No.</p>
                                    <p className="font-black text-[#fab510] text-lg">{qNum}</p>
                                </div>
                            </div>

                            {/* Date + Addressee */}
                            <div>
                                <p className="text-xs text-gray-600">Floridablanca, {today}</p>
                                <div className="mt-3">
                                    <p className="text-xs text-gray-500">Señores.</p>
                                    <p className="font-black text-sm text-[#1a1a1d] mt-1">{client?.name?.toUpperCase() || 'CLIENTE'}</p>
                                    {client?.company && <p className="font-bold text-xs text-gray-700">{client.company.toUpperCase()}</p>}
                                </div>
                            </div>

                            {/* Referencia */}
                            <div className="bg-[#fab510]/10 border border-[#fab510]/30 rounded-xl px-4 py-3">
                                <span className="font-black text-xs text-[#1a1a1d] uppercase tracking-wide">REFERENCIA: </span>
                                <span className="font-bold text-xs text-gray-700 uppercase">{referencia || '(sin referencia)'}</span>
                            </div>

                            {/* Sections */}
                            <div className="space-y-4">
                                <div>
                                    <p className="font-black text-xs text-[#1a1a1d] uppercase mb-1">1. Alcance de la Propuesta:</p>
                                    {(() => {
                                        // Texto del alcance — se reproduce del PDF para que el preview no engañe.
                                        const lugar = (deliveryLocation.trim() || client?.city || '').toUpperCase();
                                        if (quoteMode === 'aiu') {
                                            return (
                                                <p className="text-xs text-gray-600 leading-relaxed">
                                                    La presente oferta se entrega en {lugar ? <><strong>{lugar}</strong>. </> : 'el sitio acordado con el cliente. '}
                                                    <span className="font-bold">Incluye</span> transporte, descargue e instalación (cubiertos por el porcentaje de Administración).
                                                </p>
                                            );
                                        }
                                        // Modo simple
                                        return (
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                La presente oferta se entrega en {lugar ? <><strong>{lugar}</strong>. </> : 'la planta de producción, Anillo Vial Km 1+800 Floridablanca – Girón. '}
                                                {includesTransport
                                                    ? <><span className="font-bold">Incluye transporte</span> hasta {(transportCity.trim() || client?.city || 'destino').toUpperCase()}. <span className="font-bold">No incluye</span> descargue ni instalación.</>
                                                    : <><span className="font-bold">No incluye</span> transporte, descargue ni instalación.</>}
                                            </p>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <p className="font-black text-xs text-[#1a1a1d] uppercase mb-1">2. Vigencia de la Oferta:</p>
                                    <p className="text-xs text-gray-600">La cotización tiene vigencia hasta el <strong>{displayValidUntil}</strong>.</p>
                                </div>
                                <div>
                                    <p className="font-black text-xs text-[#1a1a1d] uppercase mb-1">3. Plazo de Entrega:</p>
                                    <p className="text-xs text-gray-600">{deliveryTime}</p>
                                </div>
                                <div>
                                    <p className="font-black text-xs text-[#1a1a1d] uppercase mb-1">4. Forma de Pago:</p>
                                    <p className="text-xs text-gray-600 whitespace-pre-line">{paymentTerms}</p>
                                </div>
                            </div>

                            {/* Items Table — el header y el desglose dependen del modo */}
                            <div>
                                <p className="font-black text-xs text-[#1a1a1d] uppercase mb-2">5. Cantidades y Precios del Proyecto:</p>
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#1a1a1d] text-white">
                                            <th className="text-left px-3 py-2 font-black uppercase tracking-wide">Descripción</th>
                                            <th className="text-left px-2 py-2 font-black uppercase tracking-wide">Dimensiones</th>
                                            <th className="text-center px-2 py-2 font-black uppercase tracking-wide">Un.</th>
                                            <th className="text-center px-2 py-2 font-black uppercase tracking-wide">Cant.</th>
                                            <th className="text-right px-3 py-2 font-black uppercase tracking-wide">V. Unit. antes IVA</th>
                                            <th className="text-right px-3 py-2 font-black uppercase tracking-wide">V. Total antes IVA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => {
                                            const c = calc.items[idx];
                                            const unitBefore = c?.unitPriceBeforeTax ?? 0;
                                            const lineBefore = c?.lineTotalBeforeTax ?? 0;
                                            return (
                                                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#faf7f0]'}>
                                                    <td className="px-3 py-2 font-semibold">{item.name}</td>
                                                    <td className="px-2 py-2 text-gray-500 text-[10px]">{item.dimensions || '—'}</td>
                                                    <td className="px-2 py-2 text-center text-gray-500">{item.unit}</td>
                                                    <td className="px-2 py-2 text-center font-bold text-[#fab510]">{item.quantity}</td>
                                                    <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(unitBefore)}</td>
                                                    <td className="px-3 py-2 text-right font-bold">{formatCurrency(lineBefore)}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* Fila de transporte (solo modo simple cuando el vendedor lo activó) */}
                                        {quoteMode === 'simple' && includesTransport && calc.transportBeforeTax !== undefined && (
                                            <tr className="bg-amber-50/40">
                                                <td className="px-3 py-2 font-semibold">{transportItemDescription(transportCity || client?.city || '')}</td>
                                                <td className="px-2 py-2 text-gray-500 text-[10px]">—</td>
                                                <td className="px-2 py-2 text-center text-gray-500">gl</td>
                                                <td className="px-2 py-2 text-center font-bold text-[#fab510]">1</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(calc.transportBeforeTax)}</td>
                                                <td className="px-3 py-2 text-right font-bold">{formatCurrency(calc.transportBeforeTax)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                <div className="flex justify-end mt-2 gap-4 text-xs pr-3">
                                    <div className="text-right space-y-1">
                                        {quoteMode === 'simple' ? (
                                            <>
                                                <div className="text-gray-500">Valor total antes de IVA: <strong className="text-gray-800">{formatCurrency(calc.subtotalLine1)}</strong></div>
                                                <div className="text-gray-500">IVA: <strong className="text-gray-800">{formatCurrency(calc.taxAmount)}</strong></div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-gray-500">Subtotal: <strong className="text-gray-800">{formatCurrency(calc.productsSubtotal)}</strong></div>
                                                {calc.adminAmount !== undefined && (
                                                    <div className="text-gray-500">Administración ({adminPercent}%): <strong className="text-gray-800">{formatCurrency(calc.adminAmount)}</strong></div>
                                                )}
                                                {calc.utilityAmount !== undefined && (
                                                    <div className="text-gray-500">Utilidad ({utilityPercent}%): <strong className="text-gray-800">{formatCurrency(calc.utilityAmount)}</strong></div>
                                                )}
                                                {calc.subtotalAfterAiu !== undefined && (
                                                    <div className="text-gray-500">Subtotal acumulado: <strong className="text-gray-800">{formatCurrency(calc.subtotalAfterAiu)}</strong></div>
                                                )}
                                                <div className="text-gray-500">IVA (19% sólo sobre utilidad): <strong className="text-gray-800">{formatCurrency(calc.taxAmount)}</strong></div>
                                            </>
                                        )}
                                        <div className="bg-[#fab510] text-black font-black px-4 py-2 rounded-lg text-sm mt-1">TOTAL: {formatCurrency(calc.total)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Closing */}
                            <div className="border-t border-gray-200 pt-4 space-y-1">
                                <p className="text-xs text-gray-600">Esperamos que esta oferta sea de su agrado.</p>
                                <p className="text-xs text-gray-600">Quedamos atentos a sus comentarios o inquietudes.</p>
                                <p className="text-xs text-gray-600 mt-2">Cordialmente,</p>
                                <p className="font-black text-xs text-[#1a1a1d] mt-3">{(currentUser?.name || 'Asesor Comercial').toUpperCase()}</p>
                                <p className="text-xs text-gray-600">Asesor Comercial.</p>
                                {currentUser?.phone && <p className="text-xs text-gray-600">{currentUser.phone}</p>}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
                            <button
                                onClick={() => { setShowPreview(false); setPendingAction(null); }}
                                className="flex-1 py-3 rounded-2xl border border-border text-sm font-black text-muted-foreground hover:bg-accent/30 transition-all uppercase tracking-widest"
                            >
                                ← {pendingAction ? 'Editar' : 'Cerrar'}
                            </button>
                            {pendingAction && (
                                <button
                                    onClick={() => {
                                        if (pendingAction === 'pdf') executeGeneratePDF();
                                        else if (pendingAction === 'email') executeEmail();
                                        else if (pendingAction === 'whatsapp') executeWhatsApp();
                                    }}
                                    disabled={isSaving || isSendingEmail}
                                    className="flex-1 py-3 rounded-2xl bg-primary text-black font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 uppercase tracking-widest disabled:opacity-60"
                                >
                                    {isSaving || isSendingEmail
                                        ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                        : <Send className="w-4 h-4" />
                                    }
                                    {pendingAction === 'pdf' ? 'Confirmar y Descargar PDF'
                                        : pendingAction === 'email' ? 'Confirmar y Enviar Email'
                                        : 'Confirmar y Enviar WhatsApp'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        })()}

        {/* ── POST-PDF REMINDER MODAL ───────────────────────────────────────── */}
        {postGenReminder && (() => {
            const client = clients.find(c => c.id === selectedClientId);
            const hasEmail = !!client?.email;
            const hasPhone = !!client?.phone;
            return (
                <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header con acento amarillo */}
                        <div className="bg-gradient-to-br from-amber-400 to-primary px-6 pt-6 pb-5 relative">
                            <button
                                onClick={() => setPostGenReminder(null)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-black/70 hover:text-black flex items-center justify-center transition-colors"
                                title="Cerrar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="w-12 h-12 rounded-2xl bg-white/30 border border-black/10 flex items-center justify-center mb-3">
                                <CheckCircle className="w-6 h-6 text-black" />
                            </div>
                            <h3 className="text-lg font-black text-black tracking-tight">Cotización creada y descargada</h3>
                            <p className="text-xs font-black text-black/70 mt-1 tracking-widest uppercase">{postGenReminder.quoteNumber}</p>
                        </div>

                        {/* Cuerpo: recordatorio */}
                        <div className="px-6 pt-5 pb-4 space-y-4">
                            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
                                <p className="text-sm font-black text-amber-900">
                                    ⚠️ La cotización aún NO se ha enviado al cliente.
                                </p>
                                <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                                    El PDF se descargó en tu equipo. Revísalo antes de enviárselo a <strong>{client?.name || 'el cliente'}</strong>.
                                </p>
                            </div>

                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
                                ¿Qué quieres hacer?
                            </p>

                            {/* Acciones */}
                            <div className="space-y-2.5">
                                {/* WhatsApp */}
                                <button
                                    onClick={reminderSendWhatsApp}
                                    disabled={!hasPhone || reminderBusy !== null}
                                    className={clsx(
                                        "w-full font-black py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-widest",
                                        hasPhone
                                            ? "bg-[#25D366] text-white hover:bg-[#1fba58] shadow-lg shadow-green-500/20"
                                            : "bg-muted text-muted-foreground cursor-not-allowed",
                                        reminderBusy === 'wa' && "opacity-60"
                                    )}
                                    title={!hasPhone ? 'El cliente no tiene teléfono registrado' : 'Enviar por WhatsApp'}
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                    {reminderBusy === 'wa' ? 'Abriendo...' : (hasPhone ? `Enviar por WhatsApp${client?.phone ? ` · ${client.phone}` : ''}` : 'Sin teléfono')}
                                </button>

                                {/* Email */}
                                <button
                                    onClick={reminderSendEmail}
                                    disabled={!hasEmail || reminderBusy !== null}
                                    className={clsx(
                                        "w-full font-black py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-widest border",
                                        hasEmail
                                            ? "bg-white border-border text-foreground hover:bg-muted"
                                            : "bg-muted border-border text-muted-foreground cursor-not-allowed",
                                        reminderBusy === 'email' && "opacity-60"
                                    )}
                                    title={!hasEmail ? 'El cliente no tiene email registrado' : 'Enviar por email'}
                                >
                                    <Send className="w-4 h-4 text-primary" />
                                    {reminderBusy === 'email' ? 'Enviando...' : (hasEmail ? `Enviar por Email${client?.email ? ` · ${client.email}` : ''}` : 'Sin email')}
                                </button>

                                {/* Descargar otra vez */}
                                <button
                                    onClick={reminderRedownloadPDF}
                                    disabled={reminderBusy !== null}
                                    className={clsx(
                                        "w-full bg-muted/60 border border-border text-foreground font-black py-3 rounded-2xl flex items-center justify-center gap-2.5 hover:bg-muted transition-all text-xs uppercase tracking-widest",
                                        reminderBusy === 'download' && "opacity-60"
                                    )}
                                >
                                    <FileText className="w-4 h-4 text-primary" />
                                    {reminderBusy === 'download' ? 'Generando...' : 'Descargar PDF de nuevo'}
                                </button>
                            </div>

                            {/* Cerrar más adelante */}
                            <button
                                onClick={() => setPostGenReminder(null)}
                                className="w-full text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors pt-1"
                            >
                                La enviaré más tarde, cerrar
                            </button>
                        </div>
                    </div>
                </div>
            );
        })()}

        {sentConfirm && (
          <div className="fixed inset-0 z-[300] flex items-end justify-center p-6 pointer-events-none">
            {sentConfirm.pending ? (
              <div className="pointer-events-auto bg-card border border-amber-400/40 rounded-[2rem] shadow-2xl shadow-amber-500/10 p-6 max-w-sm w-full animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-foreground text-sm">Solicitud enviada al administrador</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <strong>{sentConfirm.quoteNumber}</strong> — en espera de aprobación
                    </p>
                    <p className="text-[10px] text-amber-600 mt-1.5 font-bold">
                      ⏳ {sentConfirm.pendingAction === 'send_email' ? 'El admin aprobará el envío por email' : sentConfirm.pendingAction === 'send_whatsapp' ? 'El admin aprobará el envío por WhatsApp' : 'El admin aprobará la generación del PDF'}
                    </p>
                  </div>
                  <button onClick={() => setSentConfirm(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="pointer-events-auto bg-card border border-emerald-500/30 rounded-[2rem] shadow-2xl shadow-emerald-500/10 p-6 max-w-sm w-full animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-foreground text-sm">¡Cotización enviada!</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <strong>{sentConfirm.quoteNumber}</strong> enviada a <strong>{sentConfirm.email}</strong>
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-1.5 font-bold">📧 Recibirás notificación cuando el cliente la abra</p>
                  </div>
                  <button onClick={() => setSentConfirm(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </>
    );
}
