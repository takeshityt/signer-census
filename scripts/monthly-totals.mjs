#!/usr/bin/env node
// STEP 1: exact monthly tx totals for v1.signer.
//  1. resolve calendar-month boundaries (UTC) to block heights with the archival RPC (first block with timestamp >= boundary)
//  2. ask the FastNEAR tx API for the exact txs_count of each [start, end) block range
//  3. check that the months add up to the total
// Output: data/derived/monthly_tx_totals.csv, data/derived/monthly_check.json, data/raw/monthly/*, data/MANIFEST.sha256
import { mkdirSync, writeFileSync } from "node:fs";
import { requestJson, rpcCall, stats } from "../src/lib/http.mjs";
import { buildManifest, writeManifest } from "../src/lib/manifest.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const ARCHIVAL = "https://archival-rpc.mainnet.fastnear.com";
const FASTNEAR = "https://tx.main.fastnear.com/v0/account";
const CONTRACT = "v1.signer";
const FILTER = { account_id: CONTRACT, is_real_receiver: true, is_function_call: true }; // same filter as docs/evidence/gate1
const FIRST_MONTH = "2024-07"; // v1.signer was created 2024-07-31

const searchLog = []; // every block lookup, kept as evidence
const tsCache = new Map();

async function blockTs(h) {
  if (tsCache.has(h)) return tsCache.get(h);
  const r = await rpcCall(ARCHIVAL, "block", { block_id: h });
  const v = { h: r.header.height, ts: BigInt(r.header.timestamp_nanosec) };
  tsCache.set(h, v);
  searchLog.push({ asked: h, height: v.h, timestamp_nanosec: v.ts.toString() });
  return v;
}
/** first existing block at or after h (heights can be skipped) */
async function blockAtOrAfter(h) {
  for (let d = 0; d < 30; d++) {
    try { return await blockTs(h + d); } catch (e) { if (e.rpc?.cause?.name !== "UNKNOWN_BLOCK") throw e; }
  }
  throw new Error(`no block found at/after ${h}`);
}

/** smallest height whose block timestamp >= T, given lo (ts < T) and hi (ts >= T) */
async function firstHeightAtOrAfter(T, lo, hi) {
  let it = 0;
  while (hi.h - lo.h > 1) {
    it++;
    const frac = Number(T - lo.ts) / Number(hi.ts - lo.ts);
    let g = it % 3 === 0 ? Math.floor((lo.h + hi.h) / 2) : lo.h + Math.floor(frac * (hi.h - lo.h));
    g = Math.min(hi.h - 1, Math.max(lo.h + 1, g));
    const b = await blockAtOrAfter(g);
    if (b.h >= hi.h) { // [g, hi) has no blocks at all: look lower
      const g2 = Math.floor((lo.h + g) / 2);
      if (g2 <= lo.h) return hi.h;
      const b2 = await blockAtOrAfter(g2);
      if (b2.h >= hi.h) return hi.h;
      if (b2.ts < T) lo = b2; else hi = b2;
      continue;
    }
    if (b.ts < T) lo = b; else hi = b;
    if (it > 80) throw new Error("boundary search did not converge");
  }
  return hi.h;
}

// ---- snapshot of "now" ----
const latestRaw = await rpcCall(ARCHIVAL, "block", { finality: "final" });
const latest = { h: latestRaw.header.height, ts: BigInt(latestRaw.header.timestamp_nanosec) };
const snapshotTime = new Date(Number(latest.ts / 1_000_000n));
const lastMonth = `${snapshotTime.getUTCFullYear()}-${String(snapshotTime.getUTCMonth() + 1).padStart(2, "0")}`;

const months = [];
for (let [y, m] = FIRST_MONTH.split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= lastMonth; m === 12 ? (y++, (m = 1)) : m++) {
  months.push(`${y}-${String(m).padStart(2, "0")}`);
}
const monthStartNs = (mo) => BigInt(Date.UTC(+mo.slice(0, 4), +mo.slice(5, 7) - 1, 1)) * 1_000_000n;

