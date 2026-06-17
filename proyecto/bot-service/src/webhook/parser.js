// webhook/parser.js — Normaliza el payload de Meta a un objeto simple.
// Extrae: phoneId (destino), y los mensajes entrantes relevantes.
function parseMetaPayload(body) {
  const results = [];
  if (!body || body.object !== 'whatsapp_business_account') return results;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneId = value.metadata?.phone_number_id;
      const contacts = value.contacts || [];
      const contactName = contacts[0]?.profile?.name || null;

      for (const msg of value.messages || []) {
        results.push({
          phoneId,
          externalMessageId: msg.id,
          from: msg.from,                  // teléfono del cliente
          contactName,
          type: msg.type,                  // text | audio | ...
          text: msg.text?.body || null,
          audioId: msg.audio?.id || null,
          timestamp: msg.timestamp,        // epoch (segundos)
          raw: msg,
        });
      }
    }
  }
  return results;
}

module.exports = { parseMetaPayload };
