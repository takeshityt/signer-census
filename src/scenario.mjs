// Scenario model (NOT a forecast). Pure functions; inputs: baseline components from out/metrics.json + assumptions.yaml.
import { project, monthsBetween } from "./scenario-core.mjs";
export { project, monthsBetween };

/** Baseline components of one month of metrics (as produced by reproduce.mjs). */
export function baselineFrom(metrics, a) {
  const months = metrics.months.filter((x) => !x.partial_month);
  const b = a.baseline_month === "last_full" ? months.at(-1) : metrics.months.find((x) => x.month === a.baseline_month);
  if (!b) throw new Error(`baseline month ${a.baseline_month} not found`);
  const all = b.series_requests_est.all.value;
  const noBench = b.series_requests_est.excluding_benchmark.value;
  const structural = b.series_requests_est.structural.value;
  const fastauth = b.drivers_requests[a.fastauth_account]?.value ?? 0;
  return { month: b.month, all, benchmark: all - noBench, fastauth, structural,
    ci95: { all: b.series_requests_est.all.ci95, structural: b.series_requests_est.structural.ci95, excluding_benchmark: b.series_requests_est.excluding_benchmark.ci95 } };
}

export function runScenarios(base, a) {
  const out = [];
  let months = [];
  for (const r of a.fastauth_retention) for (const bm of a.benchmark) for (const g of a.structural_monthly_growth) {
    const res = project(base, { retention: r, benchmark: bm, growth: g, horizon: a.horizon_end, endMonth: a.fastauth_end_month });
    months = Object.keys(res.projection);
    out.push({ id: `fastauth${Math.round(r * 100)}_bench-${bm}_g${g >= 0 ? "+" : ""}${Math.round(g * 100)}`,
      assumptions: { fastauth_retention_after_end: r, benchmark: bm, structural_monthly_growth: g },
      projection: res.projection, end_month: res.end_month, end_month_total: res.end_month_total, end_month_vs_baseline: res.end_month_vs_baseline, cumulative_requests: res.cumulative_requests });
  }
  return { label: "SCENARIOS, not forecasts", baseline: base, horizon: { from: months[0], to: months.at(-1) }, scenarios: out };
}
