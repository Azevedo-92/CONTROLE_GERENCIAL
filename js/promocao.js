// Promoção da landing (ex.: Black Friday). Cadastrada no painel, em "Promoções".
// Durante o período da promoção a caixinha abre sozinha (pelo link da promoção ou pelo site normal).
// Quem fecha no X não vê de novo automaticamente; a faixa no topo reabre.
(function () {
  const C = window.CHOWDER || {};
  if (!C.supabaseUrl || !C.supabaseAnonKey) return;
  const qs = new URLSearchParams(location.search);
  const slugLink = (qs.get("promo") || "").toLowerCase();
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ler = k => { try { return localStorage.getItem(k) } catch (e) { return null } };
  const gravar = (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} };
  const fdata = s => { const [y, m, d] = s.split("-"); return d + "/" + m; };
  const mascara = v => { const d = v.replace(/\D/g, "").slice(0, 11); if (d.length <= 2) return d; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };

  let sb = null, promo = null, caixa = null, ultimoFoco = null;
  const TEMAS = ["chowder", "bordo", "blackfriday"];
  const tema = () => "tema-" + (TEMAS.includes(promo.tema) ? promo.tema : "chowder");
  // No tema Black Friday a última palavra do título fica em amarelo ("Black <Friday>").
  const titulo = () => { const t = esc(promo.titulo); if (promo.tema !== "blackfriday") return t; const i = t.lastIndexOf(" "); return i > 0 ? t.slice(0, i) + ' <span class="y">' + t.slice(i + 1) + "</span>" : '<span class="y">' + t + "</span>"; };
  const grupo = () => /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/.test(promo.grupo_whatsapp || "") ? promo.grupo_whatsapp : "";
  const WA_ICONE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 .9c.3.2.5.2.5.4.1.1.1.7-.1 1.3Z"/></svg>';
  const entrouGrupo = () => { window.ChowderRastreio && ChowderRastreio.contato("Grupo WhatsApp " + promo.titulo); };
  // Botão da seção para quem já se cadastrou: leva ao grupo (se houver) ou mostra que já está na lista.
  function ctaCadastrado(cta) {
    if (!cta) return;
    if (grupo()) { cta.disabled = false; cta.classList.add("grupo"); cta.innerHTML = WA_ICONE + " Entrar no grupo do WhatsApp"; cta.onclick = () => { entrouGrupo(); window.open(grupo(), "_blank", "noopener"); }; }
    else { cta.disabled = true; cta.textContent = "✓ Você já está na lista"; }
  }
  const imgs = () => (Array.isArray(promo.imagens) ? promo.imagens : []).filter(x => x && x.path);
  const imgUrl = path => C.supabaseUrl + "/storage/v1/object/public/promocoes-img/" + path.split("/").map(encodeURIComponent).join("/");
  const imgTag = (x, alt, extra) => `<img src="${esc(imgUrl(x.path))}" alt="${esc(alt)}"${x.w && x.h ? ` width="${+x.w}" height="${+x.h}"` : ""} ${extra || ""}>`;

  async function iniciar() {
    if (!window.supabase) return;
    try { sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: false } }); } catch (e) { return; }
    // O banco só devolve promoções ativas e dentro do período.
    const { data, error } = await sb.from("promocoes").select("id,slug,titulo,chamada,botao,fim,imagens,tema,grupo_whatsapp").order("inicio", { ascending: false });
    if (error || !data || !data.length) return;
    promo = data.find(p => p.slug === slugLink) || data[0];
    const k = "promo-" + promo.id;
    const cadastrado = ler(k) === "cadastrado";
    if (!cadastrado) montarFaixa();
    montarSecao(cadastrado);
    if (slugLink === promo.slug) { if (!cadastrado) abrir(); }
    else if (!cadastrado && !ler(k)) setTimeout(() => { if (!document.querySelector(".promo-modal:not([hidden])")) abrir(); }, 2500);
  }

  function estilos() {
    if (document.getElementById("promo-css")) return;
    const s = document.createElement("style"); s.id = "promo-css";
    s.textContent = `
.promo-faixa{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:0;cursor:pointer;background:linear-gradient(90deg,var(--bord),#7a2338 50%,var(--bord));color:#fff;font:600 .92rem/1.2 var(--f-body);padding:9px 16px;text-align:center}
.promo-faixa b{color:var(--gold);letter-spacing:.06em;text-transform:uppercase;font-size:.8rem}
.promo-faixa span.seta{color:var(--gold)}
.promo-modal{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px}
.promo-modal .fundo{position:absolute;inset:0;background:rgba(8,12,24,.62)}
.promo-box{position:relative;width:100%;max-width:420px;max-height:calc(100dvh - 32px);overflow:auto;background:var(--navy);color:var(--on-dark);border:1px solid var(--gold);border-radius:16px;padding:26px 20px 20px;box-shadow:0 20px 50px rgba(0,0,0,.45);text-align:center}
.promo-box::before{content:"";position:absolute;inset:6px;border:1px solid rgba(196,162,101,.28);border-radius:11px;pointer-events:none}
.promo-x{position:absolute;top:8px;right:8px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(19,31,55,.72);color:var(--on-dark);font-size:1.7rem;line-height:1;cursor:pointer;z-index:1}
.promo-x:hover{background:rgba(255,255,255,.08)}
.promo-box .eyebrow{color:var(--gold)}
.promo-box h2{font-size:2.3rem;margin:8px 0 6px;color:#fff}
.promo-box .chamada{margin:0 0 4px;color:var(--on-dark-mute);font-size:1rem}
.promo-box .validade{margin:0 0 14px;color:var(--gold);font-size:.85rem}
.promo-box form{text-align:left;display:grid;gap:10px}
.promo-box label.c{display:grid;gap:4px;font-weight:600;font-size:.9rem}
.promo-box input[type=text],.promo-box input[type=tel],.promo-box input[type=email]{width:100%;font:inherit;font-size:16px;padding:12px;border-radius:10px;border:1px solid rgba(196,162,101,.5);background:#0F1A2F;color:#fff}
.promo-box input:focus{outline:2px solid var(--gold);outline-offset:0;border-color:var(--gold)}
.promo-box .aceite{display:flex;gap:10px;align-items:flex-start;font-size:.85rem;color:var(--on-dark-mute);line-height:1.4}
.promo-box .aceite input{width:20px;height:20px;flex:none;margin-top:1px;accent-color:var(--gold)}
.promo-box .aceite a{color:var(--gold)}
.promo-box .enviar{min-height:52px;border:0;border-radius:10px;background:var(--gold);color:var(--navy);font:700 1.05rem var(--f-body);cursor:pointer;margin-top:4px}
.promo-box .enviar[disabled]{opacity:.6;cursor:wait}
.promo-box .erro{color:#F08A8F;font-size:.88rem;margin:0;min-height:1em}
.promo-box .ok{font-size:2rem;width:60px;height:60px;border-radius:50%;margin:6px auto 10px;display:grid;place-items:center;border:1px solid var(--gold);color:var(--gold)}
.promo-capa{margin:10px -8px 14px;border-radius:10px;overflow:hidden;background:#0B1324;display:flex;justify-content:center}
.promo-capa img{display:block;width:auto;max-width:100%;height:auto;max-height:min(34vh,300px);object-fit:contain}
.promo-sec .promo-galeria{display:grid;grid-auto-flow:column;grid-auto-columns:min(78%,340px);align-items:start;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 0 8px;margin-top:16px;scrollbar-width:thin;outline:none}
.promo-sec .promo-galeria figure{margin:0;scroll-snap-align:start;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:var(--card);box-shadow:var(--shadow)}
.promo-sec .promo-galeria img{display:block;width:100%;height:auto}
.promo-sec .promo-galeria:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.promo-sec .promo-cta{max-width:420px;margin:16px auto 0}
.promo-sec .promo-cta[disabled]{background:var(--ok);cursor:default}
.promo-box .grupo-txt{margin-top:12px;color:#fff;font-weight:600}
.promo-grupo{display:flex;align-items:center;justify-content:center;gap:10px;min-height:52px;margin-top:10px;border-radius:10px;background:#1F7A4D;color:#fff!important;font:700 1.05rem var(--f-body);text-decoration:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.promo-grupo:hover{background:#196A42}
.promo-sec .promo-cta.grupo,.promo-sec.tema-bordo .promo-cta.grupo,.promo-sec.tema-blackfriday .promo-cta.grupo{background:#1F7A4D;color:#fff;text-transform:none;letter-spacing:0}
header.top .menu a.promo-menu{color:var(--gold)}
/* Tema Bordô */
.promo-modal.tema-bordo .promo-box{background:radial-gradient(130% 90% at 50% 0%,#7A2338 0,var(--bord) 45%,#3F0F1A 100%)}
.promo-modal.tema-bordo .promo-box input[type=text],.promo-modal.tema-bordo .promo-box input[type=tel],.promo-modal.tema-bordo .promo-box input[type=email]{background:#3D0E19;border-color:rgba(196,162,101,.55)}
.promo-modal.tema-bordo .chamada,.promo-modal.tema-bordo .aceite{color:#EAD9DC}
.promo-modal.tema-bordo .promo-x{background:rgba(61,14,25,.75)}
.promo-modal.tema-bordo .promo-capa{background:#3D0E19}
.promo-sec.tema-bordo{background:var(--bord);color:var(--on-dark);padding-bottom:40px;margin-top:36px}
.promo-sec.tema-bordo .eyebrow{color:var(--gold)}.promo-sec.tema-bordo .sub{color:#EAD9DC}
.promo-sec.tema-bordo .promo-galeria figure{border-color:rgba(196,162,101,.4)}
.promo-sec.tema-bordo .promo-cta{background:var(--gold);color:var(--navy)}
/* Tema Black Friday: preto e amarelo */
.promo-faixa.tema-blackfriday{background:#0A0A0A;border-bottom:2px solid #FFD400}
.promo-faixa.tema-blackfriday b,.promo-faixa.tema-blackfriday span.seta{color:#FFD400}
.promo-modal.tema-blackfriday .promo-box{background:#0A0A0A;border:2px solid #FFD400;color:#fff;padding-top:0}
.promo-modal.tema-blackfriday .promo-box::before{display:none}
.promo-modal.tema-blackfriday .eyebrow{display:block;background:#FFD400;color:#0A0A0A;margin:0 -20px 14px;padding:12px 48px;border-radius:12px 12px 0 0;font-weight:800}
.promo-modal.tema-blackfriday .promo-capa{margin-top:0;background:#141414}
.promo-modal.tema-blackfriday h2{font-family:var(--f-body);font-weight:900;text-transform:uppercase;color:#fff;font-size:2.6rem;line-height:1.05}
.promo-modal.tema-blackfriday h2 .y,.promo-sec.tema-blackfriday h2 .y{color:#FFD400}
.promo-modal.tema-blackfriday .chamada,.promo-modal.tema-blackfriday .aceite{color:#D6D6D6}
.promo-modal.tema-blackfriday .validade,.promo-modal.tema-blackfriday .aceite a{color:#FFD400}
.promo-modal.tema-blackfriday .promo-box input[type=text],.promo-modal.tema-blackfriday .promo-box input[type=tel],.promo-modal.tema-blackfriday .promo-box input[type=email]{background:#1A1A1A;border-color:#3A3A3A;color:#fff}
.promo-modal.tema-blackfriday .promo-box input:focus{outline-color:#FFD400;border-color:#FFD400}
.promo-modal.tema-blackfriday .aceite input{accent-color:#FFD400}
.promo-modal.tema-blackfriday .enviar{background:#FFD400;color:#0A0A0A;text-transform:uppercase;letter-spacing:.04em;font-weight:800}
.promo-modal.tema-blackfriday .promo-x{top:2px;right:4px;background:transparent;color:#0A0A0A}
.promo-modal.tema-blackfriday .promo-x:hover{background:rgba(0,0,0,.08)}
.promo-modal.tema-blackfriday .ok{border-color:#FFD400;color:#FFD400}
.promo-sec.tema-blackfriday{background:#0A0A0A;color:#fff;padding-bottom:40px;margin-top:36px;border-top:4px solid #FFD400}
.promo-sec.tema-blackfriday .eyebrow{color:#FFD400}
.promo-sec.tema-blackfriday h2{font-family:var(--f-body);font-weight:900;text-transform:uppercase;color:#fff}
.promo-sec.tema-blackfriday .sub{color:#D6D6D6}
.promo-sec.tema-blackfriday .promo-galeria figure{border-color:#2A2A2A;background:#141414}
.promo-sec.tema-blackfriday .promo-cta{background:#FFD400;color:#0A0A0A;text-transform:uppercase;letter-spacing:.04em;font-weight:800;box-shadow:none}
.promo-sec.tema-blackfriday .promo-cta[disabled],.promo-sec.tema-bordo .promo-cta[disabled]{background:var(--ok);color:#fff}
header.top .menu a.promo-menu.tema-blackfriday{color:#FFD400}
.promo-box .fechar2{margin-top:14px;min-height:46px;width:100%;border:1px solid rgba(245,239,230,.45);border-radius:10px;background:transparent;color:inherit;font:700 1rem var(--f-body);cursor:pointer}`;
    document.head.appendChild(s);
  }

  function montarFaixa() {
    estilos();
    const f = document.createElement("button");
    f.type = "button"; f.className = "promo-faixa " + tema(); f.id = "promo-faixa";
    f.innerHTML = `<b>${esc(promo.titulo)}</b><span>${esc(promo.botao || "Receba ofertas")}</span><span class="seta" aria-hidden="true">→</span>`;
    f.onclick = abrir;
    document.body.insertBefore(f, document.body.firstChild);
  }

  function montarSecao(cadastrado) {
    const L = imgs(); if (!L.length) return;
    estilos();
    const sec = document.createElement("section");
    sec.className = "blk promo-sec " + tema(); sec.id = "promocao";
    sec.innerHTML = `<div class="wrap">
    <span class="eyebrow">Promoção</span>
    <h2>${titulo()}</h2>
    ${promo.chamada ? `<p class="sub">${esc(promo.chamada)}</p>` : ""}
    <div class="promo-galeria" tabindex="0" aria-label="Imagens da promoção ${esc(promo.titulo)}">${L.map((x, i) => `<figure>${imgTag(x, promo.titulo + " " + (i + 1), 'loading="lazy" decoding="async"')}</figure>`).join("")}</div>
    <button type="button" class="btn promo-cta"${cadastrado ? " disabled" : ""}>${cadastrado ? "✓ Você já está na lista" : esc(promo.botao || "Quero receber as ofertas")}</button>
  </div>`;
    sec.querySelector(".promo-cta").onclick = abrir;
    if (cadastrado) ctaCadastrado(sec.querySelector(".promo-cta"));
    const antes = document.getElementById("portfolio");
    if (antes) antes.parentNode.insertBefore(sec, antes); else (document.querySelector("main") || document.body).appendChild(sec);
    const menu = document.getElementById("menu");
    if (menu) { const a = document.createElement("a"); a.href = "#promocao"; a.className = "promo-menu " + tema(); a.textContent = promo.titulo; menu.insertBefore(a, menu.firstChild); }
  }

  function abrir() {
    estilos();
    ultimoFoco = document.activeElement;
    if (!caixa) {
      caixa = document.createElement("div");
      caixa.className = "promo-modal " + tema();
      caixa.innerHTML = `<div class="fundo" data-fechar></div>
<div class="promo-box" role="dialog" aria-modal="true" aria-labelledby="promo-tit">
  <button type="button" class="promo-x" data-fechar aria-label="Fechar">×</button>
  <div class="corpo"></div>
</div>`;
      caixa.addEventListener("click", e => { if (e.target.closest("[data-fechar]")) fechar(); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && caixa && !caixa.hidden) fechar(); });
      document.body.appendChild(caixa);
    }
    formulario();
    caixa.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => { const i = caixa.querySelector("#promo-nome") || caixa.querySelector(".promo-x"); i && i.focus(); }, 30);
  }

  function fechar() {
    if (!caixa) return;
    caixa.hidden = true; document.body.style.overflow = "";
    const k = "promo-" + promo.id;
    if (ler(k) !== "cadastrado") gravar(k, "fechado");
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function formulario() {
    const corpo = caixa.querySelector(".corpo");
    const capa = imgs()[0];
    corpo.innerHTML = `
  <span class="eyebrow">Promoção</span>
  ${capa ? `<div class="promo-capa">${imgTag(capa, promo.titulo)}</div>` : ""}
  <h2 id="promo-tit">${titulo()}</h2>
  ${promo.chamada ? `<p class="chamada">${esc(promo.chamada)}</p>` : ""}
  <p class="validade">Cadastro até ${fdata(promo.fim)}</p>
  <form novalidate>
    <label class="c">Nome<input type="text" id="promo-nome" autocomplete="name" maxlength="120" required></label>
    <label class="c">WhatsApp<input type="tel" id="promo-tel" inputmode="tel" autocomplete="tel-national" placeholder="(27) 99999-9999" maxlength="16" required></label>
    <label class="c">E-mail<input type="email" id="promo-email" autocomplete="email" maxlength="160" required></label>
    <div style="position:absolute;left:-9999px" aria-hidden="true"><input id="promo-site" tabindex="-1" autocomplete="off"></div>
    <label class="aceite"><input type="checkbox" id="promo-aceite" required><span>Aceito receber ofertas da ${esc(C.marca || "Chowder Macarons")} por WhatsApp e e-mail. Posso cancelar quando quiser. <a href="/privacidade" target="_blank">Privacidade</a></span></label>
    <p class="erro" id="promo-erro" role="alert"></p>
    <button class="enviar" type="submit">${esc(promo.botao || "Quero receber as ofertas")}</button>
  </form>`;
    const tel = corpo.querySelector("#promo-tel");
    tel.addEventListener("input", () => { tel.value = mascara(tel.value); });
    corpo.querySelector("form").addEventListener("submit", enviar);
  }

  async function enviar(ev) {
    ev.preventDefault();
    const $ = s => caixa.querySelector(s), erro = $("#promo-erro");
    const nome = $("#promo-nome").value.trim(), tel = $("#promo-tel").value.trim(), email = $("#promo-email").value.trim();
    const falha = (msg, campo) => { erro.textContent = msg; campo && campo.focus(); };
    if (!nome) return falha("Informe seu nome.", $("#promo-nome"));
    const dig = tel.replace(/\D/g, "");
    if (dig.length < 10 || dig.length > 11) return falha("Informe o WhatsApp com DDD.", $("#promo-tel"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return falha("Informe um e-mail válido.", $("#promo-email"));
    if (!$("#promo-aceite").checked) return falha("Marque a caixa para receber as ofertas.", $("#promo-aceite"));
    erro.textContent = "";
    if ($("#promo-site").value) return sucesso(nome); // robô
    const btn = $(".enviar"); btn.disabled = true; btn.textContent = "Enviando…";
    const utm = {}; ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(k => { if (qs.get(k)) utm[k] = qs.get(k).slice(0, 80); });
    if (slugLink) utm.link = "promo";
    const { error } = await sb.from("promocoes_leads").insert({ promocao_id: promo.id, nome: nome.slice(0, 120), telefone: tel, email: email.slice(0, 160), aceite: true, utm });
    if (error && error.code !== "23505") { // 23505 = já cadastrado com esse WhatsApp
      btn.disabled = false; btn.textContent = promo.botao || "Quero receber as ofertas";
      return falha("Não foi possível enviar agora. Tente de novo em instantes.");
    }
    window.ChowderRastreio && ChowderRastreio.cadastro && ChowderRastreio.cadastro(promo.titulo);
    sucesso(nome);
  }

  function sucesso(nome) {
    gravar("promo-" + promo.id, "cadastrado");
    const f = document.getElementById("promo-faixa"); if (f) f.remove();
    ctaCadastrado(document.querySelector(".promo-cta"));
    const g = grupo();
    caixa.querySelector(".corpo").innerHTML = `
  <span class="eyebrow">Promoção</span>
  <div class="ok" aria-hidden="true">✓</div>
  <h2 id="promo-tit" style="font-size:2rem">Você está na lista!</h2>
  <p class="chamada">Obrigado, ${esc(nome.split(" ")[0])}. Vamos te avisar das ofertas da ${esc(promo.titulo)} pelo WhatsApp e e-mail.</p>
  ${g ? `<p class="chamada grupo-txt">Quer saber de tudo antes? Entre no nosso grupo do WhatsApp da ${esc(promo.titulo)}.</p>
  <a class="promo-grupo" href="${esc(g)}" target="_blank" rel="noopener">${WA_ICONE} Entrar no grupo do WhatsApp</a>` : ""}
  <button type="button" class="fechar2" data-fechar>Continuar no site</button>`;
    const lg = caixa.querySelector(".promo-grupo"); if (lg) lg.addEventListener("click", entrouGrupo);
    (lg || caixa.querySelector(".fechar2")).focus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
