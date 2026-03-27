"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import {
    LayoutDashboard, Users, FileText, Kanban, CalendarDays,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
    { href: '/m',          label: 'Inicio',    icon: LayoutDashboard },
    { href: '/m/clientes', label: 'Clientes',  icon: Users },
    { href: '/m/cotizar',  label: 'Cotizar',   icon: FileText },
    { href: '/m/pipeline', label: 'Pipeline',  icon: Kanban },
    { href: '/m/agenda',   label: 'Agenda',    icon: CalendarDays },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
    const { currentUser, isHydrating } = useApp();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isHydrating && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, isHydrating, router]);

    if (isHydrating || !currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const initials = currentUser.name
        ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : 'U';

    return (
        <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto">

            {/* Top Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
                <img
                    src="https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png"
                    alt="ArteConcreto"
                    className="h-7 object-contain"
                />
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-medium hidden sm:block">
                        {currentUser.name?.split(' ')[0]}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-xs font-black text-black overflow-hidden">
                        {currentUser.avatar
                            ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt="" />
                            : initials
                        }
                    </div>
                </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto pb-24">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border max-w-md mx-auto"
                 style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="grid grid-cols-5">
                    {NAV.map(({ href, label, icon: Icon }) => {
                        const active = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={clsx(
                                    'flex flex-col items-center justify-center py-3 gap-0.5 transition-colors',
                                    active ? 'text-primary' : 'text-muted-foreground'
                                )}
                            >
                                <Icon className={clsx('w-5 h-5', active && 'stroke-[2.5px]')} />
                                <span className={clsx('text-[10px] font-bold tracking-wide', active && 'font-black')}>
                                    {label}
                                </span>
                                {active && (
                                    <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
