# Submission checklist (NEAR HACKATHON)

Source: docs/HACKATHON.md. Re-checked against the live https://nearhackathon.com/HACKATHON.md on 2026-11-13: byte-identical. Status as of 2026-11-14.
Status legend: ✅ done · ⏳ in progress / planned · ❌ missing · 👤 founder's decision or action (the agent must not do it alone).

## Deadlines (UTC)

| Event | Date | Status |
|---|---|---|
| Hackathon window (code counts from the 2026-10-19 announcement, Q-001) | 2026-10-19 → 2026-11-14 | ✅ first commit 2026-11-10T21:38Z (2026-11-11 02:38 +05:00): all work is inside the window |
| Our internal submit target (CLAUDE.md) | 2026-11-13 | missed; working to the official deadline |
| **Development ends = submission deadline; repo must be public** | **2026-11-14T23:59:00Z** | ✅ repo is public (since 2026-11-13) |
| Judging starts | 2026-11-16 | – |
| Results by | 2026-11-18 | keep any hosted demo up to 2026-11-18, ideally 2026-11-25 (Q-012) |

## Procedure requirements

| # | Requirement (HACKATHON.md) | Status | What is missing |
|---|---|---|---|
| 1 | Build the project with the human; final submission is the only registration | ✅ | GATE 0–5 done (dashboard, README, drafts) |
| 2 | Repository **public** before 2026-11-14T23:59Z | ✅ | public; hosted dashboard on GitHub Pages; CI green |
| 3 | README for humans **and machines**: what the product is, the problem, how to try it as "do X → see Y" steps, no marketing | ✅ | README.md rendered from a template; six "Do X → see Y" rows, all followed literally on a fresh clone (GATE 5 step 7); numbers tested against metrics.json |
| 4 | Demo post on X by the human: says it was built at NEAR HACKATHON, tags @NEARProtocol and #NEARHackathon, video or screenshots attached | ⏳ 👤 | Drafts ready: docs/submission/VIDEO_SCRIPT.md (EN + RU), docs/submission/X_POST.md. The founder records, posts and gives us the link. Screenshots alone are not enough if judges cannot open the demo (Q-012) |
| 5 | Submit **once**: POST https://nearhackathon.com/api/applications, only after the human confirms the exact JSON payload | ❌ 👤 | Draft values in docs/submission/SUBMISSION_TEXT.md; payload not built; never sent without a "yes"; generate `requestId` once and reuse on retries; do not commit the payload (personal data) |
| 6 | Mistakes are fixed via https://nearhackathon.com/request-changes, never by submitting twice | – | – |

## Submission fields (all decided by the founder; the agent must not invent them)

| Field | Rule | Status |
|---|---|---|
| projectName | 2–80 chars | 👤 |
| leadName | 2–80 chars | 👤 |
| email | valid, ≤160 chars, ≤2 submissions per email | 👤 |
| size | one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` | ✅ `1` (solo author), in the draft |
| tracks | ids from the table; this project fits `thesis` (others only if the founder decides) | 👤 |
| nearAddress | mainnet payout account created by the author (named or 64-hex implicit), regex in HACKATHON.md | 👤 never created or invented by the agent |
| projectUrl | public repo URL, unique per submission | ✅ https://github.com/takeshityt/signer-census |
| demoUrl | public X post URL | ❌ |
| idea | 20–2000 chars: problem, product, how NEAR fits in | ✅ draft in docs/submission/SUBMISSION_TEXT.md (length tested) |
| consent | `true` only after the human agrees to the verbatim contact notice | 👤 |
| (no other fields; `website` is a spam trap) | | rule noted |

## Rules (Q-…)

| Rule | Status |
|---|---|
| Q-001/Q-003/Q-004 only work inside the window is judged; old projects need a separate branch/tags + a README section linking the diff | ✅ new repo, all commits from 2026-11-10/11 on; README states there is no pre-hackathon code. Tag `hackathon-submission`: optional for a new repo, not created (founder decision) |
| Q-002 existing product on another chain | n/a |
| Q-005 libraries, templates and **AI-generated code must be listed in the README** | ✅ README "Disclosure": Claude Code (Claude Sonnet and Opus), human role, vitest, yaml, playwright (dev only), Geist, Geist Mono and Doto fonts, data sources |
| Q-009 public RPC is fine | ✅ keyless FastNEAR / archival RPC / NearBlocks |
| Q-010 testnet-only eligible | n/a (read-only mainnet data, no transactions) |
| Q-011 no mandatory integrations | ✅ (the thesis track hints: on-chain data, dashboards, research) |
| Q-012 local-only demo OK with a public repo, reproducible README and a video; hosted demo is a plus | ✅ hosted at https://takeshityt.github.io/signer-census/ (keep it up to 2026-11-18, ideally 2026-11-25) |
| Q-013 team keeps rights; organizers get promo rights | – |
| Q-014 any license; **add a LICENSE file**; repo stays public through judging | ✅ MIT LICENSE; keep the repo public through judging |
| Q-015 one person, at most 2 different projects; each README names the other | 👤 solo author; the README names no other project (add one only if the founder submits a second project) |
| Q-016 payout single payment in NEAR | – |
| Q-017 Claude Code / Codex screening: reproducibility check, feature verification | ✅ described in README as "Do X → see Y" and followed literally on a fresh clone |

## Never without the human's explicit confirmation (HACKATHON.md)

Send the submission · post on X · make the repo public, push or force-push · sign transactions / spend tokens / deploy to mainnet · commit secrets.
Current practice in this repo: commits are local per part; one push at the end of a GATE, approved by the founder; no keys exist anywhere; secret scans run before every push.

## Gaps to close before 2026-11-14T23:59Z (in order)

1. 👤 Record the video (docs/submission/VIDEO_SCRIPT.md, `npm run record:demo`), publish the X post (docs/submission/X_POST.md), send the link.
2. 👤 Provide the remaining author-only fields (name, email, payout account, consent), confirm the exact JSON payload; the agent sends it once.
3. 👤 Push the last local commits (approval each time).
