// scripts/lib/db.js — Paso 0C.2
// Pool de PostgreSQL independiente del bot-service. Funciones idempotentes.
const { Pool } = require('pg');
const { encrypt } = require('./crypto');

let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  return pool;
}

async function close() {
  if (pool) await pool.end();
}

// Busca un tenant por wa_phone_id (incluye borrados/inactivos).
async function getTenantByPhoneId(waPhoneId) {
  const { rows } = await getPool().query(
    `SELECT t.id, t.slug, t.business_name, t.active,
            ti.provisioning_state, ti.webhook_subscribed
       FROM tenants t
       LEFT JOIN tenant_integrations ti ON ti.tenant_id = t.id AND ti.provider = 'meta'
      WHERE t.wa_phone_id = $1 LIMIT 1`,
    [waPhoneId]
  );
  return rows[0] || null;
}

// Crea el tenant (active=FALSE). Idempotente por wa_phone_id / slug.
async function createTenant({ slug, businessName, businessType, waPhoneId, waPhoneNumber }) {
  const { rows } = await getPool().query(
    `INSERT INTO tenants (slug, business_name, business_type, wa_phone_id, wa_phone_number, active)
     VALUES ($1,$2,$3,$4,$5,FALSE)
     ON CONFLICT (wa_phone_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING id`,
    [slug, businessName, businessType || 'other', waPhoneId, waPhoneNumber]
  );
  return rows[0].id;
}

// Llama a la función SQL idempotente seed_new_tenant.
async function seedTenant(tenantId) {
  await getPool().query(`SELECT seed_new_tenant($1)`, [tenantId]);
}

// Guarda el hash de la contraseña del panel cliente.
async function setPanelPassword(tenantId, hash) {
  await getPool().query(
    `UPDATE tenant_config SET panel_password_hash = $2, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId, hash]
  );
}

// Crea/actualiza la integración con el wa_token cifrado. Idempotente.
async function createIntegration(tenantId, { waPhoneId, waToken, state = 'draft' }) {
  await getPool().query(
    `INSERT INTO tenant_integrations (tenant_id, provider, wa_phone_id, wa_token_encrypted, provisioning_state)
     VALUES ($1,'meta',$2,$3,$4)
     ON CONFLICT (tenant_id, provider)
     DO UPDATE SET wa_phone_id = EXCLUDED.wa_phone_id,
                   wa_token_encrypted = EXCLUDED.wa_token_encrypted,
                   provisioning_state = EXCLUDED.provisioning_state,
                   updated_at = NOW()`,
    [tenantId, waPhoneId, encrypt(waToken), state]
  );
}

async function updateProvisioningState(tenantId, state, error = null) {
  await getPool().query(
    `UPDATE tenant_integrations
        SET provisioning_state = $2, last_error = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND provider = 'meta'`,
    [tenantId, state, error]
  );
}

async function setWebhookSubscribed(tenantId, subscribed) {
  await getPool().query(
    `UPDATE tenant_integrations SET webhook_subscribed = $2, updated_at = NOW()
      WHERE tenant_id = $1 AND provider = 'meta'`,
    [tenantId, !!subscribed]
  );
}

module.exports = {
  getPool, close, getTenantByPhoneId, createTenant, seedTenant,
  setPanelPassword, createIntegration, updateProvisioningState, setWebhookSubscribed,
};