// ---- boundaries (start of each month; the last month ends at snapshot+1) ----
let lo = await blockTs(100_000_000);
if (lo.ts >= monthStartNs(months[0])) throw new Error("search start block is not before the first month");
const boundaries = [];
for (const mo of months) {
  const T = monthStartNs(mo);
  const h = await firstHeightAtOrAfter(T, lo, latest);
  const b = await blockTs(h);
  boundaries.push({ month: mo, start_height: h, start_block_time_utc: new Date(Number(b.ts / 1_000_000n)).toISOString() });
  lo = { h: h - 1 > lo.h ? h - 1 : lo.h, ts: (await blockAtOrAfter(Math.max(lo.h, h - 1))).ts < T ? (await blockAtOrAfter(Math.max(lo.h, h - 1))).ts : lo.ts };
  console.error(`boundary ${mo}: height ${h} (${boundaries.at(-1).start_block_time_utc}); requests so far ${stats.requests}`);
}
const endExclusive = latest.h + 1;
// FastNEAR quirk (verified, docs/evidence/gate1b/fastnear_to_inclusive.md): `to_tx_block_height` is INCLUSIVE although the docs say
// exclusive. To get half-open [start, end) ranges that add up exactly we always send to = end - 1.

// ---- exact counts per month ----
mkdirSync(`${ROOT}data/raw/monthly/counts`, { recursive: true });
mkdirSync(`${ROOT}data/derived`, { recursive: true });
const rows = [];
for (const [i, b] of boundaries.entries()) {
  const end = i + 1 < boundaries.length ? boundaries[i + 1].start_height : endExclusive;
  const body = { ...FILTER, limit: 1, from_tx_block_height: b.start_height, to_tx_block_height: end - 1 };
  const resp = await requestJson(FASTNEAR, body);
  writeFileSync(`${ROOT}data/raw/monthly/counts/${b.month}.json`, JSON.stringify({ request: body, response: resp }, null, 1));
  rows.push({ month: b.month, start_height: b.start_height, end_height_exclusive: end, start_block_time_utc: b.start_block_time_utc, txs_count: resp.txs_count, partial: i + 1 === boundaries.length ? 1 : 0 });
}

// ---- sanity: sum of months vs totals ----
const boundedTotal = (await requestJson(FASTNEAR, { ...FILTER, limit: 1, to_tx_block_height: endExclusive - 1 })).txs_count; // everything up to the snapshot
const unboundedTotal = (await requestJson(FASTNEAR, { ...FILTER, limit: 1 })).txs_count; // right now (may include newer txs)
const sum = rows.reduce((s, r) => s + r.txs_count, 0);
const check = {
  snapshot_height: latest.h,
  snapshot_time_utc: snapshotTime.toISOString(),
  sum_of_months: sum,
  total_up_to_snapshot_no_lower_bound: boundedTotal,
  gap_sum_vs_bounded_total: boundedTotal - sum,
  total_now_unbounded: unboundedTotal,
  new_txs_after_snapshot: unboundedTotal - boundedTotal,
  note: "gap_sum_vs_bounded_total > 0 would mean txs before the first month boundary (2024-07-01) or lost by boundary arithmetic.",
};
writeFileSync(`${ROOT}data/derived/monthly_check.json`, JSON.stringify(check, null, 2) + "\n");
writeFileSync(`${ROOT}data/raw/monthly/boundary-search.json`, JSON.stringify(searchLog, null, 1));
const header = "month,start_height,end_height_exclusive,start_block_time_utc,txs_count,partial";
writeFileSync(`${ROOT}data/derived/monthly_tx_totals.csv`, [header, ...rows.map((r) => Object.values(r).join(","))].join("\n") + "\n");
writeManifest(`${ROOT}data/MANIFEST.sha256`, buildManifest(ROOT, "data", (rel) => rel.startsWith("data/MANIFEST") || rel.startsWith("data/raw/sample/")));
console.log(JSON.stringify({ check, requests: stats }, null, 2));
console.log(["month", "txs_count"].join("\t")); for (const r of rows) console.log(`${r.month}\t${r.txs_count}${r.partial ? "  (partial month, to snapshot)" : ""}`);
