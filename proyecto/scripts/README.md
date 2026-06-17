# scripts/ — Onboarding técnico (Paso 10 / Fase 0C)

CLI que da de alta un cliente nuevo de forma automática: crea el tenant, lo siembra
(`seed_new_tenant`), cifra el `wa_token` (AES-256-GCM), suscribe el webhook en Meta,
envía el primer mensaje de configuración y genera la contraseña del panel cliente.

## Requisitos (.env)
`DATABASE_URL`, `ANTHROPIC_API_KEY`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `DOMAIN`,
`ENCRYPTION_KEY` (32 bytes hex — `openssl rand -hex 32`).

## Uso

Opción A — dentro del contenedor bot-service (recomendado, ya tiene la red y el .env):
```bash
docker compose exec bot-service sh -lc "cd /usr/src/app && node /scripts/onboard.js"
```

Opción B — en el host, con dependencias propias:
```bash
cd scripts
npm install
DATABASE_URL=postgres://saas_user:PASS@localhost:5432/saas_citas \
ENCRYPTION_KEY=... ANTHROPIC_API_KEY=... META_APP_SECRET=... META_VERIFY_TOKEN=... DOMAIN=... \
node onboard.js
```

El CLI pregunta: nombre del negocio, slug, nombre del asistente, número de WhatsApp,
`wa_phone_id` y `wa_token`. Valida cada dato, pide confirmación y ejecuta el provisioning.

## Máquina de estados (reanudable e idempotente)
```
draft → db_created → meta_configured → onboarding_sent → business_configured → active → failed
```
- El script llega hasta `onboarding_sent`.
- `business_configured` y `active` ocurren cuando la dueña completa la encuesta vía el bot.
- Si el script se interrumpe o falla, se vuelve a ejecutar con el **mismo `wa_phone_id`** y
  retoma desde donde quedó (todas las operaciones son idempotentes).

## Salida
Al terminar imprime: URL del panel cliente (`https://{DOMAIN}/cliente/`), el usuario
(`wa_phone_id`) y la **contraseña temporal** del panel para entregar a la dueña.

## Archivos
| Archivo | Función |
|---|---|
| `onboard.js` | CLI interactivo (readline) |
| `lib/env.js` | Valida variables de entorno |
| `lib/db.js` | Pool Postgres independiente; funciones idempotentes |
| `lib/password.js` | Contraseña temporal + bcrypt + impresión |
| `lib/validators.js` | Valida número, phone_id, slug, token |
| `lib/metaApi.js` | Verifica token + suscribe webhook en Meta |
| `lib/whatsapp.js` | Envía el primer mensaje de onboarding |
| `lib/provisioning.js` | Máquina de estados del alta |
| `lib/crypto.js` | AES-256-GCM (idéntico al del bot-service) |
