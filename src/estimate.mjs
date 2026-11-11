// Estimation of Chain Signatures usage from exact monthly tx totals + a cluster sample of tx details.
//   estimated requests (month) = exact tx total x (sign receipts per tx in the sample)        -- ratio estimator
// 95% confidence intervals: cluster bootstrap (clusters are resampled with replacement within each month; census months are exact).
// All functions are pure; reproduce.mjs does the I/O.
import { mulberry32 } from "./lib/rng.mjs";

export const KINDS = ["request", "verify_request", "respond", "respond_verify", "admin_or_other"];
export const CLASSES = ["mpc_node", "request_side", "other"];
const NUM_FIELDS = ["n_tx", "receipts", "sign", "sign_failed", "fulfilled", "dup_extra", "respond_failed", "respond_total"];
// grouped counters. PER_TX groups are counted per transaction / per receipt (denominator: txs); PER_SIGN groups per sign receipt (denominator: requests).
export const PER_TX = ["kinds", "classes", "methods"];
export const PER_SIGN = ["requesters", "categories", "confidences", "chains", "chain_confidences", "keytypes", "failed_by_requester"];
const ALL_GROUPS = [...PER_TX, ...PER_SIGN];
// summed but not reported generically: (requester, tx signer) pairs of sign receipts
const SUMMED = [...ALL_GROUPS, "req_signer"];
const pairKey = (req, signer) => `${req}<-${signer}`;

/** Group parsed rows (one per receipt) into per-cluster additive statistics.
 *  ctx: { categoryOf(account) -> string, confidenceOf(account) -> string, chainOf(row) -> string, keyTypeOf(row) -> string } (all optional) */
export function clusterStats(rows, ctx = {}) {
  const categoryOf = ctx.categoryOf ?? (() => "unlabeled");
  const confidenceOf = ctx.confidenceOf ?? (() => "unlabeled");
  const chainOf = ctx.chainOf ?? (() => "unclassified");
  const chainConfidenceOf = ctx.chainConfidenceOf ?? (() => "none");
  const keyTypeOf = ctx.keyTypeOf ?? (() => "unknown");
  const byCluster = new Map();
  for (const r of rows) {
    if (!byCluster.has(r.cluster_id)) byCluster.set(r.cluster_id, { cluster_id: r.cluster_id, month: r.month, census: Number(r.census) === 1, rows: [] });
    byCluster.get(r.cluster_id).rows.push(r);
  }
  const out = [];
  for (const c of byCluster.values()) {
    const s = { cluster_id: c.cluster_id, month: c.month, census: c.census };
    for (const f of NUM_FIELDS) s[f] = 0;
    for (const g of SUMMED) s[g] = {};
    for (const k of KINDS) s.kinds[k] = 0;
    for (const k of CLASSES) s.classes[k] = 0;
    const bump = (g, k, d = 1) => { s[g][k] = (s[g][k] ?? 0) + d; };
    const seenTx = new Set();
    const signKeys = new Set();
    let minH = Infinity, maxH = -Infinity;
    for (const r of c.rows) {
      s.receipts++;
      bump("methods", r.method);
      const h = Number(r.tx_block_height);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      if (!seenTx.has(r.tx_hash)) {
        seenTx.add(r.tx_hash);
        s.n_tx++;
        bump("kinds", r.tx_kind);
        bump("classes", r.tx_signer_class);
      }
      if (r.method === "sign") {
        s.sign++;
        if (r.receipt_status === "Failure") { s.sign_failed++; bump("failed_by_requester", r.predecessor); } // rejected by the contract itself (e.g. "already submitted")
        if (Number(r.fulfilled) === 1) s.fulfilled++;
        bump("requesters", r.predecessor);
        bump("req_signer", pairKey(r.predecessor, r.tx_signer));
        bump("categories", categoryOf(r.predecessor));
        bump("confidences", confidenceOf(r.predecessor));
        bump("chains", chainOf(r));
        bump("chain_confidences", chainConfidenceOf(r));
        bump("keytypes", keyTypeOf(r));
        signKeys.add([r.payload_hash, r.domain_id, r.key_version, r.path, r.predecessor].join("|"));
      }
      if (r.method === "respond") { s.respond_total++; if (r.receipt_status === "Failure") s.respond_failed++; }
    }
    s.dup_extra = s.sign - signKeys.size; // sign receipts that repeat an identical (payload, domain, path, requester) key inside the cluster
    s.span_blocks = Number.isFinite(minH) ? maxH - minH + 1 : 0; // block span covered by the cluster (used only by the robustness check)
    out.push(s);
  }
  return out.sort((a, b) => a.cluster_id.localeCompare(b.cluster_id));
}

