# birskins-backend

Fastify + Drizzle + PostgreSQL backend for the birskins CS2 skin marketplace.

## Stack

- Fastify HTTP server
- PostgreSQL via Drizzle ORM (`postgres-js` driver)
- Steam OpenID 2.0 authentication (stateless verification)
- Item catalog seeded from [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API)

## Quick start

```bash
cp .env.example .env            # fill in STEAM_API_KEY + SESSION_SECRET
pnpm install                    # or npm/yarn

# 1. Start Postgres (see ../docker-compose.yml at the repo root)
docker compose up -d db

# 2. Apply schema
pnpm db:generate                # create SQL migration from schema.ts
pnpm db:migrate                 # apply it
# (or: pnpm db:push for a quick non-migrated push during development)

# 3. Seed CS2 skin catalog from ByMykel/CSGO-API
pnpm seed

# 4. Run the API
pnpm dev
```

The API is available at `http://localhost:4000`.

## Routes

| Method | Path                  | Auth | Description                                 |
| ------ | --------------------- | :--: | ------------------------------------------- |
| GET    | `/health`             |  -   | health check                                |
| GET    | `/auth/steam`         |  -   | redirect to Steam OpenID                    |
| GET    | `/auth/steam/return`  |  -   | OpenID callback, creates/updates the user   |
| GET    | `/auth/me`            |  ✓   | current logged-in user                      |
| POST   | `/auth/logout`        |  -   | destroy session                             |
| GET    | `/items`              |  -   | paginated catalog (`q`, `rarity`, `weapon`) |
| GET    | `/items/:id`          |  -   | single catalog item                         |
| GET    | `/listings`           |  -   | active marketplace listings                 |
| POST   | `/listings`           |  ✓   | create a listing from an owned inventory id |
| POST   | `/listings/:id/buy`   |  ✓   | buy a listing (transactional)               |
| GET    | `/me/inventory`       |  ✓   | the caller's inventory                      |

## Steam auth

The flow uses stateless OpenID 2.0:

1. `/auth/steam` builds the Steam redirect URL.
2. Steam sends the browser back to `/auth/steam/return` with signed params.
3. We POST those params back to Steam with `openid.mode=check_authentication`
   and accept the response only if it contains `is_valid:true`.
4. The 17-digit SteamID is extracted from `openid.claimed_id` and we either
   create or update the user, then issue a session cookie.

Required env vars:

- `STEAM_API_KEY` — from <https://steamcommunity.com/dev/apikey>
- `STEAM_REALM` — must match the public origin of the API (e.g. `http://localhost:4000`)
- `STEAM_RETURN_URL` — must be `${STEAM_REALM}/auth/steam/return`
- `SESSION_SECRET` — ≥32 random chars
- `FRONTEND_URL` — origin we redirect to after login & allow via CORS

## Seeding

`pnpm seed` fetches `api/en/skins.json` from ByMykel/CSGO-API and upserts each
entry by id. Override the source with `CSGO_API_SKINS_URL` if you mirror the
file locally. The job is idempotent — re-running updates names, images, and
rarity colors without duplicating rows.
