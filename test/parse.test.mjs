import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseTx, parseSignArgs, classifySigners, statusOf, decodeArgs, txKind } from "../src/parse.mjs";
import { parseCsv, toCsv } from "../src/lib/csv.mjs";

const fx = Object.fromEntries(JSON.parse(readFileSync(new URL("./fixtures/fastnear_txs.json", import.meta.url))));

describe("parseTx on real FastNEAR fixtures", () => {
  it("sign tx (v2 args): one sign row + one fulfilled callback; requester is the receipt predecessor, not the tx signer", () => {
    const rows = parseTx(fx.sign_v2);
    const sign = rows.filter((r) => r.method === "sign");
    expect(sign).toHaveLength(1);
    expect(sign[0].tx_kind).toBe("request");
    expect(sign[0].fulfilled).toBe(1);
    expect(sign[0].callback_method).toBe("return_signature_and_clean_state_on_success");
    expect(sign[0].predecessor).not.toBe(sign[0].tx_signer); // relayer signs, contract/user requests
    expect(["Ecdsa", "Eddsa"]).toContain(sign[0].payload_type);
    expect(sign[0].payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows.map((r) => r.method).sort()).toEqual(["return_signature_and_clean_state_on_success", "sign"]);
  });

  it("sign tx with legacy args: payload bytes become a hex hash and key_version is kept", () => {
    const s = parseTx(fx.sign_legacy_args).find((r) => r.method === "sign");
    expect(s.payload_type === "legacy_bytes" || s.payload_type === "Ecdsa" || s.payload_type === "Eddsa").toBe(true);
    expect(s.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(s.domain_id !== "" || s.key_version !== "").toBe(true);
  });

  it("old contract version (2024-08): legacy callback is recognised; this real request FAILED (callback panicked), so fulfilled = 0", () => {
    const s = parseTx(fx.sign_old_contract_version).find((r) => r.method === "sign");
    expect(s.callback_method).toBe("return_signature_on_finish");
    expect(s.callback_status).toBe("Failure");
    expect(s.fulfilled).toBe(0);
  });

  it("respond tx: never a request; failed respond keeps status Failure", () => {
    const ok = parseTx(fx.respond_ok);
    expect(ok.every((r) => r.method !== "sign")).toBe(true);
    expect(ok[0].tx_kind).toBe("respond");
    expect(ok[0].receipt_status).toBe("Success");
    const bad = parseTx(fx.respond_failed_duplicate);
    expect(bad[0].receipt_status).toBe("Failure");
    expect(bad[0].tx_kind).toBe("respond");
  });

  it("multi-sign tx (real): each sign receipt is matched to ITS OWN callback receipt, not to the first callback of the tx", () => {
    const rows = parseTx(fx.multi_sign_tx);
    const signs = rows.filter((r) => r.method === "sign");
    expect(signs.length).toBeGreaterThanOrEqual(2);
    const cbIds = signs.map((r) => r.callback_receipt_id);
    expect(cbIds.every(Boolean)).toBe(true);
    expect(new Set(cbIds).size).toBe(signs.length); // one distinct callback per sign
    for (const id of cbIds) expect(rows.some((r) => r.receipt_id === id)).toBe(true);
  });

  it("rejected sign (real, 'Signature request has already been submitted'): status Failure, no callback, fulfilled = 0", () => {
    const sign = parseTx(fx.rejected_sign_already_submitted).filter((r) => r.method === "sign");
    expect(sign.length).toBeGreaterThanOrEqual(1);
    expect(sign.every((r) => r.receipt_status === "Failure" && r.callback_method === "" && r.fulfilled === 0)).toBe(true);
  });

  it("admin tx is classified as admin_or_other", () => {
    expect(parseTx(fx.admin_submit_participant_info)[0].tx_kind).toBe("admin_or_other");
  });
});

describe("classifySigners", () => {
  it("marks signers of respond txs as mpc_node, others by tx kind", () => {
    const rows = [fx.sign_v2, fx.respond_ok, fx.admin_submit_participant_info].flatMap(parseTx);
    const { nodes } = classifySigners(rows);
    const respondSigner = parseTx(fx.respond_ok)[0].tx_signer;
    expect(nodes).toContain(respondSigner);
    expect(rows.find((r) => r.method === "respond").tx_signer_class).toBe("mpc_node");
    expect(rows.find((r) => r.method === "sign").tx_signer_class).toBe("request_side");
  });
});

describe("small helpers", () => {
  it("parseSignArgs handles v2 and legacy shapes and garbage", () => {
    expect(parseSignArgs({ request: { path: "p", domain_id: 1, payload_v2: { Eddsa: "AB" } } })).toMatchObject({ domain_id: "1", payload_type: "Eddsa", payload_hash: "ab", path: "p" });
    expect(parseSignArgs({ path: "x", key_version: 0, payload: [1, 2, 255] })).toMatchObject({ key_version: "0", payload_type: "legacy_bytes", payload_hash: "0102ff" });
    expect(parseSignArgs(null).payload_type).toBe("unparsed");
  });
  it("statusOf / decodeArgs / txKind", () => {
    expect(statusOf({ status: { Failure: {} } })).toBe("Failure");
    expect(statusOf({ status: { SuccessReceiptId: "x" } })).toBe("Success");
    expect(statusOf(undefined)).toBe("Unknown");
    expect(decodeArgs(Buffer.from('{"a":1}').toString("base64"))).toEqual({ a: 1 });
    expect(decodeArgs("%%%")).toBeNull();
    expect(txKind(["respond"])).toBe("respond");
    expect(txKind(["sign", "return_signature_and_clean_state_on_success"])).toBe("request");
  });
  it("csv round-trips quotes, commas and newlines", () => {
    const rows = [{ a: 'x,"y"', b: "line1\nline2", c: "" }];
    expect(parseCsv(toCsv(["a", "b", "c"], rows))).toEqual(rows);
  });
});
