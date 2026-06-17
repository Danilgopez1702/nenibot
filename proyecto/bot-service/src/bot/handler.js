// bot/handler.js — Orquestador: carga sesión -> enruta por estado -> persiste.
// Recibe SIEMPRE un NormalizedInboundMessage (nunca el payload crudo).
const { getOrCreateSession, saveSession } = require('../db/queries/sessions');
const { detectIntent } = require('./intentDetector');
const { compose } = require('./messenger');
const booking = require('./flows/booking');
const cancellation = require('./flows/cancellation');
const reschedule = require('./flows/reschedule');
const logger = require('../utils/logger');

function pushHistory(history, role, content) {
  const h = Array.isArray(history) ? history.slice(-9) : [];
  h.push({ role, content, ts: new Date().toISOString() });
  return h;
}

// Devuelve el texto a enviar al cliente.
async function handleMessage(tenant, msg) {
  const phone = msg.clientPhone;
  const session = await getOrCreateSession(tenant.id, phone);
  const state = session.state;
  const text = msg.normalizedText;
  const { intent, selection } = detectIntent(text);
  const meta = {
    clientPhone: phone,
    conversationId: session.id,
    messageId: msg.externalMessageId,
    contactName: msg.metadata?.contactName || null,
  };
  const ctx = { tenant, session, context: session.context || {} };
  const confirmed = intent === 'confirm';
  const denied = intent === 'deny';

  let result;
  try {
    switch (state) {
      case 'choosing_service':
        result = await booking.chooseService(tenant, ctx, selection); break;
      case 'choosing_employee':
        result = await booking.chooseEmployee(tenant, ctx, selection); break;
      case 'choosing_date':
        result = await booking.chooseDate(tenant, ctx, text); break;
      case 'choosing_time':
        result = await booking.chooseTime(tenant, ctx, selection); break;
      case 'confirming_booking':
        result = await booking.confirmBooking(tenant, ctx, confirmed && !denied, meta); break;
      case 'on_waitlist':
        result = await booking.handleWaitlist(tenant, ctx, confirmed && !denied, meta); break;
      case 'confirming_cancellation':
        result = await cancellation.confirm(tenant, ctx, confirmed && !denied, meta); break;
      case 'choosing_reschedule_date':
        result = await reschedule.chooseDate(tenant, ctx, text); break;
      case 'choosing_reschedule_time':
        result = await reschedule.chooseTime(tenant, ctx, selection); break;
      case 'confirming_reschedule':
        result = await reschedule.confirm(tenant, ctx, confirmed && !denied, meta); break;
      case 'awaiting_waitlist_response':
        result = await reschedule.handleWaitlistResponseFlow(tenant, ctx, confirmed && !denied, meta); break;
      default:
        result = await routeFromIdle(tenant, ctx, intent, meta, text);
    }
  } catch (err) {
    logger.error('handleMessage error', { error: err.message, stack: err.stack, state });
    const reply = await compose(tenant, 'not_understood', {}, 'Tuvimos un problemita. ¿Puedes intentarlo de nuevo?');
    result = { reply, state: 'idle', context: {} };
  }

  // Persistir sesión
  const history = pushHistory(session.history, 'user', text);
  const history2 = pushHistory(history, 'assistant', result.reply);
  await saveSession(tenant.id, phone, {
    state: result.state, context: result.context, history: history2,
  });

  return result.reply;
}

async function routeFromIdle(tenant, ctx, intent, meta, text) {
  switch (intent) {
    case 'book':
    case 'select':
      return booking.start(tenant, ctx);
    case 'cancel':
      return cancellation.start(tenant, ctx, meta);
    case 'reschedule':
      return reschedule.start(tenant, ctx, meta);
    case 'consult': {
      const reply = await compose(tenant, 'greeting', {},
        '¡Hola! Con gusto te ayudo. Puedo agendar, cancelar o reagendar tu cita. ¿Qué necesitas?');
      return { reply, state: 'idle', context: {} };
    }
    default: {
      const reply = await compose(tenant, 'greeting', {},
        '¡Hola! 😊 Soy tu asistente. ¿Quieres agendar una cita? Escríbeme "agendar".');
      return { reply, state: 'idle', context: {} };
    }
  }
}

module.exports = { handleMessage };
