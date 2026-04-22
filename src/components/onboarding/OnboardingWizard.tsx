"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, X, Check, ExternalLink } from 'lucide-react';
import { useApp, type Seller } from '@/context/AppContext';
import { buildSteps, type WizardStep } from './steps';

interface OnboardingWizardProps {
    user: Seller;
    isMandatory: boolean;
    onComplete: () => void;
    /** Called when user hits Skip (only available when !isMandatory). */
    onSkip: () => void;
}

const ACCENT_CLASSES: Record<WizardStep['accent'], { bg: string; text: string; ring: string; bar: string }> = {
    primary: { bg: 'bg-primary/10',   text: 'text-primary',      ring: 'ring-primary/30',      bar: 'bg-primary' },
    indigo:  { bg: 'bg-indigo-500/10',text: 'text-indigo-600',   ring: 'ring-indigo-500/30',   bar: 'bg-indigo-500' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', ring: 'ring-emerald-500/30', bar: 'bg-emerald-500' },
    rose:    { bg: 'bg-rose-500/10',  text: 'text-rose-600',     ring: 'ring-rose-500/30',     bar: 'bg-rose-500' },
    violet:  { bg: 'bg-violet-500/10',text: 'text-violet-600',   ring: 'ring-violet-500/30',   bar: 'bg-violet-500' },
    amber:   { bg: 'bg-amber-500/10', text: 'text-amber-600',    ring: 'ring-amber-500/30',    bar: 'bg-amber-500' },
    sky:     { bg: 'bg-sky-500/10',   text: 'text-sky-600',      ring: 'ring-sky-500/30',      bar: 'bg-sky-500' },
};

export function OnboardingWizard({ user, isMandatory, onComplete, onSkip }: OnboardingWizardProps) {
    const { incrementOnboardingCount } = useApp();
    const steps = useMemo(() => buildSteps(user), [user]);
    const [index, setIndex] = useState(0);
    const [isFinishing, setIsFinishing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const step = steps[index];
    const accent = ACCENT_CLASSES[step.accent];
    const progress = ((index + 1) / steps.length) * 100;
    const isLast = index === steps.length - 1;
    const isFirst = index === 0;

    const goNext = useCallback(async () => {
        if (isLast) {
            setIsFinishing(true);
            try {
                await incrementOnboardingCount();
            } finally {
                onComplete();
            }
            return;
        }
        setIndex(i => Math.min(i + 1, steps.length - 1));
    }, [isLast, steps.length, incrementOnboardingCount, onComplete]);

    const goPrev = useCallback(() => {
        setIndex(i => Math.max(i - 1, 0));
    }, []);

    const handleSkip = useCallback(async () => {
        if (isMandatory) return;
        setIsFinishing(true);
        try {
            await incrementOnboardingCount();
        } finally {
            onSkip();
        }
    }, [isMandatory, incrementOnboardingCount, onSkip]);

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                goNext();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goPrev();
            } else if (e.key === 'Escape' && !isMandatory) {
                e.preventDefault();
                handleSkip();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [goNext, goPrev, handleSkip, isMandatory]);

    // Scroll body lock while open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // Focus the container so keyboard nav works immediately
    useEffect(() => {
        containerRef.current?.focus();
    }, []);

    // Scroll body to top on step change (the content area has its own scroll)
    useEffect(() => {
        const el = containerRef.current?.querySelector<HTMLElement>('[data-step-body]');
        if (el) el.scrollTop = 0;
    }, [index]);

    const Icon = step.icon;

    return (
        <div
            ref={containerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-title"
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm outline-none animate-in fade-in duration-300"
        >
            <div
                className="w-full max-w-3xl max-h-[95vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-500"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress bar */}
                <div className="h-1 bg-muted relative">
                    <div
                        className={clsx("h-full transition-[width] duration-500 ease-out", accent.bar)}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                            Paso {index + 1} de {steps.length}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground/50">·</span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                            {isMandatory ? 'Tour obligatorio' : 'Tour opcional'}
                        </span>
                    </div>
                    {!isMandatory && (
                        <button
                            onClick={handleSkip}
                            disabled={isFinishing}
                            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted disabled:opacity-50"
                            aria-label="Saltar tour"
                        >
                            <X className="w-3.5 h-3.5" />
                            Saltar
                        </button>
                    )}
                </div>

                {/* Body */}
                <div
                    data-step-body
                    className="flex-1 overflow-y-auto px-6 py-8"
                >
                    <div className="flex items-start gap-4 mb-6">
                        <div className={clsx(
                            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ring-4",
                            accent.bg, accent.ring
                        )}>
                            <Icon className={clsx("w-7 h-7", accent.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 id="wizard-title" className="text-2xl font-black text-foreground leading-tight">
                                {step.title}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1 font-medium">
                                {step.subtitle}
                            </p>
                        </div>
                    </div>

                    <div className="pl-[4.5rem]">
                        {step.body}
                        {step.tryIt && (
                            <Link
                                href={step.tryIt.href}
                                onClick={async () => {
                                    // When user clicks "try it" we mark the tour as seen so we don't
                                    // pop it back up after navigation — feels responsive and sane.
                                    try { await incrementOnboardingCount(); } catch {}
                                    onComplete();
                                }}
                                className={clsx(
                                    "mt-5 inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all",
                                    accent.bg, accent.text,
                                    "hover:opacity-80"
                                )}
                            >
                                {step.tryIt.label}
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        )}
                    </div>
                </div>

                {/* Step dots */}
                <div className="px-6 py-3 border-t border-border flex items-center justify-center gap-1.5 bg-muted/50 shrink-0">
                    {steps.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => setIndex(i)}
                            aria-label={`Ir al paso ${i + 1}: ${s.title}`}
                            className={clsx(
                                "rounded-full transition-all",
                                i === index
                                    ? clsx("w-6 h-2", accent.bar)
                                    : i < index
                                        ? "w-2 h-2 bg-foreground/40 hover:bg-foreground/60"
                                        : "w-2 h-2 bg-border hover:bg-foreground/20"
                            )}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0 bg-background">
                    <button
                        onClick={goPrev}
                        disabled={isFirst || isFinishing}
                        className="flex items-center gap-1.5 text-sm font-bold text-foreground px-4 py-2.5 rounded-xl hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                    </button>

                    <button
                        onClick={goNext}
                        disabled={isFinishing}
                        className={clsx(
                            "flex items-center gap-2 text-sm font-black px-6 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50",
                            "bg-primary text-black hover:opacity-90"
                        )}
                    >
                        {isLast ? (
                            <>
                                <Check className="w-4 h-4" />
                                {isFinishing ? 'Guardando…' : 'Terminar'}
                            </>
                        ) : (
                            <>
                                Siguiente
                                <ChevronRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
