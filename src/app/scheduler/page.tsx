"use client";

import React, { useState, useRef } from 'react';
import {
    Plus,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin,
    User,
    Calendar as CalendarIcon,
    Video,
    Truck,
    X,
    Users,
    Mail,
    Globe,
    Shield,
    Link as LinkIcon,
    Send,
    CheckCircle2,
    Search,
    Upload
} from 'lucide-react';
import { clsx } from 'clsx';

const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

import { useApp, CalendarEvent, Invitee } from '@/context/AppContext';

export default function SchedulerPage() {
    const { clients, sellers, events, addEvent, addNotification } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [form, setForm] = useState({
        title: '',
        date: '2026-02-25',
        time: '10:00',
        type: 'meeting' as CalendarEvent['type'],
        invitees: [] as Invitee[],
        meetingLink: '',
        description: ''
    });

    const [externalEmail, setExternalEmail] = useState('');

    const toggleInvitee = (person: any, type: Invitee['type']) => {
        const inviteeId = person.id;
        const exists = form.invitees.find(i => i.id === inviteeId);

        if (exists) {
            setForm(prev => ({ ...prev, invitees: prev.invitees.filter(i => i.id !== inviteeId) }));
        } else {
            setForm(prev => ({
                ...prev,
                invitees: [...prev.invitees, { id: person.id, name: person.name, email: person.email, type }]
            }));
        }
    };

    const addExternal = () => {
        if (!externalEmail.includes('@')) return;
        const newInvitee: Invitee = {
            id: `ext-${Date.now()}`,
            name: externalEmail.split('@')[0],
            email: externalEmail,
            type: 'externo'
        };
        setForm(prev => ({ ...prev, invitees: [...prev.invitees, newInvitee] }));
        setExternalEmail('');
    };

    const generateMeetLink = () => {
        setIsGeneratingLink(true);
        setTimeout(() => {
            const randomCode = Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5);
            setForm(prev => ({ ...prev, meetingLink: `https://meet.google.com/${randomCode}` }));
            setIsGeneratingLink(false);
        }, 1500);
    };

    const handleSave = () => {
        const newEvent: CalendarEvent = {
            ...form,
            id: Date.now().toString(),
            client: form.invitees[0]?.name || 'Interno',
        };
        addEvent(newEvent);
        setIsModalOpen(false);
        // Reset form
        setForm({
            title: '',
            date: '2026-02-25',
            time: '10:00',
            type: 'meeting',
            invitees: [],
            meetingLink: '',
            description: ''
        });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

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

                const values = [];
                let inQuotes = false;
                let currentValue = '';
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"' && line[j + 1] === '"') {
                        currentValue += '"'; j++;
                    } else if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(currentValue); currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                values.push(currentValue);

                if (values.length >= 4) {
                    const rawDateTime = values[0] || '';
                    const clientName = values[1] || 'Sin Cliente';
                    const email = values[2] || '';
                    const phone = values[3] || '';
                    const description = values[4] || '';

                    // Parse Date and Time reasonably well
                    let datePart = new Date().toISOString().split('T')[0];
                    let timePart = '12:00';

                    if (rawDateTime.includes(' ')) {
                        const parts = rawDateTime.split(' ');
                        datePart = parts[0];
                        timePart = parts[1].slice(0, 5); // Take hours and minutes
                    } else if (rawDateTime.includes(':')) {
                        timePart = rawDateTime.slice(0, 5);
                    } else if (rawDateTime.length > 0) {
                        datePart = rawDateTime;
                    }

                    addEvent({
                        title: `Reunión Importada: ${clientName}`,
                        date: datePart,
                        time: timePart,
                        type: 'meeting',
                        client: clientName,
                        description: description,
                        invitees: email ? [{
                            id: `ext-${Date.now()}-${i}`,
                            name: clientName,
                            email: email,
                            type: 'externo'
                        }] : []
                    });
                    importedCount++;
                }
            }

            addNotification({
                title: 'Agenda Actualizada',
                description: `Se importaron ${importedCount} citas.`,
                type: 'success'
            });

            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700" >
            {/* Header */}
            < div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" >
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-white">Agenda Operativa</h1>
                    <p className="text-sm text-muted-foreground font-medium">Gestiona visitas, entregas y reuniones con links de Meet automáticos.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button
                        onClick={handleImportClick}
                        className="bg-transparent border border-white/10 text-white font-black px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-white/5 active:scale-[0.98] transition-all"
                    >
                        <Upload className="w-5 h-5 font-black" />
                        <span>Importar Citas</span>
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary text-black font-black px-8 py-3 rounded-2xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(250,181,16,0.2)]"
                    >
                        <Plus className="w-5 h-5 font-black" />
                        <span>Agendar Evento</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Calendar View */}
                <div className="lg:col-span-8">
                    <div className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-sm">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-3">
                                <CalendarIcon className="text-primary" />
                                Febrero 2026
                            </h2>
                            <div className="flex items-center gap-3">
                                <button className="p-3 hover:bg-white/5 rounded-xl border border-white/10 transition-all text-white/40 hover:text-white">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button className="p-3 bg-white/5 text-white/40 border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest px-6">Hoy</button>
                                <button className="p-3 hover:bg-white/5 rounded-xl border border-white/10 transition-all text-white/40 hover:text-white">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-0">
                            <div className="grid grid-cols-7 border-b border-white/5 text-white">
                                {days.map(day => (
                                    <div key={day} className="py-6 text-center text-[11px] font-black uppercase text-white/20 tracking-[0.2em]">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 grid-rows-5 h-[700px]">
                                {Array.from({ length: 35 }).map((_, i) => (
                                    <div key={i} className={clsx(
                                        "p-4 border-r border-b border-white/5 last:border-r-0 relative group transition-all hover:bg-white/[0.02] cursor-pointer",
                                        i === 24 ? "bg-primary/[0.03]" : ""
                                    )}>
                                        <span className={clsx(
                                            "text-xs font-black w-7 h-7 flex items-center justify-center rounded-xl mb-3 transition-all",
                                            i === 24 ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-white/10 group-hover:text-white/40"
                                        )}>
                                            {i - 4 < 1 || i - 4 > 28 ? "" : i - 4}
                                        </span>
                                        {/* No hardcoded events */}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agenda Sidebar */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Video className="w-24 h-24 text-primary" />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-primary mb-8 border-l-4 border-primary pl-4">Próximas Sesiones</h3>
                        <div className="space-y-6">
                            {events.map((event) => (
                                <div key={event.id} className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl space-y-4 relative group hover:border-white/20 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "p-2 rounded-xl",
                                                event.type === 'visit' ? "bg-primary/10 text-primary" :
                                                    event.type === 'meeting' ? "bg-emerald-500/10 text-emerald-500" : "bg-sky-500/10 text-sky-500"
                                            )}>
                                                {event.type === 'visit' ? <Truck className="w-4 h-4" /> :
                                                    event.type === 'meeting' ? <Video className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{event.time}</span>
                                                <h4 className="text-sm font-black text-white group-hover:text-primary transition-colors">{event.title}</h4>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-white/40 font-bold">
                                        <User className="w-3 h-3" />
                                        {event.client}
                                    </div>

                                    {event.meetingLink && (
                                        <a
                                            href={event.meetingLink}
                                            target="_blank"
                                            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20"
                                        >
                                            <Video className="w-4 h-4" />
                                            Entrar a Meet
                                        </a>
                                    )}

                                    {event.invitees.length > 0 && (
                                        <div className="pt-2 flex -space-x-2">
                                            {event.invitees.slice(0, 3).map((inv, idx) => (
                                                <div key={idx} className="w-7 h-7 rounded-full bg-white/10 border-2 border-[#0a0a0b] flex items-center justify-center text-[9px] font-black text-white uppercase" title={inv.name}>
                                                    {inv.name.charAt(0)}
                                                </div>
                                            ))}
                                            {event.invitees.length > 3 && (
                                                <div className="w-7 h-7 rounded-full bg-white/5 border-2 border-[#0a0a0b] flex items-center justify-center text-[9px] font-black text-white/40">
                                                    +{event.invitees.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Agendar Evento Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-[#0a0a0b] border border-white/10 w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 flex flex-col md:flex-row h-[85vh]">
                        {/* Left Side: Form */}
                        <div className="flex-1 p-12 overflow-y-auto space-y-10 custom-scrollbar">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-black text-white tracking-tighter">Agendar Sesión</h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
                                    <X className="w-6 h-6 text-white/20 hover:text-white" />
                                </button>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] pl-1">Título del Evento</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="Ej: Revisión de Diseño - Parque del Río"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] pl-1">Fecha</label>
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] pl-1">Hora</label>
                                        <input
                                            type="time"
                                            value={form.time}
                                            onChange={(e) => setForm({ ...form, time: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="p-8 bg-white/[0.02] border border-white/10 rounded-[2.5rem] space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                                <Video className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-[11px] font-black uppercase tracking-widest text-white">Google Meet</h4>
                                                <p className="text-[10px] text-white/40">Generar link automático para los invitados.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={generateMeetLink}
                                            disabled={isGeneratingLink}
                                            className={clsx(
                                                "px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                                form.meetingLink ? "bg-emerald-500 text-black" : "bg-white/5 text-white/40 hover:bg-white/10 border border-white/10"
                                            )}
                                        >
                                            {isGeneratingLink ? 'Generando...' : form.meetingLink ? 'Link Generado' : 'Activar Meet'}
                                        </button>
                                    </div>
                                    {form.meetingLink && (
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <LinkIcon className="w-4 h-4 text-emerald-500" />
                                                <span className="text-xs text-white/60 font-mono truncate">{form.meetingLink}</span>
                                            </div>
                                            <button className="text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Copiar</button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] pl-1">Lista de Invitados ({form.invitees.length})</label>
                                    <div className="flex flex-wrap gap-2">
                                        {form.invitees.map((inv) => (
                                            <div key={inv.id} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 group">
                                                {inv.type === 'vendedor' ? <Shield className="w-3 h-3 text-primary" /> :
                                                    inv.type === 'lead' ? <User className="w-3 h-3 text-primary" /> : <Globe className="w-3 h-3 text-primary" />}
                                                <span className="text-[10px] font-black text-primary uppercase">{inv.name}</span>
                                                <button
                                                    onClick={() => setForm(prev => ({ ...prev, invitees: prev.invitees.filter(i => i.id !== inv.id) }))}
                                                    className="hover:text-rose-500 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {form.invitees.length === 0 && (
                                            <div className="text-[10px] text-white/20 font-bold py-2">No has seleccionado invitados aún.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Search & Directory */}
                        <div className="w-full md:w-[400px] border-l border-white/10 bg-[#0a0a0b] p-10 flex flex-col h-full">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30 mb-8">Directorio & Invitaciones</h3>

                            <div className="relative mb-8">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                <input
                                    type="text"
                                    placeholder="Buscar prospecto o equipo..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:border-primary/50 outline-none transition-all"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar">
                                {/* External Invitations */}
                                <div className="space-y-4">
                                    <h4 className="text-[9px] font-black uppercase text-white/20 tracking-widest pl-2">Externo (Otra Empresa)</h4>
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            placeholder="correo@empresa.com"
                                            value={externalEmail}
                                            onChange={(e) => setExternalEmail(e.target.value)}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white focus:border-primary/50 outline-none transition-all"
                                        />
                                        <button
                                            onClick={addExternal}
                                            className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-all"
                                        >
                                            <Plus className="w-4 h-4 text-primary" />
                                        </button>
                                    </div>
                                </div>

                                {/* Sellers */}
                                <div className="space-y-4">
                                    <h4 className="text-[9px] font-black uppercase text-white/20 tracking-widest pl-2">Equipo Comercial</h4>
                                    <div className="space-y-2">
                                        {sellers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(seller => (
                                            <button
                                                key={seller.id}
                                                onClick={() => toggleInvitee(seller, 'vendedor')}
                                                className={clsx(
                                                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                                                    form.invitees.find(i => i.id === seller.id) ? "bg-primary/10 border-primary/50" : "bg-white/[0.02] border-white/5 hover:border-white/10"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white">
                                                        {seller.name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-white">{seller.name}</span>
                                                        <span className="text-[9px] font-bold text-white/30 uppercase">{seller.role}</span>
                                                    </div>
                                                </div>
                                                {form.invitees.find(i => i.id === seller.id) && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Leads */}
                                <div className="space-y-4 pb-10">
                                    <h4 className="text-[9px] font-black uppercase text-white/20 tracking-widest pl-2">Prospectos / Clientes</h4>
                                    <div className="space-y-2">
                                        {clients.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).map(lead => (
                                            <button
                                                key={lead.id}
                                                onClick={() => toggleInvitee(lead, 'lead')}
                                                className={clsx(
                                                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                                                    form.invitees.find(i => i.id === lead.id) ? "bg-primary/10 border-primary/50" : "bg-white/[0.02] border-white/5 hover:border-white/10"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">
                                                        {lead.company ? lead.company.charAt(0) : lead.name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-white">{lead.name}</span>
                                                        <span className="text-[9px] font-bold text-white/30 truncate max-w-[150px]">{lead.company}</span>
                                                    </div>
                                                </div>
                                                {form.invitees.find(i => i.id === lead.id) && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={!form.title || form.invitees.length === 0}
                                className="mt-8 bg-primary text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                <Send className="w-5 h-5" />
                                <span>Agendar e Invitar</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
