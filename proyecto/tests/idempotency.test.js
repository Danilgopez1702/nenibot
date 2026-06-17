// tests/idempotency.test.js — Fase 0D.3
// Escenario: el mismo payload de Meta (mismo message_id) procesado 3 veces.
// Esperado: exactamente 1 registro en inbound_messages; las 2 repeticiones se
// descartan silenciosamente. Reproduce el dedup EXACTO del webhook router
// (INSERT ... ON CONFLICT (tenant_id, external_message_id) DO NOTHING RETURNING id).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { pool, createIsolatedTenant, cleanupTenant, closeAll } = require('./helpers/setup');

let ctx;
const MSG_ID = `wamid.TEST_0D3_${Date.now()}`;

before(async () => { ctx = await createIsolatedTenant('test-idem'); });
after(async () => { await cleanupTenant(ctx.tenantId); await closeAll(); });

// Mismo dedup que webhook/router.js::dedupInbound -> true si es nuevo.
async function dedupInbound(tenantId, externalMessageId) {
  const { rows } = await pool.query(
    `INSERT INTO inbound_messages (tenant_id, external_message_id, channel, raw_payload, normalized_text)
     VALUES ($1,$2,'whatsapp_text',$3,$4)
     ON CONFLICT (tenant_id, external_message_id) DO NOTHING
     RETURNING id`,
    [tenantId, externalMessageId, JSON.stringify({ id: externalMessageId }), 'hola']
  );
  return rows.length > 0;
}

test('mismo message_id 3 veces -> 1 registro, 1 acción', async () => {
  const r1 = await dedupInbound(ctx.tenantId, MSG_ID);
  const r2 = await dedupInbound(ctx.tenantId, MSG_ID);
  const r3 = await dedupInbound(ctx.tenantId, MSG_ID);

  assert.strictEqual(r1, true, 'el 1er mensaje debe procesarse (nuevo)');
  assert.strictEqual(r2, false, 'el 2do debe descartarse');
  assert.strictEqual(r3, false, 'el 3ro debe descartarse');

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM inbound_messages WHERE tenant_id=$1 AND external_message_id=$2`,
    [ctx.tenantId, MSG_ID]
  );
  assert.strictEqual(rows[0].n, 1, 'debe existir exactamente 1 registro en inbound_messages');
});

test('mensajes con distinto message_id sí se procesan', async () => {
  const a = await dedupInbound(ctx.tenantId, `${MSG_ID}_A`);
  const b = await dedupInbound(ctx.tenantId, `${MSG_ID}_B`);
  assert.strictEqual(a, true);
  assert.strictEqual(b, true);
});
