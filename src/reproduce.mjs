#!/usr/bin/env node
// `npm run reproduce`: rebuilds out/metrics.json offline from the committed data (data/derived/*, labels.yaml, config/*). No network.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { parseCsv } from "./lib/csv.mjs";
import { checkManifest, sha256 } from "./lib/manifest.mjs";
import { clusterStats, estimateWithBootstrap, estimateFromSums, trackedNames, sumClusters, flatten, KINDS, CLASSES } from "./estimate.mjs";
import { parseLabels } from "./labels.mjs";
import { parseChainRules, keyTypeOf, FAMILIES } from "./chains.mjs";
import { compareProximity } from "./proximity.mjs";
import { densityWeighted, censusReplay, windowComparison } from "./robustness.mjs";
import { writeScenarios } from "../scripts/scenario.mjs";
import { render } from "./thesis.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p);
const readIf = (p) => (existsSync(ROOT + p) ? read(p) : null);

const man = checkManifest(ROOT, ROOT + "data/MANIFEST.sha256");
if (!man.ok) { console.error("data/MANIFEST.sha256 check FAILED:\n" + man.problems.join("\n")); process.exit(1); }

// ---------------------------------------------------------------- inputs
const cfg = JSON.parse(read("config/estimate.json"));
const totals = parseCsv(read("data/derived/monthly_tx_totals.csv").toString());
const sampleCsv = gunzipSync(read("data/derived/sample_parsed.csv.gz")); // stored gzipped (repo size); logical name stays data/derived/sample_parsed.csv
const rows = parseCsv(sampleCsv.toString());
const labelsText = readIf("labels.yaml")?.toString() ?? "labels: []\n";
const rulesText = readIf("config/chain_rules.yaml")?.toString() ?? "rules: []\n";
const labels = parseLabels(labelsText);
const chainRules = parseChainRules(rulesText);
const reported = JSON.parse(read("config/proximity_reported.json"));
const cutoffs = JSON.parse(read("data/derived/proximity_cutoffs.json"));
const monthlyCheck = JSON.parse(read("data/derived/monthly_check.json"));

const ctx = { categoryOf: labels.categoryOf, confidenceOf: labels.confidenceOf, chainOf: (r) => chainRules.chainOf(r), chainConfidenceOf: (r) => chainRules.confidenceOf(r), keyTypeOf };
const clusters = clusterStats(rows, ctx);

// ---------------------------------------------------------------- choose drivers (top requesters by point estimate), then estimate with bootstrap
const allNames = trackedNames(clusters, { extraRequesters: 100000 });
const probe = estimateFromSums(
  totals.filter((t) => clusters.some((c) => c.month === t.month)).map((t) => ({ month: t.month, txTotal: Number(t.txs_count), sums: sumClusters(clusters.filter((c) => c.month === t.month)) })),
  { names: allNames });
const ranked = Object.entries(probe.totals.requesters.est).sort((a, b) => b[1] - a[1]).map(([k]) => k);
const drivers = ranked.slice(0, cfg.driversTop);
const labeled = [...labels.byAccount.keys()];
const topFailed = Object.entries(probe.totals.failed_by_requester.est).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k); // requesters with the most contract-rejected sign receipts
const benchmark = labels.benchmarkAccounts();
const seriesDefs = Object.fromEntries(Object.entries(cfg.series ?? {}).map(([k, d]) => [k, d.include ? { include: d.include } : { exclude: (d.exclude ?? []).flatMap((a) => (a === "@benchmark" ? benchmark : [a])) }]));
const seriesTracked = Object.values(seriesDefs).flatMap((d) => d.include ?? d.exclude ?? []);
const { point, ci, monthsList, names } = estimateWithBootstrap(clusters, totals, {
  seed: cfg.seed, replicates: cfg.bootstrapReplicates, requesters: [...new Set([...labeled, ...seriesTracked, ...topFailed, ...ranked.slice(0, cfg.topRequestersTotal + 10)])], extraRequesters: 0, drivers, benchmarkAccounts: benchmark, pairs: cfg.pairs ?? [], series: seriesDefs, chainGroups: cfg.chainGroups ?? {},
});
const flat = flatten(point);

