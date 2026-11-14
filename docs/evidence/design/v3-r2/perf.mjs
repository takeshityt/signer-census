import { chromium, webkit } from "playwright";
for (const [n, bt] of [["chromium", chromium], ["webkit", webkit]]) {
  const b = await bt.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {} window.__f = []; let last = performance.now(); const f = (t) => { window.__f.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(3000);
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 300) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(160); }
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const fr = window.__f.slice(5).sort((a, b) => a - b); const med = fr[Math.floor(fr.length / 2)], p95 = fr[Math.floor(fr.length * 0.95)];
    const hidden = [...document.querySelectorAll("[data-reveal]")].filter((e) => getComputedStyle(e).opacity !== "1").length;
    const es = performance.getEntriesByType("resource"); const kb = (f) => Math.round(es.filter(f).reduce((a, e) => a + (e.decodedBodySize || 0), 0) / 1024); const nav = performance.getEntriesByType("navigation")[0];
    return { cls: +window.__cls.toFixed(5), fpsMedian: Math.round(1000 / med), p95FrameMs: Math.round(p95), hiddenAfterScroll: hidden, lineMasks: document.querySelectorAll(".lines-in").length, shellKB: kb((e) => !/data\//.test(e.name) && !/\.woff2/.test(e.name)) + Math.round((nav?.decodedBodySize || 0) / 1024), fontsKB: kb((e) => /\.woff2/.test(e.name)), dataKB: kb((e) => /data\//.test(e.name)), readyMs: document.documentElement.dataset.readyMs };
  });
  console.log(n, JSON.stringify(r), "errors", errs.length, errs.slice(0, 2)); await b.close();
}
