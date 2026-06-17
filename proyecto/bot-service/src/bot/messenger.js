// bot/messenger.js — Construye instrucción (Node.js) y pide a Claude que la redacte.
const { draftMessage } = require('./claude');
const { getTemplate } = require('../db/queries/catalog');

// Sustituye {var} en una plantilla de texto.
function interpolate(str, vars = {}) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

// Redacta un mensaje a partir de un template_key + variables.
// fallback se usa si Claude falla. Node.js construye la instrucción final.
async function compose(tenant, templateKey, vars = {}, fallback = '', conversationId = null) {
  const templateInstruction = await getTemplate(tenant.id, templateKey);
  const baseInstruction = templateInstruction || fallback || templateKey;
  const instruction = interpolate(baseInstruction, vars);
  const fallbackText = interpolate(fallback || baseInstruction, vars);
  return draftMessage({ tenant, instruction, fallbackText, conversationId });
}

module.exports = { compose, interpolate };
