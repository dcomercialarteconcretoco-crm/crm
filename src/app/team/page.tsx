"use client";

import React, { useMemo, useState } from 'react';
import {
    Plus,
    Search,
    User,
    Mail,
    Phone,
    TrendingUp,
    Shield,
    CheckCircle2,
    Users,
    Clock,
    Trash2,
    X,
    Eye,
    EyeOff,
    Lock,
    ChevronDown,
    ChevronUp,
    RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, Seller } from '@/context/AppContext';
import AvatarUpload from '@/components/ui/AvatarUpload';
import {
    PERMISSION_GROUPS,
    DEFAULT_PERMISSIONS,
    getDefaultPermissions,
    ALL_PERMISSION_KEYS,
} from '@/lib/permissions';

type FormSeller = Omit<Seller, 'id'> & { permissions: Record<string, boolean> };

const ROLE_BADGE: Record<string, string> = {
    SuperAdmin: 'bg-rose-100 text-rose-700 border-rose-200',
    Admin: 'bg-amber-100 text-amber-700 border-amber-200',
    Manager: 'bg-violet-100 text-violet-700 border-violet-200',
    Vendedor: 'bg-sky-100 text-sky-700 border-sky-200',
};

const GROUP_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-500'     },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500'    },
};

function makeBlankForm(): FormSeller {
    return {
        name: '',
        role: 'Vendedor',
        email: '',
        phone: '',
        username: '',
        status: 'Activo',
        avatar: '',
        sales: '$0',
        commission: '10%',
        password: '',
        permissions: getDefaultPermissions('Vendedor'),
    };
}

