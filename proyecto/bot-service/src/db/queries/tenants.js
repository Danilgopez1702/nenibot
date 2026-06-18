// db/queries/tenants.js
const { query } = require('../index');
const { decrypt } = require('../../utils/crypto');

// Construye el objeto tenant consolidado (tenant + config + features) desde una fila.
function buildTenant(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    business_name: row.business_name,
    business_type: row.business_type,
    wa_phone_id: row.wa_phone_id,
    wa_phone_number: row.wa_phone_number,
    active: row.active,
    config: {
      timezone: row.timezone,
      language: row.language,
      currency: row.currency,
      bot_name: row.bot_name,
      bot_tone: row.bot_tone,
      emoji_level: row.emoji_level,
      slot_granularity_min: row.slot_granularity_min,
      cancel_min_hours: row.cancel_min_hours,
      noshow_margin_min: row.noshow_margin_min,
      noshow_threshold: row.noshow_threshold,
      reminder_24h: row.reminder_24h,
      reminder_2h: row.reminder_2h,
      waitlist_enabled: row.waitlist_enabled,
      panel_password_hash: row.panel_password_hash,
    },
    features: {
      multi_employee: row.multi_employee,
      waitlist: row.feat_waitlist,
      reminders: row.reminders,
      noshow_tracking: row.noshow_tracking,
      audio_messages: row.audio_messages,
      payments: row.payments,
    },
  };
}

const BASE_SELECT = `
  SELECT t.*, c.timezone, c.language, c.currency, c.bot_name, c.bot_tone, c.emoji_level,
         c.slot_granularity_min, c.cancel_min_hours, c.noshow_margin_min, c.noshow_threshold,
         c.reminder_24h, c.reminder_2h, c.waitlist_enabled, c.panel_password_hash,
         f.multi_employee, f.waitlist AS feat_waitlist, f.reminders, f.noshow_tracking,
         f.audio_messages, f.payments
  FROM tenants t
  JOIN tenant_config c ON c.tenant_id = t.id
  JOIN tenant_features f ON f.tenant_id = t.id
`;

// Flujo normal: solo tenants activos y no borrados.
async function getTenantByPhoneId(phoneId) {
  const { rows } = await query(
    `SELECT t.*, c.timezone, c.language, c.currency, c.bot_name, c.bot_tone, c.emoji_level,
            c.slot_granularity_min, c.cancel_min_hours, c.noshow_margin_min, c.noshow_threshold,
            c.reminder_24h, c.reminder_2h, c.waitlist_enabled, c.panel_password_hash,
            f.multi_employee, f.waitlist AS feat_waitlist, f.reminders, f.noshow_tracking,
            f.audio_messages, f.payments, ti.wa_phone_id
       FROM tenant_integrations ti
       JOIN tenants t ON t.id = ti.tenant_id
       JOIN tenant_config c ON c.tenant_id = t.id
       JOIN tenant_features f ON f.tenant_id = t.id
      WHERE ti.provider = 'meta' AND ti.wa_phone_id = $1 AND t.active = TRUE AND t.deleted_at IS NULL
      LIMIT 1`,
    [phoneId]
  );
  return buildTenant(rows[0]);
}

// Fase 0A.3: lookup para onboarding — NO filtra active=TRUE.
// Se usa cuando hay onboarding en curso (tenant.active = FALSE).
async function getTenantByPhoneIdForOnboarding(phoneId) {
  const { rows } = await query(
    `SELECT t.*, c.timezone, c.language, c.currency, c.bot_name, c.bot_tone, c.emoji_level,
            c.slot_granularity_min, c.cancel_min_hours, c.noshow_margin_min, c.noshow_threshold,
            c.reminder_24h, c.reminder_2h, c.waitlist_enabled, c.panel_password_hash,
            f.multi_employee, f.waitlist AS feat_waitlist, f.reminders, f.noshow_tracking,
            f.audio_messages, f.payments, ti.wa_phone_id
       FROM tenant_integrations ti
       JOIN tenants t ON t.id = ti.tenant_id
       JOIN tenant_config c ON c.tenant_id = t.id
       JOIN tenant_features f ON f.tenant_id = t.id
      WHERE ti.provider = 'meta' AND ti.wa_phone_id = $1 AND t.deleted_at IS NULL
      LIMIT 1`,
    [phoneId]
  );
  return buildTenant(rows[0]);
}

async function getTenantById(id) {
  const { rows } = await query(`${BASE_SELECT} WHERE t.id = $1 LIMIT 1`, [id]);
  return buildTenant(rows[0]);
}

// Fase 0A.4: integración (wa_token cifrado) desde tenant_integrations.
// Devuelve { wa_phone_id, wa_token } con el token descifrado, listo para enviar.
async function getActiveIntegration(tenantId) {
  const { rows } = await query(
    `SELECT wa_phone_id, wa_token_encrypted FROM tenant_integrations
     WHERE tenant_id = $1 AND provider = 'meta' LIMIT 1`,
    [tenantId]
  );
  if (!rows[0]) return null;
  return {
    wa_phone_id: rows[0].wa_phone_id,
    wa_token: decrypt(rows[0].wa_token_encrypted),
  };
}

module.exports = {
  getTenantByPhoneId,
  getTenantByPhoneIdForOnboarding,
  getTenantById,
  getActiveIntegration,
  buildTenant,
};
