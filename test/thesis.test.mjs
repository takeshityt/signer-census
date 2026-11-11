import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { render, strayNumbers, resolve, format, tokenize } from "../src/thesis.mjs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

describe("THESIS.md numbers", () => {
  const data = { metrics: JSON.parse(read("out/metrics.json")), scenarios: JSON.parse(read("out/scenarios.json")) };
  const template = read("docs/THESIS.template.md");
  it("committed THESIS.md is exactly the rendering of the template with the committed out/ files (no hand edits)", () => {
    expect(read("THESIS.md")).toBe(render(template, data));
  });
  it("every digit in THESIS.md comes from metrics/scenarios, a declared definition or an external figure with a URL", () => {
    expect(strayNumbers(render(template, data, { sentinels: true }))).toEqual([]);
  });
});

describe("renderer helpers", () => {
  const obj = { months: [{ month: "2026-10", x: { value: 0.5, ci95: [0.4, 0.6] } }], t: { "a.b c": { value: 1234567 } }, list: [{ requester: "r.near", v: 3 }] };
  it("paths: array selection by month / field and quoted keys", () => {
    expect(tokenize('t."a.b c".value')).toEqual([{ key: "t" }, { key: "a.b c" }, { key: "value" }]);
    expect(resolve(obj, "months[2026-10].x.value")).toBe(0.5);
    expect(resolve(obj, "list[requester=r.near].v")).toBe(3);
    expect(resolve(obj, 't."a.b c"').value).toBe(1234567);
    expect(() => resolve(obj, "months[1999-01].x")).toThrow(/not found/);
  });
  it("formats", () => {
    expect(format({ value: 1234567 }, "M1")).toBe("1.2M");
    expect(format({ value: 1234567 }, "int")).toBe("1,234,567");
    expect(format({ value: 0.9996 }, "pct2")).toBe("99.96%");
    expect(format(obj.months[0].x, "ci_pct0")).toBe("40%–60%");
  });
  it("stray number detection ignores placeholders, code and links but catches bare digits", () => {
    const t = "Value {{m:months[2026-10].x|pct0}} in `v1.signer` [x](https://e.org/2026) and {{lit:2027}}.\nBut 42 is bare.";
    const r = strayNumbers(render(t, { metrics: obj, scenarios: {} }, { sentinels: true }));
    expect(r).toHaveLength(1);
    expect(r[0].numbers).toEqual(["42"]);
  });
});
