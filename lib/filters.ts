import type { OrderLine } from "./orders.ts";

export const CHANNELS = ["Online Store", "Shop app", "Point of Sale", "Instagram"] as const;
export type Channel = (typeof CHANNELS)[number];

export type Filters = { categories?: string[]; channels?: string[] };

/** What merchants call things -> words found in a product's category or title. */
const ALIASES: Record<string, string[]> = {
  jacket: ["jacket", "parka", "shell", "coat", "puffer", "outerwear"],
  coat: ["jacket", "parka", "shell", "coat", "puffer", "outerwear"],
  parka: ["jacket", "parka", "shell", "coat", "puffer", "outerwear"],
  puffer: ["jacket", "parka", "shell", "coat", "puffer", "outerwear"],
  outerwear: ["jacket", "parka", "shell", "coat", "puffer", "outerwear"],
  sweater: ["sweater", "cardigan", "knitwear"],
  cardigan: ["sweater", "cardigan", "knitwear"],
  knitwear: ["sweater", "cardigan", "knitwear"],
  pant: ["jeans", "chino", "pant", "bottoms"],
  jean: ["jeans", "chino", "pant", "bottoms"],
  bottom: ["jeans", "chino", "pant", "bottoms"],
  shirt: ["shirt", "tee", "tops"],
  tee: ["shirt", "tee", "tops"],
  top: ["shirt", "tee", "tops"],
  accessory: ["beanie", "glove", "scarf", "belt", "bag", "accessories"],
  accessories: ["beanie", "glove", "scarf", "belt", "bag", "accessories"],
};

function forms(word: string): string[] {
  const w = word.trim().toLowerCase();
  const out = new Set([w]);
  if (w.endsWith("s") && !w.endsWith("ss")) out.add(w.slice(0, -1));
  if (w.endsWith("ies")) out.add(`${w.slice(0, -3)}y`);
  if (w.endsWith("ves")) out.add(`${w.slice(0, -3)}f`);
  if (/(sh|ch|x|ss)es$/.test(w)) out.add(w.slice(0, -2));
  return [...out];
}

function matchesCategory(line: OrderLine, term: string): boolean {
  const candidates = forms(term);
  const words = candidates.flatMap((c) => ALIASES[c] ?? [c]);
  const haystack = `${line.productCategory} ${line.productTitle}`.toLowerCase();
  return words.some((w) => haystack.includes(w));
}

const norm = (s: string) => s.trim().toLowerCase();

/** Keeps only lines that match any of the categories and any of the channels. */
export function filterOrders(orders: OrderLine[], filters: Filters = {}): OrderLine[] {
  const cats = (filters.categories ?? []).filter(Boolean);
  const chans = (filters.channels ?? []).map(norm).filter(Boolean);
  return orders.filter(
    (l) =>
      (cats.length === 0 || cats.some((c) => matchesCategory(l, c))) &&
      (chans.length === 0 || chans.includes(norm(l.salesChannel))),
  );
}
