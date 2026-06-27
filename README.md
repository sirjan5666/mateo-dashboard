# Mateo Parenting Dashboard

Web dashboard for Indian parents to track their baby's health (vaccinations,
growth, skin) with an AI assistant. See [PROJECT_SPEC.md](PROJECT_SPEC.md) for
scope and [CLAUDE.md](CLAUDE.md) for working rules.

## Prerequisites

- Node.js 20+
- MongoDB running locally (or a connection string for Atlas)

## Setup

On Windows, double-click `dev.bat` — it checks MongoDB, installs dependencies
if needed, starts both dev servers in their own windows, and opens the app.

Or manually:

```sh
cd server
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET
npm install
npm run dev            # API on http://localhost:4000

cd ../client
npm install
npm run dev            # app on http://localhost:5173 (proxies /api to :4000)
```

## Checks

Run in both `client/` and `server/`:

```sh
npm run lint && npm run typecheck
```
