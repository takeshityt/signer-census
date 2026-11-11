import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fromRpc, fromNearblocks, compare, pickTxs, expectedFromRows } from "../src/verify.mjs";

const fx = (f) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
// real tx 6srbUUmw… (fast-auth.near request relayed by sweat-relayer.near, tx block 223899950)
const expected = { tx_hash: "6srbUUmwL1oMZAx2u1CL79fUTs5p2WfzutShRtzJmNTq", tx_signer: "sweat-relayer.near", tx_block_height: 223899950, signs: ["fast-auth.near|Success"] };

describe("verify helpers on real responses", () => {
  it("archival RPC tx_status: finds the sign receipt on v1.signer with requester and status", () => {
    const got = fromRpc(fx("rpc_tx_status_fastauth.json"));
    expect(got.signs).toEqual(["fast-auth.near|Success"]);
    expect(compare(expected, got, { height: 223899950 }).ok).toBe(true);
    expect(compare(expected, got, { height: 1 }).ok).toBe(false); // height mismatch is detected
  });
  it("NearBlocks tx + receipt tree: same answer from an independent indexer", () => {
    const got = fromNearblocks(fx("nearblocks_tx_fastauth.json"), fx("nearblocks_receipts_fastauth.json"));
    expect(got.tx_block_height).toBe(223899950);
    expect(got.signs).toEqual(["fast-auth.near|Success"]);
    expect(compare(expected, got).ok).toBe(true);
  });
  it("detects a wrong requester or status", () => {
    const got = fromNearblocks(fx("nearblocks_tx_fastauth.json"), fx("nearblocks_receipts_fastauth.json"));
    expect(compare({ ...expected, signs: ["other.near|Success"] }, got).ok).toBe(false);
    expect(compare({ ...expected, signs: ["fast-auth.near|Failure"] }, got).ok).toBe(false);
    expect(compare({ ...expected, tx_signer: "x.near" }, got).ok).toBe(false);
  });
  it("a tx present in two overlapping clusters is expected ONCE (regression: verify run of 2026-11-12 found 2 such false mismatches)", () => {
    const r = (c) => ({ tx_hash: "dup", cluster_id: c, method: "sign", predecessor: "p", receipt_status: "Success", tx_signer: "s", tx_block_height: "1", month: "m" });
    const [e] = pickTxs([r("2025-05-c17"), r("2025-05-c13")], 1, 1);
    expect(e.signs).toEqual(["p|Success"]);
  });

  it("pickTxs is seeded, deduplicates txs and keeps only txs with sign receipts", () => {
    const rows = [
      { tx_hash: "a", cluster_id: "k", method: "sign", predecessor: "p", receipt_status: "Success", tx_signer: "s", tx_block_height: "1", month: "m" },
      { tx_hash: "a", cluster_id: "k", method: "sign", predecessor: "p", receipt_status: "Failure", tx_signer: "s", tx_block_height: "1", month: "m" },
      { tx_hash: "b", cluster_id: "k", method: "respond", predecessor: "n", receipt_status: "Success", tx_signer: "n", tx_block_height: "2", month: "m" },
      { tx_hash: "c", cluster_id: "k", method: "sign", predecessor: "q", receipt_status: "Success", tx_signer: "t", tx_block_height: "3", month: "m" },
    ];
    const a = pickTxs(rows, 5, 42), b = pickTxs(rows, 5, 42);
    expect(a).toEqual(b);
    expect(a.map((x) => x.tx_hash).sort()).toEqual(["a", "c"]);
    expect(expectedFromRows(rows.slice(0, 2)).signs).toEqual(["p|Failure", "p|Success"]);
  });
});
