// Conexão com o WhatsApp do próprio usuário via WhatsApp Web.
// Na primeira vez é preciso escanear o QR Code; depois a sessão fica salva em .wwebjs_auth/.
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const { execFileSync } = require('child_process');

const PASTA_SESSAO = path.join(__dirname, '..', '.wwebjs_auth');

const estado = { status: 'iniciando', qr: null, numero: null, erro: null };

const puppeteer = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
if (process.env.CHROME_PATH) puppeteer.executablePath = process.env.CHROME_PATH;

const client = new Client({ authStrategy: new LocalAuth({ dataPath: PASTA_SESSAO }), puppeteer });

client.on('qr', async (qr) => {
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
  estado.numero = client.info?.wid?.user || null;
  console.log('WhatsApp conectado:', estado.numero);
});
client.on('auth_failure', (msg) => {
  estado.status = 'erro';
  estado.erro = 'Falha na autenticação: ' + msg;
});
client.on('disconnected', (motivo) => {
  estado.status = 'desconectado';
  estado.numero = null;
  console.log('WhatsApp desconectado:', motivo);
  setTimeout(iniciar, 3000);
});

function registrarErro(err) {
  estado.status = 'erro';
  estado.erro = err.message;
  console.error('Erro no WhatsApp:', err);
}

// Se o sistema foi fechado de forma brusca, o Chrome escondido do WhatsApp pode ter ficado
// aberto segurando a sessão ("The browser is already running"). Fecha essas sobras antes de iniciar.
function fecharChromeAbandonado() {
  if (process.platform !== 'win32') return;
  const script =
    "Get-CimInstance Win32_Process -Filter 'Name=''chrome.exe''' | " +
    "Where-Object { $_.CommandLine -like '*wwebjs_auth*' } | " +
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'ignore', timeout: 20000 });
  } catch {
    // sem PowerShell ou sem permissão: segue em frente
  }
}

let primeiraVez = true;
async function iniciar() {
  if (primeiraVez) {
    primeiraVez = false;
    fecharChromeAbandonado();
  }
  estado.status = 'iniciando';
  try {
    await client.initialize();
  } catch (err) {
    registrarErro(err);
    // Fecha o Chrome desta tentativa antes de tentar de novo, senão a sessão fica travada.
    await client.destroy().catch(() => {});
    fecharChromeAbandonado();
    setTimeout(iniciar, 30000);
  }
}

// Ao fechar a janela preta (ou Ctrl+C), fecha também o Chrome do WhatsApp.
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

  if (mensagem) await client.sendMessage(chatId, mensagem);
  for (const arq of arquivos) {
    const media = MessageMedia.fromFilePath(arq.caminho);
    media.filename = arq.nome;
    await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
  }
}

async function desconectar() {
  await client.logout();
}

module.exports = { estado, iniciar, enviar, desconectar, normalizarTelefone };
