// api/internal/reminders.js — Recordatorios 24h y 2h.
const { query } = require('../../db/index');
const { getTenantById, getActiveIntegration } = require('../../db/queries/tenants');
const { sendTextMessage } = require('../../whatsapp/sender');
const { compose } = require('../../bot/messenger');
const { formatInTenantTz } = require('../../utils/timezone');
const logger = require('../../utils/logger');

// type: 'reminder_24h' (ventana 23-25h) | 'reminder_2h' (110-130min)
async function sendReminders(type) {
  const isr24 = type === 'reminder_24h';
  const lower = isr24 ? "INTERVAL '23 hours'" : "INTERVAL '110 minutes'";
  const upper = isr24 ? "INTERVAL '25 hours'" : "INTERVAL '130 minutes'";

  const { rows } = await query(
    `SELECT a.id, a.tenant_id, a.starts_at, a.employee_name_snapshot, a.service_name_snapshot,
            c.phone
       FROM appointments a
       JOIN clients c ON c.id = a.client_id
      WHERE a.status = 'confirmed'
        AND a.starts_at BETWEEN NOW() + ${lower} AND NOW() + ${upper}
        AND NOT EXISTS (
          SELECT 1 FROM notification_log n
           WHERE n.appointment_id = a.id AND n.type = $1 AND n.status = 'sent'
        )`,
    [type]
  );

  let sent = 0;
  for (const r of rows) {
    const tenant = await getTenantById(r.tenant_id);
    if (!tenant) continue;
    const integration = await getActiveIntegration(tenant.id);
    if (!integration) continue;

    const when = formatInTenantTz(new Date(r.starts_at), tenant.config.timezone);
    const tmplKey = isr24 ? 'reminder_24h' : 'reminder_2h';
    const text = await compose(tenant, tmplKey, { when, service: r.service_name_snapshot || '' },
      isr24 ? `Te recordamos tu cita mañana ${when}. ¡Te esperamos! 😊`
            : `Tu cita es hoy ${when}. ¡Nos vemos pronto! 😊`);

    const res = await sendTextMessage(integration, r.phone, text);
    await query(
      `INSERT INTO notification_log (tenant_id, appointment_id, client_phone, type, status, sent_at, error_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenant.id, r.id, r.phone, type, res.ok ? 'sent' : 'failed', res.ok ? new Date() : null, res.ok ? null : res.error]
    );
    if (res.ok) sent += 1;
  }
  logger.info(`Recordatorios ${type} enviados`, { count: sent });
  return { processed: rows.length, sent };
}

module.exports = { sendReminders };
