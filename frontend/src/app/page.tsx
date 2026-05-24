"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Item } from "../lib/api";
import { ItemCard } from "./_components/ItemCard";

const RARITIES = [
  "",
  "consumer",
  "industrial",
  "milspec",
  "restricted",
  "classified",
  "covert",
  "contraband",
  "extraordinary",
];

export default function HomePage() {
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .listItems({ q, rarity, page, pageSize: 24 })
      .then((res) => {
        setItems(res.items ?? []);
        setTotal(res.total);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [q, rarity, page]);

  const totalPages = Math.max(1, Math.ceil(total / 24));

  return (
    <>
      <h1>CS2 skin catalog</h1>
      <p style={{ color: "var(--muted)" }}>
        {total.toLocaleString()} items sourced from{" "}
        <a href="https://github.com/ByMykel/CSGO-API">ByMykel/CSGO-API</a>.{" "}
        <Link href="/market">Browse listings →</Link>
      </p>

      <div className="filters">
        <input
          placeholder="Search by name..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={rarity}
          onChange={(e) => {
            setRarity(e.target.value);
            setPage(1);
          }}
        >
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {r === "" ? "Any rarity" : r}
            </option>
          ))}
        </select>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

      <div className="grid">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>

      <div className="pagination">
        <button
          className="btn btn-ghost"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span style={{ alignSelf: "center", color: "var(--muted)" }}>
          {page} / {totalPages}
        </span>
        <button
          className="btn btn-ghost"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
