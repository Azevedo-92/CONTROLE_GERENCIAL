const $ = (s) => document.querySelector(s);
let clientes = [];
let documentos = [];

async function api(url, opcoes = {}) {
  if (opcoes.json) {
    opcoes.body = JSON.stringify(opcoes.json);
    opcoes.headers = { 'Content-Type': 'application/json' };
  }
  const resp = await fetch(url, opcoes);
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(dados.erro || 'Erro na requisição'), { dados });
  return dados;
}

let timerAviso;
function aviso(texto, erro = false) {
  const el = $('#aviso');
  el.textContent = texto;
  el.className = erro ? 'erro' : '';
  el.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => (el.hidden = true), erro ? 7000 : 3500);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

// ---------- Abas ----------
document.querySelectorAll('nav button').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('ativa', b === btn));
    document.querySelectorAll('main > section').forEach((s) => (s.hidden = s.id !== 'aba-' + btn.dataset.aba));
  })
);

// ---------- Clientes ----------
async function carregarClientes() {
  clientes = await api('/api/clientes');
  $('#lista-clientes').innerHTML = clientes.length
    ? clientes.map((c) => `
      <tr>
        <td>${esc(c.nome)}</td>
        <td>${esc(c.telefone)}</td>
        <td>${esc(c.documento)}</td>
        <td class="acoes-td">
          <button class="mini sec" onclick="editarCliente('${c.id}')">Editar</button>
          <button class="link" onclick="excluirCliente('${c.id}')">Excluir</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="vazio">Nenhum cliente cadastrado.</td></tr>';

  $('#form-doc [name=clienteId]').innerHTML =
    '<option value="">Selecione…</option>' + clientes.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
}

function limparFormCliente() {
  $('#form-cliente').reset();
  $('#form-cliente [name=id]').value = '';
  $('#titulo-cliente').textContent = 'Novo cliente';
  $('#cancelar-cliente').hidden = true;
}

window.editarCliente = (id) => {
  const c = clientes.find((x) => x.id === id);
  const f = $('#form-cliente');
  f.id.value = c.id;
  f.nome.value = c.nome;
  f.telefone.value = c.telefone;
  f.documento.value = c.documento || '';
  $('#titulo-cliente').textContent = 'Editar cliente';
  $('#cancelar-cliente').hidden = false;
  f.nome.focus();
};

window.excluirCliente = async (id) => {
  if (!confirm('Excluir este cliente?')) return;
  try {
    await api('/api/clientes/' + id, { method: 'DELETE' });
    aviso('Cliente excluído');
    carregarClientes();
  } catch (e) { aviso(e.message, true); }
};

$('#cancelar-cliente').onclick = limparFormCliente;

$('#form-cliente').onsubmit = async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const dados = { nome: f.nome.value, telefone: f.telefone.value, documento: f.documento.value };
  try {
    if (f.id.value) await api('/api/clientes/' + f.id.value, { method: 'PUT', json: dados });
    else await api('/api/clientes', { method: 'POST', json: dados });
    aviso('Cliente salvo');
    limparFormCliente();
    await carregarClientes();
    carregarDocumentos();
  } catch (e) { aviso(e.message, true); }
};

// ---------- Documentos ----------
async function carregarDocumentos() {
  documentos = await api('/api/documentos');
  renderDocumentos();
}

function renderDocumentos() {
  const filtro = $('#filtro-status').value;
  const lista = documentos.filter((d) => !filtro || d.status === filtro);
  const rotulo = { pendente: 'Pendente', enviado: 'Enviado', erro: 'Erro' };
  $('#lista-docs').innerHTML = lista.length
    ? lista.map((d) => `
      <tr>
        <td>${esc(d.clienteNome)}<small class="sub">${esc(d.clienteTelefone)}</small></td>
        <td>${esc(d.descricao) || '-'}</td>
        <td>${d.valor ? 'R$ ' + esc(d.valor) : '-'}</td>
        <td>${data(d.vencimento)}</td>
        <td>
          ${d.nota ? `<a href="/api/documentos/${d.id}/arquivo/nota" title="${esc(d.nota.nome)}">Nota</a>` : ''}
          ${d.boleto ? `<a href="/api/documentos/${d.id}/arquivo/boleto" title="${esc(d.boleto.nome)}">Boleto</a>` : ''}
        </td>
        <td>
          <span class="status ${d.status}" ${d.erro ? `title="${esc(d.erro)}"` : ''}>${rotulo[d.status]}</span>
          <small class="sub">${d.status === 'enviado' ? dataHora(d.enviadoEm) : ''}</small>
        </td>
        <td class="acoes-td">
          <button class="mini wa" onclick="enviarDoc('${d.id}', this)">${d.status === 'enviado' ? 'Reenviar' : 'Enviar'}</button>
          <button class="link" onclick="excluirDoc('${d.id}')">Excluir</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="vazio">Nenhum documento.</td></tr>';
}

$('#filtro-status').onchange = renderDocumentos;

window.enviarDoc = async (id, btn) => {
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  try {
    await api(`/api/documentos/${id}/enviar`, { method: 'POST' });
    aviso('Enviado pelo WhatsApp ✔');
  } catch (e) {
    aviso('Não foi possível enviar: ' + (e.dados?.erro || e.message), true);
  }
  carregarDocumentos();
};

window.excluirDoc = async (id) => {
  if (!confirm('Excluir este documento e seus arquivos?')) return;
  try {
    await api('/api/documentos/' + id, { method: 'DELETE' });
    aviso('Documento excluído');
    carregarDocumentos();
  } catch (e) { aviso(e.message, true); }
};

$('#form-doc').onsubmit = async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const enviarAgora = ev.submitter?.value === 'enviar';
  const botoes = f.querySelectorAll('button');
  botoes.forEach((b) => (b.disabled = true));
  try {
    const doc = await api('/api/documentos', { method: 'POST', body: new FormData(f) });
    f.reset();
    if (enviarAgora) await enviarDoc(doc.id);
    else { aviso('Documento salvo'); carregarDocumentos(); }
  } catch (e) {
    aviso(e.message, true);
  }
  botoes.forEach((b) => (b.disabled = false));
};

