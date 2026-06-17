// scripts/lib/whatsapp.js — Paso 0C.6
// Envía el primer mensaje de bienvenida que inicia la encuesta de onboarding.
const axios = require('axios');

function graphBase() {
  return `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v19.0'}`;
}

async function sendFirstOnboardingMessage(phoneNumberId, toNumber, botName, token) {
  const body =
    `¡Hola! 👋 Soy *${botName}*, tu nuevo asistente de citas por WhatsApp.\n\n` +
    `Vamos a configurar tu negocio en unos minutos. ` +
    `Responde a este mensaje con *"empezar"* y comenzamos. 🚀`;
  try {
    const { data } = await axios.post(
      `${graphBase()}/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to: toNumber, type: 'text', text: { body } },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return { ok: true, messageId: data?.messages?.[0]?.id || null };
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    return { ok: false, error: detail };
  }
}

module.exports = { sendFirstOnboardingMessage };
