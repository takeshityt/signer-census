import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { boomScene, predictionGauges, destinationLines, bridgeStack, fulfilledSeries } from "../site/js/model.js";
import { smoothPath } from "../site/js/charts.js";
import { fmtSigns } from "../site/js/verify-ui.js";

const root = new URL("../", import.meta.url).pathname;
const read = (f) => JSON.parse(readFileSync(root + f, "utf8"));
const metrics = read("out/metrics.json"), scenarios = read("out/scenarios.json"), preds = read("config/predictions.json");
const RELAY = "7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora";

describe("boom scene", () => {
  const sc = boomScene(metrics, scenarios, RELAY);
  it("months continue to the scenario horizon; ghost bars only after the end month, from the DEFAULT scenario", () => {
    const def = scenarios.scenarios.find((s) => s.id === sc.scenarioId);
    expect(sc.scenarioId).toBe("fastauth0_bench-removed_g+0");
    expect(sc.months.at(-1)).toBe(scenarios.horizon.to);
    sc.months.forEach((m, i) => {
      if (sc.future.includes(m)) { expect(m > scenarios.fastauth_end_month).toBe(true); expect(sc.ghost[i]).toBe(def.projection[m].total); }
      else expect(sc.ghost[i]).toBe(0);
    });
  });
  it("Relay is split out of everyone else without changing the monthly totals", () => {
    metrics.months.forEach((m, i) => {
      const sum = sc.fastauth[i] + sc.relay[i] + sc.rest[i] + sc.benchmark[i];
      expect(sum).toBeCloseTo(m.series_requests_est.all.value, 6);
      expect(sc.relay[i]).toBe(m.drivers_requests[RELAY]?.value ?? 0);
      expect(sc.restWithRelay[i]).toBeCloseTo(sc.rest[i] + sc.relay[i], 6);
    });
  });
});

describe("prediction gauges (now vs threshold)", () => {
  const P = Object.fromEntries(preds.predictions.map((p) => [p.id, p]));
  const last = metrics.months.filter((m) => !m.partial_month).at(-1);
  it("read the latest full month and the configured thresholds", () => {
    const g1 = predictionGauges(P.P1, metrics);
    expect(g1.map((g) => g.now)).toEqual([last.concentration.top3_share.value, last.concentration.requesters_ge_1pct.value]);
    expect(g1.map((g) => g.threshold)).toEqual([0.6, 11]);
    expect(g1[0].wrongNow).toBe(last.concentration.top3_share.value < 0.6);
    const g2 = predictionGauges(P.P2, metrics)[0];
    expect(g2.now).toBe(last.drivers_requests["fast-auth.near"].value);
    expect(g2.thresholds).toEqual(P.P2.months.map((m) => metrics.derived.fastauth_trend.half_projection[m]));
    expect(predictionGauges(P.P3, metrics)[0].now).toBe(last.series_requests_est.bridges.value);
    expect(predictionGauges(P.P4, metrics)[0].threshold).toBe(0.995);
  });
  it("gauge ranges contain both the value and the threshold", () => {
    for (const p of preds.predictions) for (const g of predictionGauges(p, metrics)) {
      expect(g.min).toBeLessThanOrEqual(Math.min(g.now, ...g.thresholds));
      expect(g.max).toBeGreaterThanOrEqual(Math.max(g.now, ...g.thresholds));
    }
  });
  it("P3 is named as in THESIS.md", () => {
    expect(P.P3.claim).toBe("Bridges are the demand that stays");
    expect(readFileSync(root + "THESIS.md", "utf8")).toContain('"Bridges are the demand that stays" is wrong if');
  });
});

describe("smooth chart lines never invent bumps (monotone interpolation)", () => {
  // sample every cubic segment and check it stays between its two data points (no overshoot)
  const check = (vals) => {
    const pts = vals.map((v, i) => (v == null ? null : [i * 20, 300 - v * 250]));
    const d = smoothPath(pts, 1e9, -1e9, true);
    const segs = [...d.matchAll(/C([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)/g)].map((m) => m.slice(1).map(Number));
    let prev = d.match(/M([\d.-]+),([\d.-]+)/).slice(1).map(Number);
    for (const [x1, y1, x2, y2, x3, y3] of segs) {
      const lo = Math.min(prev[1], y3) - 0.11, hi = Math.max(prev[1], y3) + 0.11;
      for (let t = 0; t <= 1; t += 0.05) {
        const y = (1 - t) ** 3 * prev[1] + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3 * y3;
        expect(y).toBeGreaterThanOrEqual(lo); expect(y).toBeLessThanOrEqual(hi);
      }
      prev = [x3, y3];
    }
  };
  it("for every line series on the page", () => {
    const dl = destinationLines(metrics), br = bridgeStack(metrics), ful = fulfilledSeries(metrics);
    const max = Math.max(...br.total.values);
    for (const vals of [dl.near.values, dl.other.values, ful.values, br.total.values.map((v) => v / max)]) check(vals);
  });
});

describe("verify formatting", () => {
  it("shows requester and status without the pipe", () => {
    expect(fmtSigns(["fast-auth.near|Success", "a.near|Failure"])).toBe("fast-auth.near · Success, a.near · Failure");
  });
});
