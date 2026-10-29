# Chef Chowder bake shop — Landing page + Painel de pedidos

Duas partes que conversam entre si:

| Parte | Endereço | Para quem |
|---|---|---|
| **Landing page** (`index.html`) | `/` — link do anúncio do Instagram | Clientes |
| **Painel administrativo** (`admin/index.html`) | `/admin` | Sócios |

## Como funciona o fluxo

1. O cliente abre a landing pelo anúncio e preenche o orçamento (nome, WhatsApp, ocasião, data, convidados, entrega, o que precisa, pacote e observações).
2. Ao tocar em **Finalizar**, a página:
   - gera um **PDF do pedido** com a identidade Navy & Burgundy e um protocolo (ex.: `CC-5369ED`);
   - salva o PDF e o pedido no banco (Supabase);
   - mostra o botão **Enviar pelo WhatsApp**, com a mensagem organizada **e o link do PDF**. No celular também aparece **Compartilhar PDF** para mandar o arquivo em si.
3. O pedido aparece **sozinho e ao vivo** no painel, em *Contatos*, marcado como **novo**, com todos os dados, a campanha de origem e o botão para abrir o PDF.
4. No painel: **Criar orçamento** (já vem com o pacote escolhido e o valor) → **Orçamento contratado** → pagamentos → **Evento entregue**. Tudo pode ser exportado em CSV.

> Sem o banco configurado, a landing continua funcionando: gera o PDF e abre o WhatsApp (o cliente anexa o PDF pelo botão Compartilhar/Baixar). O painel mostra um aviso até a configuração ser feita.

## Configuração (uma vez só, ~15 minutos)

### 1. Banco de dados (Supabase)
> **Já configurado** no projeto `chowder-academy` (tabelas `pedidos` e `pedidos_admins`, pasta `pedidos-pdf`), separado das tabelas do Academy. Para incluir outro sócio: `insert into public.pedidos_admins (email) values ('email@dominio.com');` no SQL Editor. O sócio entra no painel com o login dele no Supabase Auth do projeto.

Para montar em outro projeto do zero:
1. Crie um projeto em <https://supabase.com> (região *South America (São Paulo)*).
2. Abra **SQL Editor → New query**, cole todo o arquivo [`supabase/schema.sql`](supabase/schema.sql), **troque os e-mails de exemplo pelos e-mails dos sócios** e clique em **Run**.
3. Em **Authentication → Users → Add user**, crie o usuário de cada sócio (mesmo e-mail da lista, com senha). Só os e-mails da tabela `pedidos_admins` acessam os pedidos, mesmo que outras pessoas tenham conta no projeto.
4. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.

### Sócios (acesso ao painel)
No painel, botão **Sócios**: adicionar (só e-mail se a pessoa já tem conta no Academy; senão, e-mail + senha inicial), trocar senha e remover acesso. Isso roda na Edge Function [`supabase/functions/pedidos-socios`](supabase/functions/pedidos-socios/index.ts), que guarda a chave de administrador no servidor e só atende sócios autorizados. Remover o acesso não apaga a conta do Academy.

### 2. Arquivo de configuração
Já preenchido. Para trocar de projeto, abra [`js/config.js`](js/config.js) e ajuste:

```js
supabaseUrl:     "https://SEU-PROJETO.supabase.co",
supabaseAnonKey: "SUA-CHAVE-ANON-PUBLIC",
```

A chave *anon* pode ficar no código: as regras do banco só deixam visitantes **criar** pedidos. Ler, alterar e apagar exige login de um sócio autorizado.

No mesmo arquivo ficam os pontos que os sócios ainda vão decidir:
- `atendimento` e `prazoResposta` — hoje "WhatsApp aberto 24h. Respondemos o mais breve possível.";
- `antecedencia` — vazio esconde a frase (ex.: `"15 dias"`);
- `mostrarPrecos` — `false` esconde valores da página e do PDF;
- pacotes, preços, sabores, links (WhatsApp, iFood, Maps, vídeo, Instagram).

### Pixel de anúncios (Meta / Google)
Cole o ID em `js/config.js` (`pixelMeta` para o Pixel do Meta, `googleTag` para Google Analytics/Ads). Vazio = desligado.
Eventos enviados pela landing: **PageView** (visita), **Lead** (pedido de orçamento enviado, com valor do pacote quando houver) e **Contact** (clique em WhatsApp, iFood ou Instagram). O painel `/admin` não é rastreado.
LGPD: os pixels só carregam depois que o visitante toca em **Aceitar** no aviso de cookies (a escolha fica salva no navegador; "Preferências de cookies" no rodapé reabre o aviso). A política fica em [`privacidade.html`](privacidade.html) (`/privacidade`); o campo `cnpj` do config aparece nela quando preenchido.

### Promoções (ex.: Black Friday)
No painel, aba **Promoções**: criar a promoção (nome, frase, texto do botão, período e link) e acompanhar os inscritos (nome, WhatsApp, e-mail), marcar quem já foi contatado, apagar quem pedir para sair e exportar CSV.
Durante o período e com a promoção **ativa**, a landing mostra uma faixa no topo e abre a caixinha de cadastro sozinha (com X para fechar; quem fecha não vê de novo automaticamente). O link `https://chowder-macarons.vercel.app/promo/SLUG` sempre abre a caixinha daquela promoção. **Cores**: cada promoção escolhe o tema da caixinha, faixa e seção: Chowder (azul e dourado), Bordô ou Black Friday (preto e amarelo).
**Imagens e criativos**: na edição da promoção, até 12 imagens (reduzidas automaticamente no navegador antes de enviar). A primeira é a capa da caixinha; todas aparecem na seção da promoção na página, com link no menu. Ficam na pasta pública `promocoes-img`.
Tabelas `promocoes` e `promocoes_leads` (itens 8 e 9 do `schema.sql`); o cadastro manda o evento **CompleteRegistration** para o pixel.

### 3. Publicar (Vercel)
1. Em <https://vercel.com>, **Add New → Project → Import** este repositório.
2. Framework: **Other**. Sem comando de build. **Deploy**.
3. Endereço do site: **https://chowder-macarons.vercel.app** (o antigo chef-chowder-bakeshop.vercel.app redireciona para ele). Link do anúncio: `https://chowder-macarons.vercel.app/?utm_source=instagram&utm_campaign=NOME`. Os parâmetros `utm_*` aparecem no painel em cada pedido.
4. Domínio próprio: **Project → Settings → Domains**.

## Estrutura

```
index.html              Landing page (página única)
admin/index.html        Painel de pedidos (login dos sócios)
js/config.js            Configuração compartilhada (links, preços, banco)
js/pedido-pdf.js        Geração do PDF do pedido
supabase/schema.sql     Tabelas, permissões e pasta dos PDFs
assets/img/             Logo e fotos otimizadas
assets/vendor/          jsPDF 2.5.1 e supabase-js 2.45.4 (sem depender de CDN)
```

## Marca
Logo atual **Chowder Macarons** (letreiro "Chowder" com "MACARONS" entre linhas):
- `assets/img/logo-v-clara.*` / `logo-h-clara.*`: para fundo escuro (creme + dourado)
- `assets/img/logo-v-escura.*` / `logo-h-escura.*`: para fundo claro (navy + bordô)
- `assets/img/logo-pdf.png`: versão usada no PDF do pedido
- `assets/img/icone.png`: ícone do site (o "C" da logo)
- `assets/marca/*.svg`: versão anterior (macaron), guardada como referência
