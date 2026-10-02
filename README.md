# Notas e Boletos → WhatsApp

Sistema interno simples para cadastrar a **nota fiscal** e o **boleto** de cada cliente e enviar tudo pelo **WhatsApp da própria empresa** com um clique.

## Como funciona

1. Você conecta o WhatsApp da empresa uma única vez, lendo um QR Code (igual ao WhatsApp Web).
2. Cadastra seus clientes (nome + número de WhatsApp).
3. Em **Documentos**, escolhe o cliente, anexa a nota fiscal e/ou o boleto e clica em **Salvar e enviar no WhatsApp**.
4. O sistema manda automaticamente, do seu número, uma mensagem personalizada + os arquivos em PDF. O status fica registrado (Pendente / Enviado / Erro).

Também dá para salvar vários documentos e depois clicar em **Enviar todos os pendentes**.

## Instalação (uma vez só)

1. Instale o **Node.js** (versão LTS): https://nodejs.org
2. Baixe esta pasta para o computador que ficará ligado com o sistema.

## Como abrir

- **Windows:** dê dois cliques em `iniciar.bat`. Na primeira vez ele instala tudo sozinho (pode levar alguns minutos) e abre o navegador.
- **Outros sistemas:** no terminal, dentro da pasta, rode `npm install` (só na primeira vez) e depois `npm start`.

Acesse **http://localhost:3000**, vá na aba **WhatsApp** e escaneie o QR Code com o celular da empresa:
*WhatsApp → Configurações (ou ⋮) → Aparelhos conectados → Conectar um aparelho.*

Pronto! A conexão fica salva; nas próximas vezes não precisa ler o QR Code de novo.

> Outros computadores da mesma rede podem usar o sistema acessando `http://IP-DESTE-COMPUTADOR:3000`.

## Personalizar a mensagem

Na aba **Mensagem** você edita o texto enviado. Variáveis disponíveis:
`{cliente}`, `{descricao}`, `{valor}`, `{vencimento}`.

## Opções

| Variável     | Para quê                                                                 |
|--------------|--------------------------------------------------------------------------|
| `PORTA`      | Muda a porta (padrão `3000`).                                            |
| `SENHA`      | Exige senha para abrir o sistema (o navegador pede usuário/senha; o usuário pode ser qualquer um). |
| `CHROME_PATH`| Caminho de um Chrome/Chromium já instalado, se não quiser o que é baixado automaticamente. |

Exemplo no Windows: `set SENHA=minhasenha` antes de `node src/server.js` (ou adicione essa linha no `iniciar.bat`).

## Onde ficam os dados

- `data/db.json` – clientes, documentos e configurações.
- `data/arquivos/` – os PDFs enviados.
- `.wwebjs_auth/` – a sessão do WhatsApp conectado.

Faça backup da pasta `data/` periodicamente.

## Observações importantes

- O computador com o sistema precisa ficar **ligado e com internet**, e o celular com o WhatsApp precisa ter internet de vez em quando (como no WhatsApp Web).
- O envio usa o WhatsApp Web (biblioteca [whatsapp-web.js](https://wwebjs.dev)), que **não é a API oficial** da Meta. Para envios a clientes que já conhecem sua empresa funciona bem, mas evite disparos em massa para números que não têm seu contato salvo, pois o WhatsApp pode bloquear o número por spam. O botão "Enviar todos os pendentes" já espera 3 segundos entre cada envio.
- Telefones podem ser digitados com ou sem formatação; se não tiver o `55`, o sistema adiciona automaticamente.
