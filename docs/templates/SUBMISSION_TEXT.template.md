<!-- Rendered from docs/templates/SUBMISSION_TEXT.template.md by `npm run reproduce`. Do not commit the final payload (it contains personal data). -->
# Submission form: draft values

Submit once, only after the author confirms the exact payload (docs/HACKATHON.md, "Submit"). Fields marked **author only** must be provided by the author; nothing here is invented for them.

| Field | Rule | Draft |
|---|---|---|
| projectName | {{lit:2–80}} characters | proposal: Signer Census (author to confirm) |
| leadName | {{lit:2–80}} characters | **author only** |
| email | valid, at most {{lit:2}} submissions per email | **author only** |
| size | one of `{{lit:1}}`, `{{lit:2 - 4}}`, `{{lit:4 - 6}}`, `{{lit:6 - 8}}`, `{{lit:8+}}`, exactly as written | `{{lit:1}}` (solo author) |
| tracks | ids from the tracks table | proposal: `thesis` (author to confirm) |
| nearAddress | mainnet payout account created by the author | **author only** (never created or invented by the agent) |
| projectUrl | public repository URL (a hosted dashboard is a plus: https://takeshityt.github.io/signer-census/, keep it up as the hackathon rules ask) | https://github.com/takeshityt/signer-census (public) |
| demoUrl | public X post URL | **author only** (after posting, see `X_POST.md`) |
| idea | {{lit:20–2000}} characters | below |
| consent | `true` only after the author agrees to the contact notice | **author only** |

## idea (description)

<!-- description:start -->
Signer Census is a reproducible, evidence-backed census of NEAR Chain Signatures usage (the {{lit:v1.signer}} MPC contract) and a long-term thesis built on it. The problem: Chain Signatures is central to NEAR's chain-abstraction story, but we found no published, re-runnable answer to who actually uses it; explorers and the existing Dune dashboard show counts without labeling the requesters. The product: exact monthly transaction counts from the FastNEAR transaction API plus a seeded cluster sample of transaction details give about {{m:totals.requests_est|M1}} signature requests since {{lit:August 2024}} (an estimated {{m:totals.fulfilled_rate|pct1}} of requests, volume-weighted, end with a successful signature callback) with sampling intervals, evidence-backed labels for the requesters, target-chain families, a hosted dashboard with a one-click check of a sampled transaction, scenarios and dated falsification tests. The finding: demand is narrow (three requesters make about {{m:totals.concentration.top3_share|pct0}} of requests); the {{lit:2026}} boom came mostly from FastAuth logins issued by the Sweat Foundation's login domain, a product that ends in its present form on {{ext:30 December 2026|https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/}}; Relay's allocator contract, the largest third-party app, went silent; bridge connectors (Omni, Bitcoin, Zcash) are the signal to watch. For a long-term NEAR view: working infrastructure, not yet broad adoption. How NEAR fits in: every number is measured from NEAR mainnet ({{lit:v1.signer}} receipts via the FastNEAR transaction API, the archival RPC and NearBlocks). npm run reproduce rebuilds all results offline and npm run verify re-checks the parsing of sampled transactions against two public sources. Read-only and keyless.
<!-- description:end -->
