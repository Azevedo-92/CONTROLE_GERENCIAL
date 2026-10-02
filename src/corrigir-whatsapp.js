// Correção do erro "Data passed to getter must include an id property" ao enviar arquivos.
// Uma atualização do WhatsApp Web (set/2026) quebrou o envio de mídia no whatsapp-web.js 1.34.7.
// A correção oficial (wwebjs/whatsapp-web.js PR #201923) já está no GitHub, mas ainda não saiu no npm,
// então aplicamos a mesma linha no arquivo instalado. Se já estiver corrigido, não faz nada.
const fs = require('fs');
const path = require('path');

function corrigirWhatsApp() {
  let arquivo;
  try {
    arquivo = path.join(path.dirname(require.resolve('whatsapp-web.js/package.json')), 'src', 'util', 'Injected', 'Utils.js');
  } catch {
    return;
  }
  const codigo = fs.readFileSync(arquivo, 'utf8');
  if (codigo.includes('delete message.__x_id')) return;

  const alvo = '// Bot\'s won\'t reply if canonicalUrl is set (linking)';
  if (!codigo.includes(alvo)) {
    console.warn('Aviso: não foi possível aplicar a correção de envio de arquivos do WhatsApp.');
    return;
  }
  fs.writeFileSync(arquivo, codigo.replace(alvo, 'delete message.__x_id;\n\n        ' + alvo));
  console.log('Correção de envio de arquivos do WhatsApp aplicada.');
}

module.exports = corrigirWhatsApp;

if (require.main === module) corrigirWhatsApp();
