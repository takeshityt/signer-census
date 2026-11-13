# design-v2 evidence
Screenshots: `{390,1280,1920}-{light,dark}-{hero,full}.png`. Playwright here has no ffmpeg build for macOS 12, so "recordings" are
frame strips taken at timed intervals: `film-hero-stroke.png` (pen draws itself; labels appear with the pen), `film-bubbles.png`
(bubbles drift between frames, last frame = hover tooltip), `film-verify.png` (button: before click, asking, result).
Measured (1280 px, light, motion on): ready 74 ms, CLS 0, 0 console errors, 0 external requests before the click;
weight: shell 122 KB (html+css+js), fonts 92 KB, data 529 KB, total 743 KB (budget 800 KB).
Verify button: CORS works from the browser for archival-rpc.mainnet.fastnear.com (EXPERIMENTAL_tx_status + block) and api.nearblocks.io;
with both blocked it shows a calm message plus `npm run verify`.
