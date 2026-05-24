/**
 * Seed the `items` table from ByMykel/CSGO-API.
 *
 * Source (open, no key required):
 *   https://bymykel.github.io/CSGO-API/api/en/skins.json
 *
 * Each entry is upserted by its ByMykel `id` so re-running is idempotent.
 */
import { db } from "../db/client.js";
import { items } from "../db/schema.js";
import { sql } from "drizzle-orm";

const SOURCE_URL =
  process.env.CSGO_API_SKINS_URL ??
  "https://bymykel.github.io/CSGO-API/api/en/skins.json";

const KNOWN_RARITIES = new Set([
  "consumer",
  "industrial",
  "milspec",
  "restricted",
  "classified",
  "covert",
  "contraband",
  "extraordinary",
]);

interface BymkelSkin {
  id: string;
  name: string;
  description?: string | null;
  weapon?: { id?: string; name?: string } | null;
  category?: { id?: string; name?: string } | null;
  pattern?: { id?: string; name?: string } | null;
  rarity?: { id?: string; name?: string; color?: string } | null;
  min_float?: number | null;
  max_float?: number | null;
  image?: string | null;
  stattrak?: boolean;
  souvenir?: boolean;
  wears?: Array<{ id?: string; name?: string }>;
}

function normalizeRarity(name?: string | null):
  | "consumer"
  | "industrial"
  | "milspec"
  | "restricted"
  | "classified"
  | "covert"
  | "contraband"
  | "extraordinary"
  | "unknown" {
  if (!name) return "unknown";
  const k = name.toLowerCase().replace(/[^a-z]/g, "");
  if (k.startsWith("consumer")) return "consumer";
  if (k.startsWith("industrial")) return "industrial";
  if (k.startsWith("milspec")) return "milspec";
  if (k.startsWith("restricted")) return "restricted";
  if (k.startsWith("classified")) return "classified";
  if (k.startsWith("covert")) return "covert";
  if (k.startsWith("contraband")) return "contraband";
  if (k.startsWith("extraordinary")) return "extraordinary";
  return KNOWN_RARITIES.has(k) ? (k as never) : "unknown";
}

async function fetchSkins(): Promise<BymkelSkin[]> {
  console.log(`Fetching skins from ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ByMykel skins: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as BymkelSkin[];
  console.log(`Received ${json.length} skin entries`);
  return json;
}

async function upsertBatch(rows: typeof items.$inferInsert[]) {
  if (rows.length === 0) return;
  await db
    .insert(items)
    .values(rows)
    .onConflictDoUpdate({
      target: items.id,
      set: {
        name: sql`excluded.name`,
        weapon: sql`excluded.weapon`,
        pattern: sql`excluded.pattern`,
        rarity: sql`excluded.rarity`,
        rarityColor: sql`excluded.rarity_color`,
        imageUrl: sql`excluded.image_url`,
        description: sql`excluded.description`,
        statTrak: sql`excluded.stat_trak`,
        souvenir: sql`excluded.souvenir`,
        minFloat: sql`excluded.min_float`,
        maxFloat: sql`excluded.max_float`,
      },
    });
}

async function main() {
  const skins = await fetchSkins();

  let prepared: typeof items.$inferInsert[] = [];
  let total = 0;
  const BATCH = 250;

  for (const skin of skins) {
    if (!skin.id || !skin.name) continue;
    prepared.push({
      id: skin.id,
      name: skin.name,
      weapon: skin.weapon?.name ?? null,
      pattern: skin.pattern?.name ?? null,
      wear: null,
      rarity: normalizeRarity(skin.rarity?.name),
      rarityColor: skin.rarity?.color ?? null,
      imageUrl: skin.image ?? null,
      description: skin.description ?? null,
      statTrak: !!skin.stattrak,
      souvenir: !!skin.souvenir,
      minFloat:
        typeof skin.min_float === "number" ? skin.min_float.toFixed(6) : null,
      maxFloat:
        typeof skin.max_float === "number" ? skin.max_float.toFixed(6) : null,
      raw: JSON.stringify(skin),
    });

    if (prepared.length >= BATCH) {
      await upsertBatch(prepared);
      total += prepared.length;
      console.log(`Upserted ${total} items...`);
      prepared = [];
    }
  }
  if (prepared.length) {
    await upsertBatch(prepared);
    total += prepared.length;
  }

  console.log(`Done. Seeded ${total} items.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
