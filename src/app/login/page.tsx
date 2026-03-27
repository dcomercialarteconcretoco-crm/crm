"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { Lock, User, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Mail } from 'lucide-react';
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

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotUsername.trim()) return;
        setForgotLoading(true);
        setForgotError('');
        try {
            await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: forgotUsername.trim() }),
            });
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
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="w-full max-w-sm">
                {/* Logo & title */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-5">
                        <img
                            src="https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png"
                            alt="Arte Concreto"
                            className="h-16 w-auto object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-black text-foreground tracking-tight">
                        Intelligence <span className="text-primary">Core</span>
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-medium">Acceso restringido · ArteConcreto</p>
                </div>

                {/* Login card */}
                <div className="bg-white border border-border rounded-2xl p-8 shadow-lg">
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
                                    className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
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
                                    className="w-full bg-muted border border-border rounded-xl pl-10 pr-11 py-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
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
                            <div className="rounded-xl bg-sky-50 border border-sky-200 overflow-hidden animate-in fade-in duration-200">
                                {!forgotSent ? (
                                    <form onSubmit={handleForgotPassword} className="p-4 space-y-3">
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
                                            className="w-full bg-white border border-sky-200 rounded-lg px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-sky-400 transition-all"
                                            required
                                        />
                                        {forgotError && <p className="text-xs text-rose-500 font-medium">{forgotError}</p>}
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="w-full py-2 rounded-lg bg-sky-500 text-white font-bold text-xs hover:bg-sky-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                        >
                                            {forgotLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Enviar enlace'}
                                        </button>
                                    </form>
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
                                "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                                loading
                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : "bg-primary text-black hover:brightness-105 shadow-[0_4px_16px_rgba(250,181,16,0.35)] hover:shadow-[0_6px_20px_rgba(250,181,16,0.45)] active:scale-95"
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
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
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
                <div className="mt-8 flex flex-col items-center gap-3 opacity-50">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Powered by</span>
                        <img
                            src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                            alt="MiWibi"
                            className="h-3.5 object-contain brightness-0"
                        />
                    </div>
                    <p className="text-[9px] text-muted-foreground">V 2.0.4 · © 2026 Arte Concreto Intelligence</p>
                </div>
            </div>
        </div>
    );
}
