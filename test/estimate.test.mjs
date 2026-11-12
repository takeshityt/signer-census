import { describe, it, expect } from "vitest";
import { clusterStats, estimateWithBootstrap, estimateFromSums, sumClusters, flatten, trackedNames, concentration } from "../src/estimate.mjs";

// helper: build parsed-row fixtures. tx spec: {kind, cls, signs: [requester...], fulfilled?, sameKey?, signFailed?, failed?, path?, domain?}
let txn = 0;
function rows(cluster, month, census, txs) {
  const out = [];
  for (const t of txs) {
    const tx_hash = `tx${++txn}`;
    const base = { cluster_id: cluster, month, census: census ? 1 : 0, tx_hash, tx_block_height: 1000 + txn, tx_kind: t.kind, tx_signer_class: t.cls ?? "other", receipt_status: "Success", callback_method: "", callback_status: "", fulfilled: "", payload_hash: "", domain_id: t.domain ?? "", key_version: "", path: t.path ?? "" };
    for (const [i, who] of (t.signs ?? []).entries()) out.push({ ...base, method: "sign", predecessor: who, receipt_status: t.signFailed ? "Failure" : "Success", fulfilled: t.fulfilled === false ? 0 : 1, payload_hash: t.sameKey ? "same" : `p${txn}_${i}`, path: t.path ?? "x" });
    if (t.kind === "respond") out.push({ ...base, method: "respond", predecessor: "node", receipt_status: t.failed ? "Failure" : "Success" });
    if (!t.signs && t.kind !== "respond") out.push({ ...base, method: "submit_participant_info", predecessor: "node" });
  }
  return out;
}
const req = (n, who = "A", extra = {}) => ({ kind: "request", cls: "request_side", signs: Array.from({ length: n }, () => who), ...extra });
const resp = (k, extra = {}) => Array.from({ length: k }, () => ({ kind: "respond", cls: "mpc_node", ...extra }));
const OPT = { seed: 1, replicates: 50, requesters: ["A", "B", "C"] };

describe("clusterStats", () => {
  it("counts txs once, signs, fulfilled, duplicates, failed responds, methods", () => {
    const r = rows("m-c0", "2026-01", false, [req(1, "A"), req(1, "A", { sameKey: true }), req(1, "A", { sameKey: true, fulfilled: false }), ...resp(1), ...resp(1, { failed: true })]);
    const [c] = clusterStats(r);
    expect(c.n_tx).toBe(5);
    expect(c.sign).toBe(3);
    expect(c.fulfilled).toBe(2);
    expect(c.sign_failed).toBe(0);
    expect(c.dup_extra).toBe(1); // two sign receipts share one identical key
    expect(c.respond_total).toBe(2);
    expect(c.respond_failed).toBe(1);
    expect(c.kinds.request).toBe(3);
    expect(c.kinds.respond).toBe(2);
    expect(c.requesters.A).toBe(3);
    expect(c.methods).toEqual({ sign: 3, respond: 2 });
    expect(c.receipts).toBe(5);
  });

  it("applies label and chain context to sign receipts only", () => {
    const r = rows("m-c0", "2026-01", false, [req(2, "A", { path: "bridge-1" }), req(1, "B", { path: "0xabc" }), ...resp(1)]);
    const ctx = { categoryOf: (a) => (a === "A" ? "bridge" : "unlabeled"), chainOf: (row) => (row.path === "bridge-1" ? "evm" : "unknown"), keyTypeOf: () => "secp256k1" };
    const [c] = clusterStats(r, ctx);
    expect(c.categories).toEqual({ bridge: 2, unlabeled: 1 });
    expect(c.chains).toEqual({ evm: 2, unknown: 1 });
    expect(c.keytypes).toEqual({ secp256k1: 3 });
  });

  it("tracks sign receipts rejected by the contract per requester", () => {
    const r = rows("m-c0", "2026-01", false, [req(1, "A"), req(1, "B", { signFailed: true, fulfilled: false }), ...resp(1)]);
    const [c] = clusterStats(r);
    expect(c.sign_failed).toBe(1);
    expect(c.failed_by_requester).toEqual({ B: 1 });
  });
});

