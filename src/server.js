const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, salvar, novoId, UPLOAD_DIR, MENSAGEM_PADRAO } = require('./db');
require('./corrigir-whatsapp')();
const whatsapp = require('./whatsapp');
const sync = require('./sincronizar');

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

// Sem cache: depois de atualizar o sistema, o navegador sempre carrega a tela nova.
app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.set('Cache-Control', 'no-store'),
}));

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
const buscarCliente = (id) => db.clientes.find((c) => c.id === id);

function apagarArquivo(arq) {
  fs.rm(path.join(UPLOAD_DIR, arq.arquivo), { force: true }, () => {});
}

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

// ---------- Clientes (pastas) ----------
app.get('/api/clientes', (req, res) => {
  const lista = db.clientes.map((c) => ({ ...c, qtdArquivos: db.arquivos.filter((a) => a.clienteId === c.id).length }));
  res.json(lista.sort((a, b) => a.nome.localeCompare(b.nome)));
});

function dadosCliente(body) {
  const { nome, telefone, documento } = body;
  if (!nome?.trim() || !telefone?.trim()) return null;
  return { nome: nome.trim(), telefone: telefone.trim(), documento: (documento || '').trim() };
}

app.post('/api/clientes', (req, res) => {
  const dados = dadosCliente(req.body);
  if (!dados) return res.status(400).json({ erro: 'Informe nome e telefone' });
  const cliente = { id: novoId(), ...dados, criadoEm: agora() };
  sync.criarPastaDoCliente(cliente);
  db.clientes.push(cliente);
  salvar();
  res.json(cliente);
});

app.put('/api/clientes/:id', (req, res) => {
  const cliente = buscarCliente(req.params.id);
  if (!cliente) return naoEncontrado(res);
  const dados = dadosCliente(req.body);
  if (!dados) return res.status(400).json({ erro: 'Informe nome e telefone' });
  Object.assign(cliente, dados);
  salvar();
  res.json(cliente);
});

// Exclui o cliente junto com todos os arquivos da pasta dele (o histórico de envios é mantido).
app.delete('/api/clientes/:id', (req, res) => {
  if (!buscarCliente(req.params.id)) return naoEncontrado(res);
  db.arquivos.filter((a) => a.clienteId === req.params.id).forEach(apagarArquivo);
  db.arquivos = db.arquivos.filter((a) => a.clienteId !== req.params.id);
  db.clientes = db.clientes.filter((c) => c.id !== req.params.id);
  salvar();
  res.json({ ok: true });
});

// ---------- Arquivos da pasta do cliente ----------
app.get('/api/clientes/:id/arquivos', (req, res) => {
  const lista = db.arquivos.filter((a) => a.clienteId === req.params.id);
  res.json(lista.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
});

app.post('/api/clientes/:id/arquivos', upload.array('arquivos', 50), (req, res) => {
  const files = req.files || [];
  if (!buscarCliente(req.params.id)) {
    files.forEach((f) => fs.rm(f.path, { force: true }, () => {}));
    return naoEncontrado(res);
  }
  if (!files.length) return res.status(400).json({ erro: 'Selecione ao menos um arquivo' });
  const novos = files.map((f) => ({
    id: novoId(),
    clienteId: req.params.id,
    nome: nomeOriginal(f),
    arquivo: f.filename,
    tamanho: f.size,
    criadoEm: agora(),
    enviadoEm: null,
  }));
  db.arquivos.push(...novos);
  salvar();
  res.json(novos);
});

// Abre o arquivo no navegador (PDF/imagem); com ?baixar=1 faz o download.
app.get('/api/arquivos/:id', (req, res) => {
  const arq = db.arquivos.find((a) => a.id === req.params.id);
  if (!arq) return naoEncontrado(res);
  const caminho = path.join(UPLOAD_DIR, arq.arquivo);
  if (req.query.baixar) return res.download(caminho, arq.nome);
  res.attachment(arq.nome);
  res.set('Content-Disposition', res.get('Content-Disposition').replace('attachment', 'inline'));
  res.sendFile(caminho);
});

app.put('/api/arquivos/:id', (req, res) => {
  const arq = db.arquivos.find((a) => a.id === req.params.id);
  if (!arq) return naoEncontrado(res);
  const nome = String(req.body.nome || '').trim();
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do arquivo' });
  arq.nome = nome;
  salvar();
  res.json(arq);
});

app.delete('/api/arquivos/:id', (req, res) => {
  const arq = db.arquivos.find((a) => a.id === req.params.id);
  if (!arq) return naoEncontrado(res);
  apagarArquivo(arq);
  db.arquivos = db.arquivos.filter((a) => a.id !== arq.id);
  salvar();
  res.json({ ok: true });
});

// ---------- Envios ----------
function montarMensagem(cliente, arquivos) {
  return (db.config.mensagem ?? MENSAGEM_PADRAO)
    .replaceAll('{cliente}', cliente.nome)
    .replaceAll('{arquivos}', arquivos.map((a) => '• ' + a.nome).join('\n'));
}

async function realizarEnvio(clienteId, arquivoIds, mensagem) {
  const cliente = buscarCliente(clienteId);
  if (!cliente) throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });
  if (!cliente.telefone) {
    throw Object.assign(new Error('Cadastre o WhatsApp deste cliente (botão "Editar cliente")'), { status: 400 });
  }
  const arquivos = arquivoIds.map((id) => db.arquivos.find((a) => a.id === id && a.clienteId === clienteId)).filter(Boolean);
  if (!arquivos.length) throw Object.assign(new Error('Selecione ao menos um arquivo'), { status: 400 });
  if (mensagem === undefined) mensagem = montarMensagem(cliente, arquivos);

  const envio = {
    id: novoId(),
    clienteId,
    arquivos: arquivos.map((a) => ({ id: a.id, nome: a.nome })),
    mensagem,
    status: 'enviado',
    erro: null,
    criadoEm: agora(),
  };
  try {
    await whatsapp.enviar(
      cliente.telefone,
      mensagem.trim(),
      arquivos.map((a) => ({ caminho: path.join(UPLOAD_DIR, a.arquivo), nome: a.nome }))
    );
    arquivos.forEach((a) => (a.enviadoEm = envio.criadoEm));
  } catch (e) {
    Object.assign(envio, { status: 'erro', erro: e.message });
  }
  db.envios.push(envio);
  salvar();
  return envio;
}

