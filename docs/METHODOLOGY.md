# Methodology

How the census counts NEAR Chain Signatures usage on `v1.signer`, what is exact, what is estimated, and what is not known.
Every number in `out/metrics.json` is rebuilt offline by `npm run reproduce` from files committed in `data/derived/`.

## 1. Units: transaction, receipt, request

These are three different things and are never mixed.

| Unit | What it is | Where it comes from |
|---|---|---|
| **transaction (tx)** | a signed NEAR transaction whose receipts call a function on `v1.signer` | FastNEAR tx API `txs_count` (exact) |
| **receipt** | one execution step on `v1.signer` (`sign`, `respond`, a callback, admin calls) | tx details (sampled) |
| **request** | one executed `sign` receipt on `v1.signer` | tx details (sampled), scaled to the exact tx total |

Observed anatomy of one signature (two reconciliation windows of 300 blocks each, `docs/evidence/gate1`):

* a **user-side tx** (signed by a relayer, e.g. `omni-relayer.bridge.near`, `sweat-relayer.near`) holding a `sign` receipt and, in the same tx, a callback `return_signature_and_clean_state_on_success`;
* a separate **node-response tx** signed by an MPC node holding a `respond` receipt.

So one request is *roughly* two txs and three receipts, **but that is not a conversion ratio**. The ratio moves with failed duplicate responses and admin txs
(window A: 88 txs for 43 requests; window B: 86 txs for 43 requests, 5 of 43 `respond` receipts failed). The census therefore never divides tx totals by two:
it measures the fraction of sign receipts per tx in a sample (section 4).

### Definitions

* **request** = an executed `sign` receipt on `v1.signer` (its status may be a failure; the fulfilled rate is reported separately).
* **fulfilled** = the request's tx contains a successful callback `return_signature_and_clean_state_on_success`
  (contract version of 2024: `return_signature_on_finish`). Verified in both windows: 43/43 requests fulfilled each.
* **requester** = `predecessor_id` of the `sign` receipt. **Not** the tx `signer_id`: tx signers are relayers, so the tx signer says nothing about who asked for the signature.
* **`respond` receipts are never a request count.** Evidence (`docs/evidence/gate1b`, E1): all 7 failed `respond` receipts in window B were late duplicates; each had an earlier successful
  `respond` from another MPC node for the same (payload, tweak, domain). Also, identical requests (same payload, path, caller) can be closed by one `respond`
  (window B: 43 sign receipts, 37 distinct request keys, 38 successful responds), so `respond` counts neither requests nor fulfilments one-to-one.
* **duplicate request** = a sign receipt repeating an identical (payload, domain/key version, path, requester) key inside the same sample cluster.
* **tx signer class**: `mpc_node` = signer of a `respond` tx; `request_side` = other signer of a tx containing `sign`/`verify_foreign_transaction`; `other` = the rest.
* **tx kind**: `request` (contains `sign`), `verify_request`, `respond`, `respond_verify`, `admin_or_other` (e.g. `submit_participant_info`).

Figures that are explicitly **not** used as headline numbers because they are different units or unreconciled: 26.4M (NearBlocks transaction count, which counts receipts),
13.0M tx divided by 2, 26.4M divided by 3, and the cumulative 6.9M of the Dune `proximity_team/v1signer` dashboard (its definition and SQL are not visible).

## 2. Data sources (keyless)

* **FastNEAR tx API** (`https://tx.main.fastnear.com`): `POST /v0/account` with `account_id=v1.signer, is_real_receiver=true, is_function_call=true` for exact counts and tx lists;
  `POST /v0/transactions` for tx details (receipts, args, outcomes). History reaches the contract creation (2024-07-31).
* **Archival RPC** (`https://archival-rpc.mainnet.fastnear.com`): block timestamps to resolve calendar-month boundaries, `tx_status`/`account_changes` for the reconciliation windows.
* **NearBlocks** (`/v1/txns/<hash>`): independent check of single transactions.
* Not used: Dune (free plan is view-only; pay-per-query needs a wallet, which violates the "no keys, no signing" rule), neardata (rate-limits quickly).

**FastNEAR quirk found and handled:** `to_tx_block_height` is **inclusive** although the docs say exclusive. All scripts send `to = end - 1` for half-open `[start, end)` ranges.
Without it, adjacent ranges double-count the boundary block (`docs/evidence/gate1b/fastnear_to_inclusive.md`). With the fix, the 29 monthly counts add up exactly to the total (gap 0).

## 3. Exact part: monthly tx totals

`scripts/monthly-totals.mjs`:

1. For every calendar month (UTC) from 2024-07 to now, the first block with timestamp ≥ the month start is found by interpolation/bisection on the archival RPC.
2. `txs_count` is read for each `[start, next_start)` range. The current month ends at the snapshot block (`data/derived/monthly_check.json`).
3. Check: sum of months = count up to the snapshot (gap 0; the unbounded "now" count differs only by txs that arrived after the snapshot).

