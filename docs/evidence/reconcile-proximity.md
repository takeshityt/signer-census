# Reconciliation with the proximity_team/v1signer dashboard

Their figure: **6,914,449** "total transactions" on **2026-09-21** (Dune dashboard https://dune.com/proximity_team/v1signer, widget 1915729, query 5597462, column `total_txns`).
Their series is cumulative, has 718 daily rows and starts on **2024-10-01** (first value 212).

**Provenance of their numbers.** Read from the public dashboard page on 2026-11-11 through an LLM-assisted page fetch (config/proximity_reported.json). They were **not verified against Dune**, the SQL behind the query is
**not visible**, and the dashboard shows no refresh timestamp. Treat their values as "as displayed", and their exact definition as **unknown**.

**Our side.** Command: `npm run reproduce` (section `comparisons.proximity_team_v1signer` of out/metrics.json; exact cutoff counts from `node scripts/cutoff-counts.mjs`, stored in data/derived/proximity_cutoffs.json).
Cutoffs are "through the end of the UTC day" (first block of the next day minus one), cumulative from 2024-10-01 so that both sides start on the same day. Month-end cutoffs use exact monthly totals; partial months use the exact count of the segment times that month's estimated shares.

## At their last point, 2026-09-21 (cumulative from 2024-10-01)

| unit | ours | exact or estimate | their 6,914,449 over ours |
|---|---:|---|---:|
| (a) all txs touching v1.signer | 11,451,646 | exact (FastNEAR `txs_count`) | 0.604 |
| (b) request-side txs (txs containing a `sign` receipt) | 5,664,220 | estimate | 1.221 |
| (c) MPC-node `respond` txs | 5,660,171 | estimate | 1.222 |
| (d) `sign` receipts = requests | 5,664,978 | estimate | 1.221 |
| (e) all receipts on v1.signer | 17,227,155 | estimate | 0.401 |

**Which of our units matches theirs? None, over the whole period.** At the end of the series their number is 60% of our (a) and 122% of our (b)/(d).
The closest unit at that date is (d) / (b) (22% above), but see the trend below: no single unit of ours reproduces their series.

## The gap is not constant: the series diverges over time


| through | theirs (cumulative) | ours all txs (exact) | theirs/ours all txs | ours request-side txs (est.) | theirs/ours request-side |
|---|---:|---:|---:|---:|---:|
| 2024-10-31 | 11,768 | 11,814 | 1.00 | 6,176 | 1.91 |
| 2025-03-31 | 87,012 | 91,753 | 0.95 | 43,743 | 1.99 |
| 2025-06-30 | 135,198 | 152,943 | 0.88 | 72,911 | 1.85 |
| 2025-09-30 | 435,774 | 489,431 | 0.89 | 235,888 | 1.85 |
| 2025-12-31 | 926,178 | 1,063,111 | 0.87 | 512,075 | 1.81 |
| 2026-03-31 | 1,872,779 | 2,413,244 | 0.78 | 1,172,598 | 1.60 |
| 2026-04-30 | 2,696,701 | 3,874,719 | 0.70 | 1,893,105 | 1.42 |
| 2026-06-30 | 4,585,348 | 7,262,644 | 0.63 | 3,582,935 | 1.28 |
| 2026-08-31 | 6,381,829 | 10,472,537 | 0.61 | 5,182,254 | 1.23 |
| 2026-09-14 | 6,759,434 | 11,140,068 | 0.61 | 5,510,846 | 1.23 |
| 2026-09-20 | 6,905,665 | 11,394,500 | 0.61 | 5,636,090 | 1.23 |
| 2026-09-21 | 6,914,449 | 11,451,646 | 0.60 | 5,664,220 | 1.22 |

Increments between consecutive cutoffs (theirs / our all-txs increment): 0.94 (to 2025-03), 0.79, 0.89, 0.86 (to 2025-12), 0.70 (to 2026-03), then **0.56, 0.56, 0.56, 0.54** from April 2026 on.
Versus our estimated request-side txs the increment ratio is a steady ~1.10-1.14 from April 2026 on (a stable ~12% excess, cause unknown).

## What can and cannot be said

* **Established (our data):** at the first cutoff (2024-10-31) their cumulative value (11,768) is within 0.4% of our exact count of **all** txs touching v1.signer in that month (11,814),
  i.e. early on their unit behaves like "all txs" (sign-side plus node-response txs). From 2025-03 their numbers fall progressively below our all-tx totals and, since April 2026, sit at ~56% of them.
* **Explained gap:** only partly. A ratio of ~0.5 would be expected if they counted one side of each request (request-side txs or sign receipts); their ratio vs those is ~1.2 late in the series, not 1.0,
  and ~1.9-2.0 early in the series. So their unit is not "requests" and not "all txs" throughout.
* **Unexplained:** why their share of all txs falls from ~100% (2024) to ~56% (2026), and the remaining ~22% excess over our request count at the end. We did **not** test hypotheses against their SQL (not visible).
  Candidate causes (untested, for their authors to confirm): a filter on method or receipt status, indexing coverage of the Dune NEAR tables for high-volume periods, or counting actions instead of txs.
* **Not claimed:** that either figure is "wrong". Their number may be correct for a different definition. Our definitions are in docs/METHODOLOGY.md.