app.post('/api/envios', async (req, res) => {
  try {
    const { clienteId, arquivoIds, mensagem } = req.body;
    const envio = await realizarEnvio(clienteId, arquivoIds || [], mensagem);
    res.status(envio.status === 'enviado' ? 200 : 400).json(envio);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message });
  }
});

app.post('/api/envios/:id/reenviar', async (req, res) => {
  const antigo = db.envios.find((e) => e.id === req.params.id);
  if (!antigo) return naoEncontrado(res);
  try {
    const envio = await realizarEnvio(antigo.clienteId, antigo.arquivos.map((a) => a.id), antigo.mensagem);
    res.status(envio.status === 'enviado' ? 200 : 400).json(envio);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.status === 400 ? 'Os arquivos deste envio foram excluídos da pasta' : e.message });
  }
});

app.get('/api/envios', (req, res) => {
  const lista = db.envios.map((e) => {
    const cliente = buscarCliente(e.clienteId);
    return { ...e, clienteNome: cliente?.nome || '(cliente excluído)', clienteTelefone: cliente?.telefone || '' };
  });
  res.json(lista.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
});

// ---------- Configurações ----------
app.get('/api/config', (req, res) => res.json({ ...db.config, mensagemPadrao: MENSAGEM_PADRAO }));
app.put('/api/config', (req, res) => {
  db.config.mensagem = String(req.body.mensagem ?? '').trim();
  salvar();
  res.json(db.config);
});

// ---------- Sincronização com pasta do computador ----------
const PASTA_SUGERIDA = sync.PASTA_PADRAO;

app.get('/api/sync', (req, res) => {
  res.json({ ativo: false, pasta: '', ...db.config.sync, pastaSugerida: PASTA_SUGERIDA, estado: sync.estado });
});

app.put('/api/sync', (req, res) => {
  const ativo = !!req.body.ativo;
  const pasta = String(req.body.pasta || '').trim().replace(/^"|"$/g, '');
  if (ativo && !path.isAbsolute(pasta)) {
    return res.status(400).json({ erro: 'Informe o caminho completo da pasta, por exemplo C:\\Clientes' });
  }
  if (ativo) {
    try {
      fs.mkdirSync(pasta, { recursive: true });
    } catch (e) {
      return res.status(400).json({ erro: 'Não foi possível usar essa pasta: ' + e.message });
    }
  }
  db.config.sync = { ativo, pasta };
  salvar();
  sync.sincronizarAgora();
  res.json({ ...db.config.sync, estado: sync.estado });
});

app.post('/api/sync/agora', (req, res) => {
  sync.sincronizarAgora();
  res.json(sync.estado);
});

// Abre no Windows Explorer a pasta principal ou a pasta de um cliente.
app.post('/api/sync/abrir', (req, res) => {
  const base = sync.pastaConfigurada();
  if (!base) return res.status(400).json({ erro: 'A sincronização com pasta não está ativada' });
  const cliente = req.body.clienteId && buscarCliente(req.body.clienteId);
  if (cliente && !cliente.pastaOrigem) sync.criarPastaDoCliente(cliente), salvar();
  const alvo = cliente?.pastaOrigem ? path.join(base, cliente.pastaOrigem) : base;
  fs.mkdirSync(alvo, { recursive: true });
  const { execFile } = require('child_process');
  const programa = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  execFile(programa, [alvo], () => {});
  res.json({ ok: true, pasta: alvo });
});

app.use((err, req, res, next) => {
  console.error(err);
  const erro = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 15 MB' : err.message;
  res.status(err.code?.startsWith('LIMIT_') ? 400 : 500).json({ erro });
});

function abrirNavegador(url) {
  if (process.env.NAO_ABRIR_NAVEGADOR) return;
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const servidor = app.listen(PORTA, (err) => {
  if (err) return; // tratado em servidor.on('error')
  const url = `http://localhost:${PORTA}`;
  console.log(`\n  Sistema aberto em: ${url}`);
  const ips = Object.values(require('os').networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${PORTA}`);
  if (ips.length) console.log(`  Outros computadores da mesma rede: ${ips.join('  ou  ')}`);
  console.log('  Deixe esta janela aberta (pode minimizar). Fechar esta janela desliga o sistema.\n');
  abrirNavegador(url);
  sync.iniciar();
  whatsapp.iniciar();
});

servidor.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ATENÇÃO: o sistema já está aberto em outra janela (porta ${PORTA} em uso).`);
    console.error('  Feche TODAS as janelas pretas do sistema (ou reinicie o computador) e abra o iniciar.bat de novo.\n');
  } else {
    console.error('\n  Erro ao iniciar o sistema:', err.message, '\n');
  }
  process.exit(1);
});
