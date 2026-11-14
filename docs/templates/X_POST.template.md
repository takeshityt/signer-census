<!-- Rendered from docs/templates/X_POST.template.md by `npm run reproduce`. Draft only: the author publishes it. -->
# X post draft (do not publish without the author)

Attach the demo video (`VIDEO_SCRIPT.md`). The post must say it was built at NEAR HACKATHON and tag @NEARProtocol and #NEARHackathon; @NearLegion and @NearBuilders are optional. Length is counted the way X counts it: each link is {{lit:23}}, "≈" is {{lit:2}}; the tests keep every post within {{lit:280}}.

## Single post (with the video)

<!-- post:start -->
Who uses NEAR accounts to sign on other chains?

Chain Signatures ({{lit:v1.signer}} MPC contract): ≈{{m:totals.requests_est|M1}} requests; {{lit:3}} requesters make {{m:totals.concentration.top3_share|pct0}}, one a suspected benchmark.

Built at NEAR HACKATHON @NEARProtocol #NEARHackathon
takeshityt.github.io/signer-census
github.com/takeshityt/signer-census
What did we miss?
<!-- post:end -->

## Thread version (post {{lit:1}} with the video, post {{lit:2}} as a reply)

<!-- thread1:start -->
Who uses NEAR accounts to sign on other chains?

Chain Signatures: NEAR accounts sign via the {{lit:v1.signer}} MPC contract. ≈{{m:totals.requests_est|M1}} requests: {{lit:3}} requesters make {{m:totals.concentration.top3_share|pct0}}, one a suspected benchmark. The boom was mostly one integration.

Built at NEAR HACKATHON @NEARProtocol #NEARHackathon
<!-- thread1:end -->

<!-- thread2:start -->
Live dashboard: takeshityt.github.io/signer-census
Code and method: github.com/takeshityt/signer-census

Every number rebuilds offline from committed data, and {{r:predictions_count|word}} conditions that would prove us wrong are set in advance. What did we miss?

@NearLegion @NearBuilders
<!-- thread2:end -->
