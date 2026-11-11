#!/usr/bin/env node
// GATE 1, step 1: reconcile counting units (transactions / receipts / signature requests)
// for v1.signer on a narrow block window, using public NEAR RPC as ground truth.
//
// Usage:
//   node scripts/reconcile-units.mjs --from 223960000 --to 223960300 --out docs/evidence/gate1/window-A
//
// Read-only. No keys, no signing, no transactions. Rate limit: <= 3 requests/second (all hosts), see src/lib/http.mjs.

import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { requestJson, rpcCall, stats } from "../src/lib/http.mjs";

const CONTRACT = "v1.signer";
const FASTNEAR_TX = "https://tx.main.fastnear.com";
const MARGIN = 250; // yield timeout is ~200 blocks; look back this far for txs whose receipts may land in the window

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const FROM = Number(arg("from"));
const TO = Number(arg("to")); // exclusive
const RPC = arg("rpc", "https://rpc.mainnet.near.org");
const OUT = arg("out");
if (!Number.isInteger(FROM) || !Number.isInteger(TO) || TO <= FROM || !OUT) {
  console.error("usage: --from <height> --to <height, exclusive> --out <dir> [--rpc <url>]");
  process.exit(2);
}

// ---- rate-limited requests with exponential backoff (shared client, <= 3 req/s) -----------
const postJson = (url, body) => requestJson(url, body);
const rpc = (method, params) => rpcCall(RPC, method, params);

// ---- 1. ground truth: receipts executed on v1.signer per block (from RPC state changes) ---
const gt = new Map(); // receipt_id -> exec block height
const skipped = [];
for (let h = FROM; h < TO; h++) {
  try {
    const r = await rpc("EXPERIMENTAL_changes", { changes_type: "account_changes", account_ids: [CONTRACT], block_id: h });
    for (const c of r.changes) if (c.cause?.type === "receipt_processing") gt.set(c.cause.receipt_hash, h);
  } catch (e) {
    const name = e.rpc?.cause?.name ?? "";
    if (name === "UNKNOWN_BLOCK") skipped.push(h); // legitimately skipped height
    else throw e;
  }
  if ((h - FROM) % 50 === 0) console.error(`ground truth ${h - FROM}/${TO - FROM}  receipts so far: ${gt.size}`);
}

// ---- 2. FastNEAR: list of txs touching v1.signer, tx block in [FROM-MARGIN, TO) ----------
const listBody = { account_id: CONTRACT, limit: 200, is_real_receiver: true, is_function_call: true };
const listed = [];
let resume;
let countWanted; // txs_count for the narrow window [FROM, TO)
{
  const c = await postJson(`${FASTNEAR_TX}/v0/account`, { ...listBody, limit: 1, from_tx_block_height: FROM, to_tx_block_height: TO - 1 }); // `to` is inclusive in FastNEAR (see docs/evidence/gate1b)
  countWanted = c.txs_count;
}
do {
  const page = await postJson(`${FASTNEAR_TX}/v0/account`, {
    ...listBody,
    from_tx_block_height: FROM - MARGIN,
    to_tx_block_height: TO - 1,
    ...(resume ? { resume_token: resume } : {}),
  });
  listed.push(...page.account_txs);
  resume = page.resume_token;
} while (resume);
const uniq = new Map(listed.map((t) => [t.transaction_hash, t]));
console.error(`FastNEAR listed ${uniq.size} txs in [${FROM - MARGIN}, ${TO}); txs_count for [${FROM}, ${TO}) = ${countWanted}`);

// signer ids (needed by tx_status)
const hashes = [...uniq.keys()];
const signerOf = new Map();
for (let i = 0; i < hashes.length; i += 20) {
  const r = await postJson(`${FASTNEAR_TX}/v0/transactions`, { tx_hashes: hashes.slice(i, i + 20) });
  for (const t of r.transactions) signerOf.set(t.transaction.hash, t.transaction.signer_id);
}

