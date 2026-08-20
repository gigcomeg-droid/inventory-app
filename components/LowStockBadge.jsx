import { useLocale } from '@/components/LocaleContext';

export default function LowStockBadge({ quantity, minStockLevel, isLowStock }) {
  const { t, locale } = useLocale();
  const low = typeof isLowStock === 'boolean' ? isLowStock : quantity <= (minStockLevel ?? 0);
  const outOfStock = (quantity ?? 0) <= 0;

  if (!low) {
    return (
      <span className="badge border border-accent-teal/30 bg-accent-teal/10 text-accent-teal">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
        {t('stockBadge.inStock')}
      </span>
    );
  }

  if (outOfStock) {
    return (
      <span className="badge border border-accent-rose/30 bg-accent-rose/10 text-accent-rose">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-rose" />
        {t('stockBadge.outOfStock')}
      </span>
    );
  }

  return (
    <span className="badge border border-accent-amber/30 bg-accent-amber/10 text-accent-amber">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-amber" />
      {t('stockBadge.lowStock')}
    </span>
  );
}