// ---------------------------------------------------------------- formatting helpers
const COMMAND = "npm run reproduce";
const SOURCES = ["data/derived/monthly_tx_totals.csv", "data/derived/sample_parsed.csv", "labels.yaml", "config/chain_rules.yaml"];
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const esc = (x) => String(x).replace(/\./g, "|");
const V = (path, digits = 6, exact = false) => {
  const v = flat[path];
  if (v === undefined) throw new Error(`no estimate for ${path}`);
  const rd = (x) => (digits === 0 ? Math.round(x) : r6(x));
  const o = { value: rd(v) };
  if (!exact) { const [lo, hi] = ci[path]; o.ci95 = [rd(lo), rd(hi)]; }
  return o;
};
const group = (prefix, g, list, withShare = true) => Object.fromEntries(list.map((n) => [n, { est: V(`${prefix}.${g}.est.${esc(n)}`, 0), ...(withShare ? { share: V(`${prefix}.${g}.share.${esc(n)}`) } : {}) }]));
const sampleOf = (list) => ({ n_clusters: list.length, n_txs: list.reduce((s, c) => s + c.n_tx, 0), census: list.every((c) => c.census) });
const byMonth = new Map();
for (const c of clusters) { if (!byMonth.has(c.month)) byMonth.set(c.month, []); byMonth.get(c.month).push(c); }
const labelInfo = (a) => { const l = labels.byAccount.get(a); return l ? { category: l.category, confidence: l.confidence, ...(l.suspected_category ? { suspected_category: l.suspected_category } : {}) } : null; };
const REQUEST_LIKE_OTHER = ["verify_foreign_transaction", "request_app_private_key"]; // request-type calls other than `sign` (reported as their own metric)

function block(prefix, provenance) {
  const out = {
    provenance,
    requests_est: V(`${prefix}.requests`, 0),
    requests_excluding_benchmark_est: V(`${prefix}.requests_excluding_benchmark`, 0),
    requests_per_tx: V(`${prefix}.requests_per_tx`),
    receipts_per_tx: V(`${prefix}.receipts_per_tx`),
    fulfilled_rate: V(`${prefix}.fulfilled_rate`),
    sign_receipt_failed_rate: V(`${prefix}.sign_receipt_failed_rate`),
    duplicate_request_rate: V(`${prefix}.duplicate_request_rate`),
    failed_respond_share_of_respond_receipts: V(`${prefix}.failed_respond_share_of_respond_receipts`),
    tx_kind_share: Object.fromEntries(KINDS.map((k) => [k, V(`${prefix}.kinds.share.${k}`)])),
    tx_signer_class_share: Object.fromEntries(CLASSES.map((k) => [k, V(`${prefix}.classes.share.${k}`)])),
    drivers_requests: Object.fromEntries([...drivers, "__other"].map((d) => [d, V(`${prefix}.drivers.${esc(d)}`, 0)])),
    categories: group(prefix, "categories", names.categories),
    label_confidence: group(prefix, "confidences", names.confidences),
    target_chain_families: group(prefix, "chains", names.chains),
    target_chain_rule_confidence: group(prefix, "chain_confidences", names.chain_confidences),
    key_types: group(prefix, "keytypes", names.keytypes),
    concentration: { top1_share: V(`${prefix}.concentration.top1_share`), top3_share: V(`${prefix}.concentration.top3_share`), hhi: V(`${prefix}.concentration.hhi`), requesters_ge_1pct: V(`${prefix}.concentration.requesters_ge_1pct`, 0) },
    series_requests_est: Object.fromEntries(Object.keys(seriesDefs).map((k) => [k, V(`${prefix}.series.${k}`, 0)])),
    target_groups_share: Object.fromEntries(Object.keys(cfg.chainGroups ?? {}).map((k) => [k, V(`${prefix}.chain_groups_share.${k}`)])),
    relayer_share_of_requester: Object.fromEntries((cfg.pairs ?? []).map(([a, b]) => [`${a} via ${b}`, V(`${prefix}.pairs.${esc(`${a}<-${b}`)}`)])),
    other_request_types_receipts_est: Object.fromEntries(REQUEST_LIKE_OTHER.filter((m) => names.methods.includes(m)).map((m) => [m, V(`${prefix}.methods.est.${m}`, 0)])),
  };
  return out;
}

const months = monthsList.map((m) => ({
  month: m.month,
  partial_month: m.partial,
  tx_total: { value: m.txTotal, exact: true },
  ...block(`months.${m.month}`, { source_files: SOURCES, command: COMMAND, sample: sampleOf(byMonth.get(m.month)) }),
  failed_sign_requests_est_by_requester: Object.fromEntries(names.requesters.filter((r) => (flat[`months.${m.month}.failed_by_requester.est.${esc(r)}`] ?? 0) > 0).map((r) => [r, V(`months.${m.month}.failed_by_requester.est.${esc(r)}`, 0)])),
}));

