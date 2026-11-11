#!/usr/bin/env node
// `npm run verify -- --sample 50`: re-checks a seeded random sample of our sign receipts against two independent public sources:
//   (1) archival RPC EXPERIMENTAL_tx_status (+ block lookup for the height), (2) NearBlocks /v1/txns/<hash> and /v2/txns/<hash>/receipts.
// Read-only, keyless, <= 3 req/s overall (NearBlocks paced slower). Exit code 1 if any tx does not match or cannot be checked.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { parseCsv } from "../src/lib/csv.mjs";
import { requestJson, rpcCall, stats } from "../src/lib/http.mjs";
import { pickTxs, fromRpc, fromNearblocks, compare } from "../src/verify.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const cfg = JSON.parse(readFileSync(`${ROOT}config/verify.json`, "utf8"));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const N = Number(arg("sample", cfg.defaultSample));
const seed = Number(arg("seed", cfg.seed));
const outDir = arg("out", null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = parseCsv(gunzipSync(readFileSync(`${ROOT}data/derived/sample_parsed.csv.gz`)).toString());
const picked = pickTxs(rows, N, seed);
const results = [];
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
log(`verify: ${picked.length} seeded random txs with sign receipts (seed ${seed}) from data/derived/sample_parsed.csv.gz`);
for (const [i, exp] of picked.entries()) {
  const res = { tx_hash: exp.tx_hash, month: exp.month, expected_signs: exp.signs, rpc: null, nearblocks: null };
  try {
    const st = await rpcCall(cfg.rpc, "EXPERIMENTAL_tx_status", { tx_hash: exp.tx_hash, sender_account_id: exp.tx_signer, wait_until: "FINAL" });
    const got = fromRpc(st);
    const blk = await rpcCall(cfg.rpc, "block", { block_id: got.tx_block_hash });
    res.rpc = compare(exp, got, { height: blk.header.height });
  } catch (e) { res.rpc = { ok: false, problems: [`error: ${String(e).slice(0, 160)}`] }; }
  try {
    await sleep(cfg.nearblocksSpacingMs);
    const tx = await requestJson(`${cfg.nearblocks}/v1/txns/${exp.tx_hash}`);
    await sleep(cfg.nearblocksSpacingMs);
    const rc = await requestJson(`${cfg.nearblocks}/v2/txns/${exp.tx_hash}/receipts`);
    res.nearblocks = compare(exp, fromNearblocks(tx, rc));
  } catch (e) { res.nearblocks = { ok: false, problems: [`error: ${String(e).slice(0, 160)}`] }; }
  results.push(res);
  log(`${String(i + 1).padStart(3)} ${exp.tx_hash} ${exp.month} signs=${exp.signs.length}  rpc:${res.rpc.ok ? "OK" : "FAIL"}  nearblocks:${res.nearblocks.ok ? "OK" : "FAIL"}${[...res.rpc.problems, ...res.nearblocks.problems].length ? "  " + [...res.rpc.problems, ...res.nearblocks.problems].join("; ") : ""}`);
}
const both = results.filter((r) => r.rpc.ok && r.nearblocks.ok).length;
const rpcOk = results.filter((r) => r.rpc.ok).length;
const nbOk = results.filter((r) => r.nearblocks.ok).length;
log(`${both}/${results.length} verified (archival RPC ${rpcOk}/${results.length}, NearBlocks ${nbOk}/${results.length}); requests made ${stats.requests}, HTTP 429 retries ${stats.http429}`);
if (outDir) {
  mkdirSync(`${ROOT}${outDir}`, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(`${ROOT}${outDir}/verify-${stamp}-seed${seed}-n${N}.txt`, lines.join("\n") + "\n");
  writeFileSync(`${ROOT}${outDir}/verify-${stamp}-seed${seed}-n${N}.json`, JSON.stringify({ seed, sample: N, verified: both, rpc_ok: rpcOk, nearblocks_ok: nbOk, results }, null, 1) + "\n");
}
process.exit(both === results.length ? 0 : 1);
