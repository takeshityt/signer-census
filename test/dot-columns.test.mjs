import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dotUnit, columnDots } from "../site/js/dot-columns.js";
import { heroColumns, splitHeadline, headline } from "../site/js/model.js";

const root = new URL("../", import.meta.url).pathname;
const metrics = JSON.parse(readFileSync(root + "out/metrics.json", "utf8"));
const thesis = JSON.parse(readFileSync(root + "site/data/thesis.json", "utf8"));

describe("hero dot-matrix columns", () => {
  const data = heroColumns(metrics);
  const totals = data.months.map((_, i) => data.groups.reduce((a, g) => a + g.values[i], 0));
  it("groups add up to the monthly request estimate and come from the JSON series", () => {
    data.months.forEach((m, i) => expect(totals[i]).toBeCloseTo(metrics.months[i].series_requests_est.all.value, 6));
    const fa = data.groups.find((g) => g.id === "fastauth");
    expect(fa.values).toEqual(metrics.months.map((m) => m.drivers_requests["fast-auth.near"]?.value ?? 0));
    expect(data.groups.map((g) => g.id)).toEqual(["rest", "bridges", "fastauth", "benchmark"]);
  });
  it("one dot = a nice number of requests and the peak fits", () => {
    const per = dotUnit(Math.max(...totals), 22);
    expect(Math.max(...totals) / per).toBeLessThanOrEqual(22);
    expect(String(per)).toMatch(/^(1|2|25|5)0*$/);
  });
  it("each column has round(total / per) dots, each group within one dot of its exact share", () => {
    const per = dotUnit(Math.max(...totals), 22);
    data.months.forEach((_, i) => {
      const vals = data.groups.map((g) => g.values[i]);
      const c = columnDots(vals, per);
      expect(c.reduce((a, b) => a + b, 0)).toBe(Math.round(totals[i] / per));
      c.forEach((n, k) => { expect(n).toBeGreaterThanOrEqual(0); expect(Math.abs(n - vals[k] / per)).toBeLessThan(1); });
    });
  });
});

describe("two-tone headline", () => {
  it("splits the THESIS headline into its first sentence and the rest, losing nothing", () => {
    const h = headline(thesis), [a, b] = splitHeadline(h);
    expect(a).toBe("Chain Signatures works.");
    expect(`${a} ${b}`).toBe(h);
    expect(splitHeadline("No full stop")).toEqual(["No full stop", ""]);
  });
});
