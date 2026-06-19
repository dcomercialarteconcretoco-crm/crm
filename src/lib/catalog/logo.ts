/**
 * Carga el logo de ArteConcreto como data URL PNG (con transparencia) para el
 * PDF. Local primero (rápido), y si en serverless el asset no está en el lambda,
 * cae al CDN del sitio. keepAlpha conserva la transparencia para que se vea
 * limpio dentro de la píldora blanca de la portada/header.
 */
import { loadImageDataUrl } from './catalog-image';

// Logo de marca sobre fondo claro (el que va en la píldora blanca).
const LOCAL_LOGO = '/logo-arteconcreto.png';
const CDN_LOGO = 'https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png';

let cached: string | null | undefined;

export async function loadBrandLogo(): Promise<string | null> {
    if (cached !== undefined) return cached;
    // 1) local
    let logo = await loadImageDataUrl(LOCAL_LOGO, { maxPx: 600, keepAlpha: true });
    // 2) CDN si el local no estaba (lambda)
    if (!logo) logo = await loadImageDataUrl(CDN_LOGO, { maxPx: 600, keepAlpha: true });
    cached = logo;
    return logo;
}
