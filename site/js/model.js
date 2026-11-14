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

/* ------------------------------------------------------------------ editorial additions (design branch) */

/** The headline sentence is read from THESIS.md (section "Headline"), never retyped on the page. */
export const headline = (thesis) => String(thesis.sections.headline.markdown).replace(/\*\*/g, "").trim();
/** Two-tone split: the first sentence (ink) and the rest (muted). Joining the parts with a space gives the headline back. */
export function splitHeadline(text) {
  const m = /^(.+?[.!?])\s+(.+)$/s.exec(String(text).trim());
  return m ? [m[1], m[2]] : [String(text).trim(), ""];
}

/** Volume view for the "it works" chart: everything in one neutral series, the suspected benchmark on top (hatched). */
export function volumeSeries(metrics, { excludeBenchmark = false } = {}) {
  const st = stackedSeries(metrics, { excludeBenchmark: false });
  const bench = st.series.find((s) => s.id === "benchmark");
  const others = st.series.filter((s) => s.id !== "benchmark");
  const sum = (i) => others.reduce((a, s) => a + s.values[i], 0);
  return {
    months: st.months, partial: st.partial,
    series: [
      { id: "all", label: "Requests", tone: "base", values: st.months.map((_, i) => sum(i)), ci: metrics.months.map((m) => m.series_requests_est.excluding_benchmark.ci95) },
      { id: "benchmark", label: "Suspected benchmark", tone: "hatch", values: bench.values, ci: bench.ci },
    ].map((s) => (excludeBenchmark && s.id === "benchmark" ? { ...s, values: s.values.map(() => 0) } : s)),
  };
}

/** Boom view: FastAuth (the focal series, bottom), everyone else (muted), suspected benchmark (hatched, top). */
export function boomSeries(metrics, { excludeBenchmark = false } = {}) {
  const st = stackedSeries(metrics, { excludeBenchmark: false });
  const get = (id) => st.series.find((s) => s.id === id);
  const fa = get("fastauth"), bench = get("benchmark");
  const rest = st.series.filter((s) => s.id !== "fastauth" && s.id !== "benchmark");
  return {
    months: st.months, partial: st.partial,
    series: [
      { id: "fastauth", label: "FastAuth logins", tone: "fastauth", values: fa.values, ci: fa.ci },
      { id: "rest", label: "Everyone else", tone: "muted", values: st.months.map((_, i) => rest.reduce((a, s) => a + s.values[i], 0)), ci: st.months.map(() => null) },
      { id: "benchmark", label: "Suspected benchmark", tone: "hatch", values: bench.values.map((v) => (excludeBenchmark ? 0 : v)), ci: bench.ci },
    ],
  };
}

/** Callback success rate per month (a line), with its interval. */
export function fulfilledSeries(metrics) {
  return { months: metrics.months.map((m) => m.month), partial: metrics.months.map((m) => m.partial_month), values: metrics.months.map((m) => m.fulfilled_rate.value), ci: metrics.months.map((m) => m.fulfilled_rate.ci95) };
}

/** Bridges as three stacked connectors (one green family) plus the total as a line is not needed: the sum is the stack. */
export function bridgeStack(metrics) {
  const b = bridgeSeries(metrics);
  return { months: b.months, partial: b.partial, series: b.series.map((s, i) => ({ id: s.id, label: s.label, tone: ["bridge-dark", "bridge-mid", "bridge-light"][i], values: s.values, ci: s.ci })), total: b.bridgesTotal, structural: b.structural };
}

/** NEAR itself vs other chains as lines; "not known" is the remainder band. */
export function destinationLines(metrics) {
  const c = chainSeries(metrics);
  const by = (id) => c.series.find((s) => s.id === id);
  const near = by("near_native"), other = by("other_chains"), unk = by("unknown");
  const full = fullMonths(metrics).map((m) => m.month);
  // first full month in which other chains are ahead of NEAR itself and stay ahead to the end of the full months
  let cross = null;
  for (let i = c.months.length - 1; i >= 0; i--) {
    if (!full.includes(c.months[i])) continue;
    if (other.values[i] > near.values[i]) cross = i; else break;
  }
  return { months: c.months, partial: metrics.months.map((m) => m.partial_month), near, other, unknown: unk, crossover: cross === null ? null : { month: c.months[cross], index: cross, near: near.values[cross], other: other.values[cross] } };
}

