<!-- Rendered from docs/templates/VIDEO_SCRIPT.template.md by `npm run reproduce`. Every number comes from out/metrics.json, out/scenarios.json or repository facts. -->
# Demo video script (about one minute)

Draft for the author, who records and posts the video. Record the dashboard (`npm run build:site && npm run site`, desktop width, light theme) and one terminal window. Speak slowly; the cuts follow the sections of the page from top to bottom. Each block has the English narration and a Russian translation for the author.

## {{lit:0–5 s}}: the headline

**On screen:** the hero; the pen-stroke line draws itself under ≈{{m:totals.requests_est|M1}}.

**Narration:** "NEAR Chain Signatures has signed about {{m:totals.requests_est|M1}} requests since {{lit:August 2024}}. Who actually uses it?"

**Перевод:** «Chain Signatures в NEAR подписал около {{m:totals.requests_est|M1}} запросов с {{lit:августа 2024}} года. Кто на самом деле этим пользуется?»

## {{lit:5–20 s}}: who really uses it

**On screen:** "Requests over time", then click "Exclude the suspected benchmark"; scroll to "Who sends the requests" and stop on `fast-auth.near` with the Sweat note.

**Narration:** "Three requesters make about {{m:totals.concentration.top3_share|pct0}} of all requests. The {{lit:April 2026}} boom is mostly one integration: FastAuth logins from the Sweat Foundation's login domain, about {{m:months[2026-04].drivers_requests."fast-auth.near"|k0}} requests in its first month. Another {{m:totals.top_requesters[requester=tx-bench.near].share_of_requests|pct0}} is a suspected benchmark; this switch removes it."

**Перевод:** «Три запрашивающих дают около {{m:totals.concentration.top3_share|pct0}} всех запросов. Бум {{lit:апреля 2026}} года — в основном одна интеграция: вход через FastAuth с домена Sweat Foundation, около {{m:months[2026-04].drivers_requests."fast-auth.near"|k0}} запросов в первый же месяц. Ещё {{m:totals.top_requesters[requester=tx-bench.near].share_of_requests|pct0}} — подозреваемый бенчмарк; этот переключатель его убирает.»

## {{lit:20–35 s}}: the Sweat sunset and the bridges

**On screen:** the Sweat callout; click "stops" for FastAuth traffic, "stops" for the benchmark, "flat" for growth; then the "Bridges" chart.

**Narration:** "Sweat Wallet ends in its present form on {{lit:30 December 2026}}. If that traffic stops, monthly volume in {{s:scenarios[fastauth0_bench-removed_g+0].end_month|raw}} is about {{s:scenarios[fastauth0_bench-removed_g+0].end_month_total|k0}}, {{s:scenarios[fastauth0_bench-removed_g+0].end_month_vs_baseline|pct0}} against {{lit:October 2026}}: a scenario, not a forecast. What remains is structural, and most of it is bridges: about {{m:months[2026-10].series_requests_est.bridges|k0}} of {{m:months[2026-10].series_requests_est.structural|k0}} structural requests in {{lit:October}}."

**Перевод:** «Sweat Wallet в нынешнем виде заканчивается {{lit:30 декабря 2026}} года. Если этот трафик прекратится, месячный объём в {{s:scenarios[fastauth0_bench-removed_g+0].end_month|raw}} составит около {{s:scenarios[fastauth0_bench-removed_g+0].end_month_total|k0}}, {{s:scenarios[fastauth0_bench-removed_g+0].end_month_vs_baseline|pct0}} к {{lit:октябрю 2026}}: это сценарий, а не прогноз. Остаётся структурный спрос, и большая его часть — мосты: около {{m:months[2026-10].series_requests_est.bridges|k0}} из {{m:months[2026-10].series_requests_est.structural|k0}} структурных запросов в {{lit:октябре}}.»

## {{lit:35–50 s}}: the thesis and what would prove it wrong

**On screen:** "The thesis" with the five lines, then "What would prove us wrong".

**Narration:** "Our thesis: Chain Signatures works, but demand is narrow, the largest third-party app has left, and bridges are the signal to watch. For a long-term NEAR view that means: working infrastructure, not yet broad adoption. We publish what would prove it wrong: for example, if bridge requests fall below {{lit:150k}} in two of the months {{lit:January to March 2027}}, or if demand spreads out more than ever measured: the three largest under {{lit:60%}}, or at least {{lit:11}} requesters with {{lit:1%}} or more in a month."

**Перевод:** «Наш тезис: Chain Signatures работает, но спрос узкий, крупнейшее стороннее приложение ушло, а следить нужно за мостами. Для долгосрочного взгляда на NEAR это значит: работающая инфраструктура, но ещё не широкое распространение. Мы публикуем, что опровергло бы тезис: например, если запросы мостов упадут ниже {{lit:150 тыс.}} в двух из месяцев {{lit:январь–март 2027}} года, или если спрос станет шире, чем когда-либо: три крупнейших меньше {{lit:60%}} или не меньше {{lit:11}} запрашивающих с долей от {{lit:1%}} за месяц.»

## {{lit:50–60 s}}: re-run it yourself

**On screen:** the terminal: `npm run reproduce` (the `sha256` line), then the last line of `npm run verify -- --sample 50`; end on the repository URL.

**Narration:** "Every number re-runs from public NEAR data. npm run reproduce rebuilds it offline; npm run verify re-checks the parsing of sampled transactions against two sources: {{r:verify.verified|raw}} out of {{r:verify.sample|raw}}. Built at NEAR HACKATHON."

**Перевод:** «Каждое число пересчитывается из публичных данных NEAR. npm run reproduce пересобирает всё оффлайн; npm run verify перепроверяет разбор выборки транзакций по двум источникам: {{r:verify.verified|raw}} из {{r:verify.sample|raw}}. Сделано на NEAR HACKATHON.»

## Recording notes

* Run the terminal commands before recording and keep the output on screen (verify takes several minutes); show only the final lines.
* Use reduced motion off so the pen stroke draws once at the start.
* The post must say it was built at NEAR HACKATHON and tag @NEARProtocol and #NEARHackathon (draft: `docs/submission/X_POST.md`).
