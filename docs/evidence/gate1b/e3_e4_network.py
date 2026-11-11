#!/usr/bin/env python3 -I
"""E3 (keyless access to OLD data) + E4 (FastNEAR tx API benchmark). Read-only, paced <= ~3 req/s, no keys.
Run from repo root:  python3 -I docs/evidence/gate1b/e3_e4_network.py
"""
import json, time, urllib.request, urllib.error, sys
from datetime import datetime, timezone
FN = "https://tx.main.fastnear.com"
ARCH = "https://archival-rpc.mainnet.fastnear.com"
RPC_FN = "https://rpc.mainnet.fastnear.com"
ND = "https://mainnet.neardata.xyz"
NB = "https://api.nearblocks.io"
log = []   # every request recorded
_last = [0.0]
def call(name, url, body=None, method=None, timeout=60):
    wait = 0.32 - (time.time() - _last[0])
    if wait > 0: time.sleep(wait)
    t0 = time.time(); status = None; data = None; err = None; size = 0
    try:
        req = urllib.request.Request(url, data=(json.dumps(body).encode() if body is not None else None),
                                     headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "signer-census-audit"},
                                     method=method or ("POST" if body is not None else "GET"))
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read(); status = r.status; size = len(raw)
            try: data = json.loads(raw)
            except Exception: data = {"_non_json": raw[:200].decode("utf8", "replace")}
    except urllib.error.HTTPError as e:
        status = e.code; raw = e.read(); size = len(raw)
        try: data = json.loads(raw)
        except Exception: data = {"_non_json": raw[:200].decode("utf8", "replace")}
    except Exception as e:
        err = repr(e)
    dt = time.time() - t0; _last[0] = time.time()
    log.append(dict(name=name, url=url, status=status, seconds=round(dt, 3), bytes=size, error=err))
    return status, data, dt