const allSample = sampleOf(clusters);
const sampleMethods = sumClusters(clusters).methods; // raw receipt counts in the sample, shown next to the estimates so small-n methods are visible
const topTotal = ranked.slice(0, cfg.topRequestersTotal);
const labeledShare = 1 - flat["totals.categories.share.unlabeled"];
const totalsOut = {
  ...block("totals", { source_files: SOURCES, command: COMMAND, sample: allSample }),
  tx_total: { value: point.totals.tx_total, exact: true },
  top_requesters: topTotal.map((p) => ({ requester: p, label: labelInfo(p), share_of_requests: V(`totals.requesters.share.${esc(p)}`), requests_est: V(`totals.requesters.est.${esc(p)}`, 0) })),
  methods_receipts_est: Object.fromEntries(names.methods.map((m) => [m, { ...V(`totals.methods.est.${m}`, 0), receipts_in_sample: sampleMethods[m] ?? 0 }])),
  labeling_coverage: {
    labeled_accounts: labeled.length,
    identified_share_of_requests: V("totals.identified_share"), // excludes accounts whose category is 'unknown' (e.g. the suspected benchmark) and unlabeled accounts
    labeled_share_of_requests_including_unknown_category: { value: r6(labeledShare), ci95: [r6(1 - ci["totals.categories.share.unlabeled"][1]), r6(1 - ci["totals.categories.share.unlabeled"][0])] },
    by_confidence: Object.fromEntries(names.confidences.map((c) => [c, V(`totals.confidences.share.${c}`)])),
  },
  failed_sign_requests_est_by_requester: Object.fromEntries(names.requesters.filter((r) => (flat[`totals.failed_by_requester.est.${esc(r)}`] ?? 0) > 0).map((r) => [r, V(`totals.failed_by_requester.est.${esc(r)}`, 0)])),
};

// ---------------------------------------------------------------- comparisons and robustness
const proximity = compareProximity(point, totals, reported, cutoffs).map((r) => ({
  date: r.date, theirs_total_txns: r.theirs,
  ours: Object.fromEntries(Object.entries(r.ours).map(([k, v]) => [k, Math.round(v)])),
  theirs_over_ours: Object.fromEntries(Object.entries(r.theirs_over_ours).map(([k, v]) => [k, r6(v)])),
  closest_unit: r.closest_unit,
}));

const summaries = [];
for (const dir of ["docs/evidence/gate1", "docs/evidence/step4"]) {
  if (!existsSync(ROOT + dir)) continue;
  for (const w of readdirSync(ROOT + dir).sort()) {
    const p = `${dir}/${w}/summary.json`;
    if (!existsSync(ROOT + p)) continue;
    const s = JSON.parse(read(p));
    summaries.push({ name: w, source_file: p, from: s.window.from, txs: s.units.transactions_touching_contract_in_window, sign_receipts: s.units.sign_receipts_in_window });
  }
}
const censusMonths = totals.filter((t) => clusters.filter((c) => c.month === t.month).length > 0 && clusters.filter((c) => c.month === t.month).every((c) => c.census));
const robustness = {
  note: "Sampling-only checks. The confidence intervals in this file capture between-cluster sampling variability, not the start-bias or definition risks discussed in docs/METHODOLOGY.md.",
  density_weighted: (() => { const d = densityWeighted(clusters, totals, ci); return { months: Object.fromEntries(Object.entries(d.months).map(([k, v]) => [k, { unweighted: Math.round(v.unweighted), density_weighted: Math.round(v.density_weighted), delta_pct: r6(v.delta_pct), inside_unweighted_ci95: v.inside_unweighted_ci95 }])), totals: { unweighted: Math.round(d.totals.unweighted), density_weighted: Math.round(d.totals.density_weighted), delta_pct: r6(d.totals.delta_pct) } }; })(),
  census_replay: censusMonths.map((t) => { const r = censusReplay(rows.filter((x) => x.month === t.month), t, { seed: cfg.robustnessSeed, replicates: cfg.robustnessReplicates }); return { ...r, mean_estimate: Math.round(r.mean_estimate * 100) / 100, bias_pct: r6(r.bias_pct), rmse_pct: r6(r.rmse_pct), share_within_5pct: r6(r.share_within_5pct) }; }),
  reconcile_windows: windowComparison(summaries, totals, point, ci).map((w) => ({ ...w, window_ratio: r6(w.window_ratio), month_ratio: r6(w.month_ratio), month_ci95: w.month_ci95.map(r6), delta_pct: r6(w.delta_pct), window_se: r6(w.window_se) })),
};

