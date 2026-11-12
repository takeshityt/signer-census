#!/usr/bin/env node
// Scale of v1.signer against the whole NEAR network (network, keyless, ~2-4 minutes).
//  1. NearBlocks public chart API (GET https://api.nearblocks.io/v1/charts): daily transaction counts of the whole network, summed per UTC month.
//  2. Independent cross-check with the FastNEAR transaction API (POST /v0/blocks, 100 blocks per call, field num_transactions):
//     a seeded random sample of 100-block windows per month, scaled to the month's block-height span (an estimate, not a count).
//  3. v1.signer exact monthly transaction counts from data/derived/monthly_tx_totals.csv.
// Output: data/raw/network/nearblocks_daily_txns.csv, data/derived/network_monthly_txns.csv, data/MANIFEST.sha256
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { requestJson, stats } from "../src/lib/http.mjs";
import { parseCsv } from "../src/lib/csv.mjs";
import { mulberry32 } from "../src/lib/rng.mjs";
import { buildManifest, writeManifest } from "../src/lib/manifest.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const NEARBLOCKS = "https://api.nearblocks.io/v1/charts";
const FASTNEAR_BLOCKS = "https://tx.main.fastnear.com/v0/blocks";
const WINDOWS_PER_MONTH = 12, SEED = 20261112;

const months = parseCsv(readFileSync(`${ROOT}data/derived/monthly_tx_totals.csv`, "utf8")).filter((m) => Number(m.txs_count) > 0 && m.partial !== "1");

// 1. NearBlocks daily chart
const charts = (await requestJson(NEARBLOCKS)).charts;
if (!Array.isArray(charts) || !charts.length) throw new Error("NearBlocks /v1/charts returned no rows");
const daily = charts.map((d) => ({ date: d.date.slice(0, 10), txns: Number(d.txns) })).sort((a, b) => a.date.localeCompare(b.date));
mkdirSync(`${ROOT}data/raw/network`, { recursive: true });
writeFileSync(`${ROOT}data/raw/network/nearblocks_daily_txns.csv`, ["date,txns", ...daily.map((d) => `${d.date},${d.txns}`)].join("\n") + "\n");
const nb = {};
for (const d of daily) { const m = d.date.slice(0, 7); nb[m] ??= { days: 0, txns: 0 }; nb[m].days++; nb[m].txns += d.txns; }

// 2. FastNEAR block sample
const rng = mulberry32(SEED);
const out = [];
for (const m of months) {
  const start = Number(m.start_height), end = Number(m.end_height_exclusive);
  let tx = 0, span = 0;
  for (let i = 0; i < WINDOWS_PER_MONTH; i++) {
    const from = start + Math.floor(rng() * (end - start - 100));
    const r = await requestJson(FASTNEAR_BLOCKS, { from_block_height: from, to_block_height: from + 99, limit: 100, desc: false });
    const blocks = (r.blocks ?? []).filter((b) => b.block_height >= from && b.block_height <= from + 99);
    if (!blocks.length) throw new Error(`no blocks returned for ${from}`);
    tx += blocks.reduce((a, b) => a + b.num_transactions, 0);
    span += 100; // height span read (missing heights produce no block and no transactions)
  }
  const fastnearEst = Math.round((tx / span) * (end - start));
  const daysInMonth = new Date(Date.UTC(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)), 0)).getUTCDate();
  const n = nb[m.month];
  out.push({ month: m.month, nearblocks_days: n?.days ?? 0, nearblocks_txns: n && n.days === daysInMonth ? n.txns : "", fastnear_sampled_heights: span, fastnear_sampled_txs: tx, fastnear_est_txns: fastnearEst, v1signer_txs: Number(m.txs_count) });
  console.log(`${m.month}: NearBlocks ${n?.txns ?? "-"} (${n?.days ?? 0} days), FastNEAR block-sample estimate ${fastnearEst}, v1.signer ${m.txs_count}`);
}
const cols = Object.keys(out[0]);
writeFileSync(`${ROOT}data/derived/network_monthly_txns.csv`, [cols.join(","), ...out.map((r) => cols.map((c) => r[c]).join(","))].join("\n") + "\n");
writeManifest(`${ROOT}data/MANIFEST.sha256`, buildManifest(ROOT, "data", (r) => r.startsWith("data/MANIFEST") || r.startsWith("data/raw/sample/")));
console.log(`written data/derived/network_monthly_txns.csv (${out.length} months); requests ${stats.requests}, HTTP 429 retries ${stats.http429}`);
