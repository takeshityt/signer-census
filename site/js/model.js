// Data shaping for the dashboard. Pure functions over the JSON files in site/data/ (unit-tested against the real files).
// No number in the page is typed by hand: everything below is read from metrics.json / scenarios.json / labels.json / verify.json / thesis.json.

/** Fixed stacking order (bottom to top) and the categorical slot of each group (never re-ordered when a filter changes). */
export const STACK = [
  { id: "fastauth", label: "FastAuth logins", slot: 1, cats: ["near-infra:fastauth"] },
  { id: "apps", label: "Other applications", slot: 2, cats: ["third-party-app", "wallet", "intents", "aurora"] },
  { id: "omni", label: "Omni bridge", slot: 3, cats: ["near-infra:bridge-omni"] },
  { id: "btc", label: "Bitcoin connector", slot: 4, cats: ["near-infra:bridge-btc"] },
  { id: "zcash", label: "Zcash connector", slot: 5, cats: ["near-infra:bridge-zcash"] },
  { id: "unidentified", label: "Not identified", slot: "neutral", cats: ["unknown", "unlabeled"] },
  { id: "benchmark", label: "Suspected benchmark (tx-bench.near)", slot: "hatch", cats: ["suspected:benchmark-test", "benchmark-test"] },
];
const CATEGORY_NAMES = {
  "near-infra:fastauth": "FastAuth (NEAR login layer)", "near-infra:bridge-omni": "Omni bridge", "near-infra:bridge-btc": "Bitcoin bridge connector", "near-infra:bridge-zcash": "Zcash bridge connector",
  "third-party-app": "Third-party application", aurora: "Aurora", "benchmark-test": "Benchmark / test", wallet: "Wallet", intents: "Intents", unknown: "Unknown",
};
export const categoryName = (c) => CATEGORY_NAMES[c] ?? c;

export const fullMonths = (metrics) => metrics.months.filter((m) => !m.partial_month);
const sumCi = (parts) => (parts.length === 1 ? parts[0]?.ci95 ?? null : null); // intervals are not additive: shown only for single-source groups

/** Stacked monthly series by group. With excludeBenchmark the suspected-benchmark group is dropped (the others keep their colors and order). */
export function stackedSeries(metrics, { excludeBenchmark = false } = {}) {
  const months = metrics.months;
  const known = new Set(STACK.flatMap((g) => g.cats));
  const series = STACK.filter((g) => !(excludeBenchmark && g.id === "benchmark")).map((g) => {
    const values = [], ci = [];
    for (const m of months) {
      const cats = Object.keys(m.categories).filter((c) => g.cats.includes(c) || (g.id === "unidentified" && !known.has(c)));
      const parts = cats.map((c) => m.categories[c].est);
      values.push(parts.reduce((a, p) => a + p.value, 0));
      ci.push(sumCi(parts));
    }
    return { id: g.id, label: g.label, slot: g.slot, values, ci };
  });
  return { months: months.map((m) => m.month), partial: months.map((m) => m.partial_month), series };
}

export function monthTotals(metrics, { excludeBenchmark = false } = {}) {
  const key = excludeBenchmark ? "excluding_benchmark" : "all";
  return metrics.months.map((m) => m.series_requests_est[key].value);
}

export function heroStats(metrics, verify) {
  const t = metrics.totals;
  const first = metrics.months[0], last = metrics.months.at(-1);
  const peak = fullMonths(metrics).reduce((a, m) => (m.requests_est.value > a.requests_est.value ? m : a));
  return {
    requests: t.requests_est.value, requestsCi: t.requests_est.ci95,
    fulfilled: t.fulfilled_rate.value, fulfilledCi: t.fulfilled_rate.ci95,
    withoutBenchmark: t.series_requests_est.excluding_benchmark.value,
    firstMonth: first.month, lastMonth: last.month, lastIsPartial: last.partial_month, snapshotTime: metrics.meta.snapshot.time_utc,
    peakMonth: peak.month, peakValue: peak.requests_est.value,
    verified: verify.verified, sample: verify.sample, rpcOk: verify.rpc_ok, nearblocksOk: verify.nearblocks_ok, verifyDate: verify.date,
  };
}

