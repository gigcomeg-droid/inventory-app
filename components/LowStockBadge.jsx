export default function LowStockBadge({ quantity, minStockLevel, isLowStock }) {
  const low = typeof isLowStock === 'boolean' ? isLowStock : quantity <= (minStockLevel ?? 0);
  const outOfStock = (quantity ?? 0) <= 0;

  if (!low) {
    return (
      <span className="badge border border-accent-teal/30 bg-accent-teal/10 text-accent-teal">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
        In Stock
      </span>
    );
  }

  if (outOfStock) {
    return (
      <span className="badge border border-accent-rose/30 bg-accent-rose/10 text-accent-rose">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-rose" />
        Out of Stock
      </span>
    );
  }

  return (
    <span className="badge border border-accent-amber/30 bg-accent-amber/10 text-accent-amber">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-amber" />
      Low Stock
    </span>
  );
}
