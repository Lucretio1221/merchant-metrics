import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, metricTools } from "../lib/chat.ts";

test("system prompt lists exact dates for last week (reference Tue 2025-10-28)", () => {
  const prompt = buildSystemPrompt("2025-10-28");
  assert.match(prompt, /"last week": 2025-10-20 to 2025-10-26/);
  assert.match(prompt, /Monday to Sunday/);
  assert.match(prompt, /ROAS/);
});

test("all five metric tools are registered with merchant wording", () => {
  assert.deepEqual(Object.keys(metricTools).sort(), [
    "daily_sales",
    "new_customers",
    "returning_customers",
    "returns_by_product",
    "units_sold_by_product",
  ]);
  assert.match(String(metricTools.returns_by_product.description), /came back as returns/);
});

test("returns_by_product tool runs with exact dates", async () => {
  const out = (await metricTools.returns_by_product.execute!(
    { start: "2025-10-20", end: "2025-10-26" },
    { toolCallId: "t", messages: [] } as never,
  )) as { rows: { productId: string }[] };
  assert.deepEqual(out.rows.map((r) => r.productId), ["P-1001", "P-1002"]);
});
