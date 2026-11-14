<!-- Rendered from docs/templates/VIDEO_SCRIPT.template.md by `npm run reproduce`. Every number comes from out/metrics.json, out/scenarios.json or repository facts. -->
# Demo video script (60–75 seconds)

Draft for the author, who records and posts the video. Record the live dashboard at https://takeshityt.github.io/signer-census/ in a 1280×720 browser window, dark theme, motion on (macOS "Reduce motion" off). Eight shots, one narration line each; the page is scrolled from top to bottom. Speak calmly, about two words per second. Each shot has a short on-screen caption to add in the editor (CapCut).

Rules kept in the wording: observed estimates (up to October 2026) and scenarios (later months) are never mixed; the 74% "top three" includes one suspected benchmark, not three products; "reproduce" and "verify" are different checks.

## Shot list and narration

### 1 · 0:00–0:08 · Hero

* **On screen:** the hero: two-tone headline, the dot-matrix month columns settling in, the `fast-auth.near` case card, the counters.
* **Action:** wait on load until the counters stop flipping.
* **On-screen caption:** "NEAR Chain Signatures · ≈6.4M requests · 99.9% fulfilled"
* **Narration:** "NEAR Chain Signatures, since August 2024: about 6.4 million requests; 99.9% succeed in our sample."

### 2 · 0:08–0:16 · "Demand is narrow"

* **On screen:** chapter "Demand is narrow": the square matrix and its legend.
* **Action:** scroll past "It works" to "Demand is narrow"; hover the legend rows FastAuth logins, Suspected benchmark, Relay Protocol in turn.
* **On-screen caption:** "Top 3 = 74% · one is a suspected benchmark"
* **Narration:** "Top three: 74%. FastAuth 44%, suspected benchmark 19%, Relay Protocol 11%."

### 3 · 0:16–0:25 · The boom, steps 1 and 2

* **On screen:** "The boom" scroll scene: step 1 "FastAuth logins arrive" (coral bars rise), then step 2 "Relay goes quiet" (Relay split out).
* **Action:** scroll slowly; the chart stays in place while the steps pass.
* **On-screen caption:** "Boom = FastAuth · main user Sweat Wallet (medium confidence)"
* **Narration:** "The boom was FastAuth logins. Its main user: Sweat Wallet, medium confidence. Relay: quiet since August 2026."

### 4 · 0:25–0:33 · The boom, step 3

* **On screen:** step 3 "Sweat Wallet ends in present form"; the translucent scenario bars appear after the end date.
* **Action:** stop on step 3.
* **On-screen caption:** “Sweat Wallet and SWEAT in their present form will end on 30 December 2026.” (exact quote; source: The Sweat Foundation Ltd (release of 2026-10-01))
* **Narration:** "Sweat Foundation says Sweat Wallet ends in its present form on 30 December 2026."

### 5 · 0:33–0:40 · "Bridges remain" and "Where signatures go"

* **On screen:** "Bridges remain" (layered green bars and the three numbers), then the "Where signatures go" tile with the crossover.
* **Action:** scroll through both tiles without stopping.
* **On-screen caption:** "Bridges ≈237k in October 2026"
* **Narration:** "Bridges remain: about 237 thousand requests in October 2026 — most of the demand left without FastAuth and the benchmark."

### 6 · 0:40–0:48 · Scenario presets

* **On screen:** "Your scenario, live".
* **Action:** click the preset "Optimistic", then "Cautious"; the big number rolls to the Cautious value.
* **On-screen caption:** "Scenario, not a forecast · no FastAuth, no benchmark"
* **Narration:** "Without FastAuth and the benchmark, June 2027 is about 267 thousand monthly — a scenario, not a forecast."

### 7 · 0:48–0:58 · "What would prove us wrong"

* **On screen:** the countdown and the four case files with their "now vs threshold" gauges.
* **Action:** scroll to the chapter and hold while the cards deal in.
* **On-screen caption:** "Four conditions · checked 1 April 2027"
* **Narration:** "Chain Signatures works. Its demand is narrow — and its biggest user is winding down. Four conditions set in advance: checked 1 April 2027."

### 8 · 0:58–1:10 · Verify button and Re-run commands

* **On screen:** "Verify it yourself": the log types, the rows fill, the badge stamps VERIFIED ON-CHAIN; then the "Re-run it yourself" command cards.
* **Action:** click "Check a random transaction"; when the badge appears, scroll to the Re-run commands and end on the repository link.
* **On-screen caption:** "Reproduce offline · verify a random sample"
* **Narration:** "Every number rebuilds offline from committed data. A random sample is re-checked on-chain — that checks the parsing, not the estimate."

## Recording notes

* The Verify click needs the network; if the node does not answer, the page says so: re-record that shot or cut it.
* Sources to have at hand: the Sweat release is The Sweat Foundation Ltd (release of 2026-10-01), https://chainwire.org/2026/10/01/sweat-wallet-and-the-sweat-token-as-they-exist-today-end-on-30-december-2026/. The last `npm run verify` run: 50/50 sampled transactions verified.
* The post must say it was built at NEAR HACKATHON and tag @NEARProtocol and #NEARHackathon (draft: `docs/submission/X_POST.md`).

## Russian translation of the narration (for the founder, not for the video)

1. «NEAR Chain Signatures, с августа 2024 года: около 6.4M запросов; в выборке 99.9% завершаются успешно.»

2. «Тройка крупнейших — 74%: вход через FastAuth — 44%, подозреваемый бенчмарк — 19% и Relay Protocol — 11%.»

3. «Бум — это входы через FastAuth. Его главный пользователь — Sweat Wallet (средняя уверенность). Relay затих с августа 2026 года.»

4. «Sweat Foundation сообщает: Sweat Wallet в нынешнем виде прекращает работу 30 декабря 2026 года.» (На экране — точная цитата из релиза по-английски.)

5. «Остаются мосты: около 237k запросов за октябрь 2026 года — большая часть спроса, если убрать FastAuth и бенчмарк.»

6. «Без FastAuth и бенчмарка (остальное без изменений) на июнь 2027 года выходит около 267k в месяц — это сценарий, а не прогноз.»

7. «Chain Signatures работает. Его спрос узкий — а крупнейший пользователь сворачивается. Четыре условия, заданные заранее: проверка 1 апреля 2027 года.»

8. «Каждое число пересобирается оффлайн из закоммиченных данных. Случайная выборка перепроверяется в сети — это проверка разбора, а не оценки.»
