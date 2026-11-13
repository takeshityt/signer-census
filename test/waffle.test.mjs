import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { largestRemainder, waffleGroups } from "../site/js/waffle.js";
import { requesterRows } from "../site/js/model.js";

const root = new URL("../", import.meta.url).pathname;
const metrics = JSON.parse(readFileSync(root + "out/metrics.json", "utf8"));
const labels = JSON.parse(readFileSync(root + "site/data/labels.json", "utf8"));
const rows = requesterRows(metrics, labels);

describe("waffle rounding", () => {
  it("always sums to exactly 100, also for awkward shares", () => {
    for (const s of [[0.335, 0.335, 0.33], [0.5, 0.25, 0.25], [1 / 3, 1 / 3, 1 / 3], [0.994, 0.003, 0.003], [0.126, 0.126, 0.126, 0.126, 0.126, 0.126, 0.126, 0.118]]) {
      const c = largestRemainder(s);
      expect(c.reduce((a, b) => a + b, 0)).toBe(100);
      c.forEach((n, i) => expect(Math.abs(n - (s[i] / s.reduce((a, b) => a + b, 0)) * 100)).toBeLessThan(1));
    }
  });
  it("is stable on ties (earlier group first) and never negative", () => {
    expect(largestRemainder([1, 1, 1])).toEqual([34, 33, 33]);
    expect(largestRemainder([0, 1])).toEqual([0, 100]);
  });
  it("real data: top six requesters plus the remainder fill the grid exactly, each within one square of its share", () => {
    const g = waffleGroups(rows, 6, () => "x", (r) => r.account);
    expect(g).toHaveLength(7);
    expect(g.reduce((a, x) => a + x.squares, 0)).toBe(100);
    for (const x of g) expect(Math.abs(x.squares - x.share * 100)).toBeLessThan(1.0001);
    expect(g[0].account).toBe(metrics.totals.top_requesters[0].requester);
    expect(g.at(-1).share).toBeCloseTo(1 - rows.slice(0, 6).reduce((a, r) => a + r.share, 0), 9);
  });
});

describe("sparkline data", () => {
  const rm = JSON.parse(readFileSync(root + "site/data/requester-monthly.json", "utf8"));
  it("has every listed requester for every month and equals out/metrics.json for the tracked drivers", () => {
    expect(rm.months).toEqual(metrics.months.map((m) => m.month));
    for (const r of rows) expect(Object.keys(rm.accounts[r.account])).toHaveLength(rm.months.length);
    for (const m of metrics.months) for (const [a, d] of Object.entries(m.drivers_requests)) if (a !== "__other") expect(rm.accounts[a][m.month]).toBe(d.value);
  });
});
