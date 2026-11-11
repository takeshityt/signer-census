#!/usr/bin/env python3 -I
"""E1 + E2: offline analysis of docs/evidence/gate1 windows (no network).
Run from repo root:  python3 -I docs/evidence/gate1b/e1_e2_offline.py
"""
import json, gzip, base64, collections, sys
G = "docs/evidence/gate1"
WINDOWS = {"A": ("window-223960000-223960300", 223960000, 223960300),
           "B": ("window-223900000-223900300", 223900000, 223900300)}
out = {}

def decode_args(b64):
    try:
        v = json.loads(base64.b64decode(b64))
        return v if isinstance(v, dict) else None
    except Exception: return None

def payload_hex(a):
    """Normalise payload across contract arg formats to a hex string."""
    if a is None: return None
    r = a.get("request", a)
    p = r.get("payload_v2") or r.get("payload")
    if isinstance(p, dict): return next(iter(p.values()))
    if isinstance(p, list): return bytes(p).hex()
    return p

def load(w):
    d, lo, hi = WINDOWS[w]
    raw = json.load(gzip.open(f"{G}/{d}/raw-tx-status.json.gz"))
    txs = {t["tx_hash"]: t for t in json.load(open(f"{G}/{d}/txs.json"))}
    gt = {r["receipt_id"]: r["height"] for r in json.load(open(f"{G}/{d}/ground-truth-receipts.json"))}
    rec = []  # every FunctionCall receipt on v1.signer, with decoded fields
    for h, t in raw.items():
        outc = {o["id"]: o for o in t["receipts_outcome"]}
        for rc in t["receipts"]:
            if rc["receiver_id"] != "v1.signer" or "Action" not in rc["receipt"]: continue
            for a in rc["receipt"]["Action"]["actions"]:
                fc = a.get("FunctionCall")
                if not fc: continue
                o = outc.get(rc["receipt_id"])
                args = decode_args(fc["args"])
                req = (args or {}).get("request", args or {})
                rec.append(dict(tx=h, tx_signer=t["transaction"]["signer_id"], tx_block=txs[h]["tx_block_height"],
                    receipt=rc["receipt_id"], method=fc["method_name"], pred=rc["predecessor_id"],
                    status=list(o["outcome"]["status"].keys())[0] if o else "NoOutcome",
                    fail_msg=(o["outcome"]["status"].get("Failure", {}).get("ActionError", {}).get("kind", {}).get("FunctionCallError", {}).get("ExecutionError") if o else None),
                    exec_height=gt.get(rc["receipt_id"]), payload=payload_hex(args),
                    tweak=json.dumps(req.get("tweak")) if "tweak" in req else None,
                    domain=req.get("domain_id"), path=req.get("path")))
    return rec, txs, lo, hi

# ------------------------------------------------------------------ E1
e1 = {}
rec, txs, lo, hi = load("B")
resp = [r for r in rec if r["method"] == "respond"]
sign = [r for r in rec if r["method"] == "sign"]
ret = [r for r in rec if r["method"].startswith("return_signature")]
failed = [r for r in resp if r["status"] == "Failure"]
rows = []
for f in sorted(failed, key=lambda r: r["tx_block"]):
    same_resp = [r for r in resp if r["receipt"] != f["receipt"] and r["payload"] == f["payload"] and r["tweak"] == f["tweak"] and r["domain"] == f["domain"]]
    ok_before = [r for r in same_resp if r["status"] != "Failure" and r["tx_block"] <= f["tx_block"]]
    ok_after = [r for r in same_resp if r["status"] != "Failure" and r["tx_block"] > f["tx_block"]]
    sign_same = [s for s in sign if s["payload"] == f["payload"]]
    rows.append(dict(failed_receipt=f["receipt"], failed_tx=f["tx"], node=f["pred"], tx_block=f["tx_block"],
        in_window=lo <= f["tx_block"] < hi, domain=f["domain"], payload=(f["payload"] or "")[:16] + "…",
        error=f["fail_msg"],
        earlier_successful_respond=[dict(tx=r["tx"], node=r["pred"], tx_block=r["tx_block"]) for r in ok_before],
        later_successful_respond=[dict(tx=r["tx"], node=r["pred"], tx_block=r["tx_block"]) for r in ok_after],
        sign_receipts_same_payload=[dict(tx=s["tx"], caller=s["pred"], path=s["path"], tx_block=s["tx_block"], exec_height=s["exec_height"]) for s in sign_same],
        return_ok_for_that_sign=[any(x["tx"] == s["tx"] and x["status"] != "Failure" for x in ret) for s in sign_same]))
