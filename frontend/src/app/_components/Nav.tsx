"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, api, type User } from "../../lib/api";

export function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <nav className="nav">
      <Link href="/" className="brand">
        birskins
      </Link>
      <Link href="/market" style={{ color: "var(--muted)" }}>
        Market
      </Link>
      {user && (
        <Link href="/inventory" style={{ color: "var(--muted)" }}>
          Inventory
        </Link>
      )}
      <div className="spacer" />
      {loading ? null : user ? (
        <>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>
            {user.personaName} • ${Number(user.balance).toFixed(2)}
          </span>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await api.logout();
              setUser(null);
              location.reload();
            }}
          >
            Logout
          </button>
        </>
      ) : (
        <a className="btn" href={`${API_URL}/auth/steam`}>
          Sign in with Steam
        </a>
      )}
    </nav>
  );
}
