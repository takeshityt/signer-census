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
(window A: 88 txs for 43 requests; window B: 86 txs for 43 requests, 5 of 43 `respond` receipts failed; early-2025 window: 38 txs for 10 requests, 17 of 26 `respond` receipts failed).
The census therefore never divides tx totals by two:
it measures the fraction of sign receipts per tx in a sample (section 4).

### Definitions

* **request** = an executed `sign` receipt on `v1.signer`. Its own status may be a failure (the contract rejects a repeat of a still-pending identical request with
  "Signature request has already been submitted"); such receipts still count as requests and are reported separately as `sign_receipt_failed_rate`
  (sample: 2.3% of all sign receipts overall, 45% in 2025-03, ~0% in most other months).
* **fulfilled** = the callback found among the descendant receipts of **that** sign receipt (breadth-first over `outcome.receipt_ids`, depth ≤ 4) succeeded.
  Callback names: `return_signature_and_clean_state_on_success` (current; sampled from 2025-02 on) and `return_signature_on_finish` (legacy contract version, until 2025-02;
  sign → sign_helper → return_signature_on_finish). A tx can hold several sign receipts (3,028 such txs in the sample), so the callback is matched per receipt, never per tx.
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
(explained in `docs/evidence/gate1/README.md`; B′ = "successful receipts only" passes). STEP 4 repeated the check on two old windows through the archival RPC
(`docs/evidence/step4/README.md`): early 2025 (A, B′, C, D pass; B fails literally for the same reason, 17 failed duplicate `respond` receipts) and the busiest month 2026-05 (A, B, B′, C, D all pass).

## 6. Known limits and unknowns

* **Sampling bias.** Start heights are uniform in block height. A tx that follows a long quiet gap is more likely to be the first tx of a cluster than a tx inside a dense burst, so quiet periods are slightly over-weighted.
  The bootstrap interval does not include this bias, only between-cluster variability. Months with a few very bursty actors (e.g. the benchmark account `tx-bench.near`) have wider intervals.
* **Overlap.** Clusters of one month can overlap when a month is small; overlapping txs are counted in both clusters (the bootstrap is then conservative).
* **Month attribution.** A request is attributed to the month of its tx, not of the callback execution.
* **Unmatched callbacks.** `fulfilled` is 0 when no callback is found in the descendant receipts (rejected or pending sign receipts); pending requests at the very tip of the chain are not separated from failed ones.
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


## 8. Methods audit: only `sign` is a signature request (part C)

Receipts executed on `v1.signer` in the sample, scaled to all txs (`totals.methods_receipts_est` in out/metrics.json, with the raw sample count next to each estimate):
`sign` ≈ 6,432,762; `respond` ≈ 6,421,977; callbacks `return_signature_and_clean_state_on_success` ≈ 6,390,169 and (legacy) `return_signature_on_finish` ≈ 40,928
with `sign_helper` / `clear_state_on_finish` of the legacy contract version; node/admin calls (`submit_participant_info`, `resolve_verification`, `vote_*`, `join`, `migrate`, ...); `fail_on_timeout` ≈ 10,424 (timeouts of pending requests).
Only `sign` counts as a signature request. **Other request types are reported separately and never added to the request count:**
`verify_foreign_transaction` ≈ 16,894 receipts (foreign-transaction verification requests, answered by `respond_verify_foreign_tx`), and
`request_app_private_key` ≈ 400 (**1 receipt in the sample**: the estimate is near-meaningless, the CI starts at 0; answered by `respond_ckd`).
`derived_public_key`, `public_key`, `latest_key_version` and `state` are view-style calls and are not requests. Rare methods have tiny sample counts; read `receipts_in_sample` before using their estimates.

## 9. Attribution (labels.yaml, part D)

* Every requester needed for ≥ 95% of estimated requests (8 accounts) plus all with ≥ 0.5% (11) are labeled; 15 accounts in total (also three smaller kernel/satoshi accounts and brg.toalice.near, the main cause of the 2025-03 rejection spike). 
  Each entry has category, confidence, owner, note and evidence URLs; `npm test` fails if an entry has no evidence URL, a made-up category, or an `unknown` entry without a note.
