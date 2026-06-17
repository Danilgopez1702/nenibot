// api/client/config.js — Servicios (CRUD), empleadas, horarios.
const express = require('express');
const { query } = require('../../db/index');
const { invalidateTenant } = require('../../redis/index');

const router = express.Router();

async function invalidate(tenantId) {
  const { rows } = await query(`SELECT wa_phone_id FROM tenants WHERE id = $1`, [tenantId]);
  if (rows[0]?.wa_phone_id) await invalidateTenant(rows[0].wa_phone_id);
}

// ---- Servicios ----
router.get('/services', async (req, res) => {
  const { rows } = await query(`SELECT * FROM services WHERE tenant_id = $1 ORDER BY sort_order, name`, [req.tenantId]);
  res.json(rows);
});
router.post('/services', async (req, res) => {
  const { name, duration_min, price } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const { rows } = await query(
    `INSERT INTO services (tenant_id, name, duration_min, price) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.tenantId, name, duration_min || 30, price || 0]
  );
  res.json(rows[0]);
});
router.put('/services/:id', async (req, res) => {
  const { name, duration_min, price, active } = req.body || {};
  const { rows } = await query(
    `UPDATE services SET name = COALESCE($3,name), duration_min = COALESCE($4,duration_min),
            price = COALESCE($5,price), active = COALESCE($6,active), updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [req.tenantId, req.params.id, name, duration_min, price, active]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});
router.delete('/services/:id', async (req, res) => {
  await query(`UPDATE services SET active = FALSE WHERE tenant_id = $1 AND id = $2`, [req.tenantId, req.params.id]);
  res.json({ ok: true });
});

// ---- Empleadas ----
router.get('/employees', async (req, res) => {
  const { rows } = await query(`SELECT * FROM employees WHERE tenant_id = $1 ORDER BY name`, [req.tenantId]);
  res.json(rows);
});
router.put('/employees/:id', async (req, res) => {
  const { name, active } = req.body || {};
  const { rows } = await query(
    `UPDATE employees SET name = COALESCE($3,name), active = COALESCE($4,active), updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [req.tenantId, req.params.id, name, active]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

// ---- Horarios ----
router.get('/hours', async (req, res) => {
  const { rows } = await query(`SELECT * FROM working_hours WHERE tenant_id = $1 ORDER BY weekday`, [req.tenantId]);
  res.json(rows);
});
router.put('/hours/:weekday', async (req, res) => {
  const { is_open, open_time, close_time, break_start, break_end } = req.body || {};
  const { rows } = await query(
    `INSERT INTO working_hours (tenant_id, weekday, is_open, open_time, close_time, break_start, break_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (tenant_id, weekday)
     DO UPDATE SET is_open = EXCLUDED.is_open, open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time,
                   break_start = EXCLUDED.break_start, break_end = EXCLUDED.break_end
     RETURNING *`,
    [req.tenantId, parseInt(req.params.weekday, 10), is_open, open_time, close_time, break_start, break_end]
  );
  await invalidate(req.tenantId);
  res.json(rows[0]);
});

module.exports = router;
