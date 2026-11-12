# Design upgrade: checks (branch `design`)

Run on 2026-11-12 with the page served by `npm run site` (http://127.0.0.1:4173/), Chromium via Playwright. Each line is the output of a `browser_evaluate` snippet or a command.

| Check | Result |
|---|---|
| Hero headline equals THESIS.md section "Headline" | `h1InThesis: true`; text: "Chain Signatures works. Its demand is narrow — and its biggest user is winding down." (also a vitest test) |
| Console | 0 errors, 0 warnings |
| 390 px: no horizontal overflow | `document.documentElement.scrollWidth === 390` (after fixing a label that ran out of the chart and a command block); nav is one 52 px row and scrolls sideways |
| 1280 px: no horizontal overflow | `noHorizontalOverflow: true` |
| Layout shift while loading | CLS `0.0000` (the page is hidden until the data is in; reveals use opacity and a 8 px transform only) |
| Load time, local | `readyMs` 71–99 ms (all sections rendered); DOMContentLoaded 69 ms |
| Weight budget | App shell (HTML + CSS + JS + 2 fonts) 193 KB, budget ≤ 250 KB. Data JSON 499 KB (metrics.json alone 412 KB), total 692 KB uncompressed, budget ≤ 800 KB. Before: Chart.js alone was ≈205 KB |
| Offline / no CDN | no request outside the origin; vitest "no external URL is loaded by the page" |
| Hero count-up, markers, chart draw-in | count-up reads ≈741k mid-animation and ≈6.4M after; 3 of 3 hero markers switch on; chart labels switch on after the draw-in |
| Toggle "Leave out the suspected benchmark" | hatched bar height 342.5 px → 0 px → 342.5 px (tweened), label "Suspected benchmark" removed and restored; the boom chart follows the same switch |
| Scenario radio | result sentence changes (e.g. FastAuth "all stays": ≈428k in Jun 2027, −4% against Oct 2026); the chart tweens |
| Theme button | cycles light → dark → auto; paper `rgb(245, 246, 247)` / `rgb(15, 18, 20)` |
| Keyboard | chart focusable, ArrowLeft shows the tooltip with the 95% interval, Escape hides it; focus ring visible |
| Reduced motion | emulated: charts fully drawn at once, no reveals, no count-up; all screenshots below were taken this way |
| Contrast (WCAG) | text: ink 16.3:1, muted 5.9:1 (light) / 7.5:1 (dark); marks: FastAuth 3.9:1 (light) / 5.4:1 (dark), bridges 5.4:1 / 6.2:1 |
| Palette validator (dataviz skill) | `node validate_palette.js "#d4501e,#1f8a5b,#3a6fb0" --mode light --surface "#ffffff"` ALL CHECKS PASS; dark `"#e5602b,#2fa874,#5c93d6"` on `#161a1d` ALL CHECKS PASS |
| Tests | `npm test`: 10 files, 87 tests passed (12 new: editorial views, chart helpers, "no typed numbers in index.html") |
| Fresh build is byte-identical | the vitest test "the committed site/ is up to date" passes |

Screenshots (before / after, desktop 1280 and mobile 390, light and dark):
`before-desktop-light.jpeg`, `before-desktop-dark.jpeg`, `before-mobile-light.jpeg`, `before-mobile-dark.jpeg`, `before-desktop-light-hero.jpeg`
`after-desktop-light.jpeg`, `after-desktop-dark.jpeg`, `after-mobile-light.jpeg`, `after-mobile-dark.jpeg`, `after-desktop-light-hero.jpeg`