* **Coverage** (`totals.labeling_coverage`): requests of requesters that have any label ≈ 98.4% (98.1-98.7%);
  requests whose requester is **identified** (category other than `unknown`) ≈ 78.7% (77.9-79.6%). By confidence: high ≈ 76.6%, medium ≈ 2.1%,
  low ≈ 19.7% (this is dominated by tx-bench.near, an `unknown` entry), unlabeled ≈ 1.6%.
* **tx-bench.near** (≈ 19.1% of requests) is deliberately *not* labeled benchmark-test: `category: unknown`, `suspected_category: benchmark-test`, confidence low. The evidence is behavioural (no contract, one key, empty path,
  constant then random payloads, clockwork cadence, top-ups from n1-*.near accounts); no source names the account. The headline is shown both with and without it.
* `aurora` is not used as a category: `*.aurora` accounts are only the NEAR-side transport of Aurora EVM contracts; the two found (7eda04…, e12bc5…) are Relay Protocol's allocators and are labeled `third-party-app`.
* Evidence was collected by research sub-tasks and then **re-checked by us** (source lines, NEP-330 metadata, creation transactions, wasm strings, view calls); claims that were not re-checked are marked as such inside the label.
  Unresolved items are written into each note (e.g. owner of relay.aurora, who "Reflect" is, whether fastauth.swe.at is Sweat Economy, who funds tx-bench.near).

## 10. Target chains and key types (part F)

* **Key type** (documented in near/mpc: domain_id 0 = secp256k1/ECDSA, 1 = ed25519/EdDSA; legacy sign arguments carry no domain and only secp256k1 is possible): secp256k1 ≈ 44.2%, ed25519 ≈ 55.8% of requests.
* **Chain family** comes only from `config/chain_rules.yaml` (first match wins, each rule has evidence URLs and a confidence); everything else is the explicit `unknown` bucket. Families: `bitcoin`, `zcash`, `near`, `multi`, `unknown`
  (`evm` and `solana` exist in the schema but no rule currently maps to them: the EVM-style paths found are not enough evidence).
  `multi` = the requester is known from source to sign for several destination chains (Omni bridge, Relay allocators) but the chain of a single request is not in the sign arguments.
* Result (`totals.target_chain_families`): near ≈ 46.4%, unknown ≈ 22.5%, multi ≈ 22.3%, bitcoin ≈ 6.5%, zcash ≈ 2.3%.
  By rule confidence (`target_chain_rule_confidence`): high ≈ 28.2%, medium ≈ 46.7%, low ≈ 2.6%, no rule ≈ 22.5%.
  **`near` is mostly FastAuth** (medium confidence: the derived Ed25519 key controls a NEAR account), i.e. a large part of the usage serves NEAR accounts rather than foreign chains. The `unknown` bucket is mostly tx-bench.near.
* Not mapped on purpose: tx-bench.near (empty path), ping-account.near and the Reflect agent contract (EVM-style paths are a hint only), and the ~330 small requesters.

## 11. Robustness of the estimator (part G)

All confidence intervals in this repository are **sampling-only** (cluster bootstrap): they do not include start-point bias, label errors, definition risk or month-to-month dependence. Prose uses "≈" and rounded values.

* **Fully enumerated months.** Replaying the sampling design (20 random start heights, pages of 200 txs) on the two census months gives, against the exact value:
  2024-08: exact 130 requests, mean estimate 136.72, bias +5.2%, RMSE 5.5%;
  2024-09: exact 926, mean 941.06, bias +1.6%, RMSE 2.0%. These months have only 255 and 1,796 txs (the real pipeline reads them completely); for large months no exact value exists, so this check says little about them.
