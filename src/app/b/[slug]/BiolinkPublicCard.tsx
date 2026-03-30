"use client";

import React, { useState } from 'react';
import { Send, Download, Phone, Mail, Globe, Instagram, Facebook, Linkedin, MessageCircle, CheckCircle2, X, MapPin, ChevronDown } from 'lucide-react';

interface Biolink {
    id: string; slug: string; name: string; title?: string; photo?: string;
    phone?: string; email?: string; instagram?: string; facebook?: string;
    linkedin?: string; whatsapp?: string; website?: string;
    youtube_url?: string; maps_url?: string;
}
interface Settings {
    form_fields: Record<string, boolean>; theme: string;
    primary_color: string; show_youtube: boolean; show_map: boolean;
}

function getYoutubeEmbedUrl(url: string) {
    try {
        const u = new URL(url);
        let videoId = '';
        if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1);
        else videoId = u.searchParams.get('v') || '';
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch { return null; }
}

function downloadVCard(card: Biolink) {
    const vcf = [
        'BEGIN:VCARD', 'VERSION:3.0',
        `FN:${card.name}`,
        card.title ? `TITLE:${card.title}` : '',
        'ORG:ArteConcreto S.A.S',
        card.phone  ? `TEL;TYPE=WORK,VOICE:${card.phone}` : '',
        card.email  ? `EMAIL;TYPE=WORK:${card.email}` : '',
        card.website ? `URL:${card.website}` : '',
        card.instagram ? `X-SOCIALPROFILE;TYPE=instagram:${card.instagram}` : '',
        card.photo  ? `PHOTO;VALUE=URL:${card.photo}` : '',
        'END:VCARD',
    ].filter(Boolean).join('\r\n');
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${card.name.replace(/\s+/g, '_')}.vcf`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(a.href);
}

export default function BiolinkPublicCard({ card, settings }: { card: Biolink; settings: Settings }) {
    const [showForm, setShowForm] = useState(false);
    const [form, setForm]         = useState({ name: '', email: '', phone: '', city: '' });
    const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [formError, setFormError]   = useState('');

    const pc = settings.primary_color || '#fab510';
    const isDark = settings.theme !== 'light';

    const bg = isDark
        ? `linear-gradient(160deg, #0d0d0e 0%, #1a1a1f 50%, #0d0d0e 100%)`
        : `linear-gradient(160deg, #f8f8fa 0%, #ffffff 50%, #f0f0f5 100%)`;
    const cardBg   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const txtMain  = isDark ? '#ffffff' : '#111111';
    const txtSub   = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
    const border   = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    const inputBg  = isDark ? 'rgba(255,255,255,0.07)' : '#ffffff';
    const inputBdr = isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb';

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus('loading'); setFormError('');
        try {
            const res = await fetch('/api/biolinks/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, biolinkId: card.id, employeeName: card.name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error');
            setFormStatus('success');
        } catch (err: any) {
            setFormError(err.message || 'Error inesperado');
            setFormStatus('error');
        }
    };

    const socials = [
        card.instagram && { label: 'Instagram', href: card.instagram.startsWith('http') ? card.instagram : `https://instagram.com/${card.instagram.replace('@','')}`, icon: <Instagram size={20}/>, color: '#E1306C' },
        card.facebook  && { label: 'Facebook',  href: card.facebook.startsWith('http')  ? card.facebook  : `https://facebook.com/${card.facebook}`,  icon: <Facebook size={20}/>,  color: '#1877F2' },
        card.linkedin  && { label: 'LinkedIn',  href: card.linkedin.startsWith('http')  ? card.linkedin  : `https://linkedin.com/in/${card.linkedin}`, icon: <Linkedin size={20}/>, color: '#0A66C2' },
        card.whatsapp  && { label: 'WhatsApp',  href: `https://wa.me/${card.whatsapp.replace(/\D/g,'')}`, icon: <MessageCircle size={20}/>, color: '#25D366' },
        card.website   && { label: 'Web',       href: card.website,  icon: <Globe size={20}/>,    color: pc },
        card.phone     && { label: 'Llamar',    href: `tel:${card.phone}`, icon: <Phone size={20}/>, color: pc },
        card.email     && { label: 'Email',     href: `mailto:${card.email}`, icon: <Mail size={20}/>, color: pc },
    ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode; color: string }[];

    const youtubeEmbed = (settings.show_youtube && card.youtube_url) ? getYoutubeEmbedUrl(card.youtube_url) : null;

    return (
        <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px 48px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>

                {/* Hero: logo left + photo right */}
                <div style={{ padding: '28px 0 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <img
                            src="/api/logo"
                            alt="Arte Concreto"
                            style={{ height: 72, objectFit: 'contain', filter: isDark ? 'brightness(0) invert(1)' : 'none', opacity: isDark ? 0.95 : 0.85 }}
                        />
                        {card.photo ? (
                            <img src={card.photo} alt={card.name}
                                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${pc}`, boxShadow: `0 0 0 5px ${pc}20` }} />
                        ) : (
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: `${pc}20`, border: `3px solid ${pc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, color: pc }}>
                                {card.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: txtMain, letterSpacing: '-0.5px' }}>{card.name}</h1>
                    {card.title && <p style={{ margin: '6px 0 0', fontSize: 14, color: txtSub, fontWeight: 500 }}>{card.title}</p>}
                </div>

                {/* Social links */}
                {socials.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                        {socials.map(s => (
                            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                                style={{ width: 48, height: 48, borderRadius: 14, background: cardBg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, textDecoration: 'none', transition: 'transform .15s', flexShrink: 0 }}
                                title={s.label}>
                                {s.icon}
                            </a>
                        ))}
                    </div>
                )}

                {/* CTA buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                    <button onClick={() => setShowForm(v => !v)}
                        style={{ width: '100%', padding: '16px 24px', borderRadius: 16, background: pc, color: '#000', fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.02em', boxShadow: `0 8px 24px ${pc}40` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Send size={16} />
                            <span>DEJAR MIS DATOS</span>
                        </div>
                        <ChevronDown size={16} style={{ transform: showForm ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }} />
                    </button>

                    {/* Lead form (inline) */}
                    {showForm && (
                        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, marginTop: -4 }}>
                            {formStatus === 'success' ? (
                                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                    <CheckCircle2 size={36} style={{ color: '#22c55e', margin: '0 auto 8px', display: 'block' }} />
                                    <p style={{ margin: 0, fontWeight: 900, color: txtMain, fontSize: 15 }}>¡Gracias!</p>
                                    <p style={{ margin: '4px 0 0', fontSize: 13, color: txtSub }}>Tus datos fueron recibidos. Un asesor te contactará pronto.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: txtSub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tus datos</p>

                                    {settings.form_fields?.name !== false && (
                                        <input required type="text" placeholder="Nombre completo *" value={form.name}
                                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                            style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${inputBdr}`, background: inputBg, color: txtMain, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                                    )}
                                    {settings.form_fields?.email !== false && (
                                        <input required type="email" placeholder="Correo electrónico *" value={form.email}
                                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                            style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${inputBdr}`, background: inputBg, color: txtMain, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                                    )}
                                    {settings.form_fields?.phone !== false && (
                                        <input type="tel" placeholder="Teléfono" value={form.phone}
                                            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                            style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${inputBdr}`, background: inputBg, color: txtMain, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                                    )}
                                    {settings.form_fields?.city !== false && (
                                        <input type="text" placeholder="Ciudad" value={form.city}
                                            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                                            style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${inputBdr}`, background: inputBg, color: txtMain, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                                    )}

                                    {formStatus === 'error' && (
                                        <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{formError}</p>
                                    )}

                                    <button type="submit" disabled={formStatus === 'loading'}
                                        style={{ padding: '13px', borderRadius: 12, background: pc, color: '#000', fontWeight: 900, fontSize: 13, border: 'none', cursor: 'pointer', opacity: formStatus === 'loading' ? 0.6 : 1 }}>
                                        {formStatus === 'loading' ? 'Enviando...' : 'Enviar mis datos →'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    <button onClick={() => downloadVCard(card)}
                        style={{ width: '100%', padding: '16px 24px', borderRadius: 16, background: cardBg, color: txtMain, fontWeight: 900, fontSize: 14, border: `1px solid ${border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.02em' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Download size={16} style={{ color: pc }} />
                            <span>DESCARGAR CONTACTO</span>
                        </div>
                        <span style={{ fontSize: 11, color: txtSub, fontWeight: 500 }}>vCard .vcf</span>
                    </button>
                </div>

                {/* YouTube embed */}
                {youtubeEmbed && (
                    <div style={{ marginBottom: 24, borderRadius: 16, overflow: 'hidden', background: '#000', border: `1px solid ${border}` }}>
                        <iframe src={youtubeEmbed} title="Video" allowFullScreen
                            style={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block' }} />
                    </div>
                )}

                {/* Google Maps embed */}
                {settings.show_map && card.maps_url && (
                    <div style={{ marginBottom: 24, borderRadius: 16, overflow: 'hidden', border: `1px solid ${border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: cardBg, borderBottom: `1px solid ${border}` }}>
                            <MapPin size={14} style={{ color: pc }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: txtSub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ubicación</span>
                        </div>
                        <iframe src={card.maps_url} title="Mapa" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                            style={{ width: '100%', height: 220, border: 'none', display: 'block' }} />
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', paddingTop: 16 }}>
                    <p style={{ margin: 0, fontSize: 10, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        Powered by <span style={{ color: pc }}>MiWibiCRM</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
