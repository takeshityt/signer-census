<!-- README.md is rendered from docs/templates/README.template.md by `npm run reproduce`; do not edit README.md by hand.
Every number is a placeholder (metrics, scenarios, repository facts, declared literal or external figure with URL); `npm test` fails on any other digit. -->
# Signer Census

A reproducible, evidence-backed census of who uses NEAR Chain Signatures (the `v1.signer` MPC contract): how many signature requests there are, who sends them and for which chains, turned into a long-term thesis for NEAR. Read-only: no keys, no transactions, no paid services.

**Finding:** Chain Signatures works (≈6.4M<sup>[1]</sup> signature requests since August 2024, ≈5.2M<sup>[2]</sup> without a suspected benchmark account; ≈99.9%<sup>[3]</sup> of sampled requests end with a successful signature callback), but real demand is narrow: the 2026 boom came mostly from one consumer integration whose product ends in its present form on 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/)), and the largest third-party app (Relay) stopped. The signal to watch is the bridge connectors (Omni, Bitcoin, Zcash): the most persistent demand we observe, peaking in 2026-09<sup>[4]</sup>.

## What this means for a long-term NEAR view

* **What the data supports:** Chain Signatures is live production infrastructure that NEAR's own products depend on: FastAuth logins and the Near One bridges (Omni, Bitcoin, Zcash) are the main users, and the signer answers almost every request it accepts. A long-term view can treat it as working plumbing, not as a promise.
* **What it does not support:** the headline volume is not broad adoption. Over the whole period ≈44%<sup>[5]</sup> of requests came from one login integration whose main product ends in its present form, ≈19%<sup>[6]</sup> from a suspected benchmark, and the largest third-party application has stopped. "Many chain-abstraction apps are signing through NEAR" is not what we measure. Nor does the census measure value, fees or any revenue to NEAR or the NEAR token.
* **Scale against the whole network:** transactions touching `v1.signer` are ≈0.36%<sup>[7]</sup> of all NEAR transactions from 2024-08<sup>[8]</sup> to 2026-10<sup>[9]</sup> and ≈4.0%<sup>[10]</sup> in October 2026. The recent share is higher partly because the network's own count fell from ≈107.9M<sup>[11]</sup> transactions in March 2026 to ≈28.4M<sup>[12]</sup> in April 2026. Network counts are NearBlocks' daily figures; a FastNEAR block sample lands within 0.68<sup>[13]</sup>–1.35<sup>[14]</sup> times NearBlocks in every month and shows the same drop (`node scripts/network-totals.mjs`). So Chain Signatures is a small but, since April 2026, visible part of network activity; transactions are not value, and the census does not measure fees.
* **The structural signal and how to watch it:** bridge requests per month (`months[].series_requests_est.bridges` in out/metrics.json). They are the part of demand that is neither a single consumer integration nor a suspected test, and they connect NEAR to Bitcoin, Zcash and other chains through Near One's connectors. Watch them together with breadth: the number of requesters holding at least one percent in a month (`months[].concentration.requesters_ge_1pct`) and the share of the three largest (`months[].concentration.top3_share`). Refresh with `npm run monthly`, `npm run sample`, `npm run parse`, `npm run reproduce`.
* **Bull case, in measurable terms:** after FastAuth's traffic falls away, bridge requests stay at or above 150k a month through March 2027, and demand broadens beyond anything seen in a full month so far: the three largest under 60% or at least 11 requesters at one percent in a month (lowest top-three share so far ≈66%<sup>[15]</sup>, highest count so far 10<sup>[16]</sup>, both in 2025-03<sup>[17]</sup>).
* **Bear case, in measurable terms:** bridge requests fall below 150k in at least two of the months January to March 2027, and no new requester replaces FastAuth or Relay (the three largest stay above ≈66%<sup>[15]</sup> and fewer than 11 requesters reach one percent). Then Chain Signatures remains a narrow, NEAR-internal utility and should carry little weight in a long-term NEAR thesis.

