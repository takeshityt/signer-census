import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { render, strayNumbers, resolve, format, tokenize, expandIncludes } from "../src/thesis.mjs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

const config = JSON.parse(read("config/rendered-docs.json"));
const { repoFacts } = await import("../src/repo-facts.mjs");
const data = { metrics: JSON.parse(read("out/metrics.json")), scenarios: JSON.parse(read("out/scenarios.json")), repo: repoFacts(new URL("../", import.meta.url).pathname) };
const tplOf = (d) => expandIncludes(read(d.template), (f) => read(f));

describe("rendered documents (THESIS.md, README.md, submission drafts): every number comes from the JSON outputs", () => {
  // one test per check (not per document), so the static test count quoted in README.md stays equal to the vitest count
  it("each rendered document is exactly the rendering of its template (no hand edits)", () => {
    for (const d of config.docs) expect(read(d.output), d.output).toBe(render(tplOf(d), data, { footnotes: d.footnotes }));
  });
  it("in each rendered document every digit comes from metrics/scenarios/repo facts, a declared literal or an external figure with a URL", () => {
    for (const d of config.docs) expect(strayNumbers(render(tplOf(d), data, { footnotes: d.footnotes, sentinels: true })), d.output).toEqual([]);
  });
  it("README quotes the real sha256 of out/metrics.json, the test count and the verify result", () => {
    const readme = read("README.md").replace(/<sup>\[\d+\]<\/sup>/g, ""); // footnote markers sit between the value and the text
    expect(readme).toContain(data.repo.metrics_sha256);
    expect(readme).toContain(`${data.repo.tests} tests passed`);
    expect(readme).toContain(`${data.repo.verify.verified}/${data.repo.verify.sample} verified`);
  });
  it("submission description is 20-2000 characters and has no footnote markers", () => {
    const t = read("docs/submission/SUBMISSION_TEXT.md");
    const desc = /<!-- description:start -->\n([\s\S]*?)\n<!-- description:end -->/.exec(t)[1];
    expect(desc.length).toBeGreaterThanOrEqual(20);
    expect(desc.length).toBeLessThanOrEqual(2000);
    expect(desc).not.toMatch(/<sup>|\]\(/);
  });
  // X weighted length (twitter-text v3): links count 23; code points outside these ranges count 2
  const xLength = (s) => {
    const w1 = [[0x0, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037]];
    const urls = s.match(/\b(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|org)(?:\/\S*)?/gi) ?? [];
    let rest = s; for (const u of urls) rest = rest.replace(u, "");
    return urls.length * 23 + [...rest.normalize("NFC")].reduce((n, ch) => n + (w1.some(([a, b]) => ch.codePointAt(0) >= a && ch.codePointAt(0) <= b) ? 1 : 2), 0);
  };
  it("X posts fit 280 (X weighting), say NEAR HACKATHON and tag @NEARProtocol and #NEARHackathon", () => {
    const t = read("docs/submission/X_POST.md");
    const block = (k) => new RegExp(`<!-- ${k}:start -->\\n([\\s\\S]*?)\\n<!-- ${k}:end -->`).exec(t)[1];
    for (const k of ["post", "thread1", "thread2"]) expect(xLength(block(k)), k).toBeLessThanOrEqual(280);
    for (const k of ["post", "thread1"]) { const p = block(k); expect(p).toMatch(/NEAR HACKATHON/); expect(p).toMatch(/@NEARProtocol/); expect(p).toMatch(/#NEARHackathon/); }
    expect(block("post")).toMatch(/takeshityt\.github\.io\/signer-census/); expect(block("post")).toMatch(/github\.com\/takeshityt\/signer-census/);
    expect(xLength("a takeshityt.github.io/signer-census ≈")).toBe(2 + 23 + 1 + 2);
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
  it("formats spoken dates (English and Russian) from JSON month/day strings", () => {
    expect(format("2026-08", "month")).toBe("August 2026");
    expect(format("2026-12-30", "day")).toBe("30 December 2026");
    expect(format("2026-10", "month_ru")).toBe("октябрь 2026");
    expect(format("2026-08", "month_ru_gen")).toBe("августа 2026");
    expect(format("2027-04-01", "day_ru")).toBe("1 апреля 2027");
    expect(() => format("soon", "month")).toThrow();
  });
  it("formats", () => {
    expect(format({ value: 1234567 }, "M1")).toBe("1.2M");
    expect(format({ value: 1234567 }, "int")).toBe("1,234,567");
    expect(format({ value: 0.9996 }, "pct2")).toBe("99.96%");
    expect(format(obj.months[0].x, "ci_pct0")).toBe("40%–60%");
  });
  it("includes reuse a section of another template; plain-text mode renders external figures as text (url)", () => {
    const t = expandIncludes("X\n{{include:a.md#Two}}\nY", () => "## One\n\nfirst\n\n## Two\n\n* second\n\n## Three\n\nthird");
    expect(t).toBe("X\n* second\nY");
    expect(render("{{ext:30 Dec|https://e.org}}", { metrics: {}, scenarios: {} }, { footnotes: false })).toBe("30 Dec (https://e.org)");
    expect(render("{{r:tests|raw}}", { metrics: {}, scenarios: {}, repo: { tests: 7 } }, { footnotes: false })).toBe("7");
  });

  it("stray number detection ignores placeholders, code and links but catches bare digits", () => {
    const t = "Value {{m:months[2026-10].x|pct0}} in `v1.signer` [x](https://e.org/2026) and {{lit:2027}}.\nBut 42 is bare.";
    const r = strayNumbers(render(t, { metrics: obj, scenarios: {} }, { sentinels: true }));
    expect(r).toHaveLength(1);
    expect(r[0].numbers).toEqual(["42"]);
  });
});
