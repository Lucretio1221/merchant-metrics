import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, DEFAULT_REFERENCE_DATE, metricTools } from "../lib/chat.ts";
import { resolveDateRange } from "../lib/dates.ts";
import { filterOrders } from "../lib/filters.ts";
import { parseOrders } from "../lib/orders.ts";

const orders = parseOrders(readFileSync("data/orders.csv", "utf8"));
type ToolOut = {
  rows: Record<string, unknown>[];
  filters?: unknown;
  noMatch?: boolean;
};
const call = async (name: keyof typeof metricTools, input: object) =>
  (await metricTools[name].execute!(input as never, { toolCallId: "t", messages: [] } as never)) as unknown as ToolOut;

test("today is 2025-10-27, the day of the acceptance questions", () => {
  assert.equal(DEFAULT_REFERENCE_DATE, "2025-10-27");
});

test("date phrases match the expected ranges (reference 2025-10-27)", () => {
  const ref = DEFAULT_REFERENCE_DATE;
  assert.deepEqual(resolveDateRange("last 30 days", ref), { start: "2025-09-27", end: "2025-10-26" });
  assert.deepEqual(resolveDateRange("last week", ref), { start: "2025-10-20", end: "2025-10-26" });
  assert.deepEqual(resolveDateRange("this month", ref), { start: "2025-10-01", end: "2025-10-27" });
});

test("prompt gives the default range and says stock and ad spend are out of scope", () => {
  const prompt = buildSystemPrompt(DEFAULT_REFERENCE_DATE);
  assert.match(prompt, /2025-09-27 to 2025-10-26 \(last 30 days\)/);
  assert.match(prompt, /stock or inventory/);
  assert.match(prompt, /ad spend/);
  assert.match(prompt, /Labor Day/);
});

test("jackets means every outerwear product, so parkas count", async () => {
  const out = await call("returns_by_product", {
    start: "2025-10-20",
    end: "2025-10-26",
    categories: ["Jackets"],
  });
  assert.deepEqual(
    out.rows.map((r) => r.productId),
    ["P-1001", "P-1002"],
  );
  assert.deepEqual(out.filters, { categories: ["Jackets"], channels: undefined });
  assert.equal(out.noMatch, false);
});

test("plural and odd word forms still match", () => {
  const names = (c: string) => [...new Set(filterOrders(orders, { categories: [c] }).map((l) => l.productTitle))];
  assert.deepEqual(names("sweaters").sort(), ["Cable Knit Cardigan", "Merino Crew Sweater"]);
  assert.deepEqual(names("Beanies, Scarves".split(", ")[0]), ["Wool Beanie"]);
  assert.ok(names("jakets").length === 0, "misspellings are the model's job to fix");
});

test("channel filter keeps only that channel", async () => {
  const online = filterOrders(orders, { channels: ["Online Store"] });
  assert.ok(online.length > 0 && online.every((l) => l.salesChannel === "Online Store"));
  const split = filterOrders(orders, { channels: ["Point of Sale", "Online Store"] });
  assert.equal(split.length, online.length + filterOrders(orders, { channels: ["Point of Sale"] }).length);
});

test("products we don't have come back as noMatch, not a crash", async () => {
  for (const c of ["Hoodies", "Boots", "Vests"]) {
    const out = await call("units_sold_by_product", { start: "2025-08-01", end: "2025-08-31", categories: [c] });
    assert.equal(out.noMatch, true, c);
    assert.deepEqual(out.rows, []);
  }
});

test("a vague question still renders with the default range", async () => {
  const { start, end } = resolveDateRange("last 30 days", DEFAULT_REFERENCE_DATE);
  const out = await call("returns_by_product", { start, end });
  assert.ok(Array.isArray(out.rows));
});
