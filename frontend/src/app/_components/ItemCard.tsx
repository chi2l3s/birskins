import type { Item } from "../../lib/api";

export function ItemCard({
  item,
  price,
  action,
}: {
  item: Item;
  price?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="img">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} />
        ) : (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>no image</span>
        )}
      </div>
      <div className="name">{item.name}</div>
      <div className="meta">
        <span>
          <span
            className="rarity-dot"
            style={{ background: item.rarityColor ?? "#888" }}
          />
          {item.rarity}
        </span>
        {price !== undefined && <span className="price">${price}</span>}
      </div>
      {item.statTrak && (
        <div style={{ color: "var(--accent)", fontSize: 12 }}>StatTrak™</div>
      )}
      {action}
    </div>
  );
}
