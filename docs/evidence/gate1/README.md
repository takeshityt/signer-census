# GATE 1 step 1: reconciliation of counting units (v1.signer)

Command (read-only, <= 3 req/s, no keys):

    node scripts/reconcile-units.mjs --from <height> --to <height> --rpc https://rpc.mainnet.fastnear.com --out <dir>

Ground truth = receipts executed on `v1.signer` per block, from public RPC `EXPERIMENTAL_changes` (`account_changes`,
cause `receipt_processing`). Compared with FastNEAR `POST /v0/account` tx lists and full receipt trees from RPC `EXPERIMENTAL_tx_status`.
Re-running needs the window to still be inside the RPC's retention (~1.5 days on non-archival nodes); the raw responses are kept
in `raw-tx-status.json.gz` so the numbers can be re-derived offline.

Pre-registered checks: A (no receipt on v1.signer missing from FastNEAR txs), B (no tree receipt missing from ground truth),
C (txs_count equals listed txs), D (no false-positive txs).

| window (blocks) | A | B | C | D |
|---|---|---|---|---|
| 223960000-223960300 | PASS | PASS | PASS | PASS |
| 223900000-223900300 | PASS | **FAIL (5)** | PASS | PASS |

B failed in window 2 only: the 5 receipts are `respond` calls with status Failure
("This sign request has timed out, was completed, or never existed."). Failed receipts leave no state change, so
`account_changes` does not list them (7/7 failed receipts in that window are absent from ground truth; 0 successful ones are).
A post-hoc check B' restricted to successful receipts gives 0 missing in both windows. B' was defined after seeing the failure
and is reported as such; it is not a substitute for the pre-registered result.