describe("estimates", () => {
  // month X: cluster1 = 10 txs with 4 signs (A:3,B:1); cluster2 = 10 txs with 6 signs (A:2,B:4). Exact month total = 1000 txs.
  const sampleRows = [
    ...rows("X-c0", "2026-02", false, [req(3, "A"), req(1, "B"), ...resp(8)]),
    ...rows("X-c1", "2026-02", false, [req(2, "A"), req(4, "B"), ...resp(8)]),
  ];
  const totals = [{ month: "2026-02", txs_count: "1000", partial: "0" }];

  it("requests = exact tx total x sign-per-tx (ratio estimator); shares are exact in-sample ratios", () => {
    const { point } = estimateWithBootstrap(clusterStats(sampleRows), totals, OPT);
    expect(point.months["2026-02"].requests).toBeCloseTo(500, 9); // 10 signs over 20 txs -> 0.5 per tx
    expect(point.totals.requests).toBeCloseTo(500, 9);
    expect(point.months["2026-02"].requesters.share.A).toBeCloseTo(0.5, 9);
    expect(point.months["2026-02"].requesters.share.B).toBeCloseTo(0.5, 9);
    expect(point.totals.kinds.share.respond).toBeCloseTo(16 / 20, 9);
    expect(point.totals.methods.est.respond).toBeCloseTo(800, 9); // 16 respond receipts / 20 txs x 1000
    expect(point.totals.tx_total).toBe(1000);
  });

  it("drivers: tracked requesters plus an 'other' remainder add up exactly to total requests", () => {
    const { point } = estimateWithBootstrap(clusterStats(sampleRows), totals, { ...OPT, drivers: ["A"] });
    const d = point.months["2026-02"].drivers;
    expect(d.A).toBeCloseTo(250, 9);
    expect(d.__other).toBeCloseTo(250, 9);
    expect(d.A + d.__other).toBeCloseTo(point.months["2026-02"].requests, 9);
    expect(point.totals.drivers.A + point.totals.drivers.__other).toBeCloseTo(point.totals.requests, 9);
  });

  it("bootstrap is deterministic for a seed and the CI brackets the point estimate", () => {
    const a = estimateWithBootstrap(clusterStats(sampleRows), totals, { ...OPT, seed: 7, replicates: 400 });
    const b = estimateWithBootstrap(clusterStats(sampleRows), totals, { ...OPT, seed: 7, replicates: 400 });
    expect(a.ci).toEqual(b.ci);
    const [lo, hi] = a.ci["totals.requests"];
    expect(lo).toBeLessThanOrEqual(a.pointFlat["totals.requests"]);
    expect(hi).toBeGreaterThanOrEqual(a.pointFlat["totals.requests"]);
    expect(hi - lo).toBeGreaterThan(0); // two different clusters -> real sampling variability
    expect(lo).toBeGreaterThanOrEqual(400 - 1e-9); // replicate means can only be 0.4, 0.5 or 0.6 signs/tx
    expect(hi).toBeLessThanOrEqual(600 + 1e-9);
  });

  it("census months have zero-width intervals", () => {
    const census = rows("C-p000", "2024-08", true, [req(1, "A"), ...resp(3)]);
    const { ci, pointFlat } = estimateWithBootstrap(clusterStats(census), [{ month: "2024-08", txs_count: "4", partial: "0" }], { ...OPT, seed: 3, replicates: 100 });
    expect(pointFlat["totals.requests"]).toBeCloseTo(1, 9);
    expect(ci["totals.requests"][0]).toBeCloseTo(1, 9);
    expect(ci["totals.requests"][1]).toBeCloseTo(1, 9);
  });

  it("totals add up across months and a requester absent from a month contributes zero", () => {
    const more = rows("Y-c0", "2026-03", false, [req(2, "C"), ...resp(2)]);
    const t2 = [...totals, { month: "2026-03", txs_count: "300", partial: "0" }];
    const { point } = estimateWithBootstrap(clusterStats([...sampleRows, ...more]), t2, OPT);
    // March: 1 sign-tx (2 signs) + 2 respond txs = 3 txs -> 2/3 signs per tx -> 200 requests; Feb: 500
    expect(point.totals.requests).toBeCloseTo(700, 9);
    expect(point.totals.requesters.est.C).toBeCloseTo(200, 9);
    expect(point.totals.requesters.est.A).toBeCloseTo(250, 9);
    expect(point.totals.requesters.share.A + point.totals.requesters.share.B + point.totals.requesters.share.C).toBeCloseTo(1, 9);
  });

  it("sign receipts rejected by the contract are counted as requests and reported as a failed rate", () => {
    const r = rows("F-c0", "2026-04", false, [req(1, "A"), req(1, "A", { signFailed: true, fulfilled: false }), ...resp(2)]);
    const { point } = estimateWithBootstrap(clusterStats(r), [{ month: "2026-04", txs_count: "40", partial: "0" }], OPT);
    expect(point.totals.requests).toBeCloseTo(20, 9); // 2 signs / 4 txs x 40
    expect(point.totals.sign_receipt_failed_rate).toBeCloseTo(0.5, 9);
    expect(point.totals.fulfilled_rate).toBeCloseTo(0.5, 9);
    expect(point.totals.failed_by_requester.est.A).toBeCloseTo(10, 9);
  });

  it("pair share: fraction of a requester's sign receipts sent by a given tx signer", () => {
    const mk = (cluster, signer, n) => Array.from({ length: n }, (_, i) => ({ cluster_id: cluster, month: "2026-06", census: 0, tx_hash: `${cluster}-${signer}-${i}`, tx_block_height: i, tx_kind: "request", tx_signer_class: "request_side", tx_signer: signer, method: "sign", predecessor: "fa.near", receipt_status: "Success", fulfilled: 1, payload_hash: `${cluster}${signer}${i}`, domain_id: "1", key_version: "", path: "p" }));
    const r = [...mk("P-c0", "relayer-a.near", 3), ...mk("P-c0", "relayer-b.near", 1)];
    const { point } = estimateWithBootstrap(clusterStats(r), [{ month: "2026-06", txs_count: "40", partial: "0" }], { seed: 1, replicates: 10, requesters: ["fa.near"], pairs: [["fa.near", "relayer-a.near"]] });
    expect(point.months["2026-06"].pairs["fa.near<-relayer-a.near"]).toBeCloseTo(0.75, 9);
    expect(point.totals.pairs["fa.near<-relayer-a.near"]).toBeCloseTo(0.75, 9);
  });

  it("concentration: top-1, top-3, HHI and requesters >= 1%", () => {
    const c = concentration({ a: 50, b: 30, c: 15, d: 4, e: 0.5, f: 0.5 });
    expect(c.top1_share).toBeCloseTo(0.5, 9);
    expect(c.top3_share).toBeCloseTo(0.95, 9);
    expect(c.hhi).toBeCloseTo(0.25 + 0.09 + 0.0225 + 0.0016 + 2 * 0.000025, 9);
    expect(c.requesters_ge_1pct).toBe(4);
    expect(concentration({}).hhi).toBe(0);
  });

  it("series (include / exclude) and target groups add up", () => {
    const r = rows("S-c0", "2026-07", false, [req(2, "A", { path: "n" }), req(1, "B", { path: "x" }), req(1, "C", { path: "x" }), ...resp(4)]);
    const ctx = { chainOf: (row) => (row.path === "n" ? "near" : "unknown") };
    const { point } = estimateWithBootstrap(clusterStats(r, ctx), [{ month: "2026-07", txs_count: "80", partial: "0" }], {
      ...OPT, series: { all: { exclude: [] }, noA: { exclude: ["A"] }, onlyB: { include: ["B"] } }, chainGroups: { near_native: ["near"], unknown: ["unknown"] } });
    const m = point.months["2026-07"];
    // 7 txs (A's tx holds 2 signs) with 4 signs; month total 80 -> scale 80/7
    expect(m.series.all).toBeCloseTo(m.requests, 9);
    expect(m.series.all).toBeCloseTo((4 * 80) / 7, 9);
    expect(m.series.noA).toBeCloseTo((2 * 80) / 7, 9);
    expect(m.series.onlyB).toBeCloseTo(80 / 7, 9);
    expect(m.chain_groups_share.near_native + m.chain_groups_share.unknown).toBeCloseTo(1, 9);
    expect(point.totals.series.noA).toBeCloseTo((2 * 80) / 7, 9);
    expect(point.totals.concentration.top1_share).toBeCloseTo(0.5, 9);
  });

  it("counts requesters at >= 1% of the whole period separately from requesters that reached 1% in any single month", () => {
    const sums = (n, reqs) => { const t = sumClusters([]); t.n_tx = n; t.sign = Object.values(reqs).reduce((a, b) => a + b, 0); t.requesters = reqs; return t; };
    // month 1: small, B holds 10%; month 2: large, B absent -> B is below 1% of the period but reached 1% in one month
    const r = estimateFromSums([{ month: "m1", txTotal: 20, sums: sums(20, { A: 9, B: 1 }) }, { month: "m2", txTotal: 2000, sums: sums(2000, { A: 1000 }) }]);
    expect(r.totals.concentration.requesters_ge_1pct).toBe(1);
    expect(r.totals.concentration.requesters_ge_1pct_any_month).toBe(2);
  });

  it("estimateFromSums handles an empty sample safely", () => {
    const r = estimateFromSums([{ month: "m", txTotal: 100, sums: sumClusters([]) }]);
    expect(r.totals.requests).toBe(0);
    expect(r.totals.fulfilled_rate).toBe(0);
  });

  it("trackedNames keeps required accounts and the top-N requesters", () => {
    const cs = clusterStats(rows("T-c0", "2026-02", false, [req(5, "A"), req(1, "B"), req(2, "C")]));
    expect(trackedNames(cs, { requesters: ["B"], extraRequesters: 1 }).requesters.sort()).toEqual(["A", "B"]);
  });

  it("flatten escapes dots in account ids but keeps the path separators", () => {
    expect(flatten({ months: { "2026-01": { requesters: { share: { "a.near": 0.5 } } } } })).toEqual({ "months.2026-01.requesters.share.a|near": 0.5 });
  });
});
