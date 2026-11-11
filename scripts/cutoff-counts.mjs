#!/usr/bin/env node
// PART B: exact tx counts for v1.signer on the same cutoffs as the proximity_team/v1signer dashboard.
// Their series is cumulative, starts on 2024-10-01 and is read as "through the end of that UTC day".
// For every cutoff date we store the exact txs_count of the partial month segment [month start, end of cutoff day]; full months come from monthly_tx_totals.csv.
import { readFileSync, writeFileSync } from "node:fs";
import { requestJson } from "../src/lib/http.mjs";
import { blockTs, firstHeightAtOrAfter, latestBlock } from "../src/lib/blocks.mjs";
import { buildManifest, writeManifest } from "../src/lib/manifest.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const FASTNEAR = "https://tx.main.fastnear.com/v0/account";
const FILTER = { account_id: "v1.signer", is_real_receiver: true, is_function_call: true };
const reported = JSON.parse(readFileSync(`${ROOT}config/proximity_reported.json`, "utf8"));
const months = readFileSync(`${ROOT}data/derived/monthly_tx_totals.csv`, "utf8").trim().split("\n").slice(1).map((l) => { const [month, start, end, , count] = l.split(","); return { month, start: +start, end: +end, count: +count }; });

const latest = await latestBlock();
let lo = await blockTs(100_000_000);
const out = [];
for (const c of reported.points) {
  const next = new Date(Date.UTC(+c.date.slice(0, 4), +c.date.slice(5, 7) - 1, +c.date.slice(8, 10) + 1)); // start of the next UTC day
  const T = BigInt(next.getTime()) * 1_000_000n;
  const endExclusive = await firstHeightAtOrAfter(T, lo, latest); // first block of the next day
  const mo = c.date.slice(0, 7);
  const m = months.find((x) => x.month === mo);
  const body = { ...FILTER, limit: 1, from_tx_block_height: m.start, to_tx_block_height: endExclusive - 1 }; // `to` is inclusive in FastNEAR
  const r = await requestJson(FASTNEAR, body);
  out.push({ date: c.date, end_height_exclusive: endExclusive, month: mo, month_start_height: m.start, segment_txs_count: r.txs_count });
  console.error(c.date, endExclusive, r.txs_count);
}
writeFileSync(`${ROOT}data/derived/proximity_cutoffs.json`, JSON.stringify({ note: "exact txs_count of [month start, end of cutoff UTC day] for each cutoff date", cutoffs: out }, null, 1) + "\n");
writeManifest(`${ROOT}data/MANIFEST.sha256`, buildManifest(ROOT, "data", (rel) => rel.startsWith("data/MANIFEST") || rel.startsWith("data/raw/sample/")));
