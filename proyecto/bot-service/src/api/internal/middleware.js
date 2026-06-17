// api/internal/middleware.js — Auth de la API interna (n8n -> bot-service).
function requireInternal(req, res, next) {
  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
module.exports = { requireInternal };
