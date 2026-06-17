# SaaS de Automatización de Citas por WhatsApp

Plataforma SaaS **multi-tenant** que automatiza la gestión de citas para negocios de
servicios (salones, barberías, consultorios, etc.) vía **WhatsApp Cloud API**.

> Filosofía central: *"Configuración como datos"*. El código nunca cambia por cliente
> nuevo. Todo el comportamiento se lee de la base de datos en tiempo real.

Esta es la reconstrucción del **v7** (Pasos 1–9) + correcciones de **Fase 0A** y los
contratos de **Fase 0B** (NormalizedInboundMessage, validadores Zod, idempotency keys).

---

## Arquitectura

| Capa | Tecnología | Rol |
|---|---|---|
| Reverse proxy / SSL | Nginx + Certbot | Subdominios, rutas |
| Lógica del bot | Node.js 20 + Express | Estado, decisiones, DB (decide todo) |
| Cerebro IA | Claude API (`claude-sonnet-4-6`) | **Solo redacta** mensajes |
| Validación IA | Zod | Valida outputs de Claude |
| Schedulers | n8n (Docker) | Recordatorios, no-shows, waitlist, stats |
| Base de datos | PostgreSQL 15 | Fuente única de verdad |
| Sesiones / mutex | Redis 7 | Conversaciones, locks, idempotencia |
| Paneles | React 18 (Vite) | Operador + Cliente |
| Archivos | Minio | Almacenamiento S3 |
| Gestión / monitoreo | Portainer + Uptime Kuma | Docker, alertas |

**Las 5 reglas de oro:** (1) Node.js decide, IA redacta. (2) PostgreSQL es la última
línea anti double-booking (constraint `EXCLUDE`). (3) Todo output de IA pasa por Zod.
(4) Un contrato de entrada único (`NormalizedInboundMessage`). (5) UTC en DB, timezone
del tenant en presentación.

---

## Estructura

```
migrations/        001 (base v7) + 002–007 (Fase 0A)
bot-service/       Node.js: webhook, bot, flujos, onboarding, APIs (internal/admin/client)
admin-panel/       React — panel del operador  (servido en /)
client-panel/      React — panel del negocio   (servido en /cliente/)
n8n-workflows/     5 schedulers (JSON importables)
nginx/             reverse proxy
docker-compose.yml 11 servicios · 4 redes
.env.example       plantilla de variables
```

---

## Puesta en marcha (tu servidor con Docker)

```bash
cp .env.example .env
#  Rellena .env con tus credenciales:
#   - POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_*, N8N_*
#   - META_VERIFY_TOKEN, META_APP_SECRET
#   - ANTHROPIC_API_KEY  (CLAUDE_MODEL=claude-sonnet-4-6)
#   - INTERNAL_API_SECRET, ADMIN_JWT_SECRET, ADMIN_PASSWORD, CLIENT_JWT_SECRET
#   - ENCRYPTION_KEY  -> genera con:  openssl rand -hex 32
#   - DOMAIN

docker compose up -d --build
```

Las migraciones `001–007` se aplican automáticamente al crear el volumen de PostgreSQL
(`/docker-entrypoint-initdb.d`).

### Importar workflows de n8n
Abre `https://{DOMAIN}/n8n/` y importa los 5 JSON de `n8n-workflows/`. Ver su README.

---

## Garantías verificadas

- ✅ Migraciones 001–007 aplican en orden y son re-ejecutables.
- ✅ `seed_new_tenant()` idempotente (25 templates + 7 horarios, sin duplicados).
- ✅ Constraint `appointments_no_overlap` rechaza solapamientos (anti double-booking).
- ✅ Webhook idempotente (mismo `message_id` → 1 registro).
- ✅ Firma HMAC-SHA256 del webhook validada.
- ✅ Aislamiento multi-tenant en todos los endpoints (JWT con `tenant_id`).
- ✅ Claude con fallback: si la IA falla, el sistema responde con el texto base (Zod safe).

---

## Roadmap (según MASTER_PROJECT.md)

- **Hecho:** v7 (Pasos 1–9) + Fase 0A + Fase 0B (contratos/validadores/idempotencia)
  + **Fase 0C** (script de onboarding técnico `scripts/onboard.js` — ver `scripts/README.md`)
  + **Fase 0D** (suite de garantías `tests/` — concurrencia, aislamiento, idempotencia).
- **Siguiente:** Fase 1 — piloto real del salón de uñas.
- Luego: Fase 2 (hardening: outbox worker, backups, rate limiting webhook)…

## Tests (Fase 0D)
```bash
cd tests && npm install
DATABASE_URL=postgres://saas_user:PASS@localhost:5432/saas_citas node --test
```
5 tests que reusan el código real del bot-service: 10 reservas concurrentes (1 gana),
aislamiento multi-tenant e idempotencia del webhook. Ver `tests/README.md`.

## Alta de un cliente nuevo
```bash
cd scripts && npm install
node onboard.js   # CLI guiado; ver scripts/README.md
```
