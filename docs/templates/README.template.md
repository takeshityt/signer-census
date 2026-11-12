<!-- README.md is rendered from docs/templates/README.template.md by `npm run reproduce`; do not edit README.md by hand.
Every number is a placeholder (metrics, scenarios, repository facts, declared literal or external figure with URL); `npm test` fails on any other digit. -->
# Signer Census

A reproducible, evidence-backed census of who uses NEAR Chain Signatures (the `v1.signer` MPC contract): how many signature requests there are, who sends them and for which chains, turned into a long-term thesis for NEAR. Read-only: no keys, no transactions, no paid services.

**Finding:** Chain Signatures works (≈{{m:totals.requests_est|M1}} signature requests since {{lit:August 2024}}, ≈{{m:totals.series_requests_est.excluding_benchmark|M1}} without a suspected benchmark account; ≈{{m:totals.fulfilled_rate|pct1}} of sampled requests end with a successful signature callback), but real demand is narrow: the {{lit:2026}} boom came mostly from one consumer integration whose product ends in its present form on {{ext:30 December 2026|https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/}}, and the largest third-party app (Relay) stopped. The signal to watch is the bridge connectors (Omni, Bitcoin, Zcash): the most persistent demand we observe, peaking in {{m:derived.bridges_peak_month.month|raw}}.

## What this means for a long-term NEAR view

{{include:docs/THESIS.template.md#What this means for a long-term NEAR view}}

## The question

Chain Signatures lets a NEAR account control addresses on other chains through NEAR's MPC network, and it is central to NEAR's chain-abstraction story. A long-term thesis that leans on it needs to know whether it is used, by whom and for what. Explorers show raw transaction counts, and the public Dune dashboard `proximity_team/v1signer` shows a cumulative total plus daily signers, error and latency charts, but it does not label who the requesters are or which chains they sign for; we found no published, re-runnable answer to "who actually uses it". This repository measures it from public chain data, labels the requesters only with evidence, and states in advance what would prove the conclusion wrong.

## Key findings

{{include:docs/THESIS.template.md#In five lines}}

The full thesis, with evidence for and against, scenarios and the falsification tests, is in [THESIS.md](THESIS.md).

## Dashboard

* Hosted: https://takeshityt.github.io/signer-census/ (not live yet: `.github/workflows/pages.yml` deploys `site/` on every push to `main` once the repository is public and the author enables GitHub Pages with source "GitHub Actions").
* Locally: `npm run build:site && npm run site`, then open `http://127.0.0.1:4173/`. The page reads only `site/data/*.json` (copies of `out/metrics.json` and `out/scenarios.json` with a `sha256` manifest); it makes no other network request.

## Quick start

Requires Node {{r:node_engines|raw}} (developed with Node {{lit:22}}). No account, API key or paid service.

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
| `npm test` | vitest ends with {{r:test_files|raw}} test files and {{r:tests|raw}} tests passed (exit code zero). Covers parsing, labels, chain rules, the estimator, the verifier, the dashboard data model, and checks that every number in README.md and THESIS.md comes from the JSON outputs. |
| `npm run reproduce` | Offline. Rebuilds `out/metrics.json`, `out/scenarios.json`, THESIS.md, README.md and the submission drafts from committed data. It prints `out/metrics.json written. sha256` followed by {{r:metrics_sha256|raw}}. Afterwards `git status` shows no changes. |
| `npm run check:data` | `data/MANIFEST.sha256` is OK with {{r:data_manifest_files|raw}} files checked. The raw-sample manifest lists {{r:raw_manifest_files|raw}} files, which are not committed (they are reported as not downloaded). |
| `npm run verify -- --sample 50` | Takes several minutes. It re-checks a seeded random sample of transactions with sign receipts against an archival RPC node and NearBlocks (signer, block height, sign receipts). Last run: {{r:verify.verified|raw}}/{{r:verify.sample|raw}} verified (archival RPC {{r:verify.rpc_ok|raw}}/{{r:verify.sample|raw}}, NearBlocks {{r:verify.nearblocks_ok|raw}}/{{r:verify.sample|raw}}); the output is in `docs/evidence/verify/`. It exits with an error on any mismatch. The default seed always picks the same transactions; add `--seed <any number>` for a different draw. It checks our parsing of sampled transactions, not the request estimate: it does not search for sign receipts we missed and does not compare the fulfilled flag. |
| `npm run build:site && npm run site`, open `http://127.0.0.1:4173/` | The hero shows ≈{{m:totals.requests_est|M1}}, which is `totals.requests_est` in `out/metrics.json`. The "Exclude the suspected benchmark" switch removes the hatched series. The scenario buttons change the projection. Checks and screenshots: `docs/evidence/dashboard/CHECKS.md`. |
| Edit `assumptions.yaml` (for example add a growth rate to `structural_monthly_growth`), then `npm run reproduce` and `npm run build:site` | `out/scenarios.json` gains the new combinations, and the dashboard shows the new option in "Structural demand per month". Undo with `git checkout assumptions.yaml && npm run reproduce && npm run build:site`. |

Refreshing the data from the chain (slow, network, optional): `npm run monthly` (exact monthly totals), `npm run sample` and `npm run parse` (the cluster sample; a full re-download, see docs/METHODOLOGY.md "Refreshing the data"), `node scripts/network-totals.mjs` (whole-network transaction counts), then `npm run reproduce`.

## How NEAR is used

* **The contract.** `v1.signer` is NEAR's MPC signer. A **request** is one executed `sign` receipt on it. It is **fulfilled** when the callback of that receipt (`return_signature_and_clean_state_on_success`, legacy `return_signature_on_finish`) succeeds. The **requester** is the `predecessor_id` of the `sign` receipt; transaction signers are often relayers, so they are not used. MPC nodes answer with separate `respond` transactions, which are never counted as requests. One request is roughly two transactions and three receipts, but that ratio moves, so it is never used as a conversion factor.
* **Exact counts.** The FastNEAR transaction API (`tx.main.fastnear.com`) gives the exact number of transactions touching `v1.signer` per block range; calendar months are resolved to block heights with the archival RPC. Total: {{m:totals.tx_total|int}} transactions.
* **Estimates.** Transaction details from {{m:meta.sample.n_clusters|raw}} seeded sample clusters ({{m:meta.sample.n_txs|int}} transaction entries; overlapping clusters can share a transaction) give the share of sign receipts, requesters, statuses and target hints per month. Requests = exact monthly transaction count × sampled ratio, with cluster-bootstrap intervals ({{lit:95%}}, sampling error only).
* **Verification.** The archival RPC (`tx_status`, `account_changes`) and NearBlocks independently re-check sampled transactions (`npm run verify`) and the counting units (`scripts/reconcile-units.mjs`, evidence in `docs/evidence/gate1`, `docs/evidence/step4`). Requester labels use on-chain facts (creation transactions, `contract_source_metadata`, `view_state`), each with an evidence URL in `labels.yaml`.

## Methodology and limits

* Definitions, sampling design, the cluster bootstrap, robustness checks and known biases: [docs/METHODOLOGY.md](docs/METHODOLOGY.md).
* Falsification tests with dates and thresholds, checkable by re-running this repository: [THESIS.md](THESIS.md), section "What would prove this thesis wrong".
* What this census cannot measure:

{{include:docs/THESIS.template.md#What this census cannot measure}}

## Comparison with the existing dashboard

{{include:docs/THESIS.template.md#Comparison with the existing dashboard}}

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
