// The "+" field: a grid of small plus signs behind the hero and the re-run block. Marks near the pointer grow and darken (cursor reveal);
// on touch screens a slow wave runs by itself; under reduced motion it is one static, faint grid. Own design: a plain canvas, nothing copied.
import { reducedMotion } from "./charts.js";

export function createPlusField(section, { step = 36 } = {}) {
  const cv = document.createElement("canvas");
  cv.className = "field"; cv.setAttribute("aria-hidden", "true");
  section.classList.add("has-field"); section.prepend(cv);
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1, mx = -9999, my = -9999, tm = 0, raf = 0, visible = true, touch = false, color = "#888", cols = 0, rows = 0;
  const css = () => { const s = getComputedStyle(document.documentElement); color = s.getPropertyValue("--ink").trim() || "#111"; };

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = section.clientWidth; H = section.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cols = Math.ceil(W / step) + 1; rows = Math.ceil(H / step) + 1;
    css(); draw(0);
  }
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = color; ctx.lineCap = "round";
    const R = 130, still = reducedMotion();
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = i * step + step / 2, y = j * step + step / 2;
      let k = 0;
      if (!still) {
        if (touch) k = Math.max(0, Math.sin(i * 0.35 + j * 0.28 - t / 900)) ** 6;
        else { const d = Math.hypot(x - mx, y - my); k = d < R ? (1 - d / R) ** 2 : 0; }
      }
      const half = 3 + k * 4.5;
      ctx.globalAlpha = 0.17 + k * 0.6; ctx.lineWidth = 1 + k * 0.4;
      ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); ctx.moveTo(x, y - half); ctx.lineTo(x, y + half); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function loop(now) { raf = 0; if (!visible || document.hidden || reducedMotion()) return; draw(now); raf = requestAnimationFrame(loop); }
  const start = () => { if (!raf && visible && !reducedMotion() && !document.hidden && (touch || mx > -9000)) raf = requestAnimationFrame(loop); };
  section.addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; const r = section.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; start(); });
  section.addEventListener("pointerleave", () => { mx = my = -9999; if (!raf) draw(0); });
  touch = matchMedia("(hover: none)").matches;
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) { touch = matchMedia("(hover: none)").matches; start(); } }, { threshold: 0 }).observe(section);
  new ResizeObserver(() => { if (section.clientWidth !== W || section.clientHeight !== H) size(); }).observe(section);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { css(); draw(0); });
  new MutationObserver(() => { css(); draw(0); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("visibilitychange", start);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => draw(0));
  size(); start();
  return { redraw: () => { css(); draw(0); } };
}
