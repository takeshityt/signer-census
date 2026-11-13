import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { evaluate, pendingInfo, thresholdOf } from "../src/predictions.mjs";
import { project } from "../src/scenario-core.mjs";
import { fromRpc, compare, expectedFromRows } from "../src/verify-core.mjs";

const root = new URL("../", import.meta.url).pathname;
const read = (f) => readFileSync(root + f, "utf8");
const metrics = JSON.parse(read("out/metrics.json"));
const scen = JSON.parse(read("out/scenarios.json"));
const cfg = JSON.parse(read("config/predictions.json"));
const P = Object.fromEntries(cfg.predictions.map((p) => [p.id, p]));

/** Backtest: re-label the last three full months (2026-08..10) as the target months 2027-01..03 and apply the rules. */
const asTarget = (map) => ({ ...metrics, months: metrics.months.filter((m) => map[m.month]).map((m) => ({ ...m, month: map[m.month] })) });
const BACK = asTarget({ "2026-08": "2027-01", "2026-09": "2027-02", "2026-10": "2027-03" });
const lastFull = BACK.months;

describe("predictions = the thresholds printed in THESIS.md", () => {
  const thesis = read("THESIS.md").replace(/<sup>\[\d+\]<\/sup>/g, "");
  const section = thesis.split("## What would prove this thesis wrong")[1].split("## Scenarios")[0];
  it("each configured threshold appears in the test text", () => {
    expect(section).toContain("less than 60%");
    expect(section).toContain("at least 11 requesters");
    expect(section).toContain("below 150k");
    expect(section).toContain("below 99.5%");
    expect(P.P1.any_of.map((c) => c.threshold)).toEqual([0.6, 11]);
    expect(P.P3.any_of[0].threshold).toBe(150000);
    expect(P.P4.any_of[0].threshold).toBe(0.995);
    expect([P.P1.needed, P.P2.needed, P.P3.needed, P.P4.needed]).toEqual([2, 2, 2, 1]);
  });
  it("P2 reads its thresholds from derived.fastauth_trend, the same numbers THESIS.md prints", () => {
    const t = thresholdOf(P.P2.any_of[0], "2027-02", metrics);
    expect(t).toBe(metrics.derived.fastauth_trend.half_projection["2027-02"]);
    expect(section).toContain(`≈${Math.round(t / 1000)}k`);
  });
  it("target months are Jan–Mar 2027 and the check date is after the last one", () => {
    expect(P.P1.months).toEqual(["2027-01", "2027-02", "2027-03"]);
    expect(cfg.check_after > "2027-03-31").toBe(true);
  });
});

describe("evaluate: offline backtest on measured months", () => {
  it("narrow demand holds: top three ≥ 60% and fewer than 11 requesters at 1% in every backtest month", () => {
    const direct = lastFull.every((m) => m.concentration.top3_share.value >= 0.6 && m.concentration.requesters_ge_1pct.value < 11);
    const r = evaluate(P.P1, BACK);
    expect(direct).toBe(true);
    expect(r.status).toBe("HOLDS");
    expect(r.breaches).toBe(0);
  });
  it("bridges and signing verdicts equal an independent count over the same months", () => {
    const bridgeBreaches = lastFull.filter((m) => m.series_requests_est.bridges.value < 150000).length;
    expect(evaluate(P.P3, BACK).breaches).toBe(bridgeBreaches);
    expect(evaluate(P.P3, BACK).status).toBe(bridgeBreaches >= 2 ? "REFUTED" : "HOLDS");
    const rateBreaches = lastFull.filter((m) => m.fulfilled_rate.value < 0.995).length;
    expect(evaluate(P.P4, BACK).breaches).toBe(rateBreaches);
  });
  it("FastAuth test compares with half of the trend line", () => {
    const r = evaluate(P.P2, BACK);
    for (const row of r.rows) expect(row.hits[0].threshold).toBe(metrics.derived.fastauth_trend.half_projection[row.month]);
    expect(["HOLDS", "REFUTED"]).toContain(r.status);
  });
  it("a month that is not measured yet gives NO DATA (never a pass)", () => {
    expect(evaluate(P.P1, metrics).status).toBe("NO DATA");
  });
});

