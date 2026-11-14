import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dotCounts, layoutClusters, gridFor } from "../site/js/dot-field.js";
import { requesterRows, splitHeadline, headline } from "../site/js/model.js";

const root = new URL("../", import.meta.url).pathname;
const metrics = JSON.parse(readFileSync(root + "out/metrics.json", "utf8"));
const labels = JSON.parse(readFileSync(root + "site/data/labels.json", "utf8"));
const thesis = JSON.parse(readFileSync(root + "site/data/thesis.json", "utf8"));
const rows = requesterRows(metrics, labels);
const counts = dotCounts(rows.map((r) => r.share));

describe("hero dot field", () => {
  it("one cluster per real requester, ten dots per percent of all requests (no decorative clusters)", () => {
    expect(counts).toHaveLength(metrics.totals.top_requesters.length);
    rows.forEach((r, i) => expect(Math.abs(counts[i] - r.share * 1000)).toBeLessThanOrEqual(0.5 + (counts[i] === 1 ? 1 : 0)));
  });
  it("at the page sizes every cluster gets exactly its dots, compact around its own centre, no cell used twice, reserved card corner empty", () => {
    for (const [w, h, res] of [[640, 544, { w: 320, h: 240 }], [800, 600, { w: 320, h: 240 }], [358, 304, null]]) {
      const total = counts.reduce((a, b) => a + b, 0);
      const g = gridFor(total, w - (res ? res.w * 0.35 : 0), h);
      const avoid = res ? { x0: g.cols - res.w / g.step - 0.5, y0: 0, x1: g.cols, y1: res.h / g.step + 0.5 } : null;
      const lay = layoutClusters(rows.map((r, i) => ({ id: r.account, n: counts[i] })), g.cols, g.rows, { avoid });
      const seen = new Set();
      lay.forEach((c, i) => {
        expect(c.id).toBe(rows[i].account);
        expect(c.cells).toHaveLength(counts[i]);
        for (const [x, y] of c.cells) {
          const k = x + "," + y; expect(seen.has(k)).toBe(false); seen.add(k);
          expect(Math.hypot(x + 0.5 - c.cx, y + 0.5 - c.cy)).toBeLessThanOrEqual(c.r + 1.6); // a disc, not a ring around another cluster
          if (avoid) expect(x >= Math.floor(avoid.x0) && y < Math.ceil(avoid.y1)).toBe(false);
          expect(x >= 0 && y >= 0 && x < g.cols && y < g.rows).toBe(true);
        }
      });
      expect(layoutClusters(rows.map((r, i) => ({ id: r.account, n: counts[i] })), g.cols, g.rows, { avoid })).toEqual(lay); // deterministic
    }
  });
});

describe("two-tone headline", () => {
  it("splits the THESIS headline into its first sentence and the rest, losing nothing", () => {
    const h = headline(thesis), [a, b] = splitHeadline(h);
    expect(a).toBe("Chain Signatures works.");
    expect(`${a} ${b}`).toBe(h);
    expect(splitHeadline("No full stop")).toEqual(["No full stop", ""]);
  });
});
