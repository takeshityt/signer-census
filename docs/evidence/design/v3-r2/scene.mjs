import { chromium } from "playwright";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(1200);
const out = [];
for (const s of [0, 1, 2, 3]) {
  await p.evaluate((s) => { const el = s ? document.querySelector(`#boom-steps .step-card[data-stage="${s}"]`) : document.getElementById("boom"); const r = el.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top + (s ? r.height / 2 - innerHeight / 2 : -40), behavior: "instant" }); }, s);
  await p.waitForTimeout(1600);
  out.push(await p.evaluate(() => ({ label: document.getElementById("boom-stage-label").textContent, coral: document.querySelectorAll("#chart-boom .bar.t-fastauth").length, relay: document.querySelectorAll("#chart-boom .bar.t-relay").length, ghost: document.querySelectorAll("#chart-boom .bar.t-ghost").length, events: document.querySelectorAll("#chart-boom .ann-layer .ev").length, sticky: getComputedStyle(document.querySelector(".scene-chart")).position, count: document.querySelector(".stepcount")?.textContent })));
  await p.screenshot({ path: `/Users/takeshi/Projects/NEAR/signer-census/docs/evidence/design/v3-r2/boom-scene-step${s}-1280-dark.png` });
}
console.log(JSON.stringify(out, null, 0), errs);
await b.close();
