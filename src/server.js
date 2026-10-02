const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, salvar, novoId, UPLOAD_DIR, MENSAGEM_PADRAO } = require('./db');
require('./corrigir-whatsapp')();
const whatsapp = require('./whatsapp');

const PORTA = process.env.PORTA || 3000;
const app = express();
app.use(express.json());

// Senha opcional: defina a variável SENHA para exigir login (usuário: qualquer, senha: SENHA).
if (process.env.SENHA) {
  app.use((req, res, next) => {
    const [, b64] = (req.headers.authorization || '').split(' ');
    const senha = b64 ? Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':') : '';
    if (senha === process.env.SENHA) return next();
    res.set('WWW-Authenticate', 'Basic realm="Controle Gerencial"').status(401).send('Acesso negado');
  });
}

app.use(express.static(path.join(__dirname, '..', 'public')));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, novoId() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const agora = () => new Date().toISOString();
const naoEncontrado = (res) => res.status(404).json({ erro: 'Registro não encontrado' });
const nomeOriginal = (file) => Buffer.from(file.originalname, 'latin1').toString('utf8');

// ---------- WhatsApp ----------
app.get('/api/whatsapp', (req, res) => res.json(whatsapp.estado));
app.post('/api/whatsapp/sair', async (req, res) => {
  try {
    await whatsapp.desconectar();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ---------- Clientes ----------
app.get('/api/clientes', (req, res) => {
  res.json([...db.clientes].sort((a, b) => a.nome.localeCompare(b.nome)));
});

app.post('/api/clientes', (req, res) => {
  const { nome, telefone, documento } = req.body;
  if (!nome || !telefone) return res.status(400).json({ erro: 'Informe nome e telefone' });
  const cliente = { id: novoId(), nome: nome.trim(), telefone: telefone.trim(), documento: (documento || '').trim(), criadoEm: agora() };
  db.clientes.push(cliente);
  salvar();
  res.json(cliente);
});

app.put('/api/clientes/:id', (req, res) => {
  const cliente = db.clientes.find((c) => c.id === req.params.id);
  if (!cliente) return naoEncontrado(res);
  const { nome, telefone, documento } = req.body;
  if (!nome || !telefone) return res.status(400).json({ erro: 'Informe nome e telefone' });
  Object.assign(cliente, { nome: nome.trim(), telefone: telefone.trim(), documento: (documento || '').trim() });
  salvar();
  res.json(cliente);
});

app.delete('/api/clientes/:id', (req, res) => {
  if (db.documentos.some((d) => d.clienteId === req.params.id)) {
    return res.status(400).json({ erro: 'Este cliente possui documentos. Exclua-os antes.' });
  }
  db.clientes = db.clientes.filter((c) => c.id !== req.params.id);
  salvar();
  res.json({ ok: true });
});

// ---------- Documentos (nota fiscal + boleto) ----------
function comCliente(doc) {
  const cliente = db.clientes.find((c) => c.id === doc.clienteId);
  return { ...doc, clienteNome: cliente?.nome || '(cliente excluído)', clienteTelefone: cliente?.telefone || '' };
}

app.get('/api/documentos', (req, res) => {
  res.json(db.documentos.map(comCliente).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
});

app.post('/api/documentos', upload.fields([{ name: 'nota', maxCount: 1 }, { name: 'boleto', maxCount: 1 }]), (req, res) => {
  const { clienteId, descricao, valor, vencimento } = req.body;
  const nota = req.files?.nota?.[0];
  const boleto = req.files?.boleto?.[0];
  if (!db.clientes.some((c) => c.id === clienteId)) return res.status(400).json({ erro: 'Selecione um cliente' });
  if (!nota && !boleto) return res.status(400).json({ erro: 'Anexe a nota fiscal e/ou o boleto' });

  const doc = {
    id: novoId(),
    clienteId,
    descricao: (descricao || '').trim(),
    valor: (valor || '').trim(),
    vencimento: vencimento || '',
    nota: nota ? { arquivo: nota.filename, nome: nomeOriginal(nota) } : null,
    boleto: boleto ? { arquivo: boleto.filename, nome: nomeOriginal(boleto) } : null,
    status: 'pendente',
    enviadoEm: null,
    erro: null,
    criadoEm: agora(),
  };
  db.documentos.push(doc);
  salvar();
  res.json(comCliente(doc));
});

app.get('/api/documentos/:id/arquivo/:tipo', (req, res) => {
  const doc = db.documentos.find((d) => d.id === req.params.id);
  const arq = doc && ['nota', 'boleto'].includes(req.params.tipo) ? doc[req.params.tipo] : null;
  if (!arq) return naoEncontrado(res);
  res.download(path.join(UPLOAD_DIR, arq.arquivo), arq.nome);
});

app.delete('/api/documentos/:id', (req, res) => {
  const doc = db.documentos.find((d) => d.id === req.params.id);
  if (!doc) return naoEncontrado(res);
  for (const arq of [doc.nota, doc.boleto]) {
    if (arq) fs.rm(path.join(UPLOAD_DIR, arq.arquivo), { force: true }, () => {});
  }
  db.documentos = db.documentos.filter((d) => d.id !== doc.id);
  salvar();
  res.json({ ok: true });
});

function formatarData(iso) {
  if (!iso) return '-';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function montarMensagem(doc, cliente) {
  return (db.config.mensagem || MENSAGEM_PADRAO)
    .replaceAll('{cliente}', cliente.nome)
    .replaceAll('{descricao}', doc.descricao || 'seu pedido')
    .replaceAll('{valor}', doc.valor ? `R$ ${doc.valor}` : '-')
    .replaceAll('{vencimento}', formatarData(doc.vencimento));
}

async function enviarDocumento(doc) {
  const cliente = db.clientes.find((c) => c.id === doc.clienteId);
  try {
    if (!cliente) throw new Error('Cliente não encontrado');
    const arquivos = [doc.nota, doc.boleto]
      .filter(Boolean)
      .map((a) => ({ caminho: path.join(UPLOAD_DIR, a.arquivo), nome: a.nome }));
    await whatsapp.enviar(cliente.telefone, montarMensagem(doc, cliente), arquivos);
    Object.assign(doc, { status: 'enviado', enviadoEm: agora(), erro: null });
  } catch (e) {
    Object.assign(doc, { status: 'erro', erro: e.message });
  }
  salvar();
  return comCliente(doc);
}

app.post('/api/documentos/:id/enviar', async (req, res) => {
  const doc = db.documentos.find((d) => d.id === req.params.id);
  if (!doc) return naoEncontrado(res);
  const resultado = await enviarDocumento(doc);
  res.status(resultado.status === 'enviado' ? 200 : 400).json(resultado);
});

// Envia todos os pendentes (e os que deram erro), um por vez, com pausa para não parecer spam.
app.post('/api/documentos/enviar-pendentes', async (req, res) => {
  if (whatsapp.estado.status !== 'conectado') {
    return res.status(400).json({ erro: 'WhatsApp não está conectado. Abra a aba "WhatsApp" e escaneie o QR Code.' });
  }
  const fila = db.documentos.filter((d) => d.status !== 'enviado');
  let enviados = 0;
  for (const doc of fila) {
    if ((await enviarDocumento(doc)).status === 'enviado') enviados++;
    await new Promise((r) => setTimeout(r, 3000));
  }
  res.json({ total: fila.length, enviados, falhas: fila.length - enviados });
});

// ---------- Configurações ----------
app.get('/api/config', (req, res) => res.json({ ...db.config, mensagemPadrao: MENSAGEM_PADRAO }));
app.put('/api/config', (req, res) => {
  db.config.mensagem = String(req.body.mensagem || '').trim() || MENSAGEM_PADRAO;
  salvar();
  res.json(db.config);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: err.message });
});

app.listen(PORTA, () => {
  console.log(`\n  Sistema aberto em: http://localhost:${PORTA}\n`);
  whatsapp.iniciar();
});
