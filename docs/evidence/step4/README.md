# STEP 4: historical check of the definition (archival RPC)

    node scripts/reconcile-units.mjs --from <h> --to <h2> --rpc https://archival-rpc.mainnet.fastnear.com --out docs/evidence/step4/window-<h>-<h2>

Checks (pre-registered in docs/evidence/gate1): A no receipt on v1.signer missing from FastNEAR txs; B no tree receipt missing from RPC ground truth;
B' = B restricted to successful receipts (post-hoc); C txs_count == listed txs; D no false-positive txs. `to_tx_block_height` is sent as `to - 1` (inclusive quirk).

| window | txs | receipts | sign | respond (ok) | return callbacks | A | B | B' | C | D |
|---|---|---|---|---|---|---|---|---|---|---|
| 139464032-139464332 (2025-02, early contract version) | 38 | 47 | 10 | 9 | 9 (`return_signature_on_finish`) | PASS | FAIL (17) | PASS | PASS | PASS |
| 200296994-200297294 (2026-05, busiest month, burst) | 223 | 325 | 110 | 107 | 107 | PASS | PASS | PASS | PASS | PASS |

* Early window: 28 respond-txs vs 10 sign-txs. 17 `respond` receipts failed ("This sign request has timed out, was completed, or never existed"); none of the failed receipts is visible in
  `account_changes`, which is why B fails literally (same mechanism as docs/evidence/gate1 window B). All 10 sign requests are fulfilled (legacy callback chain sign -> sign_helper -> return_signature_on_finish).
  Here tx / 2 would overstate requests by ~1.9x, which is why the census measures sign receipts per tx in a sample instead of dividing.
* Busy window: 110 sign receipts, all 110 sign txs end with a successful callback; 113 sign txs / 109 respond txs by tx block (edge effects of a 300-block window).
* The busy window is a burst (200 txs in 300 blocks), not a typical period.
