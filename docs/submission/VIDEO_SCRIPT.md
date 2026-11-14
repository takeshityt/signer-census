<!-- Rendered from docs/templates/VIDEO_SCRIPT.template.md by `npm run reproduce`. Every number comes from out/metrics.json, out/scenarios.json or repository facts. -->
# Demo video script (60–75 seconds)

Draft for the author, who records and posts the video. Record the live dashboard at https://takeshityt.github.io/signer-census/ in a 1280×720 browser window, dark theme, motion on (macOS "Reduce motion" off). Eight shots, one narration line each; the page is scrolled from top to bottom. Speak calmly, about two words per second.

Rules kept in the wording: observed estimates (up to October 2026) and scenarios (later months) are never mixed; the 74% "top three" includes one suspected benchmark, not three products; "reproduce" and "verify" are different checks.

## Shot list and narration

### 1 · 0:00–0:08 · Hero

* **On screen:** the hero: two-tone headline, the dot-matrix month columns settling in, the `fast-auth.near` case card, the counters.
* **Action:** wait on load until the counters stop flipping.
* **Narration:** "Who uses NEAR Chain Signatures? About 6.4M requests since August 2024; 99.9% of sampled requests succeed."

### 2 · 0:08–0:16 · "Demand is narrow"

* **On screen:** chapter "Demand is narrow": the square matrix and its legend.
* **Action:** scroll past "It works" to "Demand is narrow"; hover the legend rows FastAuth logins, Suspected benchmark, Relay Protocol in turn.
* **Narration:** "Three requesters make 74%: FastAuth logins 44%, a suspected benchmark 19%, and Relay Protocol 11%."

### 3 · 0:16–0:25 · The boom, steps 1 and 2

* **On screen:** "The boom" scroll scene: step 1 "FastAuth logins arrive" (coral bars rise), then step 2 "Relay goes quiet" (Relay split out).
* **Action:** scroll slowly; the chart stays in place while the steps pass.
* **Narration:** "FastAuth's login domain is associated with the Sweat Foundation, medium confidence. Relay went quiet from August 2026."

### 4 · 0:25–0:33 · The boom, step 3

* **On screen:** step 3 "Sweat Wallet ends in present form"; the translucent scenario bars appear after the end date.
* **Action:** stop on step 3.
* **Narration:** "Sweat Foundation's release says: “Sweat Wallet and SWEAT in their present form will end on 30 December 2026.”"

### 5 · 0:33–0:40 · "Bridges remain" and "Where signatures go"

* **On screen:** "Bridges remain" (layered green bars and the three numbers), then the "Where signatures go" tile with the crossover.
* **Action:** scroll through both tiles without stopping.
* **Narration:** "Bridges remain: October 2026, an estimated 237k of 267k structural requests."

### 6 · 0:40–0:48 · Scenario presets

* **On screen:** "Your scenario, live".
* **Action:** click the preset "Optimistic", then "Cautious"; the big number rolls to the Cautious value.
* **Narration:** "If FastAuth stops, June 2027 is about 267k a month: a scenario, not a forecast."

### 7 · 0:48–0:58 · "What would prove us wrong"

* **On screen:** the countdown and the 4 case files with their "now vs threshold" gauges.
* **Action:** scroll to the chapter and hold while the cards deal in.
* **Narration:** "Thesis: Chain Signatures works. Its demand is narrow — and its biggest user is winding down. 4 conditions, set in advance, get checked 1 April 2027."

### 8 · 0:58–1:10 · Verify button and Re-run commands

* **On screen:** "Verify it yourself": the log types, the rows fill, the badge stamps VERIFIED ON-CHAIN; then the "Re-run it yourself" command cards.
* **Action:** click "Check a random transaction"; when the badge appears, scroll to the Re-run commands and end on the repository link.
* **Narration:** "Reproduce: anyone rebuilds every number offline from committed data. Verify: sampled transactions re-checked on an archival node and NearBlocks; checks the parsing, not the estimate."

## Recording notes

* The Verify click needs the network; if the node does not answer, the page says so: re-record that shot or cut it.
* Sources to have at hand: the Sweat release is The Sweat Foundation Ltd (release of 2026-10-01), https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/. The last `npm run verify` run: 50/50 sampled transactions verified.
* The post must say it was built at NEAR HACKATHON and tag @NEARProtocol and #NEARHackathon (draft: `docs/submission/X_POST.md`).

## Russian translation of the narration (for the founder, not for the video)

1. «Кто пользуется Chain Signatures в NEAR? Около 6.4M запросов с августа 2024 года; 99.9% запросов в выборке завершаются успешно.»

2. «Три запрашивающих дают 74%: вход через FastAuth — 44%, подозреваемый бенчмарк — 19% и Relay Protocol — 11%.»

3. «Домен входа FastAuth связан с Sweat Foundation — со средней уверенностью. Relay Protocol затих с августа 2026 года.»

4. «В релизе Sweat Foundation сказано: Sweat Wallet и SWEAT в нынешнем виде прекратят работу 30 декабря 2026 года.»

5. «Остаются мосты: за октябрь 2026 года по оценке около 237k из 267k структурных запросов.»

6. «Если трафик FastAuth прекратится, на июнь 2027 года выходит около 267k в месяц. Это сценарий, а не прогноз.»

7. «Наш тезис: Chain Signatures работает. Его спрос узкий — а крупнейший пользователь сворачивается. 4 условия, заданные заранее, проверяются 1 апреля 2027 года.»

8. «Любой может воспроизвести каждое число оффлайн из закоммиченных данных. Verify перепроверяет выборку транзакций на архивном узле и в NearBlocks; это проверка разбора, а не оценки.»
