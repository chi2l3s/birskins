"use client";

import { useEffect, useState } from "react";
import { api, type ListingRow } from "../../lib/api";
import { ItemCard } from "../_components/ItemCard";

export default function MarketPage() {
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh(p = page) {
    setLoading(true);
    try {
      const res = await api.listListings(p);
      setRows(res.listings ?? []);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function buy(id: string) {
    setMsg(null);
    try {
      await api.buyListing(id);
      setMsg("Purchase complete.");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 24));

  return (
    <>
      <h1>Marketplace</h1>
      {msg && (
        <p
          style={{
            color: msg.startsWith("Purchase complete") ? "#7ee787" : "#ff7b72",
          }}
        >
          {msg}
        </p>
      )}
      {loading && <p style={{ color: "var(--muted)" }}>Loading listings…</p>}
      <div className="grid">
        {rows.map((row) => (
          <ItemCard
            key={row.listing.id}
            item={row.item}
            price={Number(row.listing.price).toFixed(2)}
            action={
              <button className="btn" onClick={() => buy(row.listing.id)}>
                Buy
              </button>
            }
          />
        ))}
      </div>
      <div className="pagination">
        <button
          className="btn btn-ghost"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
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
