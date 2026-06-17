// tests/concurrency.test.js — Fase 0D.1
// Escenario: 10 reservas simultáneas al MISMO tenant+empleada+slot.
// Esperado: exactamente 1 confirmada, 9 rechazos controlados, 0 errores 500,
//           0 double-bookings en DB.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createIsolatedTenant, cleanupTenant, countConfirmed, closeAll } = require('./helpers/setup');
const { createAppointment } = require('../bot-service/src/db/queries/appointments');

let ctx;
before(async () => { ctx = await createIsolatedTenant('test-conc'); });
after(async () => { await cleanupTenant(ctx.tenantId); await closeAll(); });

test('10 reservas concurrentes al mismo slot -> exactamente 1 gana', async () => {
  const attempts = Array.from({ length: 10 }, () =>
    createAppointment({
      tenantId: ctx.tenantId, clientId: ctx.clientId, serviceId: ctx.serviceId,
      employeeId: ctx.employeeId, startsAt: ctx.slotStart, endsAt: ctx.slotEnd,
      timezone: ctx.timezone, status: 'confirmed',
    })
  );

  // 0 excepciones (0 errores 500): Promise.all no debe rechazar
  const results = await Promise.all(attempts);

  const winners = results.filter((r) => r.ok === true);
  const rejected = results.filter((r) => r.ok === false && r.reason === 'slot_taken');

  assert.strictEqual(winners.length, 1, `debe haber exactamente 1 ganador, hubo ${winners.length}`);
  assert.strictEqual(rejected.length, 9, `deben haber 9 rechazos controlados, hubo ${rejected.length}`);

  // 0 double-bookings a nivel DB
  const inDb = await countConfirmed(ctx.tenantId, ctx.employeeId, ctx.slotStart);
  assert.strictEqual(inDb, 1, `la DB debe tener exactamente 1 cita en el slot, tiene ${inDb}`);
});
