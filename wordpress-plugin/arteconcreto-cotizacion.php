<?php
/**
 * Plugin Name: Arte Concreto – Botón Pedir Cotización
 * Description: Agrega un botón "Pedir Cotización" en las páginas de producto WooCommerce. Envía la solicitud al CRM MiWibi y la crea automáticamente en el pipeline.
 * Version: 1.0.0
 * Author: Arte Concreto / MiWibi
 * Text Domain: ac-cotizacion
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ── Configuración ────────────────────────────────────────────────────────────
// Cambia esta URL por la URL de producción de tu CRM
define( 'AC_CRM_ENDPOINT', 'https://crm-sand-three.vercel.app/api/woo-quote' );
// Color primario del botón (dorado Arte Concreto)
define( 'AC_BUTTON_COLOR', '#fab510' );

// ── Agregar botón en página de producto ─────────────────────────────────────
add_action( 'woocommerce_single_product_summary', 'ac_cotizacion_button', 35 );

function ac_cotizacion_button() {
    global $product;
    if ( ! $product ) return;

    $price      = $product->get_price();
    $name       = esc_js( $product->get_name() );
    $sku        = esc_js( $product->get_sku() );
    $image_url  = esc_js( wp_get_attachment_url( $product->get_image_id() ) );
    $product_url = esc_js( get_permalink() );
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
            box-shadow:0 32px 80px rgba(0,0,0,.2); overflow:hidden;
            font-family:system-ui,-apple-system,sans-serif;
        ">
            <!-- Header -->
            <div style="background:#14141700; border-bottom:1px solid #eee; padding:20px 24px; display:flex; align-items:center; justify-content:space-between;">
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
                <!-- Producto -->
                <div style="background:#f9f9f9; border:1px solid #eee; border-radius:12px; padding:16px; margin-bottom:20px; display:flex; align-items:center; gap:14px;">
                    <img id="ac-prod-img" src="<?php echo esc_url( wp_get_attachment_url( $product->get_image_id() ) ); ?>"
                         style="width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid #eee;" alt="" />
                    <div style="flex:1; min-width:0;">
                        <p style="margin:0; font-size:13px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            <?php echo esc_html( $product->get_name() ); ?>
                        </p>
                        <?php if ( $product->get_sku() ) : ?>
                        <p style="margin:4px 0 0; font-size:11px; color:#888;">SKU: <?php echo esc_html( $product->get_sku() ); ?></p>
                        <?php endif; ?>
                        <p style="margin:6px 0 0; font-size:13px; font-weight:700; color:#111;"><?php echo $price_display; ?></p>
                    </div>
                    <!-- Cantidad -->
                    <div style="display:flex; align-items:center; gap:8px; border:1px solid #ddd; border-radius:8px; padding:4px 10px;">
                        <button type="button" id="ac-qty-minus" style="background:none; border:none; font-size:18px; cursor:pointer; color:#555; padding:0 2px; line-height:1;">−</button>
                        <span id="ac-qty-display" style="font-size:15px; font-weight:800; min-width:20px; text-align:center;">1</span>
                        <button type="button" id="ac-qty-plus" style="background:none; border:none; font-size:18px; cursor:pointer; color:#555; padding:0 2px; line-height:1;">+</button>
                    </div>
                </div>

                <p style="margin:0 0 16px; font-size:13px; color:#555;">Completa tus datos y te enviamos la cotización a tu correo.</p>

                <!-- Formulario -->
                <form id="ac-quote-form" autocomplete="on">
                    <div style="margin-bottom:14px;">
                        <label style="display:block; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#777; margin-bottom:6px;">Nombre completo *</label>
                        <input name="name" type="text" required placeholder="Ej: Juan Pérez"
                               style="width:100%; padding:12px 14px; border:1.5px solid #ddd; border-radius:10px; font-size:14px; box-sizing:border-box; outline:none; font-family:inherit;"
                               onfocus="this.style.borderColor='<?php echo AC_BUTTON_COLOR; ?>'" onblur="this.style.borderColor='#ddd'" />
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
    </style>

    <script>
    (function() {
        var CRM_URL   = '<?php echo esc_js( AC_CRM_ENDPOINT ); ?>';
        var PROD_NAME = <?php echo json_encode( $product->get_name() ); ?>;
        var PROD_SKU  = <?php echo json_encode( $product->get_sku() ); ?>;
        var PROD_PRICE = <?php echo json_encode( floatval( $product->get_price() ) ); ?>;
        var PROD_IMG  = <?php echo json_encode( wp_get_attachment_url( $product->get_image_id() ) ); ?>;
        var PROD_URL  = <?php echo json_encode( get_permalink() ); ?>;

        var qty = 1;

        function el(id) { return document.getElementById(id); }

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
        }

        el('ac-qty-minus').addEventListener('click', function() {
            if (qty > 1) { qty--; el('ac-qty-display').textContent = qty; }
        });
        el('ac-qty-plus').addEventListener('click', function() {
            qty++; el('ac-qty-display').textContent = qty;
        });

        el('ac-quote-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var form = e.target;
            var data = {
                name:    form.name.value.trim(),
                email:   form.email.value.trim(),
                phone:   form.phone.value.trim(),
                city:    form.city.value.trim(),
                source:  'WooCommerce',
                product: {
                    name:  PROD_NAME,
                    sku:   PROD_SKU,
                    price: PROD_PRICE,
                    qty:   qty,
                    image: PROD_IMG,
                    url:   PROD_URL,
                }
            };

            el('ac-quote-form').style.display = 'none';
            el('ac-sending').style.display = 'block';
            el('ac-error').style.display = 'none';

            fetch(CRM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
    })();
    </script>
    <?php
}
