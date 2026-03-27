"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Search, Bell, User, BrainCircuit, X } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { MiWiAssistant } from './MiWiAssistant';
import { clsx } from 'clsx';
import { usePathname } from 'next/navigation';
import { MobileNav } from './MobileNav';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

interface LiveToast {
    id: string;
    title: string;
    body: string;
    href?: string;
    icon: string;
}

/** Plays a pleasant two-tone "ding" using the Web Audio API — no file needed */
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const play = (freq: number, start: number, duration: number, gain = 0.18) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            g.gain.setValueAtTime(0, ctx.currentTime + start);
            g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + duration);
        };
        play(880, 0,    0.18);
        play(1100, 0.14, 0.22);
    } catch { /* silently fail if browser blocks audio */ }
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isMiWiOpen, setIsMiWiOpen] = useState(false);
    const [miwiHasSuggestion, setMiwiHasSuggestion] = useState(false);
    const [layoutMode, setLayoutMode] = useState('classic');
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [liveToasts, setLiveToasts] = useState<LiveToast[]>([]);
    const { notifications, setNotifications, settings, currentUser, isHydrating, logout, clients, tasks, quotes, products } = useApp() as any;
    const pathname = usePathname();
    const router = useRouter();

    // Track known IDs to detect NEW arrivals after initial load
    const knownClientIds = useRef<Set<string>>(new Set());
    const knownTaskIds   = useRef<Set<string>>(new Set());
    const isFirstSync    = useRef(true);

    const dismissToast = useCallback((id: string) => {
        setLiveToasts(t => t.filter(x => x.id !== id));
    }, []);

    const pushToast = useCallback((toast: LiveToast) => {
        setLiveToasts(t => [...t.slice(-3), toast]); // max 4 toasts stacked
        playNotificationSound();
        setTimeout(() => dismissToast(toast.id), 8000);
    }, [dismissToast]);

    // Seed known IDs once data loads
    useEffect(() => {
        if (!isFirstSync.current) return;
        if (clients.length > 0 || tasks.length > 0) {
            clients.forEach((c: any) => knownClientIds.current.add(c.id));
            tasks.forEach((t: any) => knownTaskIds.current.add(t.id));
            isFirstSync.current = false;
        }
    }, [clients, tasks]);

    // Poll /api/state every 30s and detect new leads
    useEffect(() => {
        const poll = async () => {
            if (isFirstSync.current) return; // not initialized yet
            try {
                const [stateRes, clientsRes] = await Promise.all([
                    fetch('/api/state', { cache: 'no-store' }),
                    fetch('/api/clients', { cache: 'no-store' }),
                ]);
                if (clientsRes.ok) {
                    const { clients: fresh } = await clientsRes.json();
                    if (Array.isArray(fresh)) {
                        fresh.forEach((c: any) => {
                            if (!knownClientIds.current.has(c.id)) {
                                knownClientIds.current.add(c.id);
                                pushToast({
                                    id: `lead-${c.id}`,
                                    icon: c.source === 'WooCommerce' ? '🛒' : c.source === 'ConcreBot' ? '🤖' : '👤',
                                    title: 'Nuevo lead llegó',
                                    body: `${c.name}${c.company && c.company !== c.name ? ` · ${c.company}` : ''}`,
                                    href: `/leads/${c.id}`,
                                });
                            }
                        });
                    }
                }
                if (stateRes.ok) {
                    const state = await stateRes.json();
                    if (Array.isArray(state.tasks)) {
                        state.tasks.forEach((t: any) => {
                            if (!knownTaskIds.current.has(t.id)) {
                                knownTaskIds.current.add(t.id);
                            }
                        });
                    }
                }
            } catch { /* ignore poll errors */ }
        };

        const timer = setInterval(poll, 30_000);
        return () => clearInterval(timer);
    }, [pushToast]);

    const searchResults = React.useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q || q.length < 2) return [];
        const results: { type: string; label: string; sub: string; href: string }[] = [];
        (clients || []).filter((c: any) => (c.name + ' ' + c.company).toLowerCase().includes(q)).slice(0, 3).forEach((c: any) => {
            results.push({ type: 'Cliente', label: c.name, sub: c.company || c.email || '', href: `/clients` });
        });
        (tasks || []).filter((t: any) => (t.title + ' ' + t.client).toLowerCase().includes(q)).slice(0, 3).forEach((t: any) => {
            results.push({ type: 'Lead', label: t.title, sub: t.client || '', href: `/leads/${t.id}` });
        });
        (quotes || []).filter((q2: any) => ((q2.number || '') + ' ' + (q2.client || '')).toLowerCase().includes(q)).slice(0, 2).forEach((q2: any) => {
            results.push({ type: 'Cotización', label: q2.number || 'Sin número', sub: q2.client || '', href: `/quotes` });
        });
        (products || []).filter((p: any) => !p.isDeleted && (p.name || '').toLowerCase().includes(q)).slice(0, 2).forEach((p: any) => {
            results.push({ type: 'Producto', label: p.name, sub: p.sku || '', href: `/inventory` });
        });
        return results;
    }, [searchQuery, clients, tasks, quotes, products]);

    const unreadCount = notifications.filter((n: any) => !n.read).length;
    const displayName = currentUser?.name || 'Usuario';
    const displayRole = currentUser?.role === 'SuperAdmin' ? 'Administrador Principal' : currentUser?.role === 'Admin' ? 'Administrador' : currentUser?.role || 'Usuario';
    const initials = displayName
        .split(' ')
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() || '')
        .join('');

    const isPublicPage =
        pathname.toLowerCase().includes('login') ||
        pathname.toLowerCase().includes('register') ||
        pathname.startsWith('/public') ||
        pathname.startsWith('/widget') ||
        pathname.startsWith('/b/') ||
        pathname === '/reset-password';

    useEffect(() => {
        if (!currentUser && !isPublicPage && !isHydrating) {
            router.push('/login');
        }
    }, [currentUser, pathname, router, isPublicPage, isHydrating]);

    // Apply/remove anti-screenshot mode on body based on SuperAdmin setting
    useEffect(() => {
        if (settings?.blockScreenshots) {
            document.body.classList.add('no-screenshot');
        } else {
            document.body.classList.remove('no-screenshot');
        }
    }, [settings?.blockScreenshots]);

    useEffect(() => {
        const checkConfig = () => {
            const savedLayout = localStorage.getItem('crm-layout') || 'classic';
            setLayoutMode(savedLayout);

            const savedTheme = localStorage.getItem('crm-theme') || 'light';
            document.documentElement.classList.remove('dark');
            if (savedTheme === 'dark') {
                document.documentElement.classList.add('dark');
            }
        };

        checkConfig();
        window.addEventListener('storage', checkConfig);
        return () => {
            window.removeEventListener('storage', checkConfig);
        };
    }, []);

    if (isPublicPage) {
        return <div className="min-h-screen bg-background overflow-auto">{children}</div>;
    }

    if (isHydrating) {
        return null;
    }

    if (!currentUser) {
        return null; // Or a loading spinner
    }

    return (
        <div className={clsx(
            "flex h-screen bg-background overflow-hidden",
            layoutMode === 'top' ? "flex-col" : "flex-row"
        )}>
            {/* Navigation side/top depends on layout */}
            {layoutMode !== 'top' && (
                <div className="p-3 shrink-0">
                    <Sidebar isCompact={layoutMode === 'compact'} />
                </div>
            )}

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header Section */}
                <header className="z-10 shrink-0 bg-white border-b border-border px-4 lg:px-6">
                    <div className="w-full">
                        <div className="flex flex-col gap-3 lg:h-16 lg:flex-row lg:items-center lg:justify-between">
                            {/* Mobile top bar */}
                            <div className="flex items-center justify-between gap-3 lg:hidden py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted p-1.5">
                                        <img
                                            src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
                                            alt="Logo"
                                            className="h-full w-full object-contain"
                                        />
                                    </div>
                                    <span className="font-black text-foreground text-sm tracking-tight">ArteConcreto CRM</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <Bell className={clsx("w-4 h-4", unreadCount > 0 && "animate-bell-ring")} />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                                        )}
                                    </button>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                                        {initials}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile search */}
                            <div className="lg:hidden relative pb-3">
                                <div className="relative w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar en el CRM..."
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                                        onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-white"
                                    />
                                </div>
                                {showSearchResults && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                                        {searchResults.map((r, i) => (
                                            <a key={i} href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-0">
                                                <span className="text-[9px] font-black uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">{r.type}</span>
                                                <div className="min-w-0"><p className="text-xs font-bold text-foreground truncate">{r.label}</p>{r.sub && <p className="text-[10px] text-muted-foreground truncate">{r.sub}</p>}</div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Desktop search */}
                            <div className="hidden lg:flex flex-1 max-w-lg relative">
                                <div className="relative w-full">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar leads, productos o archivos..."
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                                        onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(250,181,16,0.12)]"
                                    />
                                </div>
                                {showSearchResults && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                                        {searchResults.map((r, i) => (
                                            <a key={i} href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-0">
                                                <span className="text-[9px] font-black uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0 w-16 text-center">{r.type}</span>
                                                <div className="min-w-0"><p className="text-sm font-semibold text-foreground truncate">{r.label}</p>{r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}</div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Desktop right side */}
                            <div className="hidden lg:flex items-center gap-3">
                                {/* Powered by */}
                                <a
                                    href="https://miwibi.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 opacity-50 hover:opacity-80 transition-opacity"
                                >
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Powered by</span>
                                    <img
                                        src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                                        alt="MiWibi"
                                        className="h-3.5 object-contain brightness-0"
                                    />
                                </a>

                                {/* MiWi Toggle */}
                                <button
                                    onClick={() => { setIsMiWiOpen(v => !v); setMiwiHasSuggestion(false); }}
                                    className={clsx(
                                        "relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-xs font-bold border",
                                        isMiWiOpen
                                            ? "bg-primary text-black border-primary"
                                            : "bg-muted text-muted-foreground border-border hover:text-foreground"
                                    )}
                                >
                                    <BrainCircuit className="w-4 h-4" />
                                    <span className="hidden xl:inline">MiWi IA</span>
                                    {miwiHasSuggestion && !isMiWiOpen && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border-2 border-white" />
                                    )}
                                </button>

                                {/* Notifications */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                        className={clsx(
                                            "relative h-9 w-9 flex items-center justify-center rounded-xl border transition-all",
                                            isNotificationsOpen
                                                ? "bg-primary/10 border-primary/20 text-primary"
                                                : "bg-muted border-border text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Bell className={clsx("w-4 h-4", unreadCount > 0 && "animate-bell-ring")} />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-white" />
                                        )}
                                    </button>
                                </div>

                                {/* User */}
                                <div className="flex items-center gap-3 pl-3 border-l border-border">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold text-foreground leading-tight">{displayName}</span>
                                        <span className="text-[10px] text-primary font-semibold leading-tight">{displayRole}</span>
                                    </div>
                                    <div className="relative group/user">
                                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center cursor-pointer border border-border hover:border-primary/30 transition-all">
                                            <span className="text-xs font-black text-primary">{initials}</span>
                                        </div>
                                        {/* User Dropdown */}
                                        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-border rounded-xl shadow-lg opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all duration-200 z-50 overflow-hidden">
                                            <div className="px-4 py-3 border-b border-border bg-muted/50">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Cuenta</p>
                                                <p className="text-xs font-bold text-foreground truncate">@{currentUser?.username || currentUser?.name || 'usuario'}</p>
                                            </div>
                                            <button
                                                onClick={() => router.push('/settings')}
                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-left"
                                            >
                                                <User className="w-3.5 h-3.5" />
                                                Mi Perfil
                                            </button>
                                            <button
                                                onClick={logout}
                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-50 text-sm font-medium text-muted-foreground hover:text-red-600 transition-colors text-left"
                                            >
                                                <LogOut className="w-3.5 h-3.5" />
                                                Cerrar Sesión
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <NotificationDropdown
                                isOpen={isNotificationsOpen}
                                onClose={() => setIsNotificationsOpen(false)}
                                notifications={notifications}
                                setNotifications={setNotifications}
                                onSelectNotification={(n) => setSelectedNotification(n)}
                            />
                        </div>
                    </div>
                </header>

                {/* Main Content + MiWi Push Panel */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    <main className={clsx(
                        "flex-1 bg-background p-4 lg:p-6 relative min-w-0",
                        pathname === '/bot'
                            ? "overflow-hidden flex flex-col"
                            : "overflow-y-auto pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:pb-8"
                    )}>
                        {children}
                    </main>

                    {/* MiWi Push Panel */}
                    <MiWiAssistant isOpen={isMiWiOpen} onClose={() => setIsMiWiOpen(false)} onNewSuggestion={() => setMiwiHasSuggestion(true)} />
                </div>

                {/* Mobile Bottom Navigation */}
                <MobileNav />
            </div>

            {/* ── Live Lead Toast Stack ── */}
            {liveToasts.length > 0 && (
                <div className="fixed bottom-6 right-6 z-[500] flex flex-col gap-2 items-end">
                    {liveToasts.map(toast => (
                        <div
                            key={toast.id}
                            className="flex items-start gap-3 bg-white border border-primary/20 shadow-2xl shadow-primary/10 rounded-2xl px-4 py-3 w-72 animate-in slide-in-from-right-4 fade-in duration-300"
                        >
                            <span className="text-2xl shrink-0 mt-0.5">{toast.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">{toast.title}</p>
                                <p className="text-sm font-bold text-foreground truncate">{toast.body}</p>
                                {toast.href && (
                                    <a
                                        href={toast.href}
                                        className="text-[9px] font-black uppercase tracking-widest text-primary/70 hover:text-primary mt-1 inline-flex items-center gap-1"
                                        onClick={() => dismissToast(toast.id)}
                                    >
                                        Ver ficha →
                                    </a>
                                )}
                            </div>
                            <button
                                onClick={() => dismissToast(toast.id)}
                                className="shrink-0 p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Notification Detail Modal */}
            {selectedNotification && (
                <div className="modal-overlay" style={{ zIndex: 300 }}>
                    <div className="modal-content max-w-md animate-in zoom-in-95 duration-200">
                        <div className="modal-header">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-foreground">{selectedNotification.title}</h4>
                                    <p className="text-xs text-muted-foreground">{selectedNotification.time}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedNotification(null)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <p className="text-sm text-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-4">
                                {selectedNotification.description}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-muted rounded-xl border border-border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Estado</p>
                                    <p className="text-xs font-bold text-emerald-600">Verificado</p>
                                </div>
                                <div className="p-4 bg-muted rounded-xl border border-border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Prioridad</p>
                                    <p className="text-xs font-bold text-foreground">Inmediata</p>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setSelectedNotification(null)} className="btn-ghost">Cerrar</button>
                            <button onClick={() => setSelectedNotification(null)} className="btn-primary">Ver Detalle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
