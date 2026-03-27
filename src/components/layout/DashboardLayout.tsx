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
    const displayRole = currentUser?.role || 'Usuario';
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
        return <div className="min-h-screen bg-premium-gradient overflow-auto">{children}</div>;
    }

    if (isHydrating) {
        return null;
    }

    if (!currentUser) {
        return null; // Or a loading spinner
    }

    return (
        <div className={clsx(
            "flex h-screen bg-background overflow-hidden relative ambient-grid p-3 lg:p-5 gap-4",
            layoutMode === 'top' ? "flex-col" : "flex-row"
        )}>
            {/* Navigation side/top depends on layout */}
            {layoutMode !== 'top' && <Sidebar isCompact={layoutMode === 'compact'} />}

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative surface-panel rounded-[2.25rem] border border-white/70">
                {/* Header Section */}
                <header className="z-10 shrink-0 px-3 py-3 lg:px-6 lg:py-4">
                    <div className="w-full rounded-[1.8rem] border border-white/70 bg-white/28 backdrop-blur-2xl px-4 py-3 lg:px-6 lg:py-0">
                        <div className="flex flex-col gap-3 lg:h-16 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center justify-between gap-3 lg:hidden">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-white border border-border/40 p-2 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
                                        <img
                                            src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
                                            alt="Logo"
                                            className="h-full w-full object-contain opacity-100"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[9px] font-black text-primary uppercase tracking-[0.22em]">ArteConcreto</span>
                                        <span className="block truncate text-lg font-black text-foreground tracking-tight">CRM privado</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                        className={clsx(
                                            "relative flex h-11 w-11 items-center justify-center rounded-[1rem] transition-colors",
                                            isNotificationsOpen ? "bg-primary/12 text-primary" : "bg-white/50 text-muted-foreground"
                                        )}
                                    >
                                        <Bell className={clsx("w-5 h-5", unreadCount > 0 && "animate-bell-ring")} />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                                        )}
                                    </button>
                                    <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/80 bg-white/56 text-xs font-black text-primary">
                                        {initials}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile search */}
                            <div className="lg:hidden relative">
                                <div className="relative group w-full pill-nav rounded-[1.25rem] bg-white/44">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar en el CRM..."
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                                        onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                                        className="w-full rounded-[1.25rem] border border-transparent bg-transparent py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-all focus:border-primary/35"
                                    />
                                </div>
                                {showSearchResults && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 border border-border/60 rounded-[1.25rem] shadow-xl z-50 overflow-hidden backdrop-blur-xl">
                                        {searchResults.map((r, i) => (
                                            <a key={i} href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">{r.type}</span>
                                                <div className="min-w-0"><p className="text-xs font-black text-foreground truncate">{r.label}</p>{r.sub && <p className="text-[9px] text-muted-foreground truncate">{r.sub}</p>}</div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Desktop search */}
                            <div className="hidden lg:flex flex-1 max-w-xl relative">
                                <div className="relative group w-full pill-nav rounded-[1.4rem] bg-white/38">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar leads, productos o archivos..."
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                                        onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                                        className="w-full bg-transparent border border-transparent focus:border-primary/40 rounded-[1.4rem] py-3 pl-11 pr-4 text-sm outline-none transition-all text-foreground"
                                    />
                                </div>
                                {showSearchResults && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 border border-border/60 rounded-[1.5rem] shadow-xl z-50 overflow-hidden backdrop-blur-xl">
                                        {searchResults.map((r, i) => (
                                            <a key={i} href={r.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0 w-16 text-center">{r.type}</span>
                                                <div className="min-w-0"><p className="text-sm font-black text-foreground truncate">{r.label}</p>{r.sub && <p className="text-[10px] text-muted-foreground truncate">{r.sub}</p>}</div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="hidden lg:flex items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <a
                                        href="https://miwibi.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-all group"
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Powered by</span>
                                        <img
                                            src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                                            alt="MiWibi"
                                            className="h-4 object-contain opacity-75 hover:opacity-100 transition-opacity brightness-0"
                                        />
                                    </a>
                                </div>

                                {/* MiWi Toggle Button */}
                                <button
                                    onClick={() => { setIsMiWiOpen(v => !v); setMiwiHasSuggestion(false); }}
                                    className={clsx(
                                        "relative flex items-center gap-2 px-3 py-2 rounded-[1rem] transition-all border font-black text-[9px] uppercase tracking-widest",
                                        isMiWiOpen
                                            ? "bg-primary text-black border-primary shadow-lg shadow-primary/25"
                                            : "bg-white/40 text-muted-foreground border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                                    )}
                                >
                                    <BrainCircuit className="w-4 h-4" />
                                    <span className="hidden xl:inline">MiWi IA</span>
                                    {miwiHasSuggestion && !isMiWiOpen && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background animate-pulse shadow-[0_0_8px_rgba(250,181,16,0.8)]" />
                                    )}
                                </button>

                                <div className="relative">
                                    <button
                                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                        className={clsx(
                                            "p-2.5 transition-colors relative rounded-[1rem] hover:bg-white/42",
                                            isNotificationsOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Bell className={clsx("w-5 h-5", unreadCount > 0 && "animate-bell-ring")} />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background animate-pulse shadow-[0_0_10px_rgba(250,181,16,0.6)]"></span>
                                        )}
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 pl-4 border-l border-border/50">
                                    <div className="flex flex-col items-end mr-1">
                                        <span className="text-xs font-black text-foreground tracking-tight uppercase leading-tight">{displayName}</span>
                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-tight">{displayRole}</span>
                                    </div>
                                    <div className="relative group/user">
                                        <div className="w-10 h-10 border border-white/80 p-0.5 rounded-[1.2rem] overflow-hidden bg-white/56 backdrop-blur-xl flex items-center justify-center group-hover/user:border-primary/30 transition-all cursor-pointer outline-none">
                                            <span className="text-xs font-black text-primary">{initials}</span>
                                        </div>

                                        {/* User Dropdown */}
                                        <div className="absolute right-0 mt-3 w-48 bg-white/95 border border-border/70 rounded-[1.5rem] shadow-[0_24px_60px_rgba(23,23,23,0.12)] opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all duration-300 z-50 p-2 overflow-hidden backdrop-blur-xl">
                                            <div className="p-3 border-b border-border/60 mb-1 bg-accent/30 rounded-[1rem]">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Cuenta Activa</p>
                                                <p className="text-[10px] font-black text-foreground truncate">@{currentUser?.username || currentUser?.name || 'usuario'}</p>
                                            </div>
                                            <button
                                                onClick={() => router.push('/settings')}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all text-left group"
                                            >
                                                <User className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Mi Perfil</span>
                                            </button>
                                            <button
                                                onClick={logout}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-all text-left group"
                                            >
                                                <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-rose-500 transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Cerrar Sesión</span>
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
                        "flex-1 bg-premium-gradient p-3 sm:p-4 lg:p-6 relative rounded-[1.8rem] m-3 mt-0 border border-white/45 min-w-0",
                        pathname === '/bot'
                            ? "overflow-hidden flex flex-col pb-3 lg:pb-4"
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

            {/* Notification Detail Modal - Global Level */}
            {selectedNotification && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[rgba(245,238,223,0.72)] backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-card border border-border/70 w-full max-w-lg rounded-[3rem] overflow-hidden shadow-[0_32px_80px_rgba(23,23,23,0.12)] animate-in zoom-in-95 duration-300">
                        <div className="p-10 border-b border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(250,243,228,0.85))] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={clsx(
                                    "p-4 rounded-2xl bg-primary/10 text-primary"
                                )}>
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-foreground tracking-tight">{selectedNotification.title}</h4>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">IDC: {selectedNotification.id} • {selectedNotification.time}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedNotification(null)} className="p-3 hover:bg-accent/60 rounded-2xl transition-colors">
                                <Search className="w-5 h-5 rotate-45 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Análisis de la Inteligencia MiWi</p>
                                <p className="text-lg text-foreground/75 font-medium leading-relaxed italic border-l-2 border-primary/30 pl-6">
                                    "{selectedNotification.description}"
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-accent/25 rounded-2xl border border-border/60">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Verificación Directa</p>
                                    <p className="text-xs font-bold text-emerald-400">Verificado</p>
                                </div>
                                <div className="p-5 bg-accent/25 rounded-2xl border border-border/60">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Prioridad Operativa</p>
                                    <p className="text-xs font-bold text-foreground">Inmediata</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4">
                                <button onClick={() => setSelectedNotification(null)} className="w-full py-5 bg-primary text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20">
                                    Ejecutar Seguimiento IA
                                </button>
                                <button onClick={() => setSelectedNotification(null)} className="w-full py-5 bg-white/5 text-white/40 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors">
                                    Cerrar Ventana
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
