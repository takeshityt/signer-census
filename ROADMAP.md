# Roadmap

Ideas that are outside the hackathon scope. Nothing here is claimed as done.

## Measurement

* **Full listing instead of sampling.** Read the details of every transaction touching `v1.signer` (about a day of paced requests, tens of GB), so request counts, requester shares and target hints become exact counts instead of cluster-sample estimates. The sampling design and its intervals would then be checked against the full listing.
* **Per-request target chain for Omni and Relay.** Decode the destination chain from the parent call (`sign_transfer` arguments for `omni.bridge.near`; the withdrawal request for the Relay allocator on Aurora), so the "multi" bucket is split into real chains.
* **Other MPC request types.** Track `verify_foreign_transaction`, `request_app_private_key` (confidential key derivation) and later request types as their own series, with their own fulfilment rates.
* **Other MPC signer contracts.** Add `v1.sig-net.near` and any successor of `v1.signer`, kept as separate series.
* **Requester labels.** Extend labels below the current coverage threshold; settle the open questions in `labels.yaml` (operator of `tx-bench.near`, owner of `relay.aurora`, who "Reflect" is, whether Sweat Wallet logins are confirmed by Sweat).

## Verification

* **Check your own transaction.** A field on the Verify panel where anyone pastes a transaction hash and sees how Signer Census parses it: whether a `sign` receipt on `v1.signer` is found, the requester (the predecessor of that sign receipt), the destination chain by our rules in `config/chain_rules.yaml`, and whether the callback succeeded. Fetched live from the archival RPC and NearBlocks, keyless, like the existing button.
  * Why it is not the proof: the random sample stays the proof of the parsing, because we do not choose which transactions get checked. A transaction picked by the user is a convenience for skeptics, not evidence about the estimate.
  * Caveat shown in the UI: a transaction outside the sample is parsed the same way, but asking whether it is "in the estimate" is not meaningful; the estimate is a ratio measured on a cluster sample and scaled to exact monthly counts.
* **Independent cross-check with Dune.** Recompute monthly sign requests and top requesters from Dune's NEAR tables and compare with our estimates and their 95% intervals. Not done in the hackathon: the Dune API is paid and MPP payments need wallet signing, which this project does not do. A manual run of public Dune queries in the browser would be a first step.

## Freshness

* **Monthly auto-refresh.** A scheduled job that runs `npm run monthly`, `npm run sample`, `npm run parse`, `npm run reproduce` and `npm run verify` after each month ends and opens a pull request with the new data and the re-rendered THESIS.md and README.md (no keys needed).
* **Check the Sweat prediction after 2026-12-30.** Re-run the census for January to March 2027 and compare `fast-auth.near` with the scenarios in `out/scenarios.json` and the falsification tests in THESIS.md; publish the result whichever way it goes.

## Presentation

* **Real-device check on Android.** The live dashboard was checked by hand on one iPhone (iOS Safari, 2026-11-14); Android Chrome on a physical phone is not checked yet. Automated checks use emulated 390 px widths in Chromium, WebKit and Firefox.
