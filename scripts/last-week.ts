import { resolveDateRange } from "../lib/dates.ts";
import { METRICS } from "../lib/metrics.ts";

const today = process.argv[2] ?? "2025-10-27";
const { start, end } = resolveDateRange("last week", today);

console.log(`"last week" as of ${today} -> ${start} to ${end}\n`);
for (const [name, metric] of Object.entries(METRICS)) {
  console.log(`$ ${name}("${start}", "${end}")`);
  console.log(JSON.stringify(metric.run(start, end).rows, null, 2));
  console.log();
}
