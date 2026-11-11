// Estimation of Chain Signatures usage from exact monthly tx totals + a cluster sample of tx details.
//   estimated requests (month) = exact tx total x (sign receipts per tx in the sample)        -- ratio estimator
// 95% confidence intervals: cluster bootstrap (clusters are resampled with replacement within each month; census months are exact).
// All functions are pure; reproduce.mjs does the I/O.
import { mulberry32 } from "./lib/rng.mjs";

const KINDS = ["request", "verify_request", "respond", "respond_verify", "admin_or_other"];
const CLASSES = ["mpc_node", "request_side", "other"];

/** Group parsed rows (one per receipt) into per-cluster additive statistics. */
export function clusterStats(rows) {
  const byCluster = new Map();
  for (const r of rows) {
    if (!byCluster.has(r.cluster_id)) byCluster.set(r.cluster_id, { cluster_id: r.cluster_id, month: r.month, census: Number(r.census) === 1, rows: [] });
    byCluster.get(r.cluster_id).rows.push(r);
  }
  const out = [];
  for (const c of byCluster.values()) {
    const s = { cluster_id: c.cluster_id, month: c.month, census: c.census, n_tx: 0, sign: 0, fulfilled: 0, dup_extra: 0, respond_failed: 0, respond_total: 0, kinds: {}, classes: {}, requesters: {} };
    for (const k of KINDS) s.kinds[k] = 0;
    for (const k of CLASSES) s.classes[k] = 0;
    const seenTx = new Set();
    const signKeys = new Set();
    for (const r of c.rows) {
      if (!seenTx.has(r.tx_hash)) {
        seenTx.add(r.tx_hash);
        s.n_tx++;
        s.kinds[r.tx_kind] = (s.kinds[r.tx_kind] ?? 0) + 1;
        s.classes[r.tx_signer_class] = (s.classes[r.tx_signer_class] ?? 0) + 1;
      }
      if (r.method === "sign") {
        s.sign++;
        if (Number(r.fulfilled) === 1) s.fulfilled++;
        s.requesters[r.predecessor] = (s.requesters[r.predecessor] ?? 0) + 1;
        signKeys.add([r.payload_hash, r.domain_id, r.key_version, r.path, r.predecessor].join("|"));
      }
      if (r.method === "respond") { s.respond_total++; if (r.receipt_status === "Failure") s.respond_failed++; }
    }
    s.dup_extra = s.sign - signKeys.size; // sign receipts that repeat an identical (payload, domain, path, requester) key inside the cluster
    out.push(s);
  }
  return out.sort((a, b) => a.cluster_id.localeCompare(b.cluster_id));
}

const addInto = (acc, s) => {
  for (const k of ["n_tx", "sign", "fulfilled", "dup_extra", "respond_failed", "respond_total"]) acc[k] += s[k];
  for (const g of ["kinds", "classes", "requesters"]) for (const [k, v] of Object.entries(s[g])) acc[g][k] = (acc[g][k] ?? 0) + v;
};
const emptySums = () => ({ n_tx: 0, sign: 0, fulfilled: 0, dup_extra: 0, respond_failed: 0, respond_total: 0, kinds: {}, classes: {}, requesters: {} });
export function sumClusters(list) { const a = emptySums(); for (const s of list) addInto(a, s); return a; }

const ratio = (a, b) => (b > 0 ? a / b : 0);

