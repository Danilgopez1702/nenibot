// bot/flows/reschedule.js
const { getActiveAppointments, rescheduleAppointment } = require('../../db/queries/appointments');
const { findOrCreateClient } = require('../../db/queries/clients');
const { getServiceById } = require('../../db/queries/catalog');
const { getAvailableSlots, parseDateFromText, formatSlotsForMenu } = require('../slots');
const { compose } = require('../messenger');
const { checkIdempotency, saveIdempotency } = require('../../redis/index');
const { acceptWaitlist, getPendingNotified } = require('../../db/queries/waitlist');
const { createAppointment } = require('../../db/queries/appointments');
const { formatInTenantTz } = require('../../utils/timezone');

async function start(tenant, ctx, meta) {
  const client = await findOrCreateClient(tenant.id, meta.clientPhone, meta.contactName);
  const appts = await getActiveAppointments(tenant.id, client.id);
  if (!appts.length) {
    const reply = await compose(tenant, 'not_understood', {}, 'No encuentro una cita activa para reagendar.');
    return { reply, state: 'idle', context: {} };
  }
  const appt = appts[0];
  const svc = appt.service_id ? await getServiceById(tenant.id, appt.service_id) : null;
  const reply = await compose(tenant, 'ask_reschedule', {},
    '¿Para qué nueva fecha te gustaría reagendar? (ej. "el viernes")');
  return {
    reply, state: 'choosing_reschedule_date',
    context: {
      flow: 'reschedule', appointmentId: appt.id, employeeId: appt.employee_id,
      duration: svc?.duration_min || Math.round((new Date(appt.ends_at) - new Date(appt.starts_at)) / 60000),
      serviceName: appt.service_name_snapshot || svc?.name || 'tu servicio',
    },
  };
}

async function chooseDate(tenant, ctx, text) {
  const dateStr = parseDateFromText(text, tenant.config.timezone);
  if (!dateStr) {
    const reply = await compose(tenant, 'ask_reschedule', {}, 'No entendí la fecha. Dime "mañana", "el sábado" o "20 de junio".');
    return { reply, state: 'choosing_reschedule_date', context: ctx.context };
  }
  const slots = await getAvailableSlots(tenant, ctx.context.employeeId, ctx.context.duration, dateStr);
  if (!slots.length) {
    const reply = await compose(tenant, 'no_slots', { date: dateStr }, 'No hay horarios ese día. ¿Otra fecha?');
    return { reply, state: 'choosing_reschedule_date', context: ctx.context };
  }
  const menu = formatSlotsForMenu(slots);
  const reply = await compose(tenant, 'ask_time', { menu, date: dateStr }, `Para el ${dateStr}:\n${menu}\n¿Cuál prefieres?`);
  return { reply, state: 'choosing_reschedule_time', context: { ...ctx.context, dateStr, slots } };
}

async function chooseTime(tenant, ctx, selection) {
  const slots = ctx.context.slots || [];
  const slot = selection ? slots[selection - 1] : null;
  if (!slot) {
    const menu = formatSlotsForMenu(slots);
    const reply = await compose(tenant, 'ask_time', { menu }, `Elige un número:\n${menu}`);
    return { reply, state: 'choosing_reschedule_time', context: ctx.context };
  }
  const when = formatInTenantTz(new Date(slot.startsAt), tenant.config.timezone);
  const reply = await compose(tenant, 'confirm_reschedule', { when },
    `¿Reagendamos tu cita para el ${when}? (sí/no)`);
  return { reply, state: 'confirming_reschedule', context: { ...ctx.context, chosenSlot: slot } };
}

async function confirm(tenant, ctx, confirmed, meta) {
  if (!confirmed) {
    const reply = await compose(tenant, 'goodbye', {}, 'Listo, tu cita queda igual. 😊');
    return { reply, state: 'idle', context: {} };
  }
  const idemKey = `${tenant.id}:${meta.clientPhone}:reschedule_appointment:${meta.conversationId}:${meta.messageId}`;
  const prev = await checkIdempotency(idemKey);
  if (prev) return { reply: prev.reply, state: 'idle', context: {} };

  const c = ctx.context;
  const result = await rescheduleAppointment({
    tenantId: tenant.id, appointmentId: c.appointmentId, employeeId: c.employeeId,
    startsAt: c.chosenSlot.startsAt, endsAt: c.chosenSlot.endsAt,
  });
  if (!result.ok) {
    const reply = await compose(tenant, 'no_slots', {}, 'Se ocupó ese horario. Escríbeme "reagendar" para intentar otro.');
    return { reply, state: 'idle', context: {} };
  }
  const when = formatInTenantTz(new Date(c.chosenSlot.startsAt), tenant.config.timezone);
  const reply = await compose(tenant, 'reschedule_confirmed', { when }, `¡Listo! Tu cita quedó para el ${when}. 🎉`);
  await saveIdempotency(idemKey, { reply });
  return { reply, state: 'idle', context: {} };
}

// Respuesta del cliente a una oferta de waitlist (sí -> agenda el slot ofrecido).
async function handleWaitlistResponseFlow(tenant, ctx, confirmed, meta) {
  const pending = await getPendingNotified(tenant.id, meta.clientPhone);
  if (!pending) {
    const reply = await compose(tenant, 'not_understood', {}, 'No tengo una oferta de horario pendiente para ti.');
    return { reply, state: 'idle', context: {} };
  }
  if (!confirmed) {
    const reply = await compose(tenant, 'waitlist_expired', {}, 'De acuerdo, dejo el horario disponible para alguien más. 😊');
    return { reply, state: 'idle', context: {} };
  }
  const idemKey = `${tenant.id}:${meta.clientPhone}:accept_waitlist_slot:${meta.conversationId}:${meta.messageId}`;
  const prev = await checkIdempotency(idemKey);
  if (prev) return { reply: prev.reply, state: 'idle', context: {} };

  const svc = pending.service_id ? await getServiceById(tenant.id, pending.service_id) : null;
  const duration = svc?.duration_min || 30;
  const startsAt = pending.offered_slot;
  const endsAt = new Date(new Date(startsAt).getTime() + duration * 60000).toISOString();

  const client = await findOrCreateClient(tenant.id, meta.clientPhone, meta.contactName);
  const result = await createAppointment({
    tenantId: tenant.id, clientId: client.id, serviceId: pending.service_id,
    employeeId: pending.employee_id, startsAt, endsAt, timezone: tenant.config.timezone, status: 'confirmed',
  });
  if (!result.ok) {
    const reply = await compose(tenant, 'waitlist_expired', {}, 'Justo se ocupó ese horario. Te avisamos en la próxima. 🙏');
    return { reply, state: 'idle', context: {} };
  }
  await acceptWaitlist(tenant.id, pending.id);
  const when = formatInTenantTz(new Date(startsAt), tenant.config.timezone);
  const reply = await compose(tenant, 'waitlist_accepted', { when }, `¡Genial! Tu cita quedó el ${when}. ¡Te esperamos! 🎉`);
  await saveIdempotency(idemKey, { reply });
  return { reply, state: 'idle', context: {} };
}

module.exports = { start, chooseDate, chooseTime, confirm, handleWaitlistResponseFlow };
