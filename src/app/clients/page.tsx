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
    const [viewMode, setViewMode] = useState<'grid'|'list'>('list');
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

        const isAdminUser = ctxUser?.role === 'SuperAdmin' || ctxUser?.role === 'Admin';

        const clientData: Omit<Client, 'id'> = {
            ...newClientForm,
            value: '$0',
            ltv: 0,
            lastContact: 'Recién registrado',
            score: 75, // Default score
            registrationDate: new Date().toISOString().split('T')[0],
            ...((!isAdminUser && ctxUser) ? {
                assignedTo: ctxUser.id,
                assignedToName: ctxUser.name,
            } : {}),
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
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="page-title">Directorio</h1>
                    <p className="page-subtitle">Gestión centralizada de socios industriales.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    {canExport && (
                        <button
                            onClick={handleExport}
                            className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Exportar</span>
                            <span className="sm:hidden">Exportar Clientes</span>
                        </button>
                    )}
                    <button
                        onClick={handleImportClick}
                        className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <Upload className="w-4 h-4" />
                        <span className="hidden sm:inline">Importar</span>
                        <span className="sm:hidden">Importar Clientes</span>
                    </button>
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button
                        onClick={() => setIsNewClientModalOpen(true)}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Registrar</span>
                    </button>
                </div>
            </div>

            {/* Search & View Controls */}
            <div className="bg-white border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-1 bg-muted border border-border rounded-xl p-1">
                    <button
                        onClick={() => setViewMode('list')}
                        className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                            viewMode === 'list' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        Lista
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                            viewMode === 'grid' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        Tarjetas
                    </button>
                </div>
                <button
                    onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                    className={clsx(
                        'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all border',
                        isAdvancedFiltersOpen
                            ? 'bg-primary text-black border-primary shadow-[0_2px_8px_rgba(250,181,16,0.3)]'
                            : 'bg-white border-border text-foreground hover:bg-muted'
                    )}
                >
                    <Filter className="w-4 h-4" />
                    <span>Filtros</span>
                </button>
            </div>

            {/* Advanced Filters Panel */}
            {isAdvancedFiltersOpen && (
                <div className="surface-card p-5 space-y-5 animate-in slide-in-from-top-4 duration-300">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filtros avanzados</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        {/* LTV Range */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Rango LTV</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                    value={filters.minLtv}
                                    onChange={(e) => setFilters({ ...filters, minLtv: e.target.value })}
                                />
                                <span className="text-muted-foreground text-xs">-</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                    value={filters.maxLtv}
                                    onChange={(e) => setFilters({ ...filters, maxLtv: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* City Filter */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Ciudad / Región</label>
                            <SearchableSelect
                                options={settings.cities}
                                value={filters.city}
                                onChange={(val) => setFilters({ ...filters, city: val })}
                                placeholder="Todas las ciudades"
                            />
                        </div>

                        {/* Lead Score Slider */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground">Min. Lead Score</label>
                                <span className="text-xs font-bold text-primary">{filters.minScore} pts</span>
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
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Sector Industrial</label>
                            <select
                                className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white transition-all appearance-none"
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

                    <div className="pt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-t border-border">
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
                                            filters.status.includes(s.value) ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                                        )}
                                    >
                                        {filters.status.includes(s.value) && <BadgeCheck className="w-3 h-3 text-black" />}
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{s.label}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setFilters({ minLtv: "", maxLtv: "", status: [], city: "", category: "", minScore: 0, startDate: "", endDate: "" })}
                                className="text-xs font-medium text-muted-foreground hover:text-rose-500 transition-colors"
                            >
                                Limpiar Filtros
                            </button>
                            <button
                                onClick={() => setIsAdvancedFiltersOpen(false)}
                                className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors text-xs"
                            >
                                Aplicar Filtros
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Grid/List Layout */}
            <div className={clsx('pb-20', viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6' : 'space-y-2')}>
                {sortedAndFilteredClients.map((client) => {
                    const clientQuotes = quotes.filter(q => q.clientId === client.id);
                    const openQuotes = clientQuotes.filter(q => q.status === 'Sent' || q.status === 'Draft');

                    if (viewMode === 'list') {
                        return (
                            <div key={client.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                    {client.name.split(' ').map((n:string) => n[0]).join('').slice(0,2).toUpperCase()}
                                </div>
                                {/* Name + email */}
                                <div className="flex-1 min-w-0">
                                    <Link href={`/leads/${client.id}`}>
                                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{client.name}</p>
                                    </Link>
                                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                                </div>
                                {/* Company */}
                                <div className="hidden md:block w-32 shrink-0">
                                    <p className="text-xs font-medium text-muted-foreground truncate">{client.company}</p>
                                    <p className="text-xs text-muted-foreground/60">{client.city}</p>
                                    {client.assignedToName && (
                                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/10 mt-0.5 inline-block">
                                            {client.assignedToName}
                                        </span>
                                    )}
                                </div>
                                {/* Status + Source badges */}
                                <div className="hidden lg:flex items-center gap-1.5 w-44 shrink-0 flex-wrap">
                                    <span className={clsx(
                                        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold',
                                        client.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                                        client.status === 'Lead' ? 'bg-amber-50 text-amber-700' :
                                        'bg-slate-100 text-slate-500'
                                    )}>
                                        {client.status}
                                    </span>
                                    {client.source === 'WooCommerce' && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600">🛒 Web</span>
                                    )}
                                    {client.source === 'ConcreBot' && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-600">🤖 Bot</span>
                                    )}
                                    {(!client.source || client.source === 'Manual') && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-400">✏️ Manual</span>
                                    )}
                                    {openQuotes.length > 0 && <span className="text-xs font-bold text-primary">●</span>}
                                </div>
                                {/* Score */}
                                <div className="hidden lg:block w-16 shrink-0 text-center">
                                    <p className="text-sm font-bold text-foreground">{client.score || 0}</p>
                                    <p className="text-xs text-muted-foreground uppercase">score</p>
                                </div>
                                {/* Value */}
                                <div className="hidden xl:block w-28 shrink-0 text-right">
                                    <p className="text-sm font-bold text-primary">{formatCurrency(client.ltv)}</p>
                                    <p className="text-xs text-muted-foreground">{clientQuotes.length} cotiz.</p>
                                </div>
                                {/* Actions */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => window.open(`https://wa.me/${client.phone?.replace(/\D/g,'')}`, '_blank')} className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all border border-emerald-100">
                                        <MessageSquare className="w-3.5 h-3.5"/>
                                    </button>
                                    <Link href={`/leads/${client.id}`} className="p-2 rounded-lg bg-sky-50 hover:bg-sky-500 text-sky-600 hover:text-white transition-all border border-sky-100">
                                        <ExternalLink className="w-3.5 h-3.5"/>
                                    </Link>
                                </div>
                            </div>
                        );
                    }

                    // Grid view card
                    return (
                        <div key={client.id} className="bg-white border border-border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col">
                            {/* Propuesta Abierta Badge */}
                            {openQuotes.length > 0 && (
                                <div className="absolute top-0 right-8">
                                    <div className="bg-primary/10 border-x border-b border-primary/20 px-3 py-1 rounded-b-lg animate-in slide-in-from-top-2 duration-700">
                                        <span className="text-xs font-bold text-primary uppercase tracking-wide">Propuesta Abierta</span>
                                    </div>
                                </div>
                            )}

                            {/* Card Header: Initials + Main Info */}
                            <div className="flex items-center gap-4 mt-3">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-base font-bold text-primary group-hover:scale-110 transition-transform">
                                    {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/leads/${client.id}`}>
                                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{client.name}</h3>
                                    </Link>
                                    <div className="flex items-center gap-1.5 mt-0.5 truncate text-muted-foreground">
                                        <Mail className="w-3 h-3" />
                                        <p className="text-xs truncate">{client.email}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info Row */}
                            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                                        <Phone className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate">{client.phone}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                                        <MapPin className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate">{client.city}</span>
                                </div>
                            </div>

                            {/* Stats Panel */}
                            <div className="mt-4 py-4 rounded-xl bg-muted border border-border">
                                <div className="px-4">
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Volumen de Proyectos (COP)</p>
                                    <p className="text-sm font-bold text-primary">{formatCurrency(client.ltv)}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{clientQuotes.length} {clientQuotes.length === 1 ? 'propuesta generada' : 'propuestas generadas'}</p>
                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="grid grid-cols-3 gap-2 mt-4">
                                <button
                                    onClick={() => window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}`, '_blank')}
                                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white font-medium text-xs transition-all border border-emerald-100"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    WhatsApp
                                </button>
                                <Link href={`/leads/${client.id}`} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-500 text-sky-600 hover:text-white font-medium text-xs transition-all border border-sky-100">
                                    <Clock className="w-3.5 h-3.5" />
                                    Historial
                                </Link>
                                <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white hover:bg-muted text-muted-foreground hover:text-foreground font-medium text-xs transition-all border border-border">
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
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                    <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h2 className="text-lg font-bold text-foreground">Registrar Nuevo Socio</h2>
                            <button onClick={() => setIsNewClientModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Nombre del Contacto</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Ej: Carlos Mendoza"
                                            value={newClientForm.name}
                                            onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Empresa / Entidad</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Ej: Constructora Bolívar"
                                            value={newClientForm.company}
                                            onChange={(e) => setNewClientForm({ ...newClientForm, company: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Email Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="email"
                                            placeholder="c.mendoza@empresa.com"
                                            value={newClientForm.email}
                                            onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Teléfono / WhatsApp</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="+57 321..."
                                            value={newClientForm.phone}
                                            onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div>
                                    <SearchableSelect
                                        options={settings.cities}
                                        value={newClientForm.city}
                                        onChange={(val) => setNewClientForm({ ...newClientForm, city: val })}
                                        label="Ubicación"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Sector</label>
                                    <select
                                        value={newClientForm.category}
                                        onChange={(e) => setNewClientForm({ ...newClientForm, category: e.target.value })}
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white transition-all appearance-none"
                                    >
                                        {settings.sectors.map(sector => (
                                            <option key={sector} value={sector}>{sector}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Estado Inicial</label>
                                    <select
                                        value={newClientForm.status}
                                        onChange={(e) => setNewClientForm({ ...newClientForm, status: e.target.value as any })}
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white transition-all appearance-none"
                                    >
                                        <option value="Active">Activo</option>
                                        <option value="Lead">Lead Nuevo</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
                            <button
                                onClick={() => setIsNewClientModalOpen(false)}
                                className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateClient}
                                disabled={!newClientForm.name || !newClientForm.company}
                                className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
