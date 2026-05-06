// Helpers para abrir mailto:/tel:/wa.me sin que se traguen los clicks.
//
// `window.open('mailto:foo', '_blank')` abre un tab vacío en Chrome moderno —
// el handler nativo no dispara y queda una pestaña en blanco.
//
// `window.location.href = 'mailto:foo'` casi siempre funciona, pero si el SO
// no tiene un mailto handler registrado el browser puede mostrar un prompt
// que algunos usuarios cancelan sin querer y el efecto colateral es cambiar
// la URL actual.
//
// El patrón más portable: crear un <a> real, hacerlo click programáticamente
// y removerlo. El browser lo trata exactamente como si el usuario hubiera
// hecho click en un link nativo.

function triggerAnchor(href: string, target?: '_blank') {
    if (typeof document === 'undefined') return; // SSR safety
    const a = document.createElement('a');
    a.href = href;
    if (target) {
        a.target = target;
        a.rel = 'noopener noreferrer';
    }
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export function openMailto(email: string, opts?: { subject?: string; body?: string }) {
    if (!email) return;
    const params = new URLSearchParams();
    if (opts?.subject) params.set('subject', opts.subject);
    if (opts?.body) params.set('body', opts.body);
    const qs = params.toString();
    triggerAnchor(`mailto:${email}${qs ? '?' + qs : ''}`);
}

export function openTel(phone: string) {
    if (!phone) return;
    triggerAnchor(`tel:${phone}`);
}

export function openWhatsApp(phone: string, text?: string) {
    const cleaned = (phone || '').replace(/\D/g, '');
    if (!cleaned) return;
    const qs = text ? `?text=${encodeURIComponent(text)}` : '';
    triggerAnchor(`https://wa.me/${cleaned}${qs}`, '_blank');
}
