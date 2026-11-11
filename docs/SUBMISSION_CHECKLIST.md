# Submission checklist (NEAR HACKATHON)

Source: docs/HACKATHON.md. Re-checked against the live https://nearhackathon.com/HACKATHON.md on 2026-11-12: byte-identical (sha256 6dd0c1ff…c4868d).
Status legend: ✅ done · ⏳ in progress / planned · ❌ missing · 👤 founder's decision or action (the agent must not do it alone).

## Deadlines (UTC)

| Event | Date | Status |
|---|---|---|
| Hackathon window (code counts from the 2026-10-19 announcement, Q-001) | 2026-10-19 → 2026-11-14 | ✅ first commit 2026-11-10T21:38Z (2026-11-11 02:38 +05:00): all work is inside the window |
| Our internal submit target (CLAUDE.md) | 2026-11-13 | ⏳ |
| **Development ends = submission deadline; repo must be public** | **2026-11-14T23:59:00Z** | ❌ repo is PRIVATE now |
| Judging starts | 2026-11-16 | – |
| Results by | 2026-11-18 | keep any hosted demo up to 2026-11-18, ideally 2026-11-25 (Q-012) |

## Procedure requirements

| # | Requirement (HACKATHON.md) | Status | What is missing |
|---|---|---|---|
| 1 | Build the project with the human; final submission is the only registration | ⏳ | GATE 4 (dashboard) and GATE 5 (packaging) not done |
| 2 | Repository **public** before 2026-11-14T23:59Z | ❌ 👤 | Make public only after the founder's explicit "yes" (never by the agent alone) |
| 3 | README for humans **and machines**: what the product is, the problem, how to try it as "do X → see Y" steps, no marketing | ❌ | No README.md yet (planned GATE 5: quick start, `npm test`, `npm run reproduce` + hash, `npm run verify -- --sample 50`, dashboard check, assumptions.yaml check) |
| 4 | Demo post on X by the human: says it was built at NEAR HACKATHON, tags @NEARProtocol and #NEARHackathon, video or screenshots attached | ❌ 👤 | Video script and post draft (GATE 5); the founder records, posts and gives us the link. Screenshots alone are not enough if judges cannot open the demo (Q-012) |
| 5 | Submit **once**: POST https://nearhackathon.com/api/applications, only after the human confirms the exact JSON payload | ❌ 👤 | Payload not built; never sent without a "yes"; generate `requestId` once and reuse on retries; do not commit the payload (personal data) |
| 6 | Mistakes are fixed via https://nearhackathon.com/request-changes, never by submitting twice | – | – |

## Submission fields (all decided by the founder; the agent must not invent them)

| Field | Rule | Status |
|---|---|---|
| projectName | 2–80 chars | 👤 |
| leadName | 2–80 chars | 👤 |
| email | valid, ≤160 chars, ≤2 submissions per email | 👤 |
| size | one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` | 👤 |
| tracks | ids from the table; this project fits `thesis` (others only if the founder decides) | 👤 |
| nearAddress | mainnet payout account created by the team (named or 64-hex implicit), regex in HACKATHON.md | 👤 never created or invented by the agent |
| projectUrl | public repo URL, unique per submission | ❌ repo must be public first |
| demoUrl | public X post URL | ❌ |
| idea | 20–2000 chars: problem, product, how NEAR fits in | ⏳ draft in GATE 5 |
| consent | `true` only after the human agrees to the verbatim contact notice | 👤 |
| (no other fields; `website` is a spam trap) | | rule noted |

## Rules (Q-…)

| Rule | Status |
|---|---|
| Q-001/Q-003/Q-004 only work inside the window is judged; old projects need a separate branch/tags + a README section linking the diff | ✅ new repo, all commits from 2026-11-10/11 on; ⏳ tag `hackathon-submission` at the end (GATE 5) |
| Q-002 existing product on another chain | n/a |
| Q-005 libraries, templates and **AI-generated code must be listed in the README** | ❌ README section "Disclosure": built with Claude Code; dependencies `vitest` (dev), `yaml`; data sources FastNEAR, archival RPC, NearBlocks; research sub-agents; Dune page values read via an LLM-assisted fetch |
| Q-009 public RPC is fine | ✅ keyless FastNEAR / archival RPC / NearBlocks |
| Q-010 testnet-only eligible | n/a (read-only mainnet data, no transactions) |
| Q-011 no mandatory integrations | ✅ (the thesis track hints: on-chain data, dashboards, research) |
| Q-012 local-only demo OK with a public repo, reproducible README and a video; hosted demo is a plus | ⏳ dashboard not built (GATE 4); hosting only after the founder's "yes" |
| Q-013 team keeps rights; organizers get promo rights | – |
| Q-014 any license; **add a LICENSE file**; repo stays public through judging | ❌ add MIT LICENSE (GATE 5) |
| Q-015 one person, at most 2 different projects; each README names the other | 👤 does the founder submit another project? If yes, both READMEs must name each other |
| Q-016 payout single payment in NEAR | – |
| Q-017 Claude Code / Codex screening: reproducibility check, feature verification | ✅ `npm test`, `npm run reproduce` (offline, hash-stable), `npm run verify -- --sample 50` exist; ❌ README must describe them as "do X → see Y" |

## Never without the human's explicit confirmation (HACKATHON.md)

Send the submission · post on X · make the repo public, push or force-push · sign transactions / spend tokens / deploy to mainnet · commit secrets.
Current practice in this repo: commits are local per part; one push at the end of a GATE, approved by the founder; no keys exist anywhere; secret scans run before every push.

## Gaps to close before 2026-11-14T23:59Z (in order)

1. GATE 4 dashboard (one static page; hero number, requests by category, requesters with evidence links, chains, thesis lines, "re-run it yourself").
2. GATE 5: README.md (sections above, machine-checkable "do X → see Y"), LICENSE (MIT), AI/library disclosure, tag `hackathon-submission`, 60-second video script, X post draft, submission description draft (20–2000 chars).
3. Fresh-clone screener pass following the README literally.
4. 👤 Make the repo public, record and post the video, provide the payout account and all submission fields, confirm the exact payload, then the agent sends it once.
