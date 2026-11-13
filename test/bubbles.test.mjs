import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { layoutBubbles } from "../site/js/bubble-layout.js";
import { requesterRows } from "../site/js/model.js";

const root = new URL("../", import.meta.url).pathname;
const metrics = JSON.parse(readFileSync(root + "out/metrics.json", "utf8"));
const labels = JSON.parse(readFileSync(root + "site/data/labels.json", "utf8"));
const rows = requesterRows(metrics, labels);
const items = rows.map((r) => ({ id: r.account, share: r.share }));

describe("requester bubbles", () => {
  const SIZES = [[930, 428], [600, 300], [340, 300]];
  it("one bubble per real requester, area proportional to share, at several canvas sizes", () => {
    for (const [W, H] of SIZES) {
      const b = layoutBubbles(items, W, H);
      expect(b.map((x) => x.id).sort()).toEqual(items.map((x) => x.id).sort());
      const k = b[0].r ** 2 / b[0].share;
      for (const x of b) expect(x.r ** 2 / x.share).toBeCloseTo(k, 6); // r^2 / share is constant, so area is proportional to share
    }
  });
  it("no overlaps and everything inside the canvas, at several canvas sizes", () => {
    for (const [W, H] of SIZES) {
      const b = layoutBubbles(items, W, H);
      for (let i = 0; i < b.length; i++) {
        expect(b[i].x - b[i].r).toBeGreaterThanOrEqual(-0.01); expect(b[i].x + b[i].r).toBeLessThanOrEqual(W + 0.01);
        expect(b[i].y - b[i].r).toBeGreaterThanOrEqual(-0.01); expect(b[i].y + b[i].r).toBeLessThanOrEqual(H + 0.01);
        for (let j = i + 1; j < b.length; j++) expect(Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y)).toBeGreaterThanOrEqual(b[i].r + b[j].r - 0.5);
      }
    }
  });
  it("is deterministic and the bubble ratio equals the share ratio", () => {
    expect(layoutBubbles(items, 930, 428)).toEqual(layoutBubbles(items, 930, 428));
    const b = layoutBubbles(items, 930, 428);
    const by = Object.fromEntries(b.map((x) => [x.id, x]));
    expect((by["fast-auth.near"].r / by["omni.bridge.near"].r) ** 2).toBeCloseTo(rows.find((r) => r.account === "fast-auth.near").share / rows.find((r) => r.account === "omni.bridge.near").share, 6);
  });
  it("shares come from the data, nothing is added", () => {
    expect(items.length).toBe(metrics.totals.top_requesters.length);
  });
});
