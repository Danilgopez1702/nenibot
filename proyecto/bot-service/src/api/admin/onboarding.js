// api/admin/onboarding.js — Estado del onboarding por tenant.
const express = require('express');
const { query } = require('../../db/index');

const router = express.Router();

router.get('/', async (_req, res) => {
  const { rows } = await query(
    `SELECT o.tenant_id, t.business_name, o.status, o.current_block, o.current_step, o.updated_at
       FROM onboarding_sessions o
       JOIN tenants t ON t.id = o.tenant_id
      WHERE t.deleted_at IS NULL
      ORDER BY o.updated_at DESC`
  );
  res.json(rows);
});

router.get('/:tenantId', async (req, res) => {
  const { rows } = await query(`SELECT * FROM onboarding_sessions WHERE tenant_id = $1`, [req.params.tenantId]);
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

module.exports = router;
