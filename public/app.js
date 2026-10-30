const $ = (s) => document.querySelector(s);
let clientes = [];
let clienteAtual = null;
let arquivos = [];
let envios = [];
let mensagemModelo = '';
let mensagemEditada = false;
const marcados = new Set();

async function api(url, opcoes = {}) {
  if (opcoes.json) {
    opcoes.body = JSON.stringify(opcoes.json);
    opcoes.headers = { 'Content-Type': 'application/json' };
  }
  const resp = await fetch(url, opcoes);
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Erro na requisição');
  return dados;
}

let timerAviso;
function aviso(texto, erro = false) {
  const el = $('#aviso');
  el.textContent = texto;
  el.className = erro ? 'erro' : '';
  el.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => (el.hidden = true), erro ? 8000 : 3500);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const tamanho = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Abas ----------
document.querySelectorAll('nav button').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('ativa', b === btn));
    document.querySelectorAll('main > section').forEach((s) => (s.hidden = s.id !== 'aba-' + btn.dataset.aba));
    if (btn.dataset.aba === 'historico') carregarEnvios();
  })
);

// ---------- Clientes ----------
async function carregarClientes() {
  clientes = await api('/api/clientes');
  renderClientes();
}

function renderClientes() {
  const busca = semAcento($('#busca-cliente').value);
  const lista = clientes.filter((c) => !busca || semAcento(c.nome + ' ' + c.telefone + ' ' + c.documento).includes(busca));
  $('#lista-clientes').innerHTML = lista.length
    ? lista.map((c) => `
      <li class="${c.id === clienteAtual?.id ? 'ativa' : ''}" onclick="abrirPasta('${c.id}')">
        <span>📁</span><span class="nome">${esc(c.nome)}</span>${c.telefone ? '' : '<span class="alerta" title="WhatsApp não cadastrado">⚠</span>'}<span class="qtd">${c.qtdArquivos}</span>
      </li>`).join('')
    : `<li class="vazio">${clientes.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}</li>`;
}
$('#busca-cliente').oninput = renderClientes;

function abrirDialogoCliente(c) {
  const f = $('#form-cliente');
  f.reset();
  f.id.value = c?.id || '';
  f.nome.value = c?.nome || '';
  f.telefone.value = c?.telefone || '';
  f.documento.value = c?.documento || '';
  $('#titulo-cliente').textContent = c ? 'Editar cliente' : 'Novo cliente';
  $('#dlg-cliente').showModal();
  f.nome.focus();
}
$('#btn-novo-cliente').onclick = () => abrirDialogoCliente(null);
$('#btn-editar-cliente').onclick = () => abrirDialogoCliente(clienteAtual);
$('#cancelar-cliente').onclick = () => $('#dlg-cliente').close();

$('#form-cliente').onsubmit = async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const dados = { nome: f.nome.value, telefone: f.telefone.value, documento: f.documento.value };
  try {
    const c = f.id.value
      ? await api('/api/clientes/' + f.id.value, { method: 'PUT', json: dados })
      : await api('/api/clientes', { method: 'POST', json: dados });
    $('#dlg-cliente').close();
    aviso('Cliente salvo');
    await carregarClientes();
    abrirPasta(c.id);
  } catch (e) { aviso(e.message, true); }
};

$('#btn-excluir-cliente').onclick = async () => {
  const qtd = arquivos.length;
  const texto = `Excluir o cliente "${clienteAtual.nome}"` + (qtd ? ` e os ${qtd} arquivo(s) da pasta dele?` : '?');
  if (!confirm(texto)) return;
  try {
    await api('/api/clientes/' + clienteAtual.id, { method: 'DELETE' });
    aviso('Cliente excluído');
    clienteAtual = null;
    $('#pasta').hidden = true;
    $('#pasta-vazia').hidden = false;
    carregarClientes();
  } catch (e) { aviso(e.message, true); }
};

// ---------- Pasta do cliente ----------
window.abrirPasta = async (id) => {
  clienteAtual = clientes.find((c) => c.id === id);
  if (!clienteAtual) return;
  marcados.clear();
  mensagemEditada = false;
  $('#busca-arquivo').value = '';
  $('#pasta-vazia').hidden = true;
  $('#pasta').hidden = false;
  mostrarCabecalhoPasta();
  renderClientes();
  await carregarArquivos();
};

function mostrarCabecalhoPasta() {
  $('#pasta-nome').textContent = clienteAtual.nome;
  $('#pasta-info').textContent = clienteAtual.telefone
    ? 'WhatsApp: ' + clienteAtual.telefone + (clienteAtual.documento ? ' · ' + clienteAtual.documento : '')
    : '';
  $('#pasta-sem-telefone').hidden = !!clienteAtual.telefone;
  $('#btn-abrir-pasta-cliente').hidden = !syncAtivo;
}

