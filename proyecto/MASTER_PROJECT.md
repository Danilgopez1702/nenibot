# MASTER PROJECT DOCUMENT — SaaS de Citas por WhatsApp
**Versión: 1.1** — Documento de continuidad y contexto para IA
*(v1.0 = especificación original · v1.1 = roadmap actualizado con avances de implementación, Junio 2026)*

> ⚠️ Los principios, arquitectura y especificaciones técnicas de la **v1.0 siguen siendo la
> fuente de verdad**. Este documento actualiza únicamente los **ESTADOS** del roadmap (sección 10)
> con lo realmente implementado. El log detallado vive en `ESTADO_Y_AVANCES.md`.

---

## 🟢 ESTADO DE IMPLEMENTACIÓN (resumen)

| Fase | Descripción | Estado |
|---|---|---|
| **v7** | Reconstrucción Pasos 1–9 | ✅ **Completada** |
| **0A** | Migraciones y correcciones estructurales | ✅ **Completada** |
| **0B** | Contratos y validación de IA | ✅ **Completada** |
| **0C** | Script de onboarding técnico | ✅ **Completada** |
| **0D** | Tests mínimos antes del piloto | ✅ **Completada (5/5 verde)** |
| **1** | Piloto real con el salón de uñas | 🔜 **Siguiente** (requiere `.env` + servidor) |
| **2** | Hardening de producción | ⏳ Pendiente |
| **3** | Notas de voz (WhatsApp Audio) | ⏳ Pendiente |
| **4** | AI Router y FAQs semánticas | ⏳ Pendiente |
| **5** | Embedded Signup (autoservicio) | ⏳ Pendiente |
| **6** | Voz telefónica (Retell AI) | ⏳ Pendiente |
| **7** | Escalamiento Enterprise | ⏳ Pendiente |

**Código:** `/app/proyecto` · 129 archivos · 24 tablas · ~2 844 LOC bot-service · 5 tests verdes.
**Despliegue:** `docker compose up -d --build` (faltan credenciales reales en `.env`).

---

## Índice (estructura v1.0)
1. VISIÓN DEL PRODUCTO
2. PRINCIPIOS NO NEGOCIABLES — 2.1 Separación de responsabilidades · 2.2 Cinco reglas de oro
3. STACK TECNOLÓGICO
4. INFRAESTRUCTURA — 4.1 Redes Docker · 4.2 Rutas Nginx · 4.3 Variables `.env`
5. BASE DE DATOS — 5.1 Tablas v7 · 5.2 Migraciones 0A · 5.3 ENUMs · 5.4 Estados conversación · 5.5 Funciones SQL · 5.6 Reglas timezone
6. ARQUITECTURA DEL BOT — 6.1 NormalizedInboundMessage · 6.2 Validadores Zod · 6.3 Idempotency keys · 6.4 Prompt Claude · 6.5 Flujo de mensaje · 6.6 Tres autenticaciones
7. ESTRUCTURA DE ARCHIVOS COMPLETA
8. WORKFLOWS N8N
9. MODELO FINANCIERO
10. ROADMAP COMPLETO (ver estados abajo)
11. LO QUE NO ENTRA HASTA FASE 4+
12. RIESGOS Y MITIGACIONES
13. CRITERIOS DE ÉXITO
14. CÓMO RETOMAR EL PROYECTO

> Las secciones 1–9 y 11–14 permanecen como en la v1.0 (sin cambios de contenido).

---

## 10. ROADMAP COMPLETO — ESTADOS ACTUALIZADOS

### Fase 0A — Migraciones y correcciones estructurales — ✅ **COMPLETADA**
- ✅ **0A.1** Migraciones 002–007 ejecutadas (inbound/outbound, snapshots, EXCLUDE, integrations, ai_usage_log).
- ✅ **0A.2** `seed_new_tenant()` idempotente (verificado: 3 corridas sin duplicados).
- ✅ **0A.3** Lookup de tenants inactivos (`getTenantByPhoneIdForOnboarding`).
- ✅ **0A.4** `wa_token` movido a `tenant_integrations`, cifrado AES-256-GCM (round-trip verificado).
- ✅ **0A.5** Rate limiting en login admin y cliente (10 intentos / 15 min).
- ✅ **0A.6** Queries de día con timezone corregidas (`utils/timezone.js`).

### Fase 0B — Contratos y validación de IA — ✅ **COMPLETADA**
- ✅ **0B.1** `NormalizedInboundMessage` + adaptador de texto WhatsApp.
- ✅ **0B.2** Validadores Zod para outputs de Claude (`aiValidators.js`) con fallback seguro.
- ✅ **0B.3** Idempotency keys (Redis TTL 5 min) en confirm/cancel/reschedule/waitlist.
- ➕ Extra: Outbox pattern (`outbound_messages`) ya implementado.

