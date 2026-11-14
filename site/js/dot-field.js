// Hero dot field: one cluster of dots per REAL requester (top requesters in out/metrics.json), dots proportional to share
// (dotsPerPercent dots per 1% of all requests). Dots sit on one square grid, so the field reads as a dot matrix.
// Pure layout (tested) + a small SVG renderer. Motion: dots settle in once; nothing depends on the animation finishing.
import { esc } from "./md.js";
import { reducedMotion } from "./charts.js";

/** Number of dots for each share: round(share * 100 * dotsPerPercent), at least one dot (every listed requester stays visible). */
export const dotCounts = (shares, dotsPerPercent = 10) => shares.map((s) => Math.max(1, Math.round(s * 100 * dotsPerPercent)));

/**
 * Pack clusters into a cols x rows grid. Each cluster takes the `n` free grid cells closest to its centre (a dot disc);
 * centres are placed largest first, by a deterministic spiral search for a spot whose disc does not touch other discs.
 * Returns [{id, n, cx, cy, cells:[[col,row],...]}] in grid units. Deterministic, no randomness.
 */
export function layoutClusters(items, cols, rows, { gap = 3.2, avoid = null } = {}) {
  const taken = new Set();
  // an optional reserved rectangle (grid units) stays empty, e.g. for the case card
  if (avoid) for (let gx = Math.floor(avoid.x0); gx < Math.ceil(avoid.x1); gx++) for (let gy = Math.floor(avoid.y0); gy < Math.ceil(avoid.y1); gy++) taken.add(gx + "," + gy);
  const hitsAvoid = (x, y, r) => avoid && x + r > avoid.x0 - 0.5 && x - r < avoid.x1 + 0.5 && y + r > avoid.y0 - 0.5 && y - r < avoid.y1 + 0.5;
  const out = [];
  const placed = [];
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => b.n - a.n || a.i - b.i);
  const radius = (n) => Math.sqrt(n / Math.PI);
  for (const it of order) {
    const r = radius(it.n);
    let best = null;
    const c0 = avoid ? [cols * 0.42, rows * 0.58] : [cols * 0.5, rows * 0.5];
    const fits = (x, y) => !(x - r < 0.5 || y - r < 0.5 || x + r > cols - 0.5 || y + r > rows - 0.5) && !hitsAvoid(x, y, r);
    // spiral from the centre; the first spot that keeps `g` empty cells to every placed disc wins. If the field is crowded, the gap shrinks.
    for (const g of [gap, gap * 0.6, 1, 0.2]) {
      for (let k = 0; k < 8000 && !best; k++) {
        const a = k * 0.5, d = 0.35 * Math.sqrt(k) * 1.2;
        const x = c0[0] + Math.cos(a) * d * (cols / rows), y = c0[1] + Math.sin(a) * d;
        if (fits(x, y) && placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + g)) best = { x, y };
      }
      if (best) break;
    }
    if (!best) { // last resort: the free spot farthest from everything placed (still deterministic)
      let bd = -Infinity;
      for (let x = r + 0.5; x <= cols - r - 0.5; x += 0.5) for (let y = r + 0.5; y <= rows - r - 0.5; y += 0.5) {
        if (hitsAvoid(x, y, r)) continue;
        const d = Math.min(...placed.map((p) => Math.hypot(p.x - x, p.y - y) - p.r - r));
        if (d > bd) { bd = d; best = { x, y }; }
      }
      best ??= { x: c0[0], y: c0[1] };
    }
    placed.push({ x: best.x, y: best.y, r });
    const cand = [];
    const R = Math.ceil(r + 3);
    for (let gx = Math.floor(best.x - R); gx <= Math.ceil(best.x + R); gx++) for (let gy = Math.floor(best.y - R); gy <= Math.ceil(best.y + R); gy++) {
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows || taken.has(gx + "," + gy)) continue;
      cand.push([gx, gy, Math.hypot(gx + 0.5 - best.x, gy + 0.5 - best.y)]);
    }
    cand.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    const cells = cand.slice(0, it.n).map(([gx, gy]) => [gx, gy]);
    cells.forEach(([gx, gy]) => taken.add(gx + "," + gy));
    out[it.i] = { id: it.id, n: it.n, cx: best.x, cy: best.y, r, cells };
  }
  return out;
}

/** Grid size that fits the total dots in a w x h box with roughly `fill` of the cells used. */
export function gridFor(totalDots, w, h, fill = 0.4) {
  const step = Math.max(7, Math.min(16, Math.sqrt((w * h * fill) / totalDots)));
  return { step, cols: Math.floor(w / step), rows: Math.floor(h / step) };
}