$('#btn-enviar-pendentes').onclick = async (ev) => {
  const qtd = documentos.filter((d) => d.status !== 'enviado').length;
  if (!qtd) return aviso('Não há documentos pendentes');
  if (!confirm(`Enviar ${qtd} documento(s) pendente(s) pelo WhatsApp?`)) return;
  const btn = ev.target;
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const r = await api('/api/documentos/enviar-pendentes', { method: 'POST' });
    aviso(`${r.enviados} enviado(s)` + (r.falhas ? `, ${r.falhas} com erro` : ''), r.falhas > 0);
  } catch (e) { aviso(e.message, true); }
  btn.disabled = false;
  btn.textContent = 'Enviar todos os pendentes';
  carregarDocumentos();
};

// ---------- WhatsApp ----------
async function atualizarWhatsApp() {
  try {
    const s = await api('/api/whatsapp');
    const conectado = s.status === 'conectado';
    const textos = {
      iniciando: 'Iniciando o WhatsApp… aguarde alguns segundos.',
      aguardando_qr: 'Escaneie o QR Code abaixo com o WhatsApp da empresa.',
      autenticado: 'QR Code lido! Carregando suas conversas…',
      conectado: `Conectado ao número +${s.numero || ''}. Pronto para enviar!`,
      desconectado: 'Desconectado. Gerando um novo QR Code…',
      erro: 'Não foi possível abrir o WhatsApp (verifique a internet). Tentando novamente… Detalhe: ' + (s.erro || 'desconhecido'),
    };
    $('#wa-badge').textContent = conectado ? 'WhatsApp conectado' : 'WhatsApp desconectado';
    $('#wa-badge').className = 'badge ' + (conectado ? 'ok' : 'off');
    $('#wa-texto').textContent = textos[s.status] || s.status;
    $('#wa-qr').hidden = !s.qr;
    if (s.qr) $('#wa-qr').src = s.qr;
    $('#wa-instrucoes').hidden = !s.qr;
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

// ---------- Mensagem ----------
let mensagemPadrao = '';
async function carregarConfig() {
  const c = await api('/api/config');
  mensagemPadrao = c.mensagemPadrao;
  $('#form-config [name=mensagem]').value = c.mensagem;
}
$('#restaurar-msg').onclick = () => ($('#form-config [name=mensagem]').value = mensagemPadrao);
$('#form-config').onsubmit = async (ev) => {
  ev.preventDefault();
  try {
    await api('/api/config', { method: 'PUT', json: { mensagem: ev.target.mensagem.value } });
    aviso('Mensagem salva');
  } catch (e) { aviso(e.message, true); }
};

// ---------- Início ----------
carregarClientes().then(carregarDocumentos);
carregarConfig();
atualizarWhatsApp();
setInterval(atualizarWhatsApp, 3000);
