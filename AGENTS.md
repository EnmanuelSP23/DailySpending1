# Daily Spending

Spending tracker deployed on Netlify. Static frontend in `public/`, single Netlify Function backend, data stored in Google Sheets.

## Architecture

- `public/` — Static site (HTML/CSS/JS). Served by Netlify CDN.
- `netlify/functions/records.js` — API handler. GET returns records, POST adds a record.
- `netlify/functions/goog.js` — Google Sheets/Drive API wrapper. JWT auth via `jws` library.
- `netlify.toml` — Build config. `/api/records` redirects to `/.netlify/functions/records`.

## Environment Variables

Required in Netlify (or locally via `netlify dev`):

- `GOOGLE_CREDENTIALS_B64` — Base64-encoded `credentials.json` from Google Cloud service account. **Preferred.**
- `GOOGLE_CREDENTIALS_JSON` — Raw JSON string of credentials. Fallback.
- `SPREADSHEET_ID` — Optional. If omitted, looks up spreadsheet named "Daily Spending" via Drive API.

**Never commit** `credentials.json` or `GOOGLE_CREDENTIALS_B64.txt` — both are in `.gitignore`.

## Spreadsheet Structure

Auto-created on first request:

- **All Data** — Master tab with columns: Amount, Date, Description.
- **Stats** — Dashboard with formulas + charts (auto-generated).
- **Monthly tabs** — Created per month (e.g., "Sep 2026") with same columns.

## Development

```bash
# Install deps
npm install

# Run locally (requires netlify-cli)
npx netlify dev
```

No build step. No test suite. No linting configured.

## Deployment

Push to connected Netlify site. Build publishes `public/`, functions auto-detected from `netlify/functions/`.

## Gotchas

- The function dynamically creates spreadsheet tabs and headers on first access — no migration step needed.
- Access tokens are cached in-memory across invocations (Netlify functions may reuse instances).
- Date format sent by frontend: `YYYY-MM-DD HH:mm` (local time, not UTC).
- The `venv/` directory exists but is unused by this project (likely leftover).
