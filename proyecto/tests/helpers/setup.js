// tests/helpers/setup.js — utilidades compartidas por la suite Fase 0D.
// Usa un pool propio para preparar/limpiar datos. La lógica bajo prueba se
// importa del CÓDIGO REAL del bot-service (no se reimplementa).
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 15 });

function rnd() { return Math.random().toString(36).slice(2, 8); }

// Crea un tenant aislado, sembrado, con 1 empleada, 1 servicio, 1 cliente y un
// slot futuro listo para reservar. Devuelve los ids + slot.
async function createIsolatedTenant(prefix = 'test-0d') {
  const slug = `${prefix}-${rnd()}`;
  const phoneId = `9${Date.now().toString().slice(-9)}${Math.floor(Math.random() * 9)}`;

  const t = await pool.query(
    `INSERT INTO tenants (slug, business_name, business_type, wa_phone_id, active)
     VALUES ($1,$2,'nails',$3,TRUE) RETURNING id`,
    [slug, `Negocio ${slug}`, phoneId]
  );
  const tenantId = t.rows[0].id;
  await pool.query(`SELECT seed_new_tenant($1)`, [tenantId]);

  const e = await pool.query(`INSERT INTO employees (tenant_id,name) VALUES ($1,'Ana') RETURNING id`, [tenantId]);
  const employeeId = e.rows[0].id;
  const s = await pool.query(
    `INSERT INTO services (tenant_id,name,duration_min,price) VALUES ($1,'Manicure',60,250) RETURNING id`,
    [tenantId]
  );
  const serviceId = s.rows[0].id;
  await pool.query(
    `INSERT INTO employee_services (tenant_id,employee_id,service_id) VALUES ($1,$2,$3)`,
    [tenantId, employeeId, serviceId]
  );
  const c = await pool.query(
    `INSERT INTO clients (tenant_id,phone,name) VALUES ($1,$2,'Cliente') RETURNING id`,
    [tenantId, `+52155${Date.now().toString().slice(-8)}`]
  );
  const clientId = c.rows[0].id;

  // Slot futuro: mañana 18:00 UTC, 60 min
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setUTCHours(18, 0, 0, 0);
  const slotStart = d.toISOString();
  const slotEnd = new Date(d.getTime() + 60 * 60000).toISOString();
  const dateStr = slotStart.slice(0, 10);

  return { tenantId, employeeId, serviceId, clientId, slotStart, slotEnd, dateStr, timezone: 'UTC' };
}

async function cleanupTenant(tenantId) {
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
}

async function countConfirmed(tenantId, employeeId, slotStart) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM appointments
      WHERE tenant_id=$1 AND employee_id=$2 AND starts_at=$3 AND status IN ('locked','confirmed')`,
    [tenantId, employeeId, slotStart]
  );
  return rows[0].n;
}

async function closeAll() {
  await pool.end();
  try { await require('../../bot-service/src/db').pool.end(); } catch { /* noop */ }
}

module.exports = { pool, createIsolatedTenant, cleanupTenant, countConfirmed, closeAll };
