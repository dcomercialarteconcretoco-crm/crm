"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Plus,
    User,
    Mail,
    Phone,
    X,
    Trash,
    Edit3,
    CheckCircle2,
    AlertCircle,
    Settings2,
    Building2,
    UserPlus,
    Tag,
    DollarSign,
    Lock,
    ShieldCheck,
    MapPin,
    Briefcase,
    Upload,
    ChevronRight,
    GripVertical,
    FileText,
    MessageCircle,
    Search,
    Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, Task, Activity, Seller, Client } from '@/context/AppContext';
import SearchableSelect from '@/components/SearchableSelect';

// ─── Stage System ────────────────────────────────────────────────────────────

const STAGES = [
    { id: 'lead',     label: 'Nuevo Lead',         color: 'text-gray-500',    bg: 'bg-gray-100',    border: 'border-gray-200'   },
    { id: 'sent',     label: 'Propuesta Enviada',   color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200'   },
    { id: 'opened',   label: 'Propuesta Abierta',   color: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-200' },
    { id: 'followup', label: 'Contactado 2da vez',  color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200'  },
    { id: 'won',      label: 'Propuesta Ganada',    color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200'},
    { id: 'lost',     label: 'Propuesta Perdida',   color: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200'   },
] as const;

type StageId = typeof STAGES[number]['id'];

// Map old stageIds → new stageIds
const STAGE_MIGRATION: Record<string, StageId> = {
    lead:      'lead',
    contacted: 'sent',
    qualified: 'opened',
    proposal:  'followup',
    won:       'won',
    lost:      'lost',
};

function migrateStageId(raw: string | undefined): StageId {
    if (!raw) return 'lead';
    if (STAGE_MIGRATION[raw]) return STAGE_MIGRATION[raw];
    // Already a new stageId?
    if (STAGES.some(s => s.id === raw)) return raw as StageId;
    return 'lead';
}

const STAGE_ORDER: StageId[] = ['lead', 'sent', 'opened', 'followup', 'won', 'lost'];
const STAGE_LABEL: Record<StageId, string> = Object.fromEntries(STAGES.map(s => [s.id, s.label])) as Record<StageId, string>;

// ─── Virtual task type (clients without any pipeline task) ───────────────────

interface VirtualTask {
    id: string;
    title: string;
    clientId: string;
    clientName: string;
    stageId: StageId;
    score: number;
    value: number;
    numericValue: number;
    notes: never[];
    isVirtual: true;
}

// ─── SortableTask (real tasks only — virtual tasks shown separately) ─────────

function SortableTask({ task, onClick, onNote }: { task: Task; onClick: (task: Task) => void; onNote: (task: Task) => void }) {
    const { sellers, quotes, updateTask, updateQuote, addNotification, addTask, clients } = useApp();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
    const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

    const linkedQuote = quotes.find(q => q.id === (task as any).quoteId);
    const currentStage = migrateStageId((task as any).stageId);
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const nextStage: StageId | undefined = STAGE_ORDER[currentIdx + 1] !== 'lost' ? STAGE_ORDER[currentIdx + 1] : undefined;

    const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

    const handleWA = stop(() => {
        const phone = (task as any).phone?.replace(/\D/g, '') || '';
        if (phone) window.open(`https://wa.me/57${phone}`, '_blank');
        else if (task.email) window.open(`https://wa.me/?text=Hola ${task.contactName}`, '_blank');
        updateTask(task.id, { aiScore: Math.min(100, (task.aiScore || 50) + 5) } as any);
    });

    const handleAdvance = stop(() => {
        if (!nextStage || nextStage === 'won') return;
        updateTask(task.id, { stageId: nextStage } as any);
        addNotification({ title: `Avanzó → ${STAGE_LABEL[nextStage]}`, description: task.title, type: 'success' });
    });

    const handleWon = stop(() => {
        updateTask(task.id, { stageId: 'won' } as any);
        if (linkedQuote) updateQuote(linkedQuote.id, { status: 'Approved' });
        addNotification({ title: 'Propuesta Ganada', description: `${task.title} marcado como ganado.`, type: 'success' });
    });

    const handleLost = stop(() => {
        updateTask(task.id, { stageId: 'lost' } as any);
        if (linkedQuote) updateQuote(linkedQuote.id, { status: 'Rejected' });
        addNotification({ title: 'Propuesta Perdida', description: `${task.title} cerrado como perdido.`, type: 'alert' });
    });

    const stage = STAGES.find(s => s.id === currentStage) || STAGES[0];

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
            {/* Drag handle */}
            <div {...listeners} className="h-5 bg-muted/20 border-b border-border/30 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-muted/40 transition-colors">
                <div className="flex gap-0.5">{[...Array(6)].map((_, i) => <div key={i} className="w-1 h-1 rounded-full bg-muted-foreground/25" />)}</div>
            </div>

            {/* Main info */}
            <div className="px-3 pt-2.5 pb-2 space-y-2 cursor-pointer" onClick={() => onClick(task)}>
                {/* Name + score */}
                <div className="flex items-start justify-between gap-1.5">
                    <h4 className="text-xs font-black text-foreground leading-tight truncate flex-1">{task.title || task.client}</h4>
                    <div className="flex items-center gap-1 shrink-0">
                        <div className={clsx('w-2 h-2 rounded-full shrink-0', task.aiScore > 80 ? 'bg-emerald-400' : task.aiScore > 50 ? 'bg-amber-400' : 'bg-rose-400')} />
                        <span className="text-[9px] font-black text-muted-foreground">{task.aiScore}</span>
                    </div>
                </div>
                {/* Company */}
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1 truncate">
                    <Building2 className="w-2.5 h-2.5 shrink-0" />{task.client}
                </p>
                {/* Value */}
                {task.numericValue > 0 && (
                    <p className="text-xs font-black text-foreground">{task.value}</p>
                )}
            </div>

            {/* Last action timestamp */}
            {task.activities.length > 0 && (() => {
                const last = task.activities[0];
                const typeIcon = last.type === 'call' ? '📞' : last.type === 'whatsapp' ? '💬' : last.type === 'email' ? '📧' : last.type === 'system' ? '⚙️' : '📝';
                let ts = '';
                try { ts = new Date(last.timestamp).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { ts = ''; }
                return (
                    <div className="px-3 pb-2 flex items-center gap-1.5">
                        <span className="text-[8px] leading-none">{typeIcon}</span>
                        <Clock className="w-2 h-2 text-muted-foreground/40" />
                        <span className="text-[8px] text-muted-foreground/50 font-medium">{ts}</span>
                    </div>
                );
            })()}

            {/* Action buttons */}
            <div className="border-t border-border/40 px-3 py-2 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                <button onClick={handleWA} title="WhatsApp" className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all border border-emerald-200">
                    <MessageCircle className="w-3 h-3" />
                </button>
                <button onClick={stop(() => onNote(task))} title="Nota" className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-400 text-amber-600 hover:text-black transition-all border border-amber-200">
                    <FileText className="w-3 h-3" />
                </button>
                {nextStage && nextStage !== 'won' && (
                    <button onClick={handleAdvance} title={`Avanzar → ${STAGE_LABEL[nextStage]}`} className="p-1.5 rounded-lg bg-primary/5 hover:bg-primary text-primary hover:text-black transition-all border border-primary/20">
                        <ChevronRight className="w-3 h-3" />
                    </button>
                )}
                <button onClick={handleWon} title="Ganado" className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                </button>
                <button onClick={handleLost} title="Perdido" className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white transition-all border border-rose-200">
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

// ─── VirtualLeadCard ─────────────────────────────────────────────────────────

function VirtualLeadCard({ client, onStart }: { client: Client; onStart: (client: Client) => void }) {
    return (
        <div className="bg-white/80 border border-dashed border-gray-300 rounded-xl overflow-hidden hover:border-primary/40 hover:bg-white transition-all">
            <div className="px-3 pt-2.5 pb-2 space-y-1.5">
                <h4 className="text-xs font-black text-foreground leading-tight truncate">{client.company || client.name}</h4>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1 truncate">
                    <User className="w-2.5 h-2.5 shrink-0" />{client.name}
                </p>
                {(client.ltv ?? 0) > 0 && (
                    <p className="text-xs font-black text-foreground">${(client.ltv ?? 0).toLocaleString('es-CO')}</p>
                )}
            </div>
            <div className="border-t border-border/30 px-3 py-2">
                <button
                    onClick={() => onStart(client)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-black transition-all text-[9px] font-black uppercase border border-primary/20"
                >
                    <Plus className="w-3 h-3" /> Iniciar
                </button>
            </div>
        </div>
    );
}

// ─── Droppable Column ────────────────────────────────────────────────────────

function Droppable({ id, children }: { id: string; children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className="flex-1 min-h-0 h-full bg-white/18 rounded-3xl p-3 space-y-2.5 border border-white/60 backdrop-blur-xl overflow-y-auto overflow-x-hidden custom-scrollbar"
        >
            {children}
        </div>
    );
}

// ─── Column interface ────────────────────────────────────────────────────────

interface Column {
    id: StageId;
    title: string;
    tasks: Task[];
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PipelinePage() {
    const { tasks, clients, sellers, quotes, addTask, addQuote, addNotification, addAuditLog, updateTask, updateQuote, deleteTask, addClient, settings, products } = useApp();

    const [columns, setColumns] = useState<Column[]>(
        STAGES.map(s => ({ id: s.id, title: s.label, tasks: [] }))
    );

    // Per-column search
    const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});

    useEffect(() => {
        setColumns(
            STAGES.map(s => ({
                id: s.id,
                title: s.label,
                tasks: tasks.filter((t: any) => migrateStageId(t.stageId) === s.id),
            }))
        );
    }, [tasks]);

    // Virtual leads: clients without any pipeline task
    const clientsWithoutTask = clients.filter(c =>
        !tasks.some((t: any) => t.clientId === c.id)
    );

    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [automationStep, setAutomationStep] = useState('');
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [noteTask, setNoteTask] = useState<Task | null>(null);
    const [noteText, setNoteText] = useState('');
    const [showCallModal, setShowCallModal] = useState(false);
    const [callNoteText, setCallNoteText] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentUser: Seller = sellers.find(s => s.role === 'SuperAdmin') || sellers[0];
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    const [newDeal, setNewDeal] = useState({
        title: '',
        clientId: '',
        priority: 'Medium' as 'High' | 'Medium' | 'Low',
        stageId: 'lead' as StageId,
        assignedTo: '',
        products: [] as { id: string; name: string; price: number; quantity: number }[]
    });

    const [inlineClient, setInlineClient] = useState<{
        name: string;
        company: string;
        email: string;
        city: string;
        category: string;
    }>({
        name: '',
        company: '',
        email: '',
        city: settings.cities[0]?.name || 'Bogotá',
        category: settings.sectors[0] || 'Infraestructura'
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleTaskClick = (task: Task) => {
        setSelectedTask(task);
        setIsEditModalOpen(true);
    };

    const addProductToNewDeal = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setNewDeal(prev => ({
                ...prev,
                products: [...prev.products, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
            }));
        }
    };

    const calculateNewDealTotal = () => newDeal.products.reduce((acc, p) => acc + p.price * p.quantity, 0);

    // ─── Production order email ───────────────────────────────────────────────

    const sendProductionOrder = async (task: Task, prods: { name: string; price: number; quantity: number }[]) => {
        const recipientEmails = (settings as any).productionEmails || [];
        if (recipientEmails.length === 0) {
            addNotification({ title: 'Sin destinatarios', description: 'Configura los correos de producción en Configuración > Integraciones.', type: 'alert' });
            return;
        }
        const orderNumber = `OP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const payload = {
            orderNumber,
            clientName: task.contactName || task.client,
            clientCompany: task.client,
            sellerName: task.assignedTo || 'Equipo Comercial',
            products: prods.length > 0 ? prods : [{ name: task.title, price: task.numericValue, quantity: 1 }],
            totalValue: task.numericValue,
            dealTitle: task.title,
            quoteId: task.quoteId || 'N/A',
            date: new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            recipientEmails,
            notes: `Venta registrada por ${task.assignedTo || 'el equipo comercial'} via CRM Intelligence.`
        };
        try {
            const res = await fetch('/api/production-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (res.ok) {
                addNotification({ title: `Orden ${orderNumber} Enviada`, description: `Producción notificada a: ${recipientEmails.join(', ')}`, type: 'success' });
                addAuditLog({ userId: currentUser.id, userName: currentUser.name, userRole: isSuperAdmin ? 'SuperAdmin' : 'Vendedor', action: 'SALE_REGISTERED', targetName: task.client, details: `Orden de Producción ${orderNumber} enviada. ($${task.numericValue.toLocaleString()})`, verified: true });
            } else throw new Error(data.error);
        } catch {
            addNotification({ title: 'Error en Orden de Producción', description: 'La venta se registró pero no se pudo enviar el correo.', type: 'alert' });
        }
    };

    const saveNote = () => {
        if (!noteTask || !noteText.trim()) return;
        const newActivity: Activity = { id: `act-${Date.now()}`, type: 'note', content: noteText.trim(), timestamp: new Date() };
        updateTask(noteTask.id, { activities: [...noteTask.activities, newActivity], aiScore: Math.min(100, (noteTask.aiScore || 50) + 8) } as any);
        addNotification({ title: 'Nota guardada', description: 'Actividad registrada en el pipeline.', type: 'success' });
        setNoteTask(null);
        setNoteText('');
    };

    // ─── Start virtual lead ───────────────────────────────────────────────────

    const handleStartVirtualLead = (client: Client) => {
        const taskId = addTask({
            title: client.company || client.name,
            client: client.company || client.name,
            clientId: client.id,
            contactName: client.name,
            value: client.ltv ? `$${client.ltv.toLocaleString('es-CO')}` : '$0',
            numericValue: client.ltv || 0,
            priority: 'Medium',
            tags: ['Lead'],
            aiScore: client.score || 50,
            source: 'CRM',
            assignedTo: currentUser?.name || '',
            activities: [{ id: `act-${Date.now()}`, type: 'system', content: 'Lead iniciado desde pipeline.', timestamp: new Date() }],
            stageId: 'lead',
        });
        addNotification({ title: 'Lead iniciado', description: `${client.company || client.name} agregado al pipeline.`, type: 'success' });
    };

    const handleCreateDeal = async () => {
        setIsProcessing(true);
        let finalClientId = newDeal.clientId;

        if (showNewClientForm) {
            setAutomationStep('Registrando Nuevo Socio Industrial...');
            const newId = addClient({
                name: inlineClient.name,
                company: inlineClient.company,
                email: inlineClient.email,
                phone: '',
                status: 'Lead',
                value: '$0',
                ltv: 0,
                lastContact: 'Hace un momento',
                city: inlineClient.city,
                score: 80,
                category: inlineClient.category,
                registrationDate: new Date().toISOString().split('T')[0]
            });
            finalClientId = newId;
            addAuditLog({ userId: currentUser.id, userName: currentUser.name, userRole: isSuperAdmin ? 'SuperAdmin' : 'Vendedor', action: 'LEAD_CREATED', targetId: newId, targetName: inlineClient.company, details: `Registro manual de nuevo lead: ${inlineClient.name} (${inlineClient.company})`, verified: true });
            await new Promise(r => setTimeout(r, 800));
        }

        setAutomationStep('Generando Cotización PDF...');
        await new Promise(r => setTimeout(r, 1200));
        setAutomationStep('Configurando Tracking de Apertura...');
        await new Promise(r => setTimeout(r, 1000));
        setAutomationStep('Enviando Propuesta a Cliente...');
        await new Promise(r => setTimeout(r, 1000));

        if (newDeal.products.length > 0) {
            setAutomationStep('Descontando inventario en WooCommerce...');
            try {
                await Promise.all(newDeal.products.map(async (p) => {
                    const pData = p as any;
                    if (pData.wooId) {
                        try {
                            const qty = parseInt(p.quantity as any) || 1;
                            const res = await fetch(`/api/woocommerce?id=${pData.wooId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ manage_stock: true, stock_quantity: (pData.stock || 0) - qty })
                            });
                            if (!res.ok) console.warn(`No se pudo actualizar stock de ${p.name} en Woo`);
                        } catch { console.warn(`Falló sync de stock para ${p.name}`); }
                    }
                }));
            } catch (error) { console.error("WooCommerce Sync Error", error); }
        }

        const clientCompany = showNewClientForm ? inlineClient.company : clients.find(c => c.id === finalClientId)?.company || 'Cliente';
        const clientName = showNewClientForm ? inlineClient.name : clients.find(c => c.id === finalClientId)?.name || 'Contacto';
        const total = calculateNewDealTotal();
        const quoteId = `QT-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
        const actualSeller = isSuperAdmin ? (sellers.find(s => s.id === newDeal.assignedTo) || currentUser) : currentUser;

        const newTaskData: Omit<Task, 'id'> = {
            title: newDeal.title || 'Nuevo Negocio',
            client: clientCompany,
            clientId: finalClientId,
            contactName: clientName,
            value: `$${total.toLocaleString()}`,
            numericValue: total,
            priority: newDeal.priority,
            tags: ['Nuevo', 'Cotizado'],
            aiScore: 0,
            source: 'Web',
            assignedTo: actualSeller.name,
            quoteId,
            activities: [{ id: `sys-${Date.now()}`, type: 'system', content: `Negocio creado. Cotización ${quoteId} generada y enviada satisfactoriamente por ${actualSeller.name}.`, timestamp: new Date() }],
            stageId: newDeal.stageId
        };

        const actualTaskId = addTask(newTaskData);

        addQuote({ number: quoteId, client: clientCompany, clientId: finalClientId, date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }), total: `$${total.toLocaleString()}`, numericTotal: total, status: 'Sent', taskId: actualTaskId });
        addNotification({ title: 'Negocio Operativo', description: `Se ha vinculado a ${clientCompany} con el vendedor ${actualSeller.name}.`, type: 'success' });
        addAuditLog({ userId: actualSeller.id, userName: actualSeller.name, userRole: sellers.find(s => s.id === actualSeller.id)?.role || 'Vendedor', action: 'QUOTE_SENT', targetId: actualTaskId, targetName: clientCompany, details: `Cotización ${quoteId} generada y enviada vía Motor IA`, verified: true });

        setIsProcessing(false);
        setIsNewModalOpen(false);
        setShowNewClientForm(false);
        setNewDeal({ title: '', clientId: '', priority: 'Medium', stageId: 'lead', assignedTo: '', products: [] });
        setInlineClient({ name: '', company: '', email: '', city: settings.cities[0]?.name || 'Bogotá', category: settings.sectors[0] || 'Infraestructura' });
    };

    const handleDelete = () => {
        if (selectedTask) {
            deleteTask(selectedTask.id);
            addAuditLog({ userId: currentUser.id, userName: currentUser.name, userRole: isSuperAdmin ? 'SuperAdmin' : 'Vendedor', action: 'TASK_DELETED', targetId: selectedTask.id, targetName: selectedTask.client, details: `Eliminación de negocio: "${selectedTask.title}" (${selectedTask.client})`, verified: true });
            setIsEditModalOpen(false);
            setSelectedTask(null);
        }
    };

    const logAction = (type: Activity['type'], content: string) => {
        if (!selectedTask) return;
        const newActivity: Activity = { id: Date.now().toString(), type, content, timestamp: new Date() };
        updateTask(selectedTask.id, { activities: [newActivity, ...selectedTask.activities] });
    };

    const handleSaveCall = () => {
        if (!selectedTask || !callNoteText.trim()) return;
        const newActivity: Activity = { id: Date.now().toString(), type: 'call', content: callNoteText.trim(), timestamp: new Date() };
        updateTask(selectedTask.id, { activities: [newActivity, ...selectedTask.activities] });
        addAuditLog({
            userId: currentUser?.id || 'system',
            userName: currentUser?.name || 'Sistema',
            userRole: isSuperAdmin ? 'SuperAdmin' : 'Vendedor',
            action: 'CALL_MADE',
            targetId: selectedTask.clientId || selectedTask.id,
            targetName: selectedTask.client,
            details: callNoteText.trim(),
            verified: true,
        });
        setCallNoteText('');
        setShowCallModal(false);
    };

    const onDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const task = tasks.find(t => t.id === active.id);
        if (task) setActiveTask(task);
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;
        const movedTask = tasks.find(t => t.id === activeId);
        if (!movedTask) return;

        const column = columns.find(c => c.id === overId);
        const otherTask = tasks.find(t => t.id === overId);
        const destColId = column ? column.id : (otherTask ? migrateStageId((otherTask as any).stageId) : null);

        if (destColId && migrateStageId((movedTask as any).stageId) !== destColId) {
            const fromLabel = STAGE_LABEL[migrateStageId((movedTask as any).stageId)] || (movedTask as any).stageId || 'Lead';
            const toLabel = STAGE_LABEL[destColId as StageId] || destColId;
            const stageActivity: Activity = {
                id: `sys-${Date.now()}`,
                type: 'system',
                content: `📌 Etapa cambiada: ${fromLabel} → ${toLabel}`,
                timestamp: new Date(),
            };
            updateTask(activeId, { stageId: destColId, activities: [stageActivity, ...movedTask.activities] } as any);
            addAuditLog({ userId: currentUser.id, userName: currentUser.name, userRole: isSuperAdmin ? 'SuperAdmin' : 'Vendedor', action: 'LEAD_STATUS_CHANGE', targetId: activeId, targetName: movedTask.client, details: `Cambio de etapa: ${fromLabel} → ${toLabel}`, verified: true });
            if (destColId === 'won') {
                addNotification({ title: 'Venta Cerrada', description: `${movedTask.client} — $${movedTask.numericValue.toLocaleString()} COP. Enviando Orden de Producción...`, type: 'success' });
                sendProductionOrder(movedTask, []);
            }
        }
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return;
            const lines = text.split('\n');
            let importedCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const values: string[] = [];
                let inQuotes = false;
                let currentValue = '';
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"' && line[j + 1] === '"') { currentValue += '"'; j++; }
                    else if (char === '"') { inQuotes = !inQuotes; }
                    else if (char === ',' && !inQuotes) { values.push(currentValue); currentValue = ''; }
                    else { currentValue += char; }
                }
                values.push(currentValue);
                if (values.length >= 10) {
                    const contactName = values[1] || 'Desconocido';
                    const email = values[2] || '';
                    const phone = values[3] || '';
                    const rawStage = values[4]?.toLowerCase() || '';
                    const source = values[5] || 'CRM Antiguo';
                    const numericValue = parseInt(values[6]?.replace(/[^0-9]/g, '')) || 0;
                    const valueStr = numericValue > 0 ? `$${numericValue.toLocaleString()}` : '$0';
                    const aiScore = parseInt(values[7]) || 75;
                    const title = values[8] || 'Nuevo Negocio Importado';
                    const assignedTo = values[9] || 'Sin Asignar';
                    const rawNotes = values[10] || '';
                    const creationDate = values[11] || new Date().toISOString().split('T')[0];
                    let stageId: StageId = 'lead';
                    if (rawStage.includes('contact') || rawStage.includes('llamada')) stageId = 'sent';
                    if (rawStage.includes('propos') || rawStage.includes('cotiza')) stageId = 'followup';
                    if (rawStage.includes('calif') || rawStage.includes('qualif')) stageId = 'opened';
                    const splitNotes = rawNotes.split('|').filter((n: string) => n.trim().length > 0);
                    const activities: Activity[] = splitNotes.map((note: string, idx: number) => ({ id: `act-${Date.now()}-${idx}`, type: 'note', content: note.trim(), timestamp: new Date() }));
                    if (activities.length === 0) activities.push({ id: `act-${Date.now()}-init`, type: 'system', content: 'Lead importado desde sistema heredado.', timestamp: new Date(creationDate) });
                    const clientId = addClient({ name: contactName, company: 'Empresa', email, phone, status: 'Lead', value: valueStr, ltv: 0, lastContact: new Date().toISOString(), city: 'Desconocida', score: aiScore, category: 'Importación', registrationDate: creationDate });
                    addTask({ title, client: 'Empresa', clientId, contactName, value: valueStr, numericValue, priority: numericValue > 10000000 ? 'High' : 'Medium', tags: ['Importado'], aiScore, source, assignedTo, activities, stageId });
                    importedCount++;
                }
            }
            addNotification({ title: 'Importación Exitosa', description: `Se importaron ${importedCount} leads al Pipeline.`, type: 'success' });
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="h-full min-h-0 flex flex-col space-y-6 animate-in fade-in duration-700 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2 lg:px-0">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="page-hero-title page-hero-title--accent text-2xl lg:text-3xl font-black tracking-tighter uppercase italic">Sales Pipeline</h1>
                        <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 font-black tracking-widest uppercase">Motor V4</span>
                    </div>
                    <p className="text-muted-foreground text-xs font-medium mt-1">Gestión integral de leads y sincronización operativa en tiempo real.</p>
                </div>
                <div className="flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={handleImportClick} className="flex-1 lg:flex-none border border-border/40 bg-card text-foreground font-black px-5 py-3 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] hover:bg-muted/30 active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em]">
                        <Upload className="w-4 h-4" /><span>Importar CSV</span>
                    </button>
                    <button onClick={() => setIsNewModalOpen(true)} className="flex-1 lg:flex-none bg-primary text-black font-black px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em]">
                        <Plus className="w-4 h-4" /><span>Abrir Negocio</span>
                    </button>
                </div>
            </div>

            {/* Board */}
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar scroll-smooth pb-2">
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                    <div className="flex flex-nowrap items-stretch gap-4 min-w-max h-full px-2">
                        {STAGES.map((stage) => {
                            const col = columns.find(c => c.id === stage.id);
                            const colTasks = col?.tasks || [];

                            // Virtual leads only show in 'lead' column
                            const showVirtuals = stage.id === 'lead';

                            // Filter by column search
                            const search = (columnSearch[stage.id] || '').toLowerCase();
                            const filteredTasks = search
                                ? colTasks.filter(t =>
                                    t.title?.toLowerCase().includes(search) ||
                                    t.client?.toLowerCase().includes(search) ||
                                    t.contactName?.toLowerCase().includes(search) ||
                                    t.activities?.some(a => a.content.toLowerCase().includes(search))
                                )
                                : colTasks;

                            const filteredVirtuals = showVirtuals
                                ? (search
                                    ? clientsWithoutTask.filter(c =>
                                        (c.company || '').toLowerCase().includes(search) ||
                                        c.name.toLowerCase().includes(search)
                                    )
                                    : clientsWithoutTask)
                                : [];

                            const totalCount = filteredTasks.length + filteredVirtuals.length;
                            const pipelineValue = filteredTasks.reduce((acc, t) => acc + (t.numericValue || 0), 0);

                            return (
                                <div key={stage.id} className="w-64 h-full flex flex-col shrink-0">
                                    {/* Column header */}
                                    <div className={clsx('rounded-t-2xl border border-b-0 px-3 pt-2.5 pb-0', stage.bg, stage.border)}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={clsx('text-[9px] font-black uppercase tracking-[0.18em]', stage.color)}>{stage.label}</span>
                                            <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border', stage.bg, stage.border, stage.color)}>{totalCount}</div>
                                        </div>
                                        {pipelineValue > 0 && (
                                            <p className={clsx('text-[8px] font-bold mb-1.5', stage.color)}>${pipelineValue.toLocaleString('es-CO')}</p>
                                        )}
                                        {/* Per-column search */}
                                        <div className="pb-2">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar..."
                                                    value={columnSearch[stage.id] || ''}
                                                    onChange={e => setColumnSearch(prev => ({ ...prev, [stage.id]: e.target.value }))}
                                                    className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-white border border-border/40 rounded-lg outline-none focus:border-primary/40 transition-colors"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Droppable area */}
                                    <div className="flex-1 min-h-0">
                                        <Droppable id={stage.id}>
                                            <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                <div className="flex flex-col gap-2.5 min-h-full">
                                                    {filteredTasks.map(task => (
                                                        <SortableTask key={task.id} task={task} onClick={handleTaskClick} onNote={t => { setNoteTask(t); setNoteText(''); }} />
                                                    ))}
                                                    {filteredVirtuals.map(client => (
                                                        <VirtualLeadCard key={`virtual-${client.id}`} client={client} onStart={handleStartVirtualLead} />
                                                    ))}
                                                    {totalCount === 0 && (
                                                        <div className="min-h-[200px] border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-2 opacity-50">
                                                            <AlertCircle className="w-5 h-5" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Sin actividad</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </SortableContext>
                                        </Droppable>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <DragOverlay>
                        {activeTask ? (
                            <div className="w-64 rotate-3 shadow-2xl opacity-90 cursor-grabbing pointer-events-none scale-105 z-[1000]">
                                <SortableTask task={activeTask} onClick={() => { }} onNote={() => { }} />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            {/* Call Note Modal */}
            {showCallModal && selectedTask && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Phone className="w-4 h-4 text-primary" />
                                    </div>
                                    <h3 className="text-sm font-black text-foreground">Registrar Llamada</h3>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1 ml-10">{selectedTask.title} · {selectedTask.client}</p>
                            </div>
                            <button onClick={() => setShowCallModal(false)} className="p-2 hover:bg-muted rounded-xl transition-all">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">¿Qué se habló en la llamada?</p>
                            <textarea
                                value={callNoteText}
                                onChange={e => setCallNoteText(e.target.value)}
                                placeholder="Ej: Cliente interesado en producto X, solicitó cotización. Próximo seguimiento el lunes..."
                                rows={5}
                                autoFocus
                                className="w-full bg-muted/30 border border-border rounded-2xl px-4 py-3 text-sm text-foreground resize-none outline-none focus:border-primary/60 transition-all font-medium placeholder:font-normal placeholder:text-muted-foreground/40"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setShowCallModal(false)} className="px-5 py-2.5 border border-border rounded-xl text-[10px] font-black uppercase text-muted-foreground hover:bg-muted/30 transition-all">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveCall}
                                    disabled={!callNoteText.trim()}
                                    className="flex-1 bg-primary text-black font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Guardar Registro
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Note Modal */}
            {noteTask && (
                <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-foreground">Dejar Nota</h3>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{noteTask.title} · {noteTask.client}</p>
                            </div>
                            <button onClick={() => setNoteTask(null)} className="p-2 hover:bg-muted rounded-xl transition-all">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                placeholder="¿Qué pasó en la llamada o contacto? Escribe aquí..."
                                rows={4}
                                autoFocus
                                className="w-full bg-muted/30 border border-border rounded-2xl px-4 py-3 text-sm text-foreground resize-none outline-none focus:border-primary/60 transition-all font-medium placeholder:font-normal"
                            />
                            <div className="flex gap-3">
                                <a href={`/leads/${noteTask.clientId}`} target="_blank" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                    <User className="w-3.5 h-3.5" /> Ver Ficha
                                </a>
                                <button onClick={saveNote} disabled={!noteText.trim()} className="flex-1 bg-primary text-black font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Guardar Nota (+8 score)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* New Deal Modal */}
            {isNewModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500">
                    <div className="bg-[#0a0a0b] border border-white/10 w-full max-w-5xl rounded-[3.5rem] overflow-hidden shadow-[0_0_100px_rgba(250,181,16,0.1)] flex flex-col h-[90vh] animate-in zoom-in-95 duration-500">
                        <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div>
                                <h2 className="text-3xl font-black tracking-tighter text-white italic uppercase">Configuración de Oferta</h2>
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">Sincronización operativa directa</p>
                            </div>
                            <X className="w-8 h-8 text-white/20 cursor-pointer hover:text-white transition-colors" onClick={() => setIsNewModalOpen(false)} />
                        </div>

                        <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    {/* Deal Title */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-primary uppercase ml-2 tracking-widest">Identificador del Negocio</label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                            <input type="text" placeholder="Ej: Suministro Boscán - Fase 1" value={newDeal.title} onChange={e => setNewDeal({ ...newDeal, title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-primary text-white font-bold transition-all" />
                                        </div>
                                    </div>

                                    {/* Client */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <label className="text-[10px] font-black text-primary uppercase tracking-widest">Socio Industrial</label>
                                            <button onClick={() => setShowNewClientForm(!showNewClientForm)} className="text-[9px] font-black text-sky-500 uppercase flex items-center gap-1.5 hover:text-sky-400 transition-colors">
                                                {showNewClientForm ? <><X className="w-3 h-3" /> Cancelar Nuevo</> : <><UserPlus className="w-3 h-3" /> Registrar Nuevo</>}
                                            </button>
                                        </div>
                                        {!showNewClientForm ? (
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                                <select value={newDeal.clientId} onChange={e => setNewDeal({ ...newDeal, clientId: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white font-bold outline-none focus:border-primary appearance-none">
                                                    <option value="" className="bg-[#0a0a0b]">Vincular Cliente existente...</option>
                                                    {clients.map(c => <option key={c.id} value={c.id} className="bg-[#0a0a0b]">{c.company} • {c.name}</option>)}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl animate-in slide-in-from-top-2 duration-300">
                                                <div className="space-y-3">
                                                    <input type="text" placeholder="Nombre de la Empresa" value={inlineClient.company} onChange={e => setInlineClient({ ...inlineClient, company: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none" />
                                                    <input type="text" placeholder="Nombre del Contacto" value={inlineClient.name} onChange={e => setInlineClient({ ...inlineClient, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none" />
                                                    <input type="email" placeholder="Email Corporativo" value={inlineClient.email} onChange={e => setInlineClient({ ...inlineClient, email: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none" />
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <SearchableSelect options={settings.cities} value={inlineClient.city} onChange={val => setInlineClient({ ...inlineClient, city: val })} placeholder="Ciudad" />
                                                        <select value={inlineClient.category} onChange={e => setInlineClient({ ...inlineClient, category: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none appearance-none">
                                                            {settings.sectors.map(sector => <option key={sector} value={sector} className="bg-[#0a0a0b]">{sector}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Seller */}
                                    <div className="space-y-3 p-6 bg-primary/[0.02] border border-primary/20 rounded-3xl relative overflow-hidden group">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex flex-col">
                                                <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                                    Asignación de Equipo
                                                    {isSuperAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-white/20" />}
                                                </label>
                                                {!isSuperAdmin && <p className="text-[8px] font-bold text-white/40 uppercase mt-1">Solo SuperAdmin puede cambiar la asignación</p>}
                                            </div>
                                            {isSuperAdmin && <div className="text-[8px] font-black bg-primary text-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Acceso Total</div>}
                                        </div>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-primary/30 bg-primary/20 flex items-center justify-center overflow-hidden">
                                                {isSuperAdmin ? (
                                                    sellers.find(s => s.id === newDeal.assignedTo)?.avatar ? <img src={sellers.find(s => s.id === newDeal.assignedTo)?.avatar} className="w-full h-full object-cover" alt="" /> : <User className="w-4 h-4 text-primary" />
                                                ) : currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt="" /> : <User className="w-4 h-4 text-primary" />}
                                            </div>
                                            <select value={isSuperAdmin ? newDeal.assignedTo : currentUser.id} disabled={!isSuperAdmin} onChange={e => setNewDeal({ ...newDeal, assignedTo: e.target.value })} className={clsx("w-full bg-white/5 border border-white/10 rounded-2xl pl-16 pr-4 py-5 text-sm font-black text-white outline-none transition-all appearance-none", isSuperAdmin ? "focus:border-primary cursor-pointer" : "opacity-60 cursor-not-allowed")}>
                                                <option value="" className="bg-[#0a0a0b]">Asignar responsable...</option>
                                                {sellers.map(s => <option key={s.id} value={s.id} className="bg-[#0a0a0b]">{s.name} ({s.role})</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    {/* Products */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-primary uppercase ml-2 tracking-widest">Configuración de Producto</label>
                                        <select onChange={e => { addProductToNewDeal(e.target.value); e.target.value = ''; }} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-primary appearance-none">
                                            <option value="" className="bg-[#0a0a0b]">Inyectar Ítems del Inventario...</option>
                                            {products.map(p => <option key={p.id} value={p.id} className="bg-[#0a0a0b]">{p.name} • ${p.price.toLocaleString()}</option>)}
                                        </select>
                                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                            {newDeal.products.map((p, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white/[0.04] p-5 rounded-2xl border border-white/5 animate-in zoom-in-95">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-white">{p.name}</span>
                                                        <span className="text-[10px] font-bold text-white/30 tracking-tight mt-0.5">${p.price.toLocaleString()} / Und.</span>
                                                    </div>
                                                    <button onClick={() => setNewDeal({ ...newDeal, products: newDeal.products.filter((_, idx) => idx !== i) })} className="p-2 hover:bg-rose-500/20 hover:text-rose-500 rounded-lg text-white/20 transition-all">
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            ))}
                                            {newDeal.products.length === 0 && (
                                                <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Ningún ítem cargado</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Total */}
                                    <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] mt-auto relative overflow-hidden flex flex-col items-center justify-center text-center group">
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <p className="text-[10px] font-black uppercase text-primary mb-3 tracking-[0.3em]">VALOR TOTAL DE OFERTA</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-black text-primary/40">$</span>
                                            <span className="text-5xl font-black text-white tracking-tighter leading-none">{calculateNewDealTotal().toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 border-t border-white/5 flex items-center justify-between bg-white/[0.03]">
                            <div className="flex items-center gap-4">
                                {isProcessing && (
                                    <div className="flex items-center gap-3 animate-pulse">
                                        <div className="w-2 h-2 bg-primary rounded-full" />
                                        <span className="text-[10px] font-black text-primary tracking-[0.1em] uppercase">{automationStep}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setIsNewModalOpen(false)} className="px-10 py-5 rounded-2xl border border-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all">Cancelar</button>
                                <button onClick={handleCreateDeal} disabled={isProcessing || (!newDeal.clientId && !showNewClientForm) || !newDeal.title || newDeal.products.length === 0} className="bg-primary text-black font-black px-12 py-5 rounded-2xl shadow-2xl shadow-primary/20 disabled:opacity-20 uppercase text-[10px] tracking-widest hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center gap-3">
                                    {isProcessing ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><ShieldCheck className="w-5 h-5" /> Confirmar Lanzamiento</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && selectedTask && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-card border border-border w-full max-w-6xl rounded-[2.5rem] overflow-hidden flex h-[90vh] shadow-[0_32px_80px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-300">

                        {/* Sidebar */}
                        <div className="w-80 border-r border-border bg-muted/20 p-8 flex flex-col space-y-8">
                            <div className="space-y-4">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                                    <Building2 className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-foreground leading-none tracking-tighter uppercase">{selectedTask.client}</h2>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.18em] mt-1.5">NEGOCIO: {selectedTask.id.slice(0, 18)}</p>
                                </div>
                            </div>

                            <div className="flex-1 space-y-4">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.25em] pl-1">Asignación Operativa</p>
                                <div className={clsx("p-5 rounded-2xl border transition-all", isSuperAdmin ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border opacity-80")}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center overflow-hidden">
                                            {sellers.find(s => s.name === selectedTask.assignedTo)?.avatar ? <img src={sellers.find(s => s.name === selectedTask.assignedTo)?.avatar} className="w-full h-full object-cover" alt="" /> : <User className="w-4 h-4 text-primary" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Vendedor Cargo</p>
                                            <select disabled={!isSuperAdmin} className={clsx("bg-transparent text-xs font-black text-foreground outline-none w-full", !isSuperAdmin && "cursor-not-allowed")} value={sellers.find(s => s.name === selectedTask.assignedTo)?.id || ''} onChange={e => { const s = sellers.find(sel => sel.id === e.target.value); if (s) updateTask(selectedTask.id, { assignedTo: s.name }); }}>
                                                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        {!isSuperAdmin && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleDelete} className="flex items-center gap-3 text-rose-400 hover:text-rose-600 transition-all group p-3 rounded-2xl hover:bg-rose-50 border border-transparent hover:border-rose-200">
                                <Trash className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em]">Cerrar/Eliminar Lead</span>
                            </button>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 p-8 lg:p-10 flex flex-col overflow-hidden">
                            <div className="flex items-start justify-between mb-8">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-2xl font-black text-foreground tracking-tighter uppercase">{selectedTask.title}</h3>
                                        <span className="px-3 py-1 rounded-full bg-muted border border-border text-[9px] font-black text-muted-foreground uppercase tracking-widest">{selectedTask.aiScore} AI Score</span>
                                    </div>
                                    {selectedTask.quoteId && (
                                        <p className="text-xs font-bold text-primary flex items-center gap-2">
                                            <Tag className="w-3 h-3" /> Cotización vinculada: {selectedTask.quoteId}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="px-5 py-3 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-3">
                                        <DollarSign className="w-5 h-5 text-primary" />
                                        <span className="text-xl font-black text-foreground tabular-nums">{selectedTask.value}</span>
                                    </div>
                                    <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-all border border-border">
                                        <X className="w-5 h-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 flex-1 min-h-0">
                                <div className="flex flex-col gap-5 overflow-y-auto custom-scrollbar">
                                    <div className="flex-1 p-6 bg-white/60 rounded-[1.5rem] border border-border relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-6 opacity-5">
                                            <UserPlus className="w-14 h-14 text-primary" />
                                        </div>
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.22em] mb-6">Ficha del Cliente</p>
                                        <div className="space-y-5">
                                            {[
                                                { icon: User, label: 'Contacto', value: selectedTask.contactName },
                                                { icon: Mail, label: 'Email', value: selectedTask.email || '—' },
                                                { icon: MapPin, label: 'Ciudad', value: selectedTask.city || 'Colombia' },
                                            ].map(({ icon: Icon, label, value }) => (
                                                <div key={label} className="flex items-center gap-4 group">
                                                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center border border-border group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                                                        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
                                                        <span className="text-sm font-bold text-foreground">{value}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setCallNoteText(''); setShowCallModal(true); }}
                                            className="flex-1 bg-primary text-black p-4 rounded-[1.5rem] flex flex-col items-center gap-2 hover:scale-[1.03] shadow-lg shadow-primary/20 transition-all group"
                                        >
                                            <Phone className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.15em]">Registrar Llamada</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const email = selectedTask.email || clients.find(c => c.id === selectedTask.clientId)?.email || '';
                                                if (email) {
                                                    logAction('email', `Email enviado a ${email}`);
                                                    window.open(`mailto:${email}`, '_blank');
                                                }
                                            }}
                                            className="flex-1 bg-card border border-border text-foreground p-4 rounded-[1.5rem] flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-300 transition-all group"
                                        >
                                            <Mail className="w-5 h-5 text-blue-500 group-hover:-translate-y-0.5 transition-transform" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.15em]">Enviar Email</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const rawPhone = selectedTask.phone || clients.find(c => c.id === selectedTask.clientId)?.phone || '';
                                                const phone = rawPhone.replace(/\D/g, '');
                                                if (phone) {
                                                    logAction('whatsapp', `WhatsApp enviado a ${selectedTask.contactName}`);
                                                    window.open(`https://wa.me/${phone}`, '_blank');
                                                }
                                            }}
                                            className="flex-1 bg-card border border-border text-foreground p-4 rounded-[1.5rem] flex flex-col items-center gap-2 hover:bg-emerald-50 hover:border-emerald-300 transition-all group"
                                        >
                                            <MessageCircle className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.15em]">WhatsApp</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 min-h-0">
                                    <div className="flex items-center justify-between px-1 shrink-0">
                                        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.25em]">Muro de Inteligencia</h3>
                                        <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-200">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                            Synced
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 min-h-0">
                                        {selectedTask.activities.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                                                <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                                                    <Clock className="w-5 h-5 text-muted-foreground/30" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase text-muted-foreground/30 tracking-widest">Sin actividad aún</p>
                                                <p className="text-[9px] text-muted-foreground/20 mt-1">Las acciones quedan registradas aquí</p>
                                            </div>
                                        ) : selectedTask.activities.map(a => (
                                            <div key={a.id} className="bg-white/70 p-4 rounded-2xl border-l-[3px] border border-border/60 hover:bg-white/90 transition-all"
                                                style={{ borderLeftColor: a.type === 'call' ? '#0ea5e9' : a.type === 'whatsapp' ? '#10b981' : a.type === 'email' ? '#3b82f6' : a.type === 'system' ? '#fab510' : '#f59e0b' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm leading-none">
                                                            {a.type === 'call' ? '📞' : a.type === 'whatsapp' ? '💬' : a.type === 'email' ? '📧' : a.type === 'system' ? '⚙️' : '📝'}
                                                        </span>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{a.type}</p>
                                                    </div>
                                                    <p className="text-[9px] text-muted-foreground/60 font-bold tabular-nums">
                                                        {new Date(a.timestamp).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <p className="text-sm font-semibold text-foreground leading-relaxed">{a.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
