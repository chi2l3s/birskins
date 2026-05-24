export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface Item {
  id: string;
  name: string;
  weapon: string | null;
  pattern: string | null;
  wear: string | null;
  rarity: string;
  rarityColor: string | null;
  imageUrl: string | null;
  description: string | null;
  statTrak: boolean;
  souvenir: boolean;
}

export interface User {
  id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string | null;
  balance: string;
}

export interface ListingRow {
  listing: {
    id: string;
    price: string;
    currency: string;
    status: string;
    createdAt: string;
  };
  item: Item;
  seller: { id: string; personaName: string; avatarUrl: string | null };
}

interface ListResponse<T> {
  items?: T[];
  listings?: T[];
  page: number;
  pageSize: number;
  total: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new Error(`API ${res.status}: ${JSON.stringify(detail)}`);
  }
  return (await res.json()) as T;
}

export const api = {
  me: () => request<User>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  listItems: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<ListResponse<Item>>(`/items${suffix}`);
  },
  getItem: (id: string) => request<Item>(`/items/${encodeURIComponent(id)}`),

  listListings: (page = 1) =>
    request<ListResponse<ListingRow>>(`/listings?page=${page}`),
  buyListing: (id: string) =>
    request<unknown>(`/listings/${id}/buy`, { method: "POST" }),
};
