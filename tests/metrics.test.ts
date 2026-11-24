import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDateRange } from "../lib/dates.ts";
import {
  dailySales,
  newCustomers,
  returningCustomers,
  returnsByProduct,
  unitsSoldByProduct,
} from "../lib/metrics.ts";
import { parseOrders } from "../lib/orders.ts";

const orders = parseOrders(readFileSync("data/orders.csv", "utf8"));

test("parses all 28 order lines", () => {
  assert.equal(orders.length, 28);
});

test("date phrases resolve to exact dates (reference Tue 2025-10-28)", () => {
  const ref = "2025-10-28";
  assert.deepEqual(resolveDateRange("last week", ref), {
    start: "2025-10-20",
    end: "2025-10-26",
  });
  assert.deepEqual(resolveDateRange("this week", ref), {
    start: "2025-10-27",
    end: ref,
  });
  assert.deepEqual(resolveDateRange("yesterday", ref), {
    start: "2025-10-27",
    end: "2025-10-27",
  });
  assert.deepEqual(resolveDateRange("last 7 days", ref), {
    start: "2025-10-21",
    end: "2025-10-27",
  });
  assert.deepEqual(resolveDateRange("last 30 days", "2025-10-27"), {
    start: "2025-09-27",
    end: "2025-10-26",
  });
  assert.deepEqual(resolveDateRange("last month", ref), {
    start: "2025-09-01",
    end: "2025-09-30",
  });
  assert.deepEqual(resolveDateRange("last week", "2025-10-26"), {
    start: "2025-10-13",
    end: "2025-10-19",
  });
  assert.throws(() => resolveDateRange("next year", ref));
});

test("daily_sales sums line_total per day", () => {
  const { rows } = dailySales("2025-10-20", "2025-10-26", orders);
  assert.equal(rows.length, 7);
  const oct23 = rows.find((r) => r.date === "2025-10-23")!;
  assert.deepEqual(oct23, {
    date: "2025-10-23",
    sales: 238.5,
    orders: 1,
    units: 2,
  });
  assert.equal(rows.find((r) => r.date === "2025-10-22")!.sales, 0);
});

test("new and returning customers are counted once per day", () => {
  const n = newCustomers("2025-10-18", "2025-10-18", orders).rows[0];
  assert.equal(n.customers, 1);
  const r = returningCustomers("2025-10-09", "2025-10-09", orders).rows[0];
  assert.equal(r.customers, 1);
  const n2 = newCustomers("2025-10-09", "2025-10-09", orders).rows[0];
  assert.equal(n2.customers, 0);
});

test("returns_by_product uses return_date and keeps partial refunds", () => {
  const { rows } = returnsByProduct("2025-10-20", "2025-10-26", orders);
  assert.deepEqual(
    rows.map((r) => [r.productTitle, r.unitsReturned, r.refundAmount]),
    [
      ["Alpine Down Parka", 3, 657],
      ["Northridge Insulated Jacket", 1, 135.15],
    ],
  );
  const partial = returnsByProduct("2025-10-06", "2025-10-06", orders).rows[0];
  assert.equal(partial.refundAmount, 128.79);
});

test("units_sold_by_product ranks by units", () => {
  const { rows } = unitsSoldByProduct("2025-10-20", "2025-10-26", orders);
  assert.equal(rows[0].productTitle, "Wool Beanie");
  assert.equal(rows[0].unitsSold, 3);
});

test("rejects bad ranges", () => {
  assert.throws(() => dailySales("2025-10-26", "2025-10-20", orders));
  assert.throws(() => dailySales("last week", "2025-10-20", orders));
});
