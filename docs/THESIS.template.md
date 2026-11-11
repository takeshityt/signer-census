<!-- THESIS.md is rendered from docs/THESIS.template.md by `npm run reproduce`; do not edit THESIS.md by hand.
In the template every number is a placeholder: metric (out/metrics.json), scenario (out/scenarios.json), literal definition (dates, thresholds) or external figure with its source URL.
`npm test` fails if THESIS.md contains any other digit or differs from the rendering. Syntax: see src/thesis.mjs. -->
# Thesis: Chain Signatures works, but its demand is narrow — the durable signal is bridges

## The claim

**Chain Signatures is production-grade (≈{{m:totals.requests_est|M1}} signature requests since {{lit:August 2024}}, ≈{{m:totals.fulfilled_rate|pct1}} fulfilled), but demand is narrow: a handful of integrations generate nearly all usage, the {{lit:2026}} boom came mostly from one consumer integration (FastAuth logins of the Sweat app, a product that ends "in its present form" on {{ext:30 December 2026|https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/}}), and over the whole period the single largest destination of signatures is NEAR itself. The durable long-term signal is the bridge connectors (Omni, Bitcoin, Zcash): smaller, but they now carry most of the remaining non-test demand and most of the cross-chain signing.**

This is a measurement-based thesis about NEAR's MPC signer `v1.signer`, not a price prediction. "Request" = one executed `sign` receipt on `v1.signer` (definitions: docs/METHODOLOGY.md). All request numbers are **estimates** from a cluster sample scaled to exact monthly transaction counts; intervals are {{lit:95%}} sampling intervals only.

## Key numbers

