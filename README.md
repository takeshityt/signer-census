<!-- README.md is rendered from docs/templates/README.template.md by `npm run reproduce`; do not edit README.md by hand.
Every number is a placeholder (metrics, scenarios, repository facts, declared literal or external figure with URL); `npm test` fails on any other digit. -->
# Signer Census

A reproducible, evidence-backed census of who uses NEAR Chain Signatures (the `v1.signer` MPC contract): how many signature requests there are, who sends them and for which chains, turned into a long-term thesis for NEAR. Read-only: no keys, no transactions, no paid services.

**Finding:** Chain Signatures works (≈6.4M<sup>[1]</sup> signature requests since August 2024, ≈99.9%<sup>[2]</sup> fulfilled), but real demand is narrow, and the 2026 boom came mostly from one consumer integration whose product ends in its present form on 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/)). The durable signal is the bridge connectors (Omni, Bitcoin, Zcash).

## The question

Chain Signatures lets a NEAR account control addresses on other chains through NEAR's MPC network, and it is central to NEAR's chain-abstraction story. A long-term thesis that leans on it needs to know whether it is used, by whom and for what. Explorers show raw transaction counts, and one public Dune dashboard shows a cumulative total without attribution; nobody had published a re-runnable answer to "who actually uses it". This repository measures it from public chain data, labels the requesters only with evidence, and states in advance what would prove the conclusion wrong.

## Key findings

