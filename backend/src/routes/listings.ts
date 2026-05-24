import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { inventoryItems, items, listings, trades, users } from "../db/schema.js";

const CreateListing = z.object({
  inventoryId: z.string().uuid(),
  price: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v > 0, { message: "price must be > 0" }),
  currency: z.string().min(2).max(8).default("USD"),
});

const BuyParams = z.object({ id: z.string().uuid() });

export async function registerListingRoutes(app: FastifyInstance) {
  app.get("/listings", async (req, reply) => {
    const Query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(24),
    });
    const parsed = Query.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid query" });
      return;
    }
    const { page, pageSize } = parsed.data;

    const rows = await db
      .select({
        listing: listings,
        item: items,
        seller: {
          id: users.id,
          personaName: users.personaName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(listings)
      .innerJoin(items, eq(listings.itemId, items.id))
      .innerJoin(users, eq(listings.sellerId, users.id))
      .where(eq(listings.status, "active"))
      .orderBy(desc(listings.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(eq(listings.status, "active"));

    reply.send({ listings: rows, page, pageSize, total: count });
  });

  app.post("/listings", async (req, reply) => {
    if (!req.session.userId) {
      reply.code(401).send({ error: "not authenticated" });
      return;
    }
    const parsed = CreateListing.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid body", details: parsed.error.flatten() });
      return;
    }
    const { inventoryId, price, currency } = parsed.data;

    const inv = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, inventoryId),
          eq(inventoryItems.userId, req.session.userId),
        ),
      )
      .limit(1);
    if (!inv[0]) {
      reply.code(404).send({ error: "inventory item not found" });
      return;
    }

    const inserted = await db
      .insert(listings)
      .values({
        sellerId: req.session.userId,
        inventoryId,
        itemId: inv[0].itemId,
        price: price.toFixed(2),
        currency,
      })
      .returning();
    reply.code(201).send(inserted[0]);
  });

  app.post("/listings/:id/buy", async (req, reply) => {
    if (!req.session.userId) {
      reply.code(401).send({ error: "not authenticated" });
      return;
    }
    const parsed = BuyParams.safeParse(req.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid id" });
      return;
    }
    const buyerId = req.session.userId;

    // Wrap the listing purchase in a transaction so balance, inventory transfer,
    // listing status, and trade record all commit or roll back together.
    const result = await db.transaction(async (tx) => {
      const listingRow = await tx
        .select()
        .from(listings)
        .where(eq(listings.id, parsed.data.id))
        .limit(1);
      const listing = listingRow[0];
      if (!listing || listing.status !== "active") {
        return { error: "listing not available", code: 404 } as const;
      }
      if (listing.sellerId === buyerId) {
        return { error: "cannot buy your own listing", code: 400 } as const;
      }

      const buyerRow = await tx
        .select()
        .from(users)
        .where(eq(users.id, buyerId))
        .limit(1);
      const buyer = buyerRow[0];
      if (!buyer) return { error: "buyer not found", code: 404 } as const;
      if (Number(buyer.balance) < Number(listing.price)) {
        return { error: "insufficient balance", code: 402 } as const;
      }

      await tx
        .update(users)
        .set({
          balance: sql`${users.balance} - ${listing.price}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, buyerId));
      await tx
        .update(users)
        .set({
          balance: sql`${users.balance} + ${listing.price}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, listing.sellerId));

      await tx
        .update(inventoryItems)
        .set({ userId: buyerId, acquiredAt: new Date() })
        .where(eq(inventoryItems.id, listing.inventoryId));

      await tx
        .update(listings)
        .set({ status: "sold", updatedAt: new Date() })
        .where(eq(listings.id, listing.id));

      const tradeRows = await tx
        .insert(trades)
        .values({
          listingId: listing.id,
          buyerId,
          sellerId: listing.sellerId,
          price: listing.price,
          currency: listing.currency,
          status: "completed",
          completedAt: new Date(),
        })
        .returning();

      return { trade: tradeRows[0] } as const;
    });

    if ("error" in result) {
      reply.code(result.code).send({ error: result.error });
      return;
    }
    reply.send(result.trade);
  });
}
