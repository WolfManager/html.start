# Magneto Django Backend (Gradual Migration)

This backend runs in parallel with the existing Node.js service.

## Why this folder exists

- Keep current product stable while introducing Python gradually.
- Start with compatible endpoints while preserving existing frontend behavior.
- Move AI logic endpoint-by-endpoint, not all at once.

## Included stack

- Django
- Django REST Framework (DRF)
- django-cors-headers
- PostgreSQL (optional production DB)
- Redis (optional cache + broker)
- Celery (background workers)

## Implemented API parity (phase 1)

- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/search?q=...`
- `POST /api/events/page-view`
- `POST /api/assistant/chat`
- `GET /api/admin/overview?range=all|24h|7d|30d`
- `GET /api/admin/assistant-status`
- `GET /api/admin/backups?reason=all|manual|scheduled|...`
- `GET /api/admin/backups/download?fileName=...`
- `POST /api/admin/backups/create`
- `POST /api/admin/backups/restore`
- `GET /api/admin/export.csv?range=all|24h|7d|30d`

Assistant chat supports provider routing by environment variables:

- `AI_PRIMARY_PROVIDER`
- `AI_FALLBACK_PROVIDER`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

If no providers are configured or providers fail, it falls back to local response mode.

## AI hardening included

- Assistant rate limiting (`ASSISTANT_WINDOW_SECONDS`, `ASSISTANT_RATE_LIMIT_COUNT`)
- Response cache with TTL and max entries
- Persistent assistant memory in `data/assistant-memory.json`
- Runtime metrics and provider/error snapshot from `GET /api/admin/assistant-status`

Admin endpoints protection:

- `POST /api/auth/login` returns a Bearer token
- `GET /api/admin/overview` and `GET /api/admin/assistant-status` require `Authorization: Bearer <token>`
- Admin request throttling is enabled (`ADMIN_WINDOW_SECONDS`, `ADMIN_RATE_LIMIT_COUNT`)

## Run locally

1. Create virtual environment:
   - `python -m venv .venv`
2. Activate:
   - Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
3. Install deps:
   - `pip install -r requirements.txt`
4. Configure env:
   - copy `.env.example` to `.env`
5. Run migrations:
   - `python manage.py migrate`
6. Start server:
   - `python manage.py runserver 8000`

## Production-oriented local stack (PostgreSQL + Redis)

1. Start infra:
   - `docker compose up -d`
2. Set `.env` values:
   - `DB_ENGINE=postgres`
   - `DB_HOST=127.0.0.1`
   - `DB_PORT=5432`
   - `DB_NAME=magneto`
   - `DB_USER=magneto`
   - `DB_PASSWORD=magneto`
   - `REDIS_URL=redis://127.0.0.1:6379/0`
3. Run migrations:
   - `python manage.py migrate`
4. Start Django API:
   - `python manage.py runserver 8000`
5. Start Celery worker:
   - Windows: `celery -A magneto_backend worker --loglevel=info --pool=solo`
   - Linux/macOS: `celery -A magneto_backend worker --loglevel=info`

Tip:

- Keep `CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP=true` for resilient worker startup.

Health check:

- `http://127.0.0.1:8000/api/health`

## Recommended long-term additions

- Structured observability (OpenTelemetry traces + metrics)
- JWT auth for admin/API security
- Prompt/version registry for model changes

## Suggested migration order

1. `GET /api/health`
2. `GET /api/search` and `POST /api/events/page-view`
3. `POST /api/assistant/chat` hardening (rate-limit, memory, caching, observability)
4. Admin analytics endpoints parity
5. Tracing, metrics, alerting, and cost dashboards

Keep Node as primary until endpoint parity is validated.
