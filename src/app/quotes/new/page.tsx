"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QuoteEngine from '@/components/quotes/QuoteEngine';

function NewQuoteContent() {
    const searchParams = useSearchParams();
    const clientId = searchParams.get('clientId') || '';

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Nueva Cotización</h1>
                <p className="text-muted-foreground">Genera presupuestos personalizados para productos de Arte Concreto.</p>
            </div>

            <QuoteEngine defaultClientId={clientId} />
        </div>
    );
}

export default function NewQuotePage() {
    return (
        <Suspense fallback={<div className="p-8 text-muted-foreground">Cargando...</div>}>
            <NewQuoteContent />
        </Suspense>
    );
}
