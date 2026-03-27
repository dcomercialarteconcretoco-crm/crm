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
    MoreVertical,
    Camera,
    CheckCircle2,
    Users,
    Clock,
    Trash2,
    Edit3,
    X,
    Eye,
    EyeOff,
    Lock
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, Seller } from '@/context/AppContext';
import AvatarUpload from '@/components/ui/AvatarUpload';

export default function TeamPage() {
    const { sellers, addSeller, deleteSeller, updateSeller, currentUser, quotes, tasks, clients } = useApp();
    const [searchTerm, setSearchTerm] = useState("");
    const [view, setView] = useState<'team' | 'stats'>('team');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState<Omit<Seller, 'id'>>({
        name: '',
        role: 'Vendedor',
        email: '',
        phone: '',
        username: '',
        status: 'Activo',
        avatar: '',
        sales: '$0',
        commission: '10%',
        password: ''
    });

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
            setForm({ ...seller });
        } else {
            setEditingSeller(null);
            setForm({
                name: '',
                role: 'Vendedor',
                email: '',
                phone: '',
                username: '',
                status: 'Activo',
                avatar: '',
                sales: '$0',
                commission: '10%',
                password: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!form.name || !form.email) return;

        const finalForm = {
            ...form,
            avatar: form.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=f5f0e8&color=1a1a1a`
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

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="page-hero-title text-2xl font-black tracking-tight flex items-center gap-3">
                        Equipo de Trabajo
                        <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Sync Global</span>
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium">Gestiona tu equipo. Los cambios se reflejan en el Pipeline en tiempo real.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary text-black font-black px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-xs uppercase tracking-widest"
                >
                    <Plus className="w-4 h-4" />
                    <span>Añadir Miembro</span>
                </button>
            </div>

            {/* View Switcher */}
            <div className="flex items-center justify-center">
                <div className="bg-white/28 border border-white/70 p-1 rounded-2xl flex items-center gap-1 backdrop-blur-xl">
                    <button
                        onClick={() => setView('team')}
                        className={clsx(
                            "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                            view === 'team' ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Equipo
                    </button>
                    <button
                        onClick={() => setView('stats')}
                        className={clsx(
                            "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                            view === 'stats' ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Estadísticas
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-2 border-b border-white/50 bg-white/12 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, cargo o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/36 border border-white/75 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground placeholder:text-muted-foreground backdrop-blur-xl"
                    />
                </div>
                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pr-4">
                    {filteredSellers.length} miembros en el equipo
                </div>
            </div>

            {view === 'team' ? (
                /* Team Card Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredSellers.map((seller) => {
                        const isSelf = seller.id === currentUser?.id;
                        const roleLC = (seller.role || '').toLowerCase();
                        const isProtected = ['superadmin', 'admin', 'manager'].includes(roleLC);
                        const canDelete = !isSelf && !isProtected;
                        return (
                        <div key={seller.id} className={`surface-card rounded-2xl p-5 relative overflow-hidden group hover:border-primary/20 transition-all flex flex-col ${isSelf ? 'ring-2 ring-primary/40' : ''}`}>
                            {isSelf && (
                                <div className="absolute top-3 right-3 bg-primary text-black text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                                    Tú
                                </div>
                            )}
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 rounded-2xl bg-white border border-primary/20 flex items-center justify-center text-xl font-black text-primary mb-3 transform group-hover:scale-105 transition-all duration-300 overflow-hidden shadow-sm">
                                    {seller.avatar ? (
                                        <img src={seller.avatar} alt={seller.name} className="w-full h-full object-cover" />
                                    ) : (
                                        seller.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                    )}
                                </div>
                                <div className="text-center">
                                    <h3 className="text-sm font-black text-foreground uppercase group-hover:text-primary transition-colors italic tracking-tighter">{seller.name}</h3>
                                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-0.5 opacity-70 italic">{seller.role}</p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/55 space-y-2">
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <div className="w-7 h-7 rounded-lg bg-white/42 border border-white/70 flex items-center justify-center shrink-0">
                                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-tight lowercase truncate">{seller.email || '—'}</span>
                                </div>
                                {seller.phone ? (
                                    <div className="flex items-center gap-3 text-muted-foreground">
                                        <div className="w-7 h-7 rounded-lg bg-white/42 border border-white/70 flex items-center justify-center shrink-0">
                                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                        </div>
                                        <span className="text-[10px] font-bold tracking-tight">{seller.phone}</span>
                                    </div>
                                ) : null}
                            </div>

                            {/* Action Footer */}
                            <div className={`grid gap-2 mt-4 ${canDelete ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                <button
                                    onClick={() => handleOpenModal(seller)}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-black font-black uppercase text-[9px] tracking-widest transition-all border border-primary/10"
                                >
                                    <Eye className="w-3 h-3" />
                                    Ver Perfil
                                </button>
                                {canDelete && (
                                    <button
                                        onClick={() => handleDelete(seller.id)}
                                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-black font-black uppercase text-[9px] tracking-widest transition-all border border-rose-500/10"
                                    >
                                        <Trash2 className="w-3 h-3" />
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
                <div className="space-y-6">
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
                        <div key={seller.id} className="surface-card rounded-[2.5rem] p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center hover:border-primary/20 transition-all shadow-[0_20px_60px_rgba(15,23,42,0.07)] relative group">
                            <div className="lg:col-span-4 flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-white/55 border border-white/75 flex items-center justify-center text-xl font-black text-primary/70 group-hover:bg-primary group-hover:text-black transition-all overflow-hidden">
                                    {seller.avatar ? (
                                        <img src={seller.avatar} alt={seller.name} className="w-full h-full object-cover" />
                                    ) : (
                                        seller.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-foreground uppercase italic tracking-tighter group-hover:text-primary transition-colors">{seller.name}</h3>
                                    <p className="text-[10px] font-black text-primary/70 uppercase tracking-widest mt-0.5 italic">{seller.role}</p>
                                    <p className="text-[9px] text-muted-foreground mt-1">{sellerTasks.length} tarea{sellerTasks.length !== 1 ? 's' : ''} asignada{sellerTasks.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>

                            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 rounded-2xl flex flex-col items-center justify-center border border-border/40 bg-sky-500/5 transition-all hover:scale-105">
                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Cotizaciones</p>
                                    <p className="text-xl font-black italic tracking-tighter text-sky-500">{sellerQuotes.length}</p>
                                    <p className="text-[7px] font-black text-muted-foreground/70 uppercase tracking-tighter mt-1">total enviadas</p>
                                </div>
                                <div className="p-4 rounded-2xl flex flex-col items-center justify-center border border-border/40 bg-emerald-500/5 transition-all hover:scale-105">
                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Ganadas</p>
                                    <p className="text-xl font-black italic tracking-tighter text-emerald-500">{wonQuotes.length}</p>
                                    <p className="text-[7px] font-black text-muted-foreground/70 uppercase tracking-tighter mt-1">aprobadas</p>
                                </div>
                                <div className="p-4 rounded-2xl flex flex-col items-center justify-center border border-border/40 bg-primary/5 transition-all hover:scale-105">
                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Tasa</p>
                                    <p className="text-xl font-black italic tracking-tighter text-primary">{conversionRate}%</p>
                                    <p className="text-[7px] font-black text-muted-foreground/70 uppercase tracking-tighter mt-1">conversión</p>
                                </div>
                                <div className="p-4 rounded-2xl flex flex-col items-center justify-center border border-border/40 bg-amber-500/5 transition-all hover:scale-105">
                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Revenue</p>
                                    <p className="text-sm font-black italic tracking-tighter text-amber-500 text-center leading-tight">{revenueFormatted}</p>
                                    <p className="text-[7px] font-black text-muted-foreground/70 uppercase tracking-tighter mt-1">ganado</p>
                                </div>
                            </div>

                            <div className="hidden lg:block absolute top-6 right-8">
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2">
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(247,243,234,0.78)] backdrop-blur-xl">
                    <div className="surface-panel w-full max-w-xl rounded-[3rem] overflow-hidden shadow-[0_28px_80px_rgba(20,16,8,0.14)] flex flex-col animate-in zoom-in-95 duration-300 border border-white/85">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-border/60 flex items-center justify-between bg-white/56">
                            <h2 className="text-3xl font-black text-foreground italic tracking-tighter uppercase">
                                {editingSeller ? 'Editar Perfil' : 'Nuevo Miembro'}
                            </h2>
                            <X className="w-8 h-8 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => setIsModalOpen(false)} />
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar bg-white/42">
                            {/* Avatar Section */}
                            <div className="flex flex-col items-center gap-4">
                                <AvatarUpload
                                    value={form.avatar || ''}
                                    onChange={(base64) => setForm(f => ({ ...f, avatar: base64 }))}
                                    name={form.name}
                                    size="md"
                                />
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Configuración de Identidad</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase ml-2">Nombre Completo</p>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                        <input
                                            type="text"
                                            placeholder="Ej: Roberto Gómez"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full bg-white/74 border border-white/90 rounded-2xl pl-12 pr-4 py-4 text-foreground font-bold outline-none focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/60"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase ml-2">Username @</p>
                                    <input
                                        type="text"
                                        placeholder="roberto.g"
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        className="w-full bg-white/74 border border-white/90 rounded-2xl px-6 py-4 text-foreground font-bold outline-none focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/60"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-muted-foreground uppercase ml-2">Email Corporativo</p>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <input
                                        type="email"
                                        placeholder="nombre@arteconcreto.co"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full bg-white/74 border border-white/90 rounded-2xl pl-12 pr-4 py-4 text-foreground font-bold outline-none focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/60"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase ml-2">Rol de Acceso</p>
                                    <select
                                        value={form.role}
                                        onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                                        className="w-full bg-white/74 border border-white/90 rounded-2xl px-6 py-4 text-foreground font-bold outline-none focus:border-primary/50 appearance-none shadow-inner"
                                    >
                                        <option value="SuperAdmin">Administrador Principal</option>
                                        <option value="Admin">Administrador</option>
                                        <option value="Manager">Manager Operativo</option>
                                        <option value="Vendedor">Vendedor Senior</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase ml-2">Contraseña de Acceso</p>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            className="w-full bg-white/74 border border-white/90 rounded-2xl pl-12 pr-12 py-4 text-foreground font-bold outline-none focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/60"
                                        />
                                        <button
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-primary transition-colors text-muted-foreground/50"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 border-t border-border/60 flex gap-4 bg-white/56">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-5 rounded-2xl border border-white/90 text-foreground font-black uppercase text-[10px] tracking-widest hover:bg-white/80 transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleSave} className="flex-1 bg-primary text-black font-black px-4 py-5 rounded-2xl shadow-xl shadow-primary/15 uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                {editingSeller ? 'Actualizar Miembro' : 'Crear Usuario'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
