"use client";

import React, { useState } from 'react';
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

export default function TeamPage() {
    const { sellers, addSeller, deleteSeller, updateSeller } = useApp();
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

    const filteredSellers = sellers.filter(s =>
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
            avatar: form.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=random&color=fff`
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
                    <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
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
                <div className="bg-white/5 border border-white/10 p-1 rounded-2xl flex items-center gap-1">
                    <button
                        onClick={() => setView('team')}
                        className={clsx(
                            "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                            view === 'team' ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-white/40 hover:text-white"
                        )}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Equipo
                    </button>
                    <button
                        onClick={() => setView('stats')}
                        className={clsx(
                            "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                            view === 'stats' ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-white/40 hover:text-white"
                        )}
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Estadísticas
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-2 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, cargo o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-white placeholder:text-white/10"
                    />
                </div>
                <div className="text-[10px] font-black text-white/20 uppercase tracking-widest pr-4">
                    {filteredSellers.length} miembros en el equipo
                </div>
            </div>

            {view === 'team' ? (
                /* Team Card Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredSellers.map((seller) => (
                        <div key={seller.id} className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group hover:border-primary/20 transition-all shadow-2xl flex flex-col">
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 rounded-[2.5rem] bg-primary border border-primary/20 flex items-center justify-center text-3xl font-black text-black shadow-xl mb-6 transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 overflow-hidden">
                                    {seller.avatar ? (
                                        <img src={seller.avatar} alt={seller.name} className="w-full h-full object-cover" />
                                    ) : (
                                        seller.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                    )}
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-black text-white uppercase group-hover:text-primary transition-colors italic tracking-tighter">{seller.name}</h3>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1 opacity-60 italic">{seller.role}</p>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                                <div className="flex items-center gap-4 text-white/40 group/item hover:text-white transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                        <Mail className="w-4.5 h-4.5 text-white/10" />
                                    </div>
                                    <span className="text-[11px] font-bold tracking-tight lowercase truncate">{seller.email}</span>
                                </div>
                                <div className="flex items-center gap-4 text-white/40 group/item hover:text-white transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                        <Phone className="w-4.5 h-4.5 text-white/10" />
                                    </div>
                                    <span className="text-[11px] font-bold tracking-tight">{seller.phone}</span>
                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="grid grid-cols-2 gap-3 mt-8">
                                <button
                                    onClick={() => handleOpenModal(seller)}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-black font-black uppercase text-[9px] tracking-widest transition-all border border-primary/10"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    Ver Perfil
                                </button>
                                {seller.role !== 'SuperAdmin' && (
                                    <button
                                        onClick={() => handleDelete(seller.id)}
                                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-black font-black uppercase text-[9px] tracking-widest transition-all border border-rose-500/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Stats View */
                <div className="space-y-6">
                    {filteredSellers.map((seller) => (
                        <div key={seller.id} className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center hover:border-primary/20 transition-all shadow-2xl relative group">
                            <div className="lg:col-span-4 flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-xl font-black text-primary/40 group-hover:bg-primary group-hover:text-black transition-all">
                                    {seller.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase italic tracking-tighter group-hover:text-primary transition-colors">{seller.name}</h3>
                                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mt-0.5 italic">{seller.role}</p>
                                </div>
                                <div className="ml-auto lg:hidden bg-primary/10 px-3 py-1 rounded-full">
                                    <span className="text-[9px] font-black text-primary uppercase">KPI 100%</span>
                                </div>
                            </div>

                            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {[
                                    { label: 'Cotizaciones', val: '0', color: 'text-sky-400', bg: 'bg-sky-400/5' },
                                    { label: 'Vistas', val: '0%', sub: '0 de 0', color: 'text-white/40', bg: 'bg-white/5' },
                                    { label: 'Ganadas', val: '0', sub: '0% de cierre', color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
                                    { label: 'Pipeline', val: '$0', sub: 'en progreso', color: 'text-amber-500', bg: 'bg-amber-500/5' },
                                    { label: 'Contratos', val: '0', sub: 'este mes', color: 'text-primary', bg: 'bg-primary/5' },
                                    { label: 'Comisión', val: '$0', sub: '$0 este mes', color: 'text-rose-400', bg: 'bg-rose-400/5' }
                                ].map((kpi) => (
                                    <div key={kpi.label} className={clsx("p-4 rounded-2xl flex flex-col items-center justify-center border border-white/5 transition-all hover:scale-105", kpi.bg)}>
                                        <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">{kpi.label}</p>
                                        <p className={clsx("text-sm font-black italic tracking-tighter", kpi.color)}>{kpi.val}</p>
                                        {kpi.sub && <p className="text-[7px] font-black text-white/10 uppercase tracking-tighter mt-1">{kpi.sub}</p>}
                                    </div>
                                ))}
                            </div>

                            <div className="hidden lg:block absolute top-6 right-8">
                                <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> Hace 2 min
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
                    <div className="bg-[#0a0a0b] border border-white/10 w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">
                                {editingSeller ? 'Editar Perfil' : 'Nuevo Miembro'}
                            </h2>
                            <X className="w-8 h-8 text-white/20 cursor-pointer hover:text-white transition-colors" onClick={() => setIsModalOpen(false)} />
                        </div>

                        <div className="p-10 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            {/* Avatar Section */}
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative group">
                                    <div className="w-28 h-28 rounded-[2.5rem] overflow-hidden border-4 border-primary/20 bg-white/5 shadow-2xl transition-all group-hover:border-primary/50">
                                        {form.avatar ? (
                                            <img src={form.avatar} className="w-full h-full object-cover" alt="Profile" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                                <User className="w-10 h-10 text-primary" />
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute -right-2 -bottom-2 bg-primary text-black p-3 rounded-2xl cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-all">
                                        <Camera className="w-5 h-5" />
                                        <input
                                            type="text"
                                            placeholder="URL de imagen"
                                            className="hidden"
                                            onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                                        />
                                        {/* Mocking upload with prompt for now as it's a frontend demo */}
                                        <button
                                            className="absolute inset-0 opacity-0"
                                            onClick={() => {
                                                const url = prompt('Ingresa la URL de la foto de perfil:');
                                                if (url) setForm({ ...form, avatar: url });
                                            }}
                                        />
                                    </label>
                                </div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Configuración de Identidad</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-white/30 uppercase ml-2">Nombre Completo</p>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                        <input
                                            type="text"
                                            placeholder="Ej: Roberto Gómez"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white font-bold outline-none focus:border-primary transition-all shadow-inner"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-white/30 uppercase ml-2">Username @</p>
                                    <input
                                        type="text"
                                        placeholder="roberto.g"
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-primary transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-white/30 uppercase ml-2">Email Corporativo</p>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                    <input
                                        type="email"
                                        placeholder="nombre@arteconcreto.co"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white font-bold outline-none focus:border-primary transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-white/30 uppercase ml-2">Rol de Acceso</p>
                                    <select
                                        value={form.role}
                                        onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-primary appearance-none shadow-inner"
                                    >
                                        <option value="Vendedor" className="bg-[#0a0a0b]">Vendedor Senior</option>
                                        <option value="Manager" className="bg-[#0a0a0b]">Manager Operativo</option>
                                        <option value="SuperAdmin" className="bg-[#0a0a0b]">Super Admin</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-white/30 uppercase ml-2">Contraseña de Acceso</p>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 py-4 text-white font-bold outline-none focus:border-primary transition-all shadow-inner"
                                        />
                                        <button
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-primary transition-colors text-white/20"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 border-t border-white/5 flex gap-4 bg-white/[0.01]">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-5 rounded-2xl border border-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleSave} className="flex-1 bg-primary text-black font-black px-4 py-5 rounded-2xl shadow-2xl shadow-primary/20 uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
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
