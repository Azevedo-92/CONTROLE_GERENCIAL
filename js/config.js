// =====================================================================
//  Chef Chowder bake shop — configuração única da landing e do painel
//  Altere aqui: links, textos de prazo, preços e a conexão com o banco.
// =====================================================================
window.CHOWDER = {
  // Contatos e links
  whatsapp:  "5527988590855",           // só números, com 55 + DDD
  whatsappExibicao: "(27) 98859-0855",
  instagram: "https://instagram.com/chowdermacarons",
  instagramUser: "@chowdermacarons",
  ifood:     "https://www.ifood.com.br/delivery/vitoria-es/confeitaria-chowder-macarons-enseada-do-sua/447e4137-8254-44de-9143-e015cbc459f1?utm_medium=share",
  maps:      "https://goo.gl/maps/4Exfw2Ujws6unYYh7",
  video:     "https://www.instagram.com/reel/DXmqRrfDsN1/?igsh=MW9sOXkxeWYzbHl2eg==",
  endereco:  "Av. Américo Buaiz, 200, Shopping Vitória",
  bairro:    "Enseada do Suá, Vitória, ES, 29050-420",

  // Pontos que os sócios ainda vão decidir (deixe "" para esconder da página)
  prazoResposta: "até 24 horas úteis",
  antecedencia:  "",                     // ex.: "15 dias"
  mostrarPrecos: true,                   // false esconde valores da página e do PDF

  // Banco de dados (Supabase). Enquanto estiver vazio, a landing funciona
  // só com PDF + WhatsApp e o painel mostra o aviso de configuração.
  supabaseUrl:     "https://tfqeczqknakuovzswrrv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcWVjenFrbmFrdW92enN3cnJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NDE3MTYsImV4cCI6MjEwNDIxNzcxNn0.w5hPIpfdjpiq6PewloiPfTF_C-xBfg2O_9Q2FDkUQd0",
  bucketPdf:       "pedidos-pdf",

  // Listas compartilhadas entre landing e painel
  ocasioes: ["Casamento", "Aniversário", "Festa corporativa", "Batizado", "Chá de bebê", "Outro"],
  necessidades: ["Torre de macarons", "Mesa de doces", "Lembrancinhas", "Macarons avulsos", "Brownies", "Cookies"],
  pacotes: [
    { id: "torre4",  nome: "Torre de 4 andares",  detalhe: "cerca de 50 macarons",  qtd: 1, valor: 410 },
    { id: "torre6",  nome: "Torre de 6 andares",  detalhe: "cerca de 100 macarons", qtd: 1, valor: 750, destaque: "Mais pedido" },
    { id: "torre8",  nome: "Torre de 8 andares",  detalhe: "cerca de 160 macarons", qtd: 1, valor: 1200 },
    { id: "torre10", nome: "Torre de 10 andares", detalhe: "cerca de 240 macarons", qtd: 1, valor: 1770 }
  ],
  precosAvulsos: [
    { nome: "Macaron avulso", valor: "R$ 7,00" },
    { nome: "Macaron acima de 200 unidades", valor: "R$ 6,50 cada" },
    { nome: "Entrega até 10 km / até 20 km", valor: "R$ 80 / R$ 120" },
    { nome: "Montagem da torre", valor: "R$ 40,00" }
  ],
  sabores: ["Framboesa", "Blueberry", "Café", "Morango", "Manga com maracujá", "Limão siciliano", "Pistache", "Chocolate"]
};
