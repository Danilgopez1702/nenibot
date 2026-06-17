// api/client/stats.js — Métricas del mes para el panel cliente.
const express = require('express');
const { query } = require('../../db/index');

const router = express.Router();

router.get('/', async (req, res) => {
  const t = req.tenantId;
  const [kpis, topEmployee, topService, byDay] = await Promise.all([
    query(
      `SELECT COUNT(*) FILTER (WHERE status='confirmed') AS confirmed,
              COUNT(*) FILTER (WHERE status='completed') AS completed,
              COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
              COUNT(*) FILTER (WHERE status='noshow') AS noshows,
              COALESCE(SUM(service_price_snapshot) FILTER (WHERE status='completed'),0) AS revenue
         FROM appointments
        WHERE tenant_id = $1 AND date_trunc('month', starts_at) = date_trunc('month', NOW())`,
      [t]
    ),
    query(
      `SELECT employee_name_snapshot AS name, COUNT(*) AS total
         FROM appointments
        WHERE tenant_id = $1 AND status='completed'
          AND date_trunc('month', starts_at) = date_trunc('month', NOW())
        GROUP BY employee_name_snapshot ORDER BY total DESC LIMIT 1`,
      [t]
    ),
    query(
      `SELECT service_name_snapshot AS name, COUNT(*) AS total
         FROM appointments
        WHERE tenant_id = $1 AND status='completed'
          AND date_trunc('month', starts_at) = date_trunc('month', NOW())
        GROUP BY service_name_snapshot ORDER BY total DESC LIMIT 1`,
      [t]
    ),
    query(
      `SELECT EXTRACT(DAY FROM starts_at)::int AS day, COUNT(*) AS total,
              COALESCE(SUM(service_price_snapshot) FILTER (WHERE status='completed'),0) AS revenue
         FROM appointments
        WHERE tenant_id = $1 AND date_trunc('month', starts_at) = date_trunc('month', NOW())
        GROUP BY EXTRACT(DAY FROM starts_at) ORDER BY day`,
      [t]
    ),
  ]);
  res.json({
    kpis: kpis.rows[0],
    top_employee: topEmployee.rows[0] || null,
    top_service: topService.rows[0] || null,
    by_day: byDay.rows,
  });
});

module.exports = router;
