# design-v2 evidence
Screenshots: `{390,1280,1920}-{light,dark}-{hero,full}.png`. Playwright here has no ffmpeg build for macOS 12, so "recordings" are
frame strips taken at timed intervals: `film-hero-stroke.png` (pen draws itself; labels appear with the pen), `film-bubbles.png`
(bubbles drift between frames, last frame = hover tooltip), `film-verify.png` (button: before click, asking, result).
Measured (1280 px, light, motion on): ready 74 ms, CLS 0, 0 console errors, 0 external requests before the click;
weight: shell 122 KB (html+css+js), fonts 92 KB, data 529 KB, total 743 KB (budget 800 KB).
Verify button: CORS works from the browser for archival-rpc.mainnet.fastnear.com (EXPERIMENTAL_tx_status + block) and api.nearblocks.io;
with both blocked it shows a calm message plus `npm run verify`.

## Waffle fix (squares invisible in the founder's browser)
Root cause: the squares were filled with `color-mix(...)`. A browser that does not know `color-mix` drops the whole declaration, so the coral,
green and Relay squares had no background (only the gradient-based hatched ones and the plain-variable grey ones showed); the hover outline was all that was left.
Also fixed: squares, ranking bars and scroll reveals started hidden and depended on an IntersectionObserver plus a finished animation.
Now: solid token fills, visible by default; the animation uses `animation-fill-mode: backwards`, so it can only play into the visible state;
`color-mix` has plain fallbacks (top bar, hover band, legend). Test: `waffle-check.mjs` (Playwright 1.47, WebKit and Chromium, light and dark,
plain / no-color-mix / no-IntersectionObserver / reduced-motion; hover leaves fills unchanged). It FAILS on the previous commit and passes now.
