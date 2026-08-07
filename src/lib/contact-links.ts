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

/**
 * Normaliza un teléfono colombiano al formato que exige wa.me (indicativo
 * incluido, sin signos). Devuelve `null` si no se logra un número confiable —
 * el caller debe avisar en vez de armar un link roto.
 *
 * Función PURA (sin `document`): la usan tanto la UI como los route handlers.
 * Misma regla que el helper del listado de leads crudos.
 */
export function toWhatsAppPhone(phone?: string | null): string | null {
    let d = (phone || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!d) return null;
    if (d.length === 10) d = '57' + d;        // celular local: 3XX XXX XXXX
    if (d.length === 12 && d.startsWith('57')) return d;
    // Otros países / fijos con indicativo ya puesto: aceptamos longitudes
    // plausibles en vez de descartarlas.
    if (d.length >= 11 && d.length <= 15) return d;
    return null;
}

export function openWhatsApp(phone: string, text?: string) {
    const cleaned = (phone || '').replace(/\D/g, '');
    if (!cleaned) return;
    const qs = text ? `?text=${encodeURIComponent(text)}` : '';
    triggerAnchor(`https://wa.me/${cleaned}${qs}`, '_blank');
}

// ─────────────────────────────────────────────────────────────────────────────
// Usuario de WhatsApp (handle), agosto 2026
//
// WhatsApp dejó de identificar a la gente solo por celular: ahora existe el
// "nombre de usuario", un handle único que permite escribirle a alguien sin
// conocer (ni ver) su número. El teléfono NO desaparece — sigue siendo válido
// y es el que tenemos de casi todos los clientes viejos. Por eso acá conviven
// los dos canales y el username es solo el preferido cuando existe.
//
// El link SÍ existe y es el mismo dominio de siempre: wa.me/<usuario>.
// Verificado contra el router de Meta (ago-2026) — wa.me responde 302 a:
//   wa.me/arteconcreto   → api.whatsapp.com/send/?username=arteconcreto&type=username
//   wa.me/573001112233   → api.whatsapp.com/send/?phone=573001112233&type=phone_number
// Es decir, wa.me desambigua solo: si el path trae al menos una letra lo trata
// como usuario, si es puro dígito lo trata como teléfono. Por eso las reglas
// de abajo no son un capricho nuestro: son las que el propio router aplica
// antes de decidir si te manda al chat o a la pantalla de "no encontrado".
//
// `?text=` también funciona con usuario (verificado), así que los mensajes
// pre-cargados que ya usa el CRM siguen sirviendo igual.

/** TLDs que el router de wa.me rechaza al final del handle (verificado). `.co` sí pasa. */
const BLOCKED_TLDS = ['com', 'net', 'org'];

/**
 * Deja el handle en su forma canónica para guardar en DB: sin `@`, sin URL
 * alrededor, sin espacios y en minúscula.
 *
 * Acepta lo que realmente pega un asesor: "@juan.perez", "wa.me/juan.perez",
 * "https://wa.me/juan.perez", o el link largo de api.whatsapp.com.
 */
export function normalizeWhatsAppUser(raw: string): string {
    let v = (raw || '').trim();
    if (!v) return '';

    // Link largo: api.whatsapp.com/send/?username=xxx&type=username
    const fromQuery = v.match(/[?&]username=([^&\s]+)/i);
    if (fromQuery) {
        v = decodeURIComponent(fromQuery[1]);
    } else {
        // Link corto en cualquiera de sus formas (con o sin protocolo/www).
        v = v.replace(/^https?:\/\//i, '').replace(/^www\.wa\.me\//i, '').replace(/^wa\.me\//i, '');
        // Si quedó una query pegada ("juan.perez?text=hola"), la soltamos.
        v = v.split(/[?#]/)[0];
    }

    return v.replace(/^@+/, '').trim().toLowerCase();
}

/**
 * Valida el handle ya normalizado. Devuelve el motivo del rechazo en español
 * (para mostrarlo bajo el input) o `null` si está bien.
 *
 * Replica las reglas del router de wa.me para que el asesor se entere acá y no
 * después, cuando el cliente reciba un link que cae en "no encontrado".
 */
export function whatsAppUserError(user: string): string | null {
    if (!user) return null; // vacío = campo opcional sin llenar, no es un error
    if (user.length < 3) return 'Debe tener al menos 3 caracteres.';
    if (user.length > 35) return 'No puede pasar de 35 caracteres.';
    if (!/^[a-z0-9._]+$/.test(user)) return 'Solo letras sin tilde, números, punto y guion bajo (sin espacios ni guion medio).';
    if (!/[a-z]/.test(user)) return 'Debe llevar al menos una letra — si son puros números, va en el campo Teléfono.';
    if (user.startsWith('.') || user.endsWith('.')) return 'No puede empezar ni terminar en punto.';
    if (user.startsWith('www.')) return 'No puede empezar por "www.".';
    const tld = user.split('.').pop() || '';
    if (BLOCKED_TLDS.includes(tld)) return `No puede terminar en ".${tld}" (WhatsApp lo bloquea).`;
    return null;
}

/** `true` si el handle sirve para armar un link que WhatsApp va a resolver. */
export function isValidWhatsAppUser(user: string): boolean {
    return !!user && whatsAppUserError(user) === null;
}

/** Link público al chat por usuario. `null` si el handle no es válido. */
export function whatsAppUserUrl(user: string, text?: string): string | null {
    const clean = normalizeWhatsAppUser(user);
    if (!isValidWhatsAppUser(clean)) return null;
    const qs = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${clean}${qs}`;
}

/** Handle listo para mostrar en pantalla, con `@` adelante. */
export function formatWhatsAppUser(user: string): string {
    const clean = normalizeWhatsAppUser(user);
    return clean ? `@${clean}` : '';
}

export type WhatsAppChannel = 'username' | 'phone';

/**
 * Abre el chat del contacto por el mejor canal disponible y devuelve cuál usó
 * (o `null` si el contacto no tiene ni usuario ni teléfono utilizables).
 *
 * Prefiere el usuario sobre el teléfono: es el canal que sobrevive a un cambio
 * de número y el único que funciona con clientes que ya ocultaron el suyo.
 *
 * El valor de retorno es lo que la UI usa para registrar el evento de contacto
 * con el canal correcto — no adivinamos en el call site.
 */
export function openWhatsAppContact(
    contact: { whatsappUser?: string; phone?: string },
    text?: string
): WhatsAppChannel | null {
    const url = whatsAppUserUrl(contact.whatsappUser || '', text);
    if (url) {
        triggerAnchor(url, '_blank');
        return 'username';
    }
    const cleaned = (contact.phone || '').replace(/\D/g, '');
    if (cleaned) {
        openWhatsApp(cleaned, text);
        return 'phone';
    }
    return null;
}
