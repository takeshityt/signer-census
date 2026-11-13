// Requester bubbles: one bubble per real requester from out/metrics.json, area proportional to share. Gentle floating motion, hover/tap/keyboard tooltip.
import { layoutBubbles } from "./bubble-layout.js";
import { esc } from "./md.js";
import { reducedMotion } from "./charts.js";

/** items: [{id, name, account, share, tone, big, detail: [[label, value]]}], onFocus(id|null) optional */
export function createBubbles(host, { items, aria, height = (w) => Math.min(520, Math.max(300, w * 0.46)) }) {
  host.classList.add("bubbles");
  host.innerHTML = `<svg role="group"></svg><div class="btip" role="tooltip"></div>`;
  const svg = host.querySelector("svg"), tip = host.querySelector(".btip");
  svg.setAttribute("aria-label", aria);
  let nodes = [], W = 0, H = 0, raf = 0, t0 = 0, active = null, visible = true;

  function render() {
    W = Math.max(280, Math.round(host.clientWidth)); H = Math.round(height(W));
    const lay = layoutBubbles(items.map((i) => ({ id: i.id, share: i.share })), W, H);
    const by = new Map(items.map((i) => [i.id, i]));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H);
    svg.innerHTML = `<defs><pattern id="hatch-b" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" class="hb"/><rect width="1.4" height="5" class="hl"/></pattern></defs>` + lay.map((p, n) => {
      const it = by.get(p.id), inner = p.r * 1.7; // usable width inside the disc
      const fit = (text, charPx) => (text.length * charPx <= inner ? text : inner / charPx >= 8 ? text.slice(0, Math.floor(inner / charPx) - 1).trimEnd() + "…" : "");
      const nm = it.name.replace(/ connector$/, ""), bigR = p.r > 70;
      const label = p.r > 46 ? `<text class="${bigR ? "big" : ""}" y="${bigR ? -2 : 0}">${esc(fit(nm, bigR ? 9.2 : 6.6))}</text><text class="v" y="${bigR ? 18 : 15}">${esc(it.valueText)}</text>` : p.r > 24 ? `<text y="4">${esc(fit(nm, 6.6))}</text>` : "";
      return `<g class="bubble t-${it.tone}" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(it.name)}, ${esc(it.valueText)} of requests. ${esc(it.account)}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"><g class="float"><circle class="disc" r="${p.r.toFixed(1)}"/>${label}</g></g>`;
    }).join("");
    const hb = svg.querySelector("pattern .hb"), hl = svg.querySelector("pattern .hl");
    hb?.setAttribute("fill", "var(--hatch-bg)"); hl?.setAttribute("fill", "var(--hatch-line)");
    nodes = [...svg.querySelectorAll(".bubble")].map((el, n) => ({ el, f: el.querySelector(".float"), p: lay[n], ph: n * 1.7, per: 6 + (n % 5), amp: Math.min(5, 1.5 + lay[n].r * 0.03) }));
    for (const n of nodes) {
      n.el.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") show(n); });
      n.el.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hide(); });
      n.el.addEventListener("click", (e) => { e.stopPropagation(); active === n ? hide() : show(n); });
      n.el.addEventListener("focus", () => show(n));
      n.el.addEventListener("blur", hide);
      n.el.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
    }
    active = null; tip.classList.remove("on");
  }
  function show(n) {
    const it = items.find((i) => i.id === n.p.id); if (!it) return;
    active = n;
    tip.innerHTML = `<b>${esc(it.name)}</b><span class="acct">${esc(it.account)}</span><dl>${it.detail.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
    tip.classList.add("on");
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = n.p.x + n.p.r * 0.7 + 10, y = n.p.y - h / 2;
    if (x + w > W) x = n.p.x - n.p.r * 0.7 - w - 10;
    x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y));
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
    nodes.forEach((m) => m.el.classList.toggle("on", m === n));
  }
  function hide() { active = null; tip.classList.remove("on"); nodes.forEach((m) => m.el.classList.remove("on")); }
  document.addEventListener("click", (e) => { if (!host.contains(e.target)) hide(); });

  function frame(now) {
    raf = 0; if (!visible || document.hidden) return;
    if (!t0) t0 = now;
    const s = (now - t0) / 1000;
    for (const n of nodes) { const a = (s / n.per) * 2 * Math.PI + n.ph; n.f.setAttribute("transform", `translate(${(Math.sin(a) * n.amp).toFixed(2)} ${(Math.cos(a * 0.83) * n.amp).toFixed(2)})`); }
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!reducedMotion() && !raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) start(); }, { threshold: 0.05 }).observe(host);
  document.addEventListener("visibilitychange", start);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => { nodes.forEach((n) => n.f.removeAttribute("transform")); start(); });
  render();
  new ResizeObserver(() => { if (Math.round(host.clientWidth) !== W) { render(); start(); } }).observe(host);
  return { relayout: render, show: (id) => { const n = nodes.find((m) => m.p.id === id); if (n) show(n); }, hide };
}
