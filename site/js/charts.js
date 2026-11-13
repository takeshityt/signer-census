// Small SVG chart kit for the dashboard (no dependencies). Bars (stacked), smooth lines and bands over a month axis, with
//  - dated annotations (HTML labels + dotted lines), direct labels instead of a legend,
//  - a crosshair tooltip (pointer and keyboard) that shows 95% intervals,
//  - a draw-in when the chart enters the viewport, and smooth tweens when the data changes (toggles),
//  - everything switched off under prefers-reduced-motion.
// Colors come from CSS classes (t-<tone>), so themes need no redraw. Numbers are never typed here: the caller passes data.
import { esc } from "./md.js";
import { monthShort } from "./format.js";

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Resolves when the page is really on screen: tab visible, fonts in, first frames painted, plus an optional pause. */
export function whenShown(delay = 0) {
  const visible = () => (document.visibilityState === "visible" ? Promise.resolve() : new Promise((r) => document.addEventListener("visibilitychange", function f() { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", f); r(); } })));
  const fonts = document.fonts?.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 700))]) : Promise.resolve();
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return visible().then(() => fonts).then(frames).then(() => new Promise((r) => setTimeout(r, delay)));
}
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Label side: the requested one, flipped when the (nowrap) text would run out of the chart. ~6.3px per character at the label size. */
const sideFor = (want, x, W, text, sub) => {
  const wpx = Math.max(String(text).length, String(sub ?? "").length) * 6.3 + 14;
  let end = want == null ? x > W * 0.6 : want === "end";
  if (end && x - wpx < 0) end = false;
  if (!end && x + wpx > W) end = true;
  return end;
};
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function niceMax(v) {
  if (!(v > 0)) return 1;
  const e = 10 ** Math.floor(Math.log10(v)), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : 10) * e;
}

/** Monotone cubic curve (Fritsch-Carlson, as in d3's curveMonotoneX) through points: smooth, and it never overshoots the data.
 *  A null breaks the line; with smooth=false the points are joined by straight segments. */
export function smoothPath(pts, floor = Infinity, ceil = -Infinity, smooth = true) {
  const sign = (v) => (v < 0 ? -1 : 1);
  const slope3 = (a, b, c) => { const h0 = b[0] - a[0], h1 = c[0] - b[0], s0 = (b[1] - a[1]) / (h0 || 1), s1 = (c[1] - b[1]) / (h1 || 1), p = (s0 * h1 + s1 * h0) / ((h0 + h1) || 1); return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0; };
  const slope2 = (a, b, t) => { const h = b[0] - a[0]; return h ? (3 * (b[1] - a[1]) / h - t) / 2 : t; };
  const f = (v) => v.toFixed(1);
  let d = "", run = [];
  const flush = () => {
    const n = run.length;
    if (n === 1) d += `M${f(run[0][0])},${f(run[0][1])}`;
    else if (n > 1 && !smooth) d += run.map((q, i) => `${i ? "L" : "M"}${f(q[0])},${f(q[1])}`).join("");
    else if (n > 1) {
      const t = new Array(n);
      for (let i = 1; i < n - 1; i++) t[i] = slope3(run[i - 1], run[i], run[i + 1]);
      if (n === 2) { t[0] = t[1] = (run[1][1] - run[0][1]) / ((run[1][0] - run[0][0]) || 1); }
      else { t[0] = slope2(run[0], run[1], t[1]); t[n - 1] = slope2(run[n - 1], run[n - 2], t[n - 2]); }
      d += `M${f(run[0][0])},${f(run[0][1])}`;
      for (let i = 0; i < n - 1; i++) {
        const [x0, y0] = run[i], [x1, y1] = run[i + 1], dx = (x1 - x0) / 3;
        const y0c = Math.max(ceil, Math.min(floor, y0 + dx * t[i])), y1c = Math.max(ceil, Math.min(floor, y1 - dx * (n === 2 ? t[0] : i + 1 === n - 1 ? t[n - 1] : t[i + 1])));
        d += `C${f(x0 + dx)},${f(y0c)} ${f(x1 - dx)},${f(y1c)} ${f(x1)},${f(y1)}`;
      }
    }
    run = [];
  };
  for (const q of pts) { if (q) run.push(q); else flush(); }
  flush();
  return d;
}