async function carregarArquivos() {
  arquivos = await api(`/api/clientes/${clienteAtual.id}/arquivos`);
  for (const id of [...marcados]) if (!arquivos.some((a) => a.id === id)) marcados.delete(id);
  const c = clientes.find((x) => x.id === clienteAtual.id);
  if (c && c.qtdArquivos !== arquivos.length) { c.qtdArquivos = arquivos.length; renderClientes(); }
  renderArquivos();
}

function arquivosVisiveis() {
  const busca = semAcento($('#busca-arquivo').value);
  return arquivos.filter((a) => !busca || semAcento(a.nome).includes(busca));
}

function renderArquivos() {
  const lista = arquivosVisiveis();
  $('#lista-arquivos').innerHTML = lista.length
    ? lista.map((a) => `
      <li class="${marcados.has(a.id) ? 'marcado' : ''}">
        <input type="checkbox" ${marcados.has(a.id) ? 'checked' : ''} onchange="marcar('${a.id}', this.checked)">
        <div class="info" onclick="marcar('${a.id}', ${!marcados.has(a.id)})">
          <span class="nome">📄 ${esc(a.nome)}</span>
          <small class="sub">Importado em ${dataHora(a.criadoEm)} · ${tamanho(a.tamanho)}
            ${a.enviadoEm ? `· <span class="tag-enviado">✔ enviado em ${dataHora(a.enviadoEm)}</span>` : ''}</small>
        </div>
        <div class="botoes">
          <a href="/api/arquivos/${a.id}" target="_blank">Abrir</a>
          <button class="texto" onclick="renomearArquivo('${a.id}')">Renomear</button>
          <button class="link" onclick="excluirArquivo('${a.id}')">Excluir</button>
        </div>
      </li>`).join('')
    : `<li class="vazio">${arquivos.length ? 'Nenhum arquivo encontrado' : 'Pasta vazia. Importe os arquivos acima.'}</li>`;

  $('#marcar-todos').checked = lista.length > 0 && lista.every((a) => marcados.has(a.id));
  atualizarPainelEnvio();
}
$('#busca-arquivo').oninput = renderArquivos;

window.marcar = (id, valor) => {
  valor ? marcados.add(id) : marcados.delete(id);
  renderArquivos();
};

$('#marcar-todos').onchange = (ev) => {
  arquivosVisiveis().forEach((a) => (ev.target.checked ? marcados.add(a.id) : marcados.delete(a.id)));
  renderArquivos();
};

function atualizarPainelEnvio() {
  const sel = arquivos.filter((a) => marcados.has(a.id));
  $('#painel-envio').hidden = sel.length === 0;
  $('#btn-enviar').textContent = `Enviar ${sel.length} arquivo(s) pelo WhatsApp`;
  if (!mensagemEditada) {
    $('#mensagem-envio').value = mensagemModelo
      .replaceAll('{cliente}', clienteAtual.nome)
      .replaceAll('{arquivos}', sel.map((a) => '• ' + a.nome).join('\n'));
  }
}
$('#mensagem-envio').oninput = () => (mensagemEditada = true);

$('#btn-enviar').onclick = async (ev) => {
  const btn = ev.target;
  const ids = arquivos.filter((a) => marcados.has(a.id)).map((a) => a.id);
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    await api('/api/envios', { method: 'POST', json: { clienteId: clienteAtual.id, arquivoIds: ids, mensagem: $('#mensagem-envio').value } });
    aviso(`Enviado para ${clienteAtual.nome} pelo WhatsApp ✔`);
    marcados.clear();
    mensagemEditada = false;
  } catch (e) {
    aviso('Não foi possível enviar: ' + e.message, true);
  }
  btn.disabled = false;
  carregarArquivos();
};

// Importação de arquivos (clique ou arrastar e soltar)
async function importar(files) {
  if (!files.length || !clienteAtual) return;
  const fd = new FormData();
  [...files].forEach((f) => fd.append('arquivos', f));
  const area = $('#area-soltar');
  area.classList.add('enviando');
  try {
    const novos = await api(`/api/clientes/${clienteAtual.id}/arquivos`, { method: 'POST', body: fd });
    aviso(`${novos.length} arquivo(s) guardado(s) na pasta de ${clienteAtual.nome}`);
    await carregarArquivos();
  } catch (e) { aviso(e.message, true); }
  area.classList.remove('enviando');
  $('#input-arquivos').value = '';
}
$('#input-arquivos').onchange = (ev) => importar(ev.target.files);