iso = lambda ns: datetime.fromtimestamp(int(ns) / 1e9, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
res = {"E3": {}, "E4": {}}

# ---------------------------------------------------------------- E3: pick targets
lst = lambda **kw: call("fn_list", FN + "/v0/account", dict(account_id="v1.signer", **kw))
# (a) earliest activity: unfiltered, oldest first
s, d, _ = lst(limit=3, desc=False)
first3 = [dict(hash=t["transaction_hash"], height=t["tx_block_height"], time=iso(t["tx_block_timestamp"]), is_receiver=t["is_receiver"], is_function_call=t["is_function_call"]) for t in d["account_txs"]]
res["E3"]["fastnear_earliest_3_unfiltered"] = first3
# (b) first function-call tx
s, d, _ = lst(limit=2, desc=False, is_real_receiver=True, is_function_call=True)
first_fc = [dict(hash=t["transaction_hash"], height=t["tx_block_height"], time=iso(t["tx_block_timestamp"])) for t in d["account_txs"]]
res["E3"]["fastnear_first_function_call_txs"] = first_fc
# (c) ~6 months ago (2026-05-10): walk by height until timestamp is close
target_ts = datetime(2026, 5, 10, tzinfo=timezone.utc).timestamp()
h = 196_800_000; mid = None
for _ in range(6):
    s, d, _ = lst(limit=1, desc=False, is_real_receiver=True, is_function_call=True, from_tx_block_height=h)
    t = d["account_txs"][0]; ts = int(t["tx_block_timestamp"]) / 1e9
    mid = dict(hash=t["transaction_hash"], height=t["tx_block_height"], time=iso(t["tx_block_timestamp"]))
    if abs(ts - target_ts) < 86400: break
    h = int(h + (target_ts - ts) / 0.58)   # NearBlocks avg block time ~0.58 s
res["E3"]["six_months_ago_tx"] = mid
targets = {"earliest_unfiltered": first3[0], "first_function_call": first_fc[0], "six_months_ago": mid}
# NearBlocks account-creation tx (from account endpoint): 7iPVs2MkKxskvJhqBT23KiNZsuwyAjE6EWNwDti8R7w5
targets["nearblocks_creation_tx"] = dict(hash="7iPVs2MkKxskvJhqBT23KiNZsuwyAjE6EWNwDti8R7w5", height=None, time="2024-07-31T20:31:16Z (NearBlocks timestamp 1722457876)")

# ---------------------------------------------------------------- E3: probe each source for each target
per = {}
for label, tgt in targets.items():
    r = {"target": tgt}
    s, d, dt = call("fn_tx_lookup", FN + "/v0/transactions", {"tx_hashes": [tgt["hash"]]})
    txs = (d or {}).get("transactions") or []
    r["fastnear_tx_api"] = dict(http=s, found=bool(txs))
    if txs:
        t = txs[0]; signer = t["transaction"]["signer_id"]; height = t["execution_outcome"]["block_height"]
        r["fastnear_tx_api"].update(signer=signer, block_height=height, time=iso(t["execution_outcome"]["block_timestamp"]), n_receipts=len(t.get("receipts", [])))
        tgt["height"] = tgt["height"] or height
    else:
        signer = None; height = tgt.get("height")
    for nm, base in (("archival_rpc_fastnear", ARCH), ("rpc_fastnear_nonarchival", RPC_FN)):
        if height:
            s, d, dt = call(nm + "_block", base, dict(jsonrpc="2.0", id=1, method="block", params=dict(block_id=height)))
            r[nm + "_block"] = dict(http=s, ok=bool(d and "result" in d), err=(d or {}).get("error", {}).get("cause", {}).get("name") if d and "error" in d else None, seconds=round(dt, 2))
        if signer:
            s, d, dt = call(nm + "_tx_status", base, dict(jsonrpc="2.0", id=1, method="EXPERIMENTAL_tx_status", params=dict(tx_hash=tgt["hash"], sender_account_id=signer, wait_until="FINAL")))
            ok = bool(d and "result" in d)
            r[nm + "_tx_status"] = dict(http=s, ok=ok, err=(d or {}).get("error", {}).get("cause", {}).get("name") if d and "error" in d else None, n_receipts=len(d["result"].get("receipts", [])) if ok else None, seconds=round(dt, 2))
    if height:
        s, d, dt = call("neardata_block", f"{ND}/v0/block/{height}")
        r["neardata_block"] = dict(http=s, ok=bool(d and "block" in d), seconds=round(dt, 2), note=(d or {}).get("_non_json") or (d or {}).get("error"))
    s, d, dt = call("nearblocks_tx", f"{NB}/v1/txns/{tgt['hash']}")
    r["nearblocks_tx"] = dict(http=s, found=bool(d and d.get("txns")), seconds=round(dt, 2), note=None if (d and d.get("txns")) else str(d)[:160])
    per[label] = r
res["E3"]["per_target"] = per

# ---------------------------------------------------------------- E4: FastNEAR benchmark
page_times = []; tok = None; hashes = []; errs = []
t_all = time.time()
for i in range(10):
    body = dict(account_id="v1.signer", limit=200, desc=True, is_real_receiver=True, is_function_call=True)
    if tok: body["resume_token"] = tok
    s, d, dt = call("e4_page", FN + "/v0/account", body)
    if s != 200: errs.append(dict(call="page", n=i, http=s)); break
    page_times.append(round(dt, 3)); tok = d["resume_token"]; hashes += [t["transaction_hash"] for t in d["account_txs"]]
page_wall = time.time() - t_all
detail_times = []; detail_bytes = []; n_ok = 0
t_all = time.time()
for i in range(0, 200, 20):
    s, d, dt = call("e4_details", FN + "/v0/transactions", {"tx_hashes": hashes[i:i + 20]})
    if s != 200: errs.append(dict(call="details", n=i, http=s)); continue
    detail_times.append(round(dt, 3)); n_ok += len(d["transactions"]); detail_bytes.append(log[-1]["bytes"])
detail_wall = time.time() - t_all
total_txs = lst(limit=1, is_real_receiver=True, is_function_call=True)[1]["txs_count"]
rps_cap = 3.0  # what our paced client does (<= 4 approved)
res["E4"] = dict(
    list_pages=dict(n=len(page_times), rows=len(hashes), seconds_each=page_times, mean_seconds=round(sum(page_times) / max(1, len(page_times)), 3), wall_seconds_incl_pacing=round(page_wall, 2)),
    details=dict(requests=len(detail_times), txs_fetched=n_ok, seconds_each=detail_times, mean_seconds=round(sum(detail_times) / max(1, len(detail_times)), 3), mean_bytes_per_request=round(sum(detail_bytes) / max(1, len(detail_bytes))), bytes_per_tx=round(sum(detail_bytes) / max(1, n_ok)), wall_seconds_incl_pacing=round(detail_wall, 2)),
    errors_or_rate_limits=errs, total_txs_now=total_txs,
    extrapolation=dict(
        assumption=f"requests paced at {rps_cap}/s (approved cap is 4/s); server latency not the bottleneck at this pace",
        list_all_pages=dict(requests=-(-total_txs // 200), hours=round(-(-total_txs // 200) / rps_cap / 3600, 2)),
        details_for_all_txs=dict(requests=-(-total_txs // 20), hours=round(-(-total_txs // 20) / rps_cap / 3600, 1), approx_GB=round(total_txs * (sum(detail_bytes) / max(1, n_ok)) / 1e9, 1)),
        details_for_sample_10k=dict(requests=500, minutes=round(500 / rps_cap / 60, 1))))
res["requests_total"] = len(log)
res["http_statuses"] = {str(k): sum(1 for x in log if x["status"] == k) for k in {x["status"] for x in log}}
res["request_log"] = log
json.dump(res, open("docs/evidence/gate1b/e3_e4_results.json", "w"), indent=1)
print(json.dumps({k: v for k, v in res.items() if k != "request_log"}, indent=1))
