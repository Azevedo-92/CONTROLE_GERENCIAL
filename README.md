# Notas e Boletos → WhatsApp

Sistema interno simples para cadastrar a **nota fiscal** e o **boleto** de cada cliente e enviar tudo pelo **WhatsApp da própria empresa** com um clique.

## Como funciona

1. Você conecta o WhatsApp da empresa uma única vez, lendo um QR Code (igual ao WhatsApp Web).
2. Cada cliente tem a sua **pasta** dentro do sistema. Clique em **+ Novo cliente** (nome + WhatsApp).
3. Na pasta do cliente, clique em **Importar arquivos do computador** ou arraste os PDFs para lá. Pode escolher vários de uma vez. Os arquivos ficam guardados no sistema.
4. Quando for enviar, abra a pasta do cliente, **marque os arquivos** desejados e clique em **Enviar pelo WhatsApp**. A mensagem já vem pronta (dá para alterar na hora).
5. Tudo que foi enviado fica no **Histórico de envios**, com data, cliente, arquivos e se deu certo. Dá para reenviar de lá.

## Instalação (uma vez só)

1. Instale o **Node.js** (versão LTS): https://nodejs.org
2. Extraia o zip em qualquer lugar e dê dois cliques em **`instalar.bat`**.
   Ele copia o sistema para `C:\notas-boletos` (fora do OneDrive, que corrompe os arquivos do sistema), cria o atalho **"Notas e Boletos"** na Área de Trabalho e já abre o sistema. Na primeira vez demora alguns minutos.

## Como abrir

- **Windows:** dê dois cliques no atalho **"Notas e Boletos"** da Área de Trabalho.
- **Outros sistemas:** no terminal, dentro da pasta, rode `npm install` (só na primeira vez) e depois `npm start`.

Para atualizar o sistema no futuro, é só extrair o zip novo e rodar `instalar.bat` de novo: seus clientes e arquivos são mantidos.

Acesse **http://localhost:3000**, vá na aba **WhatsApp** e escaneie o QR Code com o celular da empresa:
*WhatsApp → Configurações (ou ⋮) → Aparelhos conectados → Conectar um aparelho.*

Ao conectar, o sistema abre uma janela do **WhatsApp Web** (no Edge do computador). Não feche essa janela; se o celular ou o computador pedir uma confirmação de segurança (chave de acesso / Windows Hello), confirme. Depois de conectado, a janela fecha sozinha e o sistema continua em segundo plano.

Pronto! A conexão fica salva; nas próximas vezes não precisa ler o QR Code de novo.

> Desde 2026 o WhatsApp exige essa confirmação de segurança para conectar computadores novos em algumas contas, e ela não funciona em navegador escondido. Por isso a janela fica visível só durante a conexão.

## Usar em outros computadores

**Recomendado:** deixe o sistema instalado em um computador principal. Os outros computadores da mesma rede abrem pelo navegador o endereço que aparece na janela preta, na linha **"Outros computadores da mesma rede"** (ex.: `http://192.168.0.10:3000`). Todos compartilham os mesmos clientes, arquivos, histórico e WhatsApp. O link também aparece em **Configurações → Acessar de outros computadores**, com botão **Copiar link**. Se os outros computadores não conseguirem abrir, dê dois cliques em **`liberar-rede.bat`** no computador principal (libera o sistema no firewall do Windows; ele pede permissão de administrador).

**Alternativa:** instalar em cada computador (Node.js + `instalar.bat`). Cada um fica com seus próprios dados e precisa conectar um WhatsApp (o WhatsApp aceita no máximo 4 aparelhos conectados por número).

## Se a página não abrir

1. Feche todas as janelas pretas do sistema e dê dois cliques em `fechar-sistema.bat` (fecha alguma cópia que tenha ficado aberta escondida).
2. Abra o `iniciar.bat` de novo e espere a mensagem **"Sistema aberto em: http://localhost:3000"**.
3. No navegador, aperte **Ctrl + F5** para recarregar a página.
4. Se aparecer `Cannot find module`, a instalação foi corrompida (geralmente pelo OneDrive). Mova a pasta para `C:\notas-boletos` e abra o `iniciar.bat`: ele repara sozinho.
5. Se ainda não abrir, tire um print da janela preta.

## Sincronizar com uma pasta do computador

Já vem **ativado**, usando a pasta `C:\Clientes`. O `instalar.bat` cria o atalho **"Pasta dos Clientes"** na Área de Trabalho. (Para trocar a pasta: **Configurações → Pasta do computador**.)

- Cada **subpasta** vira um **cliente** no sistema (com o nome da pasta). Se já existir um cliente com o mesmo nome, ele é usado.
- Todo arquivo salvo dentro da subpasta (inclusive em subpastas dela) é **copiado** para o cliente no sistema. Se o arquivo for alterado, a cópia é atualizada.
- Clientes criados pelo sistema ganham uma subpasta lá também.
- O sistema confere a pasta a cada 10 segundos (ou clique em **Sincronizar agora**).
- Clientes criados pela pasta vêm **sem WhatsApp**: aparecem com ⚠ e é preciso informar o número em **Editar cliente** antes de enviar.
- Arquivos apagados ou pastas renomeadas no computador **não apagam nada** no sistema.

## Personalizar a mensagem

Na aba **Mensagem** você edita o texto padrão que vai junto com os arquivos. Variáveis disponíveis:
`{cliente}` (nome do cliente) e `{arquivos}` (lista dos arquivos enviados).

## Opções

| Variável     | Para quê                                                                 |
|--------------|--------------------------------------------------------------------------|
| `PORTA`      | Muda a porta (padrão `3000`).                                            |
| `SENHA`      | Exige senha para abrir o sistema (o navegador pede usuário/senha; o usuário pode ser qualquer um). |
| `CHROME_PATH`| Caminho de um Chrome/Chromium já instalado, se não quiser o que é baixado automaticamente. |

Exemplo no Windows: `set SENHA=minhasenha` antes de `node src/server.js` (ou adicione essa linha no `iniciar.bat`).

## Onde ficam os dados

- `data/db.json` – clientes, lista de arquivos de cada pasta, histórico e configurações.
- `data/arquivos/` – os PDFs importados.
- `.wwebjs_auth/` – a sessão do WhatsApp conectado.

Faça backup da pasta `data/` periodicamente.

## Observações importantes

- O computador com o sistema precisa ficar **ligado e com internet**, e o celular com o WhatsApp precisa ter internet de vez em quando (como no WhatsApp Web).
- O envio usa o WhatsApp Web (biblioteca [whatsapp-web.js](https://wwebjs.dev)), que **não é a API oficial** da Meta. Para envios a clientes que já conhecem sua empresa funciona bem, mas evite disparos em massa para números que não têm seu contato salvo, pois o WhatsApp pode bloquear o número por spam.
- Telefones podem ser digitados com ou sem formatação; se não tiver o `55`, o sistema adiciona automaticamente.