const addInto = (acc, s, w = 1) => {
  for (const k of NUM_FIELDS) acc[k] += w * s[k];
  for (const g of SUMMED) for (const [k, v] of Object.entries(s[g])) acc[g][k] = (acc[g][k] ?? 0) + w * v;
};
const emptySums = () => { const a = {}; for (const f of NUM_FIELDS) a[f] = 0; for (const g of SUMMED) a[g] = {}; return a; };
/** Sum clusters; optional weights (same length) are used by the density-weighted robustness variant. */
export function sumClusters(list, weights = null) { const a = emptySums(); list.forEach((s, i) => addInto(a, s, weights ? weights[i] : 1)); return a; }

const ratio = (a, b) => (b > 0 ? a / b : 0);

/** Concentration of requests across requesters: top-1 and top-3 share, Herfindahl-Hirschman index (sum of squared shares, 0..1), number of requesters with >= 1% share. */
export function concentration(counts) {
  const vals = Object.values(counts).filter((v) => v > 0).sort((a, b) => b - a);
  const tot = vals.reduce((a, b) => a + b, 0);
  if (!tot) return { top1_share: 0, top3_share: 0, hhi: 0, requesters_ge_1pct: 0 };
  const sh = vals.map((v) => v / tot);
  return { top1_share: sh[0], top3_share: sh.slice(0, 3).reduce((a, b) => a + b, 0), hhi: sh.reduce((a, b) => a + b * b, 0), requesters_ge_1pct: sh.filter((x) => x >= 0.01).length };
}
const seriesValue = (def, counts, total, f) => {
  if (def.include) return def.include.reduce((a, n) => a + (counts[n] ?? 0), 0) * f;
  return total - (def.exclude ?? []).reduce((a, n) => a + (counts[n] ?? 0), 0) * f;
};

/** Names to track per group (stable key sets across bootstrap replicates). */
export function trackedNames(clusters, { requesters = [], extraRequesters = 0 } = {}) {
  const tot = {};
  for (const g of ALL_GROUPS) { tot[g] = {}; for (const c of clusters) for (const [k, v] of Object.entries(c[g])) tot[g][k] = (tot[g][k] ?? 0) + v; }
  const top = Object.entries(tot.requesters).sort((a, b) => b[1] - a[1]).slice(0, extraRequesters).map(([k]) => k);
  return {
    kinds: KINDS, classes: CLASSES,
    methods: Object.keys(tot.methods).sort(),
    categories: Object.keys(tot.categories).sort(),
    confidences: Object.keys(tot.confidences).sort(),
    chains: Object.keys(tot.chains).sort(),
    chain_confidences: Object.keys(tot.chain_confidences).sort(),
    keytypes: Object.keys(tot.keytypes).sort(),
    requesters: [...new Set([...requesters, ...top])],
  };
}

/** Point estimates from per-month sums. months: [{month, txTotal, sums}]. Returns a nested object of plain numbers.
 *  opts: { names: trackedNames(...), drivers: [account...] } */
