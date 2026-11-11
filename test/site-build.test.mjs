import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite, parseThesis, latestVerify, exportLabels } from "../scripts/build-site.mjs";
import { sha256 } from "../src/lib/manifest.mjs";

const root = new URL("../", import.meta.url).pathname;
const bytes = (p) => readFileSync(join(root, p));

describe("build:site", () => {
  const tmp = mkdtempSync(join(tmpdir(), "site-"));
  const manifest = buildSite({ root, siteDir: tmp });

  it("copies out/metrics.json and out/scenarios.json into site/data with identical sha256", () => {
    for (const f of ["metrics.json", "scenarios.json"]) {
      expect(sha256(readFileSync(join(tmp, "data", f)))).toBe(sha256(bytes(`out/${f}`)));
      expect(manifest.files[`data/${f}`]).toBe(sha256(bytes(`out/${f}`)));
    }
  });
  it("manifest.json lists every copied file with the right hash", () => {
    const written = JSON.parse(readFileSync(join(tmp, "data/manifest.json"), "utf8"));
    expect(written).toEqual(manifest);
    for (const [f, h] of Object.entries(manifest.files)) expect(sha256(readFileSync(join(tmp, f)))).toBe(h);
  });
  it("the committed site/ is up to date: a fresh build is byte-identical (run `npm run build:site` after `npm run reproduce`)", () => {
    for (const [f, h] of Object.entries(manifest.files)) expect(sha256(readFileSync(join(root, "site", f))), f).toBe(h);
  });
  it("no external URL is loaded by the page (no CDN, no fonts.googleapis, no analytics)", () => {
    const html = readFileSync(join(root, "site/index.html"), "utf8") + readFileSync(join(root, "site/css/style.css"), "utf8");
    expect(html).not.toMatch(/(src|href)=["']https?:\/\/(?!github\.com|chainwire\.org|dune\.com)/);
    expect(html).not.toMatch(/@import\s+url\(["']?https?:/);
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});

describe("thesis export", () => {
  const t = parseThesis(readFileSync(join(root, "THESIS.md"), "utf8"));
  it("splits THESIS.md into sections, strips footnote markers and the footnote block", () => {
    expect(Object.keys(t.sections)).toEqual(expect.arrayContaining(["the-claim", "in-five-lines", "what-would-prove-this-thesis-wrong", "what-this-census-cannot-measure", "comparison-with-the-existing-dashboard"]));
    expect(t.sections["in-five-lines"].bullets).toHaveLength(5);
    expect(JSON.stringify(t)).not.toMatch(/<sup>|Where every number comes from/);
  });
  it("falsification tests are exported verbatim from THESIS.md (not retyped)", () => {
    const md = readFileSync(join(root, "THESIS.md"), "utf8");
    for (const b of t.sections["what-would-prove-this-thesis-wrong"].bullets) expect(md.replace(/<sup>\[\d+\]<\/sup>/g, "")).toContain(b.slice(0, 60));
  });
});

describe("verify + labels export", () => {
  it("latestVerify ignores superseded runs and reports the passing run", () => {
    const v = latestVerify(join(root, "docs/evidence/verify"));
    expect(v.verified).toBe(v.sample);
    expect(existsSync(join(root, "docs/evidence/verify/superseded"))).toBe(true);
  });
  it("labels export keeps evidence URLs and the dominant integrator of fast-auth.near", () => {
    const l = exportLabels(readFileSync(join(root, "labels.yaml"), "utf8"));
    const f = l.find((x) => x.account === "fast-auth.near");
    expect(f.dominant_integrator.name).toMatch(/Sweat/);
    expect(l.every((x) => x.evidence.length > 0 && x.evidence.every((e) => /^https?:\/\//.test(e.url)))).toBe(true);
  });
});
