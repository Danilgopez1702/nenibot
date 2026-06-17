// db/queries/waitlist.js
const { query, withTransaction } = require('../index');

async function addToWaitlist({ tenantId, clientId, serviceId, employeeId, desiredDate }) {
  const { rows } = await query(
    `INSERT INTO waitlist (tenant_id, client_id, service_id, employee_id, desired_date, status)
     VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
    [tenantId, clientId, serviceId, employeeId, desiredDate]
  );
  return rows[0];
}

// Toma el siguiente candidato de waitlist con FOR UPDATE SKIP LOCKED (anti notificación duplicada).
async function getNextWaitlistCandidate(client, tenantId, employeeId, dateStr) {
  const { rows } = await client.query(
    `SELECT * FROM waitlist
      WHERE tenant_id = $1 AND status = 'pending'
        AND (employee_id IS NULL OR employee_id = $2)
        AND (desired_date IS NULL OR desired_date = $3)
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1`,
    [tenantId, employeeId, dateStr]
  );
  return rows[0] || null;
}

async function markNotified(tenantId, waitlistId, offeredSlot, expiresMinutes = 30) {
  const { rows } = await query(
    `UPDATE waitlist
        SET status = 'notified', notified_at = NOW(),
            offered_slot = $3,
            expires_at = NOW() + ($4 || ' minutes')::interval
      WHERE tenant_id = $1 AND id = $2
      RETURNING *`,
    [tenantId, waitlistId, offeredSlot, String(expiresMinutes)]
  );
  return rows[0];
}

async function acceptWaitlist(tenantId, waitlistId) {
  const { rows } = await query(
    `UPDATE waitlist SET status = 'accepted', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'notified'
      RETURNING *`,
    [tenantId, waitlistId]
  );
  return rows[0];
}

async function expireWaitlist() {
  const { rows } = await query(
    `UPDATE waitlist SET status = 'expired', updated_at = NOW()
      WHERE status = 'notified' AND expires_at < NOW()
      RETURNING *`
  );
  return rows;
}

async function getPendingNotified(tenantId, phone) {
  const { rows } = await query(
    `SELECT w.* FROM waitlist w
       JOIN clients c ON c.id = w.client_id
      WHERE w.tenant_id = $1 AND c.phone = $2 AND w.status = 'notified'
      ORDER BY w.notified_at DESC LIMIT 1`,
    [tenantId, phone]
  );
  return rows[0] || null;
}

module.exports = {
  addToWaitlist, getNextWaitlistCandidate, markNotified,
  acceptWaitlist, expireWaitlist, getPendingNotified, withTransaction,
};
