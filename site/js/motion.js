// Text and tile motion for the page. Every effect runs once per element, starts only when the element is on screen,
// and always ends in the normal, fully visible state. Under prefers-reduced-motion nothing here animates.
import { reducedMotion } from "./charts.js";

/** Run fn(el) once when el first becomes visible (or right away when observers are unavailable). */
export function onceVisible(el, fn, threshold = 0.35) {
  if (!el) return;
  if (!("IntersectionObserver" in window)) { fn(el); return; }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(el); } }, { threshold });
  io.observe(el);
}

/** Tiles: a soft light spot follows the pointer inside the hovered tile; touch gets the same state for a moment. */
export function tileHover(root = document) {
  root.addEventListener("pointermove", (e) => {
    const t = e.target.closest?.(".tile"); if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`); t.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
  }, { passive: true });
  root.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    const t = e.target.closest?.(".tile"); if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`); t.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
    t.classList.add("touched"); setTimeout(() => t.classList.remove("touched"), 700);
  }, { passive: true });
}

/** Headline: split into visual lines, slide each line up out of a mask, then put the original markup back (so wrapping stays natural). */
export function revealLines(el) {
  if (!el || reducedMotion()) return;
  const original = el.innerHTML;
  const parts = [...el.children].length ? [...el.children] : [el];
  const lines = [];
  for (const part of parts) {
    const words = part.textContent.split(/(\s+)/).filter((w) => w.length);
    part.innerHTML = words.map((w) => (/^\s+$/.test(w) ? w : `<span class="w">${w.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</span>`)).join("");
    let curTop = null, cur = null;
    for (const w of part.querySelectorAll(".w")) {
      if (w.offsetTop !== curTop) { curTop = w.offsetTop; cur = { part, words: [] }; lines.push(cur); }
      cur.words.push(w.textContent);
    }
  }
  const byPart = new Map();
  lines.forEach((l, i) => { if (!byPart.has(l.part)) byPart.set(l.part, []); byPart.get(l.part).push(`<span class="ln"><span class="li" style="--l:${i}">${l.words.join(" ").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</span></span>`); });
  for (const [part, html] of byPart) part.innerHTML = html.join("");
  el.classList.add("lines-in");
  setTimeout(() => { el.classList.remove("lines-in"); el.innerHTML = original; }, 700 + lines.length * 90 + 200);
}

/** Type the text on, character by character. Done with a stepped clip of the full text, so the layout never changes (no shift). */
export function typeOn(el, speed = 22) {
  if (!el || reducedMotion() || !el.animate) return;
  const n = Math.max(1, el.textContent.length);
  if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
  el.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: n * speed, easing: `steps(${n}, end)`, fill: "backwards" });
}

/** Split-flap: digits in the element's text nodes flip through random digits and settle left to right on their real value. */
export function flip(el, { ms = 650, delay = 0 } = {}) {
  if (!el || reducedMotion()) return Promise.resolve();
  const nodes = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { if (/\d/.test(c.nodeValue)) nodes.push({ c, v: c.nodeValue }); } else walk(c); } };
  walk(el);
  if (!nodes.length) return Promise.resolve();
  const digits = nodes.reduce((a, n) => a + (n.v.match(/\d/g) || []).length, 0);
  return new Promise((res) => setTimeout(() => {
    // freeze the box while digits change, so nothing around it moves (no layout shift)
    const box = el.getBoundingClientRect(), prevW = el.style.width, prevD = el.style.display;
    if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
    el.style.width = `${box.width}px`; el.style.whiteSpace = "nowrap";
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const settled = Math.floor(p * (digits + 1));
      let k = 0;
      for (const n of nodes) n.c.nodeValue = n.v.replace(/\d/g, (d) => (k++ < settled ? d : String(Math.floor(Math.random() * 10))));
      if (p < 1) requestAnimationFrame(step); else { for (const n of nodes) n.c.nodeValue = n.v; el.style.width = prevW; el.style.display = prevD; el.style.whiteSpace = ""; res(); }
    };
    requestAnimationFrame(step);
  }, delay));
}

/** Roll a number to a new value (re-renders through `render(value)`), used by the scenario result. */
export function roll(from, to, render, ms = 450) {
  if (reducedMotion() || from === to) { render(to); return; }
  const t0 = performance.now();
  const step = (now) => { const p = Math.min(1, (now - t0) / ms), e = 1 - (1 - p) ** 3; render(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); else render(to); };
  requestAnimationFrame(step);
}
