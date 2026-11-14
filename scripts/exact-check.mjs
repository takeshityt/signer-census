#!/usr/bin/env node
// `npm run exact-check`: exact per-account tx counts for the six largest requesters (FastNEAR /v0/account, keyless, paced by src/lib/http.mjs)
// and the unit check (does every tx touching the account carry one sign receipt by it?). Cache first: values already in data/exact/ are not re-fetched;
// pass --refresh to fetch everything again. The comparison itself (out/crosscheck.json) is built offline by `npm run reproduce`.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { requestJson, stats } from "../src/lib/http.mjs";
import { parseCsv } from "../src/lib/csv.mjs";
import { signerReceipts } from "../src/parse.mjs";
import { mulberry32 } from "../src/lib/rng.mjs";
import { ACCOUNTS } from "../src/crosscheck.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const FN = "https://tx.main.fastnear.com";
const REFRESH = process.argv.includes("--refresh");
const DIR = `${ROOT}data/exact`; mkdirSync(DIR, { recursive: true });
const load = (f) => (!REFRESH && existsSync(`${DIR}/${f}`) ? JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) : {});
const save = (f, o) => writeFileSync(`${DIR}/${f}`, JSON.stringify(Object.fromEntries(Object.entries(o).sort()), null, 1) + "\n");
const months = parseCsv(readFileSync(`${ROOT}data/derived/monthly_tx_totals.csv`, "utf8")).filter((m) => Number(m.txs_count) > 0);

const counts = load("counts.json");
for (const a of Object.keys(ACCOUNTS)) for (const m of months) {
  const k = `${a}|${m.month}`; if (counts[k]) continue;
  const range = { from_tx_block_height: Number(m.start_height), to_tx_block_height: Number(m.end_height_exclusive) - 1 };
  const any = (await requestJson(`${FN}/v0/account`, { account_id: a, limit: 1, ...range })).txs_count;
  const pred = (await requestJson(`${FN}/v0/account`, { account_id: a, is_predecessor: true, limit: 1, ...range })).txs_count;
  counts[k] = { any, pred, partial: m.partial === "1" }; save("counts.json", counts);
}
const unit = load("unit-check.json");
const rand = mulberry32(20261114);
for (const a of Object.keys(ACCOUNTS)) {
  const busiest = months.filter((m) => m.partial !== "1").sort((x, y) => counts[`${a}|${y.month}`].any - counts[`${a}|${x.month}`].any)[0];
  const k = `${a}|${busiest.month}`; if (unit[k]) continue;
  const res = { txs: 0, with_sign_by_acc: 0, sign_receipts_by_acc: 0, touching_v1signer: 0, max_signs_per_tx: 0 };
  const lo = Number(busiest.start_height), hi = Number(busiest.end_height_exclusive) - 1;
  for (let w = 0; w < 2; w++) {
    const from = Math.floor(lo + rand() * (hi - lo - 50000));
    const list = await requestJson(`${FN}/v0/account`, { account_id: a, limit: 100, desc: false, from_tx_block_height: from, to_tx_block_height: hi });
    const hashes = [...new Set(list.account_txs.map((t) => t.transaction_hash))];
    for (let i = 0; i < hashes.length; i += 20) {
      const d = await requestJson(`${FN}/v0/transactions`, { tx_hashes: hashes.slice(i, i + 20) });
      for (const t of d.transactions) {
        const rs = signerReceipts(t), n = rs.filter((r) => r.method === "sign" && r.predecessor === a).length;
        res.txs++; if (rs.length) res.touching_v1signer++; if (n) res.with_sign_by_acc++; res.sign_receipts_by_acc += n; res.max_signs_per_tx = Math.max(res.max_signs_per_tx, n);
      }
    }
  }
  unit[k] = res; save("unit-check.json", unit);
}
console.log(`data/exact: ${Object.keys(counts).length} account-months, ${Object.keys(unit).length} unit checks (requests ${stats.requests}, HTTP 429 retries ${stats.http429}). Now run: npm run reproduce`);