/** requestAnimationFrame tween; resolves when done. `cancel()` stops it. */
export function tween(ms, fn, ease = easeInOut) {
  let raf = 0, stopped = false;
  const done = new Promise((res) => {
    let t0 = null; // the clock starts at the first painted frame, so a slow start or a hidden tab never eats the animation
    const step = (now) => {
      if (stopped) return res(false);
      if (t0 === null) t0 = now;
      const t = clamp((now - t0) / ms, 0, 1);
      fn(ease(t));
      if (t < 1) raf = requestAnimationFrame(step); else res(true);
    };
    raf = requestAnimationFrame(step);
  });
  return { done, cancel() { stopped = true; cancelAnimationFrame(raf); } };
}

/** Fractional band coordinate of a month ("2026-10", centre of the band) or of a day ("2026-10-01", exact position inside the month). */
export function bandPos(months, key) {
  const i = months.indexOf(key.slice(0, 7));
  if (i < 0) {
    // outside the axis: extrapolate by whole months
    const [y0, m0] = months[0].split("-").map(Number), [y, m] = key.split("-").map(Number);
    const k = (y - y0) * 12 + (m - m0);
    return key.length > 7 ? k + (Number(key.slice(8, 10)) - 1) / daysIn(y, m) : k + 0.5;
  }
  if (key.length <= 7) return i + 0.5;
  const [y, m] = key.split("-").map(Number);
  return i + (Number(key.slice(8, 10)) - 1) / daysIn(y, m);
}

const lerpVals = (a, b, t) => b.map((v, i) => (v == null || a[i] == null ? v : a[i] + (v - a[i]) * t));

/**
 * spec: {
 *   months: ["2026-10", ...], partial: [bool],
 *   series: [{ id, label, tone, type: "bar"|"line"|"band", values, lo (band), dash }],   // bars are stacked bottom to top in this order
 *   yMin, yMax (optional fixed), yFormat(v), height(width) -> px, margin: {top,right,bottom,left}
 *   events: [{ at: "2026-10-01"|"2026-10", lane, text, sub, href, align }],
 *   labels: [{ id, index, side: "left"|"right", text }],
 *   tip(i) -> { title, rows: [{ tone, label, value, ci }], footer }, aria
 * }
 */
