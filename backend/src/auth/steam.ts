import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";
const STEAM_OPENID_NS = "http://specs.openid.net/auth/2.0";

/**
 * Build the redirect URL that sends a browser to Steam for OpenID login.
 * Steam uses a stateless OpenID 2.0 flow, so we just send the user there
 * and verify the signed response when they come back.
 */
function buildSteamRedirectUrl(): string {
  const params = new URLSearchParams({
    "openid.ns": STEAM_OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": env.STEAM_RETURN_URL,
    "openid.realm": env.STEAM_REALM,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

/**
 * Verify the OpenID response from Steam by sending the exact parameters back
 * with `openid.mode=check_authentication`. Steam responds with `is_valid:true`
 * for legitimate logins. This is the documented stateless verification path.
 */
async function verifySteamResponse(
  query: Record<string, string>,
): Promise<string | null> {
  const params = new URLSearchParams({ ...query, "openid.mode": "check_authentication" });
  const res = await fetch(STEAM_OPENID_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const text = await res.text();
  if (!text.includes("is_valid:true")) return null;

  const claimed = query["openid.claimed_id"];
  if (!claimed) return null;
  const match = claimed.match(/\/openid\/id\/(\d{17})$/);
  return match ? match[1] : null;
}

interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  avatarfull?: string;
  profileurl?: string;
}

async function fetchSteamProfile(steamId: string): Promise<SteamPlayerSummary | null> {
  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
  url.searchParams.set("key", env.STEAM_API_KEY);
  url.searchParams.set("steamids", steamId);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = (await res.json()) as {
    response?: { players?: SteamPlayerSummary[] };
  };
  return json.response?.players?.[0] ?? null;
}

declare module "fastify" {
  interface Session {
    userId?: string;
    steamId?: string;
  }
}

export async function registerSteamAuth(app: FastifyInstance) {
  app.get("/auth/steam", async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.redirect(buildSteamRedirectUrl());
  });

  app.get("/auth/steam/return", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as Record<string, string>;
    const steamId = await verifySteamResponse(query);
    if (!steamId) {
      reply.code(401).send({ error: "Steam OpenID verification failed" });
      return;
    }

    const profile = await fetchSteamProfile(steamId);
    const personaName = profile?.personaname ?? `user_${steamId.slice(-6)}`;
    const avatarUrl = profile?.avatarfull ?? null;
    const profileUrl = profile?.profileurl ?? null;

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.steamId, steamId))
      .limit(1);

    let user = existing[0];
    if (!user) {
      const inserted = await db
        .insert(users)
        .values({ steamId, personaName, avatarUrl, profileUrl })
        .returning();
      user = inserted[0];
    } else {
      await db
        .update(users)
        .set({ personaName, avatarUrl, profileUrl, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    req.session.userId = user.id;
    req.session.steamId = steamId;
    reply.redirect(env.FRONTEND_URL);
  });

  app.post("/auth/logout", async (req, reply) => {
    await req.session.destroy();
    reply.send({ ok: true });
  });

  app.get("/auth/me", async (req, reply) => {
    if (!req.session.userId) {
      reply.code(401).send({ error: "not authenticated" });
      return;
    }
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);
    if (!rows[0]) {
      await req.session.destroy();
      reply.code(401).send({ error: "user not found" });
      return;
    }
    reply.send(rows[0]);
  });
}
