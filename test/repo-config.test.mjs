import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parseLabels } from "../src/labels.mjs";
import { parseChainRules } from "../src/chains.mjs";

const root = new URL("../", import.meta.url);
describe("committed labels.yaml and config/chain_rules.yaml", () => {
  it("labels.yaml is valid: every label has evidence URLs, known category and confidence", () => {
    const l = parseLabels(readFileSync(new URL("labels.yaml", root), "utf8"));
    expect(l.entries.length).toBeGreaterThanOrEqual(11);
    for (const e of l.entries) expect(e.evidence.length).toBeGreaterThan(0);
  });
  it("tx-bench.near is not labeled benchmark-test without evidence: unknown + suspected only", () => {
    const l = parseLabels(readFileSync(new URL("labels.yaml", root), "utf8"));
    const t = l.byAccount.get("tx-bench.near");
    expect(t.category).toBe("unknown");
    expect(t.suspected_category).toBe("benchmark-test");
    expect(l.benchmarkAccounts()).toContain("tx-bench.near");
  });
  it("fast-auth.near stays FastAuth; Sweat is recorded only as dominant_integrator with medium confidence", () => {
    const l = parseLabels(readFileSync(new URL("labels.yaml", root), "utf8"));
    const f = l.byAccount.get("fast-auth.near");
    expect(f.category).toBe("near-infra:fastauth");
    expect(f.dominant_integrator.confidence).toBe("medium");
  });
  it("chain_rules.yaml is valid and never maps tx-bench.near", () => {
    const c = parseChainRules(readFileSync(new URL("config/chain_rules.yaml", root), "utf8"));
    expect(c.rules.length).toBeGreaterThan(0);
    expect(c.chainOf({ predecessor: "tx-bench.near", path: "", domain_id: "0", key_version: "", payload_type: "Ecdsa" })).toBe("unknown");
    expect(c.chainOf({ predecessor: "btc-connector.bridge.near", path: "ab", domain_id: "", key_version: "0", payload_type: "legacy_bytes" })).toBe("bitcoin");
  });
  it("research notes: every http(s) evidence url is a bare URL (explanations live in url_note)", () => {
    const dir = new URL("docs/evidence/attribution/", root);
    for (const f of readdirSync(dir).filter((x) => x.startsWith("research-") && x.endsWith(".json"))) {
      const d = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
      for (const a of d.accounts) for (const e of a.evidence ?? []) if (/^https?:\/\//.test(e.url ?? "")) expect(e.url, `${f}: ${a.account}`).not.toMatch(/\s/);
    }
  });
  it("METHODOLOGY.md states the multi-sign transaction count that out/metrics.json reports", () => {
    const m = JSON.parse(readFileSync(new URL("../out/metrics.json", import.meta.url), "utf8"));
    const doc = readFileSync(new URL("../docs/METHODOLOGY.md", import.meta.url), "utf8");
    const { txs_with_multiple_sign_receipts: n, max_sign_receipts_in_one_tx: max } = m.meta.sample;
    expect(doc).toContain(`(${n} such txs in the sample, at most ${max} sign receipts each`);
  });
});
