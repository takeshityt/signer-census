# Roadmap

Ideas that are outside the hackathon scope. Nothing here is claimed as done.

## Measurement

* **Full listing instead of sampling.** Read the details of every transaction touching `v1.signer` (about a day of paced requests, tens of GB), so request counts, requester shares and target hints become exact counts instead of cluster-sample estimates. The sampling design and its intervals would then be checked against the full listing.
* **Per-request target chain for Omni and Relay.** Decode the destination chain from the parent call (`sign_transfer` arguments for `omni.bridge.near`; the withdrawal request for the Relay allocator on Aurora), so the "multi" bucket is split into real chains.
* **Other MPC request types.** Track `verify_foreign_transaction`, `request_app_private_key` (confidential key derivation) and later request types as their own series, with their own fulfilment rates.
* **Other MPC signer contracts.** Add `v1.sig-net.near` and any successor of `v1.signer`, kept as separate series.
* **Requester labels.** Extend labels below the current coverage threshold; settle the open questions in `labels.yaml` (operator of `tx-bench.near`, owner of `relay.aurora`, who "Reflect" is, whether Sweat Wallet logins are confirmed by Sweat).

## Freshness

* **Monthly auto-refresh.** A scheduled job that runs `npm run monthly`, `npm run sample`, `npm run parse`, `npm run reproduce` and `npm run verify` after each month ends and opens a pull request with the new data and the re-rendered THESIS.md and README.md (no keys needed).
* **Check the Sweat prediction after 2026-12-30.** Re-run the census for January to March 2027 and compare `fast-auth.near` with the scenarios in `out/scenarios.json` and the falsification tests in THESIS.md; publish the result whichever way it goes.

## Presentation

* Host the dashboard (GitHub Pages or another static host) once the repository is public.
* Cross-browser check of the dashboard (Safari, Firefox) and a check on a real phone.
