import { tool } from "ai";
import { z } from "zod";
import { RANGE_PHRASES, resolveDateRange } from "./dates.ts";
import {
  dailySales,
  newCustomers,
  returningCustomers,
  returnedOrderLines,
  returnsByProduct,
  unitsSoldByProduct,
} from "./metrics.ts";

export const DEFAULT_REFERENCE_DATE = "2025-10-28";

const date = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(`${label}, as YYYY-MM-DD. This day is included.`);

const range = z.object({
  start: date("First day"),
  end: date("Last day"),
});

export const metricTools = {
  daily_sales: tool({
    description:
      "How much we sold each day: money in, number of orders and units, before refunds. " +
      "Use it for sales per day, sales trends, and weekly or monthly revenue (add up the days).",
    inputSchema: range,
    execute: ({ start, end }) => dailySales(start, end),
  }),
  units_sold_by_product: tool({
    description:
      "Which products sell the most: units and revenue per product. " +
      "Use it for best sellers, top products and reorders.",
    inputSchema: range,
    execute: ({ start, end }) => unitsSoldByProduct(start, end),
  }),
  returns_by_product: tool({
    description:
      "Which products came back as returns, counted on the day they were returned " +
      "(not the day they were bought). Shows units returned, refund amount and reasons " +
      "like too small or defective. Use it for returns by product or category and sizing problems.",
    inputSchema: range,
    execute: ({ start, end }) => returnsByProduct(start, end),
  }),
  returned_order_lines: tool({
    description:
      "The list of returned order lines, one row each, with the product, variant, return date and " +
      "return reason. Use it when the merchant wants to read each return, not a total per product.",
    inputSchema: range,
    execute: ({ start, end }) => returnedOrderLines(start, end),
  }),
  new_customers: tool({
    description: "How many first-time customers ordered each day.",
    inputSchema: range,
    execute: ({ start, end }) => newCustomers(start, end),
  }),
  returning_customers: tool({
    description:
      "How many repeat customers ordered each day, meaning people who have bought before. " +
      "Use it for repeat-customer trends.",
    inputSchema: range,
    execute: ({ start, end }) => returningCustomers(start, end),
  }),
};

export function buildSystemPrompt(referenceDate: string): string {
  const phrases = RANGE_PHRASES.map((p) => {
    const { start, end } = resolveDateRange(p, referenceDate);
    return `- "${p}": ${start} to ${end}`;
  }).join("\n");

  return [
    "You answer questions from store merchants about their orders, using the tools you are given.",
    `Today is ${referenceDate}. The order data covers May 2025 to October 2025.`,
    "",
    "Dates:",
    "- Always call tools with exact YYYY-MM-DD start and end dates, both included.",
    '- Weeks run Monday to Sunday. "Last week" is the previous full Monday to Sunday.',
    "- Use these ready-made ranges for common phrases:",
    phrases,
    "- For other phrases (for example 'since August' or 'Oct 1 to Oct 15'), work out the exact dates yourself.",
    "- If the merchant gives no dates, pick a sensible window, and say which dates you used.",
    "",
    "How to answer:",
    "- Make one tool call, with the dates you worked out, then explain the result in plain words.",
    "- Pick the tool that matches the question: sales per day, best sellers, returns by product, the list of returned lines, new customers or repeat customers.",
    "- The page draws the tool result as a chart or table under your answer, so keep your answer to one or two short sentences and do not repeat every number.",
    "- Sales are before refunds. Returns are counted on the day they came back.",
    "",
    "Out of scope:",
    "- You have no data on ads, ad spend or ROAS, and no data before May 2025.",
    "- If asked about those, say plainly that we don't have that data, and do not call a tool.",
  ].join("\n");
}
