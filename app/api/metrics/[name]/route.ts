import { NextResponse } from "next/server";
import { isIsoDate, resolveDateRange } from "@/lib/dates";
import { isMetricName, METRICS } from "@/lib/metrics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!isMetricName(name)) {
    return NextResponse.json(
      { error: `Unknown metric "${name}"`, available: Object.keys(METRICS) },
      { status: 404 },
    );
  }

  const q = new URL(request.url).searchParams;
  try {
    let start = q.get("start");
    let end = q.get("end");
    const range = q.get("range");
    if (range) {
      const today = new Date().toISOString().slice(0, 10);
      const ref = q.get("today") ?? today;
      ({ start, end } = resolveDateRange(range, ref));
    }
    if (!start || !end || !isIsoDate(start) || !isIsoDate(end)) {
      return NextResponse.json(
        { error: "Pass start and end (YYYY-MM-DD), or range=last week" },
        { status: 400 },
      );
    }
    return NextResponse.json(METRICS[name].run(start, end));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bad request" },
      { status: 400 },
    );
  }
}