Output: `data/derived/monthly_tx_totals.csv` (+ raw responses in `data/raw/monthly/`, hashes in `data/MANIFEST.sha256`).

## 4. Estimated part: cluster sample

Reading the details of all ~13M txs is not feasible. Benchmark (`docs/evidence/gate1b`, E4): ~16 KB per tx, `/v0/transactions` limited to ~20 txs per call, ~3 calls/s allowed
→ ~650,000 calls ≈ 60 hours and ≈ 211 GB. Listing alone would take ~6 hours and is unnecessary because the exact counts come from `txs_count`.

**Design** (`scripts/sample-details.mjs`, parameters in `config/sample.json`, seed committed):

* Per month, 20 start block heights are drawn uniformly at random (seeded RNG, seed derived from the config seed and the month).
  At each, one page of up to 200 consecutive v1.signer txs (up to the month end) is fetched, then their details in batches of 20. One page = one **cluster**.
* **Census months:** months with ≤ 4,000 txs (= 20 × 200) are fetched completely (2024-08, 2024-09), so they have no sampling error.
* Rate: ≤ 3 request starts per second, up to 3 in flight, retries with exponential backoff on 429/5xx, checkpoint per cluster (a cluster file that exists is skipped), so the run is resumable and idempotent.
* Raw responses are stored verbatim (gzip) in `data/raw/sample/`; `scripts/parse-sample.mjs` produces `data/derived/sample_parsed.csv` (one row per receipt on `v1.signer`) and `sample_clusters.csv`.

**Estimator** (`src/estimate.mjs`): ratio estimator per month,

    estimated requests = exact monthly tx total × (sign receipts in sample ÷ txs in sample)

Shares (tx kinds, tx signer classes, requesters, fulfilled rate, duplicate rate) are ratios of sums over the month's clusters. Totals add the monthly estimates.

**Confidence intervals:** 95% percentile intervals from a **cluster bootstrap** (`config/estimate.json`: seed, 2,000 replicates). Clusters, not individual txs, are resampled with replacement inside each month
(txs inside a cluster are time-adjacent and strongly dependent, so resampling single txs would give intervals that are far too narrow). Census months are not resampled. Months are resampled independently and then summed for the totals.
Every figure in `out/metrics.json` carries its interval, plus the source files, the command and the sample size.

## 5. Reconciliation (why we trust the definition)

`scripts/reconcile-units.mjs` compares, for a narrow block window, (a) receipts executed on `v1.signer` according to RPC state changes (`account_changes`, cause `receipt_processing`)
with (b) the tx list of FastNEAR and the full receipt tree of each tx from RPC `tx_status`. Pre-registered checks A–D; window B failed check B literally because `account_changes` does not record failed receipts
(explained in `docs/evidence/gate1/README.md`; B′ = "successful receipts only" passes). STEP 4 repeats the check on two old windows through the archival RPC (`docs/evidence/step4`).

## 6. Known limits and unknowns

* **Sampling bias.** Start heights are uniform in block height. A tx that follows a long quiet gap is more likely to be the first tx of a cluster than a tx inside a dense burst, so quiet periods are slightly over-weighted.
  The bootstrap interval does not include this bias, only between-cluster variability. Months with a few very bursty actors (e.g. the benchmark account `tx-bench.near`) have wider intervals.
* **Overlap.** Clusters of one month can overlap when a month is small; overlapping txs are counted in both clusters (the bootstrap is then conservative).
* **Month attribution.** A request is attributed to the month of its tx, not of the callback execution.
* **Only successful lookups.** Txs whose details the API did not return are listed per cluster (`missing_hashes` in `sample_clusters.csv`).
* **Independent months.** The bootstrap treats months as independent.
* **Unknown:** the cause of request bursts (single actors vs. organic growth), the mapping of `path` strings to target chains (not part of this step), and the exact relation between identical requests and `respond` receipts (hypothesis: one respond can resolve several pending requests with the same key; not proven).
* **Not measured:** Chain Signatures TVL (the `proximity_team` TVL dashboard measures it; this project does not), and anything about fees or value.
* **Reproducibility boundary:** `npm run reproduce` needs only the committed derived data. Re-fetching raw data needs the public APIs to keep their current behaviour.

## 7. Commands

| Command | What it does | Network |
|---|---|---|
| `npm test` | unit tests (parsing, classification, estimator, CSV) | no |
| `npm run reproduce` | verifies `data/MANIFEST.sha256`, rebuilds `out/metrics.json` | no |
| `npm run check:data` | verifies data manifests | no |
| `npm run monthly` | re-fetches exact monthly totals | FastNEAR + archival RPC |
| `npm run sample` | (re)downloads the cluster sample, resumable | FastNEAR |
| `npm run parse` | raw sample → `data/derived/sample_parsed.csv` | no |
| `node scripts/reconcile-units.mjs --from H --to H2 --rpc https://archival-rpc.mainnet.fastnear.com --out DIR` | unit reconciliation on a block window | FastNEAR + archival RPC |
