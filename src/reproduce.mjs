#!/usr/bin/env node
// `npm run reproduce`: rebuilds out/metrics.json offline from the committed data (data/derived/*.csv). No network.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseCsv } from "./lib/csv.mjs";
import { checkManifest, sha256 } from "./lib/manifest.mjs";
import { clusterStats, estimateWithBootstrap, flatten } from "./estimate.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p);

const man = checkManifest(ROOT, ROOT + "data/MANIFEST.sha256");
if (!man.ok) { console.error("data/MANIFEST.sha256 check FAILED:\n" + man.problems.join("\n")); process.exit(1); }

const cfg = JSON.parse(read("config/estimate.json"));
const totals = parseCsv(read("data/derived/monthly_tx_totals.csv").toString());
const rows = parseCsv(read("data/derived/sample_parsed.csv").toString());
const clusters = clusterStats(rows);
const { point, ci, monthsList } = estimateWithBootstrap(clusters, totals, { seed: cfg.seed, replicates: cfg.bootstrapReplicates });

// ---- assemble output: every value carries its CI; every record carries source files, command and sample size ----
const COMMAND = "npm run reproduce";
const SOURCES = ["data/derived/monthly_tx_totals.csv", "data/derived/sample_parsed.csv"];
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const key = (...p) => p.map((s) => String(s).replace(/\./g, "|")).join(".");
const num = (path, digits = 6, exact = false) => {
  const v = path.split(".").reduce((o, k) => o?.[k], flatLookup);
  const out = { value: digits === 0 ? Math.round(v) : r6(v) };
  if (!exact) { const [lo, hi] = ci[path]; out.ci95 = [digits === 0 ? Math.round(lo) : r6(lo), digits === 0 ? Math.round(hi) : r6(hi)]; }
  return out;
};
const flatLookup = flatten(point); // flat map: path -> number
const flatGet = (p) => flatLookup[p];
const valueOf = (p, digits = 6, exact = false) => {
  const v = flatGet(p); const o = { value: digits === 0 ? Math.round(v) : r6(v) };
  if (!exact) { const [lo, hi] = ci[p]; o.ci95 = digits === 0 ? [Math.round(lo), Math.round(hi)] : [r6(lo), r6(hi)]; }
  return o;
};
const topN = (shareObj, n) => Object.entries(shareObj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

const sampleOf = (list) => ({ n_clusters: list.length, n_txs: list.reduce((s, c) => s + c.n_tx, 0), census: list.every((c) => c.census) });
const byMonth = new Map();
for (const c of clusters) { if (!byMonth.has(c.month)) byMonth.set(c.month, []); byMonth.get(c.month).push(c); }

const kinds = Object.keys(point.totals.tx_kind_share), classes = Object.keys(point.totals.tx_signer_class_share);
const months = monthsList.map((m) => {
  const pre = `months.${m.month}`;
  const topReq = topN(point.months[m.month].requester_share, cfg.topRequestersPerMonth);
  return {
    month: m.month,
    partial_month: m.partial,
    provenance: { source_files: SOURCES, command: COMMAND, sample: sampleOf(byMonth.get(m.month)) },
    tx_total: { value: m.txTotal, exact: true },
    requests_est: valueOf(`${pre}.requests`, 0),
    requests_per_tx: valueOf(`${pre}.requests_per_tx`),
    fulfilled_rate: valueOf(`${pre}.fulfilled_rate`),
    duplicate_request_rate: valueOf(`${pre}.duplicate_request_rate`),
    failed_respond_share_of_respond_receipts: valueOf(`${pre}.failed_respond_share_of_respond_receipts`),
    tx_kind_share: Object.fromEntries(kinds.map((k) => [k, valueOf(key(pre, "tx_kind_share", k))])),
    tx_signer_class_share: Object.fromEntries(classes.map((k) => [k, valueOf(key(pre, "tx_signer_class_share", k))])),
    top_requesters: topReq.map((p) => ({ requester: p, share_of_requests: valueOf(key(pre, "requester_share", p)), requests_est: valueOf(key(pre, "requester_requests", p), 0) })),
  };
});

const allSample = sampleOf(clusters);
const T = "totals";
const topTotal = topN(point.totals.requester_share, cfg.topRequestersTotal);
const out = {
  meta: {
    title: "Signer Census metrics for v1.signer (NEAR Chain Signatures)",
    command: COMMAND,
    inputs: Object.fromEntries(["data/derived/monthly_tx_totals.csv", "data/derived/sample_parsed.csv", "data/derived/sample_clusters.csv", "config/estimate.json"].map((p) => [p, sha256(read(p))])),
    method: { seed: cfg.seed, bootstrap_replicates: cfg.bootstrapReplicates, ci: "95% percentile interval, cluster bootstrap within each month; census months are exact (no sampling error)" },
    definitions: {
      tx: "transaction touching v1.signer via a FunctionCall (exact count from FastNEAR txs_count)",
      request: "executed `sign` receipt on v1.signer",
      fulfilled: "the request's tx contains a successful return_signature callback",
      requester: "predecessor_id of the sign receipt (not the tx signer)",
      requests_est: "exact monthly tx total x (sign receipts per tx in the sample); ESTIMATE, not an exact count",
    },
    sample: allSample,
    caveats: [
      "Estimates come from clusters of consecutive txs starting at seeded random block heights; start points are uniform in block height, so txs that follow a long quiet gap are slightly over-represented.",
      "The CI captures between-cluster variability only; it does not capture that bias or dependence between adjacent months.",
      "Requests are attributed to the month of their tx, not of callback execution.",
    ],
  },
  totals: {
    provenance: { source_files: SOURCES, command: COMMAND, sample: allSample },
    tx_total: { value: point.totals.tx_total, exact: true },
    requests_est: valueOf(`${T}.requests`, 0),
    requests_per_tx: valueOf(`${T}.requests_per_tx`),
    fulfilled_rate: valueOf(`${T}.fulfilled_rate`),
    duplicate_request_rate: valueOf(`${T}.duplicate_request_rate`),
    tx_kind_share: Object.fromEntries(kinds.map((k) => [k, valueOf(key(T, "tx_kind_share", k))])),
    tx_signer_class_share: Object.fromEntries(classes.map((k) => [k, valueOf(key(T, "tx_signer_class_share", k))])),
    top_requesters: topTotal.map((p) => ({ requester: p, share_of_requests: valueOf(key(T, "requester_share", p)), requests_est: valueOf(key(T, "requester_requests", p), 0) })),
  },
  months,
};
mkdirSync(ROOT + "out", { recursive: true });
const text = JSON.stringify(out, null, 2) + "\n";
writeFileSync(ROOT + "out/metrics.json", text);
console.log(`out/metrics.json written. sha256 ${sha256(Buffer.from(text))}`);
console.log(`months: ${months.length}, clusters: ${allSample.n_clusters}, sampled txs: ${allSample.n_txs}, estimated requests: ${out.totals.requests_est.value} (95% CI ${out.totals.requests_est.ci95.join(" – ")})`);