export default function TeamPage() {
    const { sellers, addSeller, deleteSeller, updateSeller, currentUser, quotes, tasks } = useApp();
    const [searchTerm, setSearchTerm] = useState("");
    const [view, setView] = useState<'team' | 'stats'>('team');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showPermissions, setShowPermissions] = useState(false);
    const [form, setForm] = useState<FormSeller>(makeBlankForm());

    const isCurrentUserAdmin =
        currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    const teamSellers = useMemo(() => {
        const normalizedCurrentIdentity = (
            currentUser?.email ||
            currentUser?.username ||
            ''
        ).trim().toLowerCase();

        const sanitized = sellers.filter((seller) => {
            if (seller.role !== 'SuperAdmin') return true;
            if (!normalizedCurrentIdentity) return false;
            const sellerIdentity = (seller.email || seller.username || '').trim().toLowerCase();
            return sellerIdentity === normalizedCurrentIdentity || seller.id === currentUser?.id;
        });

        if (!currentUser) return sanitized;

        const currentIdentity = (currentUser.email || currentUser.username || '').trim().toLowerCase();
        const withoutCurrent = sanitized.filter((seller) => {
            const sellerIdentity = (seller.email || seller.username || '').trim().toLowerCase();
            return seller.id !== currentUser.id && sellerIdentity !== currentIdentity;
        });

        const canonicalCurrentUser: Seller = {
            ...currentUser,
            name: currentUser.name || 'Admin',
            role: currentUser.role || 'SuperAdmin',
            status: currentUser.status || 'Activo',
            avatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'Admin')}&background=ffffff&color=1a1a1a`,
        };

        return [canonicalCurrentUser, ...withoutCurrent];
    }, [currentUser, sellers]);

    const filteredSellers = teamSellers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (seller?: Seller) => {
        if (seller) {
            setEditingSeller(seller);
            setForm({
                ...seller,
                permissions: seller.permissions
                    ? { ...getDefaultPermissions(seller.role), ...seller.permissions }
                    : getDefaultPermissions(seller.role),
            });
        } else {
            setEditingSeller(null);
            setForm(makeBlankForm());
        }
        setShowPermissions(false);
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleRoleChange = (role: string) => {
        const defaults = getDefaultPermissions(role);
        setForm(f => ({ ...f, role: role as Seller['role'], permissions: { ...defaults } }));
    };

    const togglePermission = (key: string) => {
        setForm(f => ({
            ...f,
            permissions: { ...f.permissions, [key]: !f.permissions[key] },
        }));
    };

    const resetPermissionsToRole = () => {
        setForm(f => ({ ...f, permissions: { ...getDefaultPermissions(f.role) } }));
    };

    const handleSave = () => {
        if (!form.name || !form.email) return;
        const finalForm = {
            ...form,
            avatar: form.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=f5f0e8&color=1a1a1a`,
        };
        if (editingSeller) {
            updateSeller(editingSeller.id, finalForm);
        } else {
            addSeller(finalForm);
        }
        setIsModalOpen(false);
        setShowPassword(false);
    };

    const handleDelete = (id: string) => {
        if (confirm('¿Estás seguro de eliminar a este miembro del equipo?')) {
            deleteSeller(id);
        }
    };

    // Count active permissions for a seller
    const countActivePerms = (seller: Seller) => {
        const perms = seller.permissions
            ? { ...getDefaultPermissions(seller.role), ...seller.permissions }
            : getDefaultPermissions(seller.role);
        return ALL_PERMISSION_KEYS.filter(k => perms[k]).length;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-24 lg:pb-10">

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="page-title flex items-center gap-3">
                        Equipo de Trabajo
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                            Sync Global
                        </span>
                    </h1>
                    <p className="page-subtitle">Gestiona tu equipo. Los cambios se reflejan en el Pipeline en tiempo real.</p>
                </div>
                {isCurrentUserAdmin && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] flex items-center gap-2 text-sm self-start md:self-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir Miembro
                    </button>
                )}
            </div>

            {/* View Switcher */}
            <div className="flex items-center justify-center">
                <div className="surface-card rounded-xl p-1 flex items-center gap-1">
                    <button
                        onClick={() => setView('team')}
                        className={clsx(
                            'px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2',
                            view === 'team'
                                ? 'bg-primary text-black shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Equipo
                    </button>
                    <button
                        onClick={() => setView('stats')}
                        className={clsx(
                            'px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2',
                            view === 'stats'
                                ? 'bg-primary text-black shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Estadísticas
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="surface-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, cargo o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all text-foreground placeholder:text-muted-foreground"
                    />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {filteredSellers.length} miembros en el equipo
                </span>
            </div>

            {view === 'team' ? (
                /* Team Card Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredSellers.map((seller) => {
                        const isSelf = seller.id === currentUser?.id;
                        const roleLC = (seller.role || '').toLowerCase();
                        const isProtected = roleLC === 'superadmin';
                        const canDelete = !isSelf && !isProtected && isCurrentUserAdmin;
                        const activePerms = countActivePerms(seller);

                        return (
                            <div
                                key={seller.id}
                                className={clsx(
                                    'surface-card rounded-2xl p-5 relative overflow-hidden group hover:border-primary/30 transition-all flex flex-col',
                                    isSelf && 'ring-2 ring-primary/40'
                                )}
                            >
                                {isSelf && (
                                    <div className="absolute top-3 right-3 bg-primary text-black text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                                        Tú
                                    </div>
                                )}

                                {/* Avatar + identity */}
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-base font-bold text-primary mb-3 overflow-hidden group-hover:scale-105 transition-all duration-300">
                                        {seller.avatar ? (
                                            <img src={seller.avatar} alt={seller.name} className="w-full h-full object-cover" />
                                        ) : (
                                            seller.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{seller.name}</h3>
                                        <span className={clsx(
                                            'inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                            ROLE_BADGE[seller.role] ?? 'bg-muted text-muted-foreground border-border'
                                        )}>
                                            {seller.role}
                                        </span>
                                    </div>
                                </div>

                                {/* Contact info */}
                                <div className="mt-4 pt-4 border-t border-border space-y-2">
                                    <div className="flex items-center gap-2.5 text-muted-foreground">
                                        <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                                            <Mail className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs truncate">{seller.email || '—'}</span>
                                    </div>
                                    {seller.phone ? (
                                        <div className="flex items-center gap-2.5 text-muted-foreground">
                                            <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                                                <Phone className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs">{seller.phone}</span>
                                        </div>
                                    ) : null}
                                    <div className="flex items-center gap-2.5 text-muted-foreground">
                                        <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                                            <Shield className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs">{activePerms} / {ALL_PERMISSION_KEYS.length} permisos activos</span>
                                    </div>
                                </div>

                                {/* Action Footer */}
                                <div className={clsx('grid gap-2 mt-4', canDelete ? 'grid-cols-2' : 'grid-cols-1')}>
                                    <button
                                        onClick={() => handleOpenModal(seller)}
                                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-black font-bold text-xs transition-all border border-primary/20"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        {isCurrentUserAdmin ? 'Ver / Editar' : 'Ver Perfil'}
                                    </button>
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(seller.id)}
                                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-bold text-xs transition-all border border-rose-500/20"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Eliminar
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Stats View */
                <div className="space-y-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rendimiento del equipo</p>
                    {filteredSellers.map((seller) => {
                        const sellerQuotes = quotes.filter(q => q.sellerId === seller.id || q.sellerName === seller.name);
                        const sellerTasks = tasks.filter(t => t.assignedTo === seller.id || t.assignedTo === seller.name);
                        const wonQuotes = sellerQuotes.filter(q => q.status === 'Approved');
                        const totalRevenue = wonQuotes.reduce((acc, q) => acc + (q.numericTotal || 0), 0);
                        const conversionRate = sellerQuotes.length > 0 ? Math.round((wonQuotes.length / sellerQuotes.length) * 100) : 0;
                        const revenueFormatted = totalRevenue > 0
                            ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalRevenue)
                            : '$0';

                        return (
                            <div
                                key={seller.id}
                                className="surface-card rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center hover:border-primary/30 transition-all group"
                            >
                                {/* Identity */}
                                <div className="lg:col-span-4 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-base font-bold text-primary group-hover:bg-primary group-hover:text-black transition-all overflow-hidden shrink-0">
                                        {seller.avatar ? (
                                            <img src={seller.avatar} alt={seller.name} className="w-full h-full object-cover" />
                                        ) : (
                                            seller.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{seller.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">{seller.role}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {sellerTasks.length} tarea{sellerTasks.length !== 1 ? 's' : ''} asignada{sellerTasks.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Stat boxes */}
                                <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="surface-card rounded-xl p-4 flex flex-col items-center justify-center border-border hover:scale-105 transition-all">
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Cotizaciones</p>
                                        <p className="text-xl font-black text-sky-500">{sellerQuotes.length}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">total enviadas</p>
                                    </div>
                                    <div className="surface-card rounded-xl p-4 flex flex-col items-center justify-center border-border hover:scale-105 transition-all">
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Ganadas</p>
                                        <p className="text-xl font-black text-emerald-500">{wonQuotes.length}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">aprobadas</p>
                                    </div>
                                    <div className="surface-card rounded-xl p-4 flex flex-col items-center justify-center border-border hover:scale-105 transition-all">
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Tasa</p>
                                        <p className="text-xl font-black text-primary">{conversionRate}%</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">conversión</p>
                                    </div>
                                    <div className="surface-card rounded-xl p-4 flex flex-col items-center justify-center border-border hover:scale-105 transition-all">
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Revenue</p>
                                        <p className="text-sm font-black text-amber-500 text-center leading-tight">{revenueFormatted}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">ganado</p>
                                    </div>
                                </div>

                                <div className="hidden lg:flex lg:col-span-12 justify-end -mt-4">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" /> En vivo
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4 z-[100]"
                    style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}
                >
                    <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
                            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                {editingSeller ? 'Editar Perfil' : 'Nuevo Miembro'}
                                {editingSeller && (
                                    <span className={clsx(
                                        'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                        ROLE_BADGE[editingSeller.role] ?? 'bg-muted text-muted-foreground border-border'
                                    )}>
                                        {editingSeller.role}
                                    </span>
                                )}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">

                            {/* Avatar Section */}
                            <div className="flex flex-col items-center gap-3 pb-2">
                                <AvatarUpload
                                    value={form.avatar || ''}
                                    onChange={(base64) => setForm(f => ({ ...f, avatar: base64 }))}
                                    name={form.name}
                                    size="md"
                                />
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Foto de perfil</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                        Nombre Completo
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Ej: Roberto Gómez"
                                            value={form.name}
                                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                            className="w-full bg-muted border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                        Username @
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="roberto.g"
                                        value={form.username}
                                        onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                                        className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                    Email Corporativo
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        placeholder="nombre@arteconcreto.co"
                                        value={form.email}
                                        onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                                        className="w-full bg-muted border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                        Rol de Acceso
                                    </label>
                                    <select
                                        value={form.role}
                                        onChange={(e) => handleRoleChange(e.target.value)}
                                        className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white appearance-none transition-all"
                                        disabled={!isCurrentUserAdmin}
                                    >
                                        <option value="SuperAdmin">Administrador Principal</option>
                                        <option value="Admin">Administrador</option>
                                        <option value="Manager">Manager Operativo</option>
                                        <option value="Vendedor">Vendedor Senior</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                        Contraseña de Acceso
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={form.password}
                                            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                                            className="w-full bg-muted border border-border rounded-xl pl-9 pr-10 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Permissions Panel — only for Admin/SuperAdmin */}
                            {isCurrentUserAdmin && (
                                <div className="border border-border rounded-2xl overflow-hidden">
                                    {/* Permissions Header Toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setShowPermissions(v => !v)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/60 hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Shield className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                                                Permisos de Acceso
                                            </span>
                                            <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                                                {ALL_PERMISSION_KEYS.filter(k => form.permissions[k]).length} / {ALL_PERMISSION_KEYS.length} activos
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); resetPermissionsToRole(); }}
                                                title="Restablecer permisos del rol"
                                                className="text-[10px] font-semibold text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                Restablecer
                                            </button>
                                            {showPermissions
                                                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            }
                                        </div>
                                    </button>

                                    {/* Permission Groups */}
                                    {showPermissions && (
                                        <div className="p-4 space-y-4 border-t border-border">
                                            {PERMISSION_GROUPS.map((group) => {
                                                const colors = GROUP_COLORS[group.color] ?? GROUP_COLORS.sky;
                                                const groupActive = group.keys.filter(k => form.permissions[k.key]).length;
                                                return (
                                                    <div key={group.label}>
                                                        <div className={clsx('flex items-center justify-between mb-2 px-2 py-1 rounded-lg', colors.bg)}>
                                                            <span className={clsx('text-[10px] font-bold uppercase tracking-widest', colors.text)}>
                                                                {group.label}
                                                            </span>
                                                            <span className={clsx('text-[10px] font-bold', colors.text)}>
                                                                {groupActive}/{group.keys.length}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-1.5">
                                                            {group.keys.map(({ key, label }) => {
                                                                const isOn = Boolean(form.permissions[key]);
                                                                return (
                                                                    <label
                                                                        key={key}
                                                                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-muted/60 cursor-pointer group/perm transition-colors"
                                                                    >
                                                                        <span className="text-xs text-foreground group-hover/perm:text-primary transition-colors">
                                                                            {label}
                                                                        </span>
                                                                        {/* Toggle Switch */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => togglePermission(key)}
                                                                            className={clsx(
                                                                                'relative shrink-0 w-9 h-5 rounded-full transition-all duration-200',
                                                                                isOn ? 'bg-primary' : 'bg-muted border border-border'
                                                                            )}
                                                                            aria-checked={isOn}
                                                                            role="switch"
                                                                        >
                                                                            <span className={clsx(
                                                                                'absolute top-0.5 w-4 h-4 rounded-full shadow transition-all duration-200',
                                                                                isOn
                                                                                    ? 'left-[18px] bg-black'
                                                                                    : 'left-0.5 bg-white border border-border'
                                                                            )} />
                                                                        </button>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-border shrink-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            {isCurrentUserAdmin && (
                                <button
                                    onClick={handleSave}
                                    className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] flex items-center gap-2 text-sm"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    {editingSeller ? 'Actualizar Miembro' : 'Crear Usuario'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
