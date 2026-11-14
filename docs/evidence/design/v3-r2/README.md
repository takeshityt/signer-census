# design-v3, round 2 — evidence

* `NN-<section>-<width>-<theme>.png`: every section at 390 / 1280 / 1920 px, dark and light (Chromium, reduced motion = the final, static state);
  `webkit-hero-1280-{dark,light}.png` from WebKit.
* `boom-scene-step{0..3}-1280-dark.png`: the scroll-driven boom scene at each step (motion on).
* Recordings (WebM, 1280×800, motion on): `rec-hero-load.webm`, `rec-boom-scroll.webm`, `rec-verify-click.webm` (a real click against the public archival RPC, twice).
* Checks (scripts here; Playwright 1.47, fresh context per run):
  * `r2-check.mjs`: Chromium and WebKit × dark/light × 390/1280/1920: 0 console errors, no horizontal overflow, 28 month columns, 100 visible waffle squares,
    6 charts, 4 case files; contrast ink/tile 15.2 (dark) / 16.9 (light), muted/tile 6.3 / 6.1, muted headline line/paper 6.8 / 5.6. All 12 passed.
  * `perf.mjs` (motion on, scroll through the whole page): Chromium 60 fps median (p95 frame 17 ms), layout shift 0.00005; WebKit 59 fps, layout shift 0;
    every revealed element fully visible afterwards. Weight: shell 177 KB, fonts 57 KB, data 538 KB = 772 KB (budget 800 KB).
  * `scene.mjs`: the boom scene switches stage 0 → 1 (FastAuth coral) → 2 (Relay split out) → 3 (ghost bars of the default scenario), one annotation per step.
