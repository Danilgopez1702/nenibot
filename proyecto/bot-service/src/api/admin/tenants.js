// api/admin/tenants.js — CRUD de tenants (soft delete).
const express = require('express');
const { query } = require('../../db/index');

const router = express.Router();

// Lista de tenants
router.get('/', async (_req, res) => {
  const { rows } = await query(
    `SELECT t.id, t.slug, t.business_name, t.business_type, t.wa_phone_id, t.active, t.created_at,
            ti.provisioning_state
       FROM tenants t
       LEFT JOIN tenant_integrations ti ON ti.tenant_id = t.id AND ti.provider = 'meta'
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC`
  );
  res.json(rows);
});

// Detalle completo de un tenant
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const tenant = await query(`SELECT * FROM tenants WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!tenant.rows[0]) return res.status(404).json({ error: 'not_found' });
  const [config, features, services, employees, templates] = await Promise.all([
    query(`SELECT * FROM tenant_config WHERE tenant_id = $1`, [id]),
    query(`SELECT * FROM tenant_features WHERE tenant_id = $1`, [id]),
    query(`SELECT * FROM services WHERE tenant_id = $1 ORDER BY sort_order`, [id]),
    query(`SELECT * FROM employees WHERE tenant_id = $1 ORDER BY name`, [id]),
    query(`SELECT * FROM bot_instruction_templates WHERE tenant_id = $1 ORDER BY template_key`, [id]),
  ]);
  res.json({
    tenant: tenant.rows[0], config: config.rows[0], features: features.rows[0],
    services: services.rows, employees: employees.rows, templates: templates.rows,
  });
});

// Activar/desactivar
router.patch('/:id/active', async (req, res) => {
  const { active } = req.body || {};
  const { rows } = await query(
    `UPDATE tenants SET active = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id, active`,
    [req.params.id, !!active]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

// Soft delete
router.delete('/:id', async (req, res) => {
  const { rows } = await query(
    `UPDATE tenants SET active = FALSE, deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json({ deleted: true });
});

module.exports = router;
