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
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="https://cuantium.com/wp-content/uploads/2026/02/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Nueva <span className="text-primary">Contraseña</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-medium">CRM Intelligence · ArteConcreto</p>
        </div>

        <div className="bg-white border border-border rounded-2xl p-8 shadow-lg">
          {validating && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs font-medium text-muted-foreground">Verificando enlace…</p>
            </div>
          )}

          {!validating && !tokenValid && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-rose-500" />
              </div>
              <div>
                <p className="font-bold text-foreground text-base mb-1">Enlace inválido</p>
                <p className="text-sm text-muted-foreground">Este enlace ha expirado o ya fue utilizado. Solicita uno nuevo desde el inicio de sesión.</p>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:brightness-105 transition-all"
              >
                Ir al inicio de sesión
              </button>
            </div>
          )}

          {!validating && tokenValid && !done && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {userName && (
                <div className="px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-xs font-bold text-primary">Hola, {userName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ingresa tu nueva contraseña a continuación.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl pl-10 pr-11 py-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                    required
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Confirmar contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repite tu nueva contraseña"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl pl-10 pr-11 py-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {password.length > 0 && (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={clsx(
                      "h-1.5 flex-1 rounded-full transition-all",
                      password.length >= i * 3
                        ? i <= 1 ? 'bg-rose-400' : i <= 2 ? 'bg-amber-400' : i <= 3 ? 'bg-yellow-400' : 'bg-emerald-400'
                        : 'bg-muted'
                    )} />
                  ))}
                </div>
              )}

              {error && (
                <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-xs font-medium text-rose-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={clsx(
                  "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                  loading ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-black hover:brightness-105 shadow-[0_4px_16px_rgba(250,181,16,0.35)] active:scale-95"
                )}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  : <><span>Guardar nueva contraseña</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>
          )}

          {done && (
            <div className="flex flex-col items-center gap-4 py-6 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-foreground text-base mb-1">¡Contraseña actualizada!</p>
                <p className="text-sm text-muted-foreground">Serás redirigido al inicio de sesión en un momento…</p>
              </div>
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
