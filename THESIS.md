<!-- THESIS.md is rendered from docs/THESIS.template.md by `npm run reproduce`; do not edit THESIS.md by hand.
In the template every number is a placeholder: metric (out/metrics.json), scenario (out/scenarios.json), literal definition (dates, thresholds) or external figure with its source URL.
`npm test` fails if THESIS.md contains any other digit or differs from the rendering. Syntax: see src/thesis.mjs. -->
# Thesis: Chain Signatures works, but its demand is narrow — the durable signal is bridges

## The claim

**Chain Signatures is production-grade (≈6.4M<sup>[1]</sup> signature requests since August 2024, ≈99.9%<sup>[2]</sup> fulfilled), but demand is narrow: a handful of integrations generate nearly all usage, the 2026 boom came mostly from one consumer integration (FastAuth logins of the Sweat app, a product that ends "in its present form" on 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/))), and over the whole period the single largest destination of signatures is NEAR itself. The durable long-term signal is the bridge connectors (Omni, Bitcoin, Zcash): smaller, but they now carry most of the remaining non-test demand and most of the cross-chain signing.**

This is a measurement-based thesis about NEAR's MPC signer `v1.signer`, not a price prediction. "Request" = one executed `sign` receipt on `v1.signer` (definitions: docs/METHODOLOGY.md). All request numbers are **estimates** from a cluster sample scaled to exact monthly transaction counts; intervals are 95% sampling intervals only.

## Key numbers

