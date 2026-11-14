#!/usr/bin/env node
// `npm run record:demo`: drives the live dashboard through the shot list of docs/submission/VIDEO_SCRIPT.md while YOU record the screen.
// It only opens and scrolls the public page (read-only): no keys, no wallet, no transactions. The single network action besides loading the page
// is the page's own "Check a random transaction" button (a read-only lookup at a public archival node).
//
//   npm run record:demo            headed Chromium; waits for Enter before starting and before closing
//   npm run record:demo -- --dry   headless dry run; prints the shot timings and whether the Verify badge appeared
//
// One-time setup: npx playwright install chromium
import { chromium } from "playwright";
import { createInterface } from "node:readline/promises";

const URL = process.env.DEMO_URL ?? "https://takeshityt.github.io/signer-census/";
const DRY = process.argv.includes("--dry");
const RELAY = "7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora";
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q) => { if (!DRY) await rl.question(q); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: DRY, args: ["--window-size=1280,860"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: "dark", reducedMotion: "no-preference" }); // a fresh profile every run
await ctx.addInitScript(() => {
  try { localStorage.setItem("theme", "dark"); } catch { /* ignore */ }
  // recording aids only: hide the scrollbar and draw a small cursor ring that the script moves (the real macOS cursor does not follow Playwright)
  document.addEventListener("DOMContentLoaded", () => {
    const st = document.createElement("style");
    st.textContent = `html{scrollbar-width:none}::-webkit-scrollbar{display:none}
      #demo-cursor{position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px solid rgba(255,255,255,.85);border-radius:50%;
        box-shadow:0 0 0 1px rgba(0,0,0,.35);pointer-events:none;z-index:99999;opacity:0;transition:left .7s cubic-bezier(.2,.7,.2,1),top .7s cubic-bezier(.2,.7,.2,1),opacity .3s}
      #demo-cursor.on{opacity:1}#demo-cursor.click{animation:democlick .45s ease-out}
      @keyframes democlick{0%{transform:scale(1)}40%{transform:scale(1.8);border-color:#ec6a33}100%{transform:scale(1)}}`;
    document.head.appendChild(st);
    const c = document.createElement("div"); c.id = "demo-cursor"; document.body.appendChild(c);
  });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 20000 }).catch(() => {});