// ---------------------------------------------------------------- output
const inputFiles = [
  ["data/derived/monthly_tx_totals.csv", read("data/derived/monthly_tx_totals.csv")], ["data/derived/sample_parsed.csv", sampleCsv], ["data/derived/sample_clusters.csv", read("data/derived/sample_clusters.csv")],
  ["data/derived/proximity_cutoffs.json", read("data/derived/proximity_cutoffs.json")], ["config/estimate.json", read("config/estimate.json")], ["config/proximity_reported.json", read("config/proximity_reported.json")],
  ["labels.yaml", Buffer.from(labelsText)], ["config/chain_rules.yaml", Buffer.from(rulesText)], ...summaries.map((s) => [s.source_file, read(s.source_file)]),
];
const out = {
  meta: {
    title: "Signer Census metrics for v1.signer (NEAR Chain Signatures)",
    command: COMMAND,
    snapshot: { block_height: monthlyCheck.snapshot_height, time_utc: monthlyCheck.snapshot_time_utc, note: "exact tx counts are as of this block; the last month is partial" },
    inputs: Object.fromEntries(inputFiles.map(([p, b]) => [p, sha256(b)])),
    method: { seed: cfg.seed, bootstrap_replicates: cfg.bootstrapReplicates, ci: "95% percentile interval, cluster bootstrap within each month; census months are exact (no sampling error)", drivers: drivers },
    definitions: {
      tx: "transaction touching v1.signer via a FunctionCall (exact count from FastNEAR txs_count)",
      request: "executed `sign` receipt on v1.signer",
      fulfilled: "the callback (return_signature...) in the descendant receipts of THIS sign receipt succeeded",
      sign_receipt_failed_rate: "share of sign receipts that the contract itself rejected (receipt status Failure, e.g. 'Signature request has already been submitted')",
      requester: "predecessor_id of the sign receipt (not the tx signer)",
      requests_est: "exact monthly tx total x (sign receipts per tx in the sample); ESTIMATE, not an exact count. Headline text should say '≈' and use rounded values.",
      requests_excluding_benchmark_est: `requests minus requests of accounts labeled or suspected as benchmark/test in labels.yaml (${benchmark.join(", ") || "none"})`,
      series_requests_est: "all; excluding_benchmark (minus suspected/confirmed benchmark accounts); structural (minus benchmark and minus fast-auth.near); bridges (omni.bridge.near + btc-connector.bridge.near + zcash-connector.bridge.near). Definitions in config/estimate.json.",
      concentration: "computed over ALL requesters of the period: top1/top3 share of requests, HHI = sum of squared shares (0..1), number of requesters with >= 1% share",
      target_groups_share: "near_native = chain family 'near'; other_chains = bitcoin/zcash/evm/solana/multi/other; unknown = no evidence-backed rule (config/chain_rules.yaml)",
      other_request_types: "request-type calls on v1.signer other than `sign`, counted as receipts per tx x exact tx total; never added to the request count",
    },
    sample: allSample,
    caveats: [
      "Estimates come from clusters of consecutive txs starting at seeded random block heights; start points are uniform in block height, so txs that follow a long quiet gap are slightly over-represented (see robustness.density_weighted).",
      "The CI captures between-cluster variability only; it does not capture that bias, label errors or dependence between adjacent months.",
      "Requests are attributed to the month of their tx, not of callback execution.",
      "Chain families and categories exist only where backed by evidence (labels.yaml, config/chain_rules.yaml); the rest is reported as 'unlabeled' / 'unknown'.",
    ],
  },
  totals: totalsOut,
  months,
  comparisons: {
    proximity_team_v1signer: {
      reported_source: reported.source,
      reported_series: reported.series,
      note: "Their query/SQL is not visible, so the unit they count is unknown. 'closest_unit' only says which of our units is numerically closest at that date.",
      rows: proximity,
    },
  },
  robustness,
};
mkdirSync(ROOT + "out", { recursive: true });
const text = JSON.stringify(out, null, 2) + "\n";
writeFileSync(ROOT + "out/metrics.json", text);
console.log(`out/metrics.json written. sha256 ${sha256(Buffer.from(text))}`);
console.log(`months: ${months.length}, clusters: ${allSample.n_clusters}, sampled txs: ${allSample.n_txs}, estimated requests: ${out.totals.requests_est.value} (95% CI ${out.totals.requests_est.ci95.join(" – ")})`);
const sc = writeScenarios(); // scenarios (NOT forecasts) from out/metrics.json + assumptions.yaml
console.log(`out/scenarios.json written (${sc.count} scenarios, baseline ${sc.baseline}). sha256 ${sc.sha256}`);
// THESIS.md is rendered from docs/THESIS.template.md: every number in it comes from out/metrics.json or out/scenarios.json
const thesis = render(readFileSync(ROOT + "docs/THESIS.template.md", "utf8"), { metrics: JSON.parse(readFileSync(ROOT + "out/metrics.json", "utf8")), scenarios: JSON.parse(readFileSync(ROOT + "out/scenarios.json", "utf8")) });
writeFileSync(ROOT + "THESIS.md", thesis);
console.log(`THESIS.md rendered from docs/THESIS.template.md. sha256 ${sha256(Buffer.from(thesis))}`);
