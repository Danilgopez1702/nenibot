# tests/ — Fase 0D (garantías antes del piloto)

Suite automatizada que valida las tres garantías críticas del sistema usando el
**código real** del `bot-service` (no reimplementa la lógica). Usa el runner nativo
de Node (`node --test`), sin dependencias de framework.

| Archivo | Fase | Garantía |
|---|---|---|
| `concurrency.test.js` | 0D.1 | 10 reservas concurrentes al mismo slot → exactamente 1 gana, 0 double-booking |
| `isolation.test.js` | 0D.2 | Aislamiento multi-tenant: A nunca ve datos de B |
| `idempotency.test.js` | 0D.3 | Webhook idempotente: mismo `message_id` 3× → 1 registro |

## Requisitos
- PostgreSQL con migraciones `001–007` aplicadas.
- `DATABASE_URL` exportada.
- Dependencias del `bot-service` instaladas (los tests importan su código real).

## Ejecutar
```bash
cd tests
npm install
DATABASE_URL=postgres://saas_user:PASS@localhost:5432/saas_citas ./run.sh
# o:  DATABASE_URL=... node --test
```

Cada test crea tenants aislados con slug `test-*` y los elimina al terminar
(no deja residuos en la base).
