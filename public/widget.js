(function () {
  if (window.__miwiWidgetLoaded) return;
  window.__miwiWidgetLoaded = true;

  var settings = window.miwiSettings || {};
  var currentScript = document.currentScript;
  var scriptUrl = currentScript && currentScript.src ? new URL(currentScript.src, window.location.href) : new URL(window.location.href);
  var baseUrl = scriptUrl.origin;
  var position = settings.position === "left-bottom" ? "left" : "right";
  var primaryColor = settings.primaryColor || "#FAB510";
  var botName = settings.botName || "MiWi AI";

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

  var root = document.createElement("div");
  root.id = "miwi-widget-root";
  root.style.position = "fixed";
  root.style.bottom = "24px";
  root.style[position] = "24px";
  root.style.zIndex = "2147483000";
  root.style.fontFamily = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  var panel = document.createElement("div");
  panel.style.width = "380px";
  panel.style.maxWidth = "calc(100vw - 32px)";
  panel.style.height = "640px";
  panel.style.maxHeight = "calc(100vh - 110px)";
  panel.style.border = "1px solid rgba(23,23,23,0.08)";
  panel.style.borderRadius = "28px";
  panel.style.overflow = "hidden";
  panel.style.background = "rgba(255,253,248,0.96)";
  panel.style.boxShadow = "0 24px 80px rgba(23,23,23,0.18)";
  panel.style.backdropFilter = "blur(18px)";
  panel.style.WebkitBackdropFilter = "blur(18px)";
  panel.style.marginBottom = "16px";
  panel.style.display = "none";

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

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Abrir chat de " + botName);
  launcher.style.width = "64px";
  launcher.style.height = "64px";
  launcher.style.borderRadius = "22px";
  launcher.style.border = "0";
  launcher.style.cursor = "pointer";
  launcher.style.background = primaryColor;
  launcher.style.color = "#171717";
  launcher.style.boxShadow = "0 20px 45px rgba(250,181,16,0.32)";
  launcher.style.display = "flex";
  launcher.style.alignItems = "center";
  launcher.style.justifyContent = "center";
  launcher.style.fontSize = "28px";
  launcher.style.fontWeight = "900";
  launcher.style.transition = "transform .18s ease, box-shadow .18s ease";
  var launcherOpenMarkup =
    '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">' +
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M21 12c0 4.418-4.03 8-9 8a9.94 9.94 0 0 1-4.255-.949L3 20l1.32-3.521A7.55 7.55 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"/>' +
    "</svg></span>";
  var launcherCloseMarkup = '<span style="font-size:24px;line-height:1;">×</span>';
  launcher.innerHTML = launcherOpenMarkup;

  launcher.addEventListener("mouseenter", function () {
    launcher.style.transform = "translateY(-2px)";
    launcher.style.boxShadow = "0 24px 52px rgba(250,181,16,0.4)";
  });
  launcher.addEventListener("mouseleave", function () {
    launcher.style.transform = "translateY(0)";
    launcher.style.boxShadow = "0 20px 45px rgba(250,181,16,0.32)";
  });

  var isOpen = false;
  function syncState() {
    panel.style.display = isOpen ? "block" : "none";
    launcher.innerHTML = isOpen ? launcherCloseMarkup : launcherOpenMarkup;
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

  root.appendChild(panel);
  root.appendChild(launcher);
  document.body.appendChild(root);
})();