* Requests since the contract went live: ≈{{m:totals.requests_est|M1}} (interval {{m:totals.requests_est|ci_M2}}), out of {{m:totals.tx_total|int}} transactions that touch `v1.signer` (exact count; one request normally needs a user-side and a node-side transaction).
* Reliability: ≈{{m:totals.fulfilled_rate|pct1}} of requests end with a successful signature callback.
* Concentration over the whole period: the three largest requesters hold ≈{{m:totals.concentration.top3_share|pct0}} of requests; only {{m:totals.concentration.requesters_ge_1pct|raw}} requesters ever reach a share of at least one percent. In {{lit:October 2026}}: three largest ≈{{m:months[2026-10].concentration.top3_share|pct0}}, requesters with at least one percent: {{m:months[2026-10].concentration.requesters_ge_1pct|raw}}.
* The boom: requests went from ≈{{m:months[2026-03].requests_est|k0}} in {{lit:March 2026}} to ≈{{m:months[2026-04].requests_est|k0}} in {{lit:April 2026}} and peaked at ≈{{m:months[2026-05].requests_est|k0}} in {{lit:May 2026}}. `fast-auth.near` went from {{m:months[2026-03].drivers_requests."fast-auth.near"|int}} to ≈{{m:months[2026-04].drivers_requests."fast-auth.near"|k0}} in the same month and reached ≈{{m:months[2026-05].drivers_requests."fast-auth.near"|k0}} in May; by {{lit:October 2026}} it was down to ≈{{m:months[2026-10].drivers_requests."fast-auth.near"|k0}}.
* Who sends FastAuth traffic: ≈{{m:totals.relayer_share_of_requester."fast-auth.near via sweat-relayer.near"|pct2}} of `fast-auth.near` requests are relayed by `sweat-relayer.near`, and the on-chain FastAuth guard maps the issuer `https://fastauth.swe.at` (the Sweat Foundation's domain) to `sweat.jwt.fast-auth.near`. Over the whole period `fast-auth.near` is ≈{{m:totals.top_requesters[requester=fast-auth.near].share_of_requests|pct0}} of all requests.
* A suspected benchmark account (`tx-bench.near`, unconfirmed) is ≈{{m:totals.top_requesters[requester=tx-bench.near].share_of_requests|pct0}} of all requests; without it the total is ≈{{m:totals.series_requests_est.excluding_benchmark|M1}}.
* Destination of signatures (evidence-backed rules only): NEAR itself ≈{{m:totals.target_groups_share.near_native|pct0}}, other chains ≈{{m:totals.target_groups_share.other_chains|pct0}}, unknown ≈{{m:totals.target_groups_share.unknown|pct0}} over the whole period. In {{lit:October 2026}}: NEAR ≈{{m:months[2026-10].target_groups_share.near_native|pct0}}, other chains ≈{{m:months[2026-10].target_groups_share.other_chains|pct0}}.
* Bridges (`omni.bridge.near`, `btc-connector.bridge.near`, `zcash-connector.bridge.near`): ≈{{m:totals.series_requests_est.bridges|M1}} requests in total; ≈{{m:months[2026-06].series_requests_est.bridges|k0}} in {{lit:June 2026}} and ≈{{m:months[2026-10].series_requests_est.bridges|k0}} in {{lit:October 2026}} (interval {{m:months[2026-10].series_requests_est.bridges|ci_k0}}), out of ≈{{m:months[2026-10].series_requests_est.structural|k0}} "structural" requests that month (all minus the suspected benchmark minus `fast-auth.near`).
* Attribution: requesters with an identified role account for ≈{{m:totals.labeling_coverage.identified_share_of_requests|pct0}} of requests (labels.yaml, every label with evidence URLs).
* Independent re-check: a seeded sample of {{ext:50 of 50 transactions|https://github.com/takeshityt/signer-census/blob/main/docs/evidence/verify/verify-2026-11-11-seed20261112-n50.txt}} matched both an archival RPC node and NearBlocks (`npm run verify -- --sample 50`).

## Evidence for

* **Production-grade:** ≈{{m:totals.fulfilled_rate|pct1}} fulfilled across the period; the unit reconciliation windows (`docs/evidence/gate1`, `docs/evidence/step4`) show every sampled request completing with a callback. Failed node answers are late duplicates, not lost signatures.
* **Narrow demand:** the three largest requesters hold ≈{{m:totals.concentration.top3_share|pct0}}; only {{m:totals.concentration.requesters_ge_1pct|raw}} requesters ever exceed one percent; the long tail of small requesters is a few percent of volume.
* **One integration drove the boom:** the April jump and the May peak are mostly `fast-auth.near`, whose traffic is almost entirely relayed for the Sweat app (see above), and the Sweat Foundation announced that Sweat Wallet and SWEAT "in their present form will end on" {{ext:30 December 2026|https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/}}.
* **NEAR-centric usage:** FastAuth derives keys for NEAR accounts, which is why NEAR itself is the largest destination over the period (≈{{m:totals.target_groups_share.near_native|pct0}}).
* **Bridges are the structural part:** bridge requests grew from ≈{{m:months[2026-06].series_requests_est.bridges|k0}} ({{lit:June 2026}}) to ≈{{m:months[2026-10].series_requests_est.bridges|k0}} ({{lit:October 2026}}); in {{lit:October 2026}} they are ≈{{m:months[2026-10].series_requests_est.bridges|k0}} of ≈{{m:months[2026-10].series_requests_est.structural|k0}} structural requests, and other chains already lead NEAR as a destination that month.

## Evidence against (and why the claim could be too pessimistic or too optimistic)

* The headline volume includes a suspected benchmark (≈{{m:totals.top_requesters[requester=tx-bench.near].share_of_requests|pct0}} of requests). It is labeled "unknown, suspected benchmark" because no source names it; if it is real usage, demand is less narrow than stated.
* The Sweat link to FastAuth is strong on-chain (issuer domain, guard name, relayer) but no document says that Sweat Wallet logins go through `fast-auth.near`; and "ends in its present form" does not mean the traffic goes to zero.
* Bridges are only ≈{{m:totals.series_requests_est.bridges|M1}} of ≈{{m:totals.requests_est|M1}} requests over the whole period; one quarter of strong growth is not a trend.
* Volume is not value: a bridge request can move large value and a login signature none; this census counts signatures, not value or fees.
* Most of the volume is recent (see the monthly series in out/metrics.json), so the history behind the trend is short and month-to-month swings are large.

## What would prove this thesis wrong

Each test can be checked after the stated date by re-running this repository (`npm run monthly`, `npm run sample`, `npm run parse`, `npm run reproduce`) and reading the named fields in out/metrics.json.

* **Narrow demand is wrong if** in each month from {{lit:January 2027}} to {{lit:March 2027}} at least {{lit:15}} requesters hold a share of at least {{lit:1%}} (`months[].concentration.requesters_ge_1pct`) **and** the three largest requesters hold less than {{lit:50%}} (`months[].concentration.top3_share`). Today: {{m:months[2026-10].concentration.requesters_ge_1pct|raw}} and ≈{{m:months[2026-10].concentration.top3_share|pct0}}.
* **"The boom was one integration being wound down" is wrong if** `fast-auth.near` requests in both {{lit:February 2027}} and {{lit:March 2027}} are at least {{lit:75%}} of its {{lit:October 2026}} level of ≈{{m:months[2026-10].drivers_requests."fast-auth.near"|k0}} (`months[].drivers_requests`).
* **"Bridges are the durable signal" is wrong if** bridge requests (`months[].series_requests_est.bridges`) are below {{lit:100k}} in every month from {{lit:January 2027}} to {{lit:March 2027}} (today ≈{{m:months[2026-10].series_requests_est.bridges|k0}}), or if they fall below {{lit:50%}} of structural requests in each of those months.
* **"Cross-chain use is taking over" is wrong if** the other-chains share (`months[].target_groups_share.other_chains`) is below {{lit:40%}} in every month from {{lit:January 2027}} to {{lit:March 2027}} (today ≈{{m:months[2026-10].target_groups_share.other_chains|pct0}}).
* **"Production-grade" is wrong if** the fulfilled rate (`months[].fulfilled_rate`) is below {{lit:99%}} in any month from {{lit:January 2027}} to {{lit:March 2027}} (today ≈{{m:months[2026-10].fulfilled_rate|pct1}}).

## Scenarios (not forecasts)

From assumptions.yaml (editable) and the last full month ({{s:baseline.month|raw}}, ≈{{s:baseline.all|k0}} requests: ≈{{s:baseline.fastauth|k0}} `fast-auth.near`, ≈{{s:baseline.benchmark|k0}} suspected benchmark, ≈{{s:baseline.structural|k0}} structural):

* If FastAuth traffic stops after the Sweat end date, the benchmark is removed and structural demand stays flat, monthly requests in {{s:scenarios[fastauth0_bench-removed_g+0].end_month|raw}} are ≈{{s:scenarios[fastauth0_bench-removed_g+0].end_month_total|k0}} ({{s:scenarios[fastauth0_bench-removed_g+0].end_month_vs_baseline|pct0}} vs the baseline).
* Same, with structural demand shrinking by five percent a month: ≈{{s:scenarios[fastauth0_bench-removed_g-5].end_month_total|k0}}; growing by five percent a month: ≈{{s:scenarios[fastauth0_bench-removed_g+5].end_month_total|k0}}.
* If FastAuth traffic is fully retained, the benchmark kept and structural demand grows by five percent a month: ≈{{s:scenarios[fastauth100_bench-kept_g+5].end_month_total|k0}}.
* All combinations are in out/scenarios.json; change assumptions.yaml and run `npm run reproduce` to see others.

## What this census cannot measure

* The destination chain of each request from the Omni bridge and the Relay allocator (they sign for several chains; the chain is not in the sign arguments): reported as "multi".
* Whether `tx-bench.near` is a benchmark; who operates it.
* Value moved, fees paid or any revenue to NEAR or the NEAR token: the census counts signature requests only.
* End users: one request is not one user, and FastAuth users cannot be counted from this data.
* Other MPC signer contracts (for example `v1.sig-net.near`), testnet, and activity after the data snapshot.
* Private source code (Dew kernels, Near-Bridge-Lab contracts): their path conventions are not decoded.

## Comparison with the existing dashboard

The Dune dashboard `proximity_team/v1signer` shows {{ext:6,914,449 "total transactions" on 21 September 2026|https://dune.com/proximity_team/v1signer}}. Its SQL is not visible and the values were read from the public page, not verified in Dune, so its unit is unknown. On the same date our exact count of all transactions touching `v1.signer` (from the dashboard's start date) is {{m:comparisons.proximity_team_v1signer.rows[2026-09-21].ours.all_txs|int}} and their figure is {{m:comparisons.proximity_team_v1signer.rows[2026-09-21].theirs_over_ours.sign_receipts|r2}} times our estimated request count; early in the series it matched our all-transaction count instead. No single unit of ours reproduces their series (docs/evidence/reconcile-proximity.md). They also publish a TVL metric that this census does not measure.

## Methodology in short

Exact monthly transaction counts for `v1.signer` come from the FastNEAR transaction API; a seeded cluster sample of transaction details gives the share of `sign` receipts, requesters, statuses and target hints per month; requests = exact monthly count times the sampled ratio, with cluster-bootstrap intervals. Requesters are labeled only with evidence; target chains only through evidence-backed rules; everything else is reported as unknown. Robustness checks (fully read months, reconciliation windows, density weighting, ≈{{m:robustness.density_weighted.totals.delta_pct|pct1}} change in the total) are in docs/METHODOLOGY.md.
