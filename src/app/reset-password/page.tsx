"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setValidating(false); return; }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(r => r.json())
      .then(data => {
        setTokenValid(data.valid);
        setUserName(data.name || '');
      })
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al restablecer.'); setLoading(false); return; }
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-premium-gradient">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/12 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8 space-y-2">
          <div className="flex justify-center mb-4">
            <img
              src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
              alt="Logo"
              className="w-36 h-36 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]"
            />
          </div>
          <h1 className="text-3xl font-black text-foreground italic tracking-tighter uppercase">
            Nueva <span className="text-primary not-italic">Contraseña</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">CRM Intelligence • ArteConcreto</p>
        </div>

        <div className="surface-panel rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

          {validating && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Verificando enlace…</p>
            </div>
          )}

          {!validating && !tokenValid && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>
              <div>
                <p className="font-black text-foreground text-lg mb-1">Enlace inválido</p>
                <p className="text-[11px] text-muted-foreground">Este enlace ha expirado o ya fue utilizado.<br/>Solicita uno nuevo desde el inicio de sesión.</p>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="mt-4 px-6 py-3 rounded-2xl bg-primary text-black font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform"
              >
                Ir al inicio de sesión
              </button>
            </div>
          )}

          {!validating && tokenValid && !done && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {userName && (
                <div className="px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-[11px] font-black text-primary uppercase tracking-wider">Hola, {userName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ingresa tu nueva contraseña a continuación.</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nueva contraseña</label>
                <div className="relative group/input">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within/input:text-primary transition-colors" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white/70 border border-white/80 rounded-2xl pl-12 pr-12 py-4 text-foreground font-bold outline-none focus:border-primary/50 focus:bg-white transition-all shadow-inner placeholder:text-muted-foreground/60"
                    required
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Confirmar contraseña</label>
                <div className="relative group/input">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within/input:text-primary transition-colors" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repite tu nueva contraseña"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full bg-white/70 border border-white/80 rounded-2xl pl-12 pr-12 py-4 text-foreground font-bold outline-none focus:border-primary/50 focus:bg-white transition-all shadow-inner placeholder:text-muted-foreground/60"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Strength indicator */}
              {password.length > 0 && (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={clsx(
                      "h-1.5 flex-1 rounded-full transition-all",
                      password.length >= i * 3
                        ? i <= 1 ? 'bg-rose-400' : i <= 2 ? 'bg-amber-400' : i <= 3 ? 'bg-yellow-400' : 'bg-emerald-400'
                        : 'bg-border'
                    )} />
                  ))}
                </div>
              )}

              {error && (
                <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 animate-in fade-in duration-300">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={clsx(
                  "w-full py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/10",
                  loading ? "bg-muted text-muted-foreground" : "bg-primary text-black hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
                  : <><span>Guardar nueva contraseña</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>
          )}

          {done && (
            <div className="flex flex-col items-center gap-4 py-8 text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <p className="font-black text-foreground text-lg mb-1">¡Contraseña actualizada!</p>
                <p className="text-[11px] text-muted-foreground">Serás redirigido al inicio de sesión en un momento…</p>
              </div>
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mt-2" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-premium-gradient flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
