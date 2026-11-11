// Pure parsing of FastNEAR `/v0/transactions` items into flat rows (one row per FunctionCall on v1.signer).
// Definitions (CLAUDE.md): request = executed `sign` receipt; requester = predecessor_id of that receipt;
// fulfilled = the tx contains a successful return_signature callback; respond receipts are never request counts.
export const CONTRACT = "v1.signer";
export const CALLBACKS = ["return_signature_and_clean_state_on_success", "return_signature_on_finish"]; // current / legacy contract version

export function decodeArgs(b64) {
  try {
    const v = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Normalise the two sign-argument formats (legacy: path/payload[32]/key_version; v2: path/payload_v2/domain_id). */
export function parseSignArgs(args) {
  const empty = { domain_id: "", key_version: "", path: "", payload_type: "unparsed", payload_hash: "" };
  if (!args) return empty;
  const req = args.request && typeof args.request === "object" ? args.request : args;
  const out = { ...empty, path: req.path ?? "" };
  if (req.domain_id !== undefined) out.domain_id = String(req.domain_id);
  if (req.key_version !== undefined) out.key_version = String(req.key_version);
  const p2 = req.payload_v2;
  if (p2 && typeof p2 === "object") {
    const [type, value] = Object.entries(p2)[0] ?? [];
    out.payload_type = type ?? "unknown";
    out.payload_hash = typeof value === "string" ? value.toLowerCase() : "";
  } else if (Array.isArray(req.payload)) {
    out.payload_type = "legacy_bytes";
    out.payload_hash = Buffer.from(req.payload).toString("hex");
  }
  return out;
}

export function statusOf(outcome) {
  const s = outcome?.status;
  if (!s) return "Unknown";
  if ("Failure" in s) return "Failure";
  if ("SuccessValue" in s || "SuccessReceiptId" in s) return "Success";
  return "Unknown";
}

/** All FunctionCall actions of receipts addressed to v1.signer inside one tx detail. */
export function signerReceipts(tx) {
  const out = [];
  for (const rc of tx.receipts ?? []) {
    const r = rc.receipt;
    if (r?.receiver_id !== CONTRACT) continue;
    for (const a of r.receipt?.Action?.actions ?? []) {
      if (!a.FunctionCall) continue;
      out.push({
        receipt_id: r.receipt_id,
        predecessor: r.predecessor_id,
        method: a.FunctionCall.method_name,
        args: a.FunctionCall.args,
        status: statusOf(rc.execution_outcome?.outcome),
      });
    }
  }
  return out;
}

export function txKind(methods) {
  if (methods.includes("sign")) return "request";
  if (methods.includes("verify_foreign_transaction")) return "verify_request";
  if (methods.includes("respond")) return "respond";
  if (methods.includes("respond_verify_foreign_tx")) return "respond_verify";
  return "admin_or_other";
}

/** Parse one tx detail into rows. Node-set based classification is applied later (classifySigners). */
export function parseTx(tx) {
  const recs = signerReceipts(tx);
  const methods = recs.map((r) => r.method);
  const callback = recs.find((r) => CALLBACKS.includes(r.method));
  const base = {
    tx_hash: tx.transaction.hash,
    tx_block_height: tx.execution_outcome.block_height,
    tx_time_utc: new Date(Number(BigInt(tx.execution_outcome.block_timestamp) / 1_000_000n)).toISOString(),
    tx_signer: tx.transaction.signer_id,
    tx_kind: txKind(methods),
  };
  return recs.map((r) => {
    const row = { ...base, receipt_id: r.receipt_id, method: r.method, predecessor: r.predecessor, receipt_status: r.status,
      domain_id: "", key_version: "", path: "", payload_type: "", payload_hash: "", callback_method: "", callback_status: "", fulfilled: "" };
    if (r.method === "sign") {
      Object.assign(row, parseSignArgs(decodeArgs(r.args)));
      row.callback_method = callback?.method ?? "";
      row.callback_status = callback?.status ?? "";
      row.fulfilled = callback && callback.status === "Success" ? 1 : 0;
    }
    return row;
  });
}

/** MPC node accounts = signers of respond txs whose receipt predecessor equals the tx signer. Then label every row. */
export function classifySigners(rows) {
  const nodes = new Set(rows.filter((r) => r.method === "respond" || r.method === "respond_verify_foreign_tx").filter((r) => r.predecessor === r.tx_signer).map((r) => r.tx_signer));
  for (const r of rows) {
    r.tx_signer_class = nodes.has(r.tx_signer) ? "mpc_node" : r.tx_kind === "request" || r.tx_kind === "verify_request" ? "request_side" : "other";
  }
  return { rows, nodes: [...nodes].sort() };
}
