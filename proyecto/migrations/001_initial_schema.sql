-- =====================================================================
-- 001_initial_schema.sql
-- SaaS de Automatización de Citas por WhatsApp — Esquema base (v7)
-- PostgreSQL 15
-- Filosofía: "Configuración como datos". El comportamiento del sistema
-- se lee de la base de datos en tiempo real. El código nunca cambia por
-- cliente nuevo.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE business_type AS ENUM ('nails','barber','clinic','trainer','spa','beauty','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bot_tone AS ENUM ('formal','informal','neutral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE emoji_level AS ENUM ('none','low','moderate','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('locked','confirmed','cancelled','completed','noshow','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE waitlist_status AS ENUM ('pending','notified','accepted','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_status AS ENUM ('not_started','in_progress','completed','abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('reminder_24h','reminder_2h','waitlist_offer','confirmation','cancellation','reschedule','noshow');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('pending','sent','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wa_conversation_type AS ENUM ('service','utility','marketing','authentication');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cancellation_by AS ENUM ('client','business','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE conversation_state AS ENUM (
    'idle','detecting_intent','choosing_service','choosing_employee',
    'choosing_date','choosing_time','confirming_booking','confirming_cancellation',
    'confirming_reschedule','choosing_reschedule_date','choosing_reschedule_time',
    'on_waitlist','awaiting_waitlist_response'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- Trigger genérico updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- MULTI-TENANT
-- =====================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  business_type business_type NOT NULL DEFAULT 'other',
  wa_phone_id   TEXT UNIQUE,                 -- phone_number_id de Meta
  wa_phone_number TEXT,                      -- número visible (+52...)
  wa_token      TEXT,                        -- token Meta (se migra a tenant_integrations en 0A)
  active        BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenants_wa_phone_id ON tenants(wa_phone_id);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(active) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_tenants_updated ON tenants;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS tenant_config (
  tenant_id            UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  timezone             TEXT NOT NULL DEFAULT 'America/Mexico_City',
  language             TEXT NOT NULL DEFAULT 'es-MX',
  currency             TEXT NOT NULL DEFAULT 'MXN',
  bot_name             TEXT NOT NULL DEFAULT 'Asistente',
  bot_tone             bot_tone NOT NULL DEFAULT 'informal',
  emoji_level          emoji_level NOT NULL DEFAULT 'moderate',
  slot_granularity_min INT NOT NULL DEFAULT 30,
  cancel_min_hours     INT NOT NULL DEFAULT 4,
  noshow_margin_min    INT NOT NULL DEFAULT 15,
  noshow_threshold     INT NOT NULL DEFAULT 3,
  reminder_24h         BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_2h          BOOLEAN NOT NULL DEFAULT TRUE,
  waitlist_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  panel_password_hash  TEXT,                 -- bcrypt del panel cliente (Paso 9)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_tenant_config_updated ON tenant_config;
CREATE TRIGGER trg_tenant_config_updated BEFORE UPDATE ON tenant_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS tenant_features (
  tenant_id          UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  multi_employee     BOOLEAN NOT NULL DEFAULT TRUE,
  waitlist           BOOLEAN NOT NULL DEFAULT TRUE,
  reminders          BOOLEAN NOT NULL DEFAULT TRUE,
  noshow_tracking    BOOLEAN NOT NULL DEFAULT TRUE,
  audio_messages     BOOLEAN NOT NULL DEFAULT FALSE,
  payments           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_tenant_features_updated ON tenant_features;
CREATE TRIGGER trg_tenant_features_updated BEFORE UPDATE ON tenant_features
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- ONBOARDING
-- =====================================================================
CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status         onboarding_status NOT NULL DEFAULT 'not_started',
  current_block  INT NOT NULL DEFAULT 1,
  current_step   INT NOT NULL DEFAULT 1,
  collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);
DROP TRIGGER IF EXISTS trg_onboarding_updated ON onboarding_sessions;
CREATE TRIGGER trg_onboarding_updated BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- HORARIOS
-- =====================================================================
-- weekday: 0=domingo ... 6=sábado
CREATE TABLE IF NOT EXISTS working_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weekday     INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_open     BOOLEAN NOT NULL DEFAULT TRUE,
  open_time   TIME,
  close_time  TIME,
  break_start TIME,
  break_end   TIME,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, weekday)
);
CREATE INDEX IF NOT EXISTS idx_working_hours_tenant ON working_hours(tenant_id);

CREATE TABLE IF NOT EXISTS employee_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  weekday     INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_working  BOOLEAN NOT NULL DEFAULT TRUE,
  start_time  TIME,
  end_time    TIME,
  break_start TIME,
  break_end   TIME,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, weekday)
);
CREATE INDEX IF NOT EXISTS idx_emp_sched_tenant ON employee_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emp_sched_emp ON employee_schedules(employee_id);

-- =====================================================================
-- CATÁLOGO
-- =====================================================================
CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  duration_min  INT NOT NULL DEFAULT 30,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id) WHERE active = TRUE;
DROP TRIGGER IF EXISTS trg_services_updated ON services;
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id) WHERE active = TRUE;
DROP TRIGGER IF EXISTS trg_employees_updated ON employees;
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FK diferida de employee_schedules.employee_id -> employees.id
ALTER TABLE employee_schedules
  DROP CONSTRAINT IF EXISTS fk_emp_sched_employee;
