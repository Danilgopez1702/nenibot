// src/index.js — Punto de entrada del bot-service.
require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger');

const webhookRouter = require('./webhook/router');
const internalRouter = require('./api/internal/router');
const adminRouter = require('./api/admin/router');
const clientRouter = require('./api/client/router');

const app = express();

// Captura rawBody (necesario para verificar la firma HMAC del webhook de Meta)
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
  limit: '2mb',
}));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'bot-service', ts: new Date().toISOString() }));

// Rutas
app.use('/webhook', webhookRouter);   // Meta envía aquí
app.use('/internal', internalRouter); // n8n -> bot-service (solo red Docker `app`)
app.use('/api/admin', adminRouter);   // Panel operador
app.use('/api/client', clientRouter); // Panel cliente

// 404
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler
app.use((err, _req, res, _next) => {
  logger.error('Error no controlado', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'internal_error' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => logger.info(`bot-service escuchando en :${PORT}`));

// Shutdown graceful
function shutdown(signal) {
  logger.info(`Recibido ${signal}, cerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