const area = $('#area-soltar');
['dragenter', 'dragover'].forEach((t) => area.addEventListener(t, (ev) => { ev.preventDefault(); area.classList.add('sobre'); }));
['dragleave', 'drop'].forEach((t) => area.addEventListener(t, () => area.classList.remove('sobre')));
area.addEventListener('drop', (ev) => { ev.preventDefault(); importar(ev.dataTransfer.files); });
// Evita que o navegador abra o PDF se ele for solto fora da área
window.addEventListener('dragover', (ev) => ev.preventDefault());
window.addEventListener('drop', (ev) => ev.preventDefault());

window.renomearArquivo = async (id) => {
  const a = arquivos.find((x) => x.id === id);
  const nome = prompt('Novo nome do arquivo:', a.nome);
  if (!nome || nome === a.nome) return;
  try {
    await api('/api/arquivos/' + id, { method: 'PUT', json: { nome } });
    carregarArquivos();
  } catch (e) { aviso(e.message, true); }
};

window.excluirArquivo = async (id) => {
  const a = arquivos.find((x) => x.id === id);
  if (!confirm(`Excluir "${a.nome}" da pasta?`)) return;
  try {
    await api('/api/arquivos/' + id, { method: 'DELETE' });
    marcados.delete(id);
    aviso('Arquivo excluído');
    carregarArquivos();
  } catch (e) { aviso(e.message, true); }
};

// ---------- Histórico ----------
async function carregarEnvios() {
  envios = await api('/api/envios');
  renderEnvios();
}