/** items: [{id, name, share, tone, label}] (label = text for the hover tag). highlight = id of the cluster with the case card. */
export function createDotField(host, { items, highlight, aria, height = (w) => Math.max(300, Math.min(600, w * 0.85)), reserve = () => null, onLayout }) {
  host.classList.add("dotfield");
  let W = 0;
  function render() {
    W = Math.max(280, Math.round(host.clientWidth));
    const H = Math.round(height(W));
    const counts = dotCounts(items.map((i) => i.share));
    const total = counts.reduce((a, b) => a + b, 0);
    const res = reserve(W, H); // {w, h} in px at the top-right corner, or null
    const { step, cols, rows } = gridFor(total, W - (res ? res.w * 0.35 : 0), H);
    const avoid = res ? { x0: cols - res.w / step - 0.5, y0: 0, x1: cols, y1: res.h / step + 0.5 } : null;
    const lay = layoutClusters(items.map((it, i) => ({ id: it.id, n: counts[i] })), cols, rows, { avoid });
    const offX = (W - cols * step) / 2, offY = (H - rows * step) / 2;
    const px = (g) => offX + (g + 0.5) * step, py = (g) => offY + (g + 0.5) * step;
    const used = new Set(lay.flatMap((c) => c.cells.map(([x, y]) => x + "," + y)));
    let bg = "";
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (!used.has(x + "," + y)) bg += `<circle cx="${px(x).toFixed(1)}" cy="${py(y).toFixed(1)}" r="${(step * 0.09).toFixed(2)}"/>`;
    const dot = step * 0.3;
    const clusters = lay.map((c, k) => {
      const it = items[k];
      const dots = c.cells.map(([x, y], j) => {
        const hatch = it.tone === "hatch" ? ((x + y) % 2 ? " h1" : " h0") : "";
        return `<circle class="d${hatch}" style="--j:${j}" cx="${px(x).toFixed(1)}" cy="${py(y).toFixed(1)}" r="${dot.toFixed(2)}"/>`;
      }).join("");
      const lead = it.id === highlight && res ? `<path class="lead" d="M${(offX + (c.cx + (c.r + 1.4) * 0.7) * step).toFixed(1)},${(offY + (c.cy - (c.r + 1.4) * 0.7) * step).toFixed(1)}L${(W - res.w - 6).toFixed(1)},${(res.h * 0.5).toFixed(1)}"/>` : "";
      const ring = it.id === highlight ? `${lead}<circle class="ring" cx="${(offX + c.cx * step).toFixed(1)}" cy="${(offY + c.cy * step).toFixed(1)}" r="${((c.r + 1.4) * step).toFixed(1)}"/>` : "";
      return `<g class="cl t-${it.tone}" data-id="${esc(it.id)}" tabindex="0" role="img" aria-label="${esc(it.label)}">${ring}${dots}</g>`;
    }).join("");
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${esc(aria)}"><g class="bgdots" aria-hidden="true">${bg}</g>${clusters}</svg><div class="dtag" aria-hidden="true"></div>`;
    host.style.height = `${H}px`;
    const tag = host.querySelector(".dtag");
    host.querySelectorAll(".cl").forEach((g, k) => {
      const c = lay[k];
      const show = () => { tag.textContent = items[k].label; tag.style.left = `${(offX + c.cx * step).toFixed(0)}px`; tag.style.top = `${(offY + (c.cy - c.r - 1.2) * step).toFixed(0)}px`; tag.classList.add("on"); host.classList.add("dim"); g.classList.add("hot"); };
      const hide = () => { tag.classList.remove("on"); host.classList.remove("dim"); g.classList.remove("hot"); };
      g.addEventListener("pointerenter", show); g.addEventListener("pointerleave", hide); g.addEventListener("focus", show); g.addEventListener("blur", hide);
    });
    const hl = lay.find((c) => c.id === highlight);
    onLayout?.({ W, H, highlight: hl ? { x: offX + hl.cx * step, y: offY + hl.cy * step, r: (hl.r + 1.4) * step } : null });
  }
  render();
  // dots settle in once (an enhancement from the visible end state: CSS animation-fill backwards)
  if (!reducedMotion()) host.classList.add("settle");
  new ResizeObserver(() => { if (Math.round(host.clientWidth) !== W) render(); }).observe(host);
}
