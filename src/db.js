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
  'Segue em anexo a nota fiscal e o boleto referente a {descricao}.\n' +
  'Valor: {valor}\nVencimento: {vencimento}\n\n' +
  'Qualquer dúvida estamos à disposição. Obrigado!';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let db = { clientes: [], documentos: [], config: { mensagem: MENSAGEM_PADRAO } };
if (fs.existsSync(DB_FILE)) {
  db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
}

function salvar() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const novoId = () => crypto.randomUUID();

module.exports = { db, salvar, novoId, UPLOAD_DIR, MENSAGEM_PADRAO };
