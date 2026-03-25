(function () {
  if (window.__miwiWidgetLoaded) return;
  window.__miwiWidgetLoaded = true;

  var settings = window.miwiSettings || {};
  var currentScript = document.currentScript;
  var scriptUrl = currentScript && currentScript.src ? new URL(currentScript.src, window.location.href) : new URL(window.location.href);
  var baseUrl = scriptUrl.origin;
  var position = settings.position === "left-bottom" ? "left" : "right";
  var primaryColor = settings.primaryColor || "#FAB510";
  var botName = settings.botName || "ConcreBOT";

  if (settings.authorizedDomain) {
    var host = window.location.hostname;
    var allowed = String(settings.authorizedDomain)
      .split(",")
      .map(function (item) { return item.trim(); })
      .filter(Boolean)
      .some(function (domain) { return host === domain || host.endsWith("." + domain); });
    if (!allowed && host !== "localhost" && host !== "127.0.0.1") {
      console.warn("[MiWi Widget] Dominio no autorizado:", host);
    }
  }

  /* ── inject keyframes for pulse animation ── */
  var style = document.createElement("style");
  style.textContent =
    "@keyframes miwi-pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.15);opacity:0}}" +
    "@keyframes miwi-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}";
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = "miwi-widget-root";
  root.style.position = "fixed";
  root.style.bottom = "24px";
  root.style[position] = "24px";
  root.style.zIndex = "2147483000";
  root.style.fontFamily = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.alignItems = position === "right" ? "flex-end" : "flex-start";
  root.style.gap = "12px";

  /* ── chat panel ── */
  var panel = document.createElement("div");
  panel.style.width = "380px";
  panel.style.maxWidth = "calc(100vw - 32px)";
  panel.style.height = "640px";
  panel.style.maxHeight = "calc(100vh - 110px)";
  panel.style.border = "1px solid rgba(23,23,23,0.08)";
  panel.style.borderRadius = "28px";
  panel.style.overflow = "hidden";
  panel.style.background = "rgba(255,253,248,0.98)";
  panel.style.boxShadow = "0 24px 80px rgba(23,23,23,0.18)";
  panel.style.backdropFilter = "blur(18px)";
  panel.style.WebkitBackdropFilter = "blur(18px)";
  panel.style.display = "none";
  panel.style.transition = "opacity .2s ease, transform .2s ease";

  var iframe = document.createElement("iframe");
  iframe.title = botName;
  iframe.setAttribute("aria-label", botName);
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.src =
    baseUrl +
    "/widget?botName=" + encodeURIComponent(botName) +
    "&primaryColor=" + encodeURIComponent(primaryColor) +
    "&apiKey=" + encodeURIComponent(settings.apiKey || "") +
    "&authorizedDomain=" + encodeURIComponent(settings.authorizedDomain || "") +
    "&whatsappSync=" + encodeURIComponent(String(Boolean(settings.whatsappSync)));
  panel.appendChild(iframe);

  /* ── launcher wrapper (pulse ring + button + tooltip) ── */
  var launcherWrap = document.createElement("div");
  launcherWrap.style.position = "relative";
  launcherWrap.style.display = "flex";
  launcherWrap.style.alignItems = "center";
  launcherWrap.style.gap = "10px";
  launcherWrap.style.flexDirection = position === "right" ? "row-reverse" : "row";

  /* pulse ring */
  var pulseRing = document.createElement("div");
  pulseRing.style.position = "absolute";
  pulseRing.style.inset = "-8px";
  pulseRing.style.borderRadius = "30px";
  pulseRing.style.border = "3px solid " + primaryColor;
  pulseRing.style.animation = "miwi-pulse 2s ease-in-out infinite";
  pulseRing.style.pointerEvents = "none";

  /* launcher button */
  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Abrir chat de " + botName);
  launcher.style.position = "relative";
  launcher.style.width = "68px";
  launcher.style.height = "68px";
  launcher.style.borderRadius = "22px";
  launcher.style.border = "0";
  launcher.style.cursor = "pointer";
  launcher.style.background = primaryColor;
  launcher.style.color = "#171717";
  launcher.style.boxShadow = "0 20px 45px rgba(250,181,16,0.38)";
  launcher.style.display = "flex";
  launcher.style.alignItems = "center";
  launcher.style.justifyContent = "center";
  launcher.style.transition = "transform .18s ease, box-shadow .18s ease";
  launcher.style.animation = "miwi-bounce 2.5s ease-in-out infinite";
  launcher.style.flexShrink = "0";

  /* robot SVG icon (open state) */
  var robotSVG =
    '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="11" width="18" height="10" rx="2"/>' +
    '<path d="M12 3a2 2 0 0 1 2 2v1H10V5a2 2 0 0 1 2-2z"/>' +
    '<path d="M12 6v5"/>' +
    '<circle cx="8.5" cy="16" r="1.2" fill="currentColor"/>' +
    '<circle cx="15.5" cy="16" r="1.2" fill="currentColor"/>' +
    '<path d="M9 19.5h6"/>' +
    '<path d="M2 14h1M21 14h1"/>' +
    '</svg>';

  /* close X icon */
  var closeSVG =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M18 6 6 18M6 6l12 12"/>' +
    '</svg>';

  launcher.innerHTML = robotSVG;

  /* tooltip label */
  var tooltip = document.createElement("div");
  tooltip.style.background = "#fff";
  tooltip.style.color = "#171717";
  tooltip.style.fontSize = "13px";
  tooltip.style.fontWeight = "800";
  tooltip.style.padding = "10px 16px";
  tooltip.style.borderRadius = "14px";
  tooltip.style.boxShadow = "0 8px 32px rgba(23,23,23,0.13)";
  tooltip.style.border = "1px solid rgba(23,23,23,0.08)";
  tooltip.style.whiteSpace = "nowrap";
  tooltip.style.lineHeight = "1.4";
  tooltip.style.cursor = "pointer";
  tooltip.style.transition = "opacity .3s ease, transform .3s ease";
  tooltip.style.opacity = "0";
  tooltip.style.transform = "translateX(" + (position === "right" ? "8px" : "-8px") + ")";
  tooltip.style.userSelect = "none";
  tooltip.innerHTML = "💬 <strong>¿Hablamos?</strong><br><span style='font-size:11px;font-weight:600;color:#666;'>Cotiza o consulta aquí</span>";

  /* show tooltip after 2 seconds */
  setTimeout(function () {
    tooltip.style.opacity = "1";
    tooltip.style.transform = "translateX(0)";
  }, 2000);

  /* hide tooltip after 8 seconds if not clicked */
  setTimeout(function () {
    tooltip.style.opacity = "0";
    tooltip.style.transform = "translateX(" + (position === "right" ? "8px" : "-8px") + ")";
  }, 8000);

  tooltip.addEventListener("click", function () {
    isOpen = true;
    syncState();
  });

  /* hover effects */
  launcher.addEventListener("mouseenter", function () {
    launcher.style.transform = "translateY(-3px) scale(1.05)";
    launcher.style.boxShadow = "0 28px 56px rgba(250,181,16,0.5)";
    launcher.style.animation = "none";
    tooltip.style.opacity = "1";
    tooltip.style.transform = "translateX(0)";
  });
  launcher.addEventListener("mouseleave", function () {
    launcher.style.transform = "translateY(0) scale(1)";
    launcher.style.boxShadow = "0 20px 45px rgba(250,181,16,0.38)";
    if (!isOpen) launcher.style.animation = "miwi-bounce 2.5s ease-in-out infinite";
  });

  var isOpen = false;

  function syncState() {
    if (isOpen) {
      panel.style.display = "block";
      launcher.innerHTML = closeSVG;
      launcher.style.animation = "none";
      pulseRing.style.display = "none";
      tooltip.style.opacity = "0";
    } else {
      panel.style.display = "none";
      launcher.innerHTML = robotSVG;
      launcher.style.animation = "miwi-bounce 2.5s ease-in-out infinite";
      pulseRing.style.display = "block";
    }
  }

  launcher.addEventListener("click", function () {
    isOpen = !isOpen;
    syncState();
  });

  window.addEventListener("message", function (event) {
    if (!event || !event.data) return;
    if (event.data.type === "miwi-widget-close") {
      isOpen = false;
      syncState();
    }
  });

  launcher.appendChild(pulseRing);
  launcherWrap.appendChild(tooltip);
  launcherWrap.appendChild(launcher);

  root.appendChild(panel);
  root.appendChild(launcherWrap);
  document.body.appendChild(root);
})();
