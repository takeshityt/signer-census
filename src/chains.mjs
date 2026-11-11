// Target-chain classification of a sign receipt. Rules live in config/chain_rules.yaml; first matching rule wins.
// A rule only exists where the mapping is backed by evidence (source code / docs); everything else is "unknown" (explicit bucket).
import { parse } from "yaml";

export const FAMILIES = ["bitcoin", "zcash", "evm", "near", "solana", "multi", "other", "unknown"]; // multi = signs for several destination chains, per-request chain not decodable

/** Key type of a sign receipt: domain_id 0 = secp256k1, 1 = ed25519 (NEAR MPC contract); legacy (no domain_id) args can only be secp256k1. */
export function keyTypeOf(row) {
  if (row.domain_id === "0" || row.payload_type === "Ecdsa") return "secp256k1";
  if (row.domain_id === "1" || row.payload_type === "Eddsa") return "ed25519";
  if (row.payload_type === "legacy_bytes") return "secp256k1";
  return "unknown";
}

export function parseChainRules(text) {
  const doc = parse(text) ?? {};
  const rules = doc.rules ?? [];
  const ids = new Set();
  for (const r of rules) {
    const where = `chain rule ${r?.id ?? "(no id)"}`;
    if (!r.id || ids.has(r.id)) throw new Error(`${where}: missing or duplicate id`);
    ids.add(r.id);
    if (!FAMILIES.includes(r.family) || r.family === "unknown") throw new Error(`${where}: family must be one of ${FAMILIES.filter((f) => f !== "unknown").join(", ")}`);
    if (!r.match || typeof r.match !== "object" || Object.keys(r.match).length === 0) throw new Error(`${where}: match is required`);
    for (const k of Object.keys(r.match)) if (!["requester", "path_regex", "key_type"].includes(k)) throw new Error(`${where}: unknown match field ${k}`);
    if (!Array.isArray(r.evidence) || r.evidence.length === 0 || !r.evidence.every((e) => /^https?:\/\/\S+$/.test(e.url ?? "") && e.claim)) throw new Error(`${where}: evidence (url + claim) is required`);
    if (!["high", "medium", "low"].includes(r.confidence)) throw new Error(`${where}: confidence must be high|medium|low`);
  }
  const compiled = rules.map((r) => ({ ...r, _re: r.match.path_regex !== undefined ? new RegExp(r.match.path_regex) : null }));
  const matches = (r, row) => {
    const m = r.match;
    if (m.requester !== undefined && ![].concat(m.requester).includes(row.predecessor)) return false;
    if (r._re && !r._re.test(row.path ?? "")) return false;
    if (m.key_type !== undefined && keyTypeOf(row) !== m.key_type) return false;
    return true;
  };
  return {
    rules,
    /** returns { family, rule, confidence } ; rule is null and confidence "none" for the explicit unknown bucket */
    classify(row) { const r = compiled.find((c) => matches(c, row)); return r ? { family: r.family, rule: r.id, confidence: r.confidence } : { family: "unknown", rule: null, confidence: "none" }; },
    confidenceOf(row) { return this.classify(row).confidence; },
    chainOf(row) { return this.classify(row).family; },
  };
}