function renderEnvios() {
  const filtro = $('#filtro-status').value;
  const lista = envios.filter((e) => !filtro || e.status === filtro);
  $('#lista-envios').innerHTML = lista.length
    ? lista.map((e) => `
      <tr>
        <td>${dataHora(e.criadoEm)}</td>
        <td>${esc(e.clienteNome)}<small class="sub">${esc(e.clienteTelefone)}</small></td>
        <td><ul class="nomes">${e.arquivos.map((a) => `<li>${esc(a.nome)}</li>`).join('')}</ul></td>
        <td><span class="status ${e.status}" ${e.erro ? `title="${esc(e.erro)}"` : ''}>${e.status === 'enviado' ? 'Enviado' : 'Erro'}</span>
          ${e.erro ? `<small class="sub">${esc(e.erro)}</small>` : ''}</td>
        <td class="acoes-td"><button class="mini sec" onclick="reenviar('${e.id}', this)">${e.status === 'erro' ? 'Tentar de novo' : 'Reenviar'}</button></td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="vazio">Nenhum envio ainda.</td></tr>';
}
$('#filtro-status').onchange = renderEnvios;

window.reenviar = async (id, btn) => {
  if (!confirm('Enviar novamente estes arquivos?')) return;
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    await api(`/api/envios/${id}/reenviar`, { method: 'POST' });
    aviso('Enviado pelo WhatsApp ✔');
  } catch (e) { aviso('Não foi possível enviar: ' + e.message, true); }
  carregarEnvios();
};

// ---------- WhatsApp ----------
async function atualizarWhatsApp() {
  try {
    const s = await api('/api/whatsapp');
    const conectado = s.status === 'conectado';
    const textos = {
      iniciando: 'Iniciando o WhatsApp… aguarde alguns segundos.',
      abrindo_janela: 'Abrindo a janela do WhatsApp Web… aguarde alguns segundos.',
      aguardando_qr: 'Escaneie o QR Code com o WhatsApp da empresa (aqui ou na janela do WhatsApp Web que abriu).',
      autenticado: 'QR Code lido! Carregando suas conversas…',
      conectado: `Conectado ao número +${s.numero || ''}. Pronto para enviar!`,
      desconectado: 'Desconectado. Gerando um novo QR Code…',
      erro: 'Problema ao abrir o WhatsApp. Tentando novamente em 30 segundos… Detalhe: ' + (s.erro || 'desconhecido'),
    };
    $('#wa-badge').textContent = conectado ? 'WhatsApp conectado' : 'WhatsApp desconectado';
    $('#wa-badge').className = 'badge ' + (conectado ? 'ok' : 'off');
    $('#wa-texto').textContent = textos[s.status] || s.status;
    $('#wa-qr').hidden = !s.qr;
    if (s.qr) $('#wa-qr').src = s.qr;
    $('#wa-instrucoes').hidden = !s.qr;
    $('#wa-janela').hidden = !(s.janelaVisivel && s.status !== 'conectado');
    $('#btn-sair').hidden = !conectado;
  } catch {
    $('#wa-badge').textContent = 'Servidor fora do ar';
    $('#wa-badge').className = 'badge off';
  }
}

$('#btn-sair').onclick = async () => {
  if (!confirm('Desconectar o WhatsApp deste sistema?')) return;
  await api('/api/whatsapp/sair', { method: 'POST' }).catch((e) => aviso(e.message, true));
  atualizarWhatsApp();
};

// ---------- Mensagem padrão ----------
let mensagemPadrao = '';
async function carregarConfig() {
  const c = await api('/api/config');
  mensagemPadrao = c.mensagemPadrao;
  mensagemModelo = c.mensagem ?? mensagemPadrao;
  $('#form-config [name=mensagem]').value = mensagemModelo;
}
$('#restaurar-msg').onclick = () => ($('#form-config [name=mensagem]').value = mensagemPadrao);
$('#form-config').onsubmit = async (ev) => {
  ev.preventDefault();
  try {
    const c = await api('/api/config', { method: 'PUT', json: { mensagem: ev.target.mensagem.value } });
    mensagemModelo = c.mensagem;
    aviso('Mensagem salva');
  } catch (e) { aviso(e.message, true); }
};

// ---------- Pasta do computador (sincronização) ----------
let syncAtivo = false;

function mostrarStatusSync(c) {
  const e = c.estado || {};
  const partes = [];
  if (!c.ativo) partes.push('Sincronização desativada.');
  else {
    if (e.ultimaVez) partes.push('Última verificação: ' + dataHora(e.ultimaVez));
    partes.push(`${e.clientesCriados || 0} cliente(s) criado(s) e ${e.arquivosCopiados || 0} arquivo(s) copiado(s) desde que o sistema abriu`);
    if (e.erro) partes.push('⚠ Erro: ' + e.erro);
  }
  $('#sync-status').textContent = partes.join(' · ');
}

async function carregarSync(apenasStatus = false) {
  const c = await api('/api/sync');
  if (apenasStatus) return mostrarStatusSync(c);
  syncAtivo = !!c.ativo;
  const f = $('#form-sync');
  f.ativo.checked = syncAtivo;
  f.pasta.value = c.pasta || c.pastaSugerida;
  f.pasta.placeholder = c.pastaSugerida;
  mostrarStatusSync(c);
  if (clienteAtual) mostrarCabecalhoPasta();
}

$('#form-sync').onsubmit = async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  try {
    const c = await api('/api/sync', { method: 'PUT', json: { ativo: f.ativo.checked, pasta: f.pasta.value } });
    aviso(c.ativo ? 'Sincronização ativada' : 'Sincronização desativada');
    await carregarSync();
    atualizarDaPasta();
  } catch (e) { aviso(e.message, true); }
};

$('#btn-sync-agora').onclick = async () => {
  try {
    await api('/api/sync/agora', { method: 'POST' });
    await carregarSync();
    await atualizarDaPasta();
    aviso('Sincronizado');
  } catch (e) { aviso(e.message, true); }
};

async function abrirPastaNoComputador(clienteId) {
  try {
    await api('/api/sync/abrir', { method: 'POST', json: { clienteId } });
  } catch (e) { aviso(e.message, true); }
}
$('#btn-abrir-pasta-principal').onclick = () => abrirPastaNoComputador();
$('#btn-abrir-pasta-cliente').onclick = () => abrirPastaNoComputador(clienteAtual.id);

// Traz para a tela os clientes e arquivos que chegaram pela pasta do computador.
async function atualizarDaPasta() {
  if (!syncAtivo || $('#dlg-cliente').open) return;
  await carregarClientes();
  if (clienteAtual) {
    clienteAtual = clientes.find((c) => c.id === clienteAtual.id) || clienteAtual;
    mostrarCabecalhoPasta();
    await carregarArquivos();
  }
}
setInterval(() => atualizarDaPasta().catch(() => {}), 10000);
setInterval(() => { if (!$('#aba-config').hidden) carregarSync(true).catch(() => {}); }, 10000);

// ---------- Link para outros computadores ----------
async function carregarLinksRede() {
  const { links } = await api('/api/rede');
  $('#links-rede').innerHTML = links.length
    ? links.map((l) => `
      <div class="link-rede">
        <input value="${esc(l)}" readonly onclick="this.select()">
        <button class="mini" onclick="copiarLink('${esc(l)}')">Copiar link</button>
      </div>`).join('')
    : '<p class="dica esquerda">Este computador não está conectado a uma rede.</p>';
}

window.copiarLink = async (link) => {
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    // navegador sem permissão para a área de transferência: copia pelo campo
    const campo = [...document.querySelectorAll('.link-rede input')].find((i) => i.value === link);
    campo.select();
    document.execCommand('copy');
  }
  aviso('Link copiado! Cole no WhatsApp ou e-mail de quem vai acessar.');
};

// ---------- Início ----------
carregarLinksRede();
carregarConfig();
carregarSync();
carregarClientes();
atualizarWhatsApp();
setInterval(atualizarWhatsApp, 3000);
