-- 002_inbound_messages.sql — Fase 0A
-- Deduplicación de webhooks de Meta (idempotencia del webhook).
BEGIN;

CREATE TABLE IF NOT EXISTS inbound_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_message_id TEXT NOT NULL,
  channel             TEXT NOT NULL DEFAULT 'whatsapp_text',
  raw_payload         JSONB NOT NULL,
  normalized_text     TEXT,
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, external_message_id)
);
CREATE INDEX IF NOT EXISTS idx_inbound_tenant ON inbound_messages(tenant_id, created_at);

COMMIT;
