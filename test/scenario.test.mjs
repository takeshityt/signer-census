import { describe, it, expect } from "vitest";
import { runScenarios, baselineFrom, monthsBetween } from "../src/scenario.mjs";

const A = { baseline_month: "last_full", horizon_end: "2027-02", fastauth_account: "fa.near", fastauth_end_month: "2026-12", fastauth_retention: [0, 1], benchmark: ["kept", "removed"], structural_monthly_growth: [0, 0.1] };
const metrics = { months: [
  { month: "2026-10", partial_month: false, series_requests_est: { all: { value: 1000, ci95: [900, 1100] }, excluding_benchmark: { value: 900, ci95: [1, 2] }, structural: { value: 500, ci95: [1, 2] } }, drivers_requests: { "fa.near": { value: 400 } } },
  { month: "2026-11", partial_month: true, series_requests_est: { all: { value: 9 }, excluding_benchmark: { value: 9 }, structural: { value: 9 } }, drivers_requests: {} },
] };

describe("scenario model", () => {
  it("baseline = last FULL month, components add up", () => {
    const b = baselineFrom(metrics, A);
    expect(b.month).toBe("2026-10");
    expect(b.benchmark + b.fastauth + b.structural).toBe(b.all);
  });
  it("months after the baseline up to the horizon", () => {
    expect(monthsBetween("2026-10", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
  it("fast-auth retention applies only after the end month; benchmark and growth behave as assumed", () => {
    const r = runScenarios(baselineFrom(metrics, A), A);
    expect(r.scenarios).toHaveLength(8);
    const s = r.scenarios.find((x) => x.id === "fastauth0_bench-removed_g+0");
    expect(s.projection["2026-12"]).toEqual({ structural: 500, fastauth: 400, benchmark: 0, total: 900 });
    expect(s.projection["2027-01"]).toEqual({ structural: 500, fastauth: 0, benchmark: 0, total: 500 });
    const g = r.scenarios.find((x) => x.id === "fastauth100_bench-kept_g+10");
    expect(g.projection["2027-02"].structural).toBe(Math.round(500 * 1.1 ** 4));
    expect(g.projection["2027-02"].benchmark).toBe(100);
    expect(r.label).toMatch(/not forecasts/);
  });
});
