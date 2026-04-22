"use client";

import React from 'react';
import {
    Sparkles, Compass, UserCircle, LayoutDashboard, Users, UserSearch, Columns, FileText,
    Send, Package, CalendarDays, Bot, Bell, Brain, CreditCard, CheckCircle2, TrendingUp,
    UserPlus, FormInput, Upload, ShieldAlert, Settings as SettingsIcon, Zap, Rocket,
    Search, Smartphone, MessageCircle, Workflow, Target,
} from 'lucide-react';
import type { Seller } from '@/context/AppContext';

type Role = Seller['role'];

export interface WizardStep {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: 'primary' | 'indigo' | 'emerald' | 'rose' | 'violet' | 'amber' | 'sky';
    title: string;
    subtitle: string;
    body: React.ReactNode;
    /** Optional deep-link the user can try from inside the wizard. */
    tryIt?: { href: string; label: string };
    /** Roles this step applies to. Omit = all roles. */
    roles?: Role[];
}

// -- Reusable micro-components for step bodies ----------------------------

function Bullet({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            <span>{children}</span>
        </li>
    );
}

function Callout({ children, kind = 'info' }: { children: React.ReactNode; kind?: 'info' | 'warn' | 'tip' }) {
    const map = {
        info: 'bg-sky-50 border-sky-200 text-sky-900',
        warn: 'bg-amber-50 border-amber-200 text-amber-900',
        tip:  'bg-emerald-50 border-emerald-200 text-emerald-900',
    } as const;
    return (
        <div className={`mt-3 border rounded-xl px-3 py-2 text-xs font-medium ${map[kind]}`}>
            {children}
        </div>
    );
}

function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="inline-block bg-muted border border-border rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-foreground">
            {children}
        </kbd>
    );
}

// -- Steps ----------------------------------------------------------------

