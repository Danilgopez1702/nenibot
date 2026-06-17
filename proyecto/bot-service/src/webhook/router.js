// webhook/router.js — Receptor de webhook de Meta.
// GET: verificación challenge. POST: 200 inmediato + procesamiento async.
const express = require('express');
const { verifySignature, verifyChallenge } = require('./verifier');
const { parseMetaPayload } = require('./parser');
const { createWhatsAppTextAdapter } = require('../types/normalizedMessage');
const { getTenantByPhoneIdForOnboarding, getActiveIntegration } = require('../db/queries/tenants');
const { findOrCreateClient, isBlocked } = require('../db/queries/clients');
const { upsertWhatsAppConversation } = require('../db/queries/sessions');
const { handleMessage } = require('../bot/handler');
const onboarding = require('../bot/onboarding/handler');
const { sendTextMessage, markAsRead } = require('../whatsapp/sender');
const { enqueue, markSent, markFailed } = require('../db/queries/outbound');
const { cacheTenant, getCachedTenant, acquireLock, releaseLock } = require('../redis/index');
const { query } = require('../db/index');
const { compose } = require('../bot/messenger');
const logger = require('../utils/logger');

const router = express.Router();

// GET /webhook — verificación
router.get('/', (req, res) => {
  const challenge = verifyChallenge(req.query);
  if (challenge) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// POST /webhook — recepción
router.post('/', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!verifySignature(req.rawBody, signature)) {
    logger.warn('Firma de webhook inválida');
    return res.sendStatus(401);
  }
  // 200 inmediato; procesar async
  res.sendStatus(200);
  processPayload(req.body).catch((err) =>
    logger.error('processPayload error', { error: err.message, stack: err.stack })
  );
});

async function loadTenant(phoneId) {
  const cached = await getCachedTenant(phoneId);
  if (cached) return cached;
  const tenant = await getTenantByPhoneIdForOnboarding(phoneId);
  if (tenant) await cacheTenant(phoneId, tenant);
  return tenant;
}

// Deduplicación: inserta en inbound_messages. Devuelve true si es nuevo.
async function dedupInbound(tenantId, msg, channel) {
  const { rows } = await query(
    `INSERT INTO inbound_messages (tenant_id, external_message_id, channel, raw_payload, normalized_text)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id, external_message_id) DO NOTHING
     RETURNING id`,
    [tenantId, msg.externalMessageId, channel, JSON.stringify(msg.raw || {}), msg.text || null]
  );
  return rows.length > 0;
}

async function processPayload(body) {
  const messages = parseMetaPayload(body);
  for (const msg of messages) {
    if (msg.type !== 'text' || !msg.text) continue; // Fase 1: solo texto

    const tenant = await loadTenant(msg.phoneId);
    if (!tenant) { logger.warn('Webhook sin tenant', { phoneId: msg.phoneId }); continue; }

    const isNew = await dedupInbound(tenant.id, msg, 'whatsapp_text');
    if (!isNew) { logger.info('Mensaje duplicado descartado', { id: msg.externalMessageId }); continue; }

    await upsertWhatsAppConversation(tenant.id, msg.from);
    await findOrCreateClient(tenant.id, msg.from, msg.contactName);

    if (await isBlocked(tenant.id, msg.from)) {
      logger.info('Cliente bloqueado, ignorado', { phone: msg.from });
      continue;
    }

    const lockKey = `${tenant.id}:${msg.from}`;
    const token = await acquireLock(lockKey);
    if (!token) { logger.info('Lock ocupado, se procesará luego', { lockKey }); continue; }

    try {
      const integration = await getActiveIntegration(tenant.id);
      if (integration) await markAsRead(integration, msg.externalMessageId);

      let replyText;
      if (tenant.active) {
        const normalized = createWhatsAppTextAdapter(msg, tenant);
        replyText = await handleMessage(tenant, normalized);
      } else {
        replyText = await onboarding.handle(tenant, msg);
      }

      if (replyText && integration) {
        const idemKey = `${tenant.id}:${msg.from}:reply:${msg.externalMessageId}`;
        const out = await enqueue({
          tenantId: tenant.id, clientPhone: msg.from, messageText: replyText, idempotencyKey: idemKey,
        });
        if (out) {
          const sent = await sendTextMessage(integration, msg.from, replyText);
          if (sent.ok) await markSent(out.id);
          else await markFailed(out.id, sent.error);
        }
      }
    } finally {
      await releaseLock(lockKey, token);
    }
  }
}

module.exports = router;
