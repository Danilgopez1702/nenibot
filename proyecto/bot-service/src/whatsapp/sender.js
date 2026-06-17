// whatsapp/sender.js — Meta WhatsApp Cloud API: enviar texto + marcar leído.
const axios = require('axios');
const logger = require('../utils/logger');

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v19.0'}`;

// integration = { wa_phone_id, wa_token } (token ya descifrado)
async function sendTextMessage(integration, toPhone, text) {
  const url = `${GRAPH}/${integration.wa_phone_id}/messages`;
  try {
    const { data } = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${integration.wa_token}`, 'Content-Type': 'application/json' } }
    );
    const messageId = data?.messages?.[0]?.id || null;
    logger.info('Mensaje WhatsApp enviado', { to: toPhone, messageId });
    return { ok: true, messageId };
  } catch (err) {
    const detail = err.response?.data || err.message;
    logger.error('Error enviando mensaje WhatsApp', { to: toPhone, detail });
    return { ok: false, error: JSON.stringify(detail) };
  }
}

async function markAsRead(integration, messageId) {
  const url = `${GRAPH}/${integration.wa_phone_id}/messages`;
  try {
    await axios.post(
      url,
      { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
      { headers: { Authorization: `Bearer ${integration.wa_token}`, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    logger.warn('No se pudo marcar como leído', { messageId, detail: err.response?.data || err.message });
  }
}

module.exports = { sendTextMessage, markAsRead };
