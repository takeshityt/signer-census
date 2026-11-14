# design-v3 evidence ("case file" restyle)

Screenshots: `NN-<section>-<width>-<theme>.png` for every section (hero, works, who, boom, bridges, scenario, proof, verify, re-run)
at 390 / 1280 / 1920 px, dark and light, taken in Chromium with reduced motion (so every element is in its final state);
`webkit-hero-1280-{dark,light}.png` from WebKit.

`v3-check.mjs` (Playwright 1.47, fresh context per run, Chromium and WebKit, both themes, three widths): 0 console errors, no horizontal
overflow, 15 requester clusters (986 dots = ten per percent), 100 visible waffle dots, 6 charts, 4 case files; contrast measured from
computed colours: ink on tile 15.2 (dark) / 16.9 (light), muted text on tile 6.3 / 6.1, muted headline line on paper 6.8 / 5.6. All 12 runs passed.

Motion on (1280 px, Chromium): ready 113 ms, 60 fps over the first 4 s (worst frame 18 ms), layout shift 0.00005 (effectively 0), no external request.
Weight: shell 140 KB (html, css, js), fonts 57 KB (Geist, Geist Mono, Doto), data 538 KB; total ≈735 KB (budget 800 KB).

References (inspiration only; no assets, text, logos or layouts copied): Tripline and Tipline Framer templates, the Wealthora "Your plan, live" card.
Fonts are the same open families Tipline uses (Geist, Geist Mono, Doto: SIL OFL 1.1, self-hosted from @fontsource).
