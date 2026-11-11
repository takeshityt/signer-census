// PART G: robustness of the sample estimator. Pure functions.
import { mulberry32 } from "./lib/rng.mjs";
import { sumClusters } from "./estimate.mjs";

const pct = (a, b) => (b === 0 ? 0 : (a - b) / b);

/** Alternative weighting that corrects the block-uniform start bias: a cluster that spans S blocks is reached by a uniform random start with
 *  probability ~ S / month_length, so its txs get weight 1/S (density weighting). Census months keep weight 1. */
export function densityWeighted(clusters, monthTotals, ci = null) {
  const byMonth = new Map();
  for (const c of clusters) { if (!byMonth.has(c.month)) byMonth.set(c.month, []); byMonth.get(c.month).push(c); }
  const months = {};
  let totU = 0, totW = 0;
  for (const t of monthTotals) {
    const list = byMonth.get(t.month);
    if (!list) continue;
    const N = Number(t.txs_count);
    const census = list.every((c) => c.census);
    const w = census ? list.map(() => 1) : list.map((c) => 1 / Math.max(1, c.span_blocks));
    const su = sumClusters(list), sw = sumClusters(list, w);
    const u = su.n_tx ? (N * su.sign) / su.n_tx : 0;
    const d = sw.n_tx ? (N * sw.sign) / sw.n_tx : 0;
    const [lo, hi] = ci ? ci[`months.${t.month}.requests`] : [NaN, NaN];
    months[t.month] = { unweighted: u, density_weighted: d, delta_pct: pct(d, u), inside_unweighted_ci95: d >= lo && d <= hi };
    totU += u; totW += d;
  }
  return { months, totals: { unweighted: totU, density_weighted: totW, delta_pct: pct(totW, totU) } };
}

/** Replay the sampling design on a fully enumerated (census) month: draw `clusters` random start heights, take the next `page` txs of the month each,
 *  estimate N x sign/tx, compare with the exact value. rowsOfMonth: parsed rows of the census month. */
export function censusReplay(rowsOfMonth, totalRow, { seed, replicates, clusters = 20, page = 200 }) {
  const txs = new Map();
  for (const r of rowsOfMonth) {
    if (!txs.has(r.tx_hash)) txs.set(r.tx_hash, { h: Number(r.tx_block_height), sign: 0 });
    if (r.method === "sign") txs.get(r.tx_hash).sign++;
  }
  const list = [...txs.values()].sort((a, b) => a.h - b.h);
  const N = list.length; // equals the exact tx total for a census month
  const exact = list.reduce((a, t) => a + t.sign, 0);
  const start = Number(totalRow.start_height), end = Number(totalRow.end_height_exclusive);
  const rng = mulberry32(seed);
  const est = [];
  for (let b = 0; b < replicates; b++) {
    let n = 0, s = 0;
    for (let i = 0; i < clusters; i++) {
      const h0 = start + Math.floor(rng() * (end - start));
      let lo = 0, hi = list.length; // first tx with h >= h0
      while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid].h >= h0) hi = mid; else lo = mid + 1; }
      for (const t of list.slice(lo, lo + page)) { n++; s += t.sign; }
    }
    est.push(n ? (N * s) / n : 0);
  }
  const mean = est.reduce((a, b) => a + b, 0) / est.length;
  const rmse = Math.sqrt(est.reduce((a, b) => a + (b - exact) ** 2, 0) / est.length);
  return { month: totalRow.month, txs: N, exact_requests: exact, replicates, mean_estimate: mean, bias_pct: pct(mean, exact), rmse_pct: exact ? rmse / exact : 0,
    share_within_5pct: est.filter((e) => Math.abs(pct(e, exact)) <= 0.05).length / est.length };
}

/** Reconciliation windows: sign receipts per tx in a 300-block window vs the month's estimated requests per tx. */
export function windowComparison(windows, monthTotals, point, ci) {
  return windows.map((w) => {
    const m = [...monthTotals].reverse().find((t) => Number(t.start_height) <= w.from);
    const rec = point.months[m.month];
    const [lo, hi] = ci[`months.${m.month}.requests_per_tx`];
    const ratio = w.sign_receipts / w.txs;
    // a 300-block window is a small sample on its own: its binomial standard error is ~ sqrt(p(1-p)/txs); the month interval is much narrower than that
    const se = Math.sqrt((rec.requests_per_tx * (1 - rec.requests_per_tx)) / w.txs);
    return { window: w.name, month: m.month, window_txs: w.txs, window_sign_receipts: w.sign_receipts, window_ratio: ratio, month_ratio: rec.requests_per_tx, month_ci95: [lo, hi],
      delta_pct: pct(ratio, rec.requests_per_tx), window_se: se, within_2_window_se: Math.abs(ratio - rec.requests_per_tx) <= 2 * se };
  });
}
