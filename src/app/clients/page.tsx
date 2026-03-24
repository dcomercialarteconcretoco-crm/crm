"use client";

import React, { useMemo, useRef, useState } from 'react';
import {
    Search,
    Plus,
    Filter,
    MoreVertical,
    Mail,
    Phone,
    ExternalLink,
    Building2,
    BadgeCheck,
    User,
    X,
    CheckCircle2,
    Briefcase,
    MapPin,
    Trophy,
    Download,
    Upload,
    Clock,
    MessageSquare,
    Edit2
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import { useApp, Client } from '@/context/AppContext';
import SearchableSelect from '@/components/SearchableSelect';

export default function ClientsPage() {
    const { clients, addClient, addNotification, settings, sellers, quotes, currentUser: ctxUser } = useApp();
    const [searchTerm, setSearchTerm] = useState("");
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentUser = ctxUser || sellers[0];
    const userIsSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';
    const canExport = userIsSuperAdmin && settings.allowExports;

    // Form state for new client
    const [newClientForm, setNewClientForm] = useState({
        name: '',
        company: '',
        email: '',
        phone: '',
        city: settings.cities[0]?.name || 'Bogotá',
        category: settings.sectors[0] || 'Infraestructura',
        status: 'Active' as 'Active' | 'Lead' | 'Inactive'
    });

    const [filters, setFilters] = useState({
        minLtv: "",
        maxLtv: "",
        status: [] as string[],
        city: "",
        category: "",
        minScore: 0,
        startDate: "",
        endDate: ""
    });

    const [sortConfig, setSortConfig] = useState<{ key: keyof Client | null, direction: 'asc' | 'desc' }>({
        key: 'name',
        direction: 'asc'
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    };

    const handleSort = (key: keyof Client) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleCreateClient = () => {
        if (!newClientForm.name || !newClientForm.company) return;

        const clientData: Omit<Client, 'id'> = {
            ...newClientForm,
            value: '$0',
            ltv: 0,
            lastContact: 'Recién registrado',
            score: 75, // Default score
            registrationDate: new Date().toISOString().split('T')[0]
        };

        const id = addClient(clientData);

        addNotification({
            title: 'Cliente Registrado',
            description: `${newClientForm.name} de ${newClientForm.company} se ha añadido al directorio industrial.`,
            type: 'success'
        });

        setIsNewClientModalOpen(false);
        setNewClientForm({
            name: '',
            company: '',
            email: '',
            phone: '',
            city: settings.cities[0]?.name || 'Bogotá',
            category: settings.sectors[0] || 'Infraestructura',
            status: 'Active'
        });
    };

    const handleExport = () => {
        if (!canExport) {
            addNotification({ title: 'Acceso Denegado', description: 'Por seguridad, solo el SuperAdmin puede exportar esta tabla.', type: 'alert' });
            return;
        }

        if (clients.length === 0) {
            addNotification({ title: 'Error', description: 'No hay clientes para exportar.', type: 'alert' });
            return;
        }

        const headers = ['Nombre', 'Empresa', 'Email', 'Telefono', 'Ciudad', 'Categoria', 'Estado', 'Score', 'LTV', 'Fecha de Registro', 'Ultimo Contacto'];
        const rows = clients.map(client => [
            `"${client.name.replace(/"/g, '""')}"`,
            `"${client.company.replace(/"/g, '""')}"`,
            `"${client.email.replace(/"/g, '""')}"`,
            `"${client.phone.replace(/"/g, '""')}"`,
            `"${client.city.replace(/"/g, '""')}"`,
            `"${client.category}"`,
            `"${client.status}"`,
            client.score,
            client.ltv,
            `"${client.registrationDate}"`,
            `"${client.lastContact}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes.csv`;
        a.click();
        URL.revokeObjectURL(url);

        addNotification({ title: 'Exportación Exitosa', description: `Se exportaron ${clients.length} clientes.`, type: 'success' });
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

                if (values.length >= 2) {
                    const clientData: Omit<Client, 'id'> = {
                        name: values[0] || 'Desconocido',
                        company: values[1] || 'Empresa Desconocida',
                        email: values[2] || '',
                        phone: values[3] || '',
                        city: values[4] || settings.cities[0]?.name || 'Bogotá',
                        category: values[5] || settings.sectors[0] || 'Infraestructura',
                        status: (values[6] as 'Active' | 'Lead' | 'Inactive') || 'Lead',
                        score: parseInt(values[7]) || 75,
                        ltv: parseInt(values[8]) || 0,
                        registrationDate: values[9] || new Date().toISOString().split('T')[0],
                        lastContact: values[10] || 'Recién importado',
                        value: '$0'
                    };
                    addClient(clientData);
                    importedCount++;
                }
            }

            addNotification({ title: 'Importación Exitosa', description: `Se importaron ${importedCount} clientes.`, type: 'success' });
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const sortedAndFilteredClients = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return [...clients]
            .filter(client => {
                const matchesSearch = normalizedSearch.length === 0 ||
                    client.name.toLowerCase().includes(normalizedSearch) ||
                    client.company.toLowerCase().includes(normalizedSearch) ||
                    client.email.toLowerCase().includes(normalizedSearch);
                if (!matchesSearch) return false;
                if (filters.minLtv && client.ltv < parseInt(filters.minLtv)) return false;
                if (filters.maxLtv && client.ltv > parseInt(filters.maxLtv)) return false;
                if (filters.city && client.city !== filters.city) return false;
                if (filters.category && client.category !== filters.category) return false;
                if (filters.minScore > 0 && client.score < filters.minScore) return false;
                if (filters.status.length > 0 && !filters.status.includes(client.status)) return false;
                if (filters.startDate && new Date(client.registrationDate) < new Date(filters.startDate)) return false;
                if (filters.endDate && new Date(client.registrationDate) > new Date(filters.endDate)) return false;

                return true;
            })
            .sort((a, b) => {
                if (!sortConfig.key) return 0;
                const aValue = a[sortConfig.key] ?? '';
                const bValue = b[sortConfig.key] ?? '';

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
    }, [clients, filters, searchTerm, sortConfig]);

    const SortIndicator = ({ column }: { column: keyof Client }) => {
        if (sortConfig.key !== column) return <div className="w-3 h-3 opacity-10 group-hover:opacity-30 ml-auto transition-opacity"><MoreVertical className="w-full h-full" /></div>;
        return (
            <div className="ml-auto text-primary animate-in zoom-in duration-300">
                {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </div>
        );
    };

    return (
        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 px-4 lg:px-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-foreground italic uppercase">Directorio</h1>
                    <p className="text-muted-foreground text-[10px] lg:text-sm font-medium uppercase tracking-[0.2em] lg:normal-case lg:tracking-normal mt-1">Gestión centralizada de socios industriales.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    {canExport && (
                        <button
                            onClick={handleExport}
                            className="bg-card text-foreground border border-border/40 font-black px-6 lg:px-6 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 hover:bg-muted/30 hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto text-[10px] lg:text-xs uppercase tracking-widest"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Exportar</span>
                            <span className="sm:hidden">Exportar Clientes</span>
                        </button>
                    )}
                    <button
                        onClick={handleImportClick}
                        className="bg-card text-foreground border border-border/40 font-black px-6 lg:px-6 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 hover:bg-muted/30 hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto text-[10px] lg:text-xs uppercase tracking-widest"
                    >
                        <Upload className="w-4 h-4" />
                        <span className="hidden sm:inline">Importar</span>
                        <span className="sm:hidden">Importar Clientes</span>
                    </button>
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button
                        onClick={() => setIsNewClientModalOpen(true)}
                        className="bg-primary text-black font-black px-6 lg:px-8 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 w-full sm:w-auto text-[10px] lg:text-xs uppercase tracking-widest"
                    >
                        <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
                        <span>Registrar</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="lg:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        className="w-full bg-card border border-border/40 rounded-xl lg:rounded-2xl pl-11 pr-4 py-3.5 lg:py-4 text-sm focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30 font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                    className={clsx(
                        "flex items-center justify-center gap-2 border rounded-xl lg:rounded-2xl px-6 py-3.5 lg:py-4 text-[10px] lg:text-sm font-black uppercase tracking-widest transition-all",
                        isAdvancedFiltersOpen ? "bg-primary text-black border-primary shadow-lg shadow-primary/10" : "bg-card border-border/40 hover:bg-muted/30"
                    )}
                >
                    <Filter className="w-4 h-4" />
                    <span>Filtros</span>
                </button>
            </div>

            {/* Advanced Filters Panel */}
            {isAdvancedFiltersOpen && (
                <div className="bg-card/85 border border-white/70 rounded-[2rem] lg:rounded-3xl p-5 lg:p-8 space-y-6 lg:space-y-8 animate-in slide-in-from-top-4 duration-300 shadow-[0_24px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 lg:gap-8">
                        {/* LTV Range */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Rango LTV (Misión)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    className="w-full bg-white/50 border border-white/75 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary transition-all text-foreground font-bold placeholder:text-muted-foreground"
                                    value={filters.minLtv}
                                    onChange={(e) => setFilters({ ...filters, minLtv: e.target.value })}
                                />
                                <span className="text-muted-foreground text-xs">-</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    className="w-full bg-white/50 border border-white/75 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary transition-all text-foreground font-bold placeholder:text-muted-foreground"
                                    value={filters.maxLtv}
                                    onChange={(e) => setFilters({ ...filters, maxLtv: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* City Filter */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Ciudad / Región</label>
                            <SearchableSelect
                                options={settings.cities}
                                value={filters.city}
                                onChange={(val) => setFilters({ ...filters, city: val })}
                                placeholder="Todas las ciudades"
                            />
                        </div>

                        {/* Lead Score Slider */}
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Min. Lead Score</label>
                                <span className="text-[10px] font-black text-primary">{filters.minScore} pts</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                                value={filters.minScore}
                                onChange={(e) => setFilters({ ...filters, minScore: parseInt(e.target.value) })}
                            />
                        </div>

                        {/* Category Selector */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Sector Industrial</label>
                            <select
                                className="w-full bg-white/50 border border-white/75 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary transition-all appearance-none text-foreground font-bold"
                                value={filters.category}
                                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                            >
                                <option value="">Todos los sectores</option>
                                {settings.sectors.map(sector => (
                                    <option key={sector} value={sector}>{sector}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-t border-border/40">
                        <div className="flex flex-wrap gap-4">
                            {[{ value: 'Active', label: 'Activo' }, { value: 'Lead', label: 'Lead' }, { value: 'Inactive', label: 'Inactivo' }].map((s) => (
                                <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
                                    <div
                                        onClick={() => {
                                            const newStatus = filters.status.includes(s.value)
                                                ? filters.status.filter(item => item !== s.value)
                                                : [...filters.status, s.value];
                                            setFilters({ ...filters, status: newStatus });
                                        }}
                                        className={clsx(
                                            "w-4 h-4 rounded border transition-all flex items-center justify-center",
                                            filters.status.includes(s.value) ? "bg-primary border-primary" : "border-border/60 group-hover:border-primary/50"
                                        )}
                                    >
                                        {filters.status.includes(s.value) && <BadgeCheck className="w-3 h-3 text-black" />}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{s.label}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setFilters({ minLtv: "", maxLtv: "", status: [], city: "", category: "", minScore: 0, startDate: "", endDate: "" })}
                                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 transition-colors"
                            >
                                Limpiar Filtros
                            </button>
                            <button
                                onClick={() => setIsAdvancedFiltersOpen(false)}
                                className="bg-muted border border-border/40 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-muted/80 transition-all"
                            >
                                Aplicar Filtros
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-8 pb-20">
                {sortedAndFilteredClients.map((client) => {
                    const clientQuotes = quotes.filter(q => q.clientId === client.id);
                    const openQuotes = clientQuotes.filter(q => q.status === 'Sent' || q.status === 'Draft');
                    return (
                    <div key={client.id} className="surface-panel rounded-[1.9rem] lg:rounded-[2.5rem] p-5 lg:p-8 relative overflow-hidden group hover:border-primary/20 transition-all flex flex-col">
                        {/* Propuesta Abierta Badge — only when client has open/sent quotes */}
                        {openQuotes.length > 0 && (
                        <div className="absolute top-0 right-10">
                            <div className="bg-primary/10 border-x border-b border-primary/20 px-4 py-1.5 rounded-b-xl animate-in slide-in-from-top-2 duration-700">
                                <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">Propuesta Abierta</span>
                            </div>
                        </div>
                        )}

                        {/* Card Header: Initials + Main Info */}
                        <div className="flex items-center gap-4 lg:gap-5 mt-4">
                            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-[1.3rem] lg:rounded-[1.75rem] bg-primary/10 border border-primary/15 flex items-center justify-center text-lg lg:text-xl font-black text-primary group-hover:scale-110 transition-transform shadow-inner">
                                {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <Link href={`/leads/${client.id}`}>
                                    <h3 className="text-base font-black text-foreground uppercase group-hover:text-primary transition-colors truncate">{client.name}</h3>
                                </Link>
                                <div className="flex items-center gap-1.5 opacity-70 mt-1 truncate text-muted-foreground">
                                    <Mail className="w-3 h-3" />
                                    <p className="text-[10px] font-bold lowercase truncate">{client.email}</p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info Row */}
                        <div className="grid grid-cols-2 gap-3 lg:gap-4 mt-6 lg:mt-8 pt-6 lg:pt-8 border-t border-border/50">
                            <div className="flex items-center gap-3 group/item">
                                <div className="w-8 h-8 rounded-xl bg-white/50 border border-white/75 flex items-center justify-center text-muted-foreground group-hover/item:text-emerald-500 transition-colors">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-muted-foreground tracking-tighter truncate">{client.phone}</span>
                            </div>
                            <div className="flex items-center gap-3 group/item">
                                <div className="w-8 h-8 rounded-xl bg-white/50 border border-white/75 flex items-center justify-center text-muted-foreground group-hover/item:text-sky-500 transition-colors">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-muted-foreground tracking-tighter truncate">{client.city}</span>
                            </div>
                        </div>

                        {/* Stats Panel: Volumen Cotizado */}
                        <div className="mt-6 lg:mt-8 py-5 lg:py-6 rounded-[1.4rem] lg:rounded-[1.5rem] bg-white/42 border border-white/75 relative">
                            <div className="px-6">
                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Volumen de Proyectos (COP)</p>
                                <p className="text-sm font-black text-primary italic tracking-tighter">{formatCurrency(client.ltv)}</p>
                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter mt-1">{clientQuotes.length} {clientQuotes.length === 1 ? 'propuesta generada' : 'propuestas generadas'}</p>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="grid grid-cols-3 gap-2 lg:gap-3 mt-6 lg:mt-8">
                            <button
                                onClick={() => window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}`, '_blank')}
                                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black font-black uppercase text-[9px] tracking-widest transition-all border border-emerald-500/10"
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                WhatsApp
                            </button>
                            <Link href={`/leads/${client.id}`} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-sky-500/10 hover:bg-sky-500 text-sky-500 hover:text-black font-black uppercase text-[9px] tracking-widest transition-all border border-sky-500/10">
                                <Clock className="w-3.5 h-3.5" />
                                Historial
                            </Link>
                            <button className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/50 hover:bg-white text-muted-foreground hover:text-foreground font-black uppercase text-[9px] tracking-widest transition-all border border-white/75">
                                <Edit2 className="w-3.5 h-3.5" />
                                Editar
                            </button>
                        </div>
                    </div>
                    );
                })}
            </div>

            {/* New Client Modal */}
            {isNewClientModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(245,238,223,0.72)] backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-card/95 border border-white/80 w-full max-w-2xl rounded-[2.2rem] lg:rounded-[3rem] overflow-hidden shadow-[0_32px_80px_rgba(23,23,23,0.12)] flex flex-col animate-in zoom-in-95 duration-500">
                        <div className="p-6 lg:p-10 border-b border-border/60 flex items-center justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(250,243,228,0.82))]">
                            <h2 className="text-[1.8rem] lg:text-3xl font-black text-foreground italic tracking-tighter uppercase">Registrar Nuevo Socio</h2>
                            <X className="w-7 h-7 lg:w-8 lg:h-8 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => setIsNewClientModalOpen(false)} />
                        </div>

                        <div className="p-6 lg:p-10 space-y-6 lg:space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-primary uppercase ml-2 tracking-widest">Nombre del Contacto</p>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Ej: Carlos Mendoza"
                                            value={newClientForm.name}
                                            onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                                            className="w-full bg-white/60 border border-white/80 rounded-2xl pl-12 pr-4 py-4 text-foreground font-bold outline-none focus:border-primary transition-all placeholder:text-muted-foreground"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-primary uppercase ml-2 tracking-widest">Empresa / Entidad</p>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Ej: Constructora Bolívar"
                                            value={newClientForm.company}
                                            onChange={(e) => setNewClientForm({ ...newClientForm, company: e.target.value })}
                                            className="w-full bg-white/60 border border-white/80 rounded-2xl pl-12 pr-4 py-4 text-foreground font-bold outline-none focus:border-primary transition-all placeholder:text-muted-foreground"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase ml-2">Email Corporativo</p>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="email"
                                            placeholder="c.mendoza@empresa.com"
                                            value={newClientForm.email}
                                            onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                                            className="w-full bg-white/60 border border-white/80 rounded-2xl pl-12 pr-4 py-4 text-foreground font-bold outline-none focus:border-primary transition-all placeholder:text-muted-foreground"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase ml-2">Teléfono / WhatsApp</p>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="+57 321..."
                                            value={newClientForm.phone}
                                            onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                                            className="w-full bg-white/60 border border-white/80 rounded-2xl pl-12 pr-4 py-4 text-foreground font-bold outline-none focus:border-primary transition-all placeholder:text-muted-foreground"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-muted-foreground">
                                <div className="space-y-2">
                                    <SearchableSelect
                                        options={settings.cities}
                                        value={newClientForm.city}
                                        onChange={(val) => setNewClientForm({ ...newClientForm, city: val })}
                                        label="Ubicación"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase ml-2 text-muted-foreground">Sector</p>
                                    <select
                                        value={newClientForm.category}
                                        onChange={(e) => setNewClientForm({ ...newClientForm, category: e.target.value })}
                                        className="w-full bg-white/60 border border-white/80 rounded-2xl px-4 py-4 font-bold outline-none focus:border-primary appearance-none text-foreground"
                                    >
                                        {settings.sectors.map(sector => (
                                            <option key={sector} value={sector}>{sector}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase ml-2 text-muted-foreground">Estado Inicial</p>
                                    <select
                                        value={newClientForm.status}
                                        onChange={(e) => setNewClientForm({ ...newClientForm, status: e.target.value as any })}
                                        className="w-full bg-white/60 border border-white/80 rounded-2xl px-4 py-4 font-bold outline-none focus:border-primary appearance-none text-foreground"
                                    >
                                        <option value="Active">Activo</option>
                                        <option value="Lead">Lead Nuevo</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 lg:p-10 border-t border-border/60 flex gap-4 bg-white/[0.18]">
                            <button onClick={() => setIsNewClientModalOpen(false)} className="flex-1 px-4 py-5 rounded-2xl border border-white/80 text-foreground font-black uppercase text-[10px] tracking-widest hover:bg-white/60 transition-all">
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateClient}
                                disabled={!newClientForm.name || !newClientForm.company}
                                className="flex-1 bg-primary text-black font-black px-4 py-5 rounded-2xl shadow-2xl shadow-primary/20 uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-20"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Finalizar Registro
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