// ---- 3. RPC: full receipt tree of each tx ------------------------------------------------
const rawStatus = {};
const txRows = [];
const treeReceipts = new Map(); // receipt_id -> {tx, method, predecessor, status, block_hash}
for (const [i, hash] of hashes.entries()) {
  const signer = signerOf.get(hash);
  const st = await rpc("EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: signer, wait_until: "FINAL" });
  rawStatus[hash] = st;
  const outcomeById = new Map(st.receipts_outcome.map((o) => [o.id, o]));
  const mine = [];
  for (const rc of st.receipts ?? []) {
    if (rc.receiver_id !== CONTRACT) continue;
    const actions = rc.receipt?.Action?.actions ?? [];
    for (const a of actions) {
      if (!a.FunctionCall) continue;
      const o = outcomeById.get(rc.receipt_id);
      const status = o ? Object.keys(o.outcome.status)[0] : "NoOutcome";
      const row = { receipt_id: rc.receipt_id, method: a.FunctionCall.method_name, predecessor: rc.predecessor_id, status, block_hash: o?.block_hash ?? null };
      mine.push(row);
      treeReceipts.set(rc.receipt_id, { tx: hash, ...row });
    }
  }
  txRows.push({
    tx_hash: hash,
    signer,
    tx_block_height: uniq.get(hash).tx_block_height,
    tx_success: uniq.get(hash).is_success,
    v1signer_receipts: mine,
  });
  if (i % 25 === 0) console.error(`tx_status ${i}/${hashes.length}`);
}

// ---- 4. heights of tree receipts that ground truth did not list (reverse check) ----------
const heightByBlockHash = new Map();
const notInGt = [...treeReceipts.values()].filter((r) => !gt.has(r.receipt_id));
for (const r of notInGt) {
  if (!r.block_hash || heightByBlockHash.has(r.block_hash)) continue;
  const b = await rpc("block", { block_id: r.block_hash });
  heightByBlockHash.set(r.block_hash, b.header.height);
}
const treeInWindowButNotInGt = notInGt.filter((r) => {
  const h = heightByBlockHash.get(r.block_hash);
  return h !== undefined && h >= FROM && h < TO;
});

// ---- 5. checks and unit table ------------------------------------------------------------
const unmappedGt = [...gt.keys()].filter((id) => !treeReceipts.has(id)); // executed on v1.signer but in no FastNEAR tx
const inWindowTxs = txRows.filter((t) => t.tx_block_height >= FROM && t.tx_block_height < TO);
const falsePositiveTxs = txRows.filter((t) => t.v1signer_receipts.length === 0);

const methodCount = (ids) => {
  const c = {};
  for (const id of ids) {
    const m = treeReceipts.get(id)?.method ?? "UNMAPPED";
    c[m] = (c[m] ?? 0) + 1;
  }
  return c;
};
const gtMethods = methodCount(gt.keys());

const shapeKey = (t) => {
  const c = {};
  for (const r of t.v1signer_receipts) c[r.method] = (c[r.method] ?? 0) + 1;
  return Object.entries(c).sort().map(([k, v]) => `${k}×${v}`).join(" + ") || "(none)";
};
const shapes = {};
for (const t of inWindowTxs) shapes[shapeKey(t)] = (shapes[shapeKey(t)] ?? 0) + 1;

// sign requests in window: sign receipts executed in [FROM, TO), and how their own tx ended
const signTxs = txRows.filter((t) => t.v1signer_receipts.some((r) => r.method === "sign" && gt.has(r.receipt_id)));
const signOutcome = {};
for (const t of signTxs) {
  const hasReturn = t.v1signer_receipts.some((r) => r.method.startsWith("return_signature") && r.status !== "Failure");
  const k = hasReturn ? "sign+return(ok)" : "sign, no successful return receipt";
  signOutcome[k] = (signOutcome[k] ?? 0) + 1;
}

const checks = [
  { id: "A", what: "every receipt executed on v1.signer in window (RPC state changes) belongs to a tx listed by FastNEAR", pass: unmappedGt.length === 0, detail: `unmapped=${unmappedGt.length}` },
  { id: "B", what: "every tx-tree receipt on v1.signer executed in window appears in RPC ground truth", pass: treeInWindowButNotInGt.length === 0, detail: `missing_in_ground_truth=${treeInWindowButNotInGt.length}` },
  { id: "B'", what: "post-hoc variant of B: every SUCCESSFUL tx-tree receipt on v1.signer executed in window appears in ground truth (account_changes does not record failed receipts)", pass: treeInWindowButNotInGt.filter((r) => r.status !== "Failure").length === 0, detail: `successful_missing=${treeInWindowButNotInGt.filter((r) => r.status !== "Failure").length}, failed_missing=${treeInWindowButNotInGt.filter((r) => r.status === "Failure").length}` },
  { id: "C", what: "FastNEAR txs_count for [from,to) equals the number of listed txs with tx block in [from,to)", pass: countWanted === inWindowTxs.length, detail: `txs_count=${countWanted} listed=${inWindowTxs.length}` },
  { id: "D", what: "every listed tx really contains a FunctionCall receipt on v1.signer (no false positives)", pass: falsePositiveTxs.length === 0, detail: `false_positive_txs=${falsePositiveTxs.length}` },
];

const summary = {
  contract: CONTRACT,
  rpc: RPC,
  window: { from: FROM, to_exclusive: TO, blocks: TO - FROM, skipped_heights: skipped.length },
  requests_made: stats.requests,
  units: {
    transactions_touching_contract_in_window: inWindowTxs.length,
    receipts_executed_on_contract_in_window: gt.size,
    receipts_by_method_in_window: gtMethods,
    tx_shapes_in_window: shapes,
    sign_receipts_in_window: gtMethods.sign ?? 0,
    sign_receipt_txs_and_their_outcome: signOutcome,
  },
  checks,
  verdict: checks.filter((c) => c.id !== "B'").every((c) => c.pass) ? "PASS" : "FAIL", // literal pre-registered checks A, B, C, D
  verdict_with_b_prime: checks.filter((c) => c.id !== "B").every((c) => c.pass) ? "PASS" : "FAIL", // A, B', C, D
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${OUT}/ground-truth-receipts.json`, JSON.stringify([...gt].map(([receipt_id, height]) => ({ receipt_id, height })), null, 1));
writeFileSync(`${OUT}/txs.json`, JSON.stringify(txRows, null, 1));
writeFileSync(`${OUT}/raw-tx-status.json.gz`, gzipSync(JSON.stringify(rawStatus)));
writeFileSync(`${OUT}/problems.json`, JSON.stringify({ unmappedGt, treeInWindowButNotInGt, falsePositiveTxs: falsePositiveTxs.map((t) => t.tx_hash) }, null, 1));
console.log(JSON.stringify(summary, null, 2));
