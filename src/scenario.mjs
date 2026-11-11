// Scenario model (NOT a forecast). Pure functions; inputs: baseline components from out/metrics.json + assumptions.yaml.
const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
export function monthsBetween(after, last) { const out = []; for (let m = nextMonth(after); m <= last; m = nextMonth(m)) out.push(m); return out; }

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
  const months = monthsBetween(base.month, a.horizon_end);
  const out = [];
  for (const r of a.fastauth_retention) for (const bm of a.benchmark) for (const g of a.structural_monthly_growth) {
    const proj = {};
    let cum = 0;
    months.forEach((m, i) => {
      const k = i + 1;
      const structural = base.structural * (1 + g) ** k;
      const fastauth = m <= a.fastauth_end_month ? base.fastauth : base.fastauth * r;
      const benchmark = bm === "kept" ? base.benchmark : 0;
      const total = structural + fastauth + benchmark;
      cum += total;
      proj[m] = { structural: Math.round(structural), fastauth: Math.round(fastauth), benchmark: Math.round(benchmark), total: Math.round(total) };
    });
    const last = proj[months.at(-1)];
    out.push({ id: `fastauth${Math.round(r * 100)}_bench-${bm}_g${g >= 0 ? "+" : ""}${Math.round(g * 100)}`,
      assumptions: { fastauth_retention_after_end: r, benchmark: bm, structural_monthly_growth: g },
      projection: proj, end_month: months.at(-1), end_month_total: last.total, end_month_vs_baseline: last.total / base.all - 1, cumulative_requests: Math.round(cum) });
  }
  return { label: "SCENARIOS, not forecasts", baseline: base, horizon: { from: months[0], to: months.at(-1) }, scenarios: out };
}
