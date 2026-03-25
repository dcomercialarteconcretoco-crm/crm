"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  Archive,
  Calendar,
  FileText,
  Workflow,
  Bot,
  Shield,
  FilePlus2,
  Loader2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useApp } from '@/context/AppContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Cotizaciones', href: '/quotes', icon: FileText },
  { name: 'Pipeline', href: '/pipeline', icon: Workflow },
  { name: 'Clientes', href: '/clients', icon: Users },
  { name: 'Inventario', href: '/inventory', icon: Archive },
  { name: 'Agenda', href: '/scheduler', icon: Calendar },
  { name: 'Analíticas', href: '/analytics', icon: BarChart3 },
  { name: 'Equipo', href: '/team', icon: Users },
  { name: 'Formbuilder IA', href: '/forms', icon: FilePlus2 },
  { name: 'MiWi Bot', href: '/bot', icon: Bot },
];


const systemItems = [
  { name: 'Auditoría', href: '/audit', icon: Shield },
  { name: 'Configuración', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isCompact?: boolean;
}

export function Sidebar({ isCompact }: SidebarProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { currentUser } = useApp();
  const displayName =
    currentUser?.name === 'Administrador Principal' || currentUser?.name === 'Acceso Alternativo'
      ? 'Juan Sierra'
      : currentUser?.name || 'Usuario';
  const displayRole =
    currentUser?.role === 'SuperAdmin' ? 'Dios Mode' : currentUser?.role === 'Admin' ? 'Administrador' : currentUser?.role || 'Usuario';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <div className={cn(
      "hidden lg:flex flex-col h-full bg-[linear-gradient(180deg,rgba(255,255,255,0.44),rgba(243,247,253,0.34))] border border-white/70 text-foreground overflow-hidden transition-all duration-500 backdrop-blur-[28px] rounded-[2.25rem]",
      isCompact ? "w-20" : "w-64"
    )}>
      <div className={cn("flex flex-col items-center shrink-0", isCompact ? "p-3" : "px-5 pt-2 pb-1 gap-1")}>
        <div className={cn("flex items-center justify-center transition-all", isCompact ? "w-8 h-8" : "w-full h-16")}>
          <img
            src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
            alt="ArteConcreto"
            className="w-full h-full object-contain filter brightness-110 opacity-100 transition-all duration-500 hover:scale-105"
          />
        </div>
        {!isCompact && (
          <div className="px-4 py-1 bg-white/42 border border-white/75 rounded-full backdrop-blur-xl -mt-1">
            <p className="text-[9px] text-foreground font-black tracking-[0.3em] uppercase">Power CRM</p>
          </div>
        )}
      </div>


      <div className="px-5 mb-2">
        <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {!isCompact && <div className="mb-2 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50">Menú Principal</div>}
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (pathname !== item.href) {
                  setPendingHref(item.href);
                }
              }}
              className={cn(
                "flex items-center rounded-xl text-sm font-bold transition-all duration-300 group relative truncate",
                isCompact ? "justify-center p-2.5" : "gap-3 px-4 py-2.5",
                isActive
                  ? "bg-white/58 text-foreground border border-white/85 backdrop-blur-xl"
                  : pendingHref === item.href
                    ? "bg-white/52 text-foreground border border-white/75"
                    : "text-muted-foreground hover:bg-white/42 hover:text-foreground"
              )}
            >
              {pendingHref === item.href ? (
                <Loader2 className="w-4 h-4 shrink-0 text-primary animate-spin" />
              ) : (
                <item.icon className={cn(
                  "w-4 h-4 transition-transform group-hover:scale-110 shrink-0",
                  isActive ? "text-primary" : "text-primary/70 group-hover:text-primary"
                )} />
              )}
              {!isCompact && <span className="tracking-tight truncate">{item.name}</span>}

              {/* Notification Badge for Bot */}
              {item.name === 'MiWi Bot' && !isActive && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse"></span>
              )}

              {isActive && !isCompact && (
                <div className="absolute right-3 w-1.5 h-1.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}

        {!isCompact && <div className="mt-4 mb-2 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50">Sistema</div>}
        {systemItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (pathname !== item.href) {
                  setPendingHref(item.href);
                }
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 group truncate",
                isActive
                  ? "bg-white/58 text-foreground border border-white/85 backdrop-blur-xl"
                  : pendingHref === item.href
                    ? "bg-white/52 text-foreground border border-white/75"
                    : "text-muted-foreground hover:bg-white/42 hover:text-foreground"
              )}
            >
              {pendingHref === item.href ? (
                <Loader2 className="w-4 h-4 shrink-0 text-primary animate-spin" />
              ) : (
                <item.icon className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-primary" : "text-primary/70 group-hover:text-primary"
                )} />
              )}
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
