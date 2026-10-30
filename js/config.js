// =====================================================================
//  Chowder Macarons — configuração única da landing e do painel
//  Altere aqui: links, textos de prazo, preços e a conexão com o banco.
// =====================================================================
window.CHOWDER = {
  marca: "Chowder Macarons",

  // Contatos e links
  whatsapp:  "5527988590855",           // só números, com 55 + DDD
  whatsappExibicao: "(27) 98859-0855",
  instagram: "https://instagram.com/chowdermacarons",
  instagramUser: "@chowdermacarons",
  ifood:     "https://www.ifood.com.br/delivery/vitoria-es/confeitaria-chowder-macarons-enseada-do-sua/447e4137-8254-44de-9143-e015cbc459f1?utm_medium=share",
  maps:      "https://www.google.com/maps/search/?api=1&query=Av.+C%C3%A9zar+Hilal%2C+570%2C+loja+4%2C+Bento+Ferreira%2C+Vit%C3%B3ria+-+ES%2C+29050-657",
  video:     "",                       // vídeo de como chegar ("" esconde o botão)
  endereco:  "Av. Cézar Hilal, 570, loja 4",
  bairro:    "Bento Ferreira, Vitória-ES, 29050-657",
  cnpj:      "",                       // aparece na Política de Privacidade quando preenchido
  horarios:  [["Fábrica: segunda a sexta", "10h às 17h"], ["Atendimento no WhatsApp", "aberto 24h"]],
  atendimento: "WhatsApp aberto 24h. Respondemos o mais breve possível.",

  // Pontos que os sócios ainda vão decidir (deixe "" para esconder da página)
  prazoResposta: "o mais breve possível",
  antecedencia:  "",                     // ex.: "15 dias"
  mostrarPrecos: true,                   // false esconde valores da página e do PDF

  // Rastreio de anúncios: cole aqui os IDs que a equipe de marketing passar ("" desliga)
  pixelMeta: "1285037806942306",                         // ID do Pixel do Meta, só números (ex.: "123456789012345")
  googleTag: "",                         // ID do Google Analytics/Ads (ex.: "G-ABC123XYZ" ou "AW-123456789")

  // Banco de dados (Supabase). Enquanto estiver vazio, a landing funciona
  // só com PDF + WhatsApp e o painel mostra o aviso de configuração.
  supabaseUrl:     "https://tfqeczqknakuovzswrrv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcWVjenFrbmFrdW92enN3cnJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NDE3MTYsImV4cCI6MjEwNDIxNzcxNn0.w5hPIpfdjpiq6PewloiPfTF_C-xBfg2O_9Q2FDkUQd0",
  bucketPdf:       "pedidos-pdf",

  // Listas compartilhadas entre landing e painel
  ocasioes: ["Casamento", "Aniversário", "Corporativo", "Batizado", "Chá de bebê", "Maternidade", "Presente", "Outro"],
  necessidades: ["Torre de macarons", "Mesa de doces", "Macarons Bar", "Lembrancinhas", "Macarons avulsos", "Brownies", "Cookies"],
  // Destaque da página (seção própria, link no menu e opção marcada no formulário). Deixe macaronsBar: null para esconder.
  macaronsBar: {
    nome: "Macarons Bar",
    chamada: "Um carrinho de macarons no seu evento, onde os convidados montam os próprios macarons na hora.",
    itens: ["Atração que movimenta a festa e rende muitas fotos", "Os convidados escolhem e montam o próprio macaron", "Para casamentos, aniversários e eventos corporativos"],
    foto: "assets/img/portfolio/carrinho-torre-colorida.webp",
    botao: "Quero o Macarons Bar no meu evento"
  },
  // Cardápio de produtos avulsos (seção "Cardápio" da página).
  // Mostrar/esconder a seção e cada produto, e o link do cardápio online: no painel, aba "Cardápio".
  // Para incluir um produto: adicione aqui com um id único (sem espaços) e a foto em assets/img/cardapio/.
  cardapio: {
    link: "",
    grupos: [
      { id: "classicos", nome: "Clássicos",      desc: "Para presentear ou matar a vontade." },
      { id: "pronta",    nome: "Pronta-entrega", desc: "Feitos para levar hoje." },
      { id: "encomenda", nome: "Sob encomenda",  desc: "Peça com antecedência pelo WhatsApp." }
    ],
    produtos: [
      { id: "macarons",      nome: "Macarons",                grupo: "classicos", foto: "assets/img/cardapio/macarons.webp" },
      { id: "brownie",       nome: "Brownie",                 grupo: "classicos", foto: "assets/img/cardapio/brownie.webp" },
      { id: "cookie",        nome: "Cookie",                  grupo: "classicos", foto: "assets/img/cardapio/cookie.webp" },
      { id: "palha",         nome: "Palha italiana",          grupo: "pronta",    foto: "assets/img/cardapio/palha-italiana.webp", novo: true },
      { id: "bolo-gelado",   nome: "Bolo gelado",             grupo: "pronta",    foto: "assets/img/cardapio/bolo-gelado.webp", novo: true },
      { id: "bolo-cenoura",  nome: "Bolo de cenoura da vovó", grupo: "encomenda", foto: "assets/img/cardapio/bolo-cenoura.webp", novo: true },
      { id: "pudim",         nome: "Pudim Chowder",           grupo: "encomenda", foto: "assets/img/cardapio/pudim.webp", novo: true },
      { id: "cheesecake",    nome: "Cheesecake",              grupo: "encomenda", foto: "assets/img/cardapio/cheesecake.webp", novo: true },
      { id: "tiramisu",      nome: "Tiramisù",                grupo: "encomenda", foto: "assets/img/cardapio/tiramisu.webp", novo: true }
    ]
  },
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
  // Portfólio (carrossel). Para trocar fotos: coloque o arquivo em assets/img/portfolio/ e ajuste aqui.
  portfolio: [
    { src: "assets/img/portfolio/piramide-macarons.webp",       legenda: "Macarons na mesa de doces",       tipo: "Eventos" },
    { src: "assets/img/portfolio/carrinho-torre-colorida.webp", legenda: "Macarons Bar",                     tipo: "Eventos" },
    { src: "assets/img/portfolio/bandeja-brownies.webp",        legenda: "Bandeja de brownies",             tipo: "Eventos" },
    { src: "assets/img/portfolio/brownies-tag-helena.webp",     legenda: "Brownies com tag personalizada",  tipo: "Lembrancinhas" },
    { src: "assets/img/portfolio/caixinhas-brownie-laco.webp",  legenda: "Caixinhas de brownie com laço",   tipo: "Lembrancinhas" },
    { src: "assets/img/mesa-rosas.webp",            legenda: "Mesa de doces com rosas",      tipo: "Eventos" },
    { src: "assets/img/torre-flores.webp",          legenda: "Torre de macarons em casamento", tipo: "Eventos" },
    { src: "assets/img/torre-bolo.webp",            legenda: "Torre ao lado do bolo",         tipo: "Eventos" },
    { src: "assets/img/torre-cores.webp",           legenda: "Cores da sua paleta",          tipo: "Personalizados" },
    { src: "assets/img/caixinhas-tag.webp",         legenda: "Tag com logo ou mensagem",     tipo: "Personalizados" },
    { src: "assets/img/lembrancinhas-brownie.webp", legenda: "Lembrancinhas em volume",      tipo: "Lembrancinhas" },
    { src: "assets/img/caixa-5-macarons.webp",      legenda: "Caixinha com 5 macarons",      tipo: "Lembrancinhas" }
  ],
  sabores: ["Framboesa", "Blueberry", "Café", "Morango", "Manga com maracujá", "Limão siciliano", "Pistache", "Chocolate"]
};
