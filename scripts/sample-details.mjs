#!/usr/bin/env node
// STEP 2: cluster sample of v1.signer transactions with full details (raw, gzip, verbatim API responses).
//  - months with few txs: complete census (pages of 200 until the month is exhausted)
//  - other months: `clustersPerMonth` random start heights (seeded), one page (<= pageSize txs) per cluster
// Resumable and idempotent: a cluster whose file already exists is skipped. <= 3 req/s with exponential backoff (src/lib/http.mjs).
// Output: data/raw/sample/<month>/<cluster_id>.json.gz and data/MANIFEST.raw-sample.sha256
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { requestJson, stats } from "../src/lib/http.mjs";
import { buildManifest, writeManifest } from "../src/lib/manifest.mjs";
import { hashString, mulberry32 } from "../src/lib/rng.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const FASTNEAR = "https://tx.main.fastnear.com";
const cfg = JSON.parse(readFileSync(`${ROOT}config/sample.json`, "utf8"));
const only = process.argv.includes("--months") ? process.argv[process.argv.indexOf("--months") + 1].split(",") : null;
const dry = process.argv.includes("--dry");

const monthly = readFileSync(`${ROOT}data/derived/monthly_tx_totals.csv`, "utf8").trim().split("\n").slice(1).map((l) => {
  const [month, start, end, , count] = l.split(",");
  return { month, start: +start, endExclusive: +end, count: +count };
}).filter((m) => m.count > 0 && (!only || only.includes(m.month)));

const listBody = (m, from, resume) => ({
  account_id: "v1.signer", is_real_receiver: true, is_function_call: true, limit: cfg.pageSize,
  from_tx_block_height: from, to_tx_block_height: m.endExclusive - 1, // `to` is inclusive in FastNEAR
  ...(resume ? { resume_token: resume } : {}),
});
const fileOf = (m, id) => `${ROOT}data/raw/sample/${m.month}/${id}.json.gz`;

async function fetchCluster(m, id, body, census) {
  const list = await requestJson(`${FASTNEAR}/v0/account`, body);
  const hashes = [...new Set(list.account_txs.map((t) => t.transaction_hash))];
  // detail batches in parallel (max 3 in flight; request START rate is still limited to <= 3/s by src/lib/http.mjs)
  const reqs = [];
  for (let i = 0; i < hashes.length; i += cfg.detailBatch) reqs.push({ tx_hashes: hashes.slice(i, i + cfg.detailBatch) });
  const details = new Array(reqs.length);
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < reqs.length) { const i = next++; details[i] = { request: reqs[i], response: await requestJson(`${FASTNEAR}/v0/transactions`, reqs[i]) }; }
  }));
  const got = new Set(details.flatMap((d) => d.response.transactions.map((t) => t.transaction.hash)));
  const missing = hashes.filter((h) => !got.has(h));
  mkdirSync(`${ROOT}data/raw/sample/${m.month}`, { recursive: true });
  writeFileSync(fileOf(m, id), gzipSync(JSON.stringify({ cluster_id: id, month: m.month, census, list_request: body, list_response: list, missing_hashes: missing, details })));
  return { list, n: hashes.length, missing: missing.length };
}

const failed = [];
let done = 0, skipped = 0, txs = 0, missingTotal = 0;
const t0 = Date.now();
for (const m of monthly) {
  const census = m.count <= cfg.censusThresholdTxs;
  const plan = [];
  if (!census) {
    const rng = mulberry32((cfg.seed ^ hashString(m.month)) >>> 0);
    for (let i = 0; i < cfg.clustersPerMonth; i++) plan.push({ id: `${m.month}-c${String(i).padStart(2, "0")}`, from: m.start + Math.floor(rng() * (m.endExclusive - m.start)) });
  }
  if (dry) { console.log(m.month, census ? `census of ${m.count} txs` : `clusters at ${plan.map((p) => p.from).join(",")}`); continue; }
  try {
    if (census) {
      let resume, page = 0, from = m.start;
      for (;;) {
        const id = `${m.month}-p${String(page).padStart(3, "0")}`;
        let list;
        if (existsSync(fileOf(m, id))) { list = JSON.parse(gunzipSync(readFileSync(fileOf(m, id)))).list_response; skipped++; }
        else { const r = await fetchCluster(m, id, listBody(m, from, resume), true); list = r.list; done++; txs += r.n; missingTotal += r.missing; }
        if (!list.resume_token || list.account_txs.length < cfg.pageSize) break;
        resume = list.resume_token; page++;
      }
    } else {
      for (const p of plan) {
        if (existsSync(fileOf(m, p.id))) { skipped++; continue; }
        try { const r = await fetchCluster(m, p.id, listBody(m, p.from), false); done++; txs += r.n; missingTotal += r.missing; }
        catch (e) { failed.push({ cluster: p.id, error: String(e) }); console.error("FAILED", p.id, String(e)); }
      }
    }
  } catch (e) { failed.push({ month: m.month, error: String(e) }); console.error("FAILED month", m.month, String(e)); }
  console.error(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ${m.month} ${census ? "census" : "sample"} done; clusters fetched ${done}, skipped(existing) ${skipped}, txs ${txs}, http429 ${stats.http429}`);
}
if (!dry) {
  writeManifest(`${ROOT}data/MANIFEST.raw-sample.sha256`, buildManifest(ROOT, "data/raw/sample"));
  const lines = buildManifest(ROOT, "data/raw/sample");
  const bytes = lines.reduce((s, l) => s + statSync(ROOT + l.slice(66)).size, 0);
  console.log(JSON.stringify({ clusters_fetched_this_run: done, clusters_skipped_existing: skipped, txs_fetched_this_run: txs, missing_hashes: missingTotal, failed, raw_files: lines.length, raw_gz_bytes: bytes, minutes: +((Date.now() - t0) / 60000).toFixed(1), http: stats }, null, 2));
}
