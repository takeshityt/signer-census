// Pure helpers for `npm run verify`: compare our parsed sign receipts of one tx with two independent public sources.
// Unit of comparison: the multiset of (requester, status) of `sign` receipts on v1.signer in the tx, plus the tx block height and the tx signer.
import { mulberry32 } from "./lib/rng.mjs";

export const CONTRACT = "v1.signer";
const key = (pred, status) => `${pred}|${status}`;
const sorted = (a) => [...a].sort();

/** Seeded choice of n distinct txs that contain at least one sign receipt. */
export function pickTxs(rows, n, seed) {
  // A tx can appear in two overlapping sample clusters; the expectation must come from ONE cluster (the first by id), otherwise its receipts are counted twice.
  const firstCluster = new Map();
  for (const r of rows) if (r.method === "sign" && (!firstCluster.has(r.tx_hash) || r.cluster_id < firstCluster.get(r.tx_hash))) firstCluster.set(r.tx_hash, r.cluster_id);
  const byTx = new Map();
  for (const r of rows) if (r.method === "sign" && r.cluster_id === firstCluster.get(r.tx_hash)) { if (!byTx.has(r.tx_hash)) byTx.set(r.tx_hash, []); byTx.get(r.tx_hash).push(r); }
  const hashes = [...byTx.keys()].sort();
  const rng = mulberry32(seed);
  for (let i = hashes.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [hashes[i], hashes[j]] = [hashes[j], hashes[i]]; }
  return hashes.slice(0, n).map((h) => expectedFromRows(byTx.get(h)));
}

export function expectedFromRows(rows) {
  const r0 = rows[0];
  return { tx_hash: r0.tx_hash, tx_signer: r0.tx_signer, tx_block_height: Number(r0.tx_block_height), month: r0.month, signs: sorted(rows.map((r) => key(r.predecessor, r.receipt_status))) };
}

/** From RPC EXPERIMENTAL_tx_status result. Block height needs a separate `block` lookup of transaction_outcome.block_hash. */
export function fromRpc(result) {
  const outcome = new Map(result.receipts_outcome.map((o) => [o.id, o]));
  const signs = [];
  for (const rc of result.receipts ?? []) {
    if (rc.receiver_id !== CONTRACT) continue;
    for (const a of rc.receipt?.Action?.actions ?? []) {
      if (a.FunctionCall?.method_name !== "sign") continue;
      const st = outcome.get(rc.receipt_id)?.outcome?.status ?? {};
      signs.push(key(rc.predecessor_id, "Failure" in st ? "Failure" : "SuccessValue" in st || "SuccessReceiptId" in st ? "Success" : "Unknown"));
    }
  }
  return { tx_signer: result.transaction.signer_id, tx_block_hash: result.transaction_outcome.block_hash, signs: sorted(signs) };
}

/** From NearBlocks: GET /v1/txns/<hash> (block height, signer) + GET /v2/txns/<hash>/receipts (receipt tree). */
export function fromNearblocks(txResp, receiptsResp) {
  const t = txResp.txns?.[0];
  const signs = [];
  const walk = (n) => {
    if (!n) return;
    if (n.receiver_account_id === CONTRACT) {
      for (const a of n.actions ?? []) if ((a.action_kind ?? a.action) === "FUNCTION_CALL" && (a.args?.method_name ?? a.method) === "sign") signs.push(key(n.predecessor_account_id, n.outcome?.status === true ? "Success" : n.outcome?.status === false ? "Failure" : "Unknown"));
    }
    for (const c of n.receipts ?? []) walk(c);
  };
  for (const r of receiptsResp.receipts ?? []) walk(r.receipt_tree);
  return { tx_signer: t?.signer_account_id, tx_block_height: Number(t?.block?.block_height), signs: sorted(signs) };
}

/** Compare expected (our data) with what a source returned. Returns { ok, problems[] }. */
export function compare(expected, got, { height } = {}) {
  const problems = [];
  if (got.tx_signer !== expected.tx_signer) problems.push(`tx signer ${got.tx_signer} != ${expected.tx_signer}`);
  const h = height ?? got.tx_block_height;
  if (h !== expected.tx_block_height) problems.push(`block height ${h} != ${expected.tx_block_height}`);
  if (JSON.stringify(got.signs) !== JSON.stringify(expected.signs)) problems.push(`sign receipts ${JSON.stringify(got.signs)} != ${JSON.stringify(expected.signs)}`);
  return { ok: problems.length === 0, problems };
}