export function estimateFromSums(months, opts = {}) {
  const names = opts.names ?? { kinds: KINDS, classes: CLASSES, methods: [], categories: [], confidences: [], chains: [], chain_confidences: [], keytypes: [], requesters: [] };
  const benchmark = opts.benchmarkAccounts ?? [];
  const drivers = opts.drivers ?? [];
  const series = opts.series ?? {}; // { name: { include: [accounts] } | { exclude: [accounts] } }
  const chainGroups = opts.chainGroups ?? {}; // { name: [chain families] }
  const pairs = opts.pairs ?? []; // [[requester, txSigner]]: share of the requester's sign receipts sent by that tx signer (e.g. a relayer)
  const trackedFailed = names.requesters;
  const res = { months: {}, totals: null };
  const T = { tx: 0, req: 0, receipts: 0, fulfilled: 0, signFailed: 0, dup: 0, respondFailed: 0, respondTotal: 0, identified: 0 };
  for (const g of ALL_GROUPS) T[g] = {};
  T.pairs = {};
  T.allReq = {};
  T.chainGroups = {};
  const nameSet = (g) => (g === "failed_by_requester" ? trackedFailed : names[g]);

  for (const m of months) {
    const { sums: s, txTotal: N } = m;
    const f = ratio(N, s.n_tx); // sample txs -> all txs of the month
    const req = s.sign * f;
    const rec = {
      tx_total: N, requests: req,
      requests_per_tx: ratio(s.sign, s.n_tx),
      receipts_per_tx: ratio(s.receipts, s.n_tx),
      fulfilled_rate: ratio(s.fulfilled, s.sign),
      sign_receipt_failed_rate: ratio(s.sign_failed, s.sign),
      identified_share: ratio(s.sign - (s.categories.unknown ?? 0) - (s.categories.unlabeled ?? 0), s.sign), // requests whose requester has a known (not 'unknown'/unlabeled) category
      duplicate_request_rate: ratio(s.dup_extra, s.sign),
      failed_respond_share_of_respond_receipts: ratio(s.respond_failed, s.respond_total),
    };
    for (const g of ALL_GROUPS) {
      rec[g] = { est: {}, share: {} };
      for (const n of nameSet(g)) {
        const cnt = s[g][n] ?? 0;
        rec[g].est[n] = cnt * f;
        rec[g].share[n] = PER_SIGN.includes(g) ? ratio(cnt, s.sign) : ratio(cnt, s.n_tx);
        T[g][n] = (T[g][n] ?? 0) + cnt * f;
      }
    }
    rec.sign_failed_est = s.sign_failed * f;
    rec.concentration = concentration(s.requesters);
    rec.series = Object.fromEntries(Object.entries(series).map(([k, d]) => [k, seriesValue(d, s.requesters, req, f)]));
    rec.chain_groups_share = Object.fromEntries(Object.entries(chainGroups).map(([k, fams]) => [k, ratio(fams.reduce((a, x) => a + (s.chains[x] ?? 0), 0), s.sign)]));
    for (const [a, v] of Object.entries(s.requesters)) T.allReq[a] = (T.allReq[a] ?? 0) + v * f;
    for (const [k, fams] of Object.entries(chainGroups)) T.chainGroups[k] = (T.chainGroups[k] ?? 0) + fams.reduce((a, x) => a + (s.chains[x] ?? 0), 0) * f;
    if (pairs.length) { rec.pairs = {}; for (const [a, b] of pairs) rec.pairs[pairKey(a, b)] = ratio(s.req_signer[pairKey(a, b)] ?? 0, s.requesters[a] ?? 0); }
    for (const [a, b] of pairs) { T.pairs[pairKey(a, b)] = (T.pairs[pairKey(a, b)] ?? 0) + (s.req_signer[pairKey(a, b)] ?? 0) * f; }
    T.identified += rec.identified_share * req;
    rec.requests_excluding_benchmark = req - benchmark.reduce((a, b) => a + (s.requesters[b] ?? 0) * f, 0); // headline variant without benchmark/test (confirmed or suspected) accounts
    if (drivers.length) {
      rec.drivers = {};
      let used = 0;
      for (const d of drivers) { const v = (s.requesters[d] ?? 0) * f; rec.drivers[d] = v; used += v; }
      rec.drivers.__other = req - used;
    }
    res.months[m.month] = rec;
    T.tx += N; T.req += req; T.receipts += s.receipts * f; T.fulfilled += s.fulfilled * f; T.signFailed += s.sign_failed * f; T.dup += s.dup_extra * f;
    T.respondFailed += s.respond_failed * f; T.respondTotal += s.respond_total * f;
  }
  const tot = {
    tx_total: T.tx, requests: T.req,
    requests_per_tx: ratio(T.req, T.tx), receipts_per_tx: ratio(T.receipts, T.tx),
    fulfilled_rate: ratio(T.fulfilled, T.req), sign_receipt_failed_rate: ratio(T.signFailed, T.req), duplicate_request_rate: ratio(T.dup, T.req),
    failed_respond_share_of_respond_receipts: ratio(T.respondFailed, T.respondTotal),
    sign_failed_est: T.signFailed,
    identified_share: ratio(T.identified, T.req),
    requests_excluding_benchmark: Object.values(res.months).reduce((a, r) => a + r.requests_excluding_benchmark, 0),
  };
  for (const g of ALL_GROUPS) {
    tot[g] = { est: {}, share: {} };
    for (const n of nameSet(g)) {
      const e = T[g][n] ?? 0;
      tot[g].est[n] = e;
      tot[g].share[n] = PER_SIGN.includes(g) ? ratio(e, T.req) : ratio(e, T.tx);
    }
  }
  if (drivers.length) {
    tot.drivers = {};
    let used = 0;
    for (const d of drivers) { const v = Object.values(res.months).reduce((a, r) => a + r.drivers[d], 0); tot.drivers[d] = v; used += v; }
    tot.drivers.__other = T.req - used;
  }
  tot.concentration = concentration(T.allReq);
  tot.series = Object.fromEntries(Object.keys(series).map((k) => [k, Object.values(res.months).reduce((a, r) => a + r.series[k], 0)]));
  tot.chain_groups_share = Object.fromEntries(Object.keys(chainGroups).map((k) => [k, ratio(T.chainGroups[k] ?? 0, T.req)]));
  if (pairs.length) { tot.pairs = {}; for (const [a, b] of pairs) tot.pairs[pairKey(a, b)] = ratio(T.pairs[pairKey(a, b)] ?? 0, T.requesters[a] ?? 0); }
  res.totals = tot;
  return res;
}

