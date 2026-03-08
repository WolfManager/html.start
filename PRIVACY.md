# Privacy Policy (Template)

Last updated: 2026-03-08

This privacy policy describes how MAGNETO handles data.

## 1. Data we collect

- Search queries submitted by users
- Page view events
- Basic technical data such as IP address and user agent (for analytics and abuse prevention)
- Admin login activity for security controls

## 2. Why we collect data

- Provide search functionality
- Improve ranking and product quality
- Monitor traffic trends
- Protect admin endpoints through rate limiting and security checks

## 3. Data storage

- Analytics data is stored in local JSON files under `data/`
- Backups are stored under `data/backups/`
- Admin auth tokens are stored in browser localStorage for active admin sessions

## 4. Data retention

- Search and page-view records are retained according to app limits in `server.js`
- Backups are retained according to `MAX_BACKUP_FILES`

## 5. Sharing

- Data is not sold.
- Data may be sent to third-party providers only when a feature explicitly depends on them (for example, weather APIs or AI model APIs if enabled).

## 6. Security

- Admin authentication, request throttling, and lockout controls are implemented.
- Secrets must be stored in `.env` and never exposed in frontend code.

## 7. Your choices

- You can request deletion/export workflows based on your deployment and legal region.
- If required by law, add cookie consent and data subject request processes.

## 8. Contact

- Add your legal/business contact email and address here.

## 9. Compliance note

- You are responsible for adapting this template to your jurisdiction (for example GDPR/CCPA) before public launch.
