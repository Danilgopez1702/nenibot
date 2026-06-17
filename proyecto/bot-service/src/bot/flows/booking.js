// bot/flows/booking.js — Flujo de reserva (Paso 5 + idempotencia Fase 0B).
const { getServices, getEmployeesForService, getServiceById } = require('../../db/queries/catalog');
const { getAvailableSlots, parseDateFromText, formatSlotsForMenu } = require('../slots');
const { createAppointment } = require('../../db/queries/appointments');
const { findOrCreateClient } = require('../../db/queries/clients');
const { addToWaitlist } = require('../../db/queries/waitlist');
const { compose } = require('../messenger');
const { checkIdempotency, saveIdempotency } = require('../../redis/index');
const { formatInTenantTz } = require('../../utils/timezone');

// Presenta el menú de servicios (inicio del flujo).
async function start(tenant, ctx) {
  const services = await getServices(tenant.id);
  if (!services.length) {
    const reply = await compose(tenant, 'not_understood', {}, 'Por ahora no tenemos servicios disponibles.');
    return { reply, state: 'idle', context: {} };
  }
  const menu = services.map((s, i) => `${i + 1}. ${s.name} ($${s.price})`).join('\n');
  const reply = await compose(
    tenant, 'ask_service', { menu },
    `Estos son nuestros servicios:\n${menu}\n¿Cuál te gustaría?`
  );
  return {
    reply,
    state: 'choosing_service',
    context: { flow: 'booking', services: services.map((s) => ({ id: s.id, name: s.name, duration_min: s.duration_min, price: s.price })) },
  };
}

async function chooseService(tenant, ctx, selection) {
  const list = ctx.context.services || [];
  const svc = selection ? list[selection - 1] : null;
  if (!svc) {
    const menu = list.map((s, i) => `${i + 1}. ${s.name} ($${s.price})`).join('\n');
    const reply = await compose(tenant, 'ask_service', { menu }, `No entendí. Elige un número:\n${menu}`);
    return { reply, state: 'choosing_service', context: ctx.context };
  }
  const employees = await getEmployeesForService(tenant.id, svc.id);
  if (!employees.length) {
    const reply = await compose(tenant, 'no_slots', {}, 'No hay personal disponible para ese servicio.');
    return { reply, state: 'idle', context: {} };
  }
  const newCtx = { ...ctx.context, serviceId: svc.id, serviceName: svc.name, duration: svc.duration_min,
    employees: employees.map((e) => ({ id: e.id, name: e.name })) };

  // Si hay una sola empleada, saltar selección
  if (employees.length === 1) {
    newCtx.employeeId = employees[0].id;
    newCtx.employeeName = employees[0].name;
    const reply = await compose(tenant, 'ask_date', { employee: employees[0].name },
      `Perfecto, con ${employees[0].name}. ¿Para qué día te gustaría tu cita?`);
    return { reply, state: 'choosing_date', context: newCtx };
  }

  const menu = employees.map((e, i) => `${i + 1}. ${e.name}`).join('\n');
  const reply = await compose(tenant, 'ask_employee', { menu }, `¿Con quién te gustaría agendar?\n${menu}`);
  return { reply, state: 'choosing_employee', context: newCtx };
}

async function chooseEmployee(tenant, ctx, selection) {
  const list = ctx.context.employees || [];
  const emp = selection ? list[selection - 1] : null;
  if (!emp) {
    const menu = list.map((e, i) => `${i + 1}. ${e.name}`).join('\n');
    const reply = await compose(tenant, 'ask_employee', { menu }, `Elige un número:\n${menu}`);
    return { reply, state: 'choosing_employee', context: ctx.context };
  }
  const newCtx = { ...ctx.context, employeeId: emp.id, employeeName: emp.name };
  const reply = await compose(tenant, 'ask_date', { employee: emp.name },
    `Perfecto, con ${emp.name}. ¿Para qué día te gustaría tu cita?`);
  return { reply, state: 'choosing_date', context: newCtx };
}