### Fase 0C — Script de onboarding técnico (Paso 10) — ✅ **COMPLETADA**
- ✅ **0C.1** `scripts/lib/env.js` — validación de entorno.
- ✅ **0C.2** `scripts/lib/db.js` — pool independiente, funciones idempotentes.
- ✅ **0C.3** `scripts/lib/password.js` — contraseña temporal + bcrypt.
- ✅ **0C.4** `scripts/lib/validators.js` — número/phone_id/slug/token.
- ✅ **0C.5** `scripts/lib/metaApi.js` — verifica token + suscribe webhook (verificado: rechaza token falso).
- ✅ **0C.6** `scripts/lib/whatsapp.js` — primer mensaje de onboarding.
- ✅ **0C.7** `scripts/lib/provisioning.js` — máquina de estados reanudable (verificada).
- ✅ **0C.8** `scripts/onboard.js` — CLI interactivo robusto (TTY + pipe).

### Fase 0D — Tests mínimos antes del piloto — ✅ **COMPLETADA (5/5 verde, 0.6s)**
- ✅ **0D.1** Concurrencia: 10 reservas mismo slot → 1 gana, 0 double-booking.
- ✅ **0D.2** Aislamiento multi-tenant: A no ve datos de B.
- ✅ **0D.3** Idempotencia del webhook: mismo `message_id` 3× → 1 registro.
- 🐞 La suite **detectó y corrigió 2 bugs de producción**:
  1. `is_slot_available()` con `COUNT(*)` + `FOR UPDATE SKIP LOCKED` (ilegal) → `NOT EXISTS`.
  2. `tenantDayBoundsUtc()` con bug de `Intl` ("24:00") y offset invertido → agenda/recordatorios/stats vacíos para tenants no-UTC. Corregido.

### FASE 1 — Piloto real con el salón de uñas — 🔜 **SIGUIENTE**
- ⏳ **1.1** Alta del salón (correr `scripts/onboard.js` con datos reales).
- ⏳ **1.2** Verificación del onboarding conversacional (7 bloques → activar tenant).
- ⏳ **1.3** Primer booking en producción.
- ⏳ **1.4** Verificación de recordatorios 24h/2h (n8n).
- ⏳ **1.5** Medición y ajuste.
- **Bloqueante:** `.env` con credenciales reales + servidor Docker + DNS + webhook en Meta.

### FASE 2 — Hardening de producción — ⏳ Pendiente
- ⏳ **2.1** Outbox worker con reintentos backoff.
- ⏳ **2.2** Backups automáticos Postgres → Minio.
- ⏳ **2.3** Rate limiting en webhook.
- ⏳ **2.4** Métricas de costos por tenant (dashboard por route).
- ⏳ **2.5** Tests de regresión (CI con la suite 0D).

### FASE 3 — Notas de voz (WhatsApp Audio) — ⏳ Pendiente
- ⏳ 3.1 Detección de audio en webhook · 3.2 Descarga de media · 3.3 Whisper · 3.4 Adaptador de audio · 3.5 Costos de audio.

### FASE 4 — AI Router y FAQs semánticas — ⏳ Pendiente
- ⏳ 4.1 pgvector · 4.2 `tenant_faqs` con embeddings · 4.3 AI Router 7 niveles · 4.4 Caché semántico · 4.5 Dashboard de IA por ruta.

### FASE 5 — Embedded Signup (autoservicio) — ⏳ Pendiente
- ⏳ 5.1 OAuth Facebook Business · 5.2 System User Token · 5.3 Alta automática + webhook · 5.4 Inicio automático de encuesta.

### FASE 6 — Voz telefónica (Retell AI) — ⏳ Pendiente
- ⏳ 6.1 Integración Retell · 6.2 Endpoints de voz · 6.3 Bloqueo de slots en llamada · 6.4 Registro de llamadas · 6.5 Recordatorios post-llamada.

### FASE 7 — Escalamiento Enterprise — ⏳ Pendiente
- ⏳ 7.1 RLS PostgreSQL · 7.2 Redis Cluster · 7.3 n8n Queue Mode · 7.4 Workers de audio · 7.5 Dashboards/alertas · 7.6 Multi-sucursal.

---

## 14. CÓMO RETOMAR EL PROYECTO (actualizado)
1. Lee `ESTADO_Y_AVANCES.md` (tracker detallado) y `README.md` (despliegue).
2. `cp .env.example .env` y completa credenciales (`ENCRYPTION_KEY=$(openssl rand -hex 32)`).
3. `docker compose up -d --build` (migraciones 001–007 automáticas).
4. Corre la suite: `cd tests && DATABASE_URL=... node --test` (debe dar 5/5).
5. Alta del primer cliente: `cd scripts && node onboard.js`.
6. Importa los 5 workflows en n8n y actívalos.
7. Configura el webhook en Meta → `https://{DOMAIN}/webhook`.
→ A partir de aquí, **Fase 1 (piloto real)**.
