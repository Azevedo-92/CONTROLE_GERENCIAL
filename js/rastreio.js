// Pixels de anúncio (Meta e Google). Só carregam se o ID estiver preenchido em js/config.js
// E se o visitante aceitar no aviso de cookies (LGPD). Recusou = nada é carregado.
// Eventos enviados: PageView (visita), Lead (pedido de orçamento enviado), Contact (clique no WhatsApp/iFood/Instagram),
// CompleteRegistration (cadastro em promoção).
(function () {
  const C = window.CHOWDER || {};
  const meta = (C.pixelMeta || "").trim(), ga = (C.googleTag || "").trim();
  const temMeta = /^\d{6,20}$/.test(meta), temGa = /^(G|AW)-[A-Z0-9]+$/.test(ga);
  const CHAVE = "chowder-cookies";
  const ler = () => { try { return localStorage.getItem(CHAVE) } catch (e) { return null } };
  const gravar = v => { try { localStorage.setItem(CHAVE, v) } catch (e) {} };
  let carregado = false;

  function carregar() {
    if (carregado) return; carregado = true;
    if (temMeta) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", meta); fbq("track", "PageView");
    }
    if (temGa) {
      const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + ga; document.head.appendChild(s);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments) }; gtag("js", new Date()); gtag("config", ga);
    }
  }

  // ---------- Aviso de cookies ----------
  let aviso = null;
  function mostrarAviso() {
    if (aviso) { aviso.hidden = false; return; }
    const css = document.createElement("style");
    css.textContent =
      ".cookies{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:40;max-width:560px;margin:0 auto;" +
      "background:var(--navy,#131F37);color:var(--on-dark,#F5EFE6);border:1px solid rgba(196,162,101,.55);border-radius:14px;padding:16px;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.35);font:15px/1.45 var(--f-body,system-ui,sans-serif)}" +
      ".cookies p{margin:0}.cookies a{color:var(--gold,#C4A265)}" +
      ".cookies .acoes{display:flex;gap:8px;margin-top:12px}" +
      ".cookies button{flex:1;min-height:44px;border-radius:10px;font:700 .95rem var(--f-body,system-ui,sans-serif);cursor:pointer}" +
      ".cookies .sim{background:var(--gold,#C4A265);color:var(--navy,#131F37);border:0}" +
      ".cookies .nao{background:transparent;color:inherit;border:1px solid rgba(245,239,230,.45)}";
    document.head.appendChild(css);
    aviso = document.createElement("div");
    aviso.className = "cookies"; aviso.setAttribute("role", "dialog"); aviso.setAttribute("aria-label", "Aviso de cookies");
    aviso.innerHTML =
      '<p>Usamos cookies para medir os resultados dos nossos anúncios (' + [temMeta && "Meta", temGa && "Google"].filter(Boolean).join(" e ") + '). ' +
      'Você pode aceitar ou recusar; o site funciona igual. <a href="/privacidade">Política de privacidade</a></p>' +
      '<div class="acoes"><button type="button" class="nao">Recusar</button><button type="button" class="sim">Aceitar</button></div>';
    aviso.querySelector(".sim").onclick = () => { gravar("sim"); aviso.hidden = true; carregar(); };
    aviso.querySelector(".nao").onclick = () => {
      const tinha = carregado; gravar("nao"); aviso.hidden = true;
      if (tinha) location.reload(); // descarrega os pixels que já estavam ativos
    };
    document.body.appendChild(aviso);
  }

  if (temMeta || temGa) {
    const escolha = ler();
    if (escolha === "sim") carregar();
    else if (escolha !== "nao") {
      if (document.body) mostrarAviso(); else document.addEventListener("DOMContentLoaded", mostrarAviso);
    }
  }

  window.ChowderRastreio = {
    preferencias() { if (temMeta || temGa) mostrarAviso(); },
    lead(dados) {
      try { window.fbq && fbq("track", "Lead", { content_name: dados.ocasiao || "Orçamento", content_category: (dados.necessidades || []).join(", "), value: dados.valor || 0, currency: "BRL" }) } catch (e) {}
      try { window.gtag && gtag("event", "generate_lead", { event_category: dados.ocasiao || "Orçamento", value: dados.valor || 0, currency: "BRL" }) } catch (e) {}
    },
    cadastro(promocao) {
      try { window.fbq && fbq("track", "CompleteRegistration", { content_name: promocao, status: true }) } catch (e) {}
      try { window.gtag && gtag("event", "sign_up", { method: promocao }) } catch (e) {}
    },
    contato(canal) {
      try { window.fbq && fbq("track", "Contact", { content_name: canal }) } catch (e) {}
      try { window.gtag && gtag("event", "contact", { method: canal }) } catch (e) {}
    }
  };
})();
