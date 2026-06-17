// tests/isolation.test.js — Fase 0D.2
// Escenario: con 2 tenants, consultar como tenant A no debe devolver datos de B.
// Usa la query REAL del bot-service (getAppointmentsForDay) que filtra por tenant_id.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { pool, createIsolatedTenant, cleanupTenant, closeAll } = require('./helpers/setup');
const { createAppointment, getAppointmentsForDay } = require('../bot-service/src/db/queries/appointments');

let A, B;
before(async () => {
  A = await createIsolatedTenant('test-iso-a');
  B = await createIsolatedTenant('test-iso-b');
  // Cita en A
  await createAppointment({
    tenantId: A.tenantId, clientId: A.clientId, serviceId: A.serviceId, employeeId: A.employeeId,
    startsAt: A.slotStart, endsAt: A.slotEnd, timezone: 'UTC', status: 'confirmed',
  });
  // Cita en B en el mismo día/slot (su propia empleada)
  await createAppointment({
    tenantId: B.tenantId, clientId: B.clientId, serviceId: B.serviceId, employeeId: B.employeeId,
    startsAt: B.slotStart, endsAt: B.slotEnd, timezone: 'UTC', status: 'confirmed',
  });
});
after(async () => { await cleanupTenant(A.tenantId); await cleanupTenant(B.tenantId); await closeAll(); });

test('tenant A solo ve sus propias citas (sin fuga de B)', async () => {
  const rowsA = await getAppointmentsForDay(A.tenantId, A.dateStr, 'UTC');
  assert.ok(rowsA.length >= 1, 'A debe ver su cita');
  for (const r of rowsA) {
    assert.strictEqual(r.tenant_id, A.tenantId, 'ninguna fila puede pertenecer a otro tenant');
  }
  // Verificar explícitamente que la cita de B no aparece
  const leak = rowsA.some((r) => r.tenant_id === B.tenantId);
  assert.strictEqual(leak, false, 'NO debe haber fuga de datos de B hacia A');
});

test('estructura: ninguna cita de A referencia recursos de B', async () => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM appointments
      WHERE tenant_id = $1 AND (employee_id = $2 OR client_id = $3)`,
    [A.tenantId, B.employeeId, B.clientId]
  );
  assert.strictEqual(rows[0].n, 0, 'no debe existir mezcla de recursos entre tenants');
});
