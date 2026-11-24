import { eachDay, isIsoDate } from "./dates.ts";
import { loadOrders, type OrderLine } from "./orders.ts";

export type MetricResult<Row> = {
  metric: string;
  start: string;
  end: string;
  rows: Row[];
};

const cents = (n: number) => Math.round(n * 100) / 100;

function assertRange(start: string, end: string) {
  if (!isIsoDate(start) || !isIsoDate(end)) {
    throw new Error("start and end must be YYYY-MM-DD");
  }
  if (start > end) throw new Error("start must not be after end");
}

function ordersPlacedIn(orders: OrderLine[], start: string, end: string) {
  return orders.filter((o) => o.orderDate >= start && o.orderDate <= end);
}

export type DailySalesRow = {
  date: string;
  sales: number;
  orders: number;
  units: number;
};

/** Gross sales (sum of line_total) per order_date. Days with no sales show 0. */
export function dailySales(
  start: string,
  end: string,
  orders: OrderLine[] = loadOrders(),
): MetricResult<DailySalesRow> {
  assertRange(start, end);
  const lines = ordersPlacedIn(orders, start, end);
  const rows = eachDay(start, end).map((date) => {
    const day = lines.filter((l) => l.orderDate === date);
    return {
      date,
      sales: cents(day.reduce((s, l) => s + l.lineTotal, 0)),
      orders: new Set(day.map((l) => l.orderId)).size,
      units: day.reduce((s, l) => s + l.quantity, 0),
    };
  });
  return { metric: "daily_sales", start, end, rows };
}

export type CustomersRow = { date: string; customers: number };

function customersPerDay(
  metric: string,
  repeat: boolean,
  start: string,
  end: string,
  orders: OrderLine[],
): MetricResult<CustomersRow> {
  assertRange(start, end);
  const lines = ordersPlacedIn(orders, start, end).filter(
    (l) => l.isRepeatCustomer === repeat,
  );
  const rows = eachDay(start, end).map((date) => ({
    date,
    customers: new Set(
      lines.filter((l) => l.orderDate === date).map((l) => l.customerId),
    ).size,
  }));
  return { metric, start, end, rows };
}

/** Distinct customers per order_date whose order is their first (is_repeat_customer = false). */
export function newCustomers(
  start: string,
  end: string,
  orders: OrderLine[] = loadOrders(),
) {
  return customersPerDay("new_customers", false, start, end, orders);
}

/** Distinct customers per order_date who have ordered before (is_repeat_customer = true). */
export function returningCustomers(
  start: string,
  end: string,
  orders: OrderLine[] = loadOrders(),
) {
  return customersPerDay("returning_customers", true, start, end, orders);
}

export type ReturnsByProductRow = {
  productId: string;
  productTitle: string;
  productCategory: string;
  unitsReturned: number;
  refundAmount: number;
  reasons: Record<string, number>;
};

/**
 * Returns grouped by product. Filtered by return_date (when the item came
 * back), not order_date, so last week's returns show up even for older orders.
 */
export function returnsByProduct(
  start: string,
  end: string,
  orders: OrderLine[] = loadOrders(),
): MetricResult<ReturnsByProductRow> {
  assertRange(start, end);
  const byProduct = new Map<string, ReturnsByProductRow>();
  for (const l of orders) {
    if (!l.returned || !l.returnDate) continue;
    if (l.returnDate < start || l.returnDate > end) continue;
    const row = byProduct.get(l.productId) ?? {
      productId: l.productId,
      productTitle: l.productTitle,
      productCategory: l.productCategory,
      unitsReturned: 0,
      refundAmount: 0,
      reasons: {},
    };
    row.unitsReturned += l.quantity;
    row.refundAmount = cents(row.refundAmount + l.refundAmount);
    const reason = l.returnReason ?? "Unknown";
    row.reasons[reason] = (row.reasons[reason] ?? 0) + l.quantity;
    byProduct.set(l.productId, row);
  }
  const rows = [...byProduct.values()].sort(
    (a, b) => b.refundAmount - a.refundAmount,
  );
  return { metric: "returns_by_product", start, end, rows };
}

export type UnitsSoldByProductRow = {
  productId: string;
  productTitle: string;
  productCategory: string;
  unitsSold: number;
  sales: number;
};

/** Units sold and sales per product by order_date. Useful for reorder planning. */
export function unitsSoldByProduct(
  start: string,
  end: string,
  orders: OrderLine[] = loadOrders(),
): MetricResult<UnitsSoldByProductRow> {
  assertRange(start, end);
  const byProduct = new Map<string, UnitsSoldByProductRow>();
  for (const l of ordersPlacedIn(orders, start, end)) {
    const row = byProduct.get(l.productId) ?? {
      productId: l.productId,
      productTitle: l.productTitle,
      productCategory: l.productCategory,
      unitsSold: 0,
      sales: 0,
    };
    row.unitsSold += l.quantity;
    row.sales = cents(row.sales + l.lineTotal);
    byProduct.set(l.productId, row);
  }
  const rows = [...byProduct.values()].sort((a, b) => b.unitsSold - a.unitsSold);
  return { metric: "units_sold_by_product", start, end, rows };
}

export type ReturnedLineRow = {
  orderId: string;
  productTitle: string;
  variant: string;
  quantity: number;
  returnDate: string;
  returnReason: string;
  refundAmount: number;
};

/** Each returned order line, by return_date (newest first). For reading row by row. */
export function returnedOrderLines(
  start: string,
  end: string,
  orders: OrderLine[] = loadOrders(),
): MetricResult<ReturnedLineRow> {
  assertRange(start, end);
  const rows = orders
    .filter(
      (l) =>
        l.returned && l.returnDate && l.returnDate >= start && l.returnDate <= end,
    )
    .map((l) => ({
      orderId: l.orderId,
      productTitle: l.productTitle,
      variant: l.variant,
      quantity: l.quantity,
      returnDate: l.returnDate as string,
      returnReason: l.returnReason ?? "Unknown",
      refundAmount: cents(l.refundAmount),
    }))
    .sort((a, b) => b.returnDate.localeCompare(a.returnDate));
  return { metric: "returned_order_lines", start, end, rows };
}

export const METRICS = {
  daily_sales: {
    run: dailySales,
    description:
      "Gross sales (sum of line_total), order count and units per day, by order date.",
  },
  new_customers: {
    run: newCustomers,
    description: "Distinct first-time customers per day, by order date.",
  },
  returning_customers: {
    run: returningCustomers,
    description: "Distinct repeat customers per day, by order date.",
  },
  returns_by_product: {
    run: returnsByProduct,
    description:
      "Units returned, refund amount and reasons per product, by return date.",
  },
  units_sold_by_product: {
    run: unitsSoldByProduct,
    description:
      "Units sold and sales per product, by order date. For reorder planning.",
  },
  returned_order_lines: {
    run: returnedOrderLines,
    description:
      "Each returned order line with product, variant, return date and reason, by return date.",
  },
} as const;

export type MetricName = keyof typeof METRICS;

export function isMetricName(name: string): name is MetricName {
  return Object.hasOwn(METRICS, name);
}
