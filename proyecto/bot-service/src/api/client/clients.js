// api/client/clients.js — Clientes del negocio (paginado, búsqueda, bloqueo).
const express = require('express');
const { query } = require('../../db/index');

const router = express.Router();

router.get('/', async (req, res) => {
  const { search, blocked, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const params = [req.tenantId];
  let where = `tenant_id = $1`;
  if (search) { params.push(`%${search}%`); where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`; }
  if (blocked === 'true') { where += ` AND blocked = TRUE`; }

  const countRes = await query(`SELECT COUNT(*) FROM clients WHERE ${where}`, params);
  params.push(parseInt(limit, 10), offset);
  const { rows } = await query(
    `SELECT * FROM clients WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ total: parseInt(countRes.rows[0].count, 10), page: parseInt(page, 10), clients: rows });
});

// Detalle + últimas 20 citas
router.get('/:id', async (req, res) => {
  const client = await query(`SELECT * FROM clients WHERE tenant_id = $1 AND id = $2`, [req.tenantId, req.params.id]);
  if (!client.rows[0]) return res.status(404).json({ error: 'not_found' });
  const appts = await query(
    `SELECT * FROM appointments WHERE tenant_id = $1 AND client_id = $2 ORDER BY starts_at DESC LIMIT 20`,
    [req.tenantId, req.params.id]
  );
  res.json({ client: client.rows[0], appointments: appts.rows });
});

router.patch('/:id/blocked', async (req, res) => {
  const { blocked } = req.body || {};
  const { rows } = await query(
    `UPDATE clients SET blocked = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2 RETURNING id, blocked`,
    [req.tenantId, req.params.id, !!blocked]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

module.exports = router;
