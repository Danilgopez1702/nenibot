// api/internal/noshow.js — Detección de no-shows + notificación a waitlist.
const { query } = require('../../db/index');
const { getTenantById } = require('../../db/queries/tenants');
const { registerNoShow } = require('../../db/queries/clients');
const { notifyWaitlistCandidate } = require('../../bot/notifyWaitlist');
const logger = require('../../utils/logger');

async function detectNoShows() {
  // Citas confirmadas cuya hora + margen ya pasó y no fueron marcadas
  const { rows } = await query(
    `SELECT a.id, a.tenant_id, a.client_id, a.employee_id, a.starts_at
       FROM appointments a
       JOIN tenant_config tc ON tc.tenant_id = a.tenant_id
      WHERE a.status = 'confirmed'
        AND a.starts_at + (tc.noshow_margin_min || ' minutes')::interval < NOW()`
  );

  let marked = 0;
  for (const r of rows) {
    const tenant = await getTenantById(r.tenant_id);
    if (!tenant) continue;

    await query(`UPDATE appointments SET status = 'noshow', updated_at = NOW() WHERE id = $1`, [r.id]);
    await registerNoShow(tenant.id, r.client_id, tenant.config.noshow_threshold);
    marked += 1;

    // Liberar slot -> notificar waitlist
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tenant.config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(r.starts_at));
    notifyWaitlistCandidate(tenant, { employeeId: r.employee_id, startsAt: r.starts_at, dateStr }).catch(() => {});
  }
  logger.info('No-shows procesados', { marked });
  return { marked };
}

module.exports = { detectNoShows };
