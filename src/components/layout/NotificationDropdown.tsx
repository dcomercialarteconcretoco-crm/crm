"use client";

import React, { useState } from 'react';
import {
    Bell,
    X,
    MessageCircle,
    Zap,
    AlertTriangle,
    CheckCircle2,
    Bot,
    Calendar,
    ArrowRight,
    Search,
    Filter
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

interface Notification {
    id: string;
    title: string;
    description: string;
    time: string;
    type: 'lead' | 'ai' | 'alert' | 'success' | 'task' | 'order';
    read: boolean;
}



interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    onSelectNotification: (notification: Notification) => void;
}

export function NotificationDropdown({ isOpen, onClose, notifications, setNotifications, onSelectNotification }: NotificationDropdownProps) {
    if (!isOpen) return null;

    const markAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const removeNotification = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const handleNotificationClick = (n: Notification) => {
        markAsRead(n.id);
        onSelectNotification(n);
    };

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'lead': return <MessageCircle className="w-4 h-4 text-sky-500" />;
            case 'ai': return <Bot className="w-4 h-4 text-primary" />;
            case 'alert': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
            case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'task': return <Calendar className="w-4 h-4 text-amber-500" />;
            case 'order': return <Zap className="w-4 h-4 text-primary animate-pulse" />;
            default: return <Bell className="w-4 h-4" />;
        }
    };

    return (
        <React.Fragment>
            {/* Backdrop for closing */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            <div className="absolute top-full right-0 mt-4 w-[450px] bg-card border border-white/10 rounded-[2.5rem] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <Bell className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black tracking-tight text-white leading-none">Notificaciones</h3>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                    <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Live</span>
                                </div>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-1.5 flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-primary" />
                                MiWi Intelligence Cloud Sync
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={markAllRead}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity"
                        >
                            Leer Todo
                        </button>
                        <button
                            onClick={() => setNotifications([])}
                            className="text-[10px] font-black uppercase tracking-widest text-rose-500/60 hover:text-rose-500 transition-colors"
                        >
                            Borrar Todo
                        </button>
                    </div>
                </div>

                {/* Filters/Search */}
                <div className="px-8 py-4 bg-white/[0.01] border-b border-white/5 flex items-center gap-4">
                    <div className="relative flex-1">
                        <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                        <input
                            type="text"
                            placeholder="Buscar en el historial..."
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-[10px] font-bold outline-none focus:border-primary/30 transition-all text-white"
                        />
                    </div>
                    <button className="p-2 bg-white/5 rounded-xl border border-white/5 text-white/40">
                        <Filter className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Notifications List */}
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-white/[0.03]">
                    {notifications.length > 0 ? (
                        notifications.map((n) => (
                            <div
                                key={n.id}
                                onClick={() => handleNotificationClick(n)}
                                className={clsx(
                                    "p-8 flex gap-5 hover:bg-white/[0.03] transition-all cursor-pointer relative group animate-in slide-in-from-right-4 duration-300",
                                    !n.read && "bg-primary/[0.02]"
                                )}
                            >
                                {!n.read && <div className="absolute left-0 top-0 w-1 h-full bg-primary shadow-[0_0_15px_rgba(250,181,16,0.5)]"></div>}

                                <div className={clsx(
                                    "w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center border transition-transform group-hover:scale-110",
                                    n.type === 'ai' ? "bg-primary/5 border-primary/20" :
                                        n.type === 'alert' ? "bg-rose-500/5 border-rose-500/20" :
                                            n.type === 'success' ? "bg-emerald-500/5 border-emerald-500/20" :
                                                n.type === 'task' ? "bg-amber-500/5 border-amber-500/20" :
                                                    "bg-white/5 border-white/10"
                                )}>
                                    {getIcon(n.type)}
                                </div>

                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-white">{n.title}</h4>
                                        <span className="text-[9px] font-black uppercase text-white/20">{n.time}</span>
                                    </div>
                                    <p className="text-xs text-white/50 font-medium leading-relaxed">{n.description}</p>

                                    <div className="pt-3 flex items-center gap-4">
                                        <button className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 group/btn">
                                            Ver Detalles
                                            <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                                        </button>
                                        <button
                                            onClick={(e) => removeNotification(n.id, e)}
                                            className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-rose-500 transition-colors"
                                        >
                                            Descartar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                <Bell className="w-8 h-8 text-white/10" />
                            </div>
                            <p className="text-sm font-bold text-white/20 uppercase tracking-widest">No hay notificaciones</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-white/[0.02] border-t border-white/5">
                    <button className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white transition-all border border-white/10">
                        Ver todo el historial
                    </button>
                </div>
            </div>
        </React.Fragment>
    );
}