/** Top requesters joined with labels.json (evidence, dominant integrator) */
export function requesterRows(metrics, labels) {
  const byAcc = new Map(labels.map((l) => [l.account, l]));
  return metrics.totals.top_requesters.map((r) => {
    const l = byAcc.get(r.requester) ?? null;
    const label = r.label ?? null;
    return {
      account: r.requester, share: r.share_of_requests.value, shareCi: r.share_of_requests.ci95, requests: r.requests_est.value, requestsCi: r.requests_est.ci95,
      category: label?.category ?? null, suspected: label?.suspected_category ?? null, confidence: label?.confidence ?? null, owner: l?.owner ?? null,
      note: l?.note ?? null, evidence: l?.evidence ?? [], integrator: l?.dominant_integrator ?? null,
    };
  });
}

export const TARGETS = [
  { id: "near_native", label: "NEAR itself", slot: 1 },
  { id: "other_chains", label: "Other chains", slot: 3 },
  { id: "unknown", label: "Not known", slot: "neutral" },
];
export function chainSeries(metrics) {
  return { months: metrics.months.map((m) => m.month), series: TARGETS.map((t) => ({ ...t, values: metrics.months.map((m) => m.target_groups_share[t.id].value), ci: metrics.months.map((m) => m.target_groups_share[t.id].ci95) })) };
}
export function chainFamilies(metrics) {
  const f = metrics.totals.target_chain_families;
  return Object.entries(f).map(([id, v]) => ({ id, share: v.share.value, ci: v.share.ci95 })).sort((a, b) => b.share - a.share);
}

export const BRIDGES = [
  { id: "omni", label: "Omni bridge", cat: "near-infra:bridge-omni", slot: 3 },
  { id: "btc", label: "Bitcoin connector", cat: "near-infra:bridge-btc", slot: 4 },
  { id: "zcash", label: "Zcash connector", cat: "near-infra:bridge-zcash", slot: 5 },
];
export function bridgeSeries(metrics) {
  const get = (m, cat) => m.categories[cat]?.est ?? { value: 0, ci95: null };
  return {
    months: metrics.months.map((m) => m.month), partial: metrics.months.map((m) => m.partial_month),
    series: BRIDGES.map((b) => ({ ...b, values: metrics.months.map((m) => get(m, b.cat).value), ci: metrics.months.map((m) => get(m, b.cat).ci95) })),
    structural: { label: "All structural requests (minus suspected benchmark and FastAuth)", values: metrics.months.map((m) => m.series_requests_est.structural.value), ci: metrics.months.map((m) => m.series_requests_est.structural.ci95) },
    bridgesTotal: { values: metrics.months.map((m) => m.series_requests_est.bridges.value), ci: metrics.months.map((m) => m.series_requests_est.bridges.ci95) },
  };
}

/** Scenario controls are built from the precomputed combinations in scenarios.json. */
export function scenarioOptions(scenarios) {
  const uniq = (f) => [...new Set(scenarios.scenarios.map(f))];
  return {
    retention: uniq((s) => s.assumptions.fastauth_retention_after_end).sort((a, b) => a - b),
    benchmark: uniq((s) => s.assumptions.benchmark),
    growth: uniq((s) => s.assumptions.structural_monthly_growth).sort((a, b) => a - b),
  };
}
export function pickScenario(scenarios, sel) {
  const s = scenarios.scenarios.find((x) => x.assumptions.fastauth_retention_after_end === sel.retention && x.assumptions.benchmark === sel.benchmark && x.assumptions.structural_monthly_growth === sel.growth);
  if (!s) throw new Error("no precomputed scenario for this combination");
  return s;
}
/** History (last `back` full months of actual estimates) followed by the selected projection. */
export function scenarioChart(metrics, scenarios, sel, back = 8) {
  const s = pickScenario(scenarios, sel);
  const hist = fullMonths(metrics).slice(-back);
  const projMonths = Object.keys(s.projection);
  const months = [...hist.map((m) => m.month), ...projMonths];
  const pad = (arr, n) => [...Array(n).fill(null), ...arr];
  return {
    months, baselineMonth: scenarios.baseline.month, scenario: s,
    history: [...hist.map((m) => m.series_requests_est.all.value), ...Array(projMonths.length).fill(null)],
    // the projection starts at the baseline point so the lines connect
    total: [...Array(hist.length - 1).fill(null), hist.at(-1).series_requests_est.all.value, ...projMonths.map((m) => s.projection[m].total)],
    structural: [...Array(hist.length - 1).fill(null), scenarios.baseline.structural, ...projMonths.map((m) => s.projection[m].structural)],
    fastauth: [...Array(hist.length - 1).fill(null), scenarios.baseline.fastauth, ...projMonths.map((m) => s.projection[m].fastauth)],
  };
}
