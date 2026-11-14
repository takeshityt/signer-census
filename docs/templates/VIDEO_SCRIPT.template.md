<!-- Rendered from docs/templates/VIDEO_SCRIPT.template.md by `npm run reproduce`. Every number comes from out/metrics.json, out/scenarios.json or repository facts. -->
# Demo video script ({{lit:60–75}} seconds)

Draft for the author, who records and posts the video. Record the live dashboard at https://takeshityt.github.io/signer-census/ in a {{lit:1280×720}} browser window, dark theme, motion on (macOS "Reduce motion" off). Eight shots, one narration line each; the page is scrolled from top to bottom. Speak calmly, about two words per second.

Rules kept in the wording: observed estimates (up to {{s:baseline.month|month}}) and scenarios (later months) are never mixed; the {{m:totals.concentration.top3_share|pct0}} "top three" includes one suspected benchmark, not three products; "reproduce" and "verify" are different checks.

## Shot list and narration

### {{lit:1}} · {{lit:0:00–0:08}} · Hero

* **On screen:** the hero: two-tone headline, the dot-matrix month columns settling in, the `fast-auth.near` case card, the counters.
* **Action:** wait on load until the counters stop flipping.
* **Narration:** "Who uses NEAR Chain Signatures? About {{m:totals.requests_est|M1}} requests since {{lit:August 2024}}; {{m:totals.fulfilled_rate|pct1}} of sampled requests succeed."

### {{lit:2}} · {{lit:0:08–0:16}} · "Demand is narrow"

* **On screen:** chapter "Demand is narrow": the square matrix and its legend.
* **Action:** scroll past "It works" to "Demand is narrow"; hover the legend rows FastAuth logins, Suspected benchmark, Relay Protocol in turn.
* **Narration:** "Three requesters make {{m:totals.concentration.top3_share|pct0}}: FastAuth logins {{m:totals.top_requesters[requester=fast-auth.near].share_of_requests|pct0}}, a suspected benchmark {{m:totals.top_requesters[requester=tx-bench.near].share_of_requests|pct0}}, and Relay Protocol {{m:totals.top_requesters[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].share_of_requests|pct0}}."

### {{lit:3}} · {{lit:0:16–0:25}} · The boom, steps {{lit:1}} and {{lit:2}}

* **On screen:** "The boom" scroll scene: step {{lit:1}} "FastAuth logins arrive" (coral bars rise), then step {{lit:2}} "Relay goes quiet" (Relay split out).
* **Action:** scroll slowly; the chart stays in place while the steps pass.
* **Narration:** "FastAuth's login domain is associated with the Sweat Foundation, medium confidence. Relay went quiet from {{m:derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].zero_from|month}}."

### {{lit:4}} · {{lit:0:25–0:33}} · The boom, step {{lit:3}}

* **On screen:** step {{lit:3}} "Sweat Wallet ends in present form"; the translucent scenario bars appear after the end date.
* **Action:** stop on step {{lit:3}}.
* **Narration:** "Sweat Foundation's release says: “{{s:event.statement|raw}}”"

### {{lit:5}} · {{lit:0:33–0:40}} · "Bridges remain" and "Where signatures go"

* **On screen:** "Bridges remain" (layered green bars and the three numbers), then the "Where signatures go" tile with the crossover.
* **Action:** scroll through both tiles without stopping.
* **Narration:** "Bridges remain: {{s:baseline.month|month}}, an estimated {{m:months[2026-10].series_requests_est.bridges|k0}} of {{m:months[2026-10].series_requests_est.structural|k0}} structural requests."

### {{lit:6}} · {{lit:0:40–0:48}} · Scenario presets

* **On screen:** "Your scenario, live".
* **Action:** click the preset "Optimistic", then "Cautious"; the big number rolls to the Cautious value.
* **Narration:** "If FastAuth stops, {{s:scenarios[fastauth0_bench-removed_g+0].end_month|month}} is about {{s:scenarios[fastauth0_bench-removed_g+0].end_month_total|k0}} a month: a scenario, not a forecast."

