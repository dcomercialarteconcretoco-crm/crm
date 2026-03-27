import { NextResponse } from 'next/server';

export const runtime = 'edge';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-sand-three.vercel.app';

const sdkScript = `
(function () {
  var BASE_URL = '${BASE_URL}';

  function injectStyles() {
    if (document.getElementById('miwibi-sdk-styles')) return;
    var style = document.createElement('style');
    style.id = 'miwibi-sdk-styles';
    style.textContent = [
      '.miwibi-frame-wrapper{width:100%;position:relative;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}',
      '.miwibi-frame-wrapper iframe{width:100%;border:none;display:block;min-height:600px;transition:height 0.3s ease;}',
      '.miwibi-frame-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#fafafa;}',
      '.miwibi-spinner{width:32px;height:32px;border:3px solid #f3f3f3;border-top:3px solid #fab510;border-radius:50%;animation:miwibi-spin 0.8s linear infinite;}',
      '@keyframes miwibi-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
    ].join('');
    document.head.appendChild(style);
  }

  function buildIframeSrc(id, theme, color, fields) {
    var params = new URLSearchParams();
    if (theme) params.set('theme', theme);
    if (color) params.set('color', encodeURIComponent(color));
    if (fields && fields.length) params.set('fields', fields.join(','));
    var qs = params.toString();
    return BASE_URL + '/public/f/' + id + (qs ? '?' + qs : '');
  }

  function initForm(options) {
    if (!options || !options.id) {
      console.error('[MiWibi] initForm: missing required option "id"');
      return;
    }

    var id = options.id;
    var fields = options.fields || [];
    var containerId = 'miwibi-form-' + id;
    var container = document.getElementById(containerId);

    if (!container) {
      // try data-id selector fallback
      container = document.querySelector('[data-id="' + id + '"]');
    }

    if (!container) {
      console.error('[MiWibi] initForm: container not found for id "' + id + '"');
      return;
    }

    var theme = container.getAttribute('data-theme') || options.theme || 'glass';
    var color = container.getAttribute('data-color') || options.color || '#FAB510';

    injectStyles();

    var wrapper = document.createElement('div');
    wrapper.className = 'miwibi-frame-wrapper';

    var loader = document.createElement('div');
    loader.className = 'miwibi-frame-loading';
    loader.innerHTML = '<div class="miwibi-spinner"></div>';
    wrapper.appendChild(loader);

    var iframe = document.createElement('iframe');
    iframe.src = buildIframeSrc(id, theme, color, fields);
    iframe.title = 'Formulario de contacto';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('loading', 'lazy');
    wrapper.appendChild(iframe);

    container.innerHTML = '';
    container.appendChild(wrapper);

    iframe.addEventListener('load', function () {
      loader.style.display = 'none';
    });

    // Auto-resize from postMessage
    window.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== 'miwibi:resize') return;
      if (event.data.formId !== id) return;
      var h = parseInt(event.data.height, 10);
      if (!isNaN(h) && h > 0) {
        iframe.style.height = (h + 24) + 'px';
      }
    });
  }

  window.MiWibi = { initForm: initForm };

  // Auto-init any elements already in the DOM
  document.addEventListener('DOMContentLoaded', function () {
    var elems = document.querySelectorAll('[id^="miwibi-form-"][data-id]');
    elems.forEach(function (el) {
      var dataId = el.getAttribute('data-id');
      if (dataId) {
        initForm({ id: dataId });
      }
    });
  });
})();
`;

export async function GET() {
  return new NextResponse(sdkScript, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
