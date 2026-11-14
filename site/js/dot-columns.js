// Hero visual: a dot-matrix column chart. One column per month, one dot = `per` requests, dots coloured by group
// (bottom to top: everyone else, bridges, FastAuth, suspected benchmark). Pure maths (tested) + a small SVG renderer.
// Motion: columns settle in left to right once; the final state is the CSS default (animation-fill backwards).
import { esc } from "./md.js";
import { reducedMotion } from "./charts.js";

const NICE = [1, 2, 2.5, 5, 10];
/** Smallest "nice" requests-per-dot so that the tallest column needs at most `rows` dots. */
export function dotUnit(peak, rows) {
  const raw = peak / rows, e = 10 ** Math.floor(Math.log10(raw));
  for (const f of NICE) if (f * e >= raw) return f * e;
  return 10 * e;
}

/** Dots per group for one column: the column gets round(total / per) dots, split between groups by largest remainder. */
export function columnDots(values, per) {
  const total = values.reduce((a, b) => a + b, 0);
  const want = Math.round(total / per);
  const exact = values.map((v) => v / per);
  const out = exact.map(Math.floor);
  let left = want - out.reduce((a, b) => a + b, 0);
  exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i).forEach(({ i }) => { if (left-- > 0) out[i]++; });
  return out;
}

/**
 * host: element; data: {months:[YYYY-MM], partial:[bool], groups:[{id, label, tone, values:[]}]} (groups bottom to top);
 * labelFor(month) -> axis text or "", aria. Returns {peakOf(groupId) -> {x, y} in px of the top dot of that group's tallest column}.
 */
export function createDotColumns(host, { data, aria, rows = 22, height = (w) => Math.max(240, Math.min(440, w * 0.6)), labelFor, onLayout }) {
  host.classList.add("dotcols");
  let W = 0, geo = null;
  const totals = data.months.map((_, i) => data.groups.reduce((a, gr) => a + gr.values[i], 0));
  const per = dotUnit(Math.max(...totals), rows);
  const cols = data.months.map((_, i) => columnDots(data.groups.map((gr) => gr.values[i]), per));
  function render() {
    W = Math.max(280, Math.round(host.clientWidth));
    const H = Math.round(height(W)), axis = 22;
    const n = data.months.length, cw = W / n, step = Math.min(cw, (H - axis) / rows), r = Math.max(1.6, step * 0.32);
    let svg = "";
    const peaks = {};
    cols.forEach((col, i) => {
      const x = (i + 0.5) * cw;
      let k = 0, dots = "";
      col.forEach((cnt, gi) => {
        const gr = data.groups[gi];
        for (let j = 0; j < cnt; j++, k++) {
          const y = H - axis - (k + 0.5) * step;
          dots += `<circle class="dc t-${gr.tone}${gr.tone === "hatch" ? " hollow" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}"/>`;
          if (j === cnt - 1 && (!peaks[gr.id] || cnt > peaks[gr.id].cnt)) peaks[gr.id] = { cnt, x, y, i };
        }
      });
      // empty slots above the column keep the matrix visible
      let empty = "";
      for (let e = k; e < rows; e++) empty += `<circle class="dc off" cx="${x.toFixed(1)}" cy="${(H - axis - (e + 0.5) * step).toFixed(1)}" r="${(r * 0.45).toFixed(2)}"/>`;
      const lab = labelFor(data.months[i]);
      svg += `<g class="col${data.partial[i] ? " partial" : ""}" style="--c:${i}">${empty}${dots}</g>${lab ? `<text class="xt" x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(lab)}</text>` : ""}`;
    });
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(aria(per))}">${svg}</svg>`;
    host.style.height = `${H}px`;
    geo = { W, H, peaks };
    onLayout?.(geo);
  }
  render();
  if (!reducedMotion()) host.classList.add("settle");
  new ResizeObserver(() => { if (Math.round(host.clientWidth) !== W) render(); }).observe(host);
  return { per, cols, get geo() { return geo; } };
}