### {{lit:7}} · {{lit:0:48–0:58}} · "What would prove us wrong"

* **On screen:** the countdown and the {{r:predictions_count|raw}} case files with their "now vs threshold" gauges.
* **Action:** scroll to the chapter and hold while the cards deal in.
* **Narration:** "Thesis: {{include:docs/THESIS.template.md#Headline}} {{r:predictions_count|raw}} conditions, set in advance, get checked {{r:predictions_check_after|day}}."

### {{lit:8}} · {{lit:0:58–1:10}} · Verify button and Re-run commands

* **On screen:** "Verify it yourself": the log types, the rows fill, the badge stamps VERIFIED ON-CHAIN; then the "Re-run it yourself" command cards.
* **Action:** click "Check a random transaction"; when the badge appears, scroll to the Re-run commands and end on the repository link.
* **Narration:** "Reproduce: anyone rebuilds every number offline from committed data. Verify: sampled transactions re-checked on an archival node and NearBlocks; checks the parsing, not the estimate."

## Recording notes

* The Verify click needs the network; if the node does not answer, the page says so: re-record that shot or cut it.
* Sources to have at hand: the Sweat release is {{s:event.issuer|raw}}, {{s:event.source|raw}}. The last `npm run verify` run: {{r:verify.verified|raw}}/{{r:verify.sample|raw}} sampled transactions verified.
* The post must say it was built at NEAR HACKATHON and tag @NEARProtocol and #NEARHackathon (draft: `docs/submission/X_POST.md`).

## Russian translation of the narration (for the founder, not for the video)

{{lit:1}}. «Кто пользуется Chain Signatures в NEAR? Около {{m:totals.requests_est|M1}} запросов с {{lit:августа 2024}} года; {{m:totals.fulfilled_rate|pct1}} запросов в выборке завершаются успешно.»

{{lit:2}}. «Три запрашивающих дают {{m:totals.concentration.top3_share|pct0}}: вход через FastAuth — {{m:totals.top_requesters[requester=fast-auth.near].share_of_requests|pct0}}, подозреваемый бенчмарк — {{m:totals.top_requesters[requester=tx-bench.near].share_of_requests|pct0}} и Relay Protocol — {{m:totals.top_requesters[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].share_of_requests|pct0}}.»

{{lit:3}}. «Домен входа FastAuth связан с Sweat Foundation — со средней уверенностью. Relay Protocol затих с {{m:derived.exits[requester=7eda04920f22ba6a2b9f2573fd9a6f6f1946ff9f.aurora].zero_from|month_ru_gen}} года.»

{{lit:4}}. «В релизе Sweat Foundation сказано: Sweat Wallet и SWEAT в нынешнем виде прекратят работу {{s:event.date|day_ru}} года.»

{{lit:5}}. «Остаются мосты: за {{s:baseline.month|month_ru}} года по оценке около {{m:months[2026-10].series_requests_est.bridges|k0}} из {{m:months[2026-10].series_requests_est.structural|k0}} структурных запросов.»

{{lit:6}}. «Если трафик FastAuth прекратится, на {{s:scenarios[fastauth0_bench-removed_g+0].end_month|month_ru}} года выходит около {{s:scenarios[fastauth0_bench-removed_g+0].end_month_total|k0}} в месяц. Это сценарий, а не прогноз.»

{{lit:7}}. «Наш тезис: Chain Signatures работает. Его спрос узкий — а крупнейший пользователь сворачивается. {{r:predictions_count|raw}} условия, заданные заранее, проверяются {{r:predictions_check_after|day_ru}} года.»

{{lit:8}}. «Любой может воспроизвести каждое число оффлайн из закоммиченных данных. Verify перепроверяет выборку транзакций на архивном узле и в NearBlocks; это проверка разбора, а не оценки.»
