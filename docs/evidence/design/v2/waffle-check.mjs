import { webkit, chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
const ROOT = new URL("../../../../", import.meta.url).pathname.replace(/\/$/, ""); // repository root
const { waffleGroups } = await import(`${ROOT}/site/js/waffle.js`);
const { requesterRows, requesterName, requesterTone } = await import(`${ROOT}/site/js/model.js`);
const metrics = JSON.parse(readFileSync(`${ROOT}/out/metrics.json`)), labels = JSON.parse(readFileSync(`${ROOT}/site/data/labels.json`));
const rows = requesterRows(metrics, labels);
const WT = { "near-infra:bridge-omni": "bridge-dark", "near-infra:bridge-btc": "bridge-mid", "near-infra:bridge-zcash": "bridge-light" };
const expected = {}; for (const g of waffleGroups(rows, 6, (r) => WT[r.category] ?? (requesterTone(r) === "muted" ? "base" : requesterTone(r)), requesterName)) expected[g.tone] = (expected[g.tone] ?? 0) + g.squares;
const RGB = { light: { fastauth: "rgb(212, 80, 30)", "bridge-dark": "rgb(23, 115, 74)", "bridge-mid": "rgb(47, 158, 111)", "bridge-light": "rgb(124, 199, 162)", base: "rgb(104, 115, 126)", muted: "rgb(195, 200, 205)" }, dark: { fastauth: "rgb(229, 96, 43)", "bridge-dark": "rgb(47, 168, 116)", "bridge-mid": "rgb(70, 181, 133)", "bridge-light": "rgb(134, 211, 174)", base: "rgb(133, 143, 153)", muted: "rgb(58, 66, 73)" } };
const out = []; let fail = 0;
const snap = (p) => p.evaluate(() => [...document.querySelectorAll(".wf-grid .sq")].map((e) => { const c = getComputedStyle(e), t = [...e.classList].find((x) => x.startsWith("t-")).slice(2); return { t, op: c.opacity, bg: c.backgroundColor, img: c.backgroundImage }; }));
function check(label, sq, scheme, strict = true) {
  const errs = [];
  if (sq.length !== 100) errs.push(`count ${sq.length}`);
  const counts = {}; sq.forEach((s) => { counts[s.t] = (counts[s.t] ?? 0) + 1; });
  if (JSON.stringify(Object.entries(counts).sort()) !== JSON.stringify(Object.entries(expected).sort())) errs.push(`per-category ${JSON.stringify(counts)} != ${JSON.stringify(expected)}`);
  sq.forEach((s, i) => { if (s.op !== "1") errs.push(`#${i} opacity ${s.op}`); const solid = s.bg !== "rgba(0, 0, 0, 0)" && s.bg !== "transparent"; if (!solid && s.img === "none") errs.push(`#${i} no fill`); if (s.t !== "hatch" && strict && s.bg !== RGB[scheme][s.t]) errs.push(`#${i} ${s.t} resolves to ${s.bg}`); });
  const order = sq.map((s) => s.t); const runs = order.filter((t, i) => i === 0 || t !== order[i - 1]).length; if (runs !== Object.keys(counts).length) errs.push("groups not contiguous");
  if (errs.length) fail++;
  out.push(`${errs.length ? "FAIL" : "ok  "} ${label}${errs.length ? " :: " + [...new Set(errs)].slice(0, 4).join("; ") : ""}`);
}
for (const [name, bt] of [["webkit", webkit], ["chromium", chromium]]) {
  let br; try { br = await bt.launch(); } catch (e) { out.push(`SKIP ${name}: ${String(e.message).split("\n")[0]}`); continue; }
  for (const scheme of ["light", "dark"]) for (const variant of ["plain", "no-color-mix", "no-IntersectionObserver", "reduced-motion"]) {
    const ctx = await br.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme, reducedMotion: variant === "reduced-motion" ? "reduce" : "no-preference" });
    const p = await ctx.newPage();
    if (variant === "no-color-mix") await p.route("**/css/style.css", async (r) => { const res = await r.fetch(); let t = await res.text(); t = t.replace(/[^;{}]*color-mix\([^;}]*;?/g, ""); await r.fulfill({ response: res, body: t }); });
    if (variant === "no-IntersectionObserver") await p.addInitScript(() => { window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }; });
    await p.goto("http://127.0.0.1:4173/"); await p.waitForTimeout(1800);
    const label = `${name} ${scheme} ${variant}`;
    check(label + " (on load, no interaction)", await snap(p), scheme, variant !== "no-color-mix" ? true : false);
    if (variant === "plain") {
      await p.evaluate(() => document.querySelector("#waffle").scrollIntoView({ block: "center" })); await p.waitForTimeout(2500);
      const before = await snap(p); check(label + " (scrolled into view, after animation)", before, scheme);
      await p.screenshot({ path: `${ROOT}/docs/evidence/design/v2/waffle-${name}-${scheme}-before-hover.png` });
      const box = await p.evaluate(() => { const r = document.querySelector('.wf-grid .sq[data-g="fast-auth.near"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await p.mouse.move(box.x, box.y); await p.waitForTimeout(500);
      const after = await snap(p);
      const same = after.every((s, i) => s.t === before[i].t && s.bg === before[i].bg && s.img === before[i].img);
      const dimmed = await p.evaluate(() => document.querySelectorAll(".waffle.dim .sq:not(.hot)").length);
      const hotOk = after.filter((s, i) => s.t === "fastauth").every((s) => s.op === "1");
      if (!same || !hotOk || dimmed !== 56) fail++;
      out.push(`${same && hotOk && dimmed === 56 ? "ok  " : "FAIL"} ${label} hover: fills unchanged=${same}, hovered group opacity 1=${hotOk}, other squares dimmed=${dimmed}`);
      await p.screenshot({ path: `${ROOT}/docs/evidence/design/v2/waffle-${name}-${scheme}-hover.png` });
    }
    await ctx.close();
  }
  await br.close();
}
console.log(out.join("\n")); console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED"); process.exit(fail ? 1 : 0);
