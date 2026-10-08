# موثوق العقاري | Muwaqe Estates

منصة حوكمة عقارية رقمية للتحقق والدفع الآمن — ثنائية اللغة (عربي / English).

Digital real-estate governance platform for verification & secure payments. Bilingual (Arabic RTL / English LTR), zero-dependency Node.js backend, ready to deploy on Render/Railway/Vercel-like hosts or any VPS.

## Features / المزايا

- **رقم استفسار عقاري موحد** — Unified inquiry number per listing, linked to unit data and national address.
- **حساب عقاري مستقل** — Independent escrow account per listing/operation.
- **حساب افتراضي لكل عملية** — Virtual account per operation (deposit, payment, rent, fees).
- **حماية بيانات الوحدة بعد الحجز** — Unit data locked after booking; changes only via a formal documented request.
- **فوترة اتحادات الملاك** — Periodic owners-union invoices for maintenance & operations fees.
- **تتبع وتسوية موثق** — Full audit log of every financial/property action.

## Quick start

```bash
npm start        # http://localhost:3000
```

Requires Node.js ≥ 18. No npm dependencies. Data persists to `data/db.json`.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stats` | Dashboard summary stats |
| GET | `/api/verify?number=INQ-...` | Verify a listing by unified inquiry number |
| GET | `/api/listings` | List all listings |
| POST | `/api/listings` | Create listing (auto inquiry number + escrow account) |
| POST | `/api/book` | Book a unit (locks unit data) |
| POST | `/api/unit-change-request` | Formal documented change request for a locked unit |
| POST | `/api/invoices` | Issue invoice (deposit/payment/rent/fee) with virtual account |
| POST | `/api/owner-union-invoices` | Issue periodic owners-union invoice |
| POST | `/api/pay` | Pay an invoice |
| GET | `/api/invoices?number=...` | List invoices |
| GET | `/api/track?number=INQ-...` | Track full operation timeline |
| GET | `/api/audit?limit=50` | Audit log |

### Example

```bash
curl -X POST http://localhost:3000/api/listings -H "Content-Type: application/json" \
  -d '{"unit":{"unitNumber":"A-1201","city":"Riyadh","district":"Al-Malqa","nationalAddress":"3245 6789 1234","areaSqm":145,"rooms":3,"bathrooms":2,"floor":12,"price":1150000,"projectName":"Al-Noor Residential"}}'
```

## Deployment

- **Render / Railway**: set repo as source, start command `npm start`, add `PORT` env (auto).
- **Any VPS**: `npm start` behind nginx, or use `PORT=80`.
- Data directory can be overridden with the `DATA_DIR` env var. For production use, attach a persistent disk to `data/`.

## Structure

```
server/index.js   — zero-dependency HTTP server + REST API + JSON DB
public/           — bilingual frontend (HTML/CSS/JS, i18n + RTL/LTR)
data/db.json      — persisted data
```

## License

MIT
