<?php
/**
 * Plugin Name: Arte Concreto – Botón Pedir Cotización
 * Description: Agrega un botón "Pedir Cotización" en las páginas de producto WooCommerce. Envía la solicitud al CRM MiWibi y la crea automáticamente en el pipeline.
 * Version: 2.3.0
 * Author: Arte Concreto / MiWibi
 * Text Domain: ac-cotizacion
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ── Configuración ────────────────────────────────────────────────────────────
define( 'AC_CRM_ENDPOINT', 'https://crm-sand-three.vercel.app/api/public/quote-request' );
define( 'AC_BUTTON_COLOR', '#fab510' );

// ── AJAX: búsqueda de productos ──────────────────────────────────────────────
add_action( 'wp_ajax_nopriv_ac_search_products', 'ac_search_products_handler' );
add_action( 'wp_ajax_ac_search_products',        'ac_search_products_handler' );

function ac_search_products_handler() {
    $term = sanitize_text_field( $_GET['q'] ?? '' );
    if ( mb_strlen( $term ) < 2 ) {
        wp_send_json( [] );
    }

    $query = new WP_Query( [
        'post_type'      => 'product',
        'post_status'    => 'publish',
        's'              => $term,
        'posts_per_page' => 8,
        'fields'         => 'ids',
    ] );

    $results = [];
    foreach ( $query->posts as $pid ) {
        $p = wc_get_product( $pid );
        if ( ! $p || ! $p->is_visible() ) continue;
        $price = floatval( $p->get_price() );
        $results[] = [
            'id'         => $pid,
            'name'       => $p->get_name(),
            'sku'        => $p->get_sku(),
            'price'      => $price,
            'price_html' => $price ? strip_tags( wc_price( $price ) ) : 'Precio a consultar',
            'image'      => wp_get_attachment_url( $p->get_image_id() ) ?: wc_placeholder_img_src(),
            'url'        => get_permalink( $pid ),
        ];
    }

    wp_send_json( $results );
}

// ── Agregar botón en página de producto ─────────────────────────────────────
add_action( 'woocommerce_single_product_summary', 'ac_cotizacion_button', 35 );

function ac_cotizacion_button() {
    global $product;
    if ( ! $product ) return;

    $price        = $product->get_price();
    $price_display = $price ? wc_price( $price ) : '<em>Precio a consultar</em>';

    ?>
    <div class="ac-quote-wrapper" style="margin:12px 0;">
        <button
            id="ac-open-quote"
            type="button"
            style="
                display:flex; align-items:center; justify-content:center; gap:10px;
                width:100%; padding:14px 20px;
                background:<?php echo AC_BUTTON_COLOR; ?>; color:#000;
                font-family:inherit; font-size:14px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
                border:none; border-radius:8px; cursor:pointer; transition:opacity .2s;
            "
            onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'"
        >
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Pedir Cotización
        </button>
    </div>

    <!-- ── Modal ──────────────────────────────────────────────────────────── -->
    <div id="ac-quote-modal" style="
        display:none; position:fixed; inset:0; z-index:99999;
        background:rgba(0,0,0,.55); backdrop-filter:blur(4px);
        align-items:center; justify-content:center; padding:16px;
    ">
        <div style="
            background:#fff; border-radius:20px; width:100%; max-width:500px;
            max-height:92vh; overflow-y:auto;
            box-shadow:0 32px 80px rgba(0,0,0,.2);
            font-family:system-ui,-apple-system,sans-serif;
        ">
            <!-- Header -->
            <div style="background:#fff; border-bottom:1px solid #eee; padding:20px 24px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:1;">
                <div>
                    <p style="margin:0; font-size:10px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#888;">SOLICITAR COTIZACIÓN</p>
                    <p style="margin:4px 0 0; font-size:16px; font-weight:900; color:#111;">Arte Concreto S.A.S</p>
                </div>
                <button id="ac-close-quote" type="button" style="
                    background:none; border:1px solid #ddd; border-radius:50%; width:34px; height:34px;
                    font-size:18px; cursor:pointer; color:#555; display:flex; align-items:center; justify-content:center;
                " aria-label="Cerrar">✕</button>
            </div>

            <div style="padding:24px;">

                <!-- ── Producto principal ──────────────────────────────── -->
                <p style="margin:0 0 10px; font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#aaa;">Producto seleccionado</p>
                <div style="background:#f9f9f9; border:1px solid #eee; border-radius:12px; padding:16px; display:flex; align-items:center; gap:14px;">
                    <img id="ac-prod-img" src="<?php echo esc_url( wp_get_attachment_url( $product->get_image_id() ) ); ?>"
                         style="width:56px; height:56px; object-fit:cover; border-radius:8px; border:1px solid #eee; flex-shrink:0;" alt="" />
                    <div style="flex:1; min-width:0;">
                        <p style="margin:0; font-size:13px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            <?php echo esc_html( $product->get_name() ); ?>
                        </p>
                        <?php if ( $product->get_sku() ) : ?>
                        <p style="margin:3px 0 0; font-size:11px; color:#888;">SKU: <?php echo esc_html( $product->get_sku() ); ?></p>
                        <?php endif; ?>
                        <p style="margin:5px 0 0; font-size:13px; font-weight:700; color:#111;"><?php echo $price_display; ?></p>
                    </div>
                    <!-- Cantidad producto principal -->
                    <div style="display:flex; align-items:center; gap:6px; border:1px solid #ddd; border-radius:8px; padding:4px 10px; flex-shrink:0;">
                        <button type="button" id="ac-qty-minus" style="background:none; border:none; font-size:18px; cursor:pointer; color:#555; padding:0 2px; line-height:1;">−</button>
                        <span id="ac-qty-display" style="font-size:15px; font-weight:800; min-width:20px; text-align:center;">1</span>
                        <button type="button" id="ac-qty-plus" style="background:none; border:none; font-size:18px; cursor:pointer; color:#555; padding:0 2px; line-height:1;">+</button>
                    </div>
                </div>

                <!-- ── Agregar más productos ──────────────────────────── -->
                <div style="margin-top:16px; border:1.5px dashed #e0e0e0; border-radius:12px; padding:14px;">
                    <p style="margin:0 0 10px; font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#aaa;">
                        ➕ Agregar más productos
                    </p>
                    <!-- Buscador -->
                    <div style="position:relative;">
                        <input
                            id="ac-search-input"
                            type="text"
                            placeholder="Buscar bancas, macetas, mobiliario..."
                            autocomplete="off"
                            style="
                                width:100%; padding:11px 14px 11px 38px;
                                border:1.5px solid #ddd; border-radius:10px;
                                font-size:14px; box-sizing:border-box; outline:none;
                                font-family:inherit; transition:border-color .15s;
                            "
                            onfocus="this.style.borderColor='<?php echo AC_BUTTON_COLOR; ?>'"
                            onblur="this.style.borderColor='#ddd'"
                        />
                        <svg style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:#aaa;" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <!-- Resultados dropdown -->
                        <div id="ac-search-results" style="
                            display:none; position:absolute; top:calc(100% + 4px); left:0; right:0;
                            background:#fff; border:1.5px solid #eee; border-radius:12px;
                            box-shadow:0 8px 32px rgba(0,0,0,.12); z-index:10;
                            max-height:220px; overflow-y:auto;
                        "></div>
                    </div>

                    <!-- Lista de productos adicionales añadidos -->
                    <div id="ac-extra-list" style="margin-top:12px; display:none;"></div>
                </div>

                <!-- ── Formulario de contacto ──────────────────────────── -->
                <p style="margin:20px 0 16px; font-size:13px; color:#555;">Completa tus datos y te enviamos la cotización a tu correo.</p>

                <form id="ac-quote-form" autocomplete="on">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                        <div>
                            <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Nombre completo *</label>
                            <input name="name" type="text" required placeholder="Ej: Juan Pérez"
                                   style="width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px; font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;"
                                   onfocus="this.style.borderColor='<?php echo AC_BUTTON_COLOR; ?>'" onblur="this.style.borderColor='#ddd'" />
                        </div>
                        <div>
                            <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Empresa / Proyecto</label>
                            <input name="company" type="text" placeholder="Ej: Constructora XYZ"
                                   style="width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px; font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;"
                                   onfocus="this.style.borderColor='<?php echo AC_BUTTON_COLOR; ?>'" onblur="this.style.borderColor='#ddd'" />
                        </div>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Correo electrónico *</label>
                        <input name="email" type="email" required placeholder="juan@empresa.com"
                               style="width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px; font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;"
                               onfocus="this.style.borderColor='<?php echo AC_BUTTON_COLOR; ?>'" onblur="this.style.borderColor='#ddd'" />
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
                        <div>
                            <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Teléfono</label>
                            <input name="phone" type="tel" placeholder="+57 300 000 0000"
                                   style="width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px; font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;"
                                   onfocus="this.style.borderColor='<?php echo AC_BUTTON_COLOR; ?>'" onblur="this.style.borderColor='#ddd'" />
                        </div>
                        <div>
                            <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Ciudad</label>
                            <input name="city" type="text" placeholder="Bogotá, Medellín..."
                                   style="width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px; font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;"
                                   onfocus="this.style.borderColor='<?php echo AC_BUTTON_COLOR; ?>'" onblur="this.style.borderColor='#ddd'" />
                        </div>
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">¿Algo que quieras contarnos? <span style="font-weight:400;color:#bbb;">(opcional)</span></label>
                        <textarea name="message" rows="3" placeholder="Ej: Necesito el pedido para una obra en Bogotá, presupuesto aproximado $5M..."
                                  style="width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px; font-size:14px; box-sizing:border-box; outline:none; font-family:inherit; resize:vertical; min-height:80px;"
                                  onfocus="this.style.borderColor='<?php echo AC_BUTTON_COLOR; ?>'" onblur="this.style.borderColor='#ddd'"></textarea>
                    </div>

                    <!-- Submit -->
                    <button type="submit" id="ac-submit-btn" style="
                        width:100%; padding:15px; background:<?php echo AC_BUTTON_COLOR; ?>; color:#000;
                        font-weight:900; font-size:14px; letter-spacing:.1em; text-transform:uppercase;
                        border:none; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;
                        font-family:inherit; transition:opacity .2s;
                    " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Enviar Solicitud
                    </button>

                    <p style="margin:12px 0 0; font-size:11px; color:#aaa; text-align:center;">🔒 Tus datos son confidenciales y no serán compartidos.</p>
                </form>

                <!-- Estado: enviando / éxito / error -->
                <div id="ac-sending" style="display:none; text-align:center; padding:20px 0;">
                    <div style="width:36px; height:36px; border:3px solid #eee; border-top-color:<?php echo AC_BUTTON_COLOR; ?>; border-radius:50%; animation:ac-spin 0.8s linear infinite; margin:0 auto 12px;"></div>
                    <p style="font-size:14px; font-weight:700; color:#555; margin:0;">Enviando solicitud...</p>
                </div>
                <div id="ac-success" style="display:none; text-align:center; padding:20px 0;">
                    <div style="font-size:48px; margin-bottom:12px;">✅</div>
                    <p style="font-size:16px; font-weight:900; color:#111; margin:0 0 8px;">¡Solicitud enviada!</p>
                    <p style="font-size:13px; color:#777; margin:0;">Nuestro equipo revisará tu cotización y se pondrá en contacto pronto.</p>
                </div>
                <div id="ac-error" style="display:none; background:#fff0f0; border:1px solid #fcc; border-radius:10px; padding:14px 16px; margin-top:12px;">
                    <p style="margin:0; font-size:13px; color:#c00; font-weight:700;">⚠️ Hubo un error al enviar. Por favor intenta de nuevo.</p>
                </div>
            </div>
        </div>
    </div>

    <style>
        @keyframes ac-spin { to { transform: rotate(360deg); } }
        #ac-quote-modal { display: none; }
        #ac-quote-modal.ac-open { display: flex !important; }
        #ac-search-results::-webkit-scrollbar { width:4px; }
        #ac-search-results::-webkit-scrollbar-thumb { background:#ddd; border-radius:4px; }
        .ac-result-item:hover { background:#faf7f0 !important; }
        .ac-extra-item { animation: ac-fade-in .2s ease; }
        @keyframes ac-fade-in { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
    </style>

    <script>
    (function() {
        var CRM_URL    = '<?php echo esc_js( AC_CRM_ENDPOINT ); ?>';
        var AJAX_URL   = '<?php echo esc_js( admin_url( 'admin-ajax.php' ) ); ?>';
        var GOLD       = '<?php echo AC_BUTTON_COLOR; ?>';

        var PROD_NAME  = <?php echo json_encode( $product->get_name() ); ?>;
        var PROD_SKU   = <?php echo json_encode( $product->get_sku() ); ?>;
        var PROD_PRICE = <?php echo json_encode( floatval( $product->get_price() ) ); ?>;
        var PROD_IMG   = <?php echo json_encode( wp_get_attachment_url( $product->get_image_id() ) ); ?>;
        var PROD_URL   = <?php echo json_encode( get_permalink() ); ?>;

        var mainQty    = 1;
        var extraItems = {}; // keyed by product id

        function el(id) { return document.getElementById(id); }

        // ── Open / Close ────────────────────────────────────────────────────
        el('ac-open-quote').addEventListener('click', function() {
            el('ac-quote-modal').classList.add('ac-open');
            document.body.style.overflow = 'hidden';
        });
        el('ac-close-quote').addEventListener('click', closeModal);
        el('ac-quote-modal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
        function closeModal() {
            el('ac-quote-modal').classList.remove('ac-open');
            document.body.style.overflow = '';
            el('ac-search-input').value = '';
            el('ac-search-results').style.display = 'none';
        }

        // ── Cantidad producto principal ──────────────────────────────────
        el('ac-qty-minus').addEventListener('click', function() {
            if (mainQty > 1) { mainQty--; el('ac-qty-display').textContent = mainQty; }
        });
        el('ac-qty-plus').addEventListener('click', function() {
            mainQty++; el('ac-qty-display').textContent = mainQty;
        });

        // ── Buscador de productos adicionales ───────────────────────────
        var searchTimer;
        el('ac-search-input').addEventListener('input', function() {
            var q = this.value.trim();
            clearTimeout(searchTimer);
            if (q.length < 2) {
                el('ac-search-results').style.display = 'none';
                return;
            }
            searchTimer = setTimeout(function() { doSearch(q); }, 350);
        });

        // Cierra dropdown al hacer click fuera
        document.addEventListener('click', function(e) {
            if (!el('ac-search-input').contains(e.target) && !el('ac-search-results').contains(e.target)) {
                el('ac-search-results').style.display = 'none';
            }
        });

        function doSearch(q) {
            var res = el('ac-search-results');
            res.innerHTML = '<div style="padding:14px;font-size:13px;color:#aaa;text-align:center;">Buscando...</div>';
            res.style.display = 'block';

            fetch(AJAX_URL + '?action=ac_search_products&q=' + encodeURIComponent(q))
                .then(function(r) { return r.json(); })
                .then(function(products) { renderSearchResults(products); })
                .catch(function() {
                    res.innerHTML = '<div style="padding:14px;font-size:13px;color:#c00;text-align:center;">Error al buscar.</div>';
                });
        }

        function renderSearchResults(products) {
            var res = el('ac-search-results');
            if (!products.length) {
                res.innerHTML = '<div style="padding:14px;font-size:13px;color:#aaa;text-align:center;">Sin resultados.</div>';
                return;
            }
            res.innerHTML = products.map(function(p) {
                var alreadyAdded = !!extraItems[p.id];
                return '<div class="ac-result-item" data-id="' + p.id + '" style="' +
                    'display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;' +
                    'border-bottom:1px solid #f5f5f5;transition:background .12s;' +
                    (alreadyAdded ? 'opacity:.45;pointer-events:none;' : '') +
                    '">' +
                    '<img src="' + (p.image || '') + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #eee;flex-shrink:0;" />' +
                    '<div style="flex:1;min-width:0;">' +
                        '<p style="margin:0;font-size:13px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(p.name) + '</p>' +
                        '<p style="margin:2px 0 0;font-size:11px;color:#888;">' + (p.sku ? 'SKU: ' + escHtml(p.sku) + ' · ' : '') + escHtml(p.price_html) + '</p>' +
                    '</div>' +
                    '<button type="button" style="' +
                        'flex-shrink:0;background:' + GOLD + ';color:#000;border:none;border-radius:6px;' +
                        'padding:6px 12px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;' +
                        '">' + (alreadyAdded ? '✓' : '+ Añadir') + '</button>' +
                '</div>';
            }).join('');

            // Listeners para añadir
            res.querySelectorAll('.ac-result-item').forEach(function(row) {
                row.addEventListener('click', function() {
                    var pid = parseInt(row.getAttribute('data-id'));
                    var prod = products.find(function(p) { return p.id === pid; });
                    if (prod) addExtra(prod);
                    el('ac-search-results').style.display = 'none';
                    el('ac-search-input').value = '';
                });
            });
        }

        // ── Agregar producto extra ───────────────────────────────────────
        function addExtra(prod) {
            if (extraItems[prod.id]) return;
            extraItems[prod.id] = { product: prod, qty: 1 };
            renderExtraList();
        }

        function renderExtraList() {
            var list = el('ac-extra-list');
            var ids = Object.keys(extraItems);
            if (!ids.length) {
                list.style.display = 'none';
                list.innerHTML = '';
                return;
            }
            list.style.display = 'block';
            list.innerHTML = ids.map(function(id) {
                var item = extraItems[id];
                var p    = item.product;
                return '<div class="ac-extra-item" data-id="' + id + '" style="' +
                    'display:flex;align-items:center;gap:10px;' +
                    'background:#f9f9f9;border:1px solid #eee;border-radius:10px;' +
                    'padding:10px 12px;margin-bottom:8px;' +
                    '">' +
                    '<img src="' + (p.image || '') + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #eee;flex-shrink:0;" />' +
                    '<div style="flex:1;min-width:0;">' +
                        '<p style="margin:0;font-size:12px;font-weight:800;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(p.name) + '</p>' +
                        '<p style="margin:2px 0 0;font-size:11px;color:#888;">' + escHtml(p.price_html) + '</p>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:5px;border:1px solid #ddd;border-radius:7px;padding:3px 8px;flex-shrink:0;">' +
                        '<button type="button" class="ac-extra-minus" style="background:none;border:none;font-size:16px;cursor:pointer;color:#555;padding:0;line-height:1;">−</button>' +
                        '<span class="ac-extra-qty" style="font-size:14px;font-weight:800;min-width:18px;text-align:center;">' + item.qty + '</span>' +
                        '<button type="button" class="ac-extra-plus" style="background:none;border:none;font-size:16px;cursor:pointer;color:#555;padding:0;line-height:1;">+</button>' +
                    '</div>' +
                    '<button type="button" class="ac-extra-remove" style="' +
                        'background:none;border:1px solid #eee;border-radius:6px;width:28px;height:28px;' +
                        'display:flex;align-items:center;justify-content:center;cursor:pointer;color:#bbb;flex-shrink:0;' +
                        '" title="Quitar">✕</button>' +
                '</div>';
            }).join('');

            // Eventos
            list.querySelectorAll('.ac-extra-item').forEach(function(row) {
                var id = row.getAttribute('data-id');
                row.querySelector('.ac-extra-minus').addEventListener('click', function() {
                    if (extraItems[id].qty > 1) {
                        extraItems[id].qty--;
                        row.querySelector('.ac-extra-qty').textContent = extraItems[id].qty;
                    }
                });
                row.querySelector('.ac-extra-plus').addEventListener('click', function() {
                    extraItems[id].qty++;
                    row.querySelector('.ac-extra-qty').textContent = extraItems[id].qty;
                });
                row.querySelector('.ac-extra-remove').addEventListener('click', function() {
                    delete extraItems[id];
                    renderExtraList();
                });
            });
        }

        // ── Submit ──────────────────────────────────────────────────────
        el('ac-quote-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var form = e.target;

            // Construir lista de items: principal + extras
            var items = [{
                name:     PROD_NAME,
                sku:      PROD_SKU,
                price:    PROD_PRICE,
                quantity: mainQty,
                image:    PROD_IMG,
                url:      PROD_URL,
            }];
            Object.values(extraItems).forEach(function(item) {
                items.push({
                    name:     item.product.name,
                    sku:      item.product.sku,
                    price:    item.product.price,
                    quantity: item.qty,
                    image:    item.product.image,
                    url:      item.product.url,
                });
            });

            var data = {
                name:    form.name.value.trim(),
                email:   form.email.value.trim(),
                phone:   form.phone.value.trim(),
                city:    form.city.value.trim(),
                company: form.company.value.trim(),
                message: form.message.value.trim(),
                source:  'WooCommerce',
                items:   items,
            };

            el('ac-quote-form').style.display = 'none';
            el('ac-sending').style.display = 'block';
            el('ac-error').style.display = 'none';

            fetch(CRM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
                body: JSON.stringify(data)
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                el('ac-sending').style.display = 'none';
                if (res.ok) {
                    el('ac-success').style.display = 'block';
                    setTimeout(closeModal, 4000);
                } else {
                    el('ac-quote-form').style.display = 'block';
                    el('ac-error').style.display = 'block';
                }
            })
            .catch(function() {
                el('ac-sending').style.display = 'none';
                el('ac-quote-form').style.display = 'block';
                el('ac-error').style.display = 'block';
            });
        });

        function escHtml(str) {
            return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }
    })();
    </script>
    <?php
}
