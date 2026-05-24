# birskins

A small CS2 skin marketplace with Steam authentication. The codebase is split
into two independent apps so each can be deployed and iterated on separately.

```
.
├── backend/    Fastify + Drizzle ORM + PostgreSQL + Steam OpenID
├── frontend/   Next.js 14 (App Router) storefront
└── docker-compose.yml   PostgreSQL for local development
```

Even though both apps live in this repository, they have separate `package.json`
files, separate `.env` files, and no shared dependencies — you can lift either
directory into its own repo without changes.

## Architecture

```
        ┌────────────┐                ┌──────────────┐
        │  Browser   │───── Steam ───►│ steamcommunity│
        │            │◄──OpenID──────│  .com/openid  │
        └─────┬──────┘                └──────────────┘
              │ session cookie
              ▼
        ┌────────────┐    JSON     ┌─────────────┐
        │  frontend  │────────────►│   backend   │
        │  Next.js   │◄────────────│  Fastify    │
        └────────────┘             └──────┬──────┘
                                          │ Drizzle ORM
                                          ▼
                                   ┌─────────────┐
                                   │ PostgreSQL  │
                                   └─────────────┘
                                          ▲
                                          │ seed-items.ts (one-shot)
                                          │
                              ┌───────────────────────┐
                              │ ByMykel/CSGO-API JSON │
                              └───────────────────────┘
```

## Run locally

### Windows one-click

Double-click **`start.bat`** in the repo root. It will:

1. Start PostgreSQL via Docker
2. Create `backend\.env` and `frontend\.env.local` from the examples
   (generating a random `SESSION_SECRET`)
3. `npm/pnpm install` for each app on first run
4. Apply the Drizzle schema and seed the catalog from ByMykel/CSGO-API
5. Launch the backend and frontend dev servers in two new terminal windows
6. Open <http://localhost:3000> in your browser

Use **`stop.bat`** to shut PostgreSQL back down. Steam login won't work until
you put a real `STEAM_API_KEY` in `backend\.env` (the rest of the app is fully
browsable without it).

### Manual

```bash
# 1. Postgres
docker compose up -d db

# 2. Backend
cd backend
cp .env.example .env           # set STEAM_API_KEY + SESSION_SECRET
pnpm install
pnpm db:generate && pnpm db:migrate
pnpm seed                      # fetches ByMykel skins.json and upserts items
pnpm dev                       # http://localhost:4000

# 3. Frontend (new terminal)
cd ../frontend
cp .env.example .env.local
pnpm install
pnpm dev                       # http://localhost:3000
```

## Item catalog source

The `items` table is seeded from
[ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API), specifically
`api/en/skins.json`. The seeder upserts on `id`, so re-running keeps the
catalog fresh without duplicating rows.

## Steam authentication

The backend uses stateless OpenID 2.0:

1. Frontend links to `GET /auth/steam`, which 302s to Steam.
2. Steam redirects back to `GET /auth/steam/return` with signed parameters.
3. The backend re-POSTs those parameters with `openid.mode=check_authentication`
   and accepts the response only if Steam answers `is_valid:true`.
4. The 17-digit SteamID is extracted from `openid.claimed_id`, the user is
   upserted, and a session cookie (`birskins.sid`) is issued.

You will need a [Steam Web API key](https://steamcommunity.com/dev/apikey) in
`backend/.env` to enrich profiles (name, avatar) via `GetPlayerSummaries`.

## Tech choices

| Concern             | Choice                                    |
| ------------------- | ----------------------------------------- |
| Backend framework   | Fastify (small surface, native TypeScript) |
| ORM                 | Drizzle ORM with the `postgres-js` driver |
| DB migrations       | `drizzle-kit generate` + `drizzle-kit migrate` |
| Frontend framework  | Next.js 14, App Router, client components |
| Auth                | Steam OpenID 2.0 (stateless verification) |
| Session storage     | In-memory `@fastify/session` (swap for Redis in prod) |
| Skin catalog source | ByMykel/CSGO-API (open JSON, MIT)         |

## Repository layout details

- `backend/src/db/schema.ts` — Drizzle schema for users, items, inventory, listings, trades, sessions
- `backend/src/auth/steam.ts` — OpenID redirect + verification + session issuance
- `backend/src/seed/seed-items.ts` — idempotent ByMykel seeder
- `backend/src/routes/*.ts` — items, listings (with transactional purchase), and inventory APIs
- `frontend/src/app/page.tsx` — catalog browser
- `frontend/src/app/market/page.tsx` — active listings + buy button
- `frontend/src/app/inventory/page.tsx` — authenticated inventory view
