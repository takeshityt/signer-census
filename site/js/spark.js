// Tiny monthly sparkline (SVG string). Own scale per row; the last month may be partial (drawn dotted). Each month has a hover <title>.
import { esc } from "./md.js";
export function sparkline(values, { labels, partialLast = false, w = 132, h = 30, fmt = String } = {}) {
  const n = values.length, max = Math.max(...values, 1), pad = 3;
  const x = (i) => pad + (i / (n - 1)) * (w - 2 * pad), y = (v) => h - pad - (v / max) * (h - 2 * pad);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const full = partialLast ? pts.slice(0, -1) : pts;
  const d = full.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const tail = partialLast ? `<path class="sp-tail" d="M${full.at(-1)[0].toFixed(1)},${full.at(-1)[1].toFixed(1)}L${pts.at(-1)[0].toFixed(1)},${pts.at(-1)[1].toFixed(1)}"/>` : "";
  const pk = full.reduce((a, p, i) => (values[i] > values[a] ? i : a), 0);
  const step = (w - 2 * pad) / (n - 1);
  const hits = values.map((v, i) => `<rect x="${(x(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${h}" fill="transparent"><title>${esc(labels[i])}: ${esc(fmt(v))}</title></rect>`).join("");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Monthly estimate, ${esc(labels[0])} to ${esc(labels.at(-1))}; peak ${esc(labels[pk])}, ${esc(fmt(values[pk]))}"><path class="sp-base" d="M${pad},${h - pad}H${w - pad}"/><path class="sp-line" pathLength="1" d="${d}"/>${tail}<circle class="sp-pk" cx="${pts[pk][0].toFixed(1)}" cy="${pts[pk][1].toFixed(1)}" r="2.4"/>${hits}</svg>`;
}
