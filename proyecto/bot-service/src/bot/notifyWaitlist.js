// bot/notifyWaitlist.js — Función central compartida entre cancellation y noshow.
// Notifica al siguiente candidato cuando se libera un slot.
const { withTransaction } = require('../db/index');
const { getNextWaitlistCandidate, markNotified } = require('../db/queries/waitlist');
const { getActiveIntegration } = require('../db/queries/tenants');
const { sendTextMessage } = require('../whatsapp/sender');
const { compose } = require('./messenger');
const { formatInTenantTz } = require('../utils/timezone');
const logger = require('../utils/logger');

// freedSlot: { employeeId, startsAt, dateStr }
async function notifyWaitlistCandidate(tenant, freedSlot) {
  try {
    const candidate = await withTransaction(async (client) => {
      const next = await getNextWaitlistCandidate(client, tenant.id, freedSlot.employeeId, freedSlot.dateStr);
      return next;
    });
    if (!candidate) return false;

    await markNotified(tenant.id, candidate.id, freedSlot.startsAt, 30);

    const { rows } = await withTransaction(async (client) =>
      client.query(`SELECT phone FROM clients WHERE id = $1`, [candidate.client_id])
    );
    const phone = rows[0]?.phone;
    if (!phone) return false;

    const when = formatInTenantTz(new Date(freedSlot.startsAt), tenant.config.timezone);
    const text = await compose(tenant, 'waitlist_offer', { when },
      `¡Se liberó un horario el ${when}! ¿Lo quieres? Responde "sí" en los próximos 30 min. 😊`);

    const integration = await getActiveIntegration(tenant.id);
    if (integration) await sendTextMessage(integration, phone, text);
    return true;
  } catch (err) {
    logger.error('notifyWaitlistCandidate falló', { error: err.message });
    return false;
  }
}

module.exports = { notifyWaitlistCandidate };
