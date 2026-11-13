// Pure layout for the requester bubbles: radius = k * sqrt(share), so AREA is proportional to share (same k for every bubble),
// packed without overlap by a small deterministic relaxation (no randomness: the same data gives the same picture).
export function layoutBubbles(items, W, H, { fill = 0.5, gap = 3, iterations = 420 } = {}) {
  const total = items.reduce((a, i) => a + i.share, 0);
  if (!items.length || !(total > 0)) return [];
  let k = Math.sqrt((fill * W * H) / (Math.PI * total)); // sum of areas = fill * canvas
  const maxShare = Math.max(...items.map((i) => i.share));
  k = Math.min(k, (0.46 * H) / Math.sqrt(maxShare), (0.46 * W) / Math.sqrt(maxShare));
  const b = [...items].sort((x, y) => y.share - x.share).map((i, n) => {
    const r = k * Math.sqrt(i.share), ang = n * 2.399963, rad = Math.sqrt(n + 0.5) * Math.min(W, H) * 0.09;
    return { id: i.id, share: i.share, r, x: W / 2 + Math.cos(ang) * rad * (W / H) * 0.7, y: H / 2 + Math.sin(ang) * rad };
  });
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (const p of b) { p.x += (W / 2 - p.x) * 0.005 * cool; p.y += (H / 2 - p.y) * 0.02 * cool; } // gentle pull to the middle (stronger on y: the canvas is wide)
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const p = b[i], q = b[j];
      let dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      const need = p.r + q.r + gap;
      if (d < need) {
        if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
        const push = (need - d) / 2, ux = dx / d, uy = dy / d, wp = q.r / (p.r + q.r), wq = p.r / (p.r + q.r); // the lighter bubble moves more
        p.x -= ux * push * 2 * wp; p.y -= uy * push * 2 * wp; q.x += ux * push * 2 * wq; q.y += uy * push * 2 * wq;
      }
    }
    for (const p of b) { p.x = Math.min(W - p.r - 1, Math.max(p.r + 1, p.x)); p.y = Math.min(H - p.r - 1, Math.max(p.r + 1, p.y)); }
  }
  return b;
}