e1["window_B_failed_respond"] = rows
e1["summary"] = dict(n_failed=len(rows),
    duplicate_of_earlier_success=sum(1 for r in rows if r["earlier_successful_respond"]),
    duplicate_of_later_success=sum(1 for r in rows if r["later_successful_respond"] and not r["earlier_successful_respond"]),
    no_other_respond_found_in_data=sum(1 for r in rows if not r["earlier_successful_respond"] and not r["later_successful_respond"]),
    with_matching_sign_receipt_in_data=sum(1 for r in rows if r["sign_receipts_same_payload"]))
out["E1"] = e1

# ------------------------------------------------------------------ E2
e2 = {}
for w in ("A", "B"):
    rec, txs, lo, hi = load(w)
    in_win = {h: t for h, t in txs.items() if lo <= t["tx_block_height"] < hi}
    node_accounts = {r["pred"] for r in rec if r["method"] in ("respond", "respond_verify_foreign_tx")}
    by_signer = collections.Counter(t["signer"] for t in in_win.values())
    kinds = collections.Counter(); kind_of = {}
    for h, t in in_win.items():
        ms = [r["method"] for r in rec if r["tx"] == h]
        k = ("node: respond" if "respond" in ms else "node: respond_verify_foreign_tx" if "respond_verify_foreign_tx" in ms
             else "user-side: sign" if "sign" in ms else "user-side: verify_foreign_transaction" if "verify_foreign_transaction" in ms
             else "other/admin: " + "+".join(sorted(set(ms))))
        kind_of[h] = k; kinds[k] += 1
    signers_by_kind = collections.defaultdict(collections.Counter)
    for h, k in kind_of.items(): signers_by_kind[k][in_win[h]["signer"]] += 1
    sign_exec_in_win = sum(1 for r in rec if r["method"] == "sign" and r["exec_height"] is not None)
    sign_tx_in_win = kinds["user-side: sign"]
    resp_tx_in_win = kinds["node: respond"]
    other = sum(v for k, v in kinds.items() if k.startswith("other") or "verify_foreign" in k)
    e2[w] = dict(window=WINDOWS[w][0], txs_in_window=len(in_win), distinct_tx_signers=len(by_signer),
        tx_kinds=dict(kinds), node_accounts_seen_in_respond=sorted(node_accounts),
        respond_tx_signer_equals_respond_predecessor=all(a == b for a, b in {(r["tx_signer"], r["pred"]) for r in rec if r["method"] == "respond"}),
        signers_by_kind={k: dict(v.most_common()) for k, v in signers_by_kind.items()},
        sign_receipts_executed_in_window=sign_exec_in_win, sign_txs_with_tx_block_in_window=sign_tx_in_win,
        respond_txs_total=resp_tx_in_win, respond_txs_failed=sum(1 for h, k in kind_of.items() if k == "node: respond" and any(r["tx"] == h and r["method"] == "respond" and r["status"] == "Failure" for r in rec)),
        other_txs=other, hypothesis_tx_eq_2x_sign=dict(txs=len(in_win), two_x_sign_receipts=2 * sign_exec_in_win, diff=len(in_win) - 2 * sign_exec_in_win,
            decomposition="txs = sign_txs + respond_txs + other  ->  %d = %d + %d + %d" % (len(in_win), sign_tx_in_win, resp_tx_in_win, other)))
out["E2"] = e2
json.dump(out, open("docs/evidence/gate1b/e1_e2_results.json", "w"), indent=1)
print(json.dumps(out, indent=1))

# ------------------------------------------------------------------ E2b: identical requests vs successful responds
e2b = {}
for w in ("A", "B"):
    rec, txs, lo, hi = load(w)
    signs = [r for r in rec if r["method"] == "sign" and r["exec_height"] is not None]      # executed in window
    resp_ok = [r for r in rec if r["method"] == "respond" and r["status"] != "Failure" and r["exec_height"] is not None]
    key_sign = collections.Counter((s["payload"], s["domain"], s["path"], s["pred"]) for s in signs)
    key_resp = collections.Counter((r["payload"], r["domain"], r["tweak"]) for r in resp_ok)
    sign_payload_dom = collections.Counter((s["payload"], s["domain"]) for s in signs)
    e2b[w] = dict(sign_receipts=len(signs), distinct_sign_keys_payload_domain_path_caller=len(key_sign),
        sign_keys_requested_more_than_once={f"{k[3]} path={str(k[2])[:24]}": v for k, v in key_sign.items() if v > 1},
        ok_respond_receipts=len(resp_ok), distinct_ok_respond_keys=len(key_resp),
        sign_receipts_minus_ok_responds=len(signs) - len(resp_ok),
        distinct_sign_payload_domain=len(sign_payload_dom))
out["E2b"] = e2b
json.dump(out, open("docs/evidence/gate1b/e1_e2_results.json", "w"), indent=1)
print(json.dumps({"E2b": e2b}, indent=1))
