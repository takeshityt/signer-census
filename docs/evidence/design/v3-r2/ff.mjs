import { firefox } from "playwright";
const OUT = "/Users/takeshi/Projects/NEAR/signer-census/docs/evidence/design/v3-r2";
const b = await firefox.launch();
for (const theme of ["dark", "light"]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(1500);
  await p.click('.preset[data-i="2"]'); await p.waitForTimeout(600);
  const form = await p.$(".live-controls"); await form.scrollIntoViewIfNeeded();
  await form.screenshot({ path: `${OUT}/firefox-sliders-${theme}.png` });
  console.log(theme, JSON.stringify(await p.evaluate(() => ({ ret: document.getElementById("sl-ret").value, gro: document.getElementById("sl-gro").value, sw: document.documentElement.scrollWidth }))), "errors", errs.length, errs.slice(0, 2));
  await ctx.close();
}
await b.close();