export function createChart(host, init) {
  let spec = init;
  const uid = `c${Math.random().toString(36).slice(2, 8)}`;
  host.classList.add("chart2");
  host.tabIndex = 0;
  host.setAttribute("role", "group");
  host.innerHTML = `<svg class="cv" aria-hidden="true"><defs>
      <pattern id="${uid}h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="hatch-bg"/><rect width="2" height="6" class="hatch-line"/></pattern>
      <clipPath id="${uid}c"><rect x="0" y="-20" width="0" height="2000"/></clipPath></defs>
    <g class="plot"></g><g class="ann"></g><g class="over"></g></svg><div class="ann-layer"></div><div class="tip" hidden></div>`;
  const svg = host.querySelector("svg"), plot = svg.querySelector(".plot"), annG = svg.querySelector(".ann"), over = svg.querySelector(".over");
  const annLayer = host.querySelector(".ann-layer"), tip = host.querySelector(".tip"), clip = svg.querySelector("clipPath rect");

  let g = null;                          // geometry of the current layout
  let cur = null, yMaxCur = 1;           // displayed values / axis max (tweened)
  let entrance = reducedMotion() ? 1 : 0; // 0..1 draw-in progress
  let tw = null, entered = false, hoverI = -1;

  const targetMax = (vals) => {
    if (spec.yMax != null) return spec.yMax;
    const n = spec.months.length;
    let m = 0;
    const bars = spec.series.map((s, k) => ({ s, k })).filter((o) => o.s.type === "bar");
    for (let i = 0; i < n; i++) {
      m = Math.max(m, bars.reduce((a, o) => a + (vals[o.k][i] ?? 0), 0));
      for (const [k, s] of spec.series.entries()) if (s.type === "line") m = Math.max(m, vals[k][i] ?? 0);
    }
    return niceMax(m * 1.04);
  };
  const initVals = () => spec.series.map((s) => (s.type === "band" ? s.values.slice() : s.values.slice()));

  function layout() {
    const W = Math.max(260, Math.round(host.clientWidth));
    const lm = spec.labelMargin && W >= 700 ? spec.labelMargin : 0;   // direct labels live in the right margin; narrow screens get a key instead
    const lanes = spec.lanes ?? 0;
    const mg = { top: 14 + lanes * 42, right: 14 + lm, bottom: 26, left: W < 520 ? 38 : 46, ...(spec.margin ?? {}) };
    host.classList.toggle("has-dl", lm > 0);
    const H = Math.round(typeof spec.height === "function" ? spec.height(W) : spec.height ?? clamp(W * 0.42, 250, 380));
    const n = spec.months.length;
    g = { W, H, mg, n, plotW: W - mg.left - mg.right, plotH: H - mg.top - mg.bottom, bw: (W - mg.left - mg.right) / n };
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    host.style.height = `${H}px`;
  }
  const X = (f) => g.mg.left + f * g.bw;
  const Y = (v, ymax) => {
    const lo = spec.yMin ?? 0;
    return g.mg.top + g.plotH - ((v - lo) / (ymax - lo)) * g.plotH;
  };

  function draw() {
    if (!g || !cur) return;
    const { W, H, mg, n, bw } = g;
    const ymax = yMaxCur, base = mg.top + g.plotH, lo = spec.yMin ?? 0;
    let out = "";
    // gridlines + y labels
    const ticksN = 4;
    for (let k = 0; k <= ticksN; k++) {
      const v = lo + ((ymax - lo) * k) / ticksN, y = Y(v, ymax);
      out += `<line class="grid${k === 0 ? " zero" : ""}" x1="${mg.left}" x2="${W - mg.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="ytick" x="${mg.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${esc(spec.yFormat(v))}</text>`;
    }
    // x labels: as many as fit with ≥ 54px between them, anchored on January/July-style rounding by index
    const step = Math.max(1, Math.ceil(54 / bw));
    for (let i = (n - 1) % step; i < n; i += step) out += `<text class="xtick" x="${X(i + 0.5).toFixed(1)}" y="${H - 7}" text-anchor="middle">${esc(monthShort(spec.months[i]))}</text>`;
    // bands (behind everything)
    spec.series.forEach((s, k) => {
      if (s.type !== "band") return;
      const pts = cur[k].map((v, i) => (v == null ? null : [X(i + 0.5), Y(v, ymax)]));
      const top = Y(spec.bandTop ?? 1, ymax);
      const edge = smoothPath(pts, base, mg.top, false);
      out += `<path class="band t-${s.tone}" d="${edge}L${X(n - 0.5).toFixed(1)},${top.toFixed(1)}L${X(0.5).toFixed(1)},${top.toFixed(1)}Z" clip-path="url(#${uid}c)"/>`;
    });
    // stacked bars
    const barIdx = spec.series.map((s, k) => (s.type === "bar" ? k : -1)).filter((k) => k >= 0);
    if (barIdx.length) {
      const barW = clamp(bw * 0.66, 3, 30);
      for (let i = 0; i < n; i++) {
        const pi = reducedMotion() ? 1 : easeOut(clamp(entrance * 1.7 - (i / Math.max(1, n - 1)) * 0.7, 0, 1));
        let cum = 0;
        const x0 = X(i + 0.5) - barW / 2;
        for (const k of barIdx) {
          const s = spec.series[k], v = (cur[k][i] ?? 0) * pi;
          if (v <= 0.0001) continue;
          const yTop = Y(cum + v, ymax), yBot = Y(cum, ymax);
          const h = Math.max(0, yBot - yTop - (cum > 0 ? 1.2 : 0));
          out += `<rect class="bar t-${s.tone}${spec.partial?.[i] ? " partial" : ""}" x="${x0.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}"${s.tone === "hatch" ? ` style="fill:url(#${uid}h)"` : ""}/>`;
          cum += v;
        }
      }
    }
    // lines
    spec.series.forEach((s, k) => {
      if (s.type !== "line") return;
      const pts = cur[k].map((v, i) => (v == null ? null : [X(i + 0.5), Y(v, ymax)]));
      const dotted = spec.partial?.at(-1) && pts.at(-1) && pts.at(-2) && s.tail !== false;   // the partial last month continues as a dotted tail
      out += `<path class="line t-${s.tone}${s.dash ? " dashed" : ""}" d="${smoothPath(dotted ? pts.slice(0, -1) : pts, base, mg.top, s.smooth !== false)}" clip-path="url(#${uid}c)"/>`;
      if (dotted) { const p = pts.at(-1), q = pts.at(-2); out += `<path class="tail t-${s.tone}" d="M${q[0].toFixed(1)},${q[1].toFixed(1)}L${p[0].toFixed(1)},${p[1].toFixed(1)}" clip-path="url(#${uid}c)"/>`; }
    });
    plot.innerHTML = out;
    clip.setAttribute("width", ((W - mg.left * 0) * (reducedMotion() ? 1 : entrance)).toFixed(1));
  }

  function annotate() {
    if (!g) return;
    const { W, mg } = g, ymax = yMaxCur;
    let lines = "", html = "";
    for (const e of spec.events ?? []) {
      const x = X(bandPos(spec.months, e.at));
      if (x < mg.left - 2 || x > W - mg.right + 2) continue;
      const laneTop = 12 + (e.lane ?? 0) * 42;
      lines += `<line class="evline" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${(laneTop + 4).toFixed(1)}" y2="${(mg.top + g.plotH).toFixed(1)}"/><circle class="evdot" cx="${x.toFixed(1)}" cy="${(laneTop + 4).toFixed(1)}" r="3.2"/>`;
      const end = sideFor(e.align, x, W, e.text, e.sub);
      const inner = `<b>${esc(e.text)}</b>${e.sub ? `<span>${esc(e.sub)}</span>` : ""}`;
      html += `<div class="ev ${end ? "end" : "start"}" style="${end ? `right:${(W - x + 8).toFixed(1)}px` : `left:${(x + 8).toFixed(1)}px`};top:${(laneTop - 4).toFixed(1)}px">${e.href ? `<a href="${esc(e.href)}" rel="noopener noreferrer">${inner}</a>` : inner}</div>`;
    }
    if (host.classList.contains("has-dl")) {
      const vals = spec.series.map((q) => q.values), last = g.n - 1, barW = clamp(g.bw * 0.66, 3, 30);
      const items = [];
      for (const l of spec.labels ?? []) {
        const k = spec.series.findIndex((q) => q.id === l.id); if (k < 0) continue;
        const i = l.index ?? last, s = spec.series[k];
        if (s.type === "bar" && !(vals[k][i] > 0)) continue;   // a hidden series (value 0) gets no label
        let y, x;
        if (s.type === "bar") { let cum = 0; for (const [kk, q] of spec.series.entries()) { if (q.type !== "bar") continue; if (kk === k) break; cum += vals[kk][i] ?? 0; } y = Y(cum + (vals[k][i] ?? 0) / 2, ymax); x = X(i + 0.5) + barW / 2 + 2; }
        else { y = s.type === "band" ? Y(((vals[k][i] ?? spec.bandTop) + spec.bandTop) / 2, ymax) : Y(vals[k][i] ?? 0, ymax); x = X(i + 0.5) + 4; }
        items.push({ l, s, y, ly: y, x });
      }
      items.sort((a, b) => a.y - b.y);
      for (let q = 1; q < items.length; q++) if (items[q].ly < items[q - 1].ly + 20) items[q].ly = items[q - 1].ly + 20;
      const lx = W - mg.right + 12;
      for (const it of items) {
        lines += `<path class="dlline" d="M${it.x.toFixed(1)},${it.y.toFixed(1)}L${(lx - 14).toFixed(1)},${it.y.toFixed(1)}L${(lx - 6).toFixed(1)},${it.ly.toFixed(1)}"/>`;
        html += `<div class="dl start t-${it.s.tone}" style="left:${lx.toFixed(1)}px;top:${it.ly.toFixed(1)}px"><i class="sw"></i><span>${esc(it.l.text)}</span></div>`;
      }
    }
    annG.innerHTML = lines;
    annLayer.innerHTML = html;
    annLayer.classList.toggle("on", entrance >= 0.98);
  }

  function setHover(i) {
    hoverI = i;
    if (i < 0 || !spec.tip) { over.innerHTML = ""; tip.hidden = true; return; }
    const { mg, bw } = g, x = X(i + 0.5), ymax = yMaxCur;
    let o = `<rect class="hoverband" x="${(mg.left + i * bw).toFixed(1)}" y="${mg.top}" width="${bw.toFixed(1)}" height="${g.plotH}"/><line class="cross" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${mg.top}" y2="${mg.top + g.plotH}"/>`;
    spec.series.forEach((s, k) => { if (s.type === "line" && cur[k][i] != null) o += `<circle class="pt t-${s.tone}" cx="${x.toFixed(1)}" cy="${Y(cur[k][i], ymax).toFixed(1)}" r="4.5"/>`; });
    over.innerHTML = o;
    const t = spec.tip(i);
    tip.innerHTML = `<div class="tt-title">${esc(t.title)}</div>${t.rows.map((r) => `<div class="tt-row"><i class="sw t-${r.tone}"></i><span>${esc(r.label)}</span><b>${esc(r.value)}</b>${r.ci ? `<small>${esc(r.ci)}</small>` : ""}</div>`).join("")}${t.footer ? `<div class="tt-foot">${esc(t.footer)}</div>` : ""}`;
    tip.hidden = false;
    const w = tip.offsetWidth, flip = x + 14 + w > g.W - 4;
    tip.style.left = `${clamp(flip ? x - 14 - w : x + 14, 4, g.W - w - 4).toFixed(1)}px`;
    tip.style.top = `${(mg.top + 6).toFixed(1)}px`;
  }

  const idxFromEvent = (ev) => { const r = svg.getBoundingClientRect(); return clamp(Math.floor(((ev.clientX - r.left) - g.mg.left) / g.bw), 0, g.n - 1); };
  svg.addEventListener("pointermove", (ev) => { if (!g || ev.clientX - svg.getBoundingClientRect().left < g.mg.left - 4) return; const i = idxFromEvent(ev); if (i !== hoverI) setHover(i); });
  svg.addEventListener("pointerdown", (ev) => { setHover(idxFromEvent(ev)); });
  host.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") setHover(-1); });
  host.addEventListener("keydown", (ev) => {
    if (!g) return;
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") { ev.preventDefault(); setHover(clamp((hoverI < 0 ? g.n - (ev.key === "ArrowLeft" ? 1 : 2) : hoverI) + (ev.key === "ArrowRight" ? 1 : -1), 0, g.n - 1)); }
    else if (ev.key === "Escape") setHover(-1);
  });
  host.addEventListener("blur", () => setHover(-1));

  function relayout() { layout(); draw(); annotate(); if (hoverI >= 0) setHover(hoverI); }
  function setAria() { host.setAttribute("aria-label", `${spec.aria ?? "Chart"}. Use the arrow keys to read each month; a table version is below.`); }

  function start() {
    layout(); cur = initVals(); yMaxCur = targetMax(cur); setAria(); draw(); annotate();
    new ResizeObserver(() => { const w = Math.round(host.clientWidth); if (g && w !== g.W) relayout(); }).observe(host);
    const enter = () => {
      if (entered) return; entered = true;
      if (reducedMotion()) { entrance = 1; draw(); annotate(); return; }
      tw = tween(1300, (t) => { entrance = t; draw(); if (t >= 0.98) annLayer.classList.add("on"); }, (t) => t); // linear: the per-bar stagger inside draw() provides the easing
    };
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { enter(); io.disconnect(); } }, { threshold: 0.25 }); io.observe(host); } else enter();
  }

  /** Replace data (and anything else in the spec); numeric series are tweened. */
  function update(next) {
    const prev = cur;
    spec = { ...spec, ...next };
    setAria();
    const target = initVals(), ymaxT = targetMax(target), ymaxFrom = yMaxCur;
    annLayer.classList.remove("on");
    tw?.cancel();
    if (reducedMotion() || !entered || !prev || prev.length !== target.length) { cur = target; yMaxCur = ymaxT; relayoutSoft(); return Promise.resolve(); }
    tw = tween(480, (t) => { cur = target.map((tv, k) => lerpVals(prev[k], tv, t)); yMaxCur = ymaxFrom + (ymaxT - ymaxFrom) * t; draw(); });
    return tw.done.then((ok) => { if (ok) { cur = target; yMaxCur = ymaxT; draw(); annotate(); annLayer.classList.add("on"); if (hoverI >= 0) setHover(hoverI); } });
  }
  function relayoutSoft() { draw(); annotate(); annLayer.classList.add("on"); if (hoverI >= 0) setHover(hoverI); }

  start();
  return { update, relayout, get width() { return g?.W; } };
}

