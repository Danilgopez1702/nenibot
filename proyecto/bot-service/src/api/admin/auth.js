// api/admin/auth.js — Login del operador + rate limiting (Fase 0A.5).
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts', message: 'Demasiados intentos. Espera 15 minutos.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = jwt.sign({ role: 'operator' }, process.env.ADMIN_JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, role: 'operator' });
});

module.exports = router;
