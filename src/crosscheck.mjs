// Cross-check of the sample estimate against exact per-account tx counts (FastNEAR /v0/account, keyless).
// An account's tx count measures its sign requests only if (almost) every tx touching the account carries exactly one
// sign receipt by it; that is checked on sampled windows (data/exact/unit-check.json). Accounts that fail the check are not compared.
export const ACCOUNTS = {
  "fast-auth.near": "FastAuth",
  "7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora": "Relay allocator",
  "tx-bench.near": "Suspected benchmark",
  "omni.bridge.near": "Omni bridge",
  "btc-connector.bridge.near": "Bitcoin connector",
  "zcash-connector.bridge.near": "Zcash connector",
};
export const MIN_COMPARED = 1000; // months where both the estimate and the exact count are tiny say nothing

/** metrics = out/metrics.json, exact = { counts: {"acct|YYYY-MM": {any, pred, partial}}, unit: {"acct|YYYY-MM": {txs, with_sign_by_acc, sign_receipts_by_acc, max_signs_per_tx}}, meta } */
export function buildCrosscheck(metrics, exact) {
  const unitOf = (a) => Object.entries(exact.unit).filter(([k]) => k.startsWith(`${a}|`)).map(([k, v]) => ({ month: k.split("|")[1], txs: v.txs, with_sign: v.with_sign_by_acc, sign_receipts: v.sign_receipts_by_acc, max_per_tx: v.max_signs_per_tx }));
  const verified = [], notCompared = [];
  for (const [a, name] of Object.entries(ACCOUNTS)) {
    const u = unitOf(a);
    const ok = u.length > 0 && u.every((x) => x.txs > 0 && x.sign_receipts === x.txs && x.max_per_tx === 1);
    (ok ? verified : notCompared).push({ account: a, name, unit_check: u, ...(ok ? {} : { reason: "account tx counts are not a measure of its sign requests: not every tx touching the account carries one sign receipt by it" }) });
  }
  const comparisons = [];
  for (const v of verified) for (const m of metrics.months) {
    if (m.partial_month) continue;
    const c = exact.counts[`${v.account}|${m.month}`]; if (!c) continue;
    const d = m.drivers_requests[v.account], est = d?.value ?? 0, ci = d?.ci95 ?? [0, 0];
    if (Math.max(est, c.any) < MIN_COMPARED) continue;
    comparisons.push({ account: v.account, name: v.name, month: m.month, estimate: est, ci95: ci, exact: c.any, inside: c.any >= ci[0] && c.any <= ci[1] });
  }
  const inside = comparisons.filter((x) => x.inside).length;
  // the first month from which an account has no tx at all, through the last month counted
  const zeroFrom = (a) => { const ms = metrics.months.map((m) => m.month); let z = null; for (let i = ms.length - 1; i >= 0; i--) { const c = exact.counts[`${a}|${ms[i]}`]; if (!c || c.any !== 0) break; z = ms[i]; } return z; };
  return {
    note: "Sample estimates of requests per requester compared with exact per-account transaction counts. Only accounts whose txs carry exactly one sign receipt by the account (unit check) are compared. Our 95% intervals cover sampling error only.",
    source: exact.meta,
    min_compared: MIN_COMPARED,
    verified, not_compared: notCompared, comparisons,
    summary: { compared: comparisons.length, inside, outside: comparisons.length - inside, outside_months: comparisons.filter((x) => !x.inside).map((x) => `${x.name} ${x.month}`) },
    exact_zero_from: Object.fromEntries(verified.map((v) => [v.account, zeroFrom(v.account)])),
  };
}
