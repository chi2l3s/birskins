"use client";

import { useEffect, useState } from "react";
import { API_URL, type Item } from "../../lib/api";
import { ItemCard } from "../_components/ItemCard";

interface InventoryRow {
  inventory: { id: string; itemId: string; float: string | null };
  item: Item;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/me/inventory`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) throw new Error("Sign in with Steam to view inventory");
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      })
      .then((j) => setRows(j))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <h1>My inventory</h1>
      {err && <p style={{ color: "#ff7b72" }}>{err}</p>}
      {!rows && !err && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {rows && rows.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          No items yet. Buy something on the marketplace to populate this list.
        </p>
      )}
      <div className="grid">
        {rows?.map((row) => <ItemCard key={row.inventory.id} item={row.item} />)}
      </div>
    </>
  );
}
