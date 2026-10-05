// Banco de dados simples em arquivo JSON (data/db.json).
// Suficiente para uso interno de uma empresa pequena/média, sem instalar nada extra.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'arquivos');

const MENSAGEM_PADRAO =
  'Olá {cliente}! Tudo bem?\n\n' +
  'Segue em anexo:\n{arquivos}\n\n' +
  'Qualquer dúvida estamos à disposição. Obrigado!';

const MENSAGEM_ANTIGA =
  'Olá {cliente}! Tudo bem?\n\n' +
  'Segue em anexo a nota fiscal e o boleto referente a {descricao}.\n' +
  'Valor: {valor}\nVencimento: {vencimento}\n\n' +
  'Qualquer dúvida estamos à disposição. Obrigado!';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let db = { clientes: [], arquivos: [], envios: [], config: { mensagem: MENSAGEM_PADRAO } };
if (fs.existsSync(DB_FILE)) {
  db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
}

function salvar() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const novoId = () => crypto.randomUUID();

// Versão anterior guardava "documentos" (nota + boleto por envio).
// Converte cada arquivo para a pasta do cliente e os enviados para o histórico.
function migrarVersaoAnterior() {
  if (!db.documentos) return;
  for (const doc of db.documentos) {
    const arquivos = [];
    for (const arq of [doc.nota, doc.boleto].filter(Boolean)) {
      const caminho = path.join(UPLOAD_DIR, arq.arquivo);
      const novo = {
        id: novoId(),
        clienteId: doc.clienteId,
        nome: arq.nome,
        arquivo: arq.arquivo,
        tamanho: fs.existsSync(caminho) ? fs.statSync(caminho).size : 0,
        criadoEm: doc.criadoEm,
        enviadoEm: doc.status === 'enviado' ? doc.enviadoEm : null,
      };
      db.arquivos.push(novo);
      arquivos.push({ id: novo.id, nome: novo.nome });
    }
    if (doc.status === 'enviado' || doc.status === 'erro') {
      db.envios.push({
        id: novoId(),
        clienteId: doc.clienteId,
        arquivos,
        mensagem: '',
        status: doc.status,
        erro: doc.erro,
        criadoEm: doc.enviadoEm || doc.criadoEm,
      });
    }
  }
  delete db.documentos;
  if (db.config.mensagem === MENSAGEM_ANTIGA) db.config.mensagem = MENSAGEM_PADRAO;
  salvar();
  console.log('Dados da versão anterior convertidos para pastas de clientes.');
}
migrarVersaoAnterior();

module.exports = { db, salvar, novoId, UPLOAD_DIR, MENSAGEM_PADRAO };
