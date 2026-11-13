# design-v1: two bug fixes

## a) Empty space on the right / layout not adapting
Cause: content column was capped at 72rem (1152 px) with the hero stacked in one narrow column, so on 1440–1920 px screens
about 40 % of the width stayed empty and charts stopped growing. Fix: fluid container (92rem max, 5vw padding), hero as
two columns from 1100 px (headline left, stroke right), charts/lists fill the container; charts already redraw through
ResizeObserver. Measured chart widths: 1024 → 922, 1280 → 1152, 1440 → 1296, 1920 → 1312 px; no horizontal scroll at any width,
390 px → 351 px chart, live resize redraws (see the numbers in the report).

## b) Animations "not visible" with Reduce motion OFF
Not a reduced-motion problem (the media query was false in the test run). Two real causes:
1. On a laptop viewport (1280×800) the hero stroke sat below the fold: it drew itself where nobody looked.
2. The pen used an ease-OUT curve and started before the page fade-in finished: ~50 % of the line was drawn before `main` was
   fully opaque. Same for the count-up. Timers also started at script time, so a tab opened in the background finished unseen.
Fix: stroke moved beside the headline (above the fold); animation waits until the tab is visible, fonts are in and two frames
are painted, then +350 ms; ease-in-out, 2.8 s; tween clock starts at the first painted frame; count-up starts at ≈0.
Measured after the fix (clip width of the pen over time, 1280 px): 0 → 12 → 203 → 787 → 1122 → 1172 px at 0.35/0.9/1.5/2.1/2.7 s.
Screen recording is not possible here (Playwright has no ffmpeg build for macOS 12), so the proof is the time series above.
