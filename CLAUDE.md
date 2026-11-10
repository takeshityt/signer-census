# Signer Census — project rules (read before every task)

## What we build
The first public, re-runnable census of NEAR Chain Signatures usage: how many signature requests, who requests them, for which chains, and how it changes over time — turned into an evidence-based long-term thesis for NEAR.
Hackathon: NEAR HACKATHON. Internal submit deadline 2026-11-13. Rules: https://nearhackathon.com/HACKATHON.md (they override everything here).
Track: thesis ("Judged on the evidence, not the conviction").

## Hard rules
- Read-only product. No private keys, seed phrases, signing or transactions. Ever.
- Secrets (DUNE_API_KEY) only in .env, which is in .gitignore before the first commit; .env.example provided. Never read or print .env.
- Never push, create/publish a repo, deploy, post on X or submit without my explicit "yes".
- Every number in the dashboard, THESIS.md and README must be reproducible by a command and traceable to a query or a tx hash. If it can't be verified, don't show it.
- No invented labels: every account label in labels.yaml has an evidence link.
- Smallest change that solves the task. No features outside the current GATE; ideas go to ROADMAP.md.
- Minimal dependencies; justify each new one in one line.
- Unknowns are checked with real queries/calls, never assumed. If a fact is unverified, say so.
- Tests (vitest) for core data logic: parsing, labeling, aggregation, verification.

## Working style
- Work in GATEs. Stop at the end of every GATE and report in Russian:
  1) what was done (3 lines) 2) proof: commands, queries, real output 3) what failed and why 4) risks for next GATE 5) questions.
- I'm not a developer: explain plainly in Russian. Code, comments, README, commits in English.
- Commit after every working step. Before saying "done": run it and look at the output.
- If stuck >45 min on one error: stop, explain plainly, give 2 options with your recommendation.

## Positioning
Not "nobody uses Chain Signatures". It is: "Chain Signatures is NEAR's invisible foundation — measured, with an honest section on what isn't there yet."
