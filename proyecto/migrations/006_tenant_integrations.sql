-- 006_tenant_integrations.sql — Fase 0A
-- Mueve el wa_token fuera de tenants y lo guarda cifrado (AES-256-GCM).
-- Estados: draft -> db_created -> meta_configured -> onboarding_sent
--          -> business_configured -> active -> failed
BEGIN;

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL DEFAULT 'meta',
  wa_phone_id         TEXT,
  wa_token_encrypted  TEXT,
  webhook_subscribed  BOOLEAN DEFAULT FALSE,
  provisioning_state  TEXT NOT NULL DEFAULT 'draft',
  last_error          TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_phone ON tenant_integrations(wa_phone_id);

DROP TRIGGER IF EXISTS trg_tenant_integrations_updated ON tenant_integrations;
CREATE TRIGGER trg_tenant_integrations_updated BEFORE UPDATE ON tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
