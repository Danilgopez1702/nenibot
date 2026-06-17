// db/queries/clients.js
const { query } = require('../index');

// Upsert de cliente por (tenant, phone). Devuelve la fila.
async function findOrCreateClient(tenantId, phone, name = null) {
  const { rows } = await query(
    `INSERT INTO clients (tenant_id, phone, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, phone)
     DO UPDATE SET name = COALESCE(clients.name, EXCLUDED.name), updated_at = NOW()
     RETURNING *`,
    [tenantId, phone, name]
  );
  return rows[0];
}

async function isBlocked(tenantId, phone) {
  const { rows } = await query(
    `SELECT blocked FROM clients WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,
    [tenantId, phone]
  );
  return rows[0]?.blocked === true;
}

async function registerNoShow(tenantId, clientId, threshold) {
  const { rows } = await query(
    `UPDATE clients
        SET noshow_count = noshow_count + 1,
            blocked = (noshow_count + 1) >= $3,
            updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING noshow_count, blocked`,
    [tenantId, clientId, threshold]
  );
  return rows[0];
}

module.exports = { findOrCreateClient, isBlocked, registerNoShow };
