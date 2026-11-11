import { describe, it, expect } from "vitest";
import { clusterStats, estimateWithBootstrap, estimateFromSums, sumClusters, flatten } from "../src/estimate.mjs";

// helper: build parsed-row fixtures. tx spec: {kind, cls, signs: [requester...], fulfilled?: bool}
let txn = 0;
function rows(cluster, month, census, txs) {
  const out = [];
  for (const t of txs) {
    const tx_hash = `tx${++txn}`;
    const base = { cluster_id: cluster, month, census: census ? 1 : 0, tx_hash, tx_kind: t.kind, tx_signer_class: t.cls ?? "other", receipt_status: "Success", callback_method: "", callback_status: "", fulfilled: "", payload_hash: "", domain_id: "", key_version: "", path: "" };
    for (const [i, who] of (t.signs ?? []).entries()) out.push({ ...base, method: "sign", predecessor: who, fulfilled: t.fulfilled === false ? 0 : 1, payload_hash: t.sameKey ? "same" : `p${txn}_${i}`, path: "x" });
    if (t.kind === "respond") out.push({ ...base, method: "respond", predecessor: "node", receipt_status: t.failed ? "Failure" : "Success" });
    if (!t.signs && t.kind !== "respond") out.push({ ...base, method: "submit_participant_info", predecessor: "node" });
  }
  return out;
}
const req = (n, who = "A", extra = {}) => ({ kind: "request", cls: "request_side", signs: Array.from({ length: n }, () => who), ...extra });

describe("clusterStats", () => {
  it("counts txs once, signs, fulfilled, duplicates, failed responds", () => {
    const r = rows("m-c0", "2026-01", false, [req(1, "A"), req(1, "A", { sameKey: true }), req(1, "A", { sameKey: true, fulfilled: false }), { kind: "respond", cls: "mpc_node" }, { kind: "respond", cls: "mpc_node", failed: true }]);
    const [c] = clusterStats(r);
    expect(c.n_tx).toBe(5);
    expect(c.sign).toBe(3);
    expect(c.fulfilled).toBe(2);
    expect(c.dup_extra).toBe(1); // two sign receipts share one identical key
    expect(c.respond_total).toBe(2);
    expect(c.respond_failed).toBe(1);
    expect(c.kinds.request).toBe(3);
    expect(c.kinds.respond).toBe(2);
    expect(c.requesters.A).toBe(3);
  });
});

describe("estimates", () => {
  // month X: cluster1 = 10 txs with 4 signs (A:3,B:1); cluster2 = 10 txs with 6 signs (A:2,B:4). Exact month total = 1000 txs.
  const filler = (k) => Array.from({ length: k }, () => ({ kind: "respond", cls: "mpc_node" }));
  const sampleRows = [
    ...rows("X-c0", "2026-02", false, [req(3, "A"), req(1, "B"), ...filler(8)]),
    ...rows("X-c1", "2026-02", false, [req(2, "A"), req(4, "B"), ...filler(8)]),
  ];
  const totals = [{ month: "2026-02", txs_count: "1000", partial: "0" }];

  it("requests = exact tx total x sign-per-tx (ratio estimator); requester shares are exact in-sample ratios", () => {
    const { point } = estimateWithBootstrap(clusterStats(sampleRows), totals, { seed: 1, replicates: 50 });
    // signs = 10 over 20 txs -> 0.5 per tx -> 500 requests
    expect(point.months["2026-02"].requests).toBeCloseTo(500, 9);
    expect(point.totals.requests).toBeCloseTo(500, 9);
    expect(point.months["2026-02"].requester_share.A).toBeCloseTo(0.5, 9);
    expect(point.months["2026-02"].requester_share.B).toBeCloseTo(0.5, 9);
    expect(point.totals.tx_kind_share.respond).toBeCloseTo(16 / 20, 9);
    expect(point.totals.tx_total).toBe(1000);
  });

  it("bootstrap is deterministic for a seed and the CI brackets the point estimate", () => {
    const a = estimateWithBootstrap(clusterStats(sampleRows), totals, { seed: 7, replicates: 400 });
    const b = estimateWithBootstrap(clusterStats(sampleRows), totals, { seed: 7, replicates: 400 });
    expect(a.ci).toEqual(b.ci);
    const [lo, hi] = a.ci["totals.requests"];
    expect(lo).toBeLessThanOrEqual(a.pointFlat["totals.requests"]);
    expect(hi).toBeGreaterThanOrEqual(a.pointFlat["totals.requests"]);
    expect(hi - lo).toBeGreaterThan(0); // two different clusters -> real sampling variability
    // with two clusters the replicate means can only be 0.4, 0.5 or 0.6 signs/tx -> CI within [400, 600]
    expect(lo).toBeGreaterThanOrEqual(400 - 1e-9);
    expect(hi).toBeLessThanOrEqual(600 + 1e-9);
  });

  it("census months have zero-width intervals", () => {
    const census = rows("C-p000", "2024-08", true, [req(1, "A"), ...Array.from({ length: 3 }, () => ({ kind: "respond", cls: "mpc_node" }))]);
    const { ci, pointFlat } = estimateWithBootstrap(clusterStats(census), [{ month: "2024-08", txs_count: "4", partial: "0" }], { seed: 3, replicates: 100 });
    expect(pointFlat["totals.requests"]).toBeCloseTo(1, 9);
    expect(ci["totals.requests"][0]).toBeCloseTo(1, 9);
    expect(ci["totals.requests"][1]).toBeCloseTo(1, 9);
  });

  it("totals add up across months and a requester absent from a month contributes zero", () => {
    const more = rows("Y-c0", "2026-03", false, [req(2, "C"), ...Array.from({ length: 2 }, () => ({ kind: "respond", cls: "mpc_node" }))]);
    const t2 = [...totals, { month: "2026-03", txs_count: "300", partial: "0" }];
    const { point } = estimateWithBootstrap(clusterStats([...sampleRows, ...more]), t2, { seed: 1, replicates: 20 });
    // March: 1 sign-tx (2 signs) + 2 respond txs = 3 txs -> 2/3 signs per tx -> 200 requests; Feb: 500
    expect(point.totals.requests).toBeCloseTo(700, 9);
    expect(point.totals.requester_requests.C).toBeCloseTo(200, 9);
    expect(point.totals.requester_requests.A).toBeCloseTo(250, 9);
    const sumShares = Object.values(point.totals.requester_share).reduce((s, v) => s + v, 0);
    expect(sumShares).toBeCloseTo(1, 9);
  });

  it("estimateFromSums handles an empty sample safely", () => {
    const r = estimateFromSums([{ month: "m", txTotal: 100, sums: sumClusters([]) }]);
    expect(r.totals.requests).toBe(0);
    expect(r.totals.fulfilled_rate).toBe(0);
  });

  it("flatten escapes dots in account ids but keeps the path separators", () => {
    expect(flatten({ months: { "2026-01": { requester_share: { "a.near": 0.5 } } } })).toEqual({ "months.2026-01.requester_share.a|near": 0.5 });
  });
});
