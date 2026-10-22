// Pixels de anúncio (Meta e Google). Só carregam se o ID estiver preenchido em js/config.js.
// Eventos enviados: PageView (visita), Lead (pedido de orçamento enviado), Contact (clique no WhatsApp/iFood/Instagram).
(function () {
  const C = window.CHOWDER || {};
  const meta = (C.pixelMeta || "").trim(), ga = (C.googleTag || "").trim();
  if (meta && /^\d{6,20}$/.test(meta)) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", meta); fbq("track", "PageView");
  }
  if (ga && /^(G|AW)-[A-Z0-9]+$/.test(ga)) {
    const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + ga; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments) }; gtag("js", new Date()); gtag("config", ga);
  }
  window.ChowderRastreio = {
    lead(dados) {
      try { window.fbq && fbq("track", "Lead", { content_name: dados.ocasiao || "Orçamento", content_category: (dados.necessidades || []).join(", "), value: dados.valor || 0, currency: "BRL" }) } catch (e) {}
      try { window.gtag && gtag("event", "generate_lead", { event_category: dados.ocasiao || "Orçamento", value: dados.valor || 0, currency: "BRL" }) } catch (e) {}
    },
    contato(canal) {
      try { window.fbq && fbq("track", "Contact", { content_name: canal }) } catch (e) {}
      try { window.gtag && gtag("event", "contact", { method: canal }) } catch (e) {}
    }
  };
})();