* **Reliable:** ≈6.4M<sup>[1]</sup> signature requests since August 2024, ≈99.9%<sup>[2]</sup> fulfilled.
* **Narrow:** the three largest requesters hold ≈74%<sup>[3]</sup> of requests; only 7<sup>[4]</sup> ever reach a share of one percent.
* **One integration drove the boom:** `fast-auth.near` (FastAuth logins issued by the Sweat Foundation's domain) added ≈346k<sup>[5]</sup> requests in April 2026; the Sweat Wallet product ends "in its present form" on 30 December 2026 ([source](https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/)).
* **Mostly NEAR itself:** ≈46%<sup>[6]</sup> of all signatures serve NEAR accounts; in October 2026 other chains lead (≈53%<sup>[7]</sup> against ≈40%<sup>[8]</sup>).
* **Bridges are the structural signal:** ≈237k<sup>[9]</sup> of ≈267k<sup>[10]</sup> structural requests in October 2026 come from the Omni, Bitcoin and Zcash connectors.

The full thesis, with evidence for and against, scenarios and the falsification tests, is in [THESIS.md](THESIS.md).

## Dashboard

* Hosted: https://takeshityt.github.io/signer-census/ (not live yet: it needs the repository to be public and Pages to be enabled by the author).
* Locally: `npm run build:site && npm run site`, then open `http://127.0.0.1:4173/`. The page reads only `site/data/*.json` (copies of `out/metrics.json` and `out/scenarios.json` with a `sha256` manifest); it makes no other network request.

## Quick start

Requires Node >=20<sup>[11]</sup> (developed with Node 22). No account, API key or paid service.

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
| `npm test` | vitest ends with 9<sup>[12]</sup> test files and 73<sup>[13]</sup> tests passed (exit code zero). Covers parsing, labels, chain rules, the estimator, the verifier, the dashboard data model, and checks that every number in README.md and THESIS.md comes from the JSON outputs. |
| `npm run reproduce` | Offline. Rebuilds `out/metrics.json`, `out/scenarios.json`, THESIS.md, README.md and the submission drafts from committed data. It prints `out/metrics.json written. sha256` followed by 99d8c870b5f3045665d9df0381b97c659de658649a0498f5658a3c11f5cda845<sup>[14]</sup>. Afterwards `git status` shows no changes. |
| `npm run check:data` | `data/MANIFEST.sha256` is OK with 36<sup>[15]</sup> files checked. The raw-sample manifest lists 531<sup>[16]</sup> files, which are not committed (they are reported as not downloaded). |
| `npm run verify -- --sample 50` | Takes several minutes. It re-checks a seeded random sample of transactions with sign receipts against an archival RPC node and NearBlocks. Last run: 50<sup>[17]</sup>/50<sup>[18]</sup> verified (archival RPC 50<sup>[19]</sup>/50<sup>[18]</sup>, NearBlocks 50<sup>[20]</sup>/50<sup>[18]</sup>); the output is in `docs/evidence/verify/`. It exits with an error on any mismatch. |
| `npm run build:site && npm run site`, open `http://127.0.0.1:4173/` | The hero shows ≈6.4M<sup>[1]</sup>, which is `totals.requests_est` in `out/metrics.json`. The "Exclude the suspected benchmark" switch removes the hatched series. The scenario buttons change the projection. Checks and screenshots: `docs/evidence/dashboard/CHECKS.md`. |
| Edit `assumptions.yaml` (for example add a growth rate to `structural_monthly_growth`), then `npm run reproduce` and `npm run build:site` | `out/scenarios.json` gains the new combinations, and the dashboard shows the new option in "Structural demand per month". Undo with `git checkout assumptions.yaml && npm run reproduce && npm run build:site`. |

Refreshing the data from the chain (slow, network, optional): `npm run monthly` (exact monthly totals), `npm run sample` and `npm run parse` (the cluster sample), then `npm run reproduce`.

## How NEAR is used

* **The contract.** `v1.signer` is NEAR's MPC signer. A **request** is one executed `sign` receipt on it. It is **fulfilled** when the callback of that receipt (`return_signature_and_clean_state_on_success`, legacy `return_signature_on_finish`) succeeds. The **requester** is the `predecessor_id` of the `sign` receipt; transaction signers are often relayers, so they are not used. MPC nodes answer with separate `respond` transactions, which are never counted as requests. One request is roughly two transactions and three receipts, but that ratio moves, so it is never used as a conversion factor.
* **Exact counts.** The FastNEAR transaction API (`tx.main.fastnear.com`) gives the exact number of transactions touching `v1.signer` per block range; calendar months are resolved to block heights with the archival RPC. Total: 13,015,559<sup>[21]</sup> transactions.
* **Estimates.** Transaction details from 531<sup>[22]</sup> seeded sample clusters (105,534<sup>[23]</sup> transaction entries; overlapping clusters can share a transaction) give the share of sign receipts, requesters, statuses and target hints per month. Requests = exact monthly transaction count × sampled ratio, with cluster-bootstrap intervals (95%, sampling error only).
* **Verification.** The archival RPC (`tx_status`, `account_changes`) and NearBlocks independently re-check sampled transactions (`npm run verify`) and the counting units (`scripts/reconcile-units.mjs`, evidence in `docs/evidence/gate1`, `docs/evidence/step4`). Requester labels use on-chain facts (creation transactions, `contract_source_metadata`, `view_state`), each with an evidence URL in `labels.yaml`.

## Methodology and limits

* Definitions, sampling design, the cluster bootstrap, robustness checks and known biases: [docs/METHODOLOGY.md](docs/METHODOLOGY.md).
* Falsification tests with dates and thresholds, checkable by re-running this repository: [THESIS.md](THESIS.md), section "What would prove this thesis wrong".
* What this census cannot measure:

* The destination chain of each request from the Omni bridge and the Relay allocator (they sign for several chains; the chain is not in the sign arguments): reported as "multi".
* Whether `tx-bench.near` is a benchmark; who operates it.
* Value moved, fees paid or any revenue to NEAR or the NEAR token: the census counts signature requests only.
* End users: one request is not one user, and FastAuth users cannot be counted from this data.
* Other MPC signer contracts (for example `v1.sig-net.near`), testnet, and activity after the data snapshot.
* Private source code (Dew kernels, Near-Bridge-Lab contracts): their path conventions are not decoded.

## Comparison with the existing dashboard

The Dune dashboard `proximity_team/v1signer` shows 6,914,449 "total transactions" on 21 September 2026 ([source](https://dune.com/proximity_team/v1signer)). Its SQL is not visible and the values were read from the public page, not verified in Dune, so its unit is unknown. On the same date our exact count of all transactions touching `v1.signer` (from the dashboard's start date) is 11,451,646<sup>[24]</sup> and their figure is 1.22<sup>[25]</sup> times our estimated request count; early in the series it matched our all-transaction count instead. No single unit of ours reproduces their series (docs/evidence/reconcile-proximity.md). They also publish a TVL metric that this census does not measure.

Details and the full comparison table: `docs/evidence/reconcile-proximity.md`.

## Disclosure

* **AI-generated code.** The code, documentation and analysis were written with Claude Code (Anthropic's Claude models, Claude Sonnet and Claude Opus). Research sub-agents inside Claude Code collected attribution evidence; every claim a label relies on was re-checked and the re-checks are written in `labels.yaml`.
* **Human role.** The author (takeshityt) set the scope and positioning, decided what may be claimed, chose the data sources, and approved every gate and every push.
* **Libraries.** vitest (MIT, tests only), yaml (ISC, parses labels and rules), Chart.js (MIT, vendored in `site/vendor/` with its license), the Bricolage Grotesque font (SIL Open Font License, via `@fontsource-variable`, vendored with its license). Everything else uses Node built-ins.
* **Data sources.** FastNEAR transaction API and RPC (including the archival node), NearBlocks API, NEAR public RPC, the public page of the `proximity_team/v1signer` Dune dashboard (values read with an LLM-assisted page fetch, not verified in Dune), the Sweat Foundation press release (Chainwire, altfins), project documentation and source repositories linked in `labels.yaml`.
* **Hackathon window.** All commits were made during NEAR HACKATHON; there is no pre-hackathon code.
* **Other projects by the same author (rule `Q-015`):** to be confirmed by the author before submission.

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

MIT, see [LICENSE](LICENSE). Third-party licenses for the vendored Chart.js and font are in `site/vendor/`.


---

### Where every number comes from

All numbers above are generated by `npm run reproduce` from committed data (this file is rendered from a template listed in config/rendered-docs.json). Footnotes give the source and path:

1. `out/metrics.json` → `totals.requests_est`
2. `out/metrics.json` → `totals.fulfilled_rate`
3. `out/metrics.json` → `totals.concentration.top3_share`
4. `out/metrics.json` → `totals.concentration.requesters_ge_1pct`
5. `out/metrics.json` → `months[2026-04].drivers_requests."fast-auth.near"`
6. `out/metrics.json` → `totals.target_groups_share.near_native`
7. `out/metrics.json` → `months[2026-10].target_groups_share.other_chains`
8. `out/metrics.json` → `months[2026-10].target_groups_share.near_native`
9. `out/metrics.json` → `months[2026-10].series_requests_est.bridges`
10. `out/metrics.json` → `months[2026-10].series_requests_est.structural`
11. `repository facts (src/repo-facts.mjs)` → `node_engines`
12. `repository facts (src/repo-facts.mjs)` → `test_files`
13. `repository facts (src/repo-facts.mjs)` → `tests`
14. `repository facts (src/repo-facts.mjs)` → `metrics_sha256`
15. `repository facts (src/repo-facts.mjs)` → `data_manifest_files`
16. `repository facts (src/repo-facts.mjs)` → `raw_manifest_files`
17. `repository facts (src/repo-facts.mjs)` → `verify.verified`
18. `repository facts (src/repo-facts.mjs)` → `verify.sample`
19. `repository facts (src/repo-facts.mjs)` → `verify.rpc_ok`
20. `repository facts (src/repo-facts.mjs)` → `verify.nearblocks_ok`
21. `out/metrics.json` → `totals.tx_total`
22. `out/metrics.json` → `meta.sample.n_clusters`
23. `out/metrics.json` → `meta.sample.n_txs`
24. `out/metrics.json` → `comparisons.proximity_team_v1signer.rows[2026-09-21].ours.all_txs`
25. `out/metrics.json` → `comparisons.proximity_team_v1signer.rows[2026-09-21].theirs_over_ours.sign_receipts`
