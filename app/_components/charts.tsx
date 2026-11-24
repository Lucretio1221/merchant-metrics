import { useState } from "react";
import type {
  CustomersRow,
  DailySalesRow,
  ReturnedLineRow,
  ReturnsByProductRow,
  UnitsSoldByProductRow,
} from "@/lib/metrics";

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function dateRangeLabel(start: string, end: string) {
  const year = end.slice(0, 4);
  return start === end
    ? `${shortDate(start)}, ${year}`
    : `${shortDate(start)} to ${shortDate(end)}, ${year}`;
}

export function LineChart({ rows }: { rows: DailySalesRow[] }) {
  const W = 640;
  const H = 240;
  const pad = { l: 52, r: 16, t: 16, b: 32 };
  const max = Math.max(1, ...rows.map((r) => r.sales));
  const step = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => s * 4 >= max) ?? 2000;
  const top = step * 4;
  const x = (i: number) =>
    pad.l + (rows.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (rows.length - 1));
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const ticks = [0, 1, 2, 3, 4].map((t) => t * step);
  const every = Math.ceil(rows.length / 8);
  const path = rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(r.sales)}`).join(" ");

  const [active, setActive] = useState<number | null>(null);
  const shown = active === null ? null : rows[active];

  return (
    <div className="chart-wrap">
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Sales per day"
      className="chart-svg"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="axis">
            ${Math.round(t)}
          </text>
        </g>
      ))}
      <path d={path} className="line" fill="none" />
      {rows.map((r, i) => (
        <g key={r.date}>
          <circle cx={x(i)} cy={y(r.sales)} r={active === i ? 6 : 4} className="dot" />
          <circle
            cx={x(i)}
            cy={y(r.sales)}
            r={12}
            className="hit"
            tabIndex={0}
            aria-label={`${shortDate(r.date)}: ${money(r.sales)}, ${r.orders} orders, ${r.units} units`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          />
          {i % every === 0 && (
            <text x={x(i)} y={H - 10} textAnchor="middle" className="axis">
              {shortDate(r.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
    {shown && active !== null && (
      <div
        className="tooltip"
        role="tooltip"
        style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(shown.sales) / H) * 100}%` }}
      >
        <strong>{shortDate(shown.date)}</strong>
        <span>{money(shown.sales)} in sales</span>
        <span>
          {shown.orders} {shown.orders === 1 ? "order" : "orders"} · {shown.units}{" "}
          {shown.units === 1 ? "unit" : "units"}
        </span>
      </div>
    )}
    </div>
  );
}

type Bar = { key: string; label: string; value: number; right: string; sub?: string };

export function BarChart({ bars, unit }: { bars: Bar[]; unit: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="bars" aria-label={unit}>
      {bars.map((b) => (
        <li key={b.key}>
          <div className="bar-head">
            <span className="bar-label">{b.label}</span>
            <span className="bar-right">{b.right}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          {b.sub && <div className="bar-sub">{b.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

export function unitsBars(rows: UnitsSoldByProductRow[]): Bar[] {
  return rows.slice(0, 10).map((r) => ({
    key: r.productId,
    label: r.productTitle,
    value: r.unitsSold,
    right: `${r.unitsSold} ${r.unitsSold === 1 ? "unit" : "units"} · ${money(r.sales)}`,
    sub: r.productCategory,
  }));
}

export function returnsBars(rows: ReturnsByProductRow[]): Bar[] {
  return [...rows]
    .sort((a, b) => b.unitsReturned - a.unitsReturned)
    .map((r) => ({
      key: r.productId,
      label: r.productTitle,
      value: r.unitsReturned,
      right: `${r.unitsReturned} ${r.unitsReturned === 1 ? "unit" : "units"} · ${money(r.refundAmount)} refunded`,
      sub: Object.entries(r.reasons)
        .map(([reason, n]) => `${reason} (${n})`)
        .join(", "),
    }));
}

export function MetricCards({
  rows,
  noun,
}: {
  rows: CustomersRow[];
  noun: string;
}) {
  const total = rows.reduce((s, r) => s + r.customers, 0);
  const best = rows.reduce((b, r) => (r.customers > b.customers ? r : b), rows[0]);
  const avg = rows.length ? total / rows.length : 0;
  const peak = Math.max(1, ...rows.map((r) => r.customers));
  return (
    <div>
      <div className="cards">
        <div className="card-stat">
          <div className="stat-label">{noun}</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="card-stat">
          <div className="stat-label">Per day</div>
          <div className="stat-value">{avg.toFixed(1)}</div>
        </div>
        <div className="card-stat">
          <div className="stat-label">Busiest day</div>
          <div className="stat-value">{best && best.customers > 0 ? shortDate(best.date) : "None"}</div>
        </div>
      </div>
      <div className="spark" aria-hidden>
        {rows.map((r) => (
          <div
            key={r.date}
            className="spark-bar"
            title={`${shortDate(r.date)}: ${r.customers}`}
            style={{ height: `${Math.max(4, (r.customers / peak) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ReturnsTable({ rows }: { rows: ReturnedLineRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Variant</th>
            <th>Returned</th>
            <th>Reason</th>
            <th className="num">Refund</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.orderId}-${i}`}>
              <td>{r.productTitle}</td>
              <td>{r.variant}</td>
              <td>{shortDate(r.returnDate)}</td>
              <td>{r.returnReason}</td>
              <td className="num">{money(r.refundAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
