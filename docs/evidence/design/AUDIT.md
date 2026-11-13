# Audit of the dashboard before the design upgrade (main at 5af6d2c)

Screenshots: `before-*.jpeg` in this folder. Ranked by how much each point hurts the first impression of a data story.

1. **No conclusion above the fold.** The hero was a small grey sentence plus a giant "≈6.4M". The volume read as a success number; the finding (narrow demand, one integration, a user leaving) appeared five screens later.
2. **A wall of charts, not a story.** Sections were named after chart types ("Requests over time", "Where the signatures go"), the thesis came last, and nothing told the reader what to conclude from each chart.
3. **Rainbow categorical colors, with colors that change meaning.** Five hues per stacked chart; blue was FastAuth in one chart and "NEAR itself" in another, green was Omni in one and "other chains" in another. Color did not follow the entity.
4. **Excel-like charts.** Default boxed Chart.js cards, a legend row above, gridlines everywhere, no annotations. The key events (FastAuth ramp, Relay exit, Sweat announcement) were invisible except in the scenario chart.
5. **"Who sends the requests" was a dense five-column table.** Account ids in bold monospace were the main label, confidence was glyphs, shares were numbers only (no bar), notes sat inline.
6. **Long texts all expanded.** The thesis block, the falsification tests and the honest notes were open walls of text.
7. **Template typography.** One grotesque for headings, system font for text, small headings; tabular numerals applied to running text.
8. **Template chrome on phones.** A text pill "Theme: auto", a seven-link nav that wrapped to three rows (so the bar had to be non-sticky), card borders around every chart.
9. **Motion limited to the pen stroke.** No reveals, charts appeared fully drawn, toggles snapped.
10. **Weight.** Chart.js (≈205 KB) for six simple charts.
