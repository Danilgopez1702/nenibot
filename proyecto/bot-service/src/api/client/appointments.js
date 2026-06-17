// api/client/appointments.js — Agenda del negocio (aislada por tenant).
const express = require('express');
const { query } = require('../../db/index');
const { getTenantById } = require('../../db/queries/tenants');
const { tenantDayBoundsUtc, todayInTenantTz } = require('../../utils/timezone');

const router = express.Router();

// GET /?date=YYYY-MM-DD  (o today por defecto) | ?from&to para semana
router.get('/', async (req, res) => {
  const tenant = await getTenantById(req.tenantId);
  const tz = tenant.config.timezone;
  const { date, from, to, employee_id, status } = req.query;

  let startUtc, endUtc;
  if (from && to) {
    startUtc = tenantDayBoundsUtc(from, tz).startUtc;
    endUtc = tenantDayBoundsUtc(to, tz).endUtc;
  } else {
    const d = date || todayInTenantTz(tz);
    ({ startUtc, endUtc } = tenantDayBoundsUtc(d, tz));
  }

  const params = [req.tenantId, startUtc.toISOString(), endUtc.toISOString()];
  let where = `a.tenant_id = $1 AND a.starts_at >= $2 AND a.starts_at < $3`;
  if (employee_id) { params.push(employee_id); where += ` AND a.employee_id = $${params.length}`; }
  if (status) { params.push(status); where += ` AND a.status = $${params.length}`; }

  const { rows } = await query(
    `SELECT a.*, c.name AS client_name, c.phone AS client_phone
       FROM appointments a JOIN clients c ON c.id = a.client_id
      WHERE ${where} ORDER BY a.starts_at ASC`,
    params
  );
  res.json(rows);
});

// Cambiar estado de una cita (completar / cancelar)
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['completed', 'cancelled', 'noshow', 'confirmed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid_status' });
  const { rows } = await query(
    `UPDATE appointments SET status = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [req.tenantId, req.params.id, status]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

module.exports = router;
