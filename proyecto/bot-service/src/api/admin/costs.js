// api/admin/costs.js — Costos por tenant (ai_usage_log + Meta).
const express = require('express');
const { query } = require('../../db/index');

const router = express.Router();

// Resumen mensual de todos los tenants
router.get('/', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM v_monthly_cost_per_tenant ORDER BY month DESC, ai_cost_usd DESC`);
  res.json(rows);
});

// Detalle por tenant: uso por route
router.get('/:tenantId', async (req, res) => {
  const { rows } = await query(
    `SELECT route, COUNT(*) AS calls, SUM(input_tokens) AS input_tokens,
            SUM(output_tokens) AS output_tokens, SUM(cost_usd) AS cost_usd,
            AVG(latency_ms)::int AS avg_latency_ms,
            COUNT(*) FILTER (WHERE NOT success) AS errors
       FROM ai_usage_log
      WHERE tenant_id = $1 AND date_trunc('month', created_at) = date_trunc('month', NOW())
      GROUP BY route ORDER BY cost_usd DESC`,
    [req.params.tenantId]
  );
  res.json(rows);
});

module.exports = router;
