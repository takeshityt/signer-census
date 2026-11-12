import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { niceMax, smoothPath, bandPos } from "../site/js/charts.js";

describe("chart helpers", () => {
  it("niceMax rounds up to a 1/2/4/5/10 step", () => {
    expect(niceMax(0.93)).toBe(1); expect(niceMax(897000)).toBe(1000000); expect(niceMax(1010000)).toBe(2000000); expect(niceMax(240)).toBe(400);
    expect(niceMax(0)).toBe(1);
  });
  it("smoothPath is monotone: between two points the curve never leaves their y range (no overshoot)", () => {
    const pts = [[0, 100], [10, 100], [20, 20], [30, 20], [40, 90]]; // flat, drop, flat, rise
    const d = smoothPath(pts);
    const nums = [...d.matchAll(/C([\d.]+),([\d.-]+) ([\d.]+),([\d.-]+) ([\d.]+),([\d.-]+)/g)].map((m) => m.slice(1).map(Number));
    expect(nums).toHaveLength(4);
    nums.forEach(([, c1y, , c2y, , y1], i) => {
      const y0 = pts[i][1], lo = Math.min(y0, y1), hi = Math.max(y0, y1);
      expect(c1y).toBeGreaterThanOrEqual(lo - 1e-6); expect(c1y).toBeLessThanOrEqual(hi + 1e-6);
      expect(c2y).toBeGreaterThanOrEqual(lo - 1e-6); expect(c2y).toBeLessThanOrEqual(hi + 1e-6);
    });
  });
  it("smoothPath breaks at nulls, and joins straight when smooth is off", () => {
    expect(smoothPath([[0, 1], [1, 2], null, [3, 4], [4, 5]]).match(/M/g)).toHaveLength(2);
    expect(smoothPath([[0, 1], [1, 2], [2, 0]], Infinity, -Infinity, false)).toBe("M0.0,1.0L1.0,2.0L2.0,0.0");
  });
  it("bandPos puts a month at its centre and a date at its day inside the month", () => {
    const months = ["2026-08", "2026-09", "2026-10"];
    expect(bandPos(months, "2026-09")).toBe(1.5);
    expect(bandPos(months, "2026-10-01")).toBe(2);
    expect(bandPos(months, "2026-12-30")).toBeGreaterThan(4.9); // beyond the axis: extrapolated by whole months
  });
});

describe("page text", () => {
  it("index.html contains no typed numbers: every figure on the page is filled from JSON", () => {
    const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<head>[\s\S]*?<\/head>/, "").replace(/<[^>]*>/g, " ");
    expect(visible).not.toMatch(/\d/);
  });
});
