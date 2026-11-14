import { chromium, webkit } from "playwright";
const OUT = new URL(".", import.meta.url).pathname.replace(/\/$/, ""); // this folder (docs/evidence/design/v3-r2)
for (const [n, bt] of [["chromium", chromium], ["webkit", webkit]]) {
  const b = await bt.launch();
  for (const theme of ["dark", "light"]) for (const w of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(1200);
    const el = await p.$("#chart-chains"); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ veil: document.querySelectorAll("#chart-chains .shade").length, edge: document.querySelectorAll("#chart-chains .shade-edge").length, bands: document.querySelectorAll("#chart-chains .band.hatched").length, dimmed: document.querySelectorAll("#chart-chains .dim .line").length, label: document.querySelector("#chart-chains .shade-label")?.textContent }));
    if (n === "chromium") await (await p.$("#chart-chains")).screenshot({ path: `${OUT}/chains-${w}-${theme}.png` });
    console.log(n, theme, w, JSON.stringify(r), "errors", errs.length); await ctx.close();
  }
  await b.close();
}