async function chooseDate(tenant, ctx, text) {
  const dateStr = parseDateFromText(text, tenant.config.timezone);
  if (!dateStr) {
    const reply = await compose(tenant, 'ask_date', {},
      'No entendí la fecha. Dime por ejemplo "mañana", "el sábado" o "20 de junio".');
    return { reply, state: 'choosing_date', context: ctx.context };
  }
  const slots = await getAvailableSlots(tenant, ctx.context.employeeId, ctx.context.duration, dateStr);
  if (!slots.length) {
    // Ofrecer waitlist
    const reply = await compose(tenant, 'offer_waitlist', { date: dateStr },
      'No hay horarios libres ese día. ¿Quieres que te anote en lista de espera por si se libera uno? (sí/no)');
    return { reply, state: 'on_waitlist', context: { ...ctx.context, dateStr } };
  }
  const menu = formatSlotsForMenu(slots);
  const reply = await compose(tenant, 'ask_time', { menu, date: dateStr },
    `Para el ${dateStr} tengo estos horarios:\n${menu}\n¿Cuál prefieres?`);
  return { reply, state: 'choosing_time', context: { ...ctx.context, dateStr, slots } };
}

async function chooseTime(tenant, ctx, selection) {
  const slots = ctx.context.slots || [];
  const slot = selection ? slots[selection - 1] : null;
  if (!slot) {
    const menu = formatSlotsForMenu(slots);
    const reply = await compose(tenant, 'ask_time', { menu }, `Elige un número:\n${menu}`);
    return { reply, state: 'choosing_time', context: ctx.context };
  }
  const newCtx = { ...ctx.context, chosenSlot: slot };
  const when = formatInTenantTz(new Date(slot.startsAt), tenant.config.timezone);
  const reply = await compose(tenant, 'confirm_booking',
    { service: ctx.context.serviceName, employee: ctx.context.employeeName, when },
    `Confirmo tu cita de ${ctx.context.serviceName} con ${ctx.context.employeeName} el ${when}. ¿Es correcto? (sí/no)`);
  return { reply, state: 'confirming_booking', context: newCtx };
}

async function confirmBooking(tenant, ctx, confirmed, meta) {
  if (!confirmed) {
    const reply = await compose(tenant, 'goodbye', {}, 'Sin problema, aquí estoy cuando quieras agendar. 😊');
    return { reply, state: 'idle', context: {} };
  }
  const c = ctx.context;
  const idemKey = `${tenant.id}:${meta.clientPhone}:confirm_booking:${meta.conversationId}:${meta.messageId}`;
  const prev = await checkIdempotency(idemKey);
  if (prev) {
    return { reply: prev.reply, state: 'idle', context: {} };
  }

  const client = await findOrCreateClient(tenant.id, meta.clientPhone, meta.contactName);
  const result = await createAppointment({
    tenantId: tenant.id, clientId: client.id, serviceId: c.serviceId, employeeId: c.employeeId,
    startsAt: c.chosenSlot.startsAt, endsAt: c.chosenSlot.endsAt,
    timezone: tenant.config.timezone, channel: 'whatsapp_text', status: 'confirmed',
  });

  if (!result.ok) {
    const reply = await compose(tenant, 'no_slots', {},
      'Justo se ocupó ese horario. ¿Quieres elegir otro? Escríbeme "agendar".');
    return { reply, state: 'idle', context: {} };
  }

  const when = formatInTenantTz(new Date(c.chosenSlot.startsAt), tenant.config.timezone);
  const reply = await compose(tenant, 'booking_confirmed',
    { service: c.serviceName, employee: c.employeeName, when },
    `¡Listo! Tu cita de ${c.serviceName} quedó agendada para el ${when}. ¡Te esperamos! 🎉`);

  await saveIdempotency(idemKey, { reply, appointmentId: result.appointment.id });
  return { reply, state: 'idle', context: {} };
}

async function handleWaitlist(tenant, ctx, confirmed, meta) {
  if (!confirmed) {
    const reply = await compose(tenant, 'goodbye', {}, 'De acuerdo. ¡Aquí estoy cuando gustes! 😊');
    return { reply, state: 'idle', context: {} };
  }
  const c = ctx.context;
  const client = await findOrCreateClient(tenant.id, meta.clientPhone, meta.contactName);
  await addToWaitlist({
    tenantId: tenant.id, clientId: client.id, serviceId: c.serviceId,
    employeeId: c.employeeId, desiredDate: c.dateStr,
  });
  const reply = await compose(tenant, 'waitlist_added', { date: c.dateStr },
    `Te anoté en la lista de espera para el ${c.dateStr}. Te aviso si se libera un lugar. 🙌`);
  return { reply, state: 'idle', context: {} };
}

module.exports = { start, chooseService, chooseEmployee, chooseDate, chooseTime, confirmBooking, handleWaitlist };
