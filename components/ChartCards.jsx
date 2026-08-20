'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';
import { useLocale } from '@/components/LocaleContext';

const GRID_COLOR = 'rgba(255,255,255,0.06)';
const AXIS_COLOR = 'rgba(244,246,251,0.4)';
const SERIES_COLORS = ['#3b5bfd', '#12d8b8', '#8b5cf6', '#f5a524', '#fb3d6a'];

function ChartShell({ title, subtitle, children, action, height = 260 }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-base-100/40">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

function TooltipCard({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-base-900 px-3 py-2 text-xs shadow-glow">
      {label && <p className="mb-1 font-medium text-base-100/70">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-base-100">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Bar chart: stock quantity by room. data: [{ room, quantity }] */
export function StockByRoomChart({ data = [], loading, height }) {
  const { t, locale } = useLocale();
  return (
    <ChartShell title={t('charts.stockByRoom')} subtitle={t('charts.stockByRoomSub')} height={height}>
      {loading ? (
        <EmptyState label={t('charts.loading')} />
      ) : data.length === 0 ? (
        <EmptyState label={t('charts.noStockData')} />
      ) : (
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="room" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<TooltipCard />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="quantity" radius={[6, 6, 0, 0]} name={t('charts.units')}>
              {data.map((_, i) => (
                <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

/** Horizontal-style bar chart of top low-stock items. data: [{ name, quantity, minStockLevel }] */
export function TopLowStockChart({ data = [], loading, height }) {
  const { t, locale } = useLocale();
  return (
    <ChartShell title={t('charts.topLowStock')} subtitle={t('charts.topLowStockSub')} height={height}>
      {loading ? (
        <EmptyState label={t('charts.loading')} />
      ) : data.length === 0 ? (
        <EmptyState label={t('charts.noLowStock')} good />
      ) : (
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              stroke={AXIS_COLOR}
              fontSize={12}
              width={110}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<TooltipCard />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="quantity" fill="#f5a524" radius={[0, 6, 6, 0]} name={t('charts.qty')} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

/** Simple movement trend line chart. data: [{ label, add, remove }] */
export function MovementTrendChart({ data = [], loading, height }) {
  const { t, locale } = useLocale();
  return (
    <ChartShell title={t('charts.movementTrend')} subtitle={t('charts.movementTrendSub')} height={height}>
      {loading ? (
        <EmptyState label={t('charts.loading')} />
      ) : data.length === 0 ? (
        <EmptyState label={t('charts.noMovements')} />
      ) : (
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<TooltipCard />} />
            <Legend wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }} />
            <Line type="monotone" dataKey="add" name={t('charts.added')} stroke="#12d8b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="remove" name={t('charts.removed')} stroke="#fb3d6a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

function EmptyState({ label, good }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className={good ? 'text-sm text-accent-teal/70' : 'text-sm text-base-100/30'}>{label}</p>
    </div>
  );
}