/** Flatten nested numbers into {"a.b.c": number}. Keys that contain dots (account ids) are escaped with "|". */
export function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k.replace(/\./g, "|")}` : k.replace(/\./g, "|");
    if (typeof v === "number") out[key] = v;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

function percentile(sorted, q) {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1) + 1e-9)));
  return sorted[idx];
}

/**
 * Full run. clusters: output of clusterStats; totals: [{month, txs_count, partial}].
 * opts: { seed, replicates, requesters: [accounts always tracked], extraRequesters: N (also track the top N), drivers: [accounts], benchmarkAccounts: [accounts] }
 * Returns { point, pointFlat, ci, monthsList, names } where ci[flatKey] = [lo, hi] (95% percentile interval over bootstrap replicates).
 */
export function estimateWithBootstrap(clusters, totals, opts) {
  const { seed, replicates } = opts;
  const byMonth = new Map();
  for (const c of clusters) { if (!byMonth.has(c.month)) byMonth.set(c.month, []); byMonth.get(c.month).push(c); }
  const monthsList = totals.filter((t) => byMonth.has(t.month)).map((t) => ({ month: t.month, txTotal: Number(t.txs_count), partial: Number(t.partial) === 1, list: byMonth.get(t.month) }));
  const names = trackedNames(clusters, { requesters: [...(opts.requesters ?? []), ...(opts.drivers ?? [])], extraRequesters: opts.extraRequesters ?? 0 });
  const eopts = { names, drivers: opts.drivers ?? [], benchmarkAccounts: opts.benchmarkAccounts ?? [], pairs: opts.pairs ?? [], series: opts.series ?? {}, chainGroups: opts.chainGroups ?? {} };
  const toInput = (pick) => monthsList.map((m) => ({ month: m.month, txTotal: m.txTotal, sums: sumClusters(pick(m)) }));

  const point = estimateFromSums(toInput((m) => m.list), eopts);
  const pointFlat = flatten(point);
  const rng = mulberry32(seed);
  const reps = {};
  for (const k of Object.keys(pointFlat)) reps[k] = new Float64Array(replicates);
  for (let b = 0; b < replicates; b++) {
    const input = monthsList.map((m) => {
      const isCensus = m.list.every((c) => c.census);
      const picked = isCensus ? m.list : Array.from({ length: m.list.length }, () => m.list[Math.floor(rng() * m.list.length)]);
      return { month: m.month, txTotal: m.txTotal, sums: sumClusters(picked) };
    });
    const flat = flatten(estimateFromSums(input, eopts));
    for (const k of Object.keys(pointFlat)) reps[k][b] = flat[k] ?? 0;
  }
  const ci = {};
  for (const [k, arr] of Object.entries(reps)) { const sorted = Array.from(arr).sort((a, b) => a - b); ci[k] = [percentile(sorted, 0.025), percentile(sorted, 0.975)]; }
  return { point, pointFlat, ci, monthsList, names };
}
