<!-- THESIS.md is rendered from docs/THESIS.template.md by `npm run reproduce`; do not edit THESIS.md by hand.
In the template every number is a placeholder: metric (out/metrics.json), scenario (out/scenarios.json), literal definition (dates, thresholds) or external figure with its source URL.
`npm test` fails if THESIS.md contains any other digit or differs from the rendering. Syntax: see src/thesis.mjs. -->
# Thesis: Chain Signatures works, but its demand is narrow — bridges are the signal to watch

**For a long-term NEAR investor:** Chain Signatures works (≈99.9%<sup>[1]</sup> of sampled requests end with a successful signature), but three requesters make ≈74%<sup>[2]</sup> of its ≈6.4M<sup>[3]</sup> requests, so it is working infrastructure, not yet broad adoption.

## Headline

Chain Signatures works. Its demand is narrow — and its biggest user is winding down.

## The claim

**Chain Signatures works at the level we can measure (≈6.4M<sup>[3]</sup> signature requests since August 2024; ≈99.9%<sup>[1]</sup> of sampled requests end with a successful signature callback, while latency and downtime are not measured), but its demand is narrow. A handful of integrations generate nearly all usage. The 2026 boom came mostly from one consumer integration: FastAuth logins issued by the Sweat Foundation's login domain, most likely Sweat Wallet, a product that ends "in its present form" on 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/)). The largest third-party application, Relay's allocator on Aurora, has sent no requests in the sample since 2026-08<sup>[4]</sup>. The bridge connectors (Omni, Bitcoin, Zcash) are the most persistent demand we observe and now carry most of the non-test demand, but they became large only in May 2026 and fell from their 2026-09<sup>[5]</sup> peak in the following month.**

This is a measurement-based thesis about NEAR's MPC signer `v1.signer`, not a price prediction. "Request" = one executed `sign` receipt on `v1.signer` (definitions: docs/METHODOLOGY.md). All request numbers are **estimates** from a cluster sample scaled to exact monthly transaction counts; intervals are 95% intervals of sampling error only (they do not cover label errors, bursts the sample missed or the biases in docs/METHODOLOGY.md).

## In five lines

