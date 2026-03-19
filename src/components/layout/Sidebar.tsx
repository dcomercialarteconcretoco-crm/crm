"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  Archive,
  Calendar,
  MessageSquare,
  FileText,
  Workflow,
  Plus,
  Zap,
  Bot,
  Shield,
  FilePlus2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

  return (
    <div className={cn(
      "hidden lg:flex flex-col h-screen bg-card border-r border-border/40 text-foreground overflow-hidden transition-all duration-500",
      isCompact ? "w-20" : "w-64"
    )}>
      <div className={cn("flex flex-col items-center shrink-0", isCompact ? "p-4" : "p-6 gap-4")}>
        <div className={cn("flex items-center justify-center transition-all", isCompact ? "w-8 h-8" : "w-full h-32")}>
          <img
            src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
            alt="Arte Concreto"
            className="w-full h-full object-contain filter brightness-110 opacity-100 transition-all duration-500 hover:scale-105"
          />
        </div>
        {!isCompact && (
          <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <p className="text-[9px] text-primary font-black tracking-[0.3em] uppercase">Power CRM</p>
          </div>
        )}
      </div>


      <div className="px-6 mb-6">
        <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {!isCompact && <div className="mb-4 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50">Menú Principal</div>}
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-xl text-sm font-bold transition-all duration-300 group relative truncate",
                isCompact ? "justify-center p-3" : "gap-3 px-4 py-3",
                isActive
                  ? "bg-primary text-black shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-transform group-hover:scale-110 shrink-0",
                isActive ? "text-black" : "text-primary/70 group-hover:text-primary"
              )} />
              {!isCompact && <span className="tracking-tight truncate">{item.name}</span>}

              {/* Notification Badge for Bot */}
              {item.name === 'MiWi Bot' && !isActive && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse"></span>
              )}

              {isActive && !isCompact && (
                <div className="absolute right-2 w-1.5 h-1.5 bg-black rounded-full" />
              )}
            </Link>
          );
        })}

        {!isCompact && <div className="mt-8 mb-4 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50">Sistema</div>}
        {systemItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 group truncate",
                isActive
                  ? "bg-primary text-black shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 shrink-0",
                isActive ? "text-black" : "text-primary/70 group-hover:text-primary"
              )} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("p-4 shrink-0 space-y-4", isCompact ? "items-center" : "bg-muted/5 border-t border-border/20")}>
        <div className={cn("bg-muted/20 border border-border/40 rounded-2xl flex items-center gap-3", isCompact ? "p-2 justify-center" : "p-4")}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-black font-black text-xs shrink-0 shadow-lg shadow-primary/20">JS</div>
          {!isCompact && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">Juancho Sierra</p>
              <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-tighter">Admin Core</p>
            </div>
          )}
        </div>
        {/* Sidebar Footer with Credits */}
        <div className="p-6 mt-auto border-t border-border/40 bg-muted/5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">Developed by</span>
              <img
                src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                alt="Cuantium AI"
                className="h-3.5 object-contain opacity-50 hover:opacity-100 transition-opacity duration-300"
              />
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-[8px] font-bold text-white/40 leading-tight uppercase tracking-tighter">
                Tecnología <span className="text-primary italic">Cuantium AI - URB</span>. Diseñado exclusivamente para <span className="text-white">arteconcreto.co</span>.
                Protegido por derechos de propiedad intelectual.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
