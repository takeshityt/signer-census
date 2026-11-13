// Seeded sampling for `npm run verify`; the comparison logic lives in verify-core.mjs (shared with the dashboard button).
import { mulberry32 } from "./lib/rng.mjs";
import { expectedFromRows } from "./verify-core.mjs";
export { CONTRACT, expectedFromRows, fromRpc, fromNearblocks, compare } from "./verify-core.mjs";

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

