-- 003_outbound_messages.sql — Fase 0A
-- Outbox pattern: garantiza que un mensaje enviado corresponde a una acción.
BEGIN;

CREATE TABLE IF NOT EXISTS outbound_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_phone    TEXT NOT NULL,
  message_text    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  attempts        INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  error_detail    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outbound_status ON outbound_messages(status, created_at);
CREATE INDEX IF NOT EXISTS idx_outbound_tenant ON outbound_messages(tenant_id, created_at);

COMMIT;
