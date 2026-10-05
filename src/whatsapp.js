// Conexão com o WhatsApp do próprio usuário via WhatsApp Web.
// Na primeira vez é preciso escanear o QR Code; depois a sessão fica salva em .wwebjs_auth/.
//
// Desde 2026 o WhatsApp pode exigir uma confirmação de segurança (passkey) ao conectar um
// computador novo, e ela não funciona em navegador escondido. Por isso:
//  - usamos o Edge/Chrome instalado no computador, com a identificação real dele;
//  - quando precisa de QR Code, abrimos a janela do WhatsApp Web visível;
//  - depois de conectado, reabrimos em segundo plano (escondido).
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PASTA_SESSAO = path.join(__dirname, '..', '.wwebjs_auth');

const estado = { status: 'iniciando', qr: null, numero: null, erro: null, janelaVisivel: false };

function navegadorInstalado() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform !== 'win32') return undefined; // usa o Chrome baixado pelo puppeteer
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const candidatos = [
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  return candidatos.find((c) => c && fs.existsSync(c));
}

const opcoesNavegador = {
  headless: true,
  defaultViewport: null,
  executablePath: navegadorInstalado(),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1100,850', '--no-first-run', '--no-default-browser-check'],
};

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: PASTA_SESSAO }),
  puppeteer: opcoesNavegador,
  // false = usa a identificação real do navegador (a padrão da biblioteca finge ser um Chrome antigo de Mac,
  // e o WhatsApp recusa conectar aparelhos novos com ela).
  userAgent: false,
});

let reiniciando = false; // troca proposital entre janela visível e escondida
let manterVisivel = false; // se a sessão não "pegou" em segundo plano, fica visível

// Fecha o navegador de propósito (sem disparar a reconexão automática).
async function fecharNavegador() {
  reiniciando = true;
  await client.destroy().catch(() => {});
  client.pupBrowser = null;
  reiniciando = false;
}

async function reabrir(headless) {
  tentativa++; // invalida a tentativa atual
  await fecharNavegador();
  opcoesNavegador.headless = headless;
  estado.janelaVisivel = !headless;
  iniciar();
}

client.on('qr', async (qr) => {
  // Precisa conectar: abre a janela visível para a confirmação de segurança funcionar.
  if (opcoesNavegador.headless && !reiniciando) {
    estado.status = 'abrindo_janela';
    estado.qr = null;
    return reabrir(false);
  }
  estado.status = 'aguardando_qr';
  estado.qr = await QRCode.toDataURL(qr);
});
client.on('authenticated', () => {
  estado.status = 'autenticado';
  estado.qr = null;
});
client.on('ready', () => {
  estado.status = 'conectado';
  estado.qr = null;
  estado.erro = null;
  estado.numero = client.info?.wid?.user || null;
  console.log('WhatsApp conectado:', estado.numero);
  // Conectou com a janela visível: espera a sessão ser salva e volta para segundo plano.
  if (!opcoesNavegador.headless && !manterVisivel) {
    manterVisivel = true; // se voltar a pedir QR depois disso, não fica alternando
    setTimeout(() => {
      if (estado.status === 'conectado') reabrir(true);
    }, 15000);
  }
});
client.on('auth_failure', (msg) => {
  estado.status = 'erro';
  estado.erro = 'Falha na autenticação: ' + msg;
});
client.on('disconnected', (motivo) => {
  if (reiniciando) return;
  estado.status = 'desconectado';
  estado.numero = null;
  console.log('WhatsApp desconectado:', motivo);
  setTimeout(iniciar, 3000);
});

function registrarErro(err) {
  estado.status = 'erro';
  estado.erro = err.message;
  console.error('Erro no WhatsApp:', err.message);
}

// Se o sistema foi fechado de forma brusca, o navegador do WhatsApp pode ter ficado
// aberto segurando a sessão ("The browser is already running"). Fecha essas sobras antes de iniciar.
function fecharNavegadorAbandonado() {
  if (process.platform !== 'win32') return;
  const script =
    "Get-CimInstance Win32_Process -Filter 'Name=''chrome.exe'' OR Name=''msedge.exe''' | " +
    "Where-Object { $_.CommandLine -like '*wwebjs_auth*' } | " +
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'ignore', timeout: 20000 });
  } catch {
    // sem PowerShell ou sem permissão: segue em frente
  }
}

let primeiraVez = true;
let tentativa = 0; // cada início ganha um número; eventos de tentativas antigas são ignorados
async function iniciar() {
  const minha = ++tentativa;
  if (primeiraVez) {
    primeiraVez = false;
    fecharNavegadorAbandonado();
  }
  if (estado.status !== 'abrindo_janela') estado.status = 'iniciando';
  try {
    const iniciando = client.initialize();
    // Se o usuário fechar a janela do WhatsApp, abre de novo.
    vigiarNavegador(minha);
    await iniciando;
  } catch (err) {
    if (reiniciando || minha !== tentativa || encerrando) return;
    registrarErro(err);
    // Fecha o navegador desta tentativa antes de tentar de novo, senão a sessão fica travada.
    await fecharNavegador();
    fecharNavegadorAbandonado();
    setTimeout(() => minha === tentativa && iniciar(), 30000);
  }
}

// Espera o navegador abrir e, se ele for fechado sem querer, inicia de novo.
function vigiarNavegador(minha) {
  const timer = setInterval(() => {
    if (minha !== tentativa) return clearInterval(timer);
    if (!client.pupBrowser) return;
    clearInterval(timer);
    const navegador = client.pupBrowser;
    navegador.once('disconnected', () => {
      if (reiniciando || encerrando || minha !== tentativa || client.pupBrowser !== navegador) return;
      estado.status = 'desconectado';
      estado.numero = null;
      setTimeout(() => minha === tentativa && iniciar(), 3000);
    });
  }, 500);
}

// Ao fechar a janela preta (ou Ctrl+C), fecha também o navegador do WhatsApp.
let encerrando = false;
async function encerrar() {
  if (encerrando) return;
  encerrando = true;
  setTimeout(() => process.exit(0), 4000).unref();
  await client.destroy().catch(() => {});
  process.exit(0);
}
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'].forEach((sinal) => process.on(sinal, encerrar));

// Aceita telefones como "(11) 98765-4321" e adiciona o 55 do Brasil se faltar.
function normalizarTelefone(telefone) {
  let n = String(telefone || '').replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return n;
}

async function enviar(telefone, mensagem, arquivos) {
  if (estado.status !== 'conectado') {
    throw new Error('WhatsApp não está conectado. Abra a aba "WhatsApp" e escaneie o QR Code.');
  }
  const numero = normalizarTelefone(telefone);
  // getNumberId resolve o ID correto (inclusive a questão do 9º dígito) e confirma que o número tem WhatsApp.
  const contato = await client.getNumberId(numero);
  if (!contato) throw new Error(`O número ${telefone} não possui WhatsApp.`);
  const chatId = contato._serialized;

  if (mensagem) await client.sendMessage(chatId, mensagem, { sendSeen: false });
  for (const arq of arquivos) {
    const media = MessageMedia.fromFilePath(arq.caminho);
    media.filename = arq.nome;
    await client.sendMessage(chatId, media, { sendMediaAsDocument: true, sendSeen: false });
  }
}

async function desconectar() {
  manterVisivel = false;
  await client.logout();
}

module.exports = { estado, iniciar, enviar, desconectar, normalizarTelefone, client };
