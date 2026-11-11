#!/usr/bin/env node
// Evidence for labels.yaml: per-requester profile computed from the committed sample (offline).
// Output: docs/evidence/attribution/requester-profiles.json
//   command: node scripts/requester-profile.mjs <account> [<account> ...]   (default: the accounts in labels.yaml)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { parseCsv } from "../src/lib/csv.mjs";
import { parseLabels } from "../src/labels.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const rows = parseCsv(gunzipSync(readFileSync(`${ROOT}data/derived/sample_parsed.csv.gz`)).toString());
const labelsText = existsSync(`${ROOT}labels.yaml`) ? readFileSync(`${ROOT}labels.yaml`, "utf8") : "labels: []";
const accounts = process.argv.length > 2 ? process.argv.slice(2) : [...parseLabels(labelsText).byAccount.keys()];
const pathClass = (p) => p === "" ? "<empty>" : p.replace(/[0-9a-f]{40,}/g, "<hex>").replace(/jwt#([^#]+)#.*/, "jwt#$1#<sub>").replace(/0x[0-9a-fA-F]{40}/g, "0x<addr>").slice(0, 60);
const count = (arr) => { const m = new Map(); for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const sign = rows.filter((r) => r.method === "sign");
const out = { source: "data/derived/sample_parsed.csv.gz (sample rows, NOT scaled to totals)", command: "node scripts/requester-profile.mjs", accounts: {} };
for (const a of accounts) {
  const rs = sign.filter((r) => r.predecessor === a);
  if (!rs.length) { out.accounts[a] = { sign_rows_in_sample: 0 }; continue; }
  const months = [...new Set(rs.map((r) => r.month))].sort();
  const p = {
    sign_rows_in_sample: rs.length,
    first_month_in_sample: months[0], last_month_in_sample: months.at(-1), active_months: months.length,
    key_types: count(rs.map((r) => `${r.domain_id !== "" ? "domain_id=" + r.domain_id : "legacy key_version=" + r.key_version}/${r.payload_type}`)).slice(0, 5),
    path_classes: count(rs.map((r) => pathClass(r.path))).slice(0, 6),
    tx_signers: count(rs.map((r) => r.tx_signer)).slice(0, 5),
    distinct_payloads: new Set(rs.map((r) => r.payload_hash)).size,
    fulfilled_share: rs.filter((r) => r.fulfilled === "1").length / rs.length,
    sign_receipt_failed_share: rs.filter((r) => r.receipt_status === "Failure").length / rs.length,
  };
  // regularity: block gaps between consecutive txs of this requester inside the same cluster (clusters are consecutive v1.signer txs)
  const byCluster = new Map();
  for (const r of rs) { if (!byCluster.has(r.cluster_id)) byCluster.set(r.cluster_id, new Set()); byCluster.get(r.cluster_id).add(Number(r.tx_block_height)); }
  const gaps = [];
  for (const hs of byCluster.values()) { const s = [...hs].sort((x, y) => x - y); for (let i = 1; i < s.length; i++) gaps.push(s[i] - s[i - 1]); }
  p.gap_blocks_between_consecutive_txs = { n: gaps.length, median: median(gaps), p10: gaps.length ? [...gaps].sort((x, y) => x - y)[Math.floor(gaps.length * 0.1)] : null, p90: gaps.length ? [...gaps].sort((x, y) => x - y)[Math.floor(gaps.length * 0.9)] : null, note: "NEAR block time is ~0.6 s; a gap of 100 blocks is ~1 minute" };
  // share of all sign rows of the month (sample composition, not volume)
  const perMonth = {};
  for (const m of months) perMonth[m] = Math.round((rs.filter((r) => r.month === m).length / sign.filter((r) => r.month === m).length) * 1000) / 10;
  p.share_of_sampled_sign_receipts_by_month_pct = perMonth;
  out.accounts[a] = p;
}
writeFileSync(`${ROOT}docs/evidence/attribution/requester-profiles.json`, JSON.stringify(out, null, 1) + "\n");
console.log(`profiled ${accounts.length} accounts`);
