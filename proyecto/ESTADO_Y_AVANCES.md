# ESTADO Y AVANCES — SaaS Citas WhatsApp
> Actualización del roadmap de `MASTER_PROJECT.md`. Junio 2026.
> Este documento es el **tracker oficial de progreso** contra las fases del doc maestro.

## Resumen ejecutivo

Reconstrucción **completa del v7** (Pasos 1–9) + aplicación de **Fases 0A, 0B, 0C y 0D**.
El proyecto está en `/app/proyecto`, listo para desplegar con `docker compose up -d --build`
en tu servidor. Falta el `.env` con tus credenciales reales (Meta + Anthropic) y el
**piloto real (Fase 1)**.

| Métrica | Valor |
|---|---|
| Archivos del proyecto | 129 (sin dependencias) |
| Migraciones SQL | 7 archivos · ~724 líneas · 24 tablas |
| Bot-service (Node.js) | 56 archivos · ~2 844 líneas |
| Paneles React | 19 archivos · ~704 líneas |
| Script onboarding | 12 archivos · ~503 líneas |
| Suite de tests | 8 archivos · ~197 líneas · 5/5 verde |

---

## Estado por fase

### ✅ v7 — Pasos 1–9 (RECONSTRUIDO)
| Paso | Descripción | Estado |
|---|---|---|
| 1 | Esquema base de datos (24 tablas, ENUMs, triggers, `seed_new_tenant`, `is_slot_available`, vista costos) | ✅ |
| 2 | Infraestructura Docker (11 servicios, 4 redes, Nginx, Minio, Portainer, Kuma) | ✅ |
| 3 | Webhook Meta (verificación challenge + firma HMAC-SHA256 + parser) | ✅ |
| 4 | Capa de datos + Redis (caché tenant, sesiones, mutex, idempotencia) | ✅ |
| 5 | Motor del bot: máquina de estados, intención por regex, slots, Claude solo-redacción | ✅ |
| 6 | Flujos: reserva, cancelación, reagenda, lista de espera | ✅ |
| 7 | Onboarding por WhatsApp (7 bloques + activador) | ✅ |
| 8 | API interna + schedulers n8n (5 workflows) | ✅ |
| 9 | Paneles React (operador + cliente) con JWT | ✅ |

### ✅ Fase 0A — Correcciones estructurales (APLICADA)
| # | Corrección | Estado |
|---|---|---|
| 0A.1 | Migraciones 002–007 (inbound/outbound, snapshots, EXCLUDE, integrations, ai_usage_log) | ✅ |
| 0A.2 | `seed_new_tenant` idempotente (`ON CONFLICT DO NOTHING`) | ✅ verificado |
| 0A.3 | `getTenantByPhoneIdForOnboarding` (no filtra `active`) | ✅ |
| 0A.4 | `wa_token` cifrado AES-256-GCM en `tenant_integrations` | ✅ verificado |
| 0A.5 | Rate limiting en login admin/cliente (10/15min) | ✅ |
| 0A.6 | UTC en DB / timezone del tenant en presentación (`utils/timezone.js`) | ✅ verificado |

### ✅ Fase 0B — Contratos y validación (INCLUIDA)
| # | Elemento | Estado |
|---|---|---|
| 0B.1 | Contrato único `NormalizedInboundMessage` + adaptador de texto | ✅ |
| 0B.2 | Validadores Zod de outputs de IA (`aiValidators.js`) con fallback seguro | ✅ |
| 0B.3 | Idempotency keys en confirm/cancel/reschedule/waitlist (Redis TTL 5min) | ✅ |
| 0B.4 | Outbox pattern (`outbound_messages` + enqueue/markSent/markFailed) | ✅ |

### ✅ Fase 0C — Onboarding técnico (script) (HECHO)
| # | Lib | Estado |
|---|---|---|
| 0C.1 | `env.js` — valida variables de entorno | ✅ |
| 0C.2 | `db.js` — pool independiente, funciones idempotentes | ✅ verificado |
| 0C.3 | `password.js` — contraseña temporal + bcrypt + impresión | ✅ |
| 0C.4 | `validators.js` — número, phone_id, slug, token | ✅ |
| 0C.5 | `metaApi.js` — verifica token + suscribe webhook | ✅ verificado (rechaza token falso) |
| 0C.6 | `whatsapp.js` — primer mensaje de onboarding | ✅ |
| 0C.7 | `provisioning.js` — máquina de estados reanudable | ✅ verificado |
| 0C.8 | `onboard.js` — CLI interactivo robusto (TTY + pipe) | ✅ verificado |

