import { chromium } from "playwright";
import { renameSync, readdirSync, mkdirSync } from "node:fs";
const OUT = new URL(".", import.meta.url).pathname.replace(/\/$/, ""); // this folder (docs/evidence/design/v3-r2)
const tmp = new URL("./.vid", import.meta.url).pathname; mkdirSync(tmp, { recursive: true });
const b = await chromium.launch();
async function record(name, fn) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference", recordVideo: { dir: tmp, size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await fn(p);
  const v = p.video(); await ctx.close(); const src = await v.path();
  renameSync(src, `${OUT}/${name}.webm`); console.log(name, "errors", errs.length, errs.slice(0, 2));
}
await record("rec-hero-load", async (p) => { await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(5000); });
await record("rec-boom-scroll", async (p) => {
  await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(800);
  const top = await p.evaluate(() => document.getElementById("boom").offsetTop);
  await p.evaluate((y) => window.scrollTo({ top: y - 40, behavior: "instant" }), top); await p.waitForTimeout(1500);
  for (let k = 0; k < 40; k++) { await p.mouse.wheel(0, 70); await p.waitForTimeout(170); }
  await p.waitForTimeout(1500);
});
await record("rec-verify-click", async (p) => {
  await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(800);
  await p.evaluate(() => window.scrollTo({ top: document.getElementById("verify").offsetTop - 40, behavior: "instant" })); await p.waitForTimeout(1500);
  await p.click("#verify-btn"); await p.waitForTimeout(5500);
  await p.click("#verify-btn"); await p.waitForTimeout(5000);
});
await b.close();
