import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { items } from "../db/schema.js";

const ListQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  rarity: z.string().optional(),
  weapon: z.string().optional(),
  statTrak: z.coerce.boolean().optional(),
  sort: z.enum(["name", "rarity", "newest"]).default("name"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export async function registerItemRoutes(app: FastifyInstance) {
  app.get("/items", async (req, reply) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid query", details: parsed.error.flatten() });
      return;
    }
    const { q, rarity, weapon, statTrak, sort, page, pageSize } = parsed.data;

    const filters = [];
    if (q) filters.push(ilike(items.name, `%${q}%`));
    if (rarity) filters.push(eq(items.rarity, rarity as never));
    if (weapon) filters.push(eq(items.weapon, weapon));
    if (statTrak !== undefined) filters.push(eq(items.statTrak, statTrak));
    const whereExpr = filters.length ? and(...filters) : undefined;

    const orderBy =
      sort === "rarity"
        ? desc(items.rarity)
        : sort === "newest"
          ? desc(items.createdAt)
          : asc(items.name);

    const rows = await db
      .select()
      .from(items)
      .where(whereExpr)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .where(whereExpr);

    reply.send({ items: rows, page, pageSize, total: count });
  });

  app.get("/items/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.select().from(items).where(eq(items.id, id)).limit(1);
    if (!row[0]) {
      reply.code(404).send({ error: "not found" });
      return;
    }
    reply.send(row[0]);
  });
}
