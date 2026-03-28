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
  Loader2,
  FolderOpen,
  CreditCard
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useApp } from '@/context/AppContext';
import { hasPermission, PermissionKey } from '@/lib/permissions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navGroups = [
  {
    label: 'Comercial',
    items: [
      { name: 'Dashboard',     href: '/',         icon: LayoutDashboard, permission: null              },
      { name: 'ConcreBOT',     href: '/bot',       icon: Bot,             permission: 'bot.use'         },
      { name: 'Cotizaciones',  href: '/quotes',    icon: FileText,        permission: 'quotes.view'     },
      { name: 'Pipeline',      href: '/pipeline',  icon: Workflow,        permission: 'pipeline.view'   },
      { name: 'Clientes',      href: '/clients',   icon: Users,           permission: 'clients.view'    },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { name: 'Inventario',    href: '/inventory', icon: Archive,   permission: 'inventory.view'  },
      { name: 'Agenda',        href: '/scheduler', icon: Calendar,  permission: 'scheduler.view'  },
      { name: 'Analíticas',    href: '/analytics', icon: BarChart3, permission: 'analytics.view'  },
      { name: 'Equipo',        href: '/team',      icon: Users,     permission: 'team.view'       },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { name: 'Formbuilder IA',      href: '/forms',     icon: FilePlus2, permission: 'forms.view'     },
      { name: 'Documentos',          href: '/documents', icon: FolderOpen,permission: 'documents.view' },
      { name: 'Tarjetas Digitales',  href: '/biolinks',  icon: CreditCard,permission: 'biolinks.view'  },
    ],
  },
] as const;

const systemItems = [
  { name: 'Auditoría',     href: '/audit',    icon: Shield,   permission: 'audit.view'    },
  { name: 'Configuración', href: '/settings', icon: Settings, permission: 'settings.view' },
] as const;

interface SidebarProps {
  isCompact?: boolean;
}

export function Sidebar({ isCompact }: SidebarProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { currentUser } = useApp();

  /** Hides nav items the user has no permission for */
  const canSee = (permission: string | null) =>
    !permission || hasPermission(currentUser, permission as PermissionKey);
  const displayName =
    currentUser?.name === 'Administrador Principal' || currentUser?.name === 'Acceso Alternativo'
      ? 'Juan Sierra'
      : currentUser?.name || 'Usuario';
  const displayRole =
    currentUser?.role === 'SuperAdmin' ? 'Administrador Principal' : currentUser?.role === 'Admin' ? 'Administrador' : currentUser?.role || 'Usuario';
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
      "hidden lg:flex flex-col h-full bg-white border border-border rounded-[1.75rem] text-foreground overflow-hidden transition-all duration-300",
      isCompact ? "w-20" : "w-64"
    )}
    style={{ boxShadow: 'var(--shadow-sm)' }}>

      {/* Logo */}
      <div className={cn("flex flex-col items-center shrink-0 border-b border-border", isCompact ? "p-4" : "px-5 pt-5 pb-4")}>
        <div className={cn("flex items-center justify-center", isCompact ? "w-9 h-9" : "w-full h-14")}>
          <img
            src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
            alt="ArteConcreto"
            className="w-full h-full object-contain"
          />
        </div>
        {!isCompact && (
          <div className="mt-2 px-3 py-1 bg-primary/8 border border-primary/15 rounded-full">
            <p className="text-[9px] text-primary font-black tracking-[0.3em] uppercase">Power CRM</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-2">
            {!isCompact && (
              <div className="mb-1 mt-3 first:mt-1 px-3 text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                {group.label}
              </div>
            )}
            {group.items.filter(item => canSee(item.permission)).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (pathname !== item.href) setPendingHref(item.href);
                  }}
                  className={cn(
                    "flex items-center rounded-xl text-sm font-semibold transition-all duration-200 group relative",
                    isCompact ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : pendingHref === item.href
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {pendingHref === item.href ? (
                    <Loader2 className="w-4 h-4 shrink-0 text-primary animate-spin" />
                  ) : (
                    <item.icon className={cn(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                  )}
                  {!isCompact && <span className="truncate">{item.name}</span>}

                  {isActive && !isCompact && (
                    <div className="absolute right-3 w-1.5 h-1.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* System */}
        {!isCompact && (
          <div className="mt-2 mb-1 px-3 text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Sistema</div>
        )}
        {systemItems.filter(item => canSee(item.permission)).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (pathname !== item.href) setPendingHref(item.href);
              }}
              className={cn(
                "flex items-center rounded-xl text-sm font-semibold transition-all duration-200 group",
                isCompact ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-primary/10 text-primary"
                  : pendingHref === item.href
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {pendingHref === item.href ? (
                <Loader2 className="w-4 h-4 shrink-0 text-primary animate-spin" />
              ) : (
                <item.icon className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
              )}
              {!isCompact && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {!isCompact && (
        <div className="px-4 py-4 border-t border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-xs font-black text-primary">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground font-medium truncate">{displayRole}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
