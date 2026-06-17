-- 005_exclusion_constraint.sql — Fase 0A
-- Última línea de defensa anti double-booking a nivel motor.
-- is_slot_available() puede tener race conditions; este constraint NO.
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Limpiar posibles duplicados previos antes de crear el constraint
-- (en una base nueva no hay datos, es seguro).
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_no_overlap;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    employee_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status IN ('locked','confirmed'));

COMMIT;
