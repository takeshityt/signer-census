# Dashboard checks (GATE 4)

Run on 2026-11-12 against `npm run site` (http://127.0.0.1:4173/) built from `out/metrics.json` sha256 `99d8c870…` and `out/scenarios.json`,
with the Playwright MCP browser (Chromium, headless). Reproduce: `npm run reproduce && npm run build:site && npm run site`, then open the page and repeat the checks below
(each check is a short `browser_evaluate` snippet reading the DOM, the Chart.js instances and the JSON files; the numbers below are what they returned).
Unit tests (`npm test`) cover the data logic behind the same claims without a browser: `test/site-model.test.mjs`, `test/site-build.test.mjs`.

| # | Requirement | Result |
|---|---|---|
| 1 | Page loads in < 5 s locally | **PASS**: DOMContentLoaded 69 ms, all sections rendered 130 ms (`document.documentElement.dataset.readyMs`) |
| 2 | Hero number equals metrics.json | **PASS**: shown `≈6.4M`, `totals.requests_est.value` = 6,432,762 → `≈6.4M`; the 95% interval in the lede (6.42M–6.45M) and "99.9% fulfilled" are computed from the same file; the verify badge `50/50 verified` equals `data/verify.json` |
| 3 | Benchmark toggle changes the chart | **PASS**: datasets 7 → 6 (the hatched "Suspected benchmark" series disappears, the other six keep their colors and order); stacked total for Oct 2026 447,377 → 427,946 = `series_requests_est.all` 447,378 / `excluding_benchmark` 427,946 (±rounding); toggling back restores the original |
| 4 | Scenario controls change the output | **PASS**: five combinations tried (retention stops/25%/all stays, benchmark kept/removed, growth −5%/flat/+5%): chart end values 266,552 / 393,819 / 555,213 / 574,645 / 236,617 = the matching `end_month_total` in scenarios.json; the sentence under the controls changes with them; all five distinct |
| 5 | No horizontal overflow at 390 px | **PASS**: `scrollWidth` 390 = viewport; requesters table becomes a list; charts 343×255 |
| 6 | Dark and light screenshots | saved here (desktop 1280 full page + hero, mobile 390 sections) |
| 7 | Build step copies data with matching sha256 | **PASS** (unit test `site-build.test.mjs`): copied files hash equal to `out/*.json`; `site/data/manifest.json` hashes every file; the committed `site/` equals a fresh build |
| 8 | No runtime network calls | **PASS**: 15 resources loaded, 0 from another origin; unit test forbids CDN/fonts/analytics URLs in HTML and CSS |
| 9 | Theme toggle and keyboard | **PASS**: auto → light → dark → auto (data-theme and body background change); skip link shows a visible focus outline; landmarks (main, nav, footer) and heading outline present; every chart has a table view |
| 10 | Touch targets | enlarged for `summary` and navigation links; the remaining small targets are inline "source" links inside sentences |

## Screenshots

* `desktop-1280-light-full.jpeg`, `desktop-1280-dark-full.jpeg` (whole page), `desktop-1280-light-hero.jpeg`, `desktop-1280-dark-hero.jpeg`
* `mobile-390-light-hero.jpeg`, `mobile-390-light-usage.jpeg`, `mobile-390-light-who.jpeg`, `mobile-390-dark-hero.jpeg`, `mobile-390-dark-usage.jpeg`, `mobile-390-dark-scenarios.jpeg`

Screenshots were taken with `prefers-reduced-motion: reduce` (no entrance animation).

## Palette

Series colors are the validated categorical slots 1–5 of the dataviz reference palette (adjacent-pair CVD ΔE 9.1 light / 8.4 dark, normal-vision ΔE ≥ 19; script `validate_palette.js`).
Three light-mode slots (aqua, yellow, magenta) are below 3:1 contrast on the chart surface, which the method answers with visible legend labels, hover tooltips and a table view for every chart (all present), 2 px surface gaps between segments, and a hatched texture for the benchmark.

## Known limits (honest)

* **Rendering speed in the test browser.** The headless browser used here repaints at ~5 frames per second even on a blank page (no GPU): any rAF-driven visual change, such as the pen-stroke entrance, leaves it at 3–4 fps afterwards. Measured on a page with no dependencies: 62 fps idle, 3 fps after a 2-second opacity animation. This is a property of that browser, not of the page; idle frame rate of the page itself is 62 fps. Screenshots therefore use reduced motion.
* **One real performance bug was found and fixed:** hiding the table header on phones with `left: -9999px` made the page slow to paint at 390 px; it now uses clip-based hiding.
* The test browser is not Safari or Firefox; no cross-browser run was done.
* Evidence "source" links for private-repo files only open once the repository is public.
