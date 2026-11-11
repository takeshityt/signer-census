# Signer Census — project rules (read before every task)

## What we build
A reproducible, evidence-backed census of NEAR Chain Signatures usage with a transparent methodology and a thesis: how many signature requests, who requests them, for which chains, and how it changes over time — turned into an evidence-based long-term thesis for NEAR. It acknowledges the existing proximity_team/v1signer Dune dashboard (cumulative tx counts, no labels, no chain breakdown) and never claims to be the "first public" dashboard.
Hackathon: NEAR HACKATHON. Internal submit deadline 2026-11-13. Rules: https://nearhackathon.com/HACKATHON.md (they override everything here).
Track: thesis ("Judged on the evidence, not the conviction").

## Hard rules
- Read-only product. No private keys, seed phrases, signing or transactions. Ever.
- No API keys are needed anywhere (FastNEAR, public RPC and NearBlocks are used keyless); no paid services. Never create or commit keys. `.env` stays in .gitignore; never read or print it.
- Never push, create/publish a repo, deploy, post on X or submit without my explicit "yes".
- Every number in the dashboard, THESIS.md and README must be reproducible by a command and traceable to a query or a tx hash. If it can't be verified, don't show it.
- No invented labels: every account label in labels.yaml has an evidence link.
- Smallest change that solves the task. No features outside the current GATE; ideas go to ROADMAP.md.
- Minimal dependencies; justify each new one in one line.
- Unknowns are checked with real queries/calls, never assumed. If a fact is unverified, say so.
- Tests (vitest) for core data logic: parsing, labeling, aggregation, verification.

## Data sources (keyless)
- Primary: FastNEAR tx API (`https://tx.main.fastnear.com`): exact `txs_count` per block range, tx lists, tx details.
- Verification: `https://archival-rpc.mainnet.fastnear.com` (block, tx_status, account_changes) and NearBlocks API (`/v1/txns/<hash>`).
- Not used: Dune (free plan is view-only, no API; MPP needs a wallet, which violates the no-keys rule). neardata (mainnet.neardata.xyz) works keyless for single-block lookups, including old blocks, but returned HTTP 429 under bulk block scans, so the pipeline does not depend on it.
- Client rate limit: at most 3 requests per second in total, exponential backoff on 429/5xx. FastNEAR `/v0/transactions` answers HTTP 429 to a large share of calls (about 40% during the sample download) independently of our pace, so retries are mandatory.
- FastNEAR quirks (verified): `to_tx_block_height` is inclusive; lists are newest-first unless `desc: false` is sent.

## Counting definitions (never mix these units)
- transaction (tx) ≠ receipt ≠ request. One request normally = 2 txs (user-side sign tx + MPC-node respond tx) = 3 receipts, but this is NOT a conversion ratio: it varies with failed duplicates and admin txs.
- request = an executed `sign` receipt on v1.signer.
- fulfilled = the callback found in the descendant receipts of THAT sign receipt (`return_signature_and_clean_state_on_success`, legacy `return_signature_on_finish`) succeeded. A tx can hold several sign receipts, so the callback is matched per receipt, never per tx.
- requester = `predecessor_id` of the `sign` receipt. NOT the tx `signer_id`: tx signers are relayers (e.g. omni-relayer.bridge.near, sweat-relayer.near).
- `respond` receipts are never a request count. A failed `respond` is a late duplicate answer (7/7 in docs/evidence/gate1b: each had an earlier successful respond for the same request).
- Never use an unreconciled figure as a headline: 26.4M (NearBlocks count of receipts), 6.5M (13.0M txs divided by 2), 8.8M (26.4M divided by 3), Dune 6.9M. The only request figure is the estimate in out/metrics.json (`totals.requests_est`, exact monthly tx totals × sampled sign-receipts-per-tx), always with "≈" and its interval.
- Sample-based numbers are always shown with a 95% confidence interval and never presented as exact totals.

## Working style
- Work in GATEs. Stop at the end of every GATE and report in Russian:
  1) what was done (3 lines) 2) proof: commands, queries, real output 3) what failed and why 4) risks for next GATE 5) questions.
- I'm not a developer: explain plainly in Russian. Code, comments, README, commits in English.
- Commit after every working step. Before saying "done": run it and look at the output.
- If stuck >45 min on one error: stop, explain plainly, give 2 options with your recommendation.

## Positioning
Not "nobody uses Chain Signatures". It is: "Chain Signatures is NEAR's invisible foundation — measured, with an honest section on what isn't there yet."
Our claim: "a reproducible, evidence-backed census with transparent methodology and a thesis". Compare honestly with proximity_team/v1signer (and its TVL dashboard): they have a TVL metric we do not.
