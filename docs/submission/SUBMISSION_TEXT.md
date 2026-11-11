<!-- Rendered from docs/templates/SUBMISSION_TEXT.template.md by `npm run reproduce`. Do not commit the final payload (it contains personal data). -->
# Submission form: draft values

Submit once, only after the author confirms the exact payload (docs/HACKATHON.md, "Submit"). Fields marked **author only** must be provided by the author; nothing here is invented for them.

| Field | Rule | Draft |
|---|---|---|
| projectName | 2–80 characters | proposal: Signer Census (author to confirm) |
| leadName | 2–80 characters | **author only** |
| email | valid, at most 2 submissions per email | **author only** |
| size | one of the listed values | **author only** |
| tracks | ids from the tracks table | proposal: `thesis` (author to confirm) |
| nearAddress | mainnet payout account created by the team | **author only** (never created or invented by the agent) |
| projectUrl | public repository URL | https://github.com/takeshityt/signer-census (after the repository is made public) |
| demoUrl | public X post URL | **author only** (after posting, see `X_POST.md`) |
| idea | 20–2000 characters | below |
| consent | `true` only after the author agrees to the contact notice | **author only** |

## idea (description)

<!-- description:start -->
Signer Census is a reproducible, evidence-backed census of NEAR Chain Signatures usage (the v1.signer MPC contract) and a long-term thesis built on it. The problem: Chain Signatures is central to NEAR's chain-abstraction story, but nobody had published who actually uses it; explorers show raw transaction counts without attribution. The product: exact monthly transaction counts from the FastNEAR transaction API plus a seeded cluster sample of transaction details give about 6.4M signature requests since August 2024 (99.9% fulfilled) with sampling intervals, evidence-backed labels for the requesters, target-chain families, a dashboard, scenarios and dated falsification tests. The finding: demand is narrow (three requesters make about 74% of requests); the 2026 boom came mostly from FastAuth logins issued by the Sweat Foundation's login domain, a product that ends in its present form on 30 December 2026 (https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/); bridge connectors (Omni, Bitcoin, Zcash) are the durable signal. How NEAR fits in: every number is measured from NEAR mainnet (v1.signer receipts via the FastNEAR transaction API, the archival RPC and NearBlocks). npm run reproduce rebuilds all results offline and npm run verify re-checks sampled transactions against two public sources. Read-only and keyless.
<!-- description:end -->