### ✅ Fase 0D — Suite de garantías (HECHO — 5/5 verde)
| # | Test | Resultado |
|---|---|---|
| 0D.1 | 10 reservas concurrentes mismo slot → 1 gana, 0 double-booking | ✅ |
| 0D.2 | Aislamiento multi-tenant (A no ve datos de B) | ✅ |
| 0D.3 | Webhook idempotente (mismo `message_id` 3× → 1 registro) | ✅ |

**Bugs de producción detectados y corregidos por la suite 0D:**
1. `is_slot_available()` combinaba `COUNT(*)` con `FOR UPDATE SKIP LOCKED` (ilegal en
   PostgreSQL) → reescrita con `NOT EXISTS`. La barrera real anti double-booking es el
   constraint `EXCLUDE` (migración 005).
2. `tenantDayBoundsUtc()` fallaba por `Intl hour12:false` ("24:00") **y por el signo del
   offset invertido** → agenda, recordatorios y stats habrían salido **vacíos para todos los
   tenants no-UTC** (todos los salones reales en México). Corregido y verificado.

---

## Garantías verificadas (con PostgreSQL 15 + Redis 7 reales)

- ✅ Migraciones 001–007 aplican en orden.
- ✅ `seed_new_tenant` idempotente (25 templates + 7 horarios, sin duplicados tras 3 corridas).
- ✅ Constraint `appointments_no_overlap` rechaza solapamientos, permite adyacentes.
- ✅ Webhook idempotente + firma HMAC validada (firma inválida → 401).
- ✅ Aislamiento multi-tenant en endpoints (JWT con `tenant_id`).
- ✅ Login admin/cliente + JWT + rate limiting.
- ✅ Flujo de reserva: webhook → dedup → máquina de estados → menú de servicios con
  fallback de Claude → outbox.
- ✅ `wa_token` cifrado por el script `onboard.js` se descifra correctamente en el bot-service.
- ✅ Paneles admin y cliente compilan (Vite build).
- ✅ Suite `node --test`: 5/5 en 0.6s.

---

## Lo que FALTA

### 🔴 Requiere acción tuya (bloqueante para producción)
1. **Credenciales en `.env`** (`cp .env.example .env`):
   - `ANTHROPIC_API_KEY`, `CLAUDE_MODEL=claude-sonnet-4-6`
   - `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_GRAPH_VERSION`
   - `ENCRYPTION_KEY` → `openssl rand -hex 32`
   - `INTERNAL_API_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_PASSWORD`, `CLIENT_JWT_SECRET`
   - `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_*`, `N8N_*`, `DOMAIN`
   - Por negocio: `wa_phone_id` y `wa_token` permanente (se ingresan en `onboard.js`).
2. **Servidor con Docker** + DNS apuntando a `DOMAIN` + certificados (Certbot).
3. **Configurar webhook en Meta** apuntando a `https://{DOMAIN}/webhook` con tu `META_VERIFY_TOKEN`.

### 🟡 Fase 1 — Piloto real (siguiente trabajo de desarrollo)
- Correr `scripts/onboard.js` con los datos del salón de uñas.
- Acompañar el onboarding conversacional (7 bloques) hasta activar el tenant.
- Validar end-to-end con números reales: primer booking, recordatorio 24h/2h, no-show, waitlist.
- Importar los 5 workflows en n8n y activarlos.

### 🟢 Fase 2 — Hardening (post-piloto)
- **Outbox worker** con reintentos backoff (hoy el reenvío es best-effort en el request).
- Backups automáticos Postgres → Minio.
- Rate limiting del webhook (anti-flood).
- Dashboard de costos por `route` en el panel operador.
- Suscripción del webhook por tenant (hoy es a nivel app; multi-número requiere validar enrutamiento).

### ⚪ Diferido (Fase 3+, según doc maestro)
- Mensajes de audio + transcripción (OpenAI Whisper).
- AI Router con embeddings/pgvector y caché semántico.
- Embedded Signup de Meta (alta self-service sin script).
- Voz en tiempo real (Retell AI).
- Row-Level Security (RLS) en PostgreSQL como capa extra de aislamiento.
- Pagos (Stripe/MercadoPago), CI/CD (GitHub Actions con la suite 0D).

---

## Notas técnicas importantes
- **Onboarding (MVP):** cada empleada ofrece todos los servicios y hereda el horario del
  negocio. La asignación fina servicio↔empleada y horarios por empleada se editan luego en
  el panel cliente (`/config`). Profundizar en Fase 2 si el piloto lo requiere.
- **Claude:** el modelo se lee de `CLAUDE_MODEL` (default `claude-sonnet-4-6`). Si la API
  falla, el bot responde con el texto base (nunca lanza error al cliente).
- **Mensajes salientes:** se registran en `outbound_messages` con `idempotency_key` antes de
  enviarse (outbox). El worker de reintentos queda para Fase 2.