ALTER TABLE employee_schedules
  ADD CONSTRAINT fk_emp_sched_employee
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS employee_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, service_id)
);
CREATE INDEX IF NOT EXISTS idx_emp_serv_tenant ON employee_services(tenant_id);

-- =====================================================================
-- OPERACIÓN
-- =====================================================================
CREATE TABLE IF NOT EXISTS clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone          TEXT NOT NULL,
  name           TEXT,
  blocked        BOOLEAN NOT NULL DEFAULT FALSE,
  noshow_count   INT NOT NULL DEFAULT 0,
  total_bookings INT NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS appointments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id    UUID REFERENCES services(id),
  employee_id   UUID REFERENCES employees(id),
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  status        appointment_status NOT NULL DEFAULT 'locked',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_appts_tenant_starts ON appointments(tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appts_employee_starts ON appointments(employee_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appts_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appts_status ON appointments(status);
DROP TRIGGER IF EXISTS trg_appts_updated ON appointments;
CREATE TRIGGER trg_appts_updated BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS waitlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id   UUID REFERENCES services(id),
  employee_id  UUID REFERENCES employees(id),
  desired_date DATE,
  status       waitlist_status NOT NULL DEFAULT 'pending',
  notified_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  offered_slot TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant ON waitlist(tenant_id, status);
DROP TRIGGER IF EXISTS trg_waitlist_updated ON waitlist;
CREATE TRIGGER trg_waitlist_updated BEFORE UPDATE ON waitlist
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- BOT
-- =====================================================================
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  state       conversation_state NOT NULL DEFAULT 'idle',
  context     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- estado parcial entre mensajes
  history     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- últimos 10 mensajes [{role,content,ts}]
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, client_phone)
);
CREATE INDEX IF NOT EXISTS idx_conv_tenant_phone ON conversation_sessions(tenant_id, client_phone);
DROP TRIGGER IF EXISTS trg_conv_updated ON conversation_sessions;
CREATE TRIGGER trg_conv_updated BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS bot_instruction_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  instruction TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, template_key)
);
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON bot_instruction_templates(tenant_id);
DROP TRIGGER IF EXISTS trg_templates_updated ON bot_instruction_templates;
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON bot_instruction_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  client_phone    TEXT NOT NULL,
  type            notification_type NOT NULL,
  status          notification_status NOT NULL DEFAULT 'pending',
  error_detail    TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_appt_type ON notification_log(appointment_id, type);
CREATE INDEX IF NOT EXISTS idx_notif_tenant ON notification_log(tenant_id, created_at);

-- =====================================================================
-- ANALYTICS
-- =====================================================================
CREATE TABLE IF NOT EXISTS employee_monthly_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year          INT NOT NULL,
  month         INT NOT NULL,
  appointments  INT NOT NULL DEFAULT 0,
  completed     INT NOT NULL DEFAULT 0,
  cancelled     INT NOT NULL DEFAULT 0,
  noshows       INT NOT NULL DEFAULT 0,
  revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, year, month)
);

