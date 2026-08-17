import clsx from 'clsx';

const ACCENTS = {
  brand: 'bg-brand-500/15 text-brand-300',
  teal: 'bg-accent-teal/15 text-accent-teal',
  purple: 'bg-accent-purple/15 text-accent-purple',
  amber: 'bg-accent-amber/15 text-accent-amber',
  rose: 'bg-accent-rose/15 text-accent-rose',
};

export default function KpiCard({ label, value, icon, accent = 'brand', hint, loading }) {
  return (
    <div className="panel flex items-center gap-4 p-5">
      <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', ACCENTS[accent] || ACCENTS.brand)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-base-100/50">
          {label}
        </p>
        {loading ? (
          <div className="mt-1.5 h-6 w-16 animate-pulse rounded bg-white/10" />
        ) : (
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-white">{value}</p>
        )}
        {hint && <p className="mt-0.5 truncate text-xs text-base-100/40">{hint}</p>}
      </div>
    </div>
  );
}
