// Gera o PDF do pedido de orçamento com a identidade Navy & Burgundy.
// Usado pela landing (ao finalizar) e pelo painel (para gerar de novo).
(function () {
  const C = window.CHOWDER;
  const NAVY = [19, 31, 55], BORD = [89, 21, 36], GOLD = [196, 162, 101],
        CREAM = [247, 242, 235], INK = [28, 32, 48], MUTE = [96, 100, 116], LINE = [226, 216, 202];

  let logoPromise = null;
  function loadLogo(base) {
    if (!logoPromise) {
      logoPromise = fetch((base || "") + "assets/img/logo-pdf.png")
        .then(r => r.ok ? r.blob() : null)
        .then(b => b && new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); }))
        .catch(() => null);
    }
    return logoPromise;
  }

  const brl = n => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fdata = s => { if (!s) return "A definir"; const [y, m, d] = s.split("-"); return d + "/" + m + "/" + y; };

  async function gerar(p, opts) {
    opts = opts || {};
    const logo = await loadLogo(opts.base);
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });
    const W = 210, M = 18;
    let y = 0;

    // Cabeçalho
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 46, "F");
    doc.setFillColor(...BORD); doc.rect(W / 2, 0, W / 2, 46, "F");
    doc.setFillColor(...GOLD); doc.rect(0, 46, W, 1.2, "F");
    if (logo) doc.addImage(logo, "PNG", M, 8, 47, 30.2);
    else { doc.setTextColor(255, 255, 255); doc.setFont("times", "bold"); doc.setFontSize(22); doc.text(C.marca || "Chowder Macarons", M, 26); }
    doc.setTextColor(255, 255, 255); doc.setFont("times", "normal"); doc.setFontSize(20);
    doc.text("Pedido de orçamento", W - M, 21, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...GOLD);
    doc.text("PROTOCOLO " + p.protocolo, W - M, 29, { align: "right", charSpace: 0.6 });
    doc.setTextColor(230, 226, 220);
    doc.text("Enviado em " + new Date(p.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }), W - M, 35, { align: "right" });
    y = 60;

    function secao(titulo) {
      if (y > 70) y += 4;
      if (y > 262) { doc.addPage(); y = 22; }
      doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...BORD);
      doc.text(titulo, M, y);
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(M, y + 2.2, M + 24, y + 2.2);
      y += 9;
    }
    function campo(rotulo, valor, x, w) {
      x = x || M; w = w || (W - 2 * M);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
      doc.text(rotulo.toUpperCase(), x, y, { charSpace: 0.3 });
      doc.setFontSize(11); doc.setTextColor(...INK);
      const linhas = doc.splitTextToSize(String(valor || "—"), w);
      doc.text(linhas, x, y + 5.5);
      return 5.5 + linhas.length * 5 + 3;
    }
    function par(a, b) {
      const half = (W - 2 * M - 8) / 2;
      const h1 = campo(a[0], a[1], M, half), h2 = campo(b[0], b[1], M + half + 8, half);
      y += Math.max(h1, h2);
    }

    secao("Seus dados");
    par(["Nome", p.nome], ["WhatsApp", p.telefone]);

    secao("Sobre o evento");
    par(["Ocasião", p.ocasiao], ["Data do evento", fdata(p.data)]);
    par(["Convidados ou quantidade", p.quantidade || "A definir"], ["Entrega", p.entrega || "A combinar"]);
    if (p.local) y += campo("Local / bairro", p.local);

    secao("O que você precisa");
    y += campo("Itens de interesse", (p.necessidades || []).join(", ") || "A definir");
    if (p.pacote) {
      doc.setFillColor(...CREAM); doc.setDrawColor(...LINE);
      doc.roundedRect(M, y - 4, W - 2 * M, 16, 2, 2, "FD");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
      doc.text("PACOTE DE REFERÊNCIA", M + 5, y + 1.5, { charSpace: 0.3 });
      doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
      doc.text(p.pacote.nome + " · " + p.pacote.detalhe, M + 5, y + 8);
      if (C.mostrarPrecos && p.pacote.valor) {
        doc.setTextColor(...BORD); doc.text("a partir de " + brl(p.pacote.valor), W - M - 5, y + 8, { align: "right" });
      }
      y += 20;
    }
    if (p.obs) { secao("Observações"); y += campo("Cores, tema, referências", p.obs); }

    // Próximos passos
    if (y > 238) { doc.addPage(); y = 22; }
    y += 2;
    doc.setFillColor(...NAVY); doc.roundedRect(M, y, W - 2 * M, 34, 2, 2, "F");
    doc.setTextColor(...GOLD); doc.setFont("times", "bold"); doc.setFontSize(13);
    doc.text("Próximos passos", M + 6, y + 9);
    doc.setTextColor(240, 236, 230); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    const passos = [
      "1. O Chef Daniel analisa o seu pedido e responde pelo WhatsApp" + (C.prazoResposta ? " " + C.prazoResposta : "") + ".",
      "2. Você recebe a proposta personalizada com sabores, cores e embalagens.",
      "3. Com o sinal confirmado, produzimos tudo artesanalmente e combinamos a entrega."
    ];
    doc.text(passos, M + 6, y + 16, { lineHeightFactor: 1.45 });
    y += 40;
    if (C.mostrarPrecos) {
      doc.setFontSize(8); doc.setTextColor(...MUTE);
      doc.text("Valores de referência não incluem entrega e montagem. O orçamento final é sempre personalizado.", M, y);
    }

    // Rodapé em todas as páginas
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFillColor(...BORD); doc.rect(0, 284, W, 13, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(245, 239, 232);
      doc.text(C.endereco + " · WhatsApp " + C.whatsappExibicao + " · " + C.instagramUser, W / 2, 291.5, { align: "center" });
    }
    return doc.output("blob");
  }

  window.ChowderPDF = { gerar, carregarLogo: loadLogo };
})();