* **Reconciliation windows** (sign receipts per tx in 300-block windows vs the month's estimated ratio; a window is a small sample, so the comparison uses the window's binomial standard error, not the month's CI):
  223900000-223900300 (2026-11): window 0.500 vs month 0.494 (+1.2%, within 2 SE: yes); 223960000-223960300 (2026-11): window 0.489 vs month 0.494 (-1.1%, within 2 SE: yes); 139464032-139464332 (2025-02): window 0.263 vs month 0.357 (-26.2%, within 2 SE: yes); 200296994-200297294 (2026-05): window 0.493 vs month 0.499 (-1.2%, within 2 SE: yes).
* **Density weighting** (clusters weighted by 1/block-span to correct the block-uniform start bias): total ≈ 6,430,239 vs unweighted ≈ 6,432,762 (-0.04%).
  Largest monthly deltas: 2025-02 -13.6%, 2025-03 -8.8%, 2024-10 -3.2%, 2025-06 -2.7%; every monthly density-weighted value lies inside the unweighted 95% CI. The bias matters in sparse, bursty months and is negligible in the total.

## 12. Dependencies

* `vitest` (dev): test runner required by CLAUDE.md. `yaml` (runtime): parses `labels.yaml` and `config/chain_rules.yaml`, the human-editable formats chosen for evidence-bearing data. No other dependencies; Node built-ins elsewhere.

## 13. Thesis metrics (GATE 3)

* **Concentration** (`months[].concentration`, `totals.concentration`): computed over all requesters of the period from the sampled sign receipts (scaled per month for the totals): top-1 and top-3 share of requests,
  Herfindahl-Hirschman index (sum of squared shares, 0..1), number of requesters with a share of at least 1%. Bootstrap intervals as for every other estimate.
* **Series** (`series_requests_est`, definitions in config/estimate.json): `all`; `excluding_benchmark` (minus accounts labeled or *suspected* benchmark-test in labels.yaml, today only tx-bench.near);
  `structural` (minus benchmark and minus fast-auth.near, the integration whose dominant integrator ends in its present form on 2026-12-30); `bridges` (omni.bridge.near + btc-connector.bridge.near + zcash-connector.bridge.near).
* **Target groups** (`target_groups_share`): `near_native` = chain family `near`; `other_chains` = bitcoin, zcash, evm, solana, multi, other; `unknown` = no evidence-backed rule. Key types are reported separately.
* **Relayer share** (`relayer_share_of_requester`): share of a requester's sign receipts whose tx was signed by a given account; used for fast-auth.near via sweat-relayer.near.

## 14. Scenarios (not forecasts)

`assumptions.yaml` (editable) + `src/scenario.mjs`; run by `npm run reproduce` (or `node scripts/scenario.mjs`) → out/scenarios.json.
Baseline = the last full month in out/metrics.json, split into fast-auth.near, benchmark (suspected) and structural requests. For each combination of fast-auth.near retention after the end month,
benchmark kept/removed and a monthly growth rate g of structural demand: structural_k = structural_baseline × (1+g)^k; fast-auth.near stays at the baseline until the end month and is multiplied by the retention afterwards;
the benchmark stays at the baseline or is removed. Point estimates only (the baseline intervals are copied into the output for reference). These numbers show consequences of assumptions; they are not predictions.

## 15. Independent verification (`npm run verify -- --sample 50`)

A seeded random sample of txs that hold sign receipts (from data/derived/sample_parsed.csv.gz; a tx present in two overlapping clusters is taken from one cluster) is checked against two independent public sources:
archival RPC `EXPERIMENTAL_tx_status` (+ `block` for the height) and NearBlocks (`/v1/txns/<hash>`, `/v2/txns/<hash>/receipts`). Per tx it compares the tx signer, the tx block height and the multiset of
(requester, status) of `sign` receipts on v1.signer. Exit code 1 on any mismatch or unreachable source. Runs are saved in docs/evidence/verify/ (a first run with a grouping bug in the verifier itself is kept in `superseded/`).

## 16. THESIS.md

THESIS.md is rendered from docs/THESIS.template.md by `npm run reproduce`. Every number is a placeholder resolved from out/metrics.json or out/scenarios.json (with a footnote giving the JSON path),
a declared literal (dates and thresholds we define) or an external figure with its URL. `npm test` fails if THESIS.md differs from the rendering or contains any other digit.

## 17. Dashboard (GATE 4)

`site/` is a static page (HTML, CSS, ES modules, Chart.js vendored, one self-hosted font; no runtime network calls). `npm run build:site` copies out/metrics.json and out/scenarios.json into site/data/ with a sha256 manifest and exports
labels.yaml, the latest docs/evidence/verify run and the THESIS.md sections as JSON; `npm run site` serves it on 127.0.0.1:4173. Every number on the page is read from those files (`site/js/model.js`, unit-tested against the real data); the five thesis lines and the falsification tests are exported from THESIS.md, not retyped.
Checks and screenshots: docs/evidence/dashboard/CHECKS.md. Chart.js is the single chart library (stacked bars, hatch patterns, custom tooltips with the 95% intervals, no dependencies, MIT).
