// db/queries/outbound.js — Outbox pattern (migración 003).
const { query } = require('../index');

// Inserta un mensaje saliente con idempotency_key. Si ya existe, devuelve null (no re-enviar).
async function enqueue({ tenantId, clientPhone, messageText, idempotencyKey, appointmentId = null }) {
  const { rows } = await query(
    `INSERT INTO outbound_messages (tenant_id, client_phone, message_text, idempotency_key, appointment_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [tenantId, clientPhone, messageText, idempotencyKey, appointmentId]
  );
  return rows[0] || null;
}

async function markSent(id) {
  await query(
    `UPDATE outbound_messages SET status='sent', sent_at=NOW(), attempts=attempts+1, last_attempt_at=NOW() WHERE id=$1`,
    [id]
  );
}

async function markFailed(id, error) {
  await query(
    `UPDATE outbound_messages SET status='failed', attempts=attempts+1, last_attempt_at=NOW(), error_detail=$2 WHERE id=$1`,
    [id, error]
  );
}

module.exports = { enqueue, markSent, markFailed };
