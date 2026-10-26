// Sincroniza uma pasta do computador com o sistema:
//  - cada subpasta vira um cliente (criado automaticamente com o nome da pasta);
//  - cada arquivo salvo dentro dela é copiado para a pasta do cliente no sistema
//    (e a cópia é atualizada se o arquivo mudar).
// Arquivos apagados no computador continuam no sistema (nada é apagado automaticamente).
const fs = require('fs');
const path = require('path');
const { db, salvar, novoId, UPLOAD_DIR } = require('./db');

const INTERVALO_MS = 10000;
const TAMANHO_MAXIMO = 100 * 1024 * 1024; // limite de documentos do WhatsApp
const IGNORAR = /^(~\$|\.|desktop\.ini$|thumbs\.db$)|\.(tmp|crdownload|part|partial|lnk)$/i;

const estado = { ultimaVez: null, erro: null, clientesCriados: 0, arquivosCopiados: 0, rodando: false };

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function pastaConfigurada() {
  return db.config.sync?.ativo && db.config.sync?.pasta ? db.config.sync.pasta : null;
}

// Lista os arquivos de uma pasta (inclusive subpastas), com o caminho relativo.
function listarArquivos(base, rel = '') {
  const lista = [];
  for (const item of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
    if (IGNORAR.test(item.name)) continue;
    const relItem = path.join(rel, item.name);
    if (item.isDirectory()) lista.push(...listarArquivos(base, relItem));
    else if (item.isFile()) lista.push(relItem);
  }
  return lista;
}

function clienteDaPasta(nomePasta) {
  let cliente = db.clientes.find((c) => c.pastaOrigem === nomePasta);
  if (cliente) return cliente;
  // Cliente já cadastrado com o mesmo nome da pasta: só liga os dois.
  cliente = db.clientes.find((c) => !c.pastaOrigem && normalizar(c.nome) === normalizar(nomePasta));
  if (cliente) {
    cliente.pastaOrigem = nomePasta;
    return cliente;
  }
  cliente = { id: novoId(), nome: nomePasta, telefone: '', documento: '', pastaOrigem: nomePasta, criadoEm: new Date().toISOString() };
  db.clientes.push(cliente);
  estado.clientesCriados++;
  console.log('Sincronização: cliente criado a partir da pasta', nomePasta);
  return cliente;
}

function sincronizarPasta(base, nomePasta) {
  const cliente = clienteDaPasta(nomePasta);
  const pastaCliente = path.join(base, nomePasta);
  const agora = Date.now();

  for (const rel of listarArquivos(pastaCliente)) {
    const origem = path.join(pastaCliente, rel);
    let info;
    try {
      info = fs.statSync(origem);
    } catch {
      continue;
    }
    // Arquivo ainda sendo salvo/copiado: espera a próxima rodada.
    if (agora - info.mtimeMs < 3000 || info.size === 0 || info.size > TAMANHO_MAXIMO) continue;

    const existente = db.arquivos.find((a) => a.clienteId === cliente.id && a.origem === rel);
    if (existente && existente.origemMtime === info.mtimeMs && existente.tamanho === info.size) continue;

    const destino = existente ? existente.arquivo : novoId() + path.extname(rel).toLowerCase();
    fs.copyFileSync(origem, path.join(UPLOAD_DIR, destino));

    if (existente) {
      Object.assign(existente, { tamanho: info.size, origemMtime: info.mtimeMs, enviadoEm: null });
    } else {
      db.arquivos.push({
        id: novoId(),
        clienteId: cliente.id,
        nome: path.basename(rel),
        arquivo: destino,
        tamanho: info.size,
        criadoEm: new Date().toISOString(),
        enviadoEm: null,
        origem: rel,
        origemMtime: info.mtimeMs,
      });
    }
    estado.arquivosCopiados++;
  }
}

function sincronizarAgora() {
  const base = pastaConfigurada();
  if (!base || estado.rodando) return;
  estado.rodando = true;
  try {
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    for (const item of fs.readdirSync(base, { withFileTypes: true })) {
      if (!item.isDirectory() || IGNORAR.test(item.name)) continue;
      try {
        sincronizarPasta(base, item.name);
      } catch (e) {
        console.error('Sincronização: erro na pasta', item.name, '-', e.message);
      }
    }
    salvar();
    estado.erro = null;
  } catch (e) {
    estado.erro = e.message;
    console.error('Sincronização:', e.message);
  }
  estado.ultimaVez = new Date().toISOString();
  estado.rodando = false;
}

// Cliente criado pelo sistema: cria a pasta dele no computador também.
function criarPastaDoCliente(cliente) {
  const base = pastaConfigurada();
  if (!base || cliente.pastaOrigem) return;
  const nome = cliente.nome.replace(/[<>:"/\\|?*]/g, '').replace(/[. ]+$/, '').trim();
  if (!nome) return;
  try {
    fs.mkdirSync(path.join(base, nome), { recursive: true });
    cliente.pastaOrigem = nome;
  } catch (e) {
    console.error('Sincronização: não foi possível criar a pasta de', cliente.nome, '-', e.message);
  }
}

function iniciar() {
  setInterval(sincronizarAgora, INTERVALO_MS);
  sincronizarAgora();
}

module.exports = { estado, iniciar, sincronizarAgora, criarPastaDoCliente, pastaConfigurada };