/** The hero pen stroke: one smooth line with dated markers whose labels sit in lanes above it. */
export function createHeroStroke(host, { months, values, tailTo = null, events = [], peakIndex = -1, aria }) {
  host.classList.add("hero-stroke");
  host.innerHTML = `<svg aria-hidden="true"><defs><clipPath id="hsc"><rect x="-10" y="-40" width="0" height="600"/></clipPath></defs><g class="b"></g><g class="p" clip-path="url(#hsc)"></g></svg><div class="ann-layer on"></div>`;
  host.setAttribute("role", "img"); host.setAttribute("aria-label", aria ?? "Monthly requests");
  const svg = host.querySelector("svg"), gB = svg.querySelector(".b"), gP = svg.querySelector(".p"), layer = host.querySelector(".ann-layer"), rect = svg.querySelector("rect");
  let progress = reducedMotion() ? 1 : 0, started = false, W = 0, shown = new Set();
  const n = months.length;
  function render() {
    W = Math.max(280, Math.round(host.clientWidth));
    const lanes = events.reduce((m, e) => Math.max(m, (e.lane ?? 0) + 1), 1);
    const top = 14 + lanes * (W < 520 ? 38 : 42), H = top + Math.round(clamp(W * 0.2, 96, 170)), base = H - 12, padX = 6;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H); host.style.height = `${H}px`;
    const max = Math.max(...values, tailTo ?? 0);
    const x = (f) => padX + (f / (n - 1)) * (W - 2 * padX), y = (v) => base - (v / max) * (base - top);
    const pts = values.map((v, i) => [x(i), y(v)]);
    const d = smoothPath(pts, base);
    const tail = tailTo != null ? `<path class="tail" d="M${pts.at(-1)[0].toFixed(1)},${pts.at(-1)[1].toFixed(1)}L${x(n - 1).toFixed(1)},${y(tailTo).toFixed(1)}"/>` : "";
    gB.innerHTML = `<line class="base" x1="0" x2="${W}" y1="${base}" y2="${base}"/>`;
    const yAt = (f) => { const i = clamp(Math.floor(f), 0, pts.length - 2), t = clamp(f - i, 0, 1); return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t; };
    let marks = "", html = ""; shown = new Set();
    events.forEach((e, k) => {
      const f = clamp(bandPos(months, e.at) - 0.5, 0, pts.length - 1), ex = x(f), ey = yAt(f), laneTop = 12 + (e.lane ?? 0) * (W < 520 ? 38 : 42);
      marks += `<g class="mk" data-k="${k}" data-x="${ex.toFixed(1)}"><line class="evline" x1="${ex.toFixed(1)}" x2="${ex.toFixed(1)}" y1="${laneTop + 4}" y2="${ey.toFixed(1)}"/><circle class="evdot" cx="${ex.toFixed(1)}" cy="${laneTop + 4}" r="3.2"/><circle class="onpen" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4.5"/></g>`;
      const end = sideFor(e.align, ex, W, e.text, e.sub);
      html += `<div class="ev ${end ? "end" : "start"}" data-k="${k}" style="${end ? `right:${(W - ex + 8).toFixed(1)}px` : `left:${(ex + 8).toFixed(1)}px`};top:${laneTop - 4}px"><b>${esc(e.text)}</b>${e.sub ? `<span>${esc(e.sub)}</span>` : ""}</div>`;
    });
    const peak = peakIndex >= 0 ? `<circle class="peak" cx="${pts[peakIndex][0].toFixed(1)}" cy="${pts[peakIndex][1].toFixed(1)}" r="5"/>` : "";
    gP.innerHTML = `<path class="ink" d="${d}"/>${tail}${peak}${marks}`;
    layer.innerHTML = html;
    paint();
  }
  function paint() {
    rect.setAttribute("width", ((W + 20) * progress).toFixed(1));
    const edge = (W + 20) * progress - 10;
    gP.querySelectorAll(".mk").forEach((m) => { const on = progress >= 1 || Number(m.dataset.x) <= edge; m.classList.toggle("on", on); layer.querySelector(`.ev[data-k="${m.dataset.k}"]`)?.classList.toggle("on", on); });
  }
  render();
  new ResizeObserver(() => { if (Math.round(host.clientWidth) !== W) render(); }).observe(host);
  return {
    play() { if (started) return; started = true; if (reducedMotion()) { progress = 1; paint(); return; } tween(2800, (t) => { progress = t; paint(); }, easeInOut); },
    get width() { return W; },
  };
}
