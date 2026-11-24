import type {
  CustomersRow,
  DailySalesRow,
  MetricResult,
  ReturnedLineRow,
  ReturnsByProductRow,
  UnitsSoldByProductRow,
} from "@/lib/metrics";
import {
  BarChart,
  dateRangeLabel,
  LineChart,
  MetricCards,
  returnsBars,
  ReturnsTable,
  unitsBars,
} from "./charts";

type Shape = "line" | "bars" | "cards" | "table";

export const TOOLS: Record<string, { title: string; shape: Shape; note: string }> = {
  daily_sales: {
    title: "Sales per day",
    shape: "line",
    note: "Sales are before refunds and include orders not yet shipped.",
  },
  units_sold_by_product: {
    title: "Best sellers",
    shape: "bars",
    note: "Counted by the day the order was placed, before refunds.",
  },
  returns_by_product: {
    title: "Returns by product",
    shape: "bars",
    note: "Returns are counted on the day they came back, not the day they were bought.",
  },
  returned_order_lines: {
    title: "Returned items",
    shape: "table",
    note: "Returns are counted on the day they came back, not the day they were bought.",
  },
  new_customers: {
    title: "New customers",
    shape: "cards",
    note: "First-time customers, counted once per day by order date.",
  },
  returning_customers: {
    title: "Repeat customers",
    shape: "cards",
    note: "Customers who have bought before, counted once per day by order date.",
  },
};

export function Placeholder({ shape }: { shape: Shape }) {
  return (
    <div className="skeleton" role="status" aria-label="Loading chart">
      {shape === "line" && (
        <svg viewBox="0 0 640 240" className="chart-svg">
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1="52" x2="624" y1={16 + i * 48} y2={16 + i * 48} className="grid" />
          ))}
          <path
            d="M52,170 L150,120 L250,150 L350,80 L450,110 L550,60 L624,90"
            className="line"
            fill="none"
          />
        </svg>
      )}
      {shape === "bars" &&
        [90, 70, 50, 30].map((w) => (
          <div key={w} className="sk-row">
            <div className="sk-line" style={{ width: "30%" }} />
            <div className="sk-line" style={{ width: `${w}%`, height: 14 }} />
          </div>
        ))}
      {shape === "cards" && (
        <div className="cards">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-stat">
              <div className="sk-line" style={{ width: "50%" }} />
              <div className="sk-line" style={{ width: "30%", height: 28, marginTop: 10 }} />
            </div>
          ))}
        </div>
      )}
      {shape === "table" &&
        [0, 1, 2, 3].map((i) => (
          <div key={i} className="sk-row">
            <div className="sk-line" style={{ width: "100%" }} />
          </div>
        ))}
    </div>
  );
}

function filterLabel(result: MetricResult<unknown>) {
  const f = result.filters;
  return [...(f?.categories ?? []), ...(f?.channels ?? [])].join(", ");
}

function Chart({ name, result }: { name: string; result: MetricResult<unknown> }) {
  if (result.noMatch) {
    return <p className="empty">We don&apos;t have any {filterLabel(result)} in the order data.</p>;
  }
  if (result.rows.length === 0 || (name.endsWith("_customers") && !hasAny(result))) {
    return <p className="empty">No orders in these dates.</p>;
  }
  switch (name) {
    case "daily_sales":
      return <LineChart rows={result.rows as DailySalesRow[]} />;
    case "units_sold_by_product":
      return <BarChart unit="Units sold" bars={unitsBars(result.rows as UnitsSoldByProductRow[])} />;
    case "returns_by_product":
      return <BarChart unit="Units returned" bars={returnsBars(result.rows as ReturnsByProductRow[])} />;
    case "returned_order_lines":
      return <ReturnsTable rows={result.rows as ReturnedLineRow[]} />;
    case "new_customers":
      return <MetricCards noun="New customers" rows={result.rows as CustomersRow[]} />;
    case "returning_customers":
      return <MetricCards noun="Repeat customers" rows={result.rows as CustomersRow[]} />;
    default:
      return null;
  }
}

function hasAny(result: MetricResult<unknown>) {
  return (result.rows as CustomersRow[]).some((r) => r.customers > 0);
}

export function ToolAnswer({
  name,
  state,
  output,
}: {
  name: string;
  state: string;
  output?: unknown;
}) {
  const info = TOOLS[name];
  if (!info) return null;
  const result = state === "output-available" ? (output as MetricResult<unknown>) : null;
  const failed = state === "output-error" || state === "output-denied";

  return (
    <section className="answer-card">
      <header>
        <h2>{info.title}</h2>
        {result && (
          <span className="dates">
            {dateRangeLabel(result.start, result.end)}
            {filterLabel(result) && ` · ${filterLabel(result)}`}
          </span>
        )}
      </header>
      {failed ? (
        <p className="error-note">Couldn&apos;t load this chart. Try asking again.</p>
      ) : result ? (
        <>
          <Chart name={name} result={result} />
          <p className="note">{info.note}</p>
        </>
      ) : (
        <Placeholder shape={info.shape} />
      )}
    </section>
  );
}
