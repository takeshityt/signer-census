#!/usr/bin/env node
// Parses data/raw/sample/**/*.json.gz into data/derived/sample_parsed.csv (one row per FunctionCall receipt on v1.signer)
// and data/derived/sample_clusters.csv (one row per cluster). Refreshes data/MANIFEST.sha256.
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { parseTx, classifySigners } from "../src/parse.mjs";
import { toCsv } from "../src/lib/csv.mjs";
import { buildManifest, writeManifest } from "../src/lib/manifest.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const RAW = `${ROOT}data/raw/sample`;
const rows = [];
const clusters = [];
for (const month of readdirSync(RAW).sort()) {
  for (const f of readdirSync(`${RAW}/${month}`).sort()) {
    if (!f.endsWith(".json.gz")) continue;
    const c = JSON.parse(gunzipSync(readFileSync(`${RAW}/${month}/${f}`)));
    const seen = new Set();
    const heights = [];
    for (const d of c.details) {
      for (const tx of d.response.transactions) {
        if (seen.has(tx.transaction.hash)) continue;
        seen.add(tx.transaction.hash);
        heights.push(tx.execution_outcome.block_height);
        for (const r of parseTx(tx)) rows.push({ month: c.month, cluster_id: c.cluster_id, census: c.census ? 1 : 0, ...r });
      }
    }
    clusters.push({ cluster_id: c.cluster_id, month: c.month, census: c.census ? 1 : 0, txs_listed: new Set(c.list_response.account_txs.map((t) => t.transaction_hash)).size, txs_detailed: seen.size,
      missing_hashes: c.missing_hashes.length, first_tx_height: Math.min(...heights), last_tx_height: Math.max(...heights) });
  }
}
const { nodes } = classifySigners(rows);
const COLS = ["month", "cluster_id", "census", "tx_hash", "tx_block_height", "tx_time_utc", "tx_signer", "tx_signer_class", "tx_kind", "receipt_id", "method", "predecessor", "receipt_status",
  "domain_id", "key_version", "path", "payload_type", "payload_hash", "callback_method", "callback_status", "fulfilled"];
writeFileSync(`${ROOT}data/derived/sample_parsed.csv`, toCsv(COLS, rows));
writeFileSync(`${ROOT}data/derived/sample_clusters.csv`, toCsv(["cluster_id", "month", "census", "txs_listed", "txs_detailed", "missing_hashes", "first_tx_height", "last_tx_height"], clusters));
writeFileSync(`${ROOT}data/derived/mpc_node_accounts.json`, JSON.stringify(nodes, null, 1) + "\n");
writeManifest(`${ROOT}data/MANIFEST.sha256`, buildManifest(ROOT, "data", (rel) => rel.startsWith("data/MANIFEST") || rel.startsWith("data/raw/sample/")));
console.log(JSON.stringify({ clusters: clusters.length, rows: rows.length, txs: new Set(rows.map((r) => r.tx_hash)).size, mpc_nodes: nodes.length,
  missing_hashes: clusters.reduce((s, c) => s + c.missing_hashes, 0), csv_bytes: statSync(`${ROOT}data/derived/sample_parsed.csv`).size }, null, 2));
