# PRD — SaaS de Automatización de Citas por WhatsApp

## Problema original
Reconstruir desde cero el proyecto **v7** (SaaS multi-tenant de citas por WhatsApp)
respetando `MASTER_PROJECT.md` al pie de la letra, y luego aplicar **Fase 0A**.
El usuario tiene credenciales de META y Anthropic (las pondrá él en `.env`).
Decisiones del usuario: (1a) entregar como proyecto Docker desplegable en su servidor;
(2b/3) reconstruir v7 tal cual y luego aplicar 0A; (4a) modelo `claude-sonnet-4-6`.

## Stack (NO negociable)
Node.js 20 + Express · PostgreSQL 15 · Redis 7 · n8n · React 18 (Vite) · Nginx · Minio
· Docker Compose. Claude API es el único LLM hasta Fase 3. Ubicación: `/app/proyecto`.

## Arquitectura / principios
- Node.js decide, Claude SOLO redacta.
- PostgreSQL última línea anti double-booking (constraint `EXCLUDE USING gist`).
- Todo output de IA pasa por Zod (fallback seguro, nunca excepción al usuario).
- Contrato único `NormalizedInboundMessage`.
- UTC en DB, timezone del tenant en presentación.
- 3 sistemas de auth: operador (ADMIN_JWT), cliente (CLIENT_JWT + tenant_id), interna (X-Internal-Token).

## Implementado (Junio 2026)
### v7 (Pasos 1–9)
- Migración 001: 21 tablas, ENUMs, triggers, `seed_new_tenant()`, `is_slot_available()`, vista de costos.
- bot-service: webhook (verifier/parser/router), Redis (caché/sesión/mutex/idempotencia),
  WhatsApp sender, máquina de estados (handler + flows booking/cancellation/reschedule),
  detector de intención por regex, slots + parseo de fechas en NL, Claude (solo redacción).
- Onboarding por WhatsApp: 7 bloques + activador.
- APIs: internal (recordatorios/noshow/waitlist/stats), admin (auth/tenants/costs/onboarding),
  client (auth/appointments/clients/config/stats).
- n8n: 5 workflows (JSON importables).
- Paneles React: admin (Login/Tenants/TenantDetail/Costs) y client (Login/Agenda/Clients/Config/Stats).

### Fase 0A (correcciones)
- Migraciones 002 (inbound_messages), 003 (outbound_messages), 004 (snapshots),
  005 (exclusion constraint), 006 (tenant_integrations), 007 (ai_usage_log).
- `seed_new_tenant()` idempotente (ON CONFLICT DO NOTHING).
- `getTenantByPhoneIdForOnboarding()` (no filtra active).
- `utils/crypto.js` AES-256-GCM para wa_token; integración en `tenant_integrations`.
- Rate limiting en login admin y cliente (10/15min).
- Queries de día con límites UTC (`utils/timezone.js`).

### Fase 0B (parcial, ya incluido)
- Contrato `NormalizedInboundMessage` + adaptador de texto.
- `aiValidators.js` (Zod) para outputs de Claude.
- Idempotency keys en confirm_booking / cancel / reschedule / accept_waitlist (Redis TTL 5min).

## Verificado (pruebas locales con Postgres+Redis)
- Migraciones aplican en orden ✓ · seed idempotente ✓ · constraint anti-overlap ✓
- Webhook idempotente (3→1) ✓ · firma HMAC ✓ · aislamiento multi-tenant ✓
- Login admin/cliente + JWT ✓ · flujo de booking llega a `choosing_service` con fallback de Claude ✓
- Paneles admin y client compilan (Vite build) ✓

## Backlog priorizado
- **P1:** Outbox worker (reintentos backoff) — Fase 2.1.
- **P2 — Fase 1:** piloto real salón de uñas (alta, onboarding, primer booking, recordatorios).
- **P2:** rate limiting webhook, backups Postgres→Minio, dashboard de costos por route.
- Diferido (Fase 3+): audio/Whisper, AI Router/pgvector, Embedded Signup, Retell AI, RLS.

### Fase 0D (tests de garantías) — HECHO
- `tests/` con runner nativo (`node --test`), reusa el código REAL del bot-service.
- `concurrency.test.js` (0D.1): 10 reservas concurrentes mismo slot → 1 gana, 9 rechazos, 0 double-booking.
- `isolation.test.js` (0D.2): aislamiento multi-tenant (A no ve datos de B).
- `idempotency.test.js` (0D.3): mismo `message_id` 3× → 1 registro.
- Resultado: 5/5 verde en 0.6s. **Atrapó y arregló 2 bugs de producción:**
  1. `is_slot_available()` usaba `COUNT(*)` + `FOR UPDATE SKIP LOCKED` (ilegal) → reescrito con `NOT EXISTS`.
  2. `tenantDayBoundsUtc()` rompía por `hour12:false` ("24:00") y signo de offset invertido →
     habría devuelto agenda/recordatorios/stats vacíos para tenants no-UTC (todos los reales).

### Fase 0C (script de onboarding técnico) — HECHO
- `scripts/onboard.js` (CLI readline robusto) + libs env/db/password/validators/metaApi/whatsapp/provisioning/crypto.
- Máquina de estados reanudable: draft→db_created→meta_configured→onboarding_sent.
- Verificado: creación + seed idempotente, cifrado del wa_token descifrable por bot-service,
  detección de token Meta inválido, reanudación con mismo wa_phone_id.

## Notas de despliegue
- `cp .env.example .env`; `ENCRYPTION_KEY=$(openssl rand -hex 32)`; `CLAUDE_MODEL=claude-sonnet-4-6`.
- `docker compose up -d --build`. Migraciones automáticas vía initdb.
- Importar los 5 workflows en n8n.
