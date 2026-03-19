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
    { name: 'Dash', href: '/', icon: LayoutDashboard },
    { name: 'Pipeline', href: '/pipeline', icon: Workflow },
    { name: 'Add', href: '/quotes/new', icon: Plus, isAction: true },
    { name: 'Bot', href: '/bot', icon: Bot },
    { name: 'Config', href: '/settings', icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[rgba(255,253,248,0.88)] backdrop-blur-xl border-t border-border/40 px-6 flex items-center justify-between z-50 rounded-t-[2.5rem] shadow-[0_-14px_40px_rgba(23,23,23,0.10)]">
            {mobileItems.map((item) => {
                const isActive = pathname === item.href;

                if (item.isAction) {
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className="bg-[#171717] text-primary w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_18px_40px_rgba(23,23,23,0.18)] -mt-10 transform active:scale-90 transition-all border-4 border-background"
                        >
                            <Plus className="w-8 h-8" />
                        </Link>
                    );
                }

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center gap-1 transition-all active:scale-95",
                            isActive ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <item.icon className={cn("w-6 h-6", isActive && "animate-in zoom-in-75")} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{item.name}</span>
                    </Link>
                );
            })}
        </div>
    );
}
