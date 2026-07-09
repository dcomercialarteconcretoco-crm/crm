"use client";

import type { Client, Quote, Seller } from '@/context/AppContext';
import { generateProposalPDF } from '@/lib/pdf-generator';

export function quoteDisplayNumber(quote: Quote) {
    return quote.quoteNumber || quote.number || '';
}

function itemDimensions(item: NonNullable<Quote['items']>[number]) {
    const has = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '0';
    if (has(item.height) || has(item.width) || has(item.length) || has(item.weight)) {
        const parts: string[] = [];
        if (has(item.height)) parts.push(`Alto: ${item.height}cm`);
        if (has(item.width)) parts.push(`Ancho: ${item.width}cm`);
        if (has(item.length)) parts.push(`Largo: ${item.length}cm`);
        if (has(item.weight)) parts.push(`Peso: ${item.weight}kg`);
        return parts.join('\n');
    }
    return item.dimensions;
}

export async function downloadQuotePdf(
    quote: Quote,
    opts: {
        clients: Client[];
        sellers: Seller[];
        currentUser?: Seller | null;
    }
) {
    const client = opts.clients.find(c => c.id === quote.clientId);
    const sellerForQuote = quote.sellerId ? opts.sellers.find(s => s.id === quote.sellerId) : null;
    const sellerEmailForQuote = sellerForQuote?.email || opts.currentUser?.email || '';
    const hasLegacyAiuMath = !!(quote.aiuData && (quote.aiuData.totalAIU || quote.aiuData.transportPrice || quote.aiuData.installationPrice));
    const isNewModel = !!quote.quoteMode && !hasLegacyAiuMath;
    const base = {
        quoteNumber: quoteDisplayNumber(quote) || 'AC-XXX',
        date: quote.date || new Date().toLocaleDateString('es-CO'),
        leadName: quote.client || 'Cliente',
        leadCompany: quote.clientCompany || client?.company || '',
        leadEmail: quote.clientEmail || client?.email || '',
        leadCity: client?.city || '',
        hideContactName: quote.hideContactName,
        referencia: quote.referencia,
        validUntil: quote.validUntil,
        deliveryTime: quote.deliveryTime,
        paymentTerms: quote.paymentTerms,
        sellerName: quote.sellerName,
        sellerPhone: quote.sellerPhone,
        sellerEmail: sellerEmailForQuote,
        items: (quote.items || []).map(i => ({
            name: i.name,
            unitPrice: i.price,
            priceBeforeTax: i.priceBeforeTax,
            taxRate: i.taxRate,
            quantity: i.quantity,
            unit: i.unit || 'Und',
            image: i.image,
            dimensions: itemDimensions(i),
        })),
        observations: quote.observations,
    };

    if (isNewModel) {
        await generateProposalPDF({
            ...base,
            mode: quote.quoteMode,
            includesTransport: quote.includesTransport,
            transportAmount: quote.transportAmount,
            transportCity: quote.transportCity,
            adminPercent: quote.adminPercent,
            utilityPercent: quote.utilityPercent,
            deliveryLocation: quote.deliveryLocation,
        });
        return;
    }

    await generateProposalPDF({
        ...base,
        isAIU: quote.isAIU,
        aiuData: quote.aiuData,
        subtotal: quote.subtotal || quote.numericTotal || 0,
        tax: quote.tax || (quote.numericTotal || 0) * 0.19 / 1.19,
        total: quote.numericTotal || 0,
        shipping: quote.shipping,
        shippingCity: quote.shippingCity,
    });
}
