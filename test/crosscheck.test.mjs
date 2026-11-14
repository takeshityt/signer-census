import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildCrosscheck, MIN_COMPARED } from "../src/crosscheck.mjs";
import { fillMarkers, fillCrosscheck } from "../src/doc-markers.mjs";
import { repoFacts } from "../src/repo-facts.mjs";

const root = new URL("../", import.meta.url).pathname;
const read = (f) => readFileSync(root + f, "utf8");
const metrics = JSON.parse(read("out/metrics.json")), scenarios = JSON.parse(read("out/scenarios.json"));
const exact = { counts: JSON.parse(read("data/exact/counts.json")), unit: JSON.parse(read("data/exact/unit-check.json")), meta: JSON.parse(read("data/exact/meta.json")) };

describe("cross-check against exact per-account counts", () => {
  const cc = buildCrosscheck(metrics, exact);
  it("out/crosscheck.json is exactly what the committed data produces", () => {
    expect(JSON.parse(read("out/crosscheck.json"))).toEqual(JSON.parse(JSON.stringify(cc)));
  });
  it("compares only accounts whose every checked tx carries one sign receipt by them", () => {
    for (const v of cc.verified) for (const u of v.unit_check) { expect(u.sign_receipts).toBe(u.txs); expect(u.max_per_tx).toBe(1); }
    for (const v of cc.not_compared) expect(v.unit_check.some((u) => u.sign_receipts < u.txs)).toBe(true);
    expect(cc.comparisons.every((c) => cc.verified.some((v) => v.account === c.account))).toBe(true);
  });
  it("each comparison reads the monthly estimate and its interval from out/metrics.json; inside is computed, not typed", () => {
    for (const c of cc.comparisons) {
      const m = metrics.months.find((x) => x.month === c.month);
      expect(m.partial_month).toBeFalsy();
      expect(c.estimate).toBe(m.drivers_requests[c.account]?.value ?? 0);
      expect(c.exact).toBe(exact.counts[`${c.account}|${c.month}`].any);
      expect(c.inside).toBe(c.exact >= c.ci95[0] && c.exact <= c.ci95[1]);
      expect(Math.max(c.estimate, c.exact)).toBeGreaterThanOrEqual(MIN_COMPARED);
    }
    expect(cc.summary.inside + cc.summary.outside).toBe(cc.summary.compared);
  });
});

describe("docs/METHODOLOGY.md numbers are refilled from the JSON outputs", () => {
  it("every marker and the cross-check table equal their rendering (run npm run reproduce after a data change)", () => {
    const md = read("docs/METHODOLOGY.md");
    const data = { metrics, scenarios, repo: repoFacts(root) };
    expect(fillCrosscheck(fillMarkers(md, data), JSON.parse(read("out/crosscheck.json")))).toBe(md);
    expect(md).toContain("<!-- crosscheck-table -->\n**");
  });
});
