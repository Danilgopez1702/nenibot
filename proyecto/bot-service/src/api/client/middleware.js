// api/client/middleware.js — JWT rol cliente. Extrae tenant_id y aísla todo por él.
const jwt = require('jsonwebtoken');

function requireClient(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.CLIENT_JWT_SECRET);
    if (payload.role !== 'client' || !payload.tenant_id) return res.status(403).json({ error: 'forbidden' });
    req.tenantId = payload.tenant_id;
    req.client = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
module.exports = { requireClient };
