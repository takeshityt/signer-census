import { chromium, webkit } from "playwright";
const OUT = new URL(".", import.meta.url).pathname.replace(/\/$/, ""); // this folder (docs/evidence/design/v3-r2)
const SECTIONS = ["top", "works", "who", "boom", "bridges", "scenario", "wrong", "verify", "rerun"];
const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let fail = 0; const lines = [];
for (const [name, bt] of [["chromium", chromium], ["webkit", webkit]]) {
  const br = await bt.launch();
  for (const theme of ["dark", "light"]) for (const [w, h] of [[390, 844], [1280, 800], [1920, 1080]]) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    const p = await ctx.newPage(); const errs = [];
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); }); p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const css = (el, k) => getComputedStyle(el)[k];
      const tile = document.querySelector(".tile");
      return {
        ready: document.documentElement.dataset.ready, theme: document.documentElement.dataset.theme, sw: document.documentElement.scrollWidth,
        clusters: document.querySelectorAll("#dotcols .col").length, dots: document.querySelectorAll("#dotcols .dc:not(.off)").length, months: document.querySelectorAll("#dotcols .col").length,
        waffle: [...document.querySelectorAll(".wf-grid .sq")].filter((e) => css(e, "opacity") === "1" && (css(e, "backgroundColor") !== "rgba(0, 0, 0, 0)" || css(e, "backgroundImage") !== "none")).length,
        charts: document.querySelectorAll(".chart2 svg").length, cases: document.querySelectorAll("#preds .case").length,
        wide: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".scroll,.top nav,details:not([open])")).slice(0, 3).map((e) => e.className),
        colors: { ink: css(document.body, "color"), paper: css(document.body, "backgroundColor"), tile: css(tile, "backgroundColor"), muted: css(document.querySelector(".micro"), "color"), t2: css(document.querySelector("#h1 .t2"), "color"), acc: css(document.querySelector(".ch-head .micro"), "color") },
      };
    });
    const c = r.colors;
    const contrast = { ink_tile: ratio(c.ink, c.tile), muted_tile: ratio(c.muted, c.tile), muted_paper: ratio(c.muted, c.paper), t2_paper: ratio(c.t2, c.paper) };
    const bad = errs.length || r.ready !== "1" || r.theme !== theme || r.sw !== w || r.clusters !== 28 || r.waffle !== 100 || r.charts !== 6 || r.cases !== 4 || r.wide.length || contrast.muted_tile < 4.5 || contrast.t2_paper < 4.5;
    if (bad) fail++;
    lines.push(`${bad ? "FAIL" : "ok  "} ${name} ${theme} ${w}: dots ${r.dots} in ${r.clusters} month columns, waffle ${r.waffle}, charts ${r.charts}, cases ${r.cases}, scrollWidth ${r.sw}, errors ${errs.length}${r.wide.length ? " wide:" + r.wide : ""}; contrast ink/tile ${contrast.ink_tile.toFixed(1)}, muted/tile ${contrast.muted_tile.toFixed(1)}, muted/paper ${contrast.muted_paper.toFixed(1)}, headline-grey/paper ${contrast.t2_paper.toFixed(1)}${errs.length ? " " + errs.slice(0, 2) : ""}`);
    if (name === "chromium") for (const id of SECTIONS) {
      await p.evaluate((s) => window.scrollTo({ top: s === "top" ? 0 : document.getElementById(s).offsetTop - 56, behavior: "instant" }), id); await p.waitForTimeout(250);
      await p.screenshot({ path: `${OUT}/${String(SECTIONS.indexOf(id)).padStart(2, "0")}-${id}-${w}-${theme}.png` });
    }
    if (name === "webkit" && w === 1280) await p.screenshot({ path: `${OUT}/webkit-hero-1280-${theme}.png` });
    await ctx.close();
  }
  await br.close();
}
console.log(lines.join("\n")); console.log(fail ? `${fail} FAILED` : "ALL PASSED"); process.exit(fail ? 1 : 0);
