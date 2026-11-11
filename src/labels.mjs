// labels.yaml: requester account -> category + evidence. Validation is strict: no label without at least one evidence URL.
import { parse } from "yaml";

export const CATEGORIES = [
  "near-infra:fastauth", "near-infra:bridge-omni", "near-infra:bridge-btc", "near-infra:bridge-zcash",
  "aurora", "benchmark-test", "wallet", "third-party-app", "intents", "unknown",
];
export const CONFIDENCE = ["high", "medium", "low"];

export function parseLabels(text) {
  const doc = parse(text) ?? {};
  const entries = doc.labels ?? [];
  const seen = new Set();
  for (const e of entries) {
    const where = `label ${e?.account ?? "(no account)"}`;
    if (!e.account || typeof e.account !== "string") throw new Error(`${where}: missing account`);
    if (seen.has(e.account)) throw new Error(`${where}: duplicate entry`);
    seen.add(e.account);
    if (!CATEGORIES.includes(e.category)) throw new Error(`${where}: category "${e.category}" is not one of ${CATEGORIES.join(", ")}`);
    if (!CONFIDENCE.includes(e.confidence)) throw new Error(`${where}: confidence must be high|medium|low`);
    if (!Array.isArray(e.evidence) || e.evidence.length === 0) throw new Error(`${where}: at least one evidence item is required`);
    for (const ev of e.evidence) {
      if (!ev || typeof ev.url !== "string" || !/^https?:\/\/\S+$/.test(ev.url)) throw new Error(`${where}: every evidence item needs an http(s) url`);
      if (!ev.claim || typeof ev.claim !== "string") throw new Error(`${where}: every evidence item needs a claim`);
    }
    if (e.suspected_category !== undefined && !CATEGORIES.includes(e.suspected_category)) throw new Error(`${where}: suspected_category is not a known category`);
    if (e.category === "unknown" && !e.note) throw new Error(`${where}: "unknown" entries need a note saying what is and is not established`);
    if (e.dominant_integrator !== undefined) {
      const d = e.dominant_integrator;
      if (!d.name || !CONFIDENCE.includes(d.confidence)) throw new Error(`${where}: dominant_integrator needs a name and a confidence (high|medium|low)`);
      if (!Array.isArray(d.evidence) || d.evidence.length === 0 || !d.evidence.every((ev) => /^https?:\/\/\S+$/.test(ev?.url ?? "") && ev.claim)) throw new Error(`${where}: dominant_integrator needs evidence items with an http(s) url and a claim`);
    }
  }
  const byAccount = new Map(entries.map((e) => [e.account, e]));
  return {
    entries,
    byAccount,
    /** category bucket of a requester: its category, or "suspected:<category>" for an `unknown` entry with a suspected_category (kept apart so charts can show it separately) */
    categoryOf: (a) => { const e = byAccount.get(a); return !e ? "unlabeled" : e.category === "unknown" && e.suspected_category ? `suspected:${e.suspected_category}` : e.category; },
    confidenceOf: (a) => byAccount.get(a)?.confidence ?? "unlabeled",
    /** accounts treated as benchmark/test for the headline variant: confirmed category or an explicit suspicion */
    benchmarkAccounts: () => entries.filter((e) => e.category === "benchmark-test" || e.suspected_category === "benchmark-test").map((e) => e.account),
  };
}
