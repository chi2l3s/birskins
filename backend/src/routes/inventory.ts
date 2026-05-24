import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { inventoryItems, items } from "../db/schema.js";

export async function registerInventoryRoutes(app: FastifyInstance) {
  app.get("/me/inventory", async (req, reply) => {
    if (!req.session.userId) {
      reply.code(401).send({ error: "not authenticated" });
      return;
    }
    const rows = await db
      .select({ inventory: inventoryItems, item: items })
      .from(inventoryItems)
      .innerJoin(items, eq(inventoryItems.itemId, items.id))
      .where(eq(inventoryItems.userId, req.session.userId));
    reply.send(rows);
  });
}