/** Dated events used as annotations. Every date comes from the data or from a cited source URL (the release date is in its path). */
export function timelineEvents(metrics, scenarios) {
  const full = fullMonths(metrics);
  const fa = (m) => m.drivers_requests["fast-auth.near"]?.value ?? 0;
  let ramp = null;
  for (let i = 1; i < full.length; i++) { const d = fa(full[i]) - fa(full[i - 1]); if (!ramp || d > ramp.jump) ramp = { month: full[i].month, jump: d, value: fa(full[i]) }; }
  const exit = (metrics.derived.exits ?? [])[0] ?? null;
  const rel = /\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(scenarios.event.source);
  const peak = metrics.derived.bridges_peak_month;
  return {
    fastauthRamp: ramp,
    relayExit: exit ? { month: exit.zero_from, lastActive: exit.last_active_month, peak: exit.peak_value, peakMonth: exit.peak_month } : null,
    sweatAnnounced: rel ? { date: `${rel[1]}-${rel[2]}-${rel[3]}`, source: scenarios.event.source } : null,
    sweatEnds: { date: scenarios.event.date, source: scenarios.event.source },
    bridgesPeak: { month: peak.month, value: peak.value },
  };
}

/** Human-readable requester name (the account id stays visible next to it). */
const SHORT_NAMES = { "near-infra:fastauth": "FastAuth logins", "near-infra:bridge-omni": "Omni bridge", "near-infra:bridge-btc": "Bitcoin bridge connector", "near-infra:bridge-zcash": "Zcash bridge connector" };
export function requesterName(r) {
  if (r.suspected) return "Suspected benchmark";
  if (SHORT_NAMES[r.category]) return SHORT_NAMES[r.category];
  const owner = r.owner ? r.owner.split(/ \(| per |;|,/)[0].trim() : "";
  if (owner && !/^(not established|probably)/i.test(owner)) return owner;
  if (r.category && r.category !== "unknown") return categoryName(r.category);
  return r.category === "unknown" ? "Unknown account" : "Unlabeled account";
}

/** Tone (color family) of a requester bar: color follows the entity everywhere on the page. */
export function requesterTone(r) {
  if (r.category === "near-infra:fastauth") return "fastauth";
  if (String(r.category).startsWith("near-infra:bridge")) return "bridge-dark";
  if (r.suspected) return "hatch";
  return "muted";
}

/** Splits a thesis bullet into the claim and the reasoning ("Why ..."), so the reasoning can sit in a collapsed block. */
export function splitWhy(bullet) {
  const m = /^(.*?)\s+(Why[ :][\s\S]*)$/.exec(bullet);
  return m ? { claim: m[1].trim(), why: m[2].trim() } : { claim: bullet.trim(), why: "" };
}

/** Chart arrays for a slider setting: `proj` is the result of project() (scenario-core.js); history = last `back` full months. */
export function scenarioSeries(metrics, scenarios, proj, back = 8) {
  const hist = fullMonths(metrics).slice(-back);
  const pm = Object.keys(proj.projection);
  const lead = Array(hist.length - 1).fill(null);
  return {
    months: [...hist.map((m) => m.month), ...pm], baselineMonth: scenarios.baseline.month,
    history: [...hist.map((m) => m.series_requests_est.all.value), ...Array(pm.length).fill(null)],
    total: [...lead, hist.at(-1).series_requests_est.all.value, ...pm.map((m) => proj.projection[m].total)],
    structural: [...lead, scenarios.baseline.structural, ...pm.map((m) => proj.projection[m].structural)],
    fastauth: [...lead, scenarios.baseline.fastauth, ...pm.map((m) => proj.projection[m].fastauth)],
  };
}

/** One falsification test as short plain lines (numbers from config/predictions.json and metrics.derived, never typed here). */
export function predictionLines(pred, metrics, fmt) {
  const val = (c, month) => { const t = c.threshold_path ? c.threshold_path.replace("{month}", month).split(".").reduce((o, k) => o?.[k], metrics) : c.threshold; return t; };
  return pred.any_of.map((c) => {
    const f = fmt[c.fmt] ?? String;
    const t = c.threshold_path ? pred.months.map((m) => f(val(c, m))).join(" / ") : f(c.threshold);
    return c.text.replace("{t}", t);
  });
}
