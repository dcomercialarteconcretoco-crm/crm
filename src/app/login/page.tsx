"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { Lock, User, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

export default function LoginPage() {
    const { login, currentUser } = useApp();
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPasswordHint, setShowPasswordHint] = useState(false);

    const [forgotUsername, setForgotUsername] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotError, setForgotError] = useState('');

    const handleForgotPassword = async (e?: React.FormEvent | React.MouseEvent) => {
        e?.preventDefault();
        if (!forgotUsername.trim()) return;
        setForgotLoading(true);
        setForgotError('');
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: forgotUsername.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setForgotError(data.error || 'No se pudo enviar el enlace. Intenta de nuevo.');
                return;
            }
            setForgotSent(true);
        } catch {
            setForgotError('Error de conexión. Intenta de nuevo.');
        } finally {
            setForgotLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) router.push('/');
    }, [currentUser, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        const success = await login(username, password);
        if (success) {
            router.push('/');
        } else {
            setError('Credenciales inválidas. Verifica tu usuario y contraseña.');
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#f5a623] text-foreground">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.12)_1px,transparent_0)] bg-[length:24px_24px] opacity-25" />
            <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-white/24 blur-3xl" />
            <div className="absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-[#70d6bc]/30 blur-3xl" />

            <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl items-center p-4 sm:p-6 lg:p-8">
                <div className="w-full rounded-[2rem] bg-white/22 p-2 shadow-[0_30px_90px_rgba(92,55,0,0.25)] backdrop-blur-xl">
                    <section className="rounded-[1.65rem] bg-white/96 px-6 py-7 shadow-xl sm:px-9 sm:py-10">
                    {/* Logo & title */}
                    <div className="mb-7">
                        <img
                            src="/logo-arteconcreto.png"
                            alt="Arte Concreto"
                            className="mb-6 h-16 w-auto object-contain"
                        />
                        <h1 className="text-4xl font-black leading-tight text-foreground tracking-normal">
                            Intelligence <span className="text-primary">Core</span>
                        </h1>
                        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Acceso restringido · ArteConcreto</p>
                    </div>

                    {/* Login card */}
                    <div className="rounded-[1.6rem] border border-border bg-white p-6 shadow-[0_18px_42px_rgba(72,58,39,0.12)] sm:p-7">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Ingreso seguro</p>
                                <h2 className="mt-1 text-xl font-black tracking-normal text-foreground">Bienvenido de vuelta</h2>
                            </div>
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                        </div>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Usuario</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="nombre.usuario"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full rounded-2xl border border-border bg-white/80 py-3.5 pl-10 pr-4 text-sm font-semibold text-foreground outline-none transition-all placeholder:text-muted-foreground/55 focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(245,166,35,0.13)]"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Contraseña</label>
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordHint(v => !v)}
                                    className="text-[10px] font-semibold text-primary hover:underline"
                                >
                                    ¿Olvidaste tu clave?
                                </button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-2xl border border-border bg-white/80 py-3.5 pl-10 pr-11 text-sm font-semibold text-foreground outline-none transition-all placeholder:text-muted-foreground/55 focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(245,166,35,0.13)]"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Forgot password panel */}
                        {showPasswordHint && (
                            <div className="rounded-2xl bg-sky-50 border border-sky-200 overflow-hidden animate-in fade-in duration-200">
                                {!forgotSent ? (
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 text-sky-500" />
                                            <p className="text-xs font-bold text-sky-600">Recuperar contraseña</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Ingresa tu usuario o correo y te enviaremos un enlace.</p>
                                        <input
                                            type="text"
                                            placeholder="Usuario o correo electrónico"
                                            value={forgotUsername}
                                            onChange={e => setForgotUsername(e.target.value)}
                                            className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-sky-400 transition-all"
                                            required
                                        />
                                        {forgotError && <p className="text-xs text-rose-500 font-medium">{forgotError}</p>}
                                        <button
                                            type="button"
                                            onClick={handleForgotPassword}
                                            disabled={forgotLoading}
                                            className="w-full py-2 rounded-xl bg-sky-500 text-white font-bold text-xs hover:bg-sky-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                        >
                                            {forgotLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Enviar enlace'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-4 flex items-start gap-3">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-emerald-600">Correo enviado</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Si el usuario existe, recibirás un enlace en tu bandeja de entrada.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 animate-in fade-in duration-200">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                <p className="text-xs font-medium text-rose-600">{error}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={clsx(
                                "w-full py-3.5 rounded-full font-black text-sm transition-all flex items-center justify-center gap-2",
                                loading
                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : "bg-primary text-black hover:brightness-105 shadow-[0_12px_28px_rgba(245,166,35,0.32)] hover:shadow-[0_16px_34px_rgba(245,166,35,0.42)] active:scale-95"
                            )}
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Iniciar Sesión</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer note */}
                    <div className="mt-6 pt-6 border-t border-border text-center space-y-2">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Al ingresar certificas que eres personal autorizado por<br />
                            <span className="font-semibold text-foreground">Industrias ArteConcreto S.A.S</span>
                        </p>
                        <div className="flex items-center justify-center gap-1.5 opacity-70">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-medium text-muted-foreground">Conexión Encriptada SSL-256</span>
                        </div>
                    </div>
                    </div>

                    {/* Powered by */}
                    <div className="mt-7 flex flex-col items-center gap-3 opacity-55">
                        <a
                            href="https://miwibi.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:opacity-100 transition-opacity"
                        >
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Powered by</span>
                            <img
                                src="/miwibilogo_1@4x.png"
                                alt="MiWibi"
                                className="h-3.5 object-contain opacity-40 brightness-0"
                            />
                        </a>
                        <p className="text-[9px] text-muted-foreground">V 7.2.0 · © 2026 ArteConcreto Intelligence</p>
                    </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
