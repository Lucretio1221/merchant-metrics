import { readFileSync } from "node:fs";
import { join } from "node:path";

export type OrderLine = {
  orderId: string;
  lineItemId: string;
  orderDate: string;
  customerId: string;
  isRepeatCustomer: boolean;
  productId: string;
  productTitle: string;
  productCategory: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  salesChannel: string;
  fulfillmentStatus: string;
  returned: boolean;
  returnDate: string | null;
  returnReason: string | null;
  refundAmount: number;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  return rows;
}

export function parseOrders(csv: string): OrderLine[] {
  const [header, ...body] = parseCsv(csv);
  const col = (r: string[], name: string) => r[header.indexOf(name)] ?? "";
  return body.map((r) => ({
    orderId: col(r, "order_id"),
    lineItemId: col(r, "line_item_id"),
    orderDate: col(r, "order_date"),
    customerId: col(r, "customer_id"),
    isRepeatCustomer: col(r, "is_repeat_customer") === "true",
    productId: col(r, "product_id"),
    productTitle: col(r, "product_title"),
    productCategory: col(r, "product_category"),
    variant: col(r, "variant"),
    quantity: Number(col(r, "quantity")),
    unitPrice: Number(col(r, "unit_price")),
    discountAmount: Number(col(r, "discount_amount")),
    lineTotal: Number(col(r, "line_total")),
    salesChannel: col(r, "sales_channel"),
    fulfillmentStatus: col(r, "fulfillment_status"),
    returned: col(r, "returned") === "true",
    returnDate: col(r, "return_date") || null,
    returnReason: col(r, "return_reason") || null,
    refundAmount: Number(col(r, "refund_amount") || 0),
  }));
}

let cache: OrderLine[] | null = null;

export function loadOrders(): OrderLine[] {
  if (!cache) {
    const file = join(process.cwd(), "data", "orders.csv");
    cache = parseOrders(readFileSync(file, "utf8"));
  }
  return cache;
}
