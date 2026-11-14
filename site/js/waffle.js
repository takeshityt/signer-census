// Waffle: 10 x 10 squares, each square = 1% of all requests, coloured by requester. Pure rounding + a small UI.
import { esc } from "./md.js";
import { reducedMotion } from "./charts.js";

/** Largest-remainder rounding: integer counts that sum to exactly `total` (default 100). Shares need not sum to 1. */
export function largestRemainder(shares, total = 100) {
  const sum = shares.reduce((a, b) => a + b, 0);
  const exact = shares.map((s) => (s / sum) * total);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i).forEach(({ i }) => { if (left-- > 0) out[i]++; });
  return out;
}

/** Groups for the grid: the `top` largest requesters, then one "everyone else" group holding the remainder (all from the data). */
export function waffleGroups(rows, top, toneOf, nameOf) {
  const head = rows.slice(0, top);
  const rest = Math.max(0, 1 - head.reduce((a, r) => a + r.share, 0));
  const groups = [...head.map((r) => ({ id: r.account, name: nameOf(r), account: r.account, share: r.share, ci: r.shareCi, tone: toneOf(r) })), { id: "__rest", name: "Everyone else", account: `${rows.length - top} more listed requesters and the unlisted tail`, share: rest, ci: null, tone: "muted" }];
  const counts = largestRemainder(groups.map((g) => g.share));
  return groups.map((g, i) => ({ ...g, squares: counts[i] }));
}

/** items from waffleGroups(); text: {shareText(g), ciText(g)} formatters. */
export function createWaffle(host, { groups, text, aria, footnote }) {
  host.classList.add("waffle");
  let k = 0;
  const cells = groups.flatMap((g, gi) => Array.from({ length: g.squares }, (_, j) => ({ g, gi, j, i: k++ })));
  host.innerHTML = `<div class="wf-grid" role="group" aria-label="${esc(aria)}">${cells.map((c) => `<i class="sq t-${c.g.tone}" data-g="${esc(c.g.id)}" style="--n:${c.i};--g:${c.gi};--j:${c.j}"></i>`).join("")}</div>
    <ul class="wf-legend">${groups.map((g) => `<li tabindex="0" class="t-${g.tone}" data-g="${esc(g.id)}"><span class="sw"></span><span class="wf-name">${esc(g.name)}</span><span class="wf-val">${esc(text.shareText(g))}</span><span class="wf-sub">${text.acct ? text.acct(g.account) : esc(g.account)}${text.ciText(g) ? ` · ${esc(text.ciText(g))}` : ""}</span></li>`).join("")}</ul>
    <details class="more wf-foot"><summary>How the squares are rounded</summary><div class="body"><p>${esc(footnote)}</p></div></details>`;
  const all = [...host.querySelectorAll("[data-g]")];
  let pinned = null;
  const mark = (id) => { host.classList.toggle("dim", id != null); all.forEach((el) => el.classList.toggle("hot", id != null && el.dataset.g === id)); };
  for (const el of all) {
    el.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") mark(el.dataset.g); });
    el.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") mark(pinned); });
    el.addEventListener("click", () => { pinned = pinned === el.dataset.g ? null : el.dataset.g; mark(pinned); });
    el.addEventListener("focus", () => mark(el.dataset.g));
    el.addEventListener("blur", () => mark(pinned));
  }
  // Progressive enhancement: the grid is complete and visible from the start. When it scrolls into view (and motion is allowed) the squares
  // replay a short fill-in that starts from, and ends in, the normal visible state (CSS animation-fill backwards).
  const grid = host.querySelector(".wf-grid");
  if (!reducedMotion() && "IntersectionObserver" in window) new IntersectionObserver((es, io) => { if (es.some((e) => e.isIntersecting)) { grid.classList.add("play"); io.disconnect(); } }, { threshold: 0.3 }).observe(grid);
}