/* ---------------------------------------------------------------- helpers */
// eased scroll in the page (no jumps); resolves when the scroll has finished
const scrollTo = (y, ms = 1400) => page.evaluate(([y, ms]) => new Promise((res) => {
  const y0 = scrollY, d = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight)) - y0, t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const step = (now) => { const t = Math.min(1, (now - t0) / ms); window.scrollTo({ top: y0 + d * ease(t), behavior: "instant" }); if (t < 1) requestAnimationFrame(step); else res(); };
  requestAnimationFrame(step);
}), [y, ms]);
const topOf = (sel, offset = 64) => page.evaluate(([s, o]) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect().top + scrollY - o : scrollY; }, [sel, offset]);
const centreOn = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return scrollY; const r = el.getBoundingClientRect(); return r.top + scrollY + r.height / 2 - innerHeight / 2; }, sel);
async function pointAt(sel) {
  // if the target is outside the visible area, glide it into view first (eased, no jumps)
  const vis = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return true; const r = el.getBoundingClientRect(); return r.top > 70 && r.bottom < innerHeight - 20; }, sel);
  if (!vis) await scrollTo(await centreOn(sel), 1100);
  const box = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + Math.min(r.width / 2, 80), y: r.top + r.height / 2 }; }, sel);
  if (!box) return null;
  await page.evaluate(({ x, y }) => { const c = document.getElementById("demo-cursor"); if (c) { c.classList.add("on"); c.style.left = `${x}px`; c.style.top = `${y}px`; } }, box);
  await page.mouse.move(box.x, box.y, { steps: 12 }); // a real pointer move, so :hover and the page's hover logic react
  await sleep(700);
  return box;
}
async function clickAt(sel) {
  const box = await pointAt(sel); if (!box) return false;
  await page.evaluate(() => { const c = document.getElementById("demo-cursor"); if (c) { c.classList.remove("click"); void c.offsetWidth; c.classList.add("click"); } });
  if (process.env.DEMO_DEBUG) console.log("  hit:", await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return `${e?.tagName}#${e?.id}.${e?.className}`; }, box), box);
  await page.mouse.click(box.x, box.y);
  return true;
}
let t0 = 0;
const now = () => (performance.now() - t0) / 1000;
const stamp = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor((s % 1) * 10))}`;
const timings = [];
async function shot(n, plannedStart, title) {
  const wait = plannedStart - now(); if (wait > 0) await sleep(wait * 1000); // stay on the timetable of VIDEO_SCRIPT.md
  timings.push({ n, title, planned: plannedStart, actual: +now().toFixed(1) });
  console.log(`▶ shot ${n} at ${stamp(now())}  (planned ${stamp(plannedStart)})  ${title}`);
}

/* ---------------------------------------------------------------- run */
await ask("\nStart your screen recording (Cmd+Shift+5 → Record Selected Portion around the page area), then press Enter ");
await page.reload({ waitUntil: "load" }); // the hero animation plays from the start
errors.length = 0;
t0 = performance.now();

await shot(1, 0, "Hero");
await sleep(7000);

await shot(2, 8, "\"Demand is narrow\" — legend rows");
await scrollTo(await topOf("#who"), 1800);
for (const id of ["fast-auth.near", "tx-bench.near", RELAY]) await pointAt(`.wf-legend li[data-g="${id}"]`);
await page.mouse.move(5, 5); await page.evaluate(() => document.getElementById("demo-cursor")?.classList.remove("on"));

await shot(3, 16, "The boom — steps 1 and 2");
await scrollTo(await topOf("#boom"), 1500);
await scrollTo(await centreOn('#boom-steps .step-card[data-stage="1"]'), 3000);
await sleep(1200);
await scrollTo(await centreOn('#boom-steps .step-card[data-stage="2"]'), 2600);

await shot(4, 25, "The boom — step 3");
await scrollTo(await centreOn('#boom-steps .step-card[data-stage="3"]'), 2600);

await shot(5, 33, "\"Bridges remain\" and \"Where signatures go\"");
await scrollTo(await topOf("#bridges"), 1800);
await sleep(1800);
await scrollTo(await centreOn("#chart-chains"), 2200);

await shot(6, 40, "Scenario presets");
await scrollTo(await centreOn(".live"), 1600);
await clickAt('.preset[data-i="2"]'); await sleep(1600);
await clickAt('.preset[data-i="0"]'); await sleep(900);
await page.evaluate(() => document.getElementById("demo-cursor")?.classList.remove("on"));

await shot(7, 48, "\"What would prove us wrong\"");
await scrollTo(await topOf("#wrong"), 1600);
await scrollTo(await topOf("#countdown", 120), 1400);

await shot(8, 58, "Verify button, then Re-run commands");
await scrollTo(await centreOn(".verify-tile"), 1500);
let badge = null;
for (let attempt = 1; attempt <= 2 && badge !== "ok"; attempt++) {
  await clickAt("#verify-btn");
  await sleep(1500);
  if (!(await page.textContent("#verify-log")).trim()) { console.log("  (click missed the button, clicking it directly)"); await page.locator("#verify-btn").click(); }
  badge = await page.waitForFunction(() => { const f = document.querySelector("#verify-out .flag"); return f && /\b(ok|bad)\b/.test(f.className) ? (f.classList.contains("ok") ? "ok" : f.textContent) : null; }, null, { timeout: 25000 }).then((h) => h.jsonValue()).catch(() => "timeout");
  if (badge !== "ok") console.log(`  ! verify attempt ${attempt}: ${badge}${attempt === 1 ? " — retrying once" : ""}  [log: ${(await page.textContent("#verify-log")).slice(-160)}]`);
}
if (badge !== "ok") console.log("  ! WARNING: the Verify badge did not appear (public node unreachable?). Re-record shot 8 or cut it.");
await sleep(1200);
await page.evaluate(() => document.getElementById("demo-cursor")?.classList.remove("on"));
await scrollTo(await topOf("#rerun"), 1800);
await sleep(1600);
await pointAt("#rerun-steps .step.first code");
const end = now();
await sleep(3000); // hold on the repository link
console.log(`■ end at ${stamp(now())} (held on the repository link from ${stamp(end)})`);

console.log("\nDone — stop the recording");
if (errors.length) console.log("page errors:", errors);
const state = await page.evaluate(() => ({ boom_stage: document.getElementById("boom-stage-label")?.textContent, preset_pressed: document.querySelector('.preset[aria-pressed="true"] b')?.textContent, cards: document.querySelectorAll("#preds .case").length }));
console.log(JSON.stringify({ total_s: +now().toFixed(1), verify_badge: badge === "ok", ...state, page_errors: errors.length, timings }, null, 1));
await ask("Press Enter to close the browser ");
rl.close();
await browser.close();
