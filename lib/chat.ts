import { tool } from "ai";
import { z } from "zod";
import { DEFAULT_RANGE_PHRASE, RANGE_PHRASES, resolveDateRange } from "./dates.ts";
import { CHANNELS, filterOrders, type Filters } from "./filters.ts";
import {
  dailySales,
  newCustomers,
  returnedOrderLines,
  returningCustomers,
  returnsByProduct,
  unitsSoldByProduct,
} from "./metrics.ts";
import { loadOrders } from "./orders.ts";

export const DEFAULT_REFERENCE_DATE = "2025-10-27";

const date = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(`${label}, as YYYY-MM-DD. This day is included.`);

const range = z.object({
  start: date("First day"),
  end: date("Last day"),
  categories: z
    .array(z.string())
    .optional()
    .describe(
      "Only if the merchant names a kind of product, such as jackets, sweaters or beanies. " +
        "Use the merchant's own word. Leave out when they name none.",
    ),
  channels: z
    .array(z.enum(CHANNELS))
    .optional()
    .describe(
      "Only if the merchant names where orders came from, such as online store only or point of sale. " +
        "Leave out when they name none.",
    ),
});

type Input = z.infer<typeof range>;

function run<Row>(
  input: Input,
  metric: (start: string, end: string, orders: ReturnType<typeof loadOrders>) => { rows: Row[] } & Record<string, unknown>,
) {
  const filters: Filters = { categories: input.categories, channels: input.channels };
  const active = Boolean(input.categories?.length || input.channels?.length);
  const orders = loadOrders();
  const result = metric(input.start, input.end, filterOrders(orders, filters));
  if (!active) return result;
  return {
    ...result,
    filters,
    noMatch: filterOrders(orders, filters).length === 0,
  };
}

export const metricTools = {
  daily_sales: tool({
    description:
      "How much we sold each day: money in, number of orders and units, before refunds. " +
      "Use it for sales per day, sales trends, and weekly or monthly revenue (add up the days).",
    inputSchema: range,
    execute: (i) => run(i, dailySales),
  }),
  units_sold_by_product: tool({
    description:
      "Which products sell the most: units and revenue per product. " +
      "Use it for best sellers, top products and reorders.",
    inputSchema: range,
    execute: (i) => run(i, unitsSoldByProduct),
  }),
  returns_by_product: tool({
    description:
      "Which products came back as returns, counted on the day they were returned " +
      "(not the day they were bought). Shows units returned, refund amount and reasons " +
      "like too small or defective. Use it for returns by product or category, return reasons and sizing problems.",
    inputSchema: range,
    execute: (i) => run(i, returnsByProduct),
  }),
  returned_order_lines: tool({
    description:
      "The list of returned order lines, one row each, with the product, variant, return date and " +
      "return reason. Use it when the merchant wants to read each return, not a total per product.",
    inputSchema: range,
    execute: (i) => run(i, returnedOrderLines),
  }),
  new_customers: tool({
    description: "How many first-time customers ordered each day.",
    inputSchema: range,
    execute: (i) => run(i, newCustomers),
  }),
  returning_customers: tool({
    description:
      "How many repeat customers ordered each day, meaning people who have bought before. " +
      "Use it for repeat-customer trends.",
    inputSchema: range,
    execute: (i) => run(i, returningCustomers),
  }),
};

export function buildSystemPrompt(referenceDate: string): string {
  const phrases = RANGE_PHRASES.map((p) => {
    const { start, end } = resolveDateRange(p, referenceDate);
    return `- "${p}": ${start} to ${end}`;
  }).join("\n");
  const fallback = resolveDateRange(DEFAULT_RANGE_PHRASE, referenceDate);

  return [
    "You answer questions from store merchants about their orders, using the tools you are given.",
    `Today is ${referenceDate}. The order data covers May 2025 to October 2025.`,
    "",
    "Dates:",
    "- Always call tools with exact YYYY-MM-DD start and end dates, both included.",
    '- Weeks run Monday to Sunday. "Last week" is the previous full Monday to Sunday.',
    "- Use these ready-made ranges for common phrases:",
    phrases,
    "- A month name means the whole month. For the current month, stop today.",
    "- 'Since' a day or holiday means from that day through yesterday (for example 'since Labor Day' is 2025-09-01 to the day before today).",
    `- If there are no dates, or only vague words (lately, recently, rn, this season, since summer, a while), always use ${fallback.start} to ${fallback.end} (${DEFAULT_RANGE_PHRASE}) and say that you used it. Never work out a start date for a vague word such as "summer" or "season".`,
    "",
    "Filters:",
    "- If the merchant names a kind of product (jackets, sweaters, beanies, boots, hoodies, vests), always pass it in categories, even if we may not sell it. Fix obvious typos first (jakets -> jackets).",
    "- If they name where orders came from, pass channels: online -> Online Store, pos -> Point of Sale, plus Shop app and Instagram.",
    "- If the result says noMatch, say plainly that the order data has no such products or channel, and don't guess.",
    "",
    "How to answer:",
    "- Make one tool call, with the dates and filters you worked out, then explain the result in plain words.",
    "- Pick the tool that matches the question: sales per day, best sellers, returns by product (also for return reasons), the list of returned lines, new customers or repeat customers.",
    "- Anything about returns, return rates, refunds or return reasons uses returns_by_product, never a sales tool.",
    "- If the merchant asks for two things at once, call the tool for the first and say you can show the other next.",
    "- We show counts, not rates or shares. If asked for a rate, show the counts and say so.",
    "- The page draws the tool result as a chart or table under your answer, so keep your answer to one or two short sentences and do not repeat every number.",
    "- Sales are before refunds. Returns are counted on the day they came back.",
    "",
    "Out of scope:",
    "- You have no data on ads, ad spend, ROAS or marketing channels like Meta, no stock or inventory levels, and no data before May 2025.",
    "- If asked about those, say plainly that we don't have that data. Do not call a tool and do not make up a chart.",
  ].join("\n");
}
