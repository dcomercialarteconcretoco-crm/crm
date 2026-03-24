/**
 * ============================================================
 *  COTIZADOR ARTE CONCRETO — WordPress Snippet
 *  Pegar en: Apariencia → Personalizar → CSS adicional
 *  O en un plugin de snippets (ej. WPCode / Code Snippets)
 *  bajo la opción "JavaScript" o en functions.php (wp_footer)
 * ============================================================
 *
 *  INSTRUCCIONES DE INSTALACIÓN:
 *  1. Abre WPCode (o cualquier plugin de snippets) en tu WP
 *  2. Crea un nuevo snippet → tipo "JavaScript"
 *  3. Pega TODO el código de abajo
 *  4. Actívalo — listo.
 *
 *  Qué hace:
 *  - En cada página de producto WooCommerce añade el botón
 *    "💬 Solicitar Cotización" junto al botón "Añadir al carrito"
 *  - Al hacer clic abre un modal con el formulario del CRM
 *    pre-cargado con el nombre, precio, SKU e imagen del producto
 *  - Al enviar, crea el lead en el CRM y envía el email al cliente
 * ============================================================
 */

(function () {
  'use strict';

  var CRM_URL = 'https://crm-intelligence-six.vercel.app';

  // ─── Inyectar estilos del modal ───────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#mwb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .25s ease}',
    '#mwb-overlay.mwb-visible{opacity:1}',
    '#mwb-modal{background:#fff;border-radius:28px;overflow:hidden;width:100%;max-width:460px;max-height:92vh;box-shadow:0 24px 80px rgba(0,0,0,.22);transform:translateY(20px) scale(.97);transition:transform .28s cubic-bezier(.34,1.56,.64,1),opacity .25s ease;opacity:0;position:relative}',
    '#mwb-overlay.mwb-visible #mwb-modal{transform:translateY(0) scale(1);opacity:1}',
    '#mwb-modal iframe{width:100%;height:600px;max-height:85vh;border:none;display:block}',
    '#mwb-close{position:absolute;top:12px;right:12px;z-index:1;background:rgba(0,0,0,.06);border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;color:#555;transition:background .15s}',
    '#mwb-close:hover{background:rgba(0,0,0,.13)}',
    '.mwb-btn{display:inline-flex!important;align-items:center;gap:8px;background:#fab510!important;color:#000!important;font-weight:900!important;font-size:14px!important;padding:14px 24px!important;border-radius:14px!important;cursor:pointer!important;border:none!important;text-decoration:none!important;margin-top:10px!important;transition:background .15s,transform .1s!important;letter-spacing:.5px!important;white-space:nowrap!important}',
    '.mwb-btn:hover{background:#f0aa00!important;transform:translateY(-1px)!important}',
    '.mwb-btn svg{width:16px;height:16px;flex-shrink:0}'
  ].join('');
  document.head.appendChild(style);

  // ─── Crear overlay + modal (una sola vez) ─────────────────
  var overlay = document.createElement('div');
  overlay.id = 'mwb-overlay';
  overlay.innerHTML = '<div id="mwb-modal"><button id="mwb-close" aria-label="Cerrar">✕</button><iframe id="mwb-iframe" src="" title="Cotizador Arte Concreto" allow="clipboard-write"></iframe></div>';
  document.body.appendChild(overlay);

  var modal   = document.getElementById('mwb-modal');
  var iframe  = document.getElementById('mwb-iframe');
  var closeBtn = document.getElementById('mwb-close');

  function openModal(url) {
    iframe.src = url;
    overlay.classList.add('mwb-visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('mwb-visible');
    document.body.style.overflow = '';
    // Limpia src con pequeño delay para que la animación termine
    setTimeout(function () { iframe.src = ''; }, 300);
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  // Escuchar mensajes del iframe (éxito o cierre)
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'cotizar-close' || e.data.type === 'cotizar-success') {
      closeModal();
    }
  });

  // Cerrar con Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // ─── Leer datos del producto WooCommerce ──────────────────
  function getProductData() {
    // Nombre del producto
    var titleEl = document.querySelector('.product_title, h1.entry-title, h1.product_title');
    var name = titleEl ? titleEl.textContent.trim() : document.title;

    // Precio (limpia el símbolo y puntos de miles)
    var priceEl = document.querySelector('.price ins .amount, .price > .amount, p.price .amount, .woocommerce-Price-amount');
    var priceText = priceEl ? priceEl.textContent.replace(/[^\d]/g, '') : '0';
    var price = parseInt(priceText, 10) || 0;

    // SKU
    var skuEl = document.querySelector('.sku');
    var sku = skuEl ? skuEl.textContent.trim() : '';

    // Imagen principal del producto
    var imgEl = document.querySelector('.woocommerce-product-gallery__image img, .product img.wp-post-image');
    var image = imgEl ? (imgEl.getAttribute('data-large_image') || imgEl.getAttribute('data-src') || imgEl.src) : '';

    return { name: name, price: price, sku: sku, image: image };
  }

  // ─── Insertar botón en la página de producto ──────────────
  function insertButton() {
    // Solo en páginas de producto WooCommerce
    if (!document.body.classList.contains('single-product') &&
        !document.querySelector('.product.type-product')) return;

    // Evitar duplicados
    if (document.getElementById('mwb-cot-btn')) return;

    var target = document.querySelector('.cart, form.cart, .woocommerce-variation-add-to-cart, .single_add_to_cart_button');
    if (!target) return;

    var btn = document.createElement('button');
    btn.id = 'mwb-cot-btn';
    btn.className = 'mwb-btn';
    btn.type = 'button';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg> Solicitar Cotización';

    btn.addEventListener('click', function () {
      var d = getProductData();
      var params = new URLSearchParams({
        productName:  d.name,
        productPrice: String(d.price),
        productSku:   d.sku,
        productImage: d.image,
        quantity:     '1',
        embed:        '1'
      });
      openModal(CRM_URL + '/public/cotizar?' + params.toString());
    });

    // Insertar después del botón del carrito
    var cartBtn = target.querySelector('.single_add_to_cart_button, button[type="submit"]');
    if (cartBtn && cartBtn.parentNode) {
      cartBtn.parentNode.insertBefore(btn, cartBtn.nextSibling);
    } else {
      target.parentNode.insertBefore(btn, target.nextSibling);
    }
  }

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertButton);
  } else {
    insertButton();
  }

})();