export function buildSteps(user: Seller): WizardStep[] {
    const firstName = (user.name || 'vendedor').split(' ')[0];
    const isAdminLike = user.role === 'Admin' || user.role === 'SuperAdmin';
    const isSuperAdmin = user.role === 'SuperAdmin';
    const isManager = user.role === 'Manager';

    const core: WizardStep[] = [
        // 1. Welcome
        {
            id: 'welcome',
            icon: Sparkles,
            accent: 'primary',
            title: `Bienvenido, ${firstName} 👋`,
            subtitle: 'Este es tu CRM — te lo mostramos en 10 minutos',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Este tour cubre <strong>todo</strong> lo que puedes hacer en la plataforma según tu rol: <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">{user.role}</span>.
                        Está pensado para que salgas listo para vender — no para abrumarte.
                    </p>
                    <ul className="space-y-1.5 mt-4">
                        <Bullet><strong>Navega con el teclado:</strong> <Kbd>→</Kbd> siguiente, <Kbd>←</Kbd> anterior</Bullet>
                        <Bullet><strong>Puedes volver</strong> en cualquier momento desde tu avatar → “Ver tour”</Bullet>
                        <Bullet>La primera vez es obligatorio — tómate los 10 minutos, te van a ahorrar horas</Bullet>
                    </ul>
                </div>
            ),
        },

        // 2. Navigation
        {
            id: 'navigation',
            icon: Compass,
            accent: 'indigo',
            title: 'Cómo moverte por el sistema',
            subtitle: 'Sidebar izquierdo, búsqueda arriba, atajos móviles',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">El menú lateral agrupa todo en 4 secciones:</p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="bg-muted rounded-lg p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-primary">Comercial</p>
                            <p className="text-xs text-muted-foreground mt-1">Dashboard, ConcreBOT, Cotizaciones, Pipeline, Clientes</p>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-primary">Operaciones</p>
                            <p className="text-xs text-muted-foreground mt-1">Inventario, Agenda, Analíticas, Equipo</p>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-primary">Herramientas</p>
                            <p className="text-xs text-muted-foreground mt-1">Formbuilder, Documentos, Tarjetas digitales</p>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-primary">Sistema</p>
                            <p className="text-xs text-muted-foreground mt-1">Importar, Auditoría, Configuración</p>
                        </div>
                    </div>
                    <Callout kind="tip">
                        <Smartphone className="inline w-3 h-3 mr-1" />
                        Desde el celular usas la versión en <code className="bg-white/50 px-1 rounded">/m</code> — más rápida, pensada para trabajo de campo.
                    </Callout>
                </div>
            ),
        },

        // 3. Profile & Photo — the mandatory-feel step
        {
            id: 'profile',
            icon: UserCircle,
            accent: 'rose',
            title: 'Tu perfil y foto corporativa',
            subtitle: 'Antes de empezar — sube tu foto. Los clientes te reconocerán en cotizaciones y tarjeta digital.',
            body: (
                <div className="space-y-3">
                    <div className="flex items-center gap-4 bg-muted rounded-xl p-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-black border-2 border-primary/20">
                            {firstName.charAt(0)}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            <p className="text-[10px] uppercase font-black text-primary mt-0.5">Rol: {user.role}</p>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Tu foto aparece en:
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet>Cada cotización que envíes al cliente</Bullet>
                        <Bullet>Tu tarjeta digital de presentación (biolink)</Bullet>
                        <Bullet>El asignador de leads — el cliente ve quién lo atiende</Bullet>
                    </ul>
                    <Callout kind="warn">
                        <strong>Úsala profesional:</strong> fondo neutro, rostro visible, sonrisa. Evita selfies casuales.
                    </Callout>
                </div>
            ),
            tryIt: { href: '/settings?tab=profile', label: 'Subir mi foto ahora' },
        },

        // 4. Dashboard
        {
            id: 'dashboard',
            icon: LayoutDashboard,
            accent: 'sky',
            title: 'Tu dashboard — el centro de mando',
            subtitle: 'Lo primero que ves al entrar. Tus números en vivo.',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        En el <strong>/Dashboard</strong> encuentras:
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet>Valor total del pipeline activo (en pesos)</Bullet>
                        <Bullet>Cotizaciones pendientes de aprobación</Bullet>
                        <Bullet>Leads nuevos asignados a ti en las últimas 24h</Bullet>
                        <Bullet>Ventas cerradas este mes</Bullet>
                        <Bullet>Accesos directos a las acciones más comunes</Bullet>
                    </ul>
                    <Callout kind="tip">
                        Revísalo cada mañana antes de empezar tu día — te dice dónde enfocarte.
                    </Callout>
                </div>
            ),
            tryIt: { href: '/', label: 'Ver dashboard' },
        },

        // 5. Clients
        {
            id: 'clients',
            icon: Users,
            accent: 'emerald',
            title: 'Clientes y Leads',
            subtitle: 'Tu base de datos — cada persona que alguna vez tocó el negocio',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Hay dos tipos: <strong>Lead</strong> (aún no compra) y <strong>Cliente</strong> (ya compró).
                        El sistema los diferencia automáticamente.
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet>Cuando llega un lead nuevo de la web, WhatsApp o ConcreBOT, se <strong>asigna automáticamente al siguiente vendedor</strong> en rotación (round-robin)</Bullet>
                        <Bullet>Solo ves los clientes que te pertenecen — excepto Admin/Manager que ven todo</Bullet>
                        <Bullet>Cada cliente guarda historial completo: llamadas, correos, WhatsApp, notas, cotizaciones, adjuntos</Bullet>
                        <Bullet>Puedes adjuntar archivos (PDFs de contratos, fotos de obra, etc.)</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/clients', label: 'Ir a mis clientes' },
        },

        // 6. Lead detail page
        {
            id: 'lead-detail',
            icon: UserSearch,
            accent: 'indigo',
            title: 'La ficha del cliente',
            subtitle: 'Todo lo que sabes de una persona, en una sola pantalla',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Al hacer clic en un cliente verás 5 pestañas:
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet><strong>Actividad</strong> — cronología completa de cada interacción</Bullet>
                        <Bullet><strong>Razonamiento IA</strong> — MiWibi analiza el lead y te sugiere siguientes pasos + score de probabilidad de cierre</Bullet>
                        <Bullet><strong>Cotizaciones</strong> — todas las que has creado para este cliente</Bullet>
                        <Bullet><strong>ConcreBOT</strong> — conversaciones del bot con este cliente</Bullet>
                        <Bullet><strong>Archivos</strong> — documentos adjuntos</Bullet>
                    </ul>
                    <Callout kind="tip">
                        Registra cada contacto (llamada, visita, WhatsApp). Eso es lo que alimenta a MiWibi para darte buenos consejos.
                    </Callout>
                </div>
            ),
        },

        // 7. Pipeline
        {
            id: 'pipeline',
            icon: Columns,
            accent: 'violet',
            title: 'Pipeline — el tablero Kanban',
            subtitle: 'Arrastra deals entre etapas para moverlos en el proceso de venta',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Las etapas estándar:</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {['Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Ganado', 'Perdido'].map((s, i) => (
                            <div key={s} className={`shrink-0 px-3 py-2 rounded-lg border text-[11px] font-bold ${i === 4 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' : i === 5 ? 'bg-rose-500/10 border-rose-500/30 text-rose-700' : 'bg-muted border-border text-foreground'}`}>
                                {s}
                            </div>
                        ))}
                    </div>
                    <ul className="space-y-1.5 mt-2">
                        <Bullet><strong>Arrastra y suelta</strong> una tarjeta para cambiar su etapa</Bullet>
                        <Bullet>Cuando llegas a <strong>Cotizado</strong>, crea la cotización inline desde la misma tarjeta</Bullet>
                        <Bullet>Al mover a <strong>Ganado</strong>, el sistema te pide registrar la venta y genera la orden de producción</Bullet>
                        <Bullet>Manager/Admin pueden reasignar deals entre vendedores</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/pipeline', label: 'Abrir el pipeline' },
        },

        // 8. Quotes intro
        {
            id: 'quotes',
            icon: FileText,
            accent: 'amber',
            title: 'Cotizaciones — el corazón del CRM',
            subtitle: 'Crear, versionar, enviar y convertir en orden de producción',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">El ciclo de una cotización:</p>
                    <div className="flex items-center gap-1 text-[11px] font-bold flex-wrap">
                        <span className="px-2 py-1 rounded bg-muted border border-border">Draft</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="px-2 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-700">PENDING_APPROVAL</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="px-2 py-1 rounded bg-violet-500/10 border border-violet-500/30 text-violet-700">Sent</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-700">Approved</span>
                    </div>
                    <ul className="space-y-1.5 mt-2">
                        <Bullet>Numeración automática tipo <code className="bg-muted px-1 rounded text-[11px]">ART-250-2026</code></Bullet>
                        <Bullet>Versiones: V1, V2, V3 — se genera automáticamente al editar una cotización enviada</Bullet>
                        <Bullet>Versión AIU — variante final que incluye transporte, descarga e instalación</Bullet>
                        <Bullet>El PDF se genera solo, con logo Arte Concreto, tus datos y fotos de los productos</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/quotes', label: 'Ver cotizaciones' },
        },

        // 9. Sending a quote
        {
            id: 'quote-send',
            icon: Send,
            accent: 'primary',
            title: 'Enviar una cotización al cliente',
            subtitle: '3 canales: email, WhatsApp o link copiable',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet><strong>Email:</strong> plantilla de marca con PDF adjunto, rastreo de apertura</Bullet>
                        <Bullet><strong>WhatsApp:</strong> mensaje pre-redactado con link directo al PDF</Bullet>
                        <Bullet><strong>Link copiar:</strong> URL pública con expiración</Bullet>
                    </ul>
                    <Callout kind="info">
                        Cuando el cliente <strong>abre</strong> la cotización por email, se notifica automáticamente en tu campana.
                    </Callout>
                    {isManager || isAdminLike ? (
                        <Callout kind="tip">
                            Como {user.role}, tú <strong>apruebas</strong> cotizaciones que suben sobre cierto valor antes de enviarse.
                        </Callout>
                    ) : (
                        <Callout kind="warn">
                            Si una cotización es muy grande, se envía primero al Manager/Admin para aprobación.
                        </Callout>
                    )}
                </div>
            ),
        },

        // 10. Inventory
        {
            id: 'inventory',
            icon: Package,
            accent: 'emerald',
            title: 'Catálogo e Inventario',
            subtitle: 'Los productos que vendes, sincronizados con la tienda',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet>Se sincroniza cada hora con <strong>arteconcreto.co</strong> (WooCommerce)</Bullet>
                        <Bullet>Cada producto trae foto, descripción, SKU, dimensiones, peso y precio</Bullet>
                        <Bullet>Cuando cotizas, seleccionas productos del catálogo — no tienes que escribir nada</Bullet>
                        <Bullet>El sistema calcula <strong>envío automático</strong> por peso y ciudad del cliente</Bullet>
                    </ul>
                    {(isAdminLike || isManager) && (
                        <Callout kind="tip">
                            Puedes editar stock, ocultar productos y exportar el catálogo a CSV.
                        </Callout>
                    )}
                </div>
            ),
            tryIt: { href: '/inventory', label: 'Ver inventario' },
        },

        // 11. Agenda
        {
            id: 'agenda',
            icon: CalendarDays,
            accent: 'violet',
            title: 'Agenda y recordatorios',
            subtitle: 'Visitas, entregas, llamadas — integrado con Google Calendar',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet>Crea eventos desde cualquier lugar: detalle del lead, pipeline, o el calendario</Bullet>
                        <Bullet>Conecta tu Google Calendar para que los eventos se sincronicen automáticamente</Bullet>
                        <Bullet>Invita al cliente por email — recibe confirmación y recordatorio</Bullet>
                        <Bullet>Tipos: <strong>Visita</strong>, <strong>Entrega</strong>, <strong>Llamada</strong>, <strong>Reunión</strong></Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/scheduler', label: 'Abrir agenda' },
        },

        // 12. ConcreBOT
        {
            id: 'bot',
            icon: Bot,
            accent: 'sky',
            title: 'ConcreBOT — tu colega virtual',
            subtitle: 'Atiende clientes 24/7 en WhatsApp y en la web',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        ConcreBOT responde consultas, toma datos del cliente y <strong>te pasa el lead listo</strong> cuando necesita humano.
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet>Trabaja en la tienda arteconcreto.co y en el widget embedido</Bullet>
                        <Bullet>Responde sobre productos, precios, envíos, tiempos de entrega</Bullet>
                        <Bullet>Cuando el cliente quiere cotización, el bot genera un lead y te lo asigna</Bullet>
                        <Bullet>Si detecta molestia o venta grande, <strong>escala a humano</strong> inmediatamente</Bullet>
                    </ul>
                    {isAdminLike && (
                        <Callout kind="tip">
                            En modo administrador puedes enseñarle al bot — responde preguntas suyas y aprende.
                        </Callout>
                    )}
                </div>
            ),
            tryIt: { href: '/bot', label: 'Ver conversaciones' },
        },

        // 13. Notifications & Search
        {
            id: 'notifications-search',
            icon: Bell,
            accent: 'amber',
            title: 'Notificaciones y búsqueda global',
            subtitle: 'La campana arriba a la derecha, y el buscador del header',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet><strong>Campana 🔔:</strong> cada vez que te asignan un lead, aprueban/rechazan una cotización, o el cliente abre un email</Bullet>
                        <Bullet><strong>Buscador 🔍:</strong> encuentra clientes, cotizaciones, productos por nombre, email o número</Bullet>
                        <Bullet>Atajo de teclado: <Kbd>/</Kbd> enfoca el buscador desde cualquier página</Bullet>
                    </ul>
                </div>
            ),
        },

        // 14. MiWibi Brain
        {
            id: 'miwibi',
            icon: Brain,
            accent: 'violet',
            title: 'MiWibi IA — tu cerebro analítico',
            subtitle: 'Asistente que razona sobre tus datos y te dice qué hacer',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Vive en el botón flotante <span className="inline-block w-5 h-5 rounded-full bg-primary text-black font-black text-[10px] text-center leading-5">IA</span> abajo a la derecha.
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet>Pregúntale: <em>“¿Qué leads priorizar hoy?”</em> — te los rankea</Bullet>
                        <Bullet>Pregúntale: <em>“Resumen de ventas del mes”</em> — te da el número + comparativa</Bullet>
                        <Bullet>Analiza patrones: leads que se enfriaron, oportunidades olvidadas</Bullet>
                        <Bullet>Protege tus datos — no comparte información fuera del CRM</Bullet>
                    </ul>
                </div>
            ),
        },
    ];

    // -- Vendedor extras -------------------------------------------------
    const vendedorExtras: WizardStep[] = [
        {
            id: 'biolink',
            icon: CreditCard,
            accent: 'rose',
            title: 'Tu tarjeta digital',
            subtitle: 'Un link tuyo para compartir en WhatsApp, Instagram, firma de email',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Tienes una tarjeta digital personal ya creada — reemplaza la tarjeta de papel y captura leads directamente en el CRM.
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet>Enlace corto tipo <code className="bg-muted px-1 rounded text-[11px]">arteconcreto.co/t/tu-nombre</code></Bullet>
                        <Bullet>Muestra tu foto, cargo, WhatsApp, redes y catálogo destacado</Bullet>
                        <Bullet>Cuando alguien llena el formulario, se crea un lead asignado a ti</Bullet>
                        <Bullet>Genera un QR para poner en tu firma de email o redes</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/biolinks', label: 'Personalizar mi tarjeta' },
        },
    ];

    // -- Manager extras --------------------------------------------------
    const managerExtras: WizardStep[] = [
        {
            id: 'approvals',
            icon: CheckCircle2,
            accent: 'emerald',
            title: 'Aprobar cotizaciones del equipo',
            subtitle: 'Tu filtro de calidad antes de que salga al cliente',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Los vendedores te escalan cotizaciones grandes. Las verás marcadas como <strong>PENDING_APPROVAL</strong>.
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet>Revisa ítems, precios y descuentos antes de aprobar</Bullet>
                        <Bullet>Si apruebas, la cotización se envía automáticamente al cliente por el canal que eligió el vendedor</Bullet>
                        <Bullet>Si rechazas, vuelve a Draft y el vendedor recibe notificación con tu nota</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/quotes?filter=pending', label: 'Ver pendientes' },
        },
        {
            id: 'team-performance',
            icon: TrendingUp,
            accent: 'primary',
            title: 'Rendimiento del equipo',
            subtitle: 'Dashboard con las métricas de cada vendedor',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet>Cierres del mes por vendedor</Bullet>
                        <Bullet>Tasa de aprobación de cotizaciones</Bullet>
                        <Bullet>Tiempo promedio de respuesta a leads nuevos</Bullet>
                        <Bullet>Valor del pipeline activo por persona</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/team/performance', label: 'Ver rendimiento' },
        },
    ];

    // -- Admin / SuperAdmin extras --------------------------------------
    const adminExtras: WizardStep[] = [
        {
            id: 'team-manage',
            icon: UserPlus,
            accent: 'indigo',
            title: 'Gestionar el equipo',
            subtitle: 'Crear, editar y asignar permisos a cada miembro',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet>Crea usuarios con rol Vendedor, Manager, Admin o SuperAdmin</Bullet>
                        <Bullet>Asigna <strong>permisos granulares</strong> por usuario (ver/editar/eliminar cada módulo)</Bullet>
                        <Bullet>Desactiva vendedores que salen — mantienes su historial intacto</Bullet>
                        <Bullet>Envía welcome emails con credenciales desde el botón <em>“Bienvenida al equipo”</em></Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/team', label: 'Abrir equipo' },
        },
        {
            id: 'forms',
            icon: FormInput,
            accent: 'violet',
            title: 'Formbuilder IA',
            subtitle: 'Formularios públicos para captar leads desde cualquier lado',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet>Arrastra campos (nombre, email, teléfono, ciudad, presupuesto, etc.)</Bullet>
                        <Bullet>Elige tema: nativo, moderno o vidrio</Bullet>
                        <Bullet>Publica — obtienes link público <code className="bg-muted px-1 rounded text-[11px]">/public/f/[id]</code>, iframe y QR</Bullet>
                        <Bullet>Cada envío crea un lead asignado por round-robin</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/forms', label: 'Crear formulario' },
        },
        {
            id: 'import',
            icon: Upload,
            accent: 'sky',
            title: 'Importar datos en masa',
            subtitle: 'CSVs para traer clientes, productos o cotizaciones antiguas',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet>Descarga la plantilla CSV de la entidad que quieres importar</Bullet>
                        <Bullet>Llena y súbela — el sistema valida fila por fila</Bullet>
                        <Bullet>Vista previa antes de confirmar — rechaza filas con errores</Bullet>
                        <Bullet>Útil para migraciones iniciales desde Excel</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/import', label: 'Importar datos' },
        },
        {
            id: 'audit',
            icon: ShieldAlert,
            accent: 'rose',
            title: 'Auditoría del sistema',
            subtitle: 'Registro completo de quién hizo qué y cuándo',
            body: (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        <Bullet>Cada acción importante queda registrada (crear, editar, eliminar, enviar, aprobar)</Bullet>
                        <Bullet>Filtra por usuario, tipo de acción, fecha o entidad afectada</Bullet>
                        <Bullet>Detecta <strong>anomalías</strong> automáticamente (eliminaciones masivas, accesos fuera de horario)</Bullet>
                        <Bullet>Retención: 180 días. Después se archiva.</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/audit', label: 'Abrir auditoría' },
        },
        {
            id: 'settings',
            icon: SettingsIcon,
            accent: 'primary',
            title: 'Configuración del sistema',
            subtitle: 'Integraciones, WhatsApp, numeración, envío, marca',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">En <strong>/settings</strong> controlas:</p>
                    <ul className="space-y-1.5">
                        <Bullet>Conexión con WhatsApp Business (token, teléfono)</Bullet>
                        <Bullet>Claves API: WooCommerce, Gemini (IA), Resend (email)</Bullet>
                        <Bullet>Numeración de cotizaciones (prefijo, número, año)</Bullet>
                        <Bullet>Reglas de envío por ciudad (tarifa/kg, cargo mínimo)</Bullet>
                        <Bullet>Ciudades y sectores (para categorizar clientes)</Bullet>
                        <Bullet>Emails que reciben órdenes de producción</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/settings', label: 'Abrir configuración' },
        },
    ];

    // -- SuperAdmin-only extras -----------------------------------------
    const superAdminExtras: WizardStep[] = [
        {
            id: 'autosend',
            icon: Zap,
            accent: 'amber',
            title: 'Cotizaciones automáticas',
            subtitle: 'El switch maestro — solo tú (SuperAdmin) lo ves',
            body: (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Decide si las cotizaciones generadas desde canales digitales (web, WooCommerce) se envían automáticas al cliente o quedan en Draft para revisión del vendedor.
                    </p>
                    <ul className="space-y-1.5">
                        <Bullet><strong>OFF (recomendado al inicio):</strong> toda cotización entra como Draft — el vendedor asignado la revisa y envía</Bullet>
                        <Bullet><strong>ON:</strong> sistema envía email automático y marca como Sent</Bullet>
                        <Bullet>Control granular por canal — puedes activar solo la web y dejar woo manual, por ejemplo</Bullet>
                        <Bullet>Email CC configurable para auditoría interna</Bullet>
                    </ul>
                </div>
            ),
            tryIt: { href: '/settings?tab=autosend', label: 'Abrir configuración' },
        },
    ];

    // -- Final step ------------------------------------------------------
    const finale: WizardStep = {
        id: 'done',
        icon: Rocket,
        accent: 'primary',
        title: '¡Listo! Tu primer movimiento',
        subtitle: 'Una acción te deja 100% listo para vender',
        body: (
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Terminaste el tour. Lo mejor para arrancar:
                </p>
                <ul className="space-y-2">
                    <li className="flex gap-3 items-start bg-muted rounded-xl p-3">
                        <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-foreground">1. Sube tu foto corporativa</p>
                            <p className="text-xs text-muted-foreground">Si aún no lo hiciste — es lo primero que ven tus clientes</p>
                        </div>
                    </li>
                    <li className="flex gap-3 items-start bg-muted rounded-xl p-3">
                        <Workflow className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-foreground">2. Abre el pipeline y ubica tus leads actuales</p>
                            <p className="text-xs text-muted-foreground">Familiarízate con dónde está cada oportunidad</p>
                        </div>
                    </li>
                    <li className="flex gap-3 items-start bg-muted rounded-xl p-3">
                        <MessageCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-foreground">3. Habla con MiWibi IA</p>
                            <p className="text-xs text-muted-foreground">Pregúntale qué hacer hoy — te sorprenderá</p>
                        </div>
                    </li>
                </ul>
                <Callout kind="tip">
                    Puedes volver a ver este tour una vez más desde tu avatar → “Ver tour”. Después, se oculta para siempre.
                </Callout>
            </div>
        ),
    };

    // Compose per role
    let steps: WizardStep[] = [...core];
    if (user.role === 'Vendedor') steps.push(...vendedorExtras);
    if (isManager) steps.push(...managerExtras);
    if (isAdminLike) steps.push(...managerExtras, ...adminExtras);
    if (isSuperAdmin) steps.push(...superAdminExtras);
    steps.push(finale);

    // Dedupe by id (admin/superadmin can pick up manager extras and admin extras)
    const seen = new Set<string>();
    steps = steps.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
    });

    return steps;
}
