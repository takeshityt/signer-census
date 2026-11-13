// Scenario arithmetic with no imports, shared by src/scenario.mjs (precomputed out/scenarios.json) and the dashboard sliders (site/js/scenario-core.js).
// One implementation, so a slider setting equal to a precomputed scenario gives the same numbers (tested).
const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
export function monthsBetween(after, last) { const out = []; for (let m = nextMonth(after); m <= last; m = nextMonth(m)) out.push(m); return out; }

/** base: {month, all, fastauth, benchmark, structural}; p: {retention 0..1, benchmark "kept"|"removed", growth (monthly, e.g. -0.05), horizon "YYYY-MM", endMonth "YYYY-MM"} */
export function project(base, p) {
  const months = monthsBetween(base.month, p.horizon);
  const projection = {};
  let cum = 0;
  months.forEach((m, i) => {
    const k = i + 1;
    const structural = base.structural * (1 + p.growth) ** k;
    const fastauth = m <= p.endMonth ? base.fastauth : base.fastauth * p.retention;
    const benchmark = p.benchmark === "kept" ? base.benchmark : 0;
    const total = structural + fastauth + benchmark;
    cum += total;
    projection[m] = { structural: Math.round(structural), fastauth: Math.round(fastauth), benchmark: Math.round(benchmark), total: Math.round(total) };
  });
  const last = projection[months.at(-1)];
  return { projection, end_month: months.at(-1), end_month_total: last.total, end_month_vs_baseline: last.total / base.all - 1, cumulative_requests: Math.round(cum) };
}
