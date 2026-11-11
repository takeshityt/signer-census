# Drivers over time (part E)

All numbers: `out/metrics.json` (`months[].drivers_requests`, CI in `ci95`), command `npm run reproduce`. Estimates, not exact counts; ≈ and rounded values only in prose.
Drivers = the six requesters with the most estimated requests overall; `__other` = everything else.

## April 2026 jump: ≈ 300k to ≈ 720k requests per month (+≈ 420k)

* **fast-auth.near ≈ +346k (≈ 82% of the increase)**: FastAuth calls start in the sample in 2026-04 (none before) and reach ≈ 564k in 2026-05.
* tx-bench.near ≈ +56k (≈ 13%) and the Relay allocator on Aurora (7eda04…aurora) ≈ +41k (≈ 10%).
* 2026-05 adds ≈ +176k more: fast-auth.near ≈ +218k, btc-connector.bridge.near returns with ≈ +61k, partly offset by the Relay allocator and tx-bench.near.
* Why FastAuth started in April 2026 is **not established** (no announcement found). Its path issuer is fastauth.swe.at via sweat-relayer.near for 99.96% of sampled calls; that this is Sweat Wallet is a name-based inference (see labels.yaml).

## Decline since the 2026-05 peak (≈ 897k) and since 2026-08 (≈ 801k)

* 2026-05 → 2026-08 (≈ -96k net): the Relay allocator disappears (≈ -155k; ≈ 4k in 2026-07, 0 from 2026-08), fast-auth.near ≈ -142k, offset by omni.bridge.near ≈ +178k and btc-connector.bridge.near ≈ +36k.
* 2026-08 → 2026-10 (≈ -353k): fast-auth.near ≈ -260k (≈ 74% of the drop), tx-bench.near ≈ -72k, omni.bridge.near ≈ -51k, btc-connector ≈ -39k, partly offset by the new zcash-connector (≈ +51k, first activity 2026-09).
* 2026-10 and 2026-11 are the most recent months (2026-11 is partial, to 2026-11-11).
* Unverified, from the research notes only: a Sweat Foundation press release says Sweat Wallet "in its present form" ends on 2026-12-30. If fast-auth.near traffic is Sweat-driven this could lower it further; this is an inference, not a fact.

## Headline variants (≈, estimates)

* All requests: ≈ 6.43M (95% sampling CI ≈ 6.42M-6.45M).
* Excluding the suspected benchmark tx-bench.near (suspected, NOT confirmed): ≈ 5.21M (≈ 5.15M-5.26M). tx-bench.near is ≈ 19% of all requests (≈ 1.2M); in 2025-07..2025-12 it was ≈ 63-95% of the sampled sign receipts, in 2026-10/11 it is ≈ 4-5%.
* Requests from requesters with an identified (non-unknown) category: ≈ 79% of all requests (CI ≈ 78%-80%).

## 2025-03 rejection spike (≈ 45% of sign receipts rejected with "Signature request has already been submitted")

* Estimated rejected sign requests in 2025-03: brg.toalice.near ≈ 790, btc-connector.bridge.near ≈ 395, omni.bridge.near ≈ 30 (of ≈ 2.7k requests that month).
* In the sample brg.toalice.near had 83% (96% in 2025-03) of its sign receipts rejected and btc-connector.bridge.near 80% in 2025-03: both are bridge-style contracts whose repeated identical requests were refused while a prior identical request was still pending.
* brg.toalice.near is an unidentified contract from the Near-Bridge-Lab/btc-bridge-contract family (see labels.yaml); the 2025-03 spike is therefore a BTC-bridge retry pattern, not a general network event. The reason for the retries was not investigated.