CREATE TABLE IF NOT EXISTS client_stats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  total_appts    INT NOT NULL DEFAULT 0,
  completed      INT NOT NULL DEFAULT 0,
  cancelled      INT NOT NULL DEFAULT 0,
  noshows        INT NOT NULL DEFAULT 0,
  total_spent    NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_visit     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE TABLE IF NOT EXISTS revenue_summary (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year        INT NOT NULL,
  month       INT NOT NULL,
  day         INT,
  appointments INT NOT NULL DEFAULT 0,
  revenue     NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, year, month, day)
);

CREATE TABLE IF NOT EXISTS cancellation_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  cancelled_by   cancellation_by NOT NULL,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cancel_tenant ON cancellation_log(tenant_id, created_at);

-- =====================================================================
-- COSTOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS claude_usage_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  model         TEXT NOT NULL,
  input_tokens  INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  conversation_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claude_usage_tenant ON claude_usage_log(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS whatsapp_conversation_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_phone        TEXT NOT NULL,
  conversation_type   wa_conversation_type NOT NULL DEFAULT 'service',
  wa_conversation_id  TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  billed              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_tenant ON whatsapp_conversation_log(tenant_id, started_at);

-- =====================================================================
-- FUNCIÓN: is_slot_available
-- Detecta colisiones. Sigue existiendo para mostrar slots libres.
-- En Fase 0A la última barrera anti double-booking pasa a ser el
-- constraint EXCLUDE (migración 005).
-- =====================================================================
CREATE OR REPLACE FUNCTION is_slot_available(
  p_tenant   UUID,
  p_employee UUID,
  p_starts   TIMESTAMPTZ,
  p_ends     TIMESTAMPTZ,
  p_exclude  UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_conflict INT;
BEGIN
  SELECT COUNT(*) INTO v_conflict
  FROM appointments a
  WHERE a.tenant_id = p_tenant
    AND a.employee_id = p_employee
    AND a.status IN ('locked','confirmed')
    AND (p_exclude IS NULL OR a.id <> p_exclude)
    AND a.starts_at < p_ends
    AND a.ends_at  > p_starts
  FOR UPDATE SKIP LOCKED;

  RETURN v_conflict = 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: seed_new_tenant
-- Config default + features + horarios + 25 templates al crear tenant.
-- IDEMPOTENTE: todos los INSERT usan ON CONFLICT DO NOTHING (req. Fase 0A.2)
-- =====================================================================
CREATE OR REPLACE FUNCTION seed_new_tenant(p_tenant UUID) RETURNS VOID AS $$
DECLARE
  v_day INT;
  v_templates TEXT[][] := ARRAY[
    ['greeting', '¡Hola! Saluda al cliente y pregúntale en qué puede ayudarle hoy.'],
    ['ask_service', 'Pide al cliente que elija el servicio que desea de la lista.'],
    ['ask_employee', 'Pregunta con quién le gustaría agendar de la lista de personal.'],
    ['ask_date', 'Pregunta para qué día le gustaría agendar su cita.'],
    ['ask_time', 'Muestra los horarios disponibles y pide que elija uno.'],
    ['confirm_booking', 'Confirma la cita con servicio, persona, fecha y hora indicados.'],
    ['booking_confirmed', 'Informa que la cita quedó agendada y agradece.'],
    ['no_slots', 'Informa que no hay horarios disponibles ese día y ofrece otra fecha.'],
    ['ask_cancel', 'Pide confirmación para cancelar la cita indicada.'],
    ['cancel_confirmed', 'Confirma que la cita fue cancelada.'],
    ['cancel_too_late', 'Informa que ya no se puede cancelar por la política de tiempo mínimo.'],
    ['ask_reschedule', 'Pregunta para qué nueva fecha desea reagendar.'],
    ['reschedule_confirmed', 'Confirma la cita reagendada con la nueva fecha y hora.'],
    ['offer_waitlist', 'Ofrece anotar al cliente en lista de espera para ese día.'],
    ['waitlist_added', 'Confirma que quedó anotado en la lista de espera.'],
    ['waitlist_offer', 'Avisa que se liberó un horario y pregunta si lo quiere tomar.'],
    ['waitlist_accepted', 'Confirma que el horario liberado quedó agendado.'],
    ['waitlist_expired', 'Informa que la oferta de horario expiró.'],
    ['reminder_24h', 'Recuerda al cliente su cita de mañana con día y hora.'],
    ['reminder_2h', 'Recuerda al cliente su cita de hoy en unas horas.'],
    ['noshow_notice', 'Informa con amabilidad que no asistió a su cita.'],
    ['blocked_notice', 'Informa que su cuenta está temporalmente bloqueada para agendar.'],
    ['not_understood', 'Indica con amabilidad que no entendiste y pide que lo repita.'],
    ['out_of_hours', 'Informa el horario de atención del negocio.'],
    ['goodbye', 'Despídete con amabilidad y queda a disposición.']
  ];
  v_t TEXT[];
BEGIN
  -- Config default
  INSERT INTO tenant_config (tenant_id) VALUES (p_tenant)
    ON CONFLICT (tenant_id) DO NOTHING;

  -- Features default
  INSERT INTO tenant_features (tenant_id) VALUES (p_tenant)
    ON CONFLICT (tenant_id) DO NOTHING;

  -- Onboarding session
  INSERT INTO onboarding_sessions (tenant_id, status, current_block, current_step)
    VALUES (p_tenant, 'not_started', 1, 1)
    ON CONFLICT (tenant_id) DO NOTHING;

  -- Horarios default (lun-vie abierto 9-18, sáb 10-15, dom cerrado)
  FOR v_day IN 0..6 LOOP
    INSERT INTO working_hours (tenant_id, weekday, is_open, open_time, close_time)
    VALUES (
      p_tenant, v_day,
      CASE WHEN v_day = 0 THEN FALSE ELSE TRUE END,
      CASE WHEN v_day = 6 THEN TIME '10:00' ELSE TIME '09:00' END,
      CASE WHEN v_day = 6 THEN TIME '15:00' ELSE TIME '18:00' END
    )
    ON CONFLICT (tenant_id, weekday) DO NOTHING;
  END LOOP;

  -- 25 templates default
  FOREACH v_t SLICE 1 IN ARRAY v_templates LOOP
    INSERT INTO bot_instruction_templates (tenant_id, template_key, instruction, is_default)
    VALUES (p_tenant, v_t[1], v_t[2], TRUE)
    ON CONFLICT (tenant_id, template_key) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- VISTA: v_monthly_cost_per_tenant
-- Consolida costo Claude + conversaciones Meta por mes.
-- =====================================================================
DROP VIEW IF EXISTS v_monthly_cost_per_tenant;
CREATE VIEW v_monthly_cost_per_tenant AS
WITH claude AS (
  SELECT tenant_id, date_trunc('month', created_at) AS month,
         SUM(cost_usd) AS claude_cost_usd,
         SUM(input_tokens) AS total_input_tokens,
         SUM(output_tokens) AS total_output_tokens
  FROM claude_usage_log GROUP BY tenant_id, date_trunc('month', created_at)
),
wa AS (
  SELECT tenant_id, date_trunc('month', started_at) AS month, COUNT(*) AS wa_conversations
  FROM whatsapp_conversation_log GROUP BY tenant_id, date_trunc('month', started_at)
),
months AS (
  SELECT tenant_id, month FROM claude
  UNION
  SELECT tenant_id, month FROM wa
)
SELECT m.tenant_id, t.business_name, m.month,
       COALESCE(c.claude_cost_usd, 0) AS claude_cost_usd,
       COALESCE(c.total_input_tokens, 0) AS total_input_tokens,
       COALESCE(c.total_output_tokens, 0) AS total_output_tokens,
       COALESCE(w.wa_conversations, 0) AS wa_conversations
FROM months m
JOIN tenants t ON t.id = m.tenant_id
LEFT JOIN claude c ON c.tenant_id = m.tenant_id AND c.month = m.month
LEFT JOIN wa w ON w.tenant_id = m.tenant_id AND w.month = m.month;

COMMIT;
