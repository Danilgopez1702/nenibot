-- 004_appointments_snapshots.sql — Fase 0A
-- Snapshots: si un servicio cambia de precio, las citas históricas
-- conservan el valor original. Sin esto los reportes se corrompen.
BEGIN;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS service_name_snapshot         TEXT,
  ADD COLUMN IF NOT EXISTS service_price_snapshot        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS service_duration_min_snapshot INT,
  ADD COLUMN IF NOT EXISTS employee_name_snapshot        TEXT,
  ADD COLUMN IF NOT EXISTS timezone_snapshot             TEXT,
  ADD COLUMN IF NOT EXISTS channel_created_from          TEXT NOT NULL DEFAULT 'whatsapp_text',
  ADD COLUMN IF NOT EXISTS locked_until                  TIMESTAMPTZ;

COMMIT;
