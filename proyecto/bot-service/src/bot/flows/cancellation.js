// bot/flows/cancellation.js
const { getActiveAppointments, cancelAppointment } = require('../../db/queries/appointments');
const { findOrCreateClient } = require('../../db/queries/clients');
const { compose } = require('../messenger');
const { checkIdempotency, saveIdempotency } = require('../../redis/index');
const { notifyWaitlistCandidate } = require('../notifyWaitlist');
const { formatInTenantTz, todayInTenantTz } = require('../../utils/timezone');

// Inicia cancelación: busca cita activa, valida política de horas mínimas.
async function start(tenant, ctx, meta) {
  const client = await findOrCreateClient(tenant.id, meta.clientPhone, meta.contactName);
  const appts = await getActiveAppointments(tenant.id, client.id);
  if (!appts.length) {
    const reply = await compose(tenant, 'not_understood', {}, 'No encuentro ninguna cita activa a tu nombre.');
    return { reply, state: 'idle', context: {} };
  }
  const appt = appts[0]; // la más próxima
  const hoursLeft = (new Date(appt.starts_at).getTime() - Date.now()) / 3600000;
  if (hoursLeft < tenant.config.cancel_min_hours) {
    const reply = await compose(tenant, 'cancel_too_late', { hours: tenant.config.cancel_min_hours },
      `Tu cita es muy pronto y la política pide al menos ${tenant.config.cancel_min_hours}h de anticipación. Llámanos por favor.`);
    return { reply, state: 'idle', context: {} };
  }
  const when = formatInTenantTz(new Date(appt.starts_at), tenant.config.timezone);
  const reply = await compose(tenant, 'ask_cancel', { when },
    `¿Confirmas que quieres cancelar tu cita del ${when}? (sí/no)`);
  return {
    reply, state: 'confirming_cancellation',
    context: { flow: 'cancellation', appointmentId: appt.id, employeeId: appt.employee_id, startsAt: appt.starts_at },
  };
}

async function confirm(tenant, ctx, confirmed, meta) {
  if (!confirmed) {
    const reply = await compose(tenant, 'goodbye', {}, 'Perfecto, tu cita sigue en pie. 😊');
    return { reply, state: 'idle', context: {} };
  }
  const idemKey = `${tenant.id}:${meta.clientPhone}:cancel_appointment:${meta.conversationId}:${meta.messageId}`;
  const prev = await checkIdempotency(idemKey);
  if (prev) return { reply: prev.reply, state: 'idle', context: {} };

  const result = await cancelAppointment(tenant.id, ctx.context.appointmentId, 'client');
  if (!result.ok) {
    const reply = await compose(tenant, 'not_understood', {}, 'No pude cancelar la cita, intenta de nuevo.');
    return { reply, state: 'idle', context: {} };
  }
  const reply = await compose(tenant, 'cancel_confirmed', {}, 'Tu cita fue cancelada. ¡Esperamos verte pronto! 🙌');
  await saveIdempotency(idemKey, { reply });

  // Notificar a waitlist (async, no bloquea la respuesta)
  const startsAt = ctx.context.startsAt;
  const dateStr = startsAt ? todayInTenantTzFromDate(startsAt, tenant.config.timezone) : null;
  notifyWaitlistCandidate(tenant, { employeeId: ctx.context.employeeId, startsAt, dateStr }).catch(() => {});

  return { reply, state: 'idle', context: {} };
}

function todayInTenantTzFromDate(iso, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
}

module.exports = { start, confirm };
