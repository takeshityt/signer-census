import { describe, it, expect } from "vitest";
import { parseLabels } from "../src/labels.mjs";
import { parseChainRules, keyTypeOf } from "../src/chains.mjs";

const OK = `
labels:
  - account: a.near
    category: near-infra:bridge-omni
    confidence: high
    note: example
    evidence:
      - { url: "https://example.org/doc", claim: "official doc names the contract" }
  - account: b.near
    category: unknown
    suspected_category: benchmark-test
    confidence: low
    note: suspected benchmark; owner unproven
    evidence:
      - { url: "https://example.org/onchain", claim: "creator is X" }
`;

describe("labels.yaml validation", () => {
  it("accepts valid entries and exposes lookups", () => {
    const l = parseLabels(OK);
    expect(l.categoryOf("a.near")).toBe("near-infra:bridge-omni");
    expect(l.confidenceOf("b.near")).toBe("low");
    expect(l.categoryOf("zzz")).toBe("unlabeled");
    expect(l.confidenceOf("zzz")).toBe("unlabeled");
    expect(l.benchmarkAccounts()).toEqual(["b.near"]); // suspected benchmark is included in the 'excluding benchmark' headline variant
  });
  it("validates dominant_integrator: name, confidence and evidence are required", () => {
    const base = "labels:\n  - { account: x.near, category: wallet, confidence: high, evidence: [ { url: 'https://e.org', claim: c } ], dominant_integrator: ";
    expect(() => parseLabels(base + "{ name: S, confidence: medium, evidence: [ { url: 'https://e.org', claim: c } ] } }")).not.toThrow();
    expect(() => parseLabels(base + "{ name: S, confidence: sure, evidence: [ { url: 'https://e.org', claim: c } ] } }")).toThrow(/dominant_integrator/);
    expect(() => parseLabels(base + "{ name: S, confidence: medium, evidence: [] } }")).toThrow(/dominant_integrator/);
  });

  it("rejects a label without evidence", () => {
    expect(() => parseLabels("labels:\n  - { account: x.near, category: wallet, confidence: high, evidence: [] }")).toThrow(/evidence/);
  });
  it("rejects evidence without an http(s) url or without a claim", () => {
    expect(() => parseLabels("labels:\n  - { account: x.near, category: wallet, confidence: high, evidence: [ { url: 'see notes', claim: c } ] }")).toThrow(/url/);
    expect(() => parseLabels("labels:\n  - { account: x.near, category: wallet, confidence: high, evidence: [ { url: 'https://e.org' } ] }")).toThrow(/claim/);
  });
  it("rejects invented categories, bad confidence, duplicates and noteless unknowns", () => {
    expect(() => parseLabels("labels:\n  - { account: x.near, category: coolapp, confidence: high, evidence: [ { url: 'https://e.org', claim: c } ] }")).toThrow(/category/);
    expect(() => parseLabels("labels:\n  - { account: x.near, category: wallet, confidence: sure, evidence: [ { url: 'https://e.org', claim: c } ] }")).toThrow(/confidence/);
    const dup = "labels:\n  - { account: x.near, category: wallet, confidence: high, evidence: [ { url: 'https://e.org', claim: c } ] }\n  - { account: x.near, category: wallet, confidence: high, evidence: [ { url: 'https://e.org', claim: c } ] }";
    expect(() => parseLabels(dup)).toThrow(/duplicate/);
    expect(() => parseLabels("labels:\n  - { account: x.near, category: unknown, confidence: low, evidence: [ { url: 'https://e.org', claim: c } ] }")).toThrow(/note/);
  });
});

const RULES = `
rules:
  - id: btc
    family: bitcoin
    confidence: high
    match: { requester: btc-connector.bridge.near, key_type: secp256k1 }
    evidence: [ { url: "https://example.org/src#L10", claim: "connector signs BTC txs" } ]
  - id: bridge
    family: evm
    confidence: medium
    match: { requester: omni.bridge.near, path_regex: "^bridge-1$" }
    evidence: [ { url: "https://example.org/omni", claim: "bridge-1 key verified by EVM contracts" } ]
`;
const row = (o) => ({ predecessor: "", path: "", domain_id: "", key_version: "", payload_type: "", ...o });

describe("chain rules", () => {
  const cr = parseChainRules(RULES);
  it("first matching rule wins, everything else is the explicit unknown bucket", () => {
    expect(cr.classify(row({ predecessor: "btc-connector.bridge.near", payload_type: "legacy_bytes", path: "abc" }))).toEqual({ family: "bitcoin", rule: "btc", confidence: "high" });
    expect(cr.chainOf(row({ predecessor: "omni.bridge.near", path: "bridge-1", payload_type: "legacy_bytes" }))).toBe("evm");
    expect(cr.chainOf(row({ predecessor: "omni.bridge.near", path: "other" }))).toBe("unknown");
    expect(cr.classify(row({ predecessor: "nobody.near" }))).toEqual({ family: "unknown", rule: null, confidence: "none" });
  });
  it("key type mapping: domain 0/ECDSA/legacy = secp256k1, domain 1/EdDSA = ed25519", () => {
    expect(keyTypeOf(row({ domain_id: "0" }))).toBe("secp256k1");
    expect(keyTypeOf(row({ domain_id: "1", payload_type: "Eddsa" }))).toBe("ed25519");
    expect(keyTypeOf(row({ payload_type: "legacy_bytes" }))).toBe("secp256k1");
    expect(keyTypeOf(row({}))).toBe("unknown");
  });
  it("rules without evidence or with unknown fields are rejected", () => {
    expect(() => parseChainRules("rules:\n  - { id: x, family: evm, confidence: high, match: { requester: a }, evidence: [] }")).toThrow(/evidence/);
    expect(() => parseChainRules("rules:\n  - { id: x, family: evm, confidence: high, match: { color: red }, evidence: [ { url: 'https://e.org', claim: c } ] }")).toThrow(/match field/);
    expect(() => parseChainRules("rules:\n  - { id: x, family: unknown, confidence: high, match: { requester: a }, evidence: [ { url: 'https://e.org', claim: c } ] }")).toThrow(/family/);
  });
});
