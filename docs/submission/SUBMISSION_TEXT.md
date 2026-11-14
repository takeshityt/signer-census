<!-- Rendered from docs/templates/SUBMISSION_TEXT.template.md by `npm run reproduce`. Do not commit the final payload (it contains personal data). -->
# Submission form: draft values

Submit once, only after the author confirms the exact payload (docs/HACKATHON.md, "Submit"). Fields marked **author only** must be provided by the author; nothing here is invented for them.

| Field | Rule | Draft |
|---|---|---|
| projectName | 2–80 characters | proposal: Signer Census (author to confirm) |
| leadName | 2–80 characters | **author only** |
| email | valid, at most 2 submissions per email | **author only** |
| size | one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+`, exactly as written | `1` (solo author) |
| tracks | ids from the tracks table | proposal: `thesis` (author to confirm) |
| nearAddress | mainnet payout account created by the author | **author only** (never created or invented by the agent) |
| projectUrl | public repository URL (a hosted dashboard is a plus: https://takeshityt.github.io/signer-census/, keep it up as the hackathon rules ask) | https://github.com/takeshityt/signer-census (public) |
| demoUrl | public X post URL | **author only** (after posting, see `X_POST.md`) |
| idea | 20–2000 characters | below |
| consent | `true` only after the author agrees to the contact notice | **author only** |

## idea (description)

<!-- description:start -->
Signer Census is a reproducible, evidence-backed census of NEAR Chain Signatures usage (the v1.signer MPC contract, through which NEAR accounts sign for other chains) and a long-term thesis built on it. The problem: Chain Signatures is central to NEAR's chain-abstraction story, but we found no published, re-runnable answer to who actually uses it. The product: exact monthly transaction counts from the FastNEAR transaction API plus a seeded cluster sample of transaction details give about 6.4M signature requests since August 2024, of which an estimated 99.9% (volume-weighted) end with a successful signature callback, with sampling intervals; evidence-backed labels for the requesters; target-chain families; a hosted dashboard with a one-click re-check of a sampled transaction; scenarios (not forecasts) and dated falsification tests. The finding: demand is narrow. Three requesters make about 74% of requests, one of them a suspected benchmark. The 2026 boom was mostly one integration: FastAuth logins whose main integrator is, with medium confidence, Sweat Wallet, a product that ends in its present form on 30 December 2026 (https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/). The contract labeled Relay Protocol (medium confidence), the largest third-party requester, went silent from August 2026. Bridge connectors (Omni, Bitcoin, Zcash) are the signal to watch. For a long-term NEAR view: working infrastructure, not yet broad adoption. How NEAR fits in: every number is measured from NEAR mainnet (v1.signer receipts via FastNEAR, the archival RPC and NearBlocks). npm run reproduce rebuilds all results offline; npm run verify re-checks the parsing of sampled transactions against two public sources; a cross-check against exact per-account counts, for the two requesters where one transaction equals one request, puts 12 of 15 monthly values inside our 95% intervals (the misses are disclosed). Read-only and keyless.
<!-- description:end -->
