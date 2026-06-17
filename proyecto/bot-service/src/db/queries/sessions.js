// db/queries/sessions.js — conversación, logging de IA, conversaciones WA.
const { query } = require('../index');

// Carga la sesión (estado + context + history) o crea una vacía (idle).
async function getOrCreateSession(tenantId, phone) {
  const { rows } = await query(
    `INSERT INTO conversation_sessions (tenant_id, client_phone)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id, client_phone)
     DO UPDATE SET last_active = NOW()
     RETURNING *`,
    [tenantId, phone]
  );
  return rows[0];
}

async function saveSession(tenantId, phone, { state, context, history }) {
  await query(
    `UPDATE conversation_sessions
        SET state = $3, context = $4, history = $5, last_active = NOW(), updated_at = NOW()
      WHERE tenant_id = $1 AND client_phone = $2`,
    [tenantId, phone, state, JSON.stringify(context || {}), JSON.stringify(history || [])]
  );
}

async function resetSession(tenantId, phone) {
  await query(
    `UPDATE conversation_sessions
        SET state = 'idle', context = '{}'::jsonb, updated_at = NOW()
      WHERE tenant_id = $1 AND client_phone = $2`,
    [tenantId, phone]
  );
}

// Fase 0A: registra uso de IA en ai_usage_log (route-aware).
async function logAiUsage({ tenantId, model, route, inputTokens, outputTokens, costUsd, latencyMs, success = true, errorCode = null, conversationId = null }) {
  await query(
    `INSERT INTO ai_usage_log
       (tenant_id, provider, model, route, input_tokens, output_tokens, cost_usd, latency_ms, success, error_code, conversation_id)
     VALUES ($1,'anthropic',$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [tenantId, model, route, inputTokens, outputTokens, costUsd, latencyMs, success, errorCode, conversationId]
  );
}

// Registra/actualiza ventana de conversación de WhatsApp (costos Meta).
async function upsertWhatsAppConversation(tenantId, phone) {
  await query(
    `INSERT INTO whatsapp_conversation_log (tenant_id, client_phone, conversation_type, started_at, expires_at)
     VALUES ($1, $2, 'service', NOW(), NOW() + INTERVAL '24 hours')
     ON CONFLICT DO NOTHING`,
    [tenantId, phone]
  );
}

module.exports = {
  getOrCreateSession, saveSession, resetSession,
  logAiUsage, upsertWhatsAppConversation,
};
