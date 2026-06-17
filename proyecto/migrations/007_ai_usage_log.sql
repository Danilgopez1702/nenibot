-- 007_ai_usage_log.sql — Fase 0A
-- Reemplaza claude_usage_log con un log de IA extendido y multi-route.
-- route: intent_detection | date_extraction | message_drafting
--        | complaint_handling | audio_transcription
BEGIN;

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'anthropic',
  model           TEXT NOT NULL,
  route           TEXT NOT NULL,
  input_tokens    INT,
  output_tokens   INT,
  cost_usd        NUMERIC(10,6),
  latency_ms      INT,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  error_code      TEXT,
  conversation_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_route ON ai_usage_log(route);

-- Vista de costos extendida (Claude vía ai_usage_log + Meta conversaciones)
DROP VIEW IF EXISTS v_monthly_cost_per_tenant;
CREATE VIEW v_monthly_cost_per_tenant AS
WITH ai AS (
  SELECT tenant_id, date_trunc('month', created_at) AS month,
         SUM(cost_usd) AS ai_cost_usd,
         SUM(input_tokens) AS total_input_tokens,
         SUM(output_tokens) AS total_output_tokens
  FROM ai_usage_log GROUP BY tenant_id, date_trunc('month', created_at)
),
wa AS (
  SELECT tenant_id, date_trunc('month', started_at) AS month, COUNT(*) AS wa_conversations
  FROM whatsapp_conversation_log GROUP BY tenant_id, date_trunc('month', started_at)
),
months AS (
  SELECT tenant_id, month FROM ai
  UNION
  SELECT tenant_id, month FROM wa
)
SELECT m.tenant_id, t.business_name, m.month,
       COALESCE(a.ai_cost_usd, 0) AS ai_cost_usd,
       COALESCE(a.total_input_tokens, 0) AS total_input_tokens,
       COALESCE(a.total_output_tokens, 0) AS total_output_tokens,
       COALESCE(w.wa_conversations, 0) AS wa_conversations
FROM months m
JOIN tenants t ON t.id = m.tenant_id
LEFT JOIN ai a ON a.tenant_id = m.tenant_id AND a.month = m.month
LEFT JOIN wa w ON w.tenant_id = m.tenant_id AND w.month = m.month;

COMMIT;