* Requests since the contract went live: ≈6.4M<sup>[1]</sup> (interval 6.42M–6.45M<sup>[1]</sup>), out of 13,015,559<sup>[3]</sup> transactions that touch `v1.signer` (exact count; one request normally needs a user-side and a node-side transaction).
* Reliability: ≈99.9%<sup>[2]</sup> of requests end with a successful signature callback.
* Concentration over the whole period: the three largest requesters hold ≈74%<sup>[4]</sup> of requests; only 7<sup>[5]</sup> requesters ever reach a share of at least one percent. In October 2026: three largest ≈78%<sup>[6]</sup>, requesters with at least one percent: 7<sup>[7]</sup>.
* The boom: requests went from ≈301k<sup>[8]</sup> in March 2026 to ≈721k<sup>[9]</sup> in April 2026 and peaked at ≈897k<sup>[10]</sup> in May 2026. `fast-auth.near` went from 0<sup>[11]</sup> to ≈346k<sup>[12]</sup> in the same month and reached ≈564k<sup>[13]</sup> in May; by October 2026 it was down to ≈161k<sup>[14]</sup>.
* Who sends FastAuth traffic: ≈99.97%<sup>[15]</sup> of `fast-auth.near` requests are relayed by `sweat-relayer.near`, and the on-chain FastAuth guard maps the issuer `https://fastauth.swe.at` (the Sweat Foundation's domain) to `sweat.jwt.fast-auth.near`. Over the whole period `fast-auth.near` is ≈44%<sup>[16]</sup> of all requests.
* A suspected benchmark account (`tx-bench.near`, unconfirmed) is ≈19%<sup>[17]</sup> of all requests; without it the total is ≈5.2M<sup>[18]</sup>.
* Destination of signatures (evidence-backed rules only): NEAR itself ≈46%<sup>[19]</sup>, other chains ≈31%<sup>[20]</sup>, unknown ≈23%<sup>[21]</sup> over the whole period. In October 2026: NEAR ≈40%<sup>[22]</sup>, other chains ≈53%<sup>[23]</sup>.
* Bridges (`omni.bridge.near`, `btc-connector.bridge.near`, `zcash-connector.bridge.near`): ≈1.2M<sup>[24]</sup> requests in total; ≈72k<sup>[25]</sup> in June 2026 and ≈237k<sup>[26]</sup> in October 2026 (interval 207k–264k<sup>[26]</sup>), out of ≈267k<sup>[27]</sup> "structural" requests that month (all minus the suspected benchmark minus `fast-auth.near`).
* Attribution: requesters with an identified role account for ≈79%<sup>[28]</sup> of requests (labels.yaml, every label with evidence URLs).
* Independent re-check: a seeded sample of 50 of 50 transactions ([source](https://github.com/takeshityt/signer-census/blob/main/docs/evidence/verify/verify-2026-11-11-seed20261112-n50.txt)) matched both an archival RPC node and NearBlocks (`npm run verify -- --sample 50`).

## Evidence for

* **Production-grade:** ≈99.9%<sup>[2]</sup> fulfilled across the period; the unit reconciliation windows (`docs/evidence/gate1`, `docs/evidence/step4`) show every sampled request completing with a callback. Failed node answers are late duplicates, not lost signatures.
* **Narrow demand:** the three largest requesters hold ≈74%<sup>[4]</sup>; only 7<sup>[5]</sup> requesters ever exceed one percent; the long tail of small requesters is a few percent of volume.
* **One integration drove the boom:** the April jump and the May peak are mostly `fast-auth.near`, whose traffic is almost entirely relayed for the Sweat app (see above), and the Sweat Foundation announced that Sweat Wallet and SWEAT "in their present form will end on" 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/)).
* **NEAR-centric usage:** FastAuth derives keys for NEAR accounts, which is why NEAR itself is the largest destination over the period (≈46%<sup>[19]</sup>).
* **Bridges are the structural part:** bridge requests grew from ≈72k<sup>[25]</sup> (June 2026) to ≈237k<sup>[26]</sup> (October 2026); in October 2026 they are ≈237k<sup>[26]</sup> of ≈267k<sup>[27]</sup> structural requests, and other chains already lead NEAR as a destination that month.

## Evidence against (and why the claim could be too pessimistic or too optimistic)

* The headline volume includes a suspected benchmark (≈19%<sup>[17]</sup> of requests). It is labeled "unknown, suspected benchmark" because no source names it; if it is real usage, demand is less narrow than stated.
* The Sweat link to FastAuth is strong on-chain (issuer domain, guard name, relayer) but no document says that Sweat Wallet logins go through `fast-auth.near`; and "ends in its present form" does not mean the traffic goes to zero.
* Bridges are only ≈1.2M<sup>[24]</sup> of ≈6.4M<sup>[1]</sup> requests over the whole period; one quarter of strong growth is not a trend.
* Volume is not value: a bridge request can move large value and a login signature none; this census counts signatures, not value or fees.
* Most of the volume is recent (see the monthly series in out/metrics.json), so the history behind the trend is short and month-to-month swings are large.

## What would prove this thesis wrong

Each test can be checked after the stated date by re-running this repository (`npm run monthly`, `npm run sample`, `npm run parse`, `npm run reproduce`) and reading the named fields in out/metrics.json.

* **Narrow demand is wrong if** in each month from January 2027 to March 2027 at least 15 requesters hold a share of at least 1% (`months[].concentration.requesters_ge_1pct`) **and** the three largest requesters hold less than 50% (`months[].concentration.top3_share`). Today: 7<sup>[7]</sup> and ≈78%<sup>[6]</sup>.
* **"The boom was one integration being wound down" is wrong if** `fast-auth.near` requests in both February 2027 and March 2027 are at least 75% of its October 2026 level of ≈161k<sup>[14]</sup> (`months[].drivers_requests`).
* **"Bridges are the durable signal" is wrong if** bridge requests (`months[].series_requests_est.bridges`) are below 100k in every month from January 2027 to March 2027 (today ≈237k<sup>[26]</sup>), or if they fall below 50% of structural requests in each of those months.
* **"Cross-chain use is taking over" is wrong if** the other-chains share (`months[].target_groups_share.other_chains`) is below 40% in every month from January 2027 to March 2027 (today ≈53%<sup>[23]</sup>).
* **"Production-grade" is wrong if** the fulfilled rate (`months[].fulfilled_rate`) is below 99% in any month from January 2027 to March 2027 (today ≈100.0%<sup>[29]</sup>).

## Scenarios (not forecasts)

From assumptions.yaml (editable) and the last full month (2026-10<sup>[30]</sup>, ≈447k<sup>[31]</sup> requests: ≈161k<sup>[32]</sup> `fast-auth.near`, ≈19k<sup>[33]</sup> suspected benchmark, ≈267k<sup>[34]</sup> structural):

* If FastAuth traffic stops after the Sweat end date, the benchmark is removed and structural demand stays flat, monthly requests in 2027-06<sup>[35]</sup> are ≈267k<sup>[36]</sup> (-40%<sup>[37]</sup> vs the baseline).
* Same, with structural demand shrinking by five percent a month: ≈177k<sup>[38]</sup>; growing by five percent a month: ≈394k<sup>[39]</sup>.
* If FastAuth traffic is fully retained, the benchmark kept and structural demand grows by five percent a month: ≈575k<sup>[40]</sup>.
* All combinations are in out/scenarios.json; change assumptions.yaml and run `npm run reproduce` to see others.

## What this census cannot measure

* The destination chain of each request from the Omni bridge and the Relay allocator (they sign for several chains; the chain is not in the sign arguments): reported as "multi".
* Whether `tx-bench.near` is a benchmark; who operates it.
* Value moved, fees paid or any revenue to NEAR or the NEAR token: the census counts signature requests only.
* End users: one request is not one user, and FastAuth users cannot be counted from this data.
* Other MPC signer contracts (for example `v1.sig-net.near`), testnet, and activity after the data snapshot.
* Private source code (Dew kernels, Near-Bridge-Lab contracts): their path conventions are not decoded.

## Comparison with the existing dashboard

The Dune dashboard `proximity_team/v1signer` shows 6,914,449 "total transactions" on 21 September 2026 ([source](https://dune.com/proximity_team/v1signer)). Its SQL is not visible and the values were read from the public page, not verified in Dune, so its unit is unknown. On the same date our exact count of all transactions touching `v1.signer` (from the dashboard's start date) is 11,451,646<sup>[41]</sup> and their figure is 1.22<sup>[42]</sup> times our estimated request count; early in the series it matched our all-transaction count instead. No single unit of ours reproduces their series (docs/evidence/reconcile-proximity.md). They also publish a TVL metric that this census does not measure.

## Methodology in short

Exact monthly transaction counts for `v1.signer` come from the FastNEAR transaction API; a seeded cluster sample of transaction details gives the share of `sign` receipts, requesters, statuses and target hints per month; requests = exact monthly count times the sampled ratio, with cluster-bootstrap intervals. Requesters are labeled only with evidence; target chains only through evidence-backed rules; everything else is reported as unknown. Robustness checks (fully read months, reconciliation windows, density weighting, ≈-0.0%<sup>[43]</sup> change in the total) are in docs/METHODOLOGY.md.


---

### Where every number comes from

All numbers above are generated by `npm run reproduce` from committed data (this file is rendered from docs/THESIS.template.md). Footnotes give the JSON path:

1. `out/metrics.json` → `totals.requests_est`
2. `out/metrics.json` → `totals.fulfilled_rate`
3. `out/metrics.json` → `totals.tx_total`
4. `out/metrics.json` → `totals.concentration.top3_share`
5. `out/metrics.json` → `totals.concentration.requesters_ge_1pct`
6. `out/metrics.json` → `months[2026-10].concentration.top3_share`
7. `out/metrics.json` → `months[2026-10].concentration.requesters_ge_1pct`
8. `out/metrics.json` → `months[2026-03].requests_est`
9. `out/metrics.json` → `months[2026-04].requests_est`
10. `out/metrics.json` → `months[2026-05].requests_est`
11. `out/metrics.json` → `months[2026-03].drivers_requests."fast-auth.near"`
12. `out/metrics.json` → `months[2026-04].drivers_requests."fast-auth.near"`
13. `out/metrics.json` → `months[2026-05].drivers_requests."fast-auth.near"`
14. `out/metrics.json` → `months[2026-10].drivers_requests."fast-auth.near"`
15. `out/metrics.json` → `totals.relayer_share_of_requester."fast-auth.near via sweat-relayer.near"`
16. `out/metrics.json` → `totals.top_requesters[requester=fast-auth.near].share_of_requests`
17. `out/metrics.json` → `totals.top_requesters[requester=tx-bench.near].share_of_requests`
18. `out/metrics.json` → `totals.series_requests_est.excluding_benchmark`
19. `out/metrics.json` → `totals.target_groups_share.near_native`
20. `out/metrics.json` → `totals.target_groups_share.other_chains`
21. `out/metrics.json` → `totals.target_groups_share.unknown`
22. `out/metrics.json` → `months[2026-10].target_groups_share.near_native`
23. `out/metrics.json` → `months[2026-10].target_groups_share.other_chains`
24. `out/metrics.json` → `totals.series_requests_est.bridges`
25. `out/metrics.json` → `months[2026-06].series_requests_est.bridges`
26. `out/metrics.json` → `months[2026-10].series_requests_est.bridges`
27. `out/metrics.json` → `months[2026-10].series_requests_est.structural`
28. `out/metrics.json` → `totals.labeling_coverage.identified_share_of_requests`
29. `out/metrics.json` → `months[2026-10].fulfilled_rate`
30. `out/scenarios.json` → `baseline.month`
31. `out/scenarios.json` → `baseline.all`
32. `out/scenarios.json` → `baseline.fastauth`
33. `out/scenarios.json` → `baseline.benchmark`
34. `out/scenarios.json` → `baseline.structural`
35. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g+0].end_month`
36. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g+0].end_month_total`
37. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g+0].end_month_vs_baseline`
38. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g-5].end_month_total`
39. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g+5].end_month_total`
40. `out/scenarios.json` → `scenarios[fastauth100_bench-kept_g+5].end_month_total`
41. `out/metrics.json` → `comparisons.proximity_team_v1signer.rows[2026-09-21].ours.all_txs`
42. `out/metrics.json` → `comparisons.proximity_team_v1signer.rows[2026-09-21].theirs_over_ours.sign_receipts`
43. `out/metrics.json` → `robustness.density_weighted.totals.delta_pct`
