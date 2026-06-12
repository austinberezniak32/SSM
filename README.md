# SSM Material Tracker

Construction material receiving and tracking for the whole crew — with AI packing-slip
scanning. Photograph a packing slip on your phone and the app reads the vendor, PO,
and every line item, auto-sorts it into the right job, and tracks it from **shop → field**.

This is the server-backed successor to the single-file v5.3 HTML app:

| | v5.3 (single file) | This app |
|---|---|---|
| Data | localStorage, per-device | Postgres — whole crew sees the same data |
| API key | Pasted into each phone | Lives only on the server |
| Scanning | Claude Sonnet from the browser | Claude Haiku 4.5 server-side, structured JSON output |
| Photos | Dropped on save (storage limits) | Stored in the database, full-size viewer |
| Access | Anyone with the file | Crew passcode + signed session cookie |
| Install | Open the HTML file | PWA — Add to Home Screen, real app icon |

## Stack

- **Node 20+ / Express** — one small server (`server/index.js`), no build step
- **Postgres** (`DATABASE_URL`), auto-falls back to in-memory pg-mem for local dev
- **@anthropic-ai/sdk** — packing-slip vision scanning with a JSON-schema-enforced response
- **Vanilla ES-module frontend** (`public/`) — same look and flows as v5.3

## Run locally

```bash
npm install
npm start            # http://localhost:3000
```

With no environment variables set it runs in dev mode: in-memory database
(data lost on restart), any passcode accepted, scanner disabled. To exercise
everything locally, create a `.env`-style session:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # enables scanning
$env:APP_PASSCODE      = "your-passcode"
npm start
```

## Deploy to Railway (recommended)

1. Push this folder to a GitHub repo.
2. In [Railway](https://railway.app): **New Project → Deploy from GitHub repo**.
3. In the project, **+ New → Database → PostgreSQL**. Railway wires up `DATABASE_URL` automatically
   (if not, add a variable reference to the Postgres service's `DATABASE_URL` on the app service).
4. On the app service, add variables:
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com) → API Keys
   - `APP_PASSCODE` — the passcode you'll give the crew
   - `SESSION_SECRET` — any long random string
5. **Settings → Networking → Generate Domain** to get your public HTTPS URL.

Tables are created automatically on first boot. Each crew member opens the URL,
signs in with their name + the passcode (60-day session), and taps
**Share → Add to Home Screen** to install it like an app.

## Scripts

```bash
npm run icons    # regenerate PWA icons (public/icons) from the SVG wordmark
npm run smoke    # browser end-to-end test (needs: npm i --no-save playwright)
```

## API overview

All `/api` routes (except login/logout) require the session cookie.

| Route | Purpose |
|---|---|
| `POST /api/login` `{passcode, name}` | issue 60-day signed session cookie |
| `GET /api/state` | jobs + receipts (with line items) + POs |
| `POST /api/scan` `{image, mediaType}` | AI-read a slip photo → structured JSON |
| `POST /api/receipts` | log a receipt (auto-creates the job from the PO) |
| `POST /api/receipts/:id/send` | mark shop material sent to field |
| `POST /api/pos` | register a purchase order |
| `GET /api/photos/:id` | slip photo bytes |
| `GET /api/export.csv` | every line item as CSV |

Job numbers are extracted from PO numbers: `H01460-193` → job `H01460`.
Receipts with no PO and no job context land in an `UNSORTED` job.

## Costs

Scanning uses Claude Haiku 4.5 — roughly a quarter of a cent per slip photo.
$5 of API credit covers ~2,000 scans. Railway's Hobby plan (~$5/mo) comfortably
runs the app + Postgres.
