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

    // Forgot password state
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
        if (currentUser) {
            router.push('/');
        }
    }, [currentUser, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Slow down slightly for effect
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
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-premium-gradient">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/12 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="w-full max-w-md z-10">
                <div className="text-center mb-8 space-y-2">
                    <div className="flex justify-center mb-4">
                        <img
                            src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
                            alt="Logo"
                            className="w-44 h-44 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.15)] animate-in zoom-in duration-1000 md:w-48 md:h-48"
                        />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-foreground italic tracking-tighter uppercase leading-none">
                            Intelligence <span className="text-primary not-italic">Core</span>
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mt-1">Acceso restringido • ArteConcreto</p>
                    </div>
                </div>

                <div className="surface-panel rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Usuario</label>
                            <div className="relative group/input">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within/input:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="nombre.usuario"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-white/70 border border-white/80 rounded-2xl pl-12 pr-4 py-4 text-foreground font-bold outline-none focus:border-primary/50 focus:bg-white transition-all shadow-inner placeholder:text-muted-foreground/60"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Contraseña</label>
                                <button type="button" onClick={() => setShowPasswordHint(true)} className="text-[9px] font-black uppercase text-primary/50 hover:text-primary transition-colors">¿Olvidaste tu clave?</button>
                            </div>
                            <div className="relative group/input">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within/input:text-primary transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/70 border border-white/80 rounded-2xl pl-12 pr-12 py-4 text-foreground font-bold outline-none focus:border-primary/50 focus:bg-white transition-all shadow-inner placeholder:text-muted-foreground/60"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {showPasswordHint && (
                            <div className="rounded-2xl bg-sky-500/8 border border-sky-500/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                {!forgotSent ? (
                                    <form onSubmit={handleForgotPassword} className="p-4 space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Mail className="w-3.5 h-3.5 text-sky-500" />
                                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-wider">Recuperar contraseña</p>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground leading-relaxed">Ingresa tu usuario o correo. Te enviaremos un enlace para restablecer tu contraseña.</p>
                                        <input
                                            type="text"
                                            placeholder="Usuario o correo electrónico"
                                            value={forgotUsername}
                                            onChange={e => setForgotUsername(e.target.value)}
                                            className="w-full bg-white/70 border border-sky-500/30 rounded-xl px-3 py-2.5 text-[11px] font-bold text-foreground outline-none focus:border-sky-500/60 transition-all placeholder:text-muted-foreground/50"
                                            required
                                        />
                                        {forgotError && <p className="text-[9px] text-rose-500 font-bold">{forgotError}</p>}
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="w-full py-2.5 rounded-xl bg-sky-500 text-white font-black text-[9px] uppercase tracking-widest hover:bg-sky-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                        >
                                            {forgotLoading ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Enviar enlace'}
                                        </button>
                                    </form>
                                ) : (
                                    <div className="p-4 flex items-start gap-3">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">Correo enviado</p>
                                            <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">Si el usuario existe, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={clsx(
                                "w-full py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/10 hover:shadow-primary/20",
                                loading ? "bg-muted text-muted-foreground" : "bg-primary text-black hover:scale-[1.02] active:scale-[0.98]"
                            )}
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>Iniciar Sesión</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-border/50 flex flex-col items-center gap-4 text-center">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-relaxed">
                            Al ingresar certificas que eres personal autorizado por <br />
                            <span className="text-foreground/70">Industrias ArteConcreto S.A.S</span>
                        </p>
                        <div className="flex items-center gap-2 opacity-60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[8px] font-black text-foreground uppercase tracking-tighter">Conexión Encriptada SSL-256</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex flex-col items-center gap-6 opacity-70">
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Powered by</span>
                        <img
                            src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                            alt="MiWibi"
                            className="h-4 object-contain brightness-0 opacity-60 hover:opacity-100 transition-opacity duration-300"
                        />
                    </div>
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">V 2.0.4 • © 2026 ARTE CONCRETO INTELLIGENCE</p>
                </div>
            </div>
        </div>
    );
}
