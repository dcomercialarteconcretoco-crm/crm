"use client";

import React from 'react';
import QuoteEngine from '@/components/quotes/QuoteEngine';

export default function NewQuotePage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Nueva Cotización</h1>
                <p className="text-muted-foreground">Genera presupuestos personalizados para productos de Arte Concreto.</p>
            </div>

            <QuoteEngine />
        </div>
    );
}
