import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
  it("chain_rules.yaml is valid and never maps tx-bench.near", () => {
    const c = parseChainRules(readFileSync(new URL("config/chain_rules.yaml", root), "utf8"));
    expect(c.rules.length).toBeGreaterThan(0);
    expect(c.chainOf({ predecessor: "tx-bench.near", path: "", domain_id: "0", key_version: "", payload_type: "Ecdsa" })).toBe("unknown");
    expect(c.chainOf({ predecessor: "btc-connector.bridge.near", path: "ab", domain_id: "", key_version: "0", payload_type: "legacy_bytes" })).toBe("bitcoin");
  });
});
