// scripts/lib/metaApi.js — Paso 0C.5
// Llamadas a la Meta Graph API para configurar el webhook del número.
const axios = require('axios');

function graphBase() {
  return `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v19.0'}`;
}

// Verifica que el token del cliente tiene permisos sobre el número.
async function verifyToken(phoneNumberId, token) {
  try {
    const { data } = await axios.get(`${graphBase()}/${phoneNumberId}`, {
      params: { fields: 'verified_name,display_phone_number,quality_rating' },
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: true, info: data };
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    return { ok: false, error: detail };
  }
}

// Suscribe el número al webhook maestro de la app (POST /{phone-number-id}/subscribed_apps).
async function subscribeWebhook(phoneNumberId, token) {
  try {
    const { data } = await axios.post(
      `${graphBase()}/${phoneNumberId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (data?.success === true) return { ok: true };
    return { ok: false, error: JSON.stringify(data) };
  } catch (err) {
    const e = err.response?.data?.error;
    // Algunos errores indican que ya estaba suscrito -> lo tratamos como éxito idempotente.
    if (e && /already/i.test(e.message || '')) return { ok: true, already: true };
    return { ok: false, error: e?.message || err.message };
  }
}

module.exports = { verifyToken, subscribeWebhook };
