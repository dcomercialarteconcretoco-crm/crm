"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Workflow,
    Plus,
    Settings,
    Bot
} from 'lucide-react';
import { cn } from '../../lib/utils';

const mobileItems = [
    { name: 'Inicio', href: '/', icon: LayoutDashboard },
    { name: 'Pipeline', href: '/pipeline', icon: Workflow },
    { name: 'Nuevo', href: '/quotes/new', icon: Plus, isAction: true },
    { name: 'Bot', href: '/bot', icon: Bot },
    { name: 'Config', href: '/settings', icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <div className="lg:hidden fixed left-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex h-[86px] w-[calc(100%-1.25rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-[2rem] border border-white/80 bg-[rgba(255,253,248,0.88)] px-5 shadow-[0_18px_40px_rgba(23,23,23,0.09)] backdrop-blur-2xl">
            {mobileItems.map((item) => {
                const isActive = pathname === item.href;

                if (item.isAction) {
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className="flex h-16 w-16 -translate-y-6 items-center justify-center rounded-[1.5rem] border-[6px] border-[rgba(255,253,248,0.95)] bg-[#171717] text-primary shadow-[0_18px_40px_rgba(23,23,23,0.16)] transition-all active:scale-90"
                        >
                            <Plus className="w-7 h-7" />
                        </Link>
                    );
                }

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex min-w-[62px] flex-col items-center gap-1.5 rounded-[1rem] px-2 py-2 transition-all active:scale-95",
                            isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                        )}
                    >
                        <item.icon className={cn("w-5.5 h-5.5", isActive && "animate-in zoom-in-75")} />
                        <span className="text-[8px] font-black uppercase tracking-[0.18em]">{item.name}</span>
                    </Link>
                );
            })}
        </div>
    );
}
