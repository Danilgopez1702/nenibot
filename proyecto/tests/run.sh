#!/usr/bin/env bash
# tests/run.sh — ejecuta la suite de Fase 0D.
# Requiere DATABASE_URL apuntando a una base con las migraciones 001–007 aplicadas.
set -euo pipefail

: "${DATABASE_URL:?Define DATABASE_URL, ej: postgres://saas_user:PASS@localhost:5432/saas_citas}"

cd "$(dirname "$0")"
echo "▶ Ejecutando tests Fase 0D contra: $DATABASE_URL"
node --test
