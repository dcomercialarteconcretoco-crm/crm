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
    { name: 'Bot', href: '/bot', icon: Bot },
    { name: 'Nuevo', href: '/quotes/new', icon: Plus, isAction: true },
    { name: 'Pipeline', href: '/pipeline', icon: Workflow },
    { name: 'Config', href: '/settings', icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <div className="lg:hidden fixed left-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex h-20 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-center justify-between bg-white border border-border rounded-[1.5rem] px-4 shadow-lg">
            {mobileItems.map((item) => {
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
        </div>
    );
}
