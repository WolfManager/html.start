# MAGNETO Search

MAGNETO now runs as a custom search engine with:

- a controlled search API (`/api/search`)
- English interface
- admin authentication and analytics dashboard
- traffic + search logging with percentage breakdown

## Features

- Homepage with local weather widget and suggestion assistant
- Optional MAGNETO Assistant AI mode via backend API (with secure server-side key)
- MAGNETO Core search endpoint (server-side ranking over your own index)
- Results page that reads from your backend, not direct engine redirects
- Admin dashboard (`admin.html`) protected with username/password
- Analytics overview:
  - total searches
  - total page views
  - unique queries
  - period-over-period KPI comparison for filtered ranges
  - top queries by percentage (`%`)
  - traffic by page
  - latest searches timeline
  - charts for top queries and traffic share
  - time filters (`all`, `24h`, `7d`, `30d`)
  - CSV export for filtered analytics
  - daily trend (last 14 days) and weekly trend (last 8 weeks)
- Security hardening:
  - login rate-limit
  - temporary lockout after repeated failed logins
  - admin API request throttling
- Automatic backup for `data/analytics.json`:
  - periodic scheduled backups
  - write-triggered backups with retention
  - manual backup + restore from admin dashboard
  - backup reason filter and direct JSON backup download

## Project Structure

- `server.js` - backend API, auth, search ranking, analytics
- `data/search-index.json` - editable search index used by MAGNETO Core
- `data/analytics.json` - persisted tracking data
- `data/backups/*.json` - automatic analytics backups
- `index.html` - homepage
- `results.html` - search results
- `admin.html` - admin login and analytics dashboard
- `script.js` - frontend logic for search, tracking, and admin
- `styles.css` - global styles and responsive layout
- `.env.example` - environment template

## Local Run

1. Install dependencies:
   - `npm install`
2. Create env file:
   - copy `.env.example` to `.env`
3. Set secure admin credentials in `.env`:
   - `ADMIN_USER=your-user`
   - `ADMIN_PASSWORD=your-strong-password`
   - `JWT_SECRET=your-strong-random-secret`
4. Optional tuning in `.env`:
   - login/lockout: `LOGIN_WINDOW_MINUTES`, `LOGIN_RATE_LIMIT_COUNT`, `LOCKOUT_THRESHOLD`, `LOCKOUT_MINUTES`
   - admin throttling: `ADMIN_WINDOW_SECONDS`, `ADMIN_RATE_LIMIT_COUNT`
   - backup behavior: `BACKUP_MIN_INTERVAL_MINUTES`, `BACKUP_SCHEDULE_MINUTES`, `MAX_BACKUP_FILES`
   - trend windows: `TREND_DAILY_POINTS`, `TREND_WEEKLY_POINTS`
   - assistant AI:
     - `OPENAI_API_KEY` (required for AI mode)
     - `OPENAI_MODEL` (default: `gpt-4o-mini`)
     - `ASSISTANT_WINDOW_SECONDS`, `ASSISTANT_RATE_LIMIT_COUNT`, `ASSISTANT_MAX_CHARS`
5. Start server:
   - `npm start`
6. Open:
   - `http://localhost:3000`

## Admin Access

- URL: `http://localhost:3000/admin.html`
- Sign in with `ADMIN_USER` and `ADMIN_PASSWORD`
- Admin token is stored in browser localStorage for current session flow
- Use range filters and `Export CSV` directly from dashboard controls
- Backup section supports:
  - `Create Backup` for manual snapshots
  - `Filter` backups by reason (`all`, `manual`, `scheduled`, `write`, etc.)
  - `Download` any backup JSON file
  - `Restore` to recover `analytics.json` from any backup file

## Monitoring Endpoint

- Health URL: `GET /api/health`
- Returns service status plus safe runtime configuration snapshot (rate limits, backup intervals, trend window sizes).
- Does not expose credentials or secrets.

## MAGNETO Assistant AI

- Endpoint: `POST /api/assistant/chat`
- Frontend assistant uses this endpoint automatically.
- If `OPENAI_API_KEY` is missing or provider is unavailable, assistant falls back to local rule-based suggestions.
- Keep `OPENAI_API_KEY` in `.env` only. Never expose it in frontend code.

## Deploy Notes

This project is no longer static-only because it needs a running Node server.

- Deploy to a platform that supports Node.js runtime (for example: Render, Railway, Fly.io, Azure App Service, VPS).
- Configure environment variables in your deployment target.
- Keep `admin.html` unindexed (already in `robots.txt`).
- Use HTTPS in production.

## SEO Files

- `robots.txt`
- `sitemap.xml`

Update URLs when domain or routes change.

## Legal and Compliance

- `LICENSE` - project source code license (MIT)
- `THIRD_PARTY_NOTICES.md` - third-party package notices and license pointers
- `PRIVACY.md` - privacy policy template for deployment
- `TERMS.md` - terms of use template for deployment

Before public launch:

- add your legal contact information in `PRIVACY.md` and `TERMS.md`
- validate dependency licenses and keep notices up to date
- keep API keys and secrets in `.env` only (never in frontend files)
