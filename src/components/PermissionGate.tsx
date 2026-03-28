"use client";

import React from 'react';
import { useApp } from '@/context/AppContext';
import { hasPermission, PermissionKey } from '@/lib/permissions';
import { ShieldX } from 'lucide-react';
import Link from 'next/link';

interface PermissionGateProps {
    require: PermissionKey;
    children: React.ReactNode;
    /** Optional fallback — defaults to the full "Acceso restringido" screen */
    fallback?: React.ReactNode;
}

/** Renders children only if currentUser has the required permission.
 *  Otherwise shows a friendly "Acceso restringido" page.
 */
export function PermissionGate({ require: key, children, fallback }: PermissionGateProps) {
    const { currentUser, isHydrating } = useApp();

    if (isHydrating) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!hasPermission(currentUser, key)) {
        if (fallback !== undefined) return <>{fallback}</>;
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                    <ShieldX className="w-10 h-10 text-rose-400" />
                </div>
                <h2 className="text-xl font-black text-foreground mb-2">Acceso restringido</h2>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    No tienes permiso para ver esta sección. Contacta a tu administrador para solicitar acceso.
                </p>
                <Link
                    href="/"
                    className="bg-primary text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-90 transition-all">
                    Volver al Dashboard
                </Link>
            </div>
        );
    }

    return <>{children}</>;
}

/** Inline variant — hides content without showing a full page */
export function PermissionHide({ require: key, children }: { require: PermissionKey; children: React.ReactNode }) {
    const { currentUser } = useApp();
    if (!hasPermission(currentUser, key)) return null;
    return <>{children}</>;
}
