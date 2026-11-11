// Resolve a UTC timestamp to the first block at or after it (archival RPC). Same algorithm as scripts/monthly-totals.mjs.
import { rpcCall } from "./http.mjs";
export const ARCHIVAL = "https://archival-rpc.mainnet.fastnear.com";

const cache = new Map();
async function blockTs(h) {
  if (cache.has(h)) return cache.get(h);
  const r = await rpcCall(ARCHIVAL, "block", { block_id: h });
  const v = { h: r.header.height, ts: BigInt(r.header.timestamp_nanosec) };
  cache.set(h, v);
  return v;
}
async function blockAtOrAfter(h) {
  for (let d = 0; d < 30; d++) {
    try { return await blockTs(h + d); } catch (e) { if (e.rpc?.cause?.name !== "UNKNOWN_BLOCK") throw e; }
  }
  throw new Error(`no block found at/after ${h}`);
}
export async function latestBlock() {
  const r = await rpcCall(ARCHIVAL, "block", { finality: "final" });
  return { h: r.header.height, ts: BigInt(r.header.timestamp_nanosec) };
}
/** lo: known block with ts < T, hi: known block with ts >= T. Returns the first height with ts >= T. */
export async function firstHeightAtOrAfter(T, lo, hi) {
  let it = 0;
  while (hi.h - lo.h > 1) {
    it++;
    const frac = Number(T - lo.ts) / Number(hi.ts - lo.ts);
    let g = it % 3 === 0 ? Math.floor((lo.h + hi.h) / 2) : lo.h + Math.floor(frac * (hi.h - lo.h));
    g = Math.min(hi.h - 1, Math.max(lo.h + 1, g));
    const b = await blockAtOrAfter(g);
    if (b.h >= hi.h) {
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
export { blockTs };
