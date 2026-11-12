#!/usr/bin/env node
// STEP 2: cluster sample of v1.signer transactions with full details (raw, gzip, verbatim API responses).
//  - months with few txs: complete census (pages of 200 until the month is exhausted)
//  - other months: `clustersPerMonth` random start heights (seeded), one page (<= pageSize txs) per cluster
// Resumable and idempotent: a cluster whose file already exists for the SAME block range is skipped; a file left from an
// earlier run with other boundaries (e.g. the month was partial then) is re-fetched and overwritten. <= 3 req/s with exponential backoff (src/lib/http.mjs).
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
  desc: false, // FastNEAR default is newest-first: without this every cluster of a month would be the SAME last page (bug found and fixed on 2026-11-11)
  from_tx_block_height: from, to_tx_block_height: m.endExclusive - 1, // `to` is inclusive in FastNEAR
  ...(resume ? { resume_token: resume } : {}),
});
const fileOf = (m, id) => `${ROOT}data/raw/sample/${m.month}/${id}.json.gz`;
let stale = 0;
/** existing file usable only if it was fetched for the same block range (start height for sampled clusters, end height for both) */
function existingMatches(m, id, body, census) {
  if (!existsSync(fileOf(m, id))) return null;
  const f = JSON.parse(gunzipSync(readFileSync(fileOf(m, id))));
  const ok = f.list_request?.to_tx_block_height === body.to_tx_block_height && (census || f.list_request?.from_tx_block_height === body.from_tx_block_height);
  if (!ok) { stale++; console.error(`stale ${id}: fetched for another block range, re-fetching`); return null; }
  return f;
}

async function fetchCluster(m, id, body, census) {
  const list = await requestJson(`${FASTNEAR}/v0/account`, body);
  // guard: an ascending page must start at or after the requested height and be ordered
  const hs = list.account_txs.map((t) => t.tx_block_height);
  if (hs.length && (hs[0] < body.from_tx_block_height || hs.some((h, i) => i > 0 && h < hs[i - 1]))) throw new Error(`page for ${id} does not start at the requested height / is not ascending`);
  const hashes = [...new Set(list.account_txs.map((t) => t.transaction_hash))];
  // detail batches in parallel (2 per cluster, 5 clusters at once; request START rate is still limited to <= 3/s by src/lib/http.mjs)
  const reqs = [];
  for (let i = 0; i < hashes.length; i += cfg.detailBatch) reqs.push({ tx_hashes: hashes.slice(i, i + cfg.detailBatch) });
  const details = new Array(reqs.length);
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
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
const note = (msg) => console.error(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ${msg}; fetched ${done}, skipped(existing) ${skipped}, txs ${txs}, http429 ${stats.http429}, requests ${stats.requests}`);

// 1) census months: pages are chained by resume_token, so they run sequentially
// 2) sampled months: independent clusters, processed by a small worker pool
const tasks = [];
for (const m of monthly) {
  const census = m.count <= cfg.censusThresholdTxs;
  if (!census) {
    const rng = mulberry32((cfg.seed ^ hashString(m.month)) >>> 0);
    for (let i = 0; i < cfg.clustersPerMonth; i++) tasks.push({ m, id: `${m.month}-c${String(i).padStart(2, "0")}`, from: m.start + Math.floor(rng() * (m.endExclusive - m.start)) });
    continue;
  }
  if (dry) { console.log(m.month, `census of ${m.count} txs`); continue; }
  let resume, page = 0;
  try {
    for (;;) {
      const id = `${m.month}-p${String(page).padStart(3, "0")}`;
      let list;
      const prev = existingMatches(m, id, listBody(m, m.start, resume), true);
      if (prev) { list = prev.list_response; skipped++; }
      else { const r = await fetchCluster(m, id, listBody(m, m.start, resume), true); list = r.list; done++; txs += r.n; missingTotal += r.missing; }
      if (!list.resume_token || list.account_txs.length < cfg.pageSize) break;
      resume = list.resume_token; page++;
    }
  } catch (e) { failed.push({ month: m.month, error: String(e) }); console.error("FAILED month", m.month, String(e)); }
  note(`${m.month} census done`);
}
if (dry) { for (const t of tasks) console.log(t.id, t.from); }
else {
  let cursor = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (cursor < tasks.length) {
      const t = tasks[cursor++];
      if (existingMatches(t.m, t.id, listBody(t.m, t.from), false)) { skipped++; continue; }
      try { const r = await fetchCluster(t.m, t.id, listBody(t.m, t.from), false); done++; txs += r.n; missingTotal += r.missing; }
      catch (e) { failed.push({ cluster: t.id, error: String(e) }); console.error("FAILED", t.id, String(e)); }
      if ((done + skipped) % 10 === 0) note(`${t.id}`);
    }
  }));
}
if (!dry) {
  writeManifest(`${ROOT}data/MANIFEST.raw-sample.sha256`, buildManifest(ROOT, "data/raw/sample"));
  const lines = buildManifest(ROOT, "data/raw/sample");
  const bytes = lines.reduce((s, l) => s + statSync(ROOT + l.slice(66)).size, 0);
  console.log(JSON.stringify({ clusters_fetched_this_run: done, clusters_skipped_existing: skipped, clusters_refetched_stale: stale, txs_fetched_this_run: txs, missing_hashes: missingTotal, failed, raw_files: lines.length, raw_gz_bytes: bytes, minutes: +((Date.now() - t0) / 60000).toFixed(1), http: stats }, null, 2));
}