## The question

Chain Signatures lets a NEAR account control addresses on other chains through NEAR's MPC network, and it is central to NEAR's chain-abstraction story. A long-term thesis that leans on it needs to know whether it is used, by whom and for what. Explorers show raw transaction counts, and the public Dune dashboard `proximity_team/v1signer` shows a cumulative total plus daily signers, error and latency charts, but it does not label who the requesters are or which chains they sign for; we found no published, re-runnable answer to "who actually uses it". This repository measures it from public chain data, labels the requesters only with evidence, and states in advance what would prove the conclusion wrong.

## Key findings

* **Works:** ≈6.4M<sup>[1]</sup> signature requests since August 2024; ≈99.9%<sup>[3]</sup> of sampled requests end with a successful signature callback (latency and downtime are not measured).
* **Narrow:** the three largest requesters hold ≈74%<sup>[18]</sup> of all requests; only 7<sup>[19]</sup> requesters hold at least one percent of all requests over the whole period (44<sup>[20]</sup> reached one percent in at least one single month).
* **One integration drove the boom:** `fast-auth.near` (FastAuth logins issued by the Sweat Foundation's domain) added ≈346k<sup>[21]</sup> requests in April 2026; the Sweat Wallet product ends "in its present form" on 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/)).
* **The largest third-party app left:** Relay's allocator (≈11%<sup>[22]</sup> of all requests, peak ≈189k<sup>[23]</sup> in 2026-04<sup>[24]</sup>) has no requests in the sample since 2026-08<sup>[25]</sup>.
* **Bridges are the signal to watch:** ≈62k<sup>[26]</sup> (May 2026), ≈72k<sup>[27]</sup>, ≈156k<sup>[28]</sup>, ≈276k<sup>[29]</sup>, a peak of ≈303k<sup>[30]</sup> (September) and ≈237k<sup>[31]</sup> (October 2026, -22%<sup>[32]</sup> from the peak), out of ≈267k<sup>[33]</sup> structural requests that month.

The full thesis, with evidence for and against, scenarios and the falsification tests, is in [THESIS.md](THESIS.md).

## Dashboard

* Hosted: https://takeshityt.github.io/signer-census/ (not live yet: `.github/workflows/pages.yml` deploys `site/` on every push to `main` once the repository is public and the author enables GitHub Pages with source "GitHub Actions").
* Locally: `npm run build:site && npm run site`, then open `http://127.0.0.1:4173/`. The page reads only `site/data/*.json` (copies of `out/metrics.json` and `out/scenarios.json` with a `sha256` manifest); it makes no other network request.

## Quick start

Requires Node >=20<sup>[34]</sup> (developed with Node 22). No account, API key or paid service.

```bash
git clone https://github.com/takeshityt/signer-census.git
cd signer-census
npm ci
npm test
npm run reproduce
```

## Do X → see Y

All of these are keyless. Only `npm run verify` uses the network (public endpoints).

| Do | See |
|---|---|
| `npm test` | vitest ends with 10<sup>[35]</sup> test files and 87<sup>[36]</sup> tests passed (exit code zero). Covers parsing, labels, chain rules, the estimator, the verifier, the dashboard data model, and checks that every number in README.md and THESIS.md comes from the JSON outputs. |
| `npm run reproduce` | Offline. Rebuilds `out/metrics.json`, `out/scenarios.json`, THESIS.md, README.md and the submission drafts from committed data. It prints `out/metrics.json written. sha256` followed by 6e4ce7ca28a067c480c9759964aa93a6b4dac9b87b9dba492adf0a43e785fb0c<sup>[37]</sup>. Afterwards `git status` shows no changes. |
| `npm run check:data` | `data/MANIFEST.sha256` is OK with 38<sup>[38]</sup> files checked. The raw-sample manifest lists 531<sup>[39]</sup> files, which are not committed (they are reported as not downloaded). |
| `npm run verify -- --sample 50` | Takes several minutes. It re-checks a seeded random sample of transactions with sign receipts against an archival RPC node and NearBlocks (signer, block height, sign receipts). Last run: 50<sup>[40]</sup>/50<sup>[41]</sup> verified (archival RPC 50<sup>[42]</sup>/50<sup>[41]</sup>, NearBlocks 50<sup>[43]</sup>/50<sup>[41]</sup>); the output is in `docs/evidence/verify/`. It exits with an error on any mismatch. The default seed always picks the same transactions; add `--seed <any number>` for a different draw. It checks our parsing of sampled transactions, not the request estimate: it does not search for sign receipts we missed and does not compare the fulfilled flag. |
| `npm run build:site && npm run site`, open `http://127.0.0.1:4173/` | The hero shows ≈6.4M<sup>[1]</sup>, which is `totals.requests_est` in `out/metrics.json`. The "Exclude the suspected benchmark" switch removes the hatched series. The scenario buttons change the projection. Checks and screenshots: `docs/evidence/dashboard/CHECKS.md`. |
| Edit `assumptions.yaml` (for example add a growth rate to `structural_monthly_growth`), then `npm run reproduce` and `npm run build:site` | `out/scenarios.json` gains the new combinations, and the dashboard shows the new option in "Structural demand per month". Undo with `git checkout assumptions.yaml && npm run reproduce && npm run build:site`. |

Refreshing the data from the chain (slow, network, optional): `npm run monthly` (exact monthly totals), `npm run sample` and `npm run parse` (the cluster sample; a full re-download, see docs/METHODOLOGY.md "Refreshing the data"), `node scripts/network-totals.mjs` (whole-network transaction counts), then `npm run reproduce`.

## How NEAR is used

* **The contract.** `v1.signer` is NEAR's MPC signer. A **request** is one executed `sign` receipt on it. It is **fulfilled** when the callback of that receipt (`return_signature_and_clean_state_on_success`, legacy `return_signature_on_finish`) succeeds. The **requester** is the `predecessor_id` of the `sign` receipt; transaction signers are often relayers, so they are not used. MPC nodes answer with separate `respond` transactions, which are never counted as requests. One request is roughly two transactions and three receipts, but that ratio moves, so it is never used as a conversion factor.
* **Exact counts.** The FastNEAR transaction API (`tx.main.fastnear.com`) gives the exact number of transactions touching `v1.signer` per block range; calendar months are resolved to block heights with the archival RPC. Total: 13,015,559<sup>[44]</sup> transactions.
* **Estimates.** Transaction details from 531<sup>[45]</sup> seeded sample clusters (105,534<sup>[46]</sup> transaction entries; overlapping clusters can share a transaction) give the share of sign receipts, requesters, statuses and target hints per month. Requests = exact monthly transaction count × sampled ratio, with cluster-bootstrap intervals (95%, sampling error only).
* **Verification.** The archival RPC (`tx_status`, `account_changes`) and NearBlocks independently re-check sampled transactions (`npm run verify`) and the counting units (`scripts/reconcile-units.mjs`, evidence in `docs/evidence/gate1`, `docs/evidence/step4`). Requester labels use on-chain facts (creation transactions, `contract_source_metadata`, `view_state`), each with an evidence URL in `labels.yaml`.

## Methodology and limits

* Definitions, sampling design, the cluster bootstrap, robustness checks and known biases: [docs/METHODOLOGY.md](docs/METHODOLOGY.md).
* Falsification tests with dates and thresholds, checkable by re-running this repository: [THESIS.md](THESIS.md), section "What would prove this thesis wrong".
* What this census cannot measure:

* The destination chain of each request from the Omni bridge and the Relay allocator (they sign for several chains; the chain is not in the sign arguments): reported as "multi".
* Whether `tx-bench.near` is a benchmark; who operates it.
* Value moved, fees paid or any revenue to NEAR or the NEAR token: the census counts signature requests only.
* End users: one request is not one user. FastAuth paths contain a per-login subject, so the sample shows many distinct logins, but the total number of users over a month cannot be estimated from a sample of short clusters.
* Other MPC signer contracts (for example `v1.sig-net.near`), testnet, and activity after the data snapshot.
* Private source code (Dew kernels, Near-Bridge-Lab contracts): their path conventions are not decoded.

## Comparison with the existing dashboard

The Dune dashboard `proximity_team/v1signer` shows 6,914,449 "total transactions" on 21 September 2026 ([source](https://dune.com/proximity_team/v1signer)) (re-read on the public page on 2026-11-12, "updated 2mo ago"). Besides the cumulative count it has charts of daily signers, aggregate statistics, execution-status errors and transaction success rate and latency, so it covers reliability from another angle; it does not label requesters or break usage down by target chain. Its SQL is not visible, so its unit is unknown. On the same date our exact count of all transactions touching `v1.signer` (from the dashboard's start date) is 11,451,646<sup>[47]</sup> and their figure is 1.22<sup>[48]</sup> times our estimated request count; early in the series it matched our all-transaction count instead. No single unit of ours reproduces their series (docs/evidence/reconcile-proximity.md). They also publish a TVL metric that this census does not measure.

Details and the full comparison table: `docs/evidence/reconcile-proximity.md`.

## Disclosure

* **AI-generated code.** The code, documentation and analysis were written with Claude Code (Anthropic's Claude models, Claude Sonnet and Claude Opus). Research sub-agents inside Claude Code collected attribution evidence. In `labels.yaml` every claim says how it was checked; claims we re-checked say so, and claims we did not re-check are marked "not re-verified by us" or "wording not re-checked". An independent review re-checked the evidence links.
* **Human role.** The author (takeshityt) set the scope and positioning, decided what may be claimed, chose the data sources, and approved every gate and every push.
* **Libraries.** vitest (MIT, tests only), yaml (ISC, parses labels and rules), the Newsreader and Schibsted Grotesk fonts (SIL Open Font License, via `@fontsource-variable`, vendored in `site/vendor/fonts/` with their licenses). The charts are plain SVG drawn by `site/js/charts.js`, with no chart library. Everything else uses Node built-ins.
* **Data sources.** FastNEAR transaction API and RPC (including the archival node), NearBlocks API (transaction details and the daily network chart), NEAR public RPC, the public page of the `proximity_team/v1signer` Dune dashboard (values read from the rendered public page; its SQL is not visible), the Sweat Foundation press release (Chainwire, altfins), project documentation and source repositories linked in `labels.yaml`.
* **Hackathon window.** All commits were made during NEAR HACKATHON; there is no pre-hackathon code. Some groups of commits share the same second: the agent committed several finished parts with one scripted sequence of `git commit` calls (visible as separate `commit` entries in `git reflog`); each commit still holds one part.

## Repository map

| Path | What |
|---|---|
| `THESIS.md`, `docs/METHODOLOGY.md` | the thesis and the methodology |
| `out/metrics.json`, `out/scenarios.json` | all results (rebuilt by `npm run reproduce`) |
| `data/derived/` | committed inputs: exact monthly totals, the parsed sample, cutoffs; `data/MANIFEST.sha256` |
| `labels.yaml`, `config/chain_rules.yaml` | requester labels and target-chain rules, each with evidence |
| `assumptions.yaml` | scenario assumptions (editable) |
| `src/` | parser, estimator, labels, chain rules, scenarios, document renderer |
| `scripts/` | data collection (network), reproduce helpers, verify, site build and server |
| `site/` | the dashboard |
| `test/` | vitest tests and real-data fixtures |
| `docs/evidence/` | reconciliation windows, verify runs, attribution research, dashboard checks |
| `docs/templates/` | templates of README.md and the submission drafts |
| `docs/submission/` | video script, submission text and X post drafts |

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

MIT, see [LICENSE](LICENSE). Licenses of the vendored fonts are in `site/vendor/fonts/`.


---

### Where every number comes from

All numbers above are generated by `npm run reproduce` from committed data (this file is rendered from a template listed in config/rendered-docs.json). Footnotes give the source and path:

1. `out/metrics.json` → `totals.requests_est`
2. `out/metrics.json` → `totals.series_requests_est.excluding_benchmark`
3. `out/metrics.json` → `totals.fulfilled_rate`
4. `out/metrics.json` → `derived.bridges_peak_month.month`
5. `out/metrics.json` → `totals.top_requesters[requester=fast-auth.near].share_of_requests`
6. `out/metrics.json` → `totals.top_requesters[requester=tx-bench.near].share_of_requests`
7. `out/metrics.json` → `comparisons.network_scale.totals.v1signer_share_of_near_txs`
8. `out/metrics.json` → `comparisons.network_scale.from`
9. `out/metrics.json` → `comparisons.network_scale.to`
10. `out/metrics.json` → `comparisons.network_scale.months."2026-10".v1signer_share_of_near_txs`
11. `out/metrics.json` → `comparisons.network_scale.months."2026-03".near_txs_nearblocks`
12. `out/metrics.json` → `comparisons.network_scale.months."2026-04".near_txs_nearblocks`
13. `out/metrics.json` → `comparisons.network_scale.cross_check.fastnear_over_nearblocks_min`
14. `out/metrics.json` → `comparisons.network_scale.cross_check.fastnear_over_nearblocks_max`
15. `out/metrics.json` → `derived.top3_share_lowest_month.value`
16. `out/metrics.json` → `derived.requesters_ge_1pct_highest_month.value`
17. `out/metrics.json` → `derived.top3_share_lowest_month.month`
18. `out/metrics.json` → `totals.concentration.top3_share`
19. `out/metrics.json` → `totals.concentration.requesters_ge_1pct`
20. `out/metrics.json` → `totals.concentration.requesters_ge_1pct_any_month`
21. `out/metrics.json` → `months[2026-04].drivers_requests."fast-auth.near"`
22. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].share_of_all_requests`
23. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].peak_value`
24. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].peak_month`
25. `out/metrics.json` → `derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].zero_from`
26. `out/metrics.json` → `months[2026-05].series_requests_est.bridges`
27. `out/metrics.json` → `months[2026-06].series_requests_est.bridges`
28. `out/metrics.json` → `months[2026-07].series_requests_est.bridges`
29. `out/metrics.json` → `months[2026-08].series_requests_est.bridges`
30. `out/metrics.json` → `months[2026-09].series_requests_est.bridges`
31. `out/metrics.json` → `months[2026-10].series_requests_est.bridges`
32. `out/metrics.json` → `derived.bridges_last_full_vs_peak`
33. `out/metrics.json` → `months[2026-10].series_requests_est.structural`
34. `repository facts (src/repo-facts.mjs)` → `node_engines`
35. `repository facts (src/repo-facts.mjs)` → `test_files`
36. `repository facts (src/repo-facts.mjs)` → `tests`
37. `repository facts (src/repo-facts.mjs)` → `metrics_sha256`
38. `repository facts (src/repo-facts.mjs)` → `data_manifest_files`
39. `repository facts (src/repo-facts.mjs)` → `raw_manifest_files`
40. `repository facts (src/repo-facts.mjs)` → `verify.verified`
41. `repository facts (src/repo-facts.mjs)` → `verify.sample`
42. `repository facts (src/repo-facts.mjs)` → `verify.rpc_ok`
43. `repository facts (src/repo-facts.mjs)` → `verify.nearblocks_ok`
44. `out/metrics.json` → `totals.tx_total`
45. `out/metrics.json` → `meta.sample.n_clusters`
46. `out/metrics.json` → `meta.sample.n_txs`
47. `out/metrics.json` → `comparisons.proximity_team_v1signer.rows[2026-09-21].ours.all_txs`
48. `out/metrics.json` → `comparisons.proximity_team_v1signer.rows[2026-09-21].theirs_over_ours.sign_receipts`
