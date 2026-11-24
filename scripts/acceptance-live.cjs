// Asks each acceptance question on a running copy of the page in a real browser.
// For every question it saves a screenshot and records the tool call, the answer
// text and how long the first chart took to appear on screen.
//
//   node scripts/acceptance-live.cjs <base-url> <questions.json> <out-dir>
//
// Needs `playwright` (resolve it with NODE_PATH) and, optionally, CHROME_PATH.
// Set MOCK_STREAMS=<file.json> to answer from saved streams instead of the model.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [BASE, QUESTIONS, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const questions = JSON.parse(fs.readFileSync(QUESTIONS, "utf8"));
const mock = process.env.MOCK_STREAMS ? JSON.parse(fs.readFileSync(process.env.MOCK_STREAMS, "utf8")) : null;

function parseStream(body) {
  const out = { call: null, answer: "", error: null };
  for (const line of body.split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    let ev;
    try {
      ev = JSON.parse(line.slice(6));
    } catch {
      continue;
    }
    if (ev.type === "tool-input-available") out.call = { tool: ev.toolName, input: ev.input };
    else if (ev.type === "text-delta") out.answer += ev.delta;
    else if (ev.type === "error") out.error = ev.errorText;
    else if (ev.type === "tool-output-error") out.error = ev.errorText;
  }
  return out;
}

(async () => {
  // Warm up the deployment without using any model requests (the empty body is rejected before the model is called).
  await fetch(BASE).catch(() => {});
  await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const results = [];
  for (const q of questions) {
    const page = await browser.newPage({ viewport: { width: 820, height: 900 }, deviceScaleFactor: 1.5 });
    if (mock) {
      await page.route("**/api/chat", (route) => {
        const text = JSON.parse(route.request().postData()).messages.at(-1).parts.map((p) => p.text).join("");
        route.fulfill({
          status: 200,
          headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
          body: mock[text] ?? 'data: {"type":"error","errorText":"no mock"}\n\n',
        });
      });
    }
    let body = "";
    const finished = new Promise((resolve) => {
      page.on("response", async (r) => {
        if (r.url().endsWith("/api/chat") && r.request().method() === "POST") {
          try {
            body = await r.text();
          } catch {}
          resolve();
        }
      });
    });
    const row = { id: q.id, text: q.text, firstChartSeconds: null, rendered: false, title: "", dates: "", screenshot: "", tooltip: false };
    try {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.fill("input", q.text);
      const t0 = Date.now();
      await page.click("button[type=submit]");
      await page.waitForFunction(
        () => {
          const card = document.querySelector(".answer-card");
          if (card && !card.querySelector(".skeleton")) return true;
          const explain = document.querySelector(".explain");
          if (!card && explain && explain.textContent.trim()) return true;
          return Boolean(document.querySelector("p[role=alert]"));
        },
        undefined,
        { timeout: 60000, polling: 50 },
      );
      row.firstChartSeconds = (Date.now() - t0) / 1000;
      await Promise.race([finished, new Promise((r) => setTimeout(r, 60000))]);
      await page.waitForTimeout(400);
      row.title = (await page.locator(".answer-card h2").first().textContent({ timeout: 500 }).catch(() => "")) || "";
      row.dates = (await page.locator(".answer-card .dates").first().textContent({ timeout: 500 }).catch(() => "")) || "";
      const failed = (await page.locator("p[role=alert], .answer-card .error-note").count()) > 0;
      const hasCard = (await page.locator(".answer-card").count()) > 0;
      const hasText = ((await page.locator(".explain").first().textContent({ timeout: 500 }).catch(() => "")) || "").trim() !== "";
      row.rendered = !failed && (hasCard || hasText);
      const hits = page.locator(".chart-svg .hit");
      if ((await hits.count()) > 0) {
        const idx = await hits.evaluateAll((els) => {
          let best = 0;
          els.forEach((el, i) => {
            if (Number(el.getAttribute("cy")) < Number(els[best].getAttribute("cy"))) best = i;
          });
          return best;
        });
        await hits.nth(idx).hover({ force: true });
        await page.waitForTimeout(200);
        row.tooltip = (await page.locator(".tooltip").count()) > 0;
      }
      row.screenshot = `${q.id}.png`;
      await page.screenshot({ path: path.join(OUT, row.screenshot), fullPage: true });
    } catch (e) {
      row.pageError = String(e).slice(0, 300);
      try {
        row.screenshot = `${q.id}-error.png`;
        await page.screenshot({ path: path.join(OUT, row.screenshot), fullPage: true });
      } catch {}
    }
    Object.assign(row, parseStream(body));
    results.push(row);
    console.log(q.id, row.call ? row.call.tool : "none", row.firstChartSeconds, row.rendered ? "rendered" : "NOT rendered", row.error || row.pageError || "");
    await page.close();
    await new Promise((r) => setTimeout(r, 3000));
  }
  fs.writeFileSync(path.join(OUT, "capture.json"), JSON.stringify(results, null, 2));
  await browser.close();
})();