/** Point estimates from per-month sums. `months`: [{month, txTotal, partial, sums}]. Returns a nested object of plain numbers. */
export function estimateFromSums(months, topTotal = 15, topMonth = 5, keepRequesters = null) {
  const res = { months: {}, totals: {} };
  const tot = { tx: 0, req: 0, fulfilled: 0, dup: 0, respondFailedTx: 0, kinds: {}, classes: {}, requesters: {} };
  for (const m of months) {
    const { sums: s, txTotal: N } = m;
    const f = ratio(N, s.n_tx); // scale from sample txs to all txs of the month
    const req = s.sign * f;
    const rec = {
      tx_total: N,
      requests: req,
      requests_per_tx: ratio(s.sign, s.n_tx),
      fulfilled_rate: ratio(s.fulfilled, s.sign),
      duplicate_request_rate: ratio(s.dup_extra, s.sign),
      failed_respond_share_of_respond_receipts: ratio(s.respond_failed, s.respond_total),
      tx_kind_share: Object.fromEntries(KINDS.map((k) => [k, ratio(s.kinds[k] ?? 0, s.n_tx)])),
      tx_signer_class_share: Object.fromEntries(CLASSES.map((k) => [k, ratio(s.classes[k] ?? 0, s.n_tx)])),
      requester_share: {},
      requester_requests: {},
    };
    const names = keepRequesters ?? Object.keys(s.requesters);
    for (const p of names) { rec.requester_share[p] = ratio(s.requesters[p] ?? 0, s.sign); rec.requester_requests[p] = (s.requesters[p] ?? 0) * f; }
    res.months[m.month] = rec;
    tot.tx += N; tot.req += req; tot.fulfilled += rec.fulfilled_rate * req; tot.dup += rec.duplicate_request_rate * req;
    for (const k of KINDS) tot.kinds[k] = (tot.kinds[k] ?? 0) + (s.kinds[k] ?? 0) * f;
    for (const k of CLASSES) tot.classes[k] = (tot.classes[k] ?? 0) + (s.classes[k] ?? 0) * f;
    for (const [p, v] of Object.entries(s.requesters)) tot.requesters[p] = (tot.requesters[p] ?? 0) + v * f;
  }
  res.totals = {
    tx_total: tot.tx,
    requests: tot.req,
    requests_per_tx: ratio(tot.req, tot.tx),
    fulfilled_rate: ratio(tot.fulfilled, tot.req),
    duplicate_request_rate: ratio(tot.dup, tot.req),
    tx_kind_share: Object.fromEntries(KINDS.map((k) => [k, ratio(tot.kinds[k] ?? 0, tot.tx)])),
    tx_signer_class_share: Object.fromEntries(CLASSES.map((k) => [k, ratio(tot.classes[k] ?? 0, tot.tx)])),
    requester_share: {},
    requester_requests: {},
  };
  const names = keepRequesters ?? Object.keys(tot.requesters);
  for (const p of names) { res.totals.requester_share[p] = ratio(tot.requesters[p] ?? 0, tot.req); res.totals.requester_requests[p] = tot.requesters[p] ?? 0; }
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
 * Returns { point, ci } where ci[flatKey] = [lo, hi] (95% percentile interval over bootstrap replicates).
 */
export function estimateWithBootstrap(clusters, totals, { seed, replicates, topRequestersTotal = 15, topRequestersPerMonth = 5 }) {
  const byMonth = new Map();
  for (const c of clusters) { if (!byMonth.has(c.month)) byMonth.set(c.month, []); byMonth.get(c.month).push(c); }
  const monthsList = totals.filter((t) => byMonth.has(t.month)).map((t) => ({ month: t.month, txTotal: Number(t.txs_count), partial: Number(t.partial) === 1, list: byMonth.get(t.month) }));
  const toInput = (pick) => monthsList.map((m) => ({ month: m.month, txTotal: m.txTotal, sums: sumClusters(pick(m)) }));

  const pointRaw = estimateFromSums(toInput((m) => m.list));
  // requester sets to track: all requesters ever seen (so replicate vectors line up)
  const allReq = Object.keys(pointRaw.totals.requester_share);
  const point = estimateFromSums(toInput((m) => m.list), topRequestersTotal, topRequestersPerMonth, allReq);
  const pointFlat = flatten(point);

  const rng = mulberry32(seed);
  const reps = {};
  for (const k of Object.keys(pointFlat)) reps[k] = [];
  for (let b = 0; b < replicates; b++) {
    const input = monthsList.map((m) => {
      const isCensus = m.list.every((c) => c.census);
      const picked = isCensus ? m.list : Array.from({ length: m.list.length }, () => m.list[Math.floor(rng() * m.list.length)]);
      return { month: m.month, txTotal: m.txTotal, sums: sumClusters(picked) };
    });
    const flat = flatten(estimateFromSums(input, topRequestersTotal, topRequestersPerMonth, allReq));
    for (const k of Object.keys(pointFlat)) reps[k].push(flat[k] ?? 0);
  }
  const ci = {};
  for (const [k, arr] of Object.entries(reps)) { arr.sort((a, b) => a - b); ci[k] = [percentile(arr, 0.025), percentile(arr, 0.975)]; }
  return { point, pointFlat, ci, monthsList };
}
