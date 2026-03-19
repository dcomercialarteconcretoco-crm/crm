"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Search, Bell, User, BrainCircuit } from 'lucide-react';
import { MiWiAssistant } from './MiWiAssistant';
import { NotificationDropdown } from './NotificationDropdown';
import { clsx } from 'clsx';
import { usePathname } from 'next/navigation';
import { MobileNav } from './MobileNav';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronDown } from 'lucide-react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const [isMiWiOpen, setIsMiWiOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [layoutMode, setLayoutMode] = useState('classic');
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const { notifications, setNotifications, settings, currentUser, logout } = useApp() as any;
    const pathname = usePathname();
    const router = useRouter();

    const unreadCount = notifications.filter((n: any) => !n.read).length;

    const isPublicPage =
        pathname.toLowerCase().includes('login') ||
        pathname.toLowerCase().includes('register') ||
        pathname.startsWith('/public');

    useEffect(() => {
        if (!currentUser && !isPublicPage) {
            router.push('/login');
        }
    }, [currentUser, pathname, router, isPublicPage]);

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

            const savedTheme = localStorage.getItem('crm-theme') || 'dark';
            if (savedTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };

        checkConfig();
        window.addEventListener('storage', checkConfig);
        const interval = setInterval(checkConfig, 2000);
        return () => {
            window.removeEventListener('storage', checkConfig);
            clearInterval(interval);
        };
    }, []);

    if (isPublicPage) {
        return <div className="min-h-screen bg-[#050505] overflow-auto">{children}</div>;
    }

    if (!currentUser) {
        return null; // Or a loading spinner
    }

    return (
        <div className={clsx(
            "flex h-screen bg-background overflow-hidden relative",
            layoutMode === 'top' ? "flex-col" : "flex-row"
        )}>
            {/* Navigation side/top depends on layout */}
            {layoutMode !== 'top' && <Sidebar isCompact={layoutMode === 'compact'} />}

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header Section */}
                <header className="h-16 lg:h-20 border-b border-border/40 flex items-center justify-between px-6 lg:px-8 bg-background/50 backdrop-blur-md z-10 shrink-0">
                    <div className="flex items-center gap-4 lg:hidden">
                        <div className="w-14 h-14 rounded-xl bg-card border border-border/40 p-2 flex items-center justify-center">
                            <img
                                src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
                                alt="Logo"
                                className="w-full h-full object-contain opacity-100"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Active Core</span>
                            <span className="text-xs font-black">Intelligence</span>
                        </div>
                    </div>

                    <div className="hidden lg:flex flex-1 max-w-xl">
                        <div className="relative group w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar leads, productos o archivos..."
                                className="w-full bg-muted/30 border border-transparent focus:border-primary/50 focus:bg-muted/50 rounded-lg py-2 pl-10 pr-4 text-sm outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4">
                            {/* <button
                                onClick={() => setIsMiWiOpen(true)}
                                className="flex items-center gap-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/40 px-4 py-2 rounded-xl transition-all group shrink-0"
                            >
                                <BrainCircuit className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-black uppercase tracking-widest text-primary hidden sm:inline">MiWi Intelligence</span>
                            </button> */}
                            <a
                                href="https://miwibi.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-all group"
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Powered by</span>
                                <img
                                    src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                                    alt="MiWibi"
                                    className="h-4 object-contain opacity-80 hover:opacity-100 transition-opacity"
                                />
                            </a>
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                className={clsx(
                                    "p-2 transition-colors relative rounded-xl hover:bg-accent",
                                    isNotificationsOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Bell className={clsx("w-5 h-5", unreadCount > 0 && "animate-bell-ring")} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background animate-pulse shadow-[0_0_10px_rgba(250,181,16,0.6)]"></span>
                                )}
                            </button>

                            <NotificationDropdown
                                isOpen={isNotificationsOpen}
                                onClose={() => setIsNotificationsOpen(false)}
                                notifications={notifications}
                                setNotifications={setNotifications}
                                onSelectNotification={(n) => setSelectedNotification(n)}
                            />
                        </div>

                        <div className="flex items-center gap-4 pl-4 border-l border-border/40">
                            <div className="flex flex-col items-end hidden lg:flex mr-1">
                                <span className="text-[10px] font-black text-white italic tracking-tighter uppercase">{currentUser?.name}</span>
                                <span className="text-[8px] font-black text-primary uppercase tracking-widest">{currentUser?.role}</span>
                            </div>
                            <div className="relative group/user">
                                <div className="w-10 h-10 border-2 border-primary/20 p-0.5 rounded-2xl overflow-hidden bg-muted flex items-center justify-center group-hover/user:border-primary transition-all cursor-pointer shadow-lg outline-none">
                                    {currentUser?.avatar ? (
                                        <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-5 h-5 text-primary" />
                                    )}
                                </div>

                                {/* User Dropdown */}
                                <div className="absolute right-0 mt-3 w-48 bg-[#0a0a0b] border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all duration-300 z-50 p-2 overflow-hidden">
                                    <div className="p-3 border-b border-white/5 mb-1 bg-white/[0.02]">
                                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Cuenta Activa</p>
                                        <p className="text-[10px] font-black text-white truncate">@{currentUser?.username || 'admin'}</p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/settings')}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left group"
                                    >
                                        <User className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Mi Perfil</span>
                                    </button>
                                    <button
                                        onClick={logout}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 text-white/60 hover:text-rose-500 transition-all text-left group"
                                    >
                                        <LogOut className="w-4 h-4 text-white/20 group-hover:text-rose-500 transition-colors" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Cerrar Sesión</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-premium-gradient p-4 lg:p-8 relative pb-24 lg:pb-8">
                    {children}
                </main>

                {/* Mobile Bottom Navigation */}
                <MobileNav />
            </div>

            {/* Global Assistants */}
            {/* <MiWiAssistant
                isOpen={isMiWiOpen}
                onClose={() => setIsMiWiOpen(false)}
            /> */}

            {/* Notification Detail Modal - Global Level */}
            {selectedNotification && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-card border border-white/10 w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-10 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={clsx(
                                    "p-4 rounded-2xl bg-primary/10 text-primary"
                                )}>
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-white tracking-tight">{selectedNotification.title}</h4>
                                    <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">IDC: {selectedNotification.id} • {selectedNotification.time}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedNotification(null)} className="p-3 hover:bg-white/5 rounded-2xl transition-colors">
                                <Search className="w-5 h-5 rotate-45 text-white/40" />
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Análisis de la Inteligencia MiWi</p>
                                <p className="text-lg text-white/80 font-medium leading-relaxed italic border-l-2 border-primary/30 pl-6">
                                    "{selectedNotification.description}"
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-white/[0.02] rounded-2xl border border-white/5">
                                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">Verificación Directa</p>
                                    <p className="text-xs font-bold text-emerald-400">Verificado</p>
                                </div>
                                <div className="p-5 bg-white/[0.02] rounded-2xl border border-white/5">
                                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">Prioridad Operativa</p>
                                    <p className="text-xs font-bold text-white">Inmediata</p>
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
