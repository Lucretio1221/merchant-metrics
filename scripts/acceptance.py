"""Runs Erik's acceptance questions against a running chat route and scores them.

    python scripts/acceptance.py <base-url> <questions.xlsx> <results.csv>
    python scripts/acceptance.py --score <capture.json> <questions.xlsx> <results.csv>

The second form scores a run captured by scripts/acceptance-live.cjs (real browser).

Time to first chart = seconds from sending the question until the tool result
arrives (the page draws the chart at that moment). For questions with no tool
call it is the time to the first text.
"""
import csv
import json
import sys
import time
import urllib.request

import openpyxl

SCORE_ONLY = sys.argv[1] == "--score"
if SCORE_ONLY:
    CAPTURE, XLSX, OUT = sys.argv[2], sys.argv[3], sys.argv[4]
else:
    BASE, XLSX, OUT = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3]
DEFAULT_RANGE = ("2025-09-27", "2025-10-26")
TOOL_FOR = {
    "Sales": ["daily_sales"],
    "Top Products": ["units_sold_by_product"],
    "Returns": ["returns_by_product", "returned_order_lines"],
    "Repeat Customers": ["returning_customers"],
}
CHANNELS = ["Online Store", "Shop app", "Point of Sale", "Instagram"]


def ask(text):
    body = json.dumps({"messages": [{"id": "1", "role": "user", "parts": [{"type": "text", "text": text}]}]}).encode()
    req = urllib.request.Request(BASE + "/api/chat", data=body, headers={"Content-Type": "application/json"})
    start = time.time()
    call, output, first, answer, error = None, None, None, "", None
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            for raw in res:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data: ") or line == "data: [DONE]":
                    continue
                ev = json.loads(line[6:])
                t = ev.get("type")
                if t == "tool-input-available":
                    call = {"tool": ev["toolName"], "input": ev["input"]}
                elif t == "tool-output-available":
                    output = ev["output"]
                    first = first or time.time() - start
                elif t == "tool-output-error" or t == "error":
                    error = ev.get("errorText", "error")
                elif t == "text-delta":
                    first = first or time.time() - start
                    answer += ev["delta"]
    except Exception as e:  # noqa: BLE001
        error = str(e)
    return call, output, first, answer, error, time.time() - start


def expected_range(text):
    if ".." in text:
        a, b = text.split("..")
        return (a, b)
    return DEFAULT_RANGE


def score(row, call, output, answer, error):
    metric, rng, filt = row["metric"], row["range"], row["filter"]
    if metric == "Out of Scope":
        ok = call is None and not error and ("don't have" in answer.lower() or "do not have" in answer.lower() or "no data" in answer.lower())
        return ok, "no tool call and a plain no-data message" if ok else "should not call a tool; needs a no-data message"
    if call is None:
        return False, "no tool called"
    if call["tool"] not in TOOL_FOR[metric]:
        return False, f"wrong tool {call['tool']}"
    a = call["input"]
    if (a.get("start"), a.get("end")) != expected_range(rng):
        return False, f"dates {a.get('start')}..{a.get('end')} expected {expected_range(rng)[0]}..{expected_range(rng)[1]}"
    if filt.startswith("Category:"):
        wanted = [w.strip().lower() for w in filt[9:].split(",")]
        got = " ".join(a.get("categories") or []).lower()
        if not any(w[:4] in got for w in wanted):
            return False, f"missing category filter {filt}"
    if filt.startswith("Channel:"):
        wanted = [w.strip() for w in filt[8:].split(",")]
        got = a.get("channels") or []
        if not all(w in got for w in wanted if w in CHANNELS):
            return False, f"missing channel filter {filt}"
    if filt == "None" and (a.get("categories") or a.get("channels")):
        return False, "filters sent but none asked for"
    return True, "right tool, dates and filters"


def main():
    wb = openpyxl.load_workbook(XLSX)
    ws = wb["Acceptance Questions"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    results = []
    captured = {c["id"]: c for c in json.load(open(CAPTURE, encoding="utf-8"))} if SCORE_ONLY else {}
    for r in rows:
        qid, text, _, metric, _, rng, filt = r[:7]
        row = {"metric": metric, "range": rng, "filter": filt}
        if SCORE_ONLY:
            c = captured[qid]
            call, output, first, answer, error = c.get("call"), None, c.get("firstChartSeconds"), c.get("answer") or "", c.get("error") or c.get("pageError")
            rendered = bool(c.get("rendered")) and not error
        else:
            call, output, first, answer, error, total = ask(text)
            rendered = error is None and (output is not None or answer.strip() != "")
        ok, why = score(row, call, output, answer, error)
        if qid == "AQ-05" and call and call["tool"] in ("daily_sales", "returns_by_product"):
            a = call["input"]
            if (a.get("start"), a.get("end")) == ("2025-10-20", "2025-10-26"):
                ok, why = True, "one correct chart (sales or returns)"
        results.append(
            {
                "Question ID": qid,
                "Question Text": text,
                "Tool Called": call["tool"] if call else "none",
                "Arguments Sent": json.dumps(call["input"]) if call else "",
                "Correct Call (Y/N)": "Y" if ok else "N",
                "Why": why,
                "Rendered Without Crash (Y/N)": "Y" if rendered else "N",
                "Seconds To First Chart": f"{first:.1f}" if first is not None else "",
                "Answer": answer.strip().replace("\n", " ")[:200],
                "Error": error or "",
            }
        )
        print(qid, results[-1]["Tool Called"], results[-1]["Correct Call (Y/N)"], results[-1]["Rendered Without Crash (Y/N)"], results[-1]["Seconds To First Chart"], why, flush=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader()
        w.writerows(results)
    correct = sum(x["Correct Call (Y/N)"] == "Y" for x in results)
    crashes = sum(x["Rendered Without Crash (Y/N)"] == "N" for x in results)
    times = [float(x["Seconds To First Chart"]) for x in results if x["Seconds To First Chart"]]
    slow = [x["Question ID"] for x in results if not x["Seconds To First Chart"] or float(x["Seconds To First Chart"]) >= 5.0]
    print(f"\nCorrect calls: {correct}/20 (need 18)  Crashes: {crashes} (need 0)  Slowest: {max(times):.1f}s  Over 5s: {slow}")


main()
