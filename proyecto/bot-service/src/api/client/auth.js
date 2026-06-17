// api/client/auth.js — Login del panel cliente (phone_number_id + password).
// bcrypt · contraseña inicial + cambio forzado · rate limiting (Fase 0A.5).
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { query } = require('../../db/index');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts', message: 'Demasiados intentos. Espera 15 minutos.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { phone_number_id, password } = req.body || {};
  if (!phone_number_id || !password) return res.status(400).json({ error: 'missing_fields' });

  const { rows } = await query(
    `SELECT t.id, t.business_name, tc.panel_password_hash
       FROM tenants t JOIN tenant_config tc ON tc.tenant_id = t.id
      WHERE t.wa_phone_id = $1 AND t.deleted_at IS NULL LIMIT 1`,
    [phone_number_id]
  );
  const row = rows[0];
  if (!row || !row.panel_password_hash) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, row.panel_password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = jwt.sign(
    { role: 'client', tenant_id: row.id }, process.env.CLIENT_JWT_SECRET, { expiresIn: '12h' }
  );
  res.json({ token, role: 'client', tenant_id: row.id, business_name: row.business_name });
});

// Cambio de contraseña (requiere conocer la actual)
router.post('/change-password', async (req, res) => {
  const auth = req.headers.authorization || '';
  const tk = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!tk) return res.status(401).json({ error: 'unauthorized' });
  let tenantId;
  try { tenantId = jwt.verify(tk, process.env.CLIENT_JWT_SECRET).tenant_id; }
  catch { return res.status(401).json({ error: 'invalid_token' }); }

  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'weak_password' });

  const { rows } = await query(`SELECT panel_password_hash FROM tenant_config WHERE tenant_id = $1`, [tenantId]);
  const ok = await bcrypt.compare(current_password || '', rows[0]?.panel_password_hash || '');
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const hash = await bcrypt.hash(new_password, 10);
  await query(`UPDATE tenant_config SET panel_password_hash = $2 WHERE tenant_id = $1`, [tenantId, hash]);
  res.json({ ok: true });
});

module.exports = router;
