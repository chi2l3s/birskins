import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import { env } from "./env.js";
import { registerSteamAuth } from "./auth/steam.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerListingRoutes } from "./routes/listings.js";
import { registerInventoryRoutes } from "./routes/inventory.js";

async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(session, {
    secret: env.SESSION_SECRET,
    cookieName: "birskins.sid",
    cookie: {
      secure: env.STEAM_REALM.startsWith("https://"),
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
    saveUninitialized: false,
  });

  app.get("/health", async () => ({ ok: true }));

  await registerSteamAuth(app);
  await registerItemRoutes(app);
  await registerListingRoutes(app);
  await registerInventoryRoutes(app);

  return app;
}

buildApp()
  .then((app) =>
    app.listen({ port: env.PORT, host: "0.0.0.0" }, (err, address) => {
      if (err) {
        app.log.error(err);
        process.exit(1);
      }
      app.log.info(`birskins backend listening on ${address}`);
    }),
  )
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