describe("evaluate: synthetic breaches", () => {
  const mk = (over) => ({ ...metrics, months: ["2027-01", "2027-02", "2027-03"].map((month, i) => ({ month, partial_month: false, concentration: { top3_share: { value: 0.7, ci95: [0.65, 0.75] }, requesters_ge_1pct: { value: 8, ci95: [7, 9] } }, drivers_requests: { "fast-auth.near": { value: 1000, ci95: [900, 1100] } }, series_requests_est: { bridges: { value: 200000, ci95: [190000, 210000] } }, fulfilled_rate: { value: 0.999, ci95: [0.998, 1] }, ...(over[i] ?? {}) })) });
  it("P1 is refuted when two months breach and 'decisive' reflects the interval", () => {
    const m = mk([{ concentration: { top3_share: { value: 0.55, ci95: [0.5, 0.58] }, requesters_ge_1pct: { value: 8 } } }, { concentration: { top3_share: { value: 0.7 }, requesters_ge_1pct: { value: 11, ci95: [10, 13] } } }]);
    const r = evaluate(P.P1, m);
    expect(r.status).toBe("REFUTED");
    expect(r.rows[0].decisive).toBe(true);
    expect(r.rows[1].decisive).toBe(false);
  });
  it("one breach of two needed leaves the claim standing; P4 needs only one", () => {
    expect(evaluate(P.P3, mk([{ series_requests_est: { bridges: { value: 100000 } } }])).status).toBe("HOLDS");
    expect(evaluate(P.P4, mk([{}, { fulfilled_rate: { value: 0.99, ci95: [0.98, 0.995] } }])).status).toBe("REFUTED");
  });
  it("P2 is refuted only if both Feb and Mar are at or above half of the trend", () => {
    const half = metrics.derived.fastauth_trend.half_projection;
    const m = mk([{}, { drivers_requests: { "fast-auth.near": { value: half["2027-02"] } } }, { drivers_requests: { "fast-auth.near": { value: half["2027-03"] + 1 } } }]);
    expect(evaluate(P.P2, m).status).toBe("REFUTED");
    const m2 = mk([{}, { drivers_requests: { "fast-auth.near": { value: half["2027-02"] } } }, { drivers_requests: { "fast-auth.near": { value: 1 } } }]);
    expect(evaluate(P.P2, m2).status).toBe("HOLDS");
  });
});

describe("pendingInfo", () => {
  it("counts days to the check date and stops being pending on it", () => {
    expect(pendingInfo("2027-04-01", new Date("2027-03-30T00:00:00Z"))).toMatchObject({ pending: true, days: 2 });
    expect(pendingInfo("2027-04-01", new Date("2027-04-01T00:00:00Z")).pending).toBe(false);
  });
});

describe("scenario sliders = precomputed scenarios (parity, ported from the prototype check)", () => {
  it("project() reproduces every scenario of out/scenarios.json exactly", () => {
    for (const s of scen.scenarios) {
      const a = s.assumptions;
      const r = project(scen.baseline, { retention: a.fastauth_retention_after_end, benchmark: a.benchmark, growth: a.structural_monthly_growth, horizon: scen.horizon.to, endMonth: readEnd() });
      expect(r.end_month_total, s.id).toBe(s.end_month_total);
      expect(r.cumulative_requests, s.id).toBe(s.cumulative_requests);
      expect(r.projection).toEqual(s.projection);
    }
  });
  it("a slider value between the grid points sits between its neighbours", () => {
    const base = scen.baseline, end = readEnd();
    const at = (g) => project(base, { retention: 0.3, benchmark: "removed", growth: g, horizon: scen.horizon.to, endMonth: end }).end_month_total;
    expect(at(-0.02)).toBeLessThan(at(0));
    expect(at(0.02)).toBeGreaterThan(at(0));
  });
});
function readEnd() { return scen.fastauth_end_month; }

describe("verify-core (shared with the Verify it yourself button)", () => {
  const rpc = JSON.parse(read("test/fixtures/rpc_tx_status_fastauth.json"));
  const result = rpc.result ?? rpc;
  it("parses an RPC result and compares it with expected values", () => {
    const got = fromRpc(result);
    expect(got.tx_signer).toBe(result.transaction.signer_id);
    const exp = { tx_hash: result.transaction.hash, tx_signer: got.tx_signer, tx_block_height: 1, month: "2026-01", signs: got.signs };
    expect(compare(exp, got, { height: 1 }).ok).toBe(true);
    expect(compare({ ...exp, tx_signer: "someone.near" }, got, { height: 1 }).ok).toBe(false);
    expect(compare(exp, got, { height: 2 }).problems.join()).toMatch(/block height/);
  });
  it("expectedFromRows keeps sorted requester|status pairs", () => {
    const e = expectedFromRows([{ tx_hash: "h", tx_signer: "s", tx_block_height: "5", month: "2026-01", predecessor: "b.near", receipt_status: "Success" }, { tx_hash: "h", tx_signer: "s", tx_block_height: "5", month: "2026-01", predecessor: "a.near", receipt_status: "Failure" }]);
    expect(e.signs).toEqual(["a.near|Failure", "b.near|Success"]);
  });
});