* **Works:** ≈6.4M<sup>[3]</sup> signature requests since August 2024; ≈99.9%<sup>[1]</sup> of sampled requests end with a successful signature callback (latency and downtime are not measured).
* **Narrow:** the three largest requesters hold ≈74%<sup>[2]</sup> of all requests; only 7<sup>[6]</sup> requesters hold at least one percent of all requests over the whole period (44<sup>[7]</sup> reached one percent in at least one single month).
* **One integration drove the boom:** `fast-auth.near` (FastAuth logins issued by the Sweat Foundation's domain) added ≈346k<sup>[8]</sup> requests in April 2026; the Sweat Wallet product ends "in its present form" on 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/)).
* **The largest third-party app left:** Relay's allocator (≈11%<sup>[9]</sup> of all requests, peak ≈189k<sup>[10]</sup> in 2026-04<sup>[11]</sup>) has no requests in the sample since 2026-08<sup>[4]</sup>.
* **Bridges are the signal to watch:** ≈62k<sup>[12]</sup> (May 2026), ≈72k<sup>[13]</sup>, ≈156k<sup>[14]</sup>, ≈276k<sup>[15]</sup>, a peak of ≈303k<sup>[16]</sup> (September) and ≈237k<sup>[17]</sup> (October 2026, -22%<sup>[18]</sup> from the peak), out of ≈267k<sup>[19]</sup> structural requests that month.

## What this means for a long-term NEAR view

* **What the data supports:** Chain Signatures is live production infrastructure that NEAR's own products depend on: FastAuth logins and the Near One bridges (Omni, Bitcoin, Zcash) are the main users, and the signer answers almost every request it accepts. A long-term view can treat it as working plumbing, not as a promise.
* **What it does not support:** the headline volume is not broad adoption. Over the whole period ≈44%<sup>[20]</sup> of requests came from one login integration whose main product ends in its present form, ≈19%<sup>[21]</sup> from a suspected benchmark, and the largest third-party application has stopped. "Many chain-abstraction apps are signing through NEAR" is not what we measure. Nor does the census measure value, fees or any revenue to NEAR or the NEAR token.
* **Scale against the whole network:** transactions touching `v1.signer` are ≈0.36%<sup>[22]</sup> of all NEAR transactions from 2024-08<sup>[23]</sup> to 2026-10<sup>[24]</sup> and ≈4.0%<sup>[25]</sup> in October 2026. The recent share is higher partly because the network's own count fell from ≈107.9M<sup>[26]</sup> transactions in March 2026 to ≈28.4M<sup>[27]</sup> in April 2026. Network counts are NearBlocks' daily figures; a FastNEAR block sample lands within 0.68<sup>[28]</sup>–1.35<sup>[29]</sup> times NearBlocks in every month and shows the same drop (`node scripts/network-totals.mjs`). So Chain Signatures is a small but, since April 2026, visible part of network activity; transactions are not value, and the census does not measure fees.
* **The structural signal and how to watch it:** bridge requests per month (`months[].series_requests_est.bridges` in out/metrics.json). They are the part of demand that is neither a single consumer integration nor a suspected test, and they connect NEAR to Bitcoin, Zcash and other chains through Near One's connectors. Watch them together with breadth: the number of requesters holding at least one percent in a month (`months[].concentration.requesters_ge_1pct`) and the share of the three largest (`months[].concentration.top3_share`). Refresh with `npm run monthly`, `npm run sample`, `npm run parse`, `npm run reproduce`.
* **Bull case, in measurable terms:** after FastAuth's traffic falls away, bridge requests stay at or above 150k a month through March 2027, and demand broadens beyond anything seen in a full month so far: the three largest under 60% or at least 11 requesters at one percent in a month (lowest top-three share so far ≈66%<sup>[30]</sup>, highest count so far 10<sup>[31]</sup>, both in 2025-03<sup>[32]</sup>).
* **Bear case, in measurable terms:** bridge requests fall below 150k in at least two of the months January to March 2027, and no new requester replaces FastAuth or Relay (the three largest stay above ≈66%<sup>[30]</sup> and fewer than 11 requesters reach one percent). Then Chain Signatures remains a narrow, NEAR-internal utility and should carry little weight in a long-term NEAR thesis.

## Key numbers

* Requests since the contract went live: ≈6.4M<sup>[3]</sup> (interval 6.42M–6.45M<sup>[3]</sup>), out of 13,015,559<sup>[33]</sup> transactions that touch `v1.signer` (exact count; one request normally needs a user-side and a node-side transaction).
* Reliability: ≈99.9%<sup>[1]</sup> of sampled requests end with a successful signature callback (a volume-weighted average: the lowest full month was ≈53%<sup>[34]</sup> in 2025-03<sup>[35]</sup>; since 2025-05<sup>[36]</sup> the lowest month is ≈99.8%<sup>[37]</sup>). Latency and downtime are not measured, and an outage of a few hours could fall between the sampled clusters.
* Concentration over the whole period: the three largest requesters hold ≈74%<sup>[2]</sup> of requests; only 7<sup>[6]</sup> requesters hold at least one percent of all requests of the period, while 44<sup>[7]</sup> reached one percent in at least one single month (interval 41–51<sup>[7]</sup>). In October 2026: three largest ≈78%<sup>[38]</sup>, requesters with at least one percent: 7<sup>[39]</sup>.
* The boom: requests went from ≈301k<sup>[40]</sup> in March 2026 to ≈721k<sup>[41]</sup> in April 2026 and peaked at ≈897k<sup>[42]</sup> in May 2026. `fast-auth.near` went from 0<sup>[43]</sup> to ≈346k<sup>[8]</sup> in the same month and reached ≈564k<sup>[44]</sup> in May; by October 2026 it was down to ≈161k<sup>[45]</sup>.
* Who sends FastAuth traffic: ≈99.97%<sup>[46]</sup> of `fast-auth.near` requests are relayed by `sweat-relayer.near`, and the on-chain FastAuth guard maps the issuer `https://fastauth.swe.at` (the Sweat Foundation's domain) to `sweat.jwt.fast-auth.near`. Over the whole period `fast-auth.near` is ≈44%<sup>[20]</sup> of all requests.
* A suspected benchmark account (`tx-bench.near`, unconfirmed) is ≈19%<sup>[21]</sup> of all requests; without it the total is ≈5.2M<sup>[47]</sup>.
* Relay: `7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora` (Relay's allocator on Aurora, the largest third-party requester) is ≈11%<sup>[9]</sup> of all requests; it peaked at ≈189k<sup>[10]</sup> in 2026-04<sup>[11]</sup>, made ≈4k<sup>[48]</sup> in 2026-07<sup>[49]</sup> and none in the sample since 2026-08<sup>[4]</sup> (an account below the sample's detection limit of roughly a thousand requests a month could still be active). Where its flow went is not established.
* Destination of signatures (evidence-backed rules only; the NEAR group rests mostly on one medium-confidence rule: FastAuth's EdDSA keys are NEAR keys): largest single destination NEAR itself ≈46%<sup>[50]</sup>, other chains ≈31%<sup>[51]</sup>, unknown ≈23%<sup>[52]</sup> over the whole period. In October 2026: NEAR ≈40%<sup>[53]</sup>, other chains ≈53%<sup>[54]</sup>.
* Bridges (`omni.bridge.near`, `btc-connector.bridge.near`, `zcash-connector.bridge.near`): ≈1.2M<sup>[55]</sup> requests in total; under ≈1k<sup>[56]</sup> a month until April 2026, then by month ≈62k<sup>[12]</sup> (May), ≈72k<sup>[13]</sup> (June), ≈156k<sup>[14]</sup> (July), ≈276k<sup>[15]</sup> (August), ≈303k<sup>[16]</sup> (September, the peak) and ≈237k<sup>[17]</sup> in October 2026 (interval 207k–264k<sup>[17]</sup>, -22%<sup>[18]</sup> from the peak), out of ≈267k<sup>[19]</sup> "structural" requests that month (all minus the suspected benchmark minus `fast-auth.near`).
* Attribution: requesters with an identified role account for ≈79%<sup>[57]</sup> of requests (labels.yaml, every label with evidence URLs).
* Independent re-check of the parsing: for a seeded sample of 50 of 50 transactions ([source](https://github.com/takeshityt/signer-census/blob/main/docs/evidence/verify/verify-2026-11-11-seed20261112-n50.txt)) with sign receipts, signer, block height and sign receipts matched both an archival RPC node and NearBlocks (`npm run verify -- --sample 50`; another seed: `--seed <n>`). It checks the parsing of sampled transactions, not the estimate: it does not look for sign receipts the parser missed, does not compare the fulfilled flag and does not touch the scaling to monthly totals.

## Evidence for

* **Works at the level measured:** ≈99.9%<sup>[1]</sup> of sampled requests end with a successful signature callback across the period, and every month since 2025-05<sup>[36]</sup> is at least ≈99.8%<sup>[37]</sup>; the unit reconciliation windows (`docs/evidence/gate1`, `docs/evidence/step4`) show every sampled request completing with a callback. Failed node answers are late duplicates, not lost signatures.
* **Narrow demand:** the three largest requesters hold ≈74%<sup>[2]</sup>; only 7<sup>[6]</sup> requesters hold at least one percent of all requests of the period; in no full month did more than 10<sup>[31]</sup> requesters reach one percent, and the three largest never held less than ≈66%<sup>[30]</sup> of a month.
* **One integration drove the boom:** the April jump and the May peak are mostly `fast-auth.near`, whose traffic is almost entirely relayed by `sweat-relayer.near` with the Sweat Foundation's login issuer (see above; that it is specifically Sweat Wallet is medium confidence), and the Sweat Foundation announced that Sweat Wallet and SWEAT "in their present form will end on" 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/)).
* **Third-party demand is fragile:** the largest third-party requester, Relay's allocator, went from ≈189k<sup>[10]</sup> requests in 2026-04<sup>[11]</sup> to none in the sample from 2026-08<sup>[4]</sup>.
* **Bridges are the persistent part since May:** bridge requests went ≈62k<sup>[12]</sup>, ≈72k<sup>[13]</sup>, ≈156k<sup>[14]</sup>, ≈276k<sup>[15]</sup>, ≈303k<sup>[16]</sup> and ≈237k<sup>[17]</sup> from May to October 2026; in October 2026 they are ≈237k<sup>[17]</sup> of ≈267k<sup>[19]</sup> structural requests, and other chains lead NEAR as a destination that month.

## Evidence against (and why the claim could be too pessimistic or too optimistic)

* The headline volume includes a suspected benchmark (≈19%<sup>[21]</sup> of requests). It is labeled "unknown, suspected benchmark" because no source names it; if it is real usage, demand is less narrow than stated.
* The Sweat link to FastAuth is strong on-chain (issuer domain, guard name, relayer) but no document says that Sweat Wallet logins go through `fast-auth.near`; "ends in its present form" does not mean the traffic goes to zero. The same release says Sweat Wallet supports Ethereum, BSC, Base and Arbitrum "through Chain Signatures", while we count all of `fast-auth.near` as NEAR keys (EdDSA domain, medium-confidence rule; signed payloads are not decoded). If part of it signs for EVM chains, NEAR's share as a destination is overstated.
* `fast-auth.near` was already falling before the sunset date: ≈564k<sup>[58]</sup> in 2026-05<sup>[59]</sup>, ≈161k<sup>[60]</sup> in 2026-10<sup>[61]</sup> (-22%<sup>[62]</sup> a month on average). A further drop after the sunset is not by itself proof that the sunset caused it; the test below is built to tell the two apart.
* Bridges were small until April 2026 (under ≈1k<sup>[56]</sup> a month) and fell -22%<sup>[18]</sup> from September to October 2026. "Most persistent" rests on six months of history; it is the strongest signal we observe, not a proven trend. Over the whole period they are ≈1.2M<sup>[55]</sup> of ≈6.4M<sup>[3]</sup> requests.
* Reliability is measured only as callback success in sampled clusters, as a volume-weighted average in which the suspected benchmark (always fulfilled) weighs ≈19%<sup>[21]</sup>. Early months were far lower (≈53%<sup>[34]</sup> in 2025-03<sup>[35]</sup>, mostly contract-rejected duplicate requests); latency and outages are not measured.
* Volume is not value: a bridge request can move large value and a login signature none; this census counts signatures, not value or fees.
* Most of the volume is recent (see the monthly series in out/metrics.json), so the history behind any trend is short and month-to-month swings are large.

## What would prove this thesis wrong

Each test can be checked after the stated month by refreshing the data (`npm run monthly`, `npm run sample`, `npm run parse`, `npm run reproduce`; a full re-download of the raw sample, see docs/METHODOLOGY.md "Refreshing the data") and reading the named fields in out/metrics.json. **The point estimate (`value`) decides each test;** we also report whether the whole 95% interval is on the same side, and if it is not, the result is "within sampling noise". Thresholds are set just beyond what the data has shown so far, so that each test can fail; the reason is given with each one.

* **Narrow demand is wrong if,** in at least two of the months January to March 2027, the three largest requesters hold less than 60% of requests (`months[].concentration.top3_share`) **or** at least 11 requesters hold a share of at least 1% (`months[].concentration.requesters_ge_1pct`). Why these numbers: in every full month so far the three largest held at least ≈66%<sup>[30]</sup> and at most 10<sup>[31]</sup> requesters reached one percent (2025-03<sup>[32]</sup>); either threshold means demand broader than ever measured. Today: ≈78%<sup>[38]</sup> and 7<sup>[39]</sup>.
* **"The boom was one integration that ends with Sweat Wallet in its present form" is wrong if** `fast-auth.near` requests (`months[].drivers_requests`) in both February 2027 and March 2027 are at least half of the continuation of its decline from 2026-05<sup>[59]</sup> to 2026-10<sup>[61]</sup> (`derived.fastauth_trend`), that is at least ≈30k<sup>[63]</sup> in February and ≈23k<sup>[64]</sup> in March (trend: ≈59k<sup>[65]</sup> and ≈46k<sup>[66]</sup>). Why: the decline already under way would put it near the trend line by itself; if the traffic is tied to Sweat Wallet as it exists today, the sunset should push it far below that line.
* **"Bridges are the most persistent demand" is wrong if** bridge requests (`months[].series_requests_est.bridges`) are below 150k in at least two of the months January to March 2027. Why: that is about half of the 2026-09<sup>[5]</sup> peak of ≈303k<sup>[67]</sup> (October 2026: ≈237k<sup>[17]</sup>); a fall that deep would mean the bridge growth of 2026 did not hold.
* **"Signing works at the level measured" is wrong if** the callback success rate (`months[].fulfilled_rate`) is below 99.5% in any month from January 2027 to March 2027. Why: no month since 2025-05<sup>[36]</sup> was below ≈99.8%<sup>[37]</sup> (today ≈100.0%<sup>[68]</sup>).
* Dropped test: an earlier draft also tested the share of signatures for other chains. That share rises mechanically when FastAuth traffic ends, and in October 2026 other-chain requests (≈53%<sup>[54]</sup> of requests) are almost all bridge requests (≈237k<sup>[17]</sup> of ≈447k<sup>[69]</sup>), so it would repeat the bridge test.

## Scenarios (not forecasts)

From assumptions.yaml (editable) and the last full month (2026-10<sup>[70]</sup>, ≈447k<sup>[71]</sup> requests: ≈161k<sup>[72]</sup> `fast-auth.near`, ≈19k<sup>[73]</sup> suspected benchmark, ≈267k<sup>[74]</sup> structural):

* If FastAuth traffic stops after the Sweat end date, the benchmark is removed and structural demand stays flat, monthly requests in 2027-06<sup>[75]</sup> are ≈267k<sup>[76]</sup> (-40%<sup>[77]</sup> vs the baseline).
* Same, with structural demand shrinking by five percent a month: ≈177k<sup>[78]</sup>; growing by five percent a month: ≈394k<sup>[79]</sup>.
* If FastAuth traffic is fully retained, the benchmark kept and structural demand grows by five percent a month: ≈575k<sup>[80]</sup>.
* All combinations are in out/scenarios.json; change assumptions.yaml and run `npm run reproduce` to see others.

## What this census cannot measure

* The destination chain of each request from the Omni bridge and the Relay allocator (they sign for several chains; the chain is not in the sign arguments): reported as "multi".
* Whether `tx-bench.near` is a benchmark; who operates it.
* Value moved, fees paid or any revenue to NEAR or the NEAR token: the census counts signature requests only.
* End users: one request is not one user. FastAuth paths contain a per-login subject, so the sample shows many distinct logins, but the total number of users over a month cannot be estimated from a sample of short clusters.
* Other MPC signer contracts (for example `v1.sig-net.near`), testnet, and activity after the data snapshot.
* Private source code (Dew kernels, Near-Bridge-Lab contracts): their path conventions are not decoded.

## Comparison with the existing dashboard

The Dune dashboard `proximity_team/v1signer` shows 6,914,449 "total transactions" on 21 September 2026 ([source](https://dune.com/proximity_team/v1signer)) (re-read on the public page on 2026-11-12, "updated 2mo ago"). Besides the cumulative count it has charts of daily signers, aggregate statistics, execution-status errors and transaction success rate and latency, so it covers reliability from another angle; it does not label requesters or break usage down by target chain. Its SQL is not visible, so its unit is unknown. On the same date our exact count of all transactions touching `v1.signer` (from the dashboard's start date) is 11,451,646<sup>[81]</sup> and their figure is 1.22<sup>[82]</sup> times our estimated request count; early in the series it matched our all-transaction count instead. No single unit of ours reproduces their series (docs/evidence/reconcile-proximity.md). They also publish a TVL metric that this census does not measure.

## Methodology in short

Exact monthly transaction counts for `v1.signer` come from the FastNEAR transaction API; a seeded cluster sample of transaction details gives the share of `sign` receipts, requesters, statuses and target hints per month; requests = exact monthly count times the sampled ratio, with cluster-bootstrap intervals. Requesters are labeled only with evidence; target chains only through evidence-backed rules; everything else is reported as unknown. Robustness checks (fully read months, reconciliation windows, density weighting, ≈-0.0%<sup>[83]</sup> change in the total) are in docs/METHODOLOGY.md.


---

### Where every number comes from

All numbers above are generated by `npm run reproduce` from committed data (this file is rendered from a template listed in config/rendered-docs.json). Footnotes give the source and path:

1. `out/metrics.json` → `totals.fulfilled_rate`
2. `out/metrics.json` → `totals.concentration.top3_share`
3. `out/metrics.json` → `totals.requests_est`
4. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].zero_from`
5. `out/metrics.json` → `derived.bridges_peak_month.month`
6. `out/metrics.json` → `totals.concentration.requesters_ge_1pct`
7. `out/metrics.json` → `totals.concentration.requesters_ge_1pct_any_month`
8. `out/metrics.json` → `months[2026-04].drivers_requests."fast-auth.near"`
9. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].share_of_all_requests`
10. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].peak_value`
11. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].peak_month`
12. `out/metrics.json` → `months[2026-05].series_requests_est.bridges`
13. `out/metrics.json` → `months[2026-06].series_requests_est.bridges`
14. `out/metrics.json` → `months[2026-07].series_requests_est.bridges`
15. `out/metrics.json` → `months[2026-08].series_requests_est.bridges`
16. `out/metrics.json` → `months[2026-09].series_requests_est.bridges`
17. `out/metrics.json` → `months[2026-10].series_requests_est.bridges`
18. `out/metrics.json` → `derived.bridges_last_full_vs_peak`
19. `out/metrics.json` → `months[2026-10].series_requests_est.structural`
20. `out/metrics.json` → `totals.top_requesters[requester=fast-auth.near].share_of_requests`
21. `out/metrics.json` → `totals.top_requesters[requester=tx-bench.near].share_of_requests`
22. `out/metrics.json` → `comparisons.network_scale.totals.v1signer_share_of_near_txs`
23. `out/metrics.json` → `comparisons.network_scale.from`
24. `out/metrics.json` → `comparisons.network_scale.to`
25. `out/metrics.json` → `comparisons.network_scale.months."2026-10".v1signer_share_of_near_txs`
26. `out/metrics.json` → `comparisons.network_scale.months."2026-03".near_txs_nearblocks`
27. `out/metrics.json` → `comparisons.network_scale.months."2026-04".near_txs_nearblocks`
28. `out/metrics.json` → `comparisons.network_scale.cross_check.fastnear_over_nearblocks_min`
29. `out/metrics.json` → `comparisons.network_scale.cross_check.fastnear_over_nearblocks_max`
30. `out/metrics.json` → `derived.top3_share_lowest_month.value`
31. `out/metrics.json` → `derived.requesters_ge_1pct_highest_month.value`
32. `out/metrics.json` → `derived.top3_share_lowest_month.month`
33. `out/metrics.json` → `totals.tx_total`
34. `out/metrics.json` → `derived.fulfilled_rate_lowest_month.value`
35. `out/metrics.json` → `derived.fulfilled_rate_lowest_month.month`
36. `out/metrics.json` → `derived.fulfilled_rate_lowest_month_since.since`
37. `out/metrics.json` → `derived.fulfilled_rate_lowest_month_since.value`
38. `out/metrics.json` → `months[2026-10].concentration.top3_share`
39. `out/metrics.json` → `months[2026-10].concentration.requesters_ge_1pct`
40. `out/metrics.json` → `months[2026-03].requests_est`
41. `out/metrics.json` → `months[2026-04].requests_est`
42. `out/metrics.json` → `months[2026-05].requests_est`
43. `out/metrics.json` → `months[2026-03].drivers_requests."fast-auth.near"`
44. `out/metrics.json` → `months[2026-05].drivers_requests."fast-auth.near"`
45. `out/metrics.json` → `months[2026-10].drivers_requests."fast-auth.near"`
46. `out/metrics.json` → `totals.relayer_share_of_requester."fast-auth.near via sweat-relayer.near"`
47. `out/metrics.json` → `totals.series_requests_est.excluding_benchmark`
48. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].last_active_value`
49. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].last_active_month`
50. `out/metrics.json` → `totals.target_groups_share.near_native`
51. `out/metrics.json` → `totals.target_groups_share.other_chains`
52. `out/metrics.json` → `totals.target_groups_share.unknown`
53. `out/metrics.json` → `months[2026-10].target_groups_share.near_native`
54. `out/metrics.json` → `months[2026-10].target_groups_share.other_chains`
55. `out/metrics.json` → `totals.series_requests_est.bridges`
56. `out/metrics.json` → `months[2026-04].series_requests_est.bridges`
57. `out/metrics.json` → `totals.labeling_coverage.identified_share_of_requests`
58. `out/metrics.json` → `derived.fastauth_trend.from_value`
59. `out/metrics.json` → `derived.fastauth_trend.from`
60. `out/metrics.json` → `derived.fastauth_trend.to_value`
61. `out/metrics.json` → `derived.fastauth_trend.to`
62. `out/metrics.json` → `derived.fastauth_trend.monthly_change`
63. `out/metrics.json` → `derived.fastauth_trend.half_projection."2027-02"`
64. `out/metrics.json` → `derived.fastauth_trend.half_projection."2027-03"`
65. `out/metrics.json` → `derived.fastauth_trend.projection."2027-02"`
66. `out/metrics.json` → `derived.fastauth_trend.projection."2027-03"`
67. `out/metrics.json` → `derived.bridges_peak_month.value`
68. `out/metrics.json` → `months[2026-10].fulfilled_rate`
69. `out/metrics.json` → `months[2026-10].requests_est`
70. `out/scenarios.json` → `baseline.month`
71. `out/scenarios.json` → `baseline.all`
72. `out/scenarios.json` → `baseline.fastauth`
73. `out/scenarios.json` → `baseline.benchmark`
74. `out/scenarios.json` → `baseline.structural`
75. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g+0].end_month`
76. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g+0].end_month_total`
77. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g+0].end_month_vs_baseline`
78. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g-5].end_month_total`
79. `out/scenarios.json` → `scenarios[fastauth0_bench-removed_g+5].end_month_total`
80. `out/scenarios.json` → `scenarios[fastauth100_bench-kept_g+5].end_month_total`
81. `out/metrics.json` → `comparisons.proximity_team_v1signer.rows[2026-09-21].ours.all_txs`
82. `out/metrics.json` → `comparisons.proximity_team_v1signer.rows[2026-09-21].theirs_over_ours.sign_receipts`
83. `out/metrics.json` → `robustness.density_weighted.totals.delta_pct`
