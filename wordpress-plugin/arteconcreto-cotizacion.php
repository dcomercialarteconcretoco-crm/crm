<?php
/**
 * Plugin Name: Arte Concreto – Botón Pedir Cotización
 * Description: Botones de cotización (WhatsApp y Correo) en páginas de producto y grilla. Ambos capturan el lead en el CRM y abren WhatsApp.
 * Version: 3.1.0
 * Author: Arte Concreto / MiWibi
 * Text Domain: ac-cotizacion
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ── Configuración ────────────────────────────────────────────────────────────
define( 'AC_CRM_ENDPOINT',  'https://crm-sand-three.vercel.app/api/public/quote-request' );
define( 'AC_COLOR_GOLD',    '#fab510' );
define( 'AC_COLOR_DARK',    '#1a1a1a' );
define( 'AC_WHATSAPP_NUM',  '573150231956' );

// ── AJAX: búsqueda de productos ──────────────────────────────────────────────
add_action( 'wp_ajax_nopriv_ac_search_products', 'ac_search_products_handler' );
add_action( 'wp_ajax_ac_search_products',        'ac_search_products_handler' );

function ac_search_products_handler() {
    // CSRF: verificar nonce
    if ( ! check_ajax_referer( 'ac_search_nonce', '_wpnonce', false ) ) {
        wp_send_json_error( [ 'message' => 'Invalid request' ], 403 );
    }

    // Rate limiting: máx 30 búsquedas por IP por minuto
    $ip  = sanitize_text_field( $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0' );
    $key = 'ac_rl_' . md5( $ip );
    $hits = (int) get_transient( $key );
    if ( $hits >= 30 ) {
        wp_send_json_error( [ 'message' => 'Too many requests' ], 429 );
    }
    set_transient( $key, $hits + 1, 60 );

    $term = sanitize_text_field( $_GET['q'] ?? '' );
    if ( mb_strlen( $term ) < 2 ) { wp_send_json( [] ); }

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

// ── Helper: datos del producto como atributos data-* ────────────────────────
function ac_product_data_attrs( $product ) {
    $price = floatval( $product->get_price() );
    return sprintf(
        'data-name="%s" data-sku="%s" data-price="%s" data-price-html="%s" data-image="%s" data-url="%s"',
        esc_attr( $product->get_name() ),
        esc_attr( $product->get_sku() ),
        esc_attr( $price ),
        esc_attr( $price ? strip_tags( wc_price( $price ) ) : 'Precio a consultar' ),
        esc_attr( wp_get_attachment_url( $product->get_image_id() ) ?: wc_placeholder_img_src() ),
        esc_attr( get_permalink( $product->get_id() ) )
    );
}

// ── Botones en página de producto individual ─────────────────────────────────
add_action( 'woocommerce_single_product_summary', 'ac_single_product_buttons', 35 );

function ac_single_product_buttons() {
    global $product;
    if ( ! $product ) return;
    $attrs = ac_product_data_attrs( $product );
    ?>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0;">
        <button type="button" class="ac-open-quote" <?php echo $attrs; ?> data-source="WhatsApp" style="
            display:flex; align-items:center; justify-content:center; gap:8px;
            padding:14px 10px; background:#25d366; color:#fff;
            font-family:inherit; font-size:13px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
            border:none; border-radius:8px; cursor:pointer; transition:opacity .2s;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L0 24l6.318-1.508A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.007-1.369l-.359-.213-3.728.89.923-3.628-.234-.373A9.818 9.818 0 1 1 12 21.818z"/></svg>
            Cotizar por WhatsApp
        </button>
        <button type="button" class="ac-open-quote" <?php echo $attrs; ?> data-source="Correo" style="
            display:flex; align-items:center; justify-content:center; gap:8px;
            padding:14px 10px; background:<?php echo AC_COLOR_DARK; ?>; color:#fff;
            font-family:inherit; font-size:13px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
            border:none; border-radius:8px; cursor:pointer; transition:opacity .2s;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
            Cotizar por Correo
        </button>
    </div>
    <?php
}

// ── Botones en grilla / loop de productos ────────────────────────────────────
add_action( 'woocommerce_after_shop_loop_item', 'ac_loop_product_buttons', 15 );

function ac_loop_product_buttons() {
    global $product;
    if ( ! $product ) return;
    $attrs = ac_product_data_attrs( $product );
    ?>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:6px 12px 12px;">
        <button type="button" class="ac-open-quote" <?php echo $attrs; ?> data-source="WhatsApp" style="
            display:flex; align-items:center; justify-content:center; gap:6px;
            padding:9px 6px; background:#25d366; color:#fff;
            font-family:inherit; font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase;
            border:none; border-radius:6px; cursor:pointer; transition:opacity .2s; width:100%;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L0 24l6.318-1.508A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.007-1.369l-.359-.213-3.728.89.923-3.628-.234-.373A9.818 9.818 0 1 1 12 21.818z"/></svg>
            WhatsApp
        </button>
        <button type="button" class="ac-open-quote" <?php echo $attrs; ?> data-source="Correo" style="
            display:flex; align-items:center; justify-content:center; gap:6px;
            padding:9px 6px; background:<?php echo AC_COLOR_DARK; ?>; color:#fff;
            font-family:inherit; font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase;
            border:none; border-radius:6px; cursor:pointer; transition:opacity .2s; width:100%;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
            Correo
        </button>
    </div>
    <?php
}

// ── Modal compartido + JS (se renderiza UNA vez en el footer) ────────────────
add_action( 'wp_footer', 'ac_render_modal_and_scripts' );

function ac_render_modal_and_scripts() {
    // Solo si hay productos en la página
    if ( ! function_exists( 'wc_get_product' ) ) return;
    ?>

    <!-- ── Modal Arte Concreto Cotización ─────────────────────────────────── -->
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
            <div id="ac-modal-header" style="
                background:#fff; border-bottom:1px solid #eee; padding:20px 24px;
                display:flex; align-items:center; justify-content:space-between;
                position:sticky; top:0; z-index:1;
            ">
                <div>
                    <p id="ac-modal-label" style="margin:0; font-size:10px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#888;"></p>
                    <p style="margin:4px 0 0; font-size:16px; font-weight:900; color:#111;">Arte Concreto S.A.S</p>
                </div>
                <button id="ac-close-quote" type="button" style="
                    background:none; border:1px solid #ddd; border-radius:50%; width:34px; height:34px;
                    font-size:18px; cursor:pointer; color:#555; display:flex; align-items:center; justify-content:center;
                " aria-label="Cerrar">✕</button>
            </div>

            <div style="padding:24px;">

                <!-- ── Producto principal ──────────────────────────── -->
                <p style="margin:0 0 10px; font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#aaa;">Producto seleccionado</p>
                <div style="background:#f9f9f9; border:1px solid #eee; border-radius:12px; padding:16px; display:flex; align-items:center; gap:14px;">
                    <img id="ac-prod-img" src="" style="width:56px; height:56px; object-fit:cover; border-radius:8px; border:1px solid #eee; flex-shrink:0;" alt="" />
                    <div style="flex:1; min-width:0;">
                        <p id="ac-prod-name" style="margin:0; font-size:13px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></p>
                        <p id="ac-prod-sku"  style="margin:3px 0 0; font-size:11px; color:#888;"></p>
                        <p id="ac-prod-price" style="margin:5px 0 0; font-size:13px; font-weight:700; color:#111;"></p>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; border:1px solid #ddd; border-radius:8px; padding:4px 10px; flex-shrink:0;">
                        <button type="button" id="ac-qty-minus" style="background:none; border:none; font-size:18px; cursor:pointer; color:#555; padding:0 2px; line-height:1;">−</button>
                        <span id="ac-qty-display" style="font-size:15px; font-weight:800; min-width:20px; text-align:center;">1</span>
                        <button type="button" id="ac-qty-plus" style="background:none; border:none; font-size:18px; cursor:pointer; color:#555; padding:0 2px; line-height:1;">+</button>
                    </div>
                </div>

                <!-- ── Agregar más productos ──────────────────────── -->
                <div style="margin-top:16px; border:1.5px dashed #e0e0e0; border-radius:12px; padding:14px;">
                    <p style="margin:0 0 10px; font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#aaa;">➕ Agregar más productos</p>
                    <div style="position:relative;">
                        <input id="ac-search-input" type="text" placeholder="Buscar bancas, macetas, mobiliario..." autocomplete="off" style="
                            width:100%; padding:11px 14px 11px 38px;
                            border:1.5px solid #ddd; border-radius:10px;
                            font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;
                        " onfocus="this.style.borderColor='<?php echo esc_js( AC_COLOR_GOLD ); ?>'" onblur="this.style.borderColor='#ddd'" />
                        <svg style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:#aaa;" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <div id="ac-search-results" style="
                            display:none; position:absolute; top:calc(100% + 4px); left:0; right:0;
                            background:#fff; border:1.5px solid #eee; border-radius:12px;
                            box-shadow:0 8px 32px rgba(0,0,0,.12); z-index:10;
                            max-height:220px; overflow-y:auto;
                        "></div>
                    </div>
                    <div id="ac-extra-list" style="margin-top:12px; display:none;"></div>
                </div>

                <!-- ── Formulario ─────────────────────────────────── -->
                <p id="ac-form-intro" style="margin:20px 0 16px; font-size:13px; color:#555;"></p>

                <form id="ac-quote-form" autocomplete="on">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                        <div>
                            <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Nombre completo *</label>
                            <input name="name" type="text" required placeholder="Ej: Juan Pérez" style="
                                width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px;
                                font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;
                            " onfocus="this.style.borderColor='<?php echo esc_js( AC_COLOR_GOLD ); ?>'" onblur="this.style.borderColor='#ddd'" />
                        </div>
                        <div>
                            <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Empresa / Proyecto</label>
                            <input name="company" type="text" placeholder="Ej: Constructora XYZ" style="
                                width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px;
                                font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;
                            " onfocus="this.style.borderColor='<?php echo esc_js( AC_COLOR_GOLD ); ?>'" onblur="this.style.borderColor='#ddd'" />
                        </div>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Correo electrónico *</label>
                        <input name="email" type="email" required placeholder="juan@empresa.com" style="
                            width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px;
                            font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;
                        " onfocus="this.style.borderColor='<?php echo esc_js( AC_COLOR_GOLD ); ?>'" onblur="this.style.borderColor='#ddd'" />
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
                        <div>
                            <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Teléfono</label>
                            <input name="phone" type="tel" placeholder="+57 300 000 0000" style="
                                width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px;
                                font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;
                            " onfocus="this.style.borderColor='<?php echo esc_js( AC_COLOR_GOLD ); ?>'" onblur="this.style.borderColor='#ddd'" />
                        </div>
                        <div>
                            <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Ciudad</label>
                            <input name="city" type="text" placeholder="Bogotá, Medellín..." style="
                                width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px;
                                font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;
                            " onfocus="this.style.borderColor='<?php echo esc_js( AC_COLOR_GOLD ); ?>'" onblur="this.style.borderColor='#ddd'" />
                        </div>
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">
                            ¿Algo que quieras contarnos? <span style="font-weight:400;color:#bbb;">(opcional)</span>
                        </label>
                        <textarea name="message" rows="3" placeholder="Ej: Necesito el pedido para una obra en Bogotá..." style="
                            width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px;
                            font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;
                            resize:vertical; min-height:80px;
                        " onfocus="this.style.borderColor='<?php echo esc_js( AC_COLOR_GOLD ); ?>'" onblur="this.style.borderColor='#ddd'"></textarea>
                    </div>

                    <!-- Botón de envío (texto y color cambian según source) -->
                    <button type="submit" id="ac-submit-btn" style="
                        width:100%; padding:15px; color:#fff;
                        font-weight:900; font-size:14px; letter-spacing:.1em; text-transform:uppercase;
                        border:none; border-radius:12px; cursor:pointer;
                        display:flex; align-items:center; justify-content:center; gap:10px;
                        font-family:inherit; transition:opacity .2s;
                    " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                    </button>

                    <p style="margin:12px 0 0; font-size:11px; color:#aaa; text-align:center;">🔒 Tus datos son confidenciales y no serán compartidos.</p>
                </form>

                <!-- Estados -->
                <div id="ac-sending" style="display:none; text-align:center; padding:20px 0;">
                    <div style="width:36px; height:36px; border:3px solid #eee; border-top-color:<?php echo esc_js( AC_COLOR_GOLD ); ?>; border-radius:50%; animation:ac-spin 0.8s linear infinite; margin:0 auto 12px;"></div>
                    <p style="font-size:14px; font-weight:700; color:#555; margin:0;">Enviando solicitud...</p>
                </div>
                <div id="ac-success" style="display:none; text-align:center; padding:20px 0;">
                    <div style="font-size:48px; margin-bottom:12px;">✅</div>
                    <p style="font-size:16px; font-weight:900; color:#111; margin:0 0 8px;">¡Solicitud enviada!</p>
                    <p style="font-size:13px; color:#777; margin:0;">Nuestro equipo se pondrá en contacto contigo pronto.</p>
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
        var CRM_URL   = '<?php echo esc_js( AC_CRM_ENDPOINT ); ?>';
        var AJAX_URL  = '<?php echo esc_js( admin_url( 'admin-ajax.php' ) ); ?>';
        var AC_NONCE  = '<?php echo esc_js( wp_create_nonce( 'ac_search_nonce' ) ); ?>';
        var GOLD      = '<?php echo esc_js( AC_COLOR_GOLD ); ?>';
        var DARK      = '<?php echo esc_js( AC_COLOR_DARK ); ?>';
        var WA_NUM    = '<?php echo esc_js( AC_WHATSAPP_NUM ); ?>';

        // Sanitiza URLs antes de usarlas en src/href (previene XSS con javascript: o data: URIs)
        function safeUrl(url) {
            if (!url) return '';
            url = String(url).trim();
            return /^https?:\/\//i.test(url) ? url : '';
        }

        // Estado actual del modal
        var currentProduct = {};
        var currentSource  = 'WhatsApp'; // 'WhatsApp' | 'Correo'
        var mainQty        = 1;
        var extraItems     = {};

        function el(id) { return document.getElementById(id); }

        // ── Configurar modal según source ────────────────────────────────────
        function configureModal(source) {
            currentSource = source;
            var isWA = source === 'WhatsApp';

            // Label del header
            el('ac-modal-label').textContent = isWA
                ? 'COTIZACIÓN POR WHATSAPP'
                : 'COTIZACIÓN POR CORREO ELECTRÓNICO';

            // Intro del formulario
            el('ac-form-intro').textContent = isWA
                ? 'Completa tus datos y te contactamos de inmediato por WhatsApp.'
                : 'Completa tus datos y te enviamos la cotización detallada a tu correo.';

            // Botón de envío — apariencia varía, destino siempre igual 😈
            var btn = el('ac-submit-btn');
            if (isWA) {
                btn.style.background = '#25d366';
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L0 24l6.318-1.508A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.007-1.369l-.359-.213-3.728.89.923-3.628-.234-.373A9.818 9.818 0 1 1 12 21.818z"/></svg> Iniciar Chat en WhatsApp';
            } else {
                btn.style.background = DARK;
                btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Solicitud por Correo';
            }
        }

        // ── Abrir modal ──────────────────────────────────────────────────────
        function openModal(btn) {
            currentProduct = {
                name:      btn.getAttribute('data-name')      || '',
                sku:       btn.getAttribute('data-sku')       || '',
                price:     parseFloat(btn.getAttribute('data-price')) || 0,
                priceHtml: btn.getAttribute('data-price-html') || '',
                image:     btn.getAttribute('data-image')     || '',
                url:       btn.getAttribute('data-url')       || '',
            };
            var source = btn.getAttribute('data-source') || 'WhatsApp';

            // Poblar producto principal
            el('ac-prod-img').src = currentProduct.image;
            el('ac-prod-name').textContent = currentProduct.name;
            el('ac-prod-sku').textContent  = currentProduct.sku ? 'SKU: ' + currentProduct.sku : '';
            el('ac-prod-sku').style.display = currentProduct.sku ? 'block' : 'none';
            el('ac-prod-price').textContent = currentProduct.priceHtml;

            // Resetear estado
            mainQty = 1;
            el('ac-qty-display').textContent = '1';
            extraItems = {};
            renderExtraList();
            el('ac-search-input').value = '';
            el('ac-search-results').style.display = 'none';
            el('ac-quote-form').style.display = 'block';
            el('ac-sending').style.display    = 'none';
            el('ac-success').style.display    = 'none';
            el('ac-error').style.display      = 'none';
            // Limpiar bordes de validación
            el('ac-quote-form').elements['name'].style.borderColor  = '#ddd';
            el('ac-quote-form').elements['email'].style.borderColor = '#ddd';

            configureModal(source);

            el('ac-quote-modal').classList.add('ac-open');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            el('ac-quote-modal').classList.remove('ac-open');
            document.body.style.overflow = '';
        }

        // ── Delegar clicks en botones (funciona para botones añadidos dinámicamente) ──
        document.addEventListener('click', function(e) {
            var btn = e.target.closest('.ac-open-quote');
            if (btn) { openModal(btn); return; }

            if (e.target === el('ac-quote-modal')) { closeModal(); return; }
            if (e.target.closest('#ac-close-quote')) { closeModal(); return; }

            // Cierra dropdown buscador
            if (!e.target.closest('#ac-search-input') && !e.target.closest('#ac-search-results')) {
                el('ac-search-results').style.display = 'none';
            }
        });

        // ── Cantidad producto principal ──────────────────────────────────────
        el('ac-qty-minus').addEventListener('click', function() {
            if (mainQty > 1) { mainQty--; el('ac-qty-display').textContent = mainQty; }
        });
        el('ac-qty-plus').addEventListener('click', function() {
            mainQty++; el('ac-qty-display').textContent = mainQty;
        });

        // ── Buscador ─────────────────────────────────────────────────────────
        var searchTimer;
        var searchController = null; // AbortController para cancelar requests en vuelo

        el('ac-search-input').addEventListener('input', function() {
            var q = this.value.trim();
            clearTimeout(searchTimer);
            if (q.length < 2) { el('ac-search-results').style.display = 'none'; return; }
            searchTimer = setTimeout(function() { doSearch(q); }, 350);
        });

        function doSearch(q) {
            // Cancelar request anterior si aún está en vuelo (evita race condition)
            if (searchController) { searchController.abort(); }
            searchController = new AbortController();

            var res = el('ac-search-results');
            res.innerHTML = '<div style="padding:14px;font-size:13px;color:#aaa;text-align:center;">Buscando...</div>';
            res.style.display = 'block';

            fetch(AJAX_URL + '?action=ac_search_products&_wpnonce=' + AC_NONCE + '&q=' + encodeURIComponent(q), {
                signal: searchController.signal,
            })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    // wp_send_json_error envuelve en {success:false,data:...}
                    renderSearchResults(Array.isArray(data) ? data : (data.data || []));
                })
                .catch(function(err) {
                    if (err.name === 'AbortError') return; // cancelado intencionalmente, no es error
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
                var added = !!extraItems[p.id];
                return '<div class="ac-result-item" data-id="' + p.id + '" style="' +
                    'display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;' +
                    'border-bottom:1px solid #f5f5f5;transition:background .12s;' +
                    (added ? 'opacity:.45;pointer-events:none;' : '') + '">' +
                    '<img src="' + safeUrl(p.image) + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #eee;flex-shrink:0;" />' +
                    '<div style="flex:1;min-width:0;">' +
                        '<p style="margin:0;font-size:13px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(p.name) + '</p>' +
                        '<p style="margin:2px 0 0;font-size:11px;color:#888;">' + (p.sku ? 'SKU: ' + escHtml(p.sku) + ' · ' : '') + escHtml(p.price_html) + '</p>' +
                    '</div>' +
                    '<button type="button" style="flex-shrink:0;background:' + GOLD + ';color:#000;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;">' +
                        (added ? '✓' : '+ Añadir') +
                    '</button>' +
                '</div>';
            }).join('');

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

        function addExtra(prod) {
            if (extraItems[prod.id]) return;
            extraItems[prod.id] = { product: prod, qty: 1 };
            renderExtraList();
        }

        function renderExtraList() {
            var list = el('ac-extra-list');
            var ids = Object.keys(extraItems);
            if (!ids.length) { list.style.display = 'none'; list.innerHTML = ''; return; }
            list.style.display = 'block';
            list.innerHTML = ids.map(function(id) {
                var item = extraItems[id]; var p = item.product;
                return '<div class="ac-extra-item" data-id="' + id + '" style="display:flex;align-items:center;gap:10px;background:#f9f9f9;border:1px solid #eee;border-radius:10px;padding:10px 12px;margin-bottom:8px;">' +
                    '<img src="' + safeUrl(p.image) + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #eee;flex-shrink:0;" />' +
                    '<div style="flex:1;min-width:0;">' +
                        '<p style="margin:0;font-size:12px;font-weight:800;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(p.name) + '</p>' +
                        '<p style="margin:2px 0 0;font-size:11px;color:#888;">' + escHtml(p.price_html) + '</p>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:5px;border:1px solid #ddd;border-radius:7px;padding:3px 8px;flex-shrink:0;">' +
                        '<button type="button" class="ac-extra-minus" style="background:none;border:none;font-size:16px;cursor:pointer;color:#555;padding:0;line-height:1;">−</button>' +
                        '<span class="ac-extra-qty" style="font-size:14px;font-weight:800;min-width:18px;text-align:center;">' + item.qty + '</span>' +
                        '<button type="button" class="ac-extra-plus" style="background:none;border:none;font-size:16px;cursor:pointer;color:#555;padding:0;line-height:1;">+</button>' +
                    '</div>' +
                    '<button type="button" class="ac-extra-remove" style="background:none;border:1px solid #eee;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#bbb;flex-shrink:0;" title="Quitar">✕</button>' +
                '</div>';
            }).join('');

            list.querySelectorAll('.ac-extra-item').forEach(function(row) {
                var id = row.getAttribute('data-id');
                row.querySelector('.ac-extra-minus').addEventListener('click', function() {
                    if (extraItems[id].qty > 1) { extraItems[id].qty--; row.querySelector('.ac-extra-qty').textContent = extraItems[id].qty; }
                });
                row.querySelector('.ac-extra-plus').addEventListener('click', function() {
                    extraItems[id].qty++; row.querySelector('.ac-extra-qty').textContent = extraItems[id].qty;
                });
                row.querySelector('.ac-extra-remove').addEventListener('click', function() {
                    delete extraItems[id]; renderExtraList();
                });
            });
        }

        // ── Construir lista de items ─────────────────────────────────────────
        function buildItems() {
            var items = [{
                name:     currentProduct.name,
                sku:      currentProduct.sku,
                price:    currentProduct.price,
                quantity: mainQty,
                image:    currentProduct.image,
                url:      currentProduct.url,
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
            return items;
        }

        // ── Submit — AMBAS rutas (Correo y WhatsApp) abren WhatsApp 😈 ────────
        el('ac-quote-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var form = this;
            var nameInput  = form.elements['name'];
            var emailInput = form.elements['email'];

            nameInput.style.borderColor  = '#ddd';
            emailInput.style.borderColor = '#ddd';

            var nameVal  = nameInput.value.trim();
            var emailVal = emailInput.value.trim();
            if (!nameVal)  { nameInput.focus();  nameInput.style.borderColor  = '#e53e3e'; return; }
            if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailVal)) { emailInput.focus(); emailInput.style.borderColor = '#e53e3e'; return; }

            var phoneVal   = form.elements['phone'].value.trim();
            var cityVal    = form.elements['city'].value.trim();
            var companyVal = form.elements['company'].value.trim();
            var msgVal     = form.elements['message'].value.trim();
            var items      = buildItems();

            // Construir URL de WhatsApp ANTES del fetch (dentro del gesto del usuario)
            var productLines = items.map(function(it) {
                return '• ' + it.name + ' x' + it.quantity + (it.sku ? ' (SKU: ' + it.sku + ')' : '');
            }).join('\n');

            var waMsg = '¡Hola Arte Concreto! 👋\n\n'
                + 'Mi nombre es *' + nameVal + '*'
                + (companyVal ? ' de *' + companyVal + '*' : '') + '.\n\n'
                + 'Quisiera una cotización para:\n' + productLines + '\n\n'
                + (cityVal ? '📍 Ciudad: ' + cityVal + '\n' : '')
                + (msgVal  ? '💬 ' + msgVal + '\n' : '')
                + '\n📧 ' + emailVal
                + (phoneVal ? '\n📱 ' + phoneVal : '');

            var waURL = 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(waMsg);

            // Mostrar estado de carga
            form.style.display = 'none';
            el('ac-sending').style.display = 'block';
            el('ac-error').style.display   = 'none';

            // Abrir WhatsApp INMEDIATAMENTE (evita popup blocker)
            window.open(waURL, '_blank');

            // Enviar al CRM en segundo plano
            fetch(CRM_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
                body:    JSON.stringify({
                    name: nameVal, email: emailVal, phone: phoneVal,
                    city: cityVal, company: companyVal, message: msgVal,
                    source: currentSource, items: items,
                }),
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                el('ac-sending').style.display = 'none';
                el('ac-success').style.display = 'block';
                setTimeout(closeModal, 4000);
            })
            .catch(function() {
                // WhatsApp ya se abrió, el lead llegó igual, no mostramos error
                el('ac-sending').style.display = 'none';
                el('ac-success').style.display = 'block';
                setTimeout(closeModal, 4000);
            });
        });

        function escHtml(str) {
            return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }
    })();
    </script>
    <?php
}
