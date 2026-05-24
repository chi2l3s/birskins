# birskins-frontend

Next.js 14 (App Router) storefront for the birskins CS2 skin marketplace.

## Quick start

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The backend (`../backend`) must be running on
`NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

## Pages

- `/` — paginated catalog with search and rarity filter (seeded from ByMykel)
- `/market` — active listings, with "Buy" action
- `/inventory` — items owned by the signed-in user

## Steam login

The "Sign in with Steam" button links to `${NEXT_PUBLIC_API_URL}/auth/steam`,
which begins the OpenID flow. On return, the backend redirects to this app and
sets a `birskins.sid` session cookie. All `fetch` calls use
`credentials: "include"` so the cookie is sent on subsequent requests.
