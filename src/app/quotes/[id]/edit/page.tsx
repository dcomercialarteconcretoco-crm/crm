"use client";

import { use } from 'react';
import QuoteEngine from '@/components/quotes/QuoteEngine';

export default function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Editar Cotización</h1>
                <p className="text-muted-foreground">Modifica los productos y cliente de la cotización.</p>
            </div>
            <QuoteEngine editQuoteId={id} />
        </div>
    );
}
