import {
  pgTable,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  numeric,
  uuid,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const rarityEnum = pgEnum("rarity", [
  "consumer",
  "industrial",
  "milspec",
  "restricted",
  "classified",
  "covert",
  "contraband",
  "extraordinary",
  "unknown",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "sold",
  "cancelled",
]);

export const tradeStatusEnum = pgEnum("trade_status", [
  "pending",
  "completed",
  "cancelled",
  "failed",
]);

// Users authenticated via Steam OpenID
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    steamId: varchar("steam_id", { length: 32 }).notNull(),
    personaName: text("persona_name").notNull(),
    avatarUrl: text("avatar_url"),
    profileUrl: text("profile_url"),
    tradeUrl: text("trade_url"),
    balance: numeric("balance", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    steamIdx: uniqueIndex("users_steam_id_idx").on(t.steamId),
  }),
);

// Item catalog seeded from ByMykel/CSGO-API
export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(), // ByMykel item id, e.g. "skin-12345"
    name: text("name").notNull(), // e.g. "AK-47 | Redline (Field-Tested)"
    weapon: text("weapon"), // e.g. "AK-47"
    pattern: text("pattern"), // e.g. "Redline"
    wear: text("wear"), // e.g. "Field-Tested"
    rarity: rarityEnum("rarity").notNull().default("unknown"),
    rarityColor: varchar("rarity_color", { length: 16 }),
    imageUrl: text("image_url"),
    description: text("description"),
    statTrak: boolean("stat_trak").notNull().default(false),
    souvenir: boolean("souvenir").notNull().default(false),
    minFloat: numeric("min_float", { precision: 7, scale: 6 }),
    maxFloat: numeric("max_float", { precision: 7, scale: 6 }),
    raw: text("raw"), // original JSON snippet for debugging
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    nameIdx: index("items_name_idx").on(t.name),
    rarityIdx: index("items_rarity_idx").on(t.rarity),
    weaponIdx: index("items_weapon_idx").on(t.weapon),
  }),
);

// User-owned skins (inventory)
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    float: numeric("float", { precision: 7, scale: 6 }),
    assetId: bigint("asset_id", { mode: "bigint" }), // Steam asset id, when minted from real inventory
    acquiredAt: timestamp("acquired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("inventory_user_idx").on(t.userId),
    itemIdx: index("inventory_item_idx").on(t.itemId),
  }),
);

// Marketplace listings
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inventoryId: uuid("inventory_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("USD"),
    status: listingStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("listings_status_idx").on(t.status),
    itemIdx: index("listings_item_idx").on(t.itemId),
    sellerIdx: index("listings_seller_idx").on(t.sellerId),
  }),
);

// Trade / purchase records
export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => users.id),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("USD"),
  status: tradeStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Sessions (used by @fastify/session store fallback table)
export const sessions = pgTable("sessions", {
  sid: varchar("sid", { length: 64 }).primaryKey(),
  data: text("data").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  inventory: many(inventoryItems),
  listings: many(listings),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  inventory: many(inventoryItems),
  listings: many(listings),
}));

export const inventoryRelations = relations(inventoryItems, ({ one }) => ({
  user: one(users, {
    fields: [inventoryItems.userId],
    references: [users.id],
  }),
  item: one(items, {
    fields: [inventoryItems.itemId],
    references: [items.id],
  }),
}));

export const listingsRelations = relations(listings, ({ one }) => ({
  seller: one(users, {
    fields: [listings.sellerId],
    references: [users.id],
  }),
  item: one(items, {
    fields: [listings.itemId],
    references: [items.id],
  }),
  inventory: one(inventoryItems, {
    fields: [listings.inventoryId],
    references: [inventoryItems.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type Trade = typeof trades.$inferSelect;
