// api/internal/stats.js — Recalcula stats nocturnos.
const { query } = require('../../db/index');
const logger = require('../../utils/logger');

async function recalcStats() {
  // employee_monthly_stats (mes actual)
  await query(`
    INSERT INTO employee_monthly_stats (tenant_id, employee_id, year, month, appointments, completed, cancelled, noshows, revenue)
    SELECT a.tenant_id, a.employee_id,
           EXTRACT(YEAR FROM a.starts_at)::int, EXTRACT(MONTH FROM a.starts_at)::int,
           COUNT(*),
           COUNT(*) FILTER (WHERE a.status = 'completed'),
           COUNT(*) FILTER (WHERE a.status = 'cancelled'),
           COUNT(*) FILTER (WHERE a.status = 'noshow'),
           COALESCE(SUM(a.service_price_snapshot) FILTER (WHERE a.status = 'completed'), 0)
      FROM appointments a
     WHERE a.employee_id IS NOT NULL
       AND date_trunc('month', a.starts_at) = date_trunc('month', NOW())
     GROUP BY a.tenant_id, a.employee_id, EXTRACT(YEAR FROM a.starts_at), EXTRACT(MONTH FROM a.starts_at)
    ON CONFLICT (employee_id, year, month)
    DO UPDATE SET appointments = EXCLUDED.appointments, completed = EXCLUDED.completed,
                  cancelled = EXCLUDED.cancelled, noshows = EXCLUDED.noshows,
                  revenue = EXCLUDED.revenue, updated_at = NOW()
  `);

  // revenue_summary (mes actual, por día)
  await query(`
    INSERT INTO revenue_summary (tenant_id, year, month, day, appointments, revenue)
    SELECT a.tenant_id,
           EXTRACT(YEAR FROM a.starts_at)::int, EXTRACT(MONTH FROM a.starts_at)::int, EXTRACT(DAY FROM a.starts_at)::int,
           COUNT(*) FILTER (WHERE a.status = 'completed'),
           COALESCE(SUM(a.service_price_snapshot) FILTER (WHERE a.status = 'completed'), 0)
      FROM appointments a
     WHERE date_trunc('month', a.starts_at) = date_trunc('month', NOW())
     GROUP BY a.tenant_id, EXTRACT(YEAR FROM a.starts_at), EXTRACT(MONTH FROM a.starts_at), EXTRACT(DAY FROM a.starts_at)
    ON CONFLICT (tenant_id, year, month, day)
    DO UPDATE SET appointments = EXCLUDED.appointments, revenue = EXCLUDED.revenue, updated_at = NOW()
  `);

  logger.info('Stats recalculadas');
  return { ok: true };
}

module.exports = { recalcStats };
