# n8n Workflows — Schedulers

n8n actúa **solo como scheduler**. Toda la lógica vive en `bot-service`. Cada workflow
dispara un endpoint interno (`http://bot-service:3000/internal/...`) con el header
`X-Internal-Token: {INTERNAL_API_SECRET}`.

| Archivo | Frecuencia | Endpoint |
|---|---|---|
| `01_reminder_24h.json` | Cada hora | `POST /internal/reminders/24h` |
| `02_reminder_2h.json` | Cada 15 min | `POST /internal/reminders/2h` |
| `03_noshow_detection.json` | Cada 10 min | `POST /internal/noshows` |
| `04_waitlist_expiration.json` | Cada 5 min | `POST /internal/waitlist/expire` |
| `05_nightly_stats.json` | 2:00 AM | `POST /internal/analytics` |

## Importar
1. Abre n8n en `https://{DOMAIN}/n8n/` (usuario/clave de `.env`).
2. **Import from File** para cada JSON.
3. Verifica que la variable de entorno `INTERNAL_API_SECRET` esté disponible en n8n
   (se inyecta vía `docker-compose.yml`).
4. Activa cada workflow.

> Los endpoints internos NO están expuestos por Nginx: solo se alcanzan desde la red
> Docker `app`. Por eso n8n debe estar en la misma red.
