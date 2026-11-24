import { Suspense } from "react";
import { resolveDateRange } from "@/lib/dates";
import { METRICS, type MetricName } from "@/lib/metrics";

const DATA_END = "2025-10-28";

async function Report({
  searchParams,
}: {
  searchParams: Promise<{ today?: string; range?: string }>;
}) {
  const { today = DATA_END, range = "last week" } = await searchParams;
  const { start, end } = resolveDateRange(range, today);

  return (
    <>
      <p>
        &ldquo;{range}&rdquo; as of {today} = {start} to {end}
      </p>
      {(Object.keys(METRICS) as MetricName[]).map((name) => {
        const result = METRICS[name].run(start, end);
        return (
          <section key={name} style={{ marginTop: 24 }}>
            <h2>{name}</h2>
            <p>{METRICS[name].description}</p>
            <pre style={{ overflow: "auto" }}>
              {JSON.stringify(result.rows, null, 2)}
            </pre>
          </section>
        );
      })}
    </>
  );
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ today?: string; range?: string }>;
}) {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
      <h1>Merchant metrics</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
