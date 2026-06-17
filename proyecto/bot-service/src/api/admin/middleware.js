// api/admin/middleware.js — JWT rol operador.
const jwt = require('jsonwebtoken');

function requireOperator(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (payload.role !== 'operator') return res.status(403).json({ error: 'forbidden' });
    req.operator = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
module.exports = { requireOperator };
