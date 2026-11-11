<!-- Rendered from docs/templates/VIDEO_SCRIPT.template.md by `npm run reproduce`. Every number comes from out/metrics.json, out/scenarios.json or repository facts. -->
# Demo video script (about one minute)

Draft for the author, who records and posts the video. Record the dashboard (`npm run build:site && npm run site`, desktop width, light theme) and one terminal window. Speak slowly; the cuts follow the sections of the page from top to bottom. Each block has the English narration and a Russian translation for the author.

## 0–5 s: the headline

**On screen:** the hero; the pen-stroke line draws itself under ≈6.4M.

**Narration:** "NEAR Chain Signatures has signed about 6.4M requests since August 2024. Who actually uses it?"

**Перевод:** «Chain Signatures в NEAR подписал около 6.4M запросов с августа 2024 года. Кто на самом деле этим пользуется?»

## 5–20 s: who really uses it

**On screen:** "Requests over time", then click "Exclude the suspected benchmark"; scroll to "Who sends the requests" and stop on `fast-auth.near` with the Sweat note.

**Narration:** "Three requesters make about 74% of all requests. The April 2026 boom is mostly one integration: FastAuth logins from the Sweat Foundation's login domain, about 346k requests in its first month. Another 19% is a suspected benchmark; this switch removes it."

**Перевод:** «Три запрашивающих дают около 74% всех запросов. Бум апреля 2026 года — в основном одна интеграция: вход через FastAuth с домена Sweat Foundation, около 346k запросов в первый же месяц. Ещё 19% — подозреваемый бенчмарк; этот переключатель его убирает.»

## 20–35 s: the Sweat sunset and the bridges

**On screen:** the Sweat callout; click "stops" for FastAuth traffic, "stops" for the benchmark, "flat" for growth; then the "Bridges" chart.

**Narration:** "Sweat Wallet ends in its present form on 30 December 2026. If that traffic stops, monthly volume in 2027-06 is about 267k, -40% against October 2026: a scenario, not a forecast. What remains is structural, and most of it is bridges: about 237k of 267k structural requests in October."

**Перевод:** «Sweat Wallet в нынешнем виде заканчивается 30 декабря 2026 года. Если этот трафик прекратится, месячный объём в 2027-06 составит около 267k, -40% к октябрю 2026: это сценарий, а не прогноз. Остаётся структурный спрос, и большая его часть — мосты: около 237k из 267k структурных запросов в октябре.»

## 35–50 s: the thesis and what would prove it wrong

**On screen:** "The thesis" with the five lines, then "What would prove us wrong".

**Narration:** "Our thesis: Chain Signatures is production-grade, but demand is narrow, and bridges are the durable signal. We publish what would prove it wrong: for example, if bridge requests fall below 100k a month from January to March 2027, or if demand spreads out: at least 15 requesters with 1% or more each, and the three largest under half of all requests."

**Перевод:** «Наш тезис: Chain Signatures готов к продакшену, но спрос узкий, а устойчивый сигнал — мосты. Мы публикуем, что опровергло бы тезис: например, если запросы мостов упадут ниже 100 тыс. в месяц с января по март 2027 года, или если спрос расползётся: не меньше 15 запрашивающих с долей от 1% каждый, а три крупнейших — меньше половины всех запросов.»

## 50–60 s: re-run it yourself

**On screen:** the terminal: `npm run reproduce` (the `sha256` line), then the last line of `npm run verify -- --sample 50`; end on the repository URL.

**Narration:** "Every number re-runs from public NEAR data. npm run reproduce rebuilds it offline; npm run verify re-checks sampled transactions against two sources: 50 out of 50. Built at NEAR HACKATHON."

**Перевод:** «Каждое число пересчитывается из публичных данных NEAR. npm run reproduce пересобирает всё оффлайн; npm run verify перепроверяет выборку транзакций по двум источникам: 50 из 50. Сделано на NEAR HACKATHON.»

## Recording notes

* Run the terminal commands before recording and keep the output on screen (verify takes several minutes); show only the final lines.
* Use reduced motion off so the pen stroke draws once at the start.
* The post must say it was built at NEAR HACKATHON and tag @NEARProtocol and #NEARHackathon (draft: `docs/submission/X_POST.md`).
