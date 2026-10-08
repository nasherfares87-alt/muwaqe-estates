# موثوق العقاري | Muwaqe Estates

منصة حوكمة عقارية رقمية للتحقق والدفع الآمن — ثنائية اللغة (عربي / English) مع قاعدة بيانات PostgreSQL وتطبيق جوال (PWA) لنظامي iOS و Android.

Digital real-estate governance platform for verification & secure payments. Bilingual (Arabic RTL / English LTR), PostgreSQL-backed, with an installable mobile app (PWA) for iOS & Android.

## Features / المزايا

- **رقم استفسار عقاري موحد** — Unified inquiry number per listing, linked to unit data and national address.
- **حساب عقاري مستقل** — Independent escrow account per listing/operation.
- **حساب افتراضي لكل عملية** — Virtual account per operation (deposit, payment, rent, fees).
- **حماية بيانات الوحدة بعد الحجز** — Unit data locked after booking; changes only via a formal documented request.
- **فوترة اتحادات الملاك** — Periodic owners-union invoices for maintenance & operations fees.
- **تتبع وتسوية موثق** — Full audit log of every financial/property action.
- **قاعدة بيانات PostgreSQL** — Real database with transactions; JSON-file fallback for quick local runs.
- **تطبيق جوال (PWA)** — Installable app on iOS & Android at `/mobile.html` with app icon, tab bar and offline-ready shell.

## Quick start

```bash
npm install
npm start          # http://localhost:3000  (JSON store fallback)
```

### With PostgreSQL

Set `DATABASE_URL` and the server uses PostgreSQL automatically (schema + demo seed are created on first run):

```bash
DATABASE_URL="postgres://user:pass@host:5432/muwaqe" npm start
```

For local development without an external DB, an embedded PostgreSQL can be used:

```bash
npm run start:pg    # EMBEDDED_PG=1 — starts bundled PostgreSQL (dev only)
```

Requires Node.js ≥ 18.

## Mobile app (PWA)

1. Deploy the platform (see below) or run it locally on the same Wi-Fi.
2. On the phone open `https://<your-host>/mobile.html`.
3. **Android (Chrome)**: menu ⋮ → *Add to Home screen* → Install.
4. **iOS (Safari)**: Share → *Add to Home Screen*.

The app installs with its own icon, splash screen, full-screen standalone mode, and Arabic/English toggle.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check + active storage mode |
| GET | `/api/stats` | Dashboard summary stats |
| GET | `/api/verify?number=INQ-...` | Verify a listing by unified inquiry number |
| GET | `/api/listings` | List all listings |
| POST | `/api/listings` | Create listing (auto inquiry number + escrow account) |
| POST | `/api/book` | Book a unit (locks unit data) |
| POST | `/api/unit-change-request` | Formal documented change request for a locked unit |
| POST | `/api/invoices` | Issue invoice (deposit/payment/rent/fee) with virtual account |
| POST | `/api/owner-union-invoices` | Issue periodic owners-union invoice |
| POST | `/api/pay` | Pay an invoice (transactional, idempotent per invoice) |
| GET | `/api/invoices?number=...` | List invoices |
| GET | `/api/track?number=INQ-...` | Track full operation timeline |
| GET | `/api/audit?limit=50` | Audit log |

### Example

```bash
curl -X POST http://localhost:3000/api/listings -H "Content-Type: application/json" \
  -d '{"unit":{"unitNumber":"A-1201","city":"Riyadh","district":"Al-Malqa","nationalAddress":"3245 6789 1234","areaSqm":145,"rooms":3,"bathrooms":2,"floor":12,"price":1150000,"projectName":"Al-Noor Residential"}}'
```

## Database schema (PostgreSQL)

Tables: `units`, `listings`, `accounts` (escrow / virtual / owner-union), `bookings` (with unit snapshot JSONB), `invoices`, `payments`, `audit_log`. Schema is created automatically on startup (`CREATE TABLE IF NOT EXISTS`), with demo seed data on first run.

## Deployment

- **Render / Railway**: web service with `npm start`; add a PostgreSQL database and link its Internal Database URL as the `DATABASE_URL` environment variable. Data persists in the managed database.
- **Any VPS**: `DATABASE_URL=... npm start` behind nginx, or use `PORT=80`.
- Storage mode is reported by `GET /api/health` (`"storage":"pg"` or `"json"`).

## Structure

```
server/index.js   — HTTP server + REST API + storage layer (PostgreSQL or JSON)
server/db.js      — PostgreSQL connection/migration helper (optional standalone use)
public/           — bilingual web frontend (index.html) + mobile app (mobile.html, PWA)
public/icons/      — app icons (SVG + PNG 192/512)
data/db.json       — JSON fallback store (auto-generated)
```

## License

MIT
