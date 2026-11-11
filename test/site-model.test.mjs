import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compact, approx, pct, monthLabel, dayLabel, range } from "../site/js/format.js";
import { inline } from "../site/js/md.js";
import { stackedSeries, monthTotals, heroStats, requesterRows, chainSeries, bridgeSeries, scenarioOptions, pickScenario, scenarioChart, STACK, fullMonths } from "../site/js/model.js";

const j = (f) => JSON.parse(readFileSync(new URL(`../site/data/${f}`, import.meta.url), "utf8"));
const metrics = j("metrics.json"), scenarios = j("scenarios.json"), labels = j("labels.json"), verify = j("verify.json");

describe("format", () => {
  it("compact numbers and approximations", () => {
    expect(compact(6432762)).toBe("6.4M"); expect(compact(897000)).toBe("897k"); expect(compact(4001)).toBe("4.0k"); expect(compact(26)).toBe("26");
    expect(approx(1226837)).toBe("≈1.2M"); expect(pct(0.9993, 1)).toBe("99.9%"); expect(range([100000, 250000])).toBe("100k–250k");
  });
  it("dates", () => { expect(monthLabel("2026-10")).toBe("Oct 2026"); expect(dayLabel("2026-12-30")).toBe("30 Dec 2026"); expect(dayLabel("2026-11-11T10:35:50.401Z")).toBe("11 Nov 2026"); });
});

describe("markdown", () => {
  it("renders bold, code, links and escapes HTML", () => {
    expect(inline("**a** `b<c>` [x](https://e.org/p?q=1) <script>")).toBe('<strong>a</strong> <code>b&lt;c&gt;</code> <a href="https://e.org/p?q=1" rel="noopener noreferrer">x</a> &lt;script&gt;');
  });
});

describe("model on the real data", () => {
  it("hero number is exactly metrics.totals.requests_est and the verify badge reads verify.json", () => {
    const h = heroStats(metrics, verify);
    expect(h.requests).toBe(metrics.totals.requests_est.value);
    expect(h.verified).toBe(verify.verified); expect(h.sample).toBe(verify.sample);
    expect(h.peakValue).toBe(Math.max(...fullMonths(metrics).map((m) => m.requests_est.value)));
  });
  it("stacked categories add up to the monthly total (all groups) and to the 'excluding benchmark' series (without the benchmark group)", () => {
    const all = stackedSeries(metrics), ex = stackedSeries(metrics, { excludeBenchmark: true });
    const tAll = monthTotals(metrics), tEx = monthTotals(metrics, { excludeBenchmark: true });
    all.months.forEach((m, i) => {
      // the JSON stores every estimate rounded to an integer, so a sum of n parts may differ from the rounded total by up to n
      expect(Math.abs(all.series.reduce((a, s) => a + s.values[i], 0) - tAll[i])).toBeLessThanOrEqual(all.series.length);
      expect(Math.abs(ex.series.reduce((a, s) => a + s.values[i], 0) - tEx[i])).toBeLessThanOrEqual(ex.series.length);
    });
    expect(ex.series.some((s) => s.id === "benchmark")).toBe(false);
    expect(ex.series.map((s) => s.slot)).toEqual(STACK.filter((g) => g.id !== "benchmark").map((g) => g.slot)); // survivors keep their colors
  });
  it("benchmark group equals the tx-bench.near driver", () => {
    const b = stackedSeries(metrics).series.find((s) => s.id === "benchmark");
    metrics.months.forEach((m, i) => expect(b.values[i]).toBeCloseTo(m.drivers_requests["tx-bench.near"].value, 0));
  });
  it("requester rows join labels: fast-auth.near carries the Sweat dominant integrator, tx-bench.near is unknown/suspected", () => {
    const rows = requesterRows(metrics, labels);
    const f = rows.find((r) => r.account === "fast-auth.near"), t = rows.find((r) => r.account === "tx-bench.near");
    expect(f.integrator.name).toMatch(/Sweat/); expect(f.integrator.confidence).toBe("medium"); expect(f.evidence.length).toBeGreaterThan(0);
    expect(t.category).toBe("unknown"); expect(t.suspected).toBe("benchmark-test");
    expect(rows.every((r) => r.evidence.length > 0 || r.confidence === null)).toBe(true);
  });
  it("chain shares add up to 1 each month; bridges equal the sum of the three connectors", () => {
    const c = chainSeries(metrics);
    c.months.forEach((_, i) => expect(Math.abs(c.series.reduce((a, s) => a + s.values[i], 0) - 1)).toBeLessThan(1e-5)); // shares are stored with 6 decimals
    const b = bridgeSeries(metrics);
    b.months.forEach((_, i) => expect(Math.abs(b.series.reduce((a, s) => a + s.values[i], 0) - b.bridgesTotal.values[i])).toBeLessThanOrEqual(b.series.length));
  });
  it("scenario controls pick the right precomputed combination and the chart starts at the baseline", () => {
    const o = scenarioOptions(scenarios);
    expect(o.retention.length * o.benchmark.length * o.growth.length).toBe(scenarios.scenarios.length);
    const sel = { retention: o.retention[0], benchmark: "removed", growth: o.growth[1] };
    const s = pickScenario(scenarios, sel);
    const ch = scenarioChart(metrics, scenarios, sel);
    expect(ch.total.at(-1)).toBe(s.end_month_total);
    expect(ch.months).toContain(scenarios.baseline.month);
    const other = pickScenario(scenarios, { ...sel, growth: o.growth[2] });
    expect(other.end_month_total).not.toBe(s.end_month_total);
  });
});
