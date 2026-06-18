"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Plus,
    Users,
    Calendar as CalendarIcon,
    MoreHorizontal,
    Bot,
    FileText,
    Archive,
    FolderOpen,
    FilePlus2,
    CreditCard,
    Workflow,
    Settings,
    Shield,
    BarChart3,
    Users2,
    Inbox,
    X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useApp } from '@/context/AppContext';
import { hasPermission, PermissionKey } from '@/lib/permissions';

type PrimaryItem = {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    isAction?: boolean;
    require?: PermissionKey;
};

type MoreItem = {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    require?: PermissionKey;
    color?: string;
};

const primaryItems: PrimaryItem[] = [
    { name: 'Inicio', href: '/', icon: LayoutDashboard },
    { name: 'Clientes', href: '/clients', icon: Users, require: 'clients.view' },
    { name: 'Nuevo', href: '/quotes/new', icon: Plus, isAction: true, require: 'quotes.create' },
    { name: 'Pipeline', href: '/pipeline', icon: Workflow, require: 'pipeline.view' },
];

const moreItems: MoreItem[] = [
    { name: 'Bandeja Crudos', href: '/raw-leads', icon: Inbox, require: 'clients.view', color: 'text-amber-600' },
    { name: 'Agenda', href: '/scheduler', icon: CalendarIcon, require: 'scheduler.view', color: 'text-sky-600' },
    { name: 'Cotizaciones', href: '/quotes', icon: FileText, require: 'quotes.view', color: 'text-primary' },
    { name: 'Bot IA', href: '/bot', icon: Bot, require: 'bot.use', color: 'text-violet-600' },
    { name: 'Analíticas', href: '/analytics', icon: BarChart3, require: 'analytics.view', color: 'text-emerald-600' },
    { name: 'Inventario', href: '/inventory', icon: Archive, require: 'inventory.view', color: 'text-amber-600' },
    { name: 'Formularios', href: '/forms', icon: FilePlus2, require: 'forms.view', color: 'text-emerald-500' },
    { name: 'Documentos', href: '/documents', icon: FolderOpen, require: 'documents.view', color: 'text-sky-500' },
    { name: 'Tarjetas', href: '/biolinks', icon: CreditCard, require: 'biolinks.view', color: 'text-primary' },
    { name: 'Equipo', href: '/team', icon: Users2, require: 'team.view', color: 'text-violet-500' },
    { name: 'Auditoría', href: '/audit', icon: Shield, require: 'audit.view', color: 'text-rose-500' },
    { name: 'Config', href: '/settings', icon: Settings, require: 'settings.view', color: 'text-muted-foreground' },
];

export function MobileNav() {
    const pathname = usePathname();
    const { currentUser, assignedLeadsCount } = useApp();
    // El badge "por trabajar" es para vendedores; el admin asigna, no recibe.
    const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';
    const showLeadsBadge = !isAdmin && assignedLeadsCount > 0;
    const [showMore, setShowMore] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const visiblePrimary = primaryItems.filter(item => !item.require || hasPermission(currentUser, item.require));
    const visibleMore = moreItems.filter(item => !item.require || hasPermission(currentUser, item.require));

    useEffect(() => {
        if (!showMore) return;
        const onClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowMore(false);
            }
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMore(false); };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [showMore]);

    useEffect(() => { setShowMore(false); }, [pathname]);

    return (
        <div ref={containerRef} className="lg:hidden">
            {/* Backdrop */}
            {showMore && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowMore(false)}
                />
            )}

            {/* Expanding More panel */}
            {showMore && visibleMore.length > 0 && (
                <div
                    className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-sm rounded-[1.75rem] bg-white border border-border shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom) + 0.75rem + 0.75rem)' }}
                >
                    <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Más opciones</p>
                        <button
                            onClick={() => setShowMore(false)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        >
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {visibleMore.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setShowMore(false)}
                                    className={cn(
                                        "relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95",
                                        isActive
                                            ? "bg-primary/10 border-primary/30 text-primary"
                                            : "bg-muted/40 border-border hover:bg-muted text-foreground"
                                    )}
                                >
                                    {/* Badge "por trabajar" en Bandeja Crudos */}
                                    {item.href === '/raw-leads' && showLeadsBadge && (
                                        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-black flex items-center justify-center">
                                            {assignedLeadsCount > 99 ? '99+' : assignedLeadsCount}
                                        </span>
                                    )}
                                    <item.icon className={cn("w-5 h-5", !isActive && item.color)} />
                                    <span className="text-[10px] font-bold text-center leading-tight">{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Primary bottom bar */}
            <div className="fixed left-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex h-20 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-center justify-between bg-white border border-border rounded-[1.5rem] px-4 shadow-lg">
                {visiblePrimary.map((item) => {
                    const isActive = pathname === item.href;
                    if (item.isAction) {
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className="flex h-12 w-12 -translate-y-5 items-center justify-center rounded-[1rem] bg-foreground text-primary shadow-lg transition-all active:scale-90 border-4 border-background"
                            >
                                <Plus className="w-6 h-6" />
                            </Link>
                        );
                    }
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all active:scale-95",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-[9px] font-bold">{item.name}</span>
                            {isActive && <div className="w-1 h-1 rounded-full bg-primary" />}
                        </Link>
                    );
                })}

                {/* Más button */}
                {visibleMore.length > 0 && (
                    <button
                        onClick={() => setShowMore(v => !v)}
                        className={cn(
                            "relative flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all active:scale-95",
                            showMore ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        {/* Aviso de leads por trabajar: la Bandeja Crudos vive
                            dentro de "Más", así que el badge tiene que asomar acá
                            para que sea EVIDENTE sin abrir el panel. */}
                        {showLeadsBadge && (
                            <span className="absolute top-0 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-black flex items-center justify-center border-2 border-white">
                                {assignedLeadsCount > 99 ? '99+' : assignedLeadsCount}
                            </span>
                        )}
                        <MoreHorizontal className="w-5 h-5" />
                        <span className="text-[9px] font-bold">Más</span>
                    </button>
                )}
            </div>
        </div>
    );
}
