// Dashboard wiring. Every number on the page is read from site/data/*.json (copied from out/ and exported at build); nothing is typed here.
// Texts are templates around those numbers. Colors and motion live in css/style.css and js/charts.js.
import { compact, approx, precise, pct, approxPct, range, rangePct, int, monthLabel, dayLabel } from "./format.js";
import { inline, esc } from "./md.js";
import { createChart, createHeroStroke, tween, reducedMotion } from "./charts.js";
import {
  headline, volumeSeries, boomSeries, fulfilledSeries, bridgeStack, destinationLines, timelineEvents, requesterRows, requesterName, requesterTone, splitWhy,
  chainFamilies, scenarioOptions, scenarioChart, categoryName, fullMonths, heroStats,
} from "./model.js";

const $ = (id) => document.getElementById(id);
const getJSON = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(`cannot load data/${f}`); return r.json(); });
const [metrics, scenarios, labels, verify, thesis, manifest] = await Promise.all(["metrics.json", "scenarios.json", "labels.json", "verify.json", "thesis.json", "manifest.json"].map(getJSON));
const hero = heroStats(metrics, verify);
const E = timelineEvents(metrics, scenarios);
const T = metrics.totals;
const snapshotDay = dayLabel(hero.snapshotTime);
const S = thesis.sections;
const full = fullMonths(metrics);
const lastFull = full.at(-1).month;
const lastMonth = metrics.months.at(-1);

/* ------------------------------------------------------------------ theme (one icon button: auto, light, dark) */
const themeBtn = $("theme");
const MODES = ["auto", "light", "dark"];
const ICONS = {
  auto: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>`,
  light: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>`,
  dark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`,
};
let mode = "auto";
try { mode = MODES.includes(localStorage.getItem("theme")) ? localStorage.getItem("theme") : "auto"; } catch { /* storage may be blocked */ }
function applyMode() {
  if (mode === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = mode;
  themeBtn.innerHTML = ICONS[mode];
  themeBtn.setAttribute("aria-label", `Color theme: ${mode}. Click to change.`);
  themeBtn.title = `Theme: ${mode}`;
  try { localStorage.setItem("theme", mode); } catch { /* ignore */ }
}
themeBtn.addEventListener("click", () => { mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; applyMode(); });
applyMode();

/* ------------------------------------------------------------------ small helpers */
const keyList = (id, items) => { $(id).innerHTML = items.map((i) => `<li class="t-${i.tone}"><span class="sw"></span>${esc(i.label)}</li>`).join(""); };
function table(id, head, rows) {
  $(id).innerHTML = `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table>`;
}
const monthTitle = (months, partial, i) => `${monthLabel(months[i])}${partial?.[i] ? ` (partial, data to ${snapshotDay})` : ""}`;
const ci95 = (ci, f = range) => (ci ? `95% interval ${f(ci)}` : null);
const height = (min, max, k) => (w) => Math.min(max, Math.max(min, w * k));

/* ------------------------------------------------------------------ hero */
$("h1").textContent = headline(thesis);
$("deck").innerHTML = `<strong>${approx(hero.requests)}</strong> signature requests since ${monthLabel(hero.firstMonth)} on NEAR’s MPC signer, <code>v1.signer</code>. Three requesters make <strong>${approxPct(T.concentration.top3_share.value)}</strong> of them. Every number on this page is read from <code>out/metrics.json</code> and re-runs from public chain data.`;
$("facts").innerHTML = [
  [`<span class="count"><span class="ghost" aria-hidden="true">≈${esc(compact(hero.requests))}</span><span id="count-req" aria-hidden="true">≈${esc(compact(hero.requests))}</span></span><span class="sr-only">about ${esc(compact(hero.requests))}</span>`, `signature requests since ${esc(monthLabel(hero.firstMonth))}. The 95% interval of sampling error alone is ${esc(range(hero.requestsCi, precise))}.`],
  [esc(pct(hero.fulfilled, 1)), "of sampled requests end with a successful signature callback. Latency and downtime are not measured."],
  [esc(approx(hero.withoutBenchmark)), "if the suspected benchmark account is left out."],
  [`${hero.verified}/${hero.sample}`, `sampled transactions parse the same as an archival RPC node and NearBlocks (${esc(dayLabel(hero.verifyDate))}). A check of the parsing, not of the estimate.`],
].map(([v, l]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("");

const strokeEvents = [
  { at: E.sweatAnnounced.date, lane: 0, align: "end", text: "Sweat announces the end date", sub: `${dayLabel(E.sweatAnnounced.date)} · wallet ends ${dayLabel(E.sweatEnds.date)}` },
  { at: E.relayExit.month, lane: 1, align: "end", text: "Relay’s allocator goes quiet", sub: `none in the sample from ${monthLabel(E.relayExit.month)}` },
  { at: E.fastauthRamp.month, lane: 2, align: "end", text: "FastAuth ramps up", sub: `${monthLabel(E.fastauthRamp.month)} · ${approx(E.fastauthRamp.value)} in one month` },
];
const peakI = full.findIndex((m) => m.month === hero.peakMonth);
const stroke = createHeroStroke($("hero-stroke"), {
  months: metrics.months.map((m) => m.month), values: full.map((m) => m.series_requests_est.all.value),
  tailTo: lastMonth.partial_month ? lastMonth.series_requests_est.all.value : null, events: strokeEvents, peakIndex: peakI,
  aria: `Estimated requests per month from ${monthLabel(hero.firstMonth)} to ${monthLabel(lastFull)}, peaking in ${monthLabel(hero.peakMonth)} at ${approx(hero.peakValue)}, with three dated events marked.`,
});
$("stroke-caption").textContent = `Estimated requests per month, ${monthLabel(hero.firstMonth)} to ${monthLabel(lastFull)}. The ring marks the peak: ${monthLabel(hero.peakMonth)}, ${approx(hero.peakValue)}.${lastMonth.partial_month ? ` The dotted tail is ${monthLabel(lastMonth.month)}, counted only to ${snapshotDay}.` : ""} Dots on the line are dated events.`;
function countUp() {
  const el = $("count-req");
  if (!el || reducedMotion()) return;
  tween(1500, (t) => { el.textContent = `≈${compact(hero.requests * t)}`; }, (t) => 1 - (1 - t) ** 3).done.then(() => { el.textContent = `≈${compact(hero.requests)}`; });
}

/* ------------------------------------------------------------------ chapter 1: it works */
$("h-works").textContent = "It works: almost every request ends in a signature.";
$("works-intro").textContent = `${approx(hero.requests)} signature requests since ${monthLabel(hero.firstMonth)}, and ${pct(hero.fulfilled, 1)} of the sampled requests end with a successful signature callback. That is all we measure: latency and downtime are not measured, and every estimate carries sampling error only.`;
$("excl-bench").checked = false;
let vol = volumeSeries(metrics), volChart;
const volTip = (i) => ({
  title: monthTitle(vol.months, vol.partial, i),
  rows: [
    { tone: "base", label: "Requests (without the benchmark)", value: approx(vol.series[0].values[i]), ci: ci95(vol.series[0].ci[i]) },
    ...(vol.series[1].values[i] ? [{ tone: "hatch", label: "Suspected benchmark", value: approx(vol.series[1].values[i]), ci: ci95(vol.series[1].ci[i]) }] : []),
  ],
  footer: `All shown: ${approx(vol.series.reduce((a, s) => a + s.values[i], 0))}`,
});
const volSpec = (excl) => {
  vol = volumeSeries(metrics, { excludeBenchmark: excl });
  return { months: vol.months, partial: vol.partial, series: vol.series.map((s) => ({ ...s, type: "bar" })), tip: volTip };
};
volChart = createChart($("chart-volume"), {
  ...volSpec(false), yFormat: compact, height: height(250, 380, 0.4), lanes: 1, labelMargin: 150,
  events: [{ at: hero.peakMonth, lane: 0, text: `Peak: ${monthLabel(hero.peakMonth)}`, sub: approx(hero.peakValue), align: "end" }],
  labels: [{ id: "all", text: "Requests" }, { id: "benchmark", text: "Suspected benchmark" }],
  aria: "Estimated signature requests per month, with the suspected benchmark hatched on top",
});
keyList("key-volume", [{ tone: "base", label: "Requests" }, { tone: "hatch", label: "Suspected benchmark (tx-bench.near)" }]);
$("cap-volume").textContent = `Estimated requests per month. Hover, tap or use the arrow keys for the 95% interval. ${monthLabel(lastMonth.month)} is partial (data to ${snapshotDay}) and drawn lighter.`;
const fillVolumeTable = () => table("table-volume", ["Month", "Requests", "Suspected benchmark"], vol.months.map((m, i) => [monthLabel(m) + (vol.partial[i] ? " (partial)" : ""), int(vol.series[0].values[i]), int(vol.series[1].values[i])]));
fillVolumeTable();

const ful = fulfilledSeries(metrics);
const lowSince = metrics.derived.fulfilled_rate_lowest_month_since, lowAll = metrics.derived.fulfilled_rate_lowest_month;
$("h-fulfilled").textContent = `Since ${monthLabel(lowSince.since)} no month has been below ${pct(lowSince.value, 1)}`;
$("fulfilled-intro").textContent = `The first months were rough: ${pct(lowAll.value)} of sampled requests ended in a signature in ${monthLabel(lowAll.month)}, mostly because the contract rejected duplicate requests. The overall ${pct(hero.fulfilled, 1)} is a volume-weighted average, and the suspected benchmark (always fulfilled) is part of that volume.`;
createChart($("chart-fulfilled"), {
  months: ful.months, partial: ful.partial, series: [{ id: "rate", label: "Callback success", tone: "near", type: "line", smooth: false, values: ful.values }],
  yMin: 0.5, yMax: 1, yFormat: (v) => pct(v), height: 190, lanes: 1,
  events: [
    { at: lowAll.month, lane: 0, text: `${pct(lowAll.value)} in ${monthLabel(lowAll.month)}`, align: "end" },
    { at: lowSince.since, lane: 0, text: `From ${monthLabel(lowSince.since)}: ${pct(lowSince.value, 1)} or better`, align: "start" },
  ],
  tip: (i) => ({ title: monthTitle(ful.months, ful.partial, i), rows: [{ tone: "near", label: "Callback success", value: pct(ful.values[i], 1), ci: ci95(ful.ci[i], (c) => rangePct(c, 1)) }] }),
  aria: "Share of sampled requests that end with a successful signature callback, per month",
});
table("table-fulfilled", ["Month", "Callback success", "95% interval"], ful.months.map((m, i) => [monthLabel(m) + (ful.partial[i] ? " (partial)" : ""), pct(ful.values[i], 1), rangePct(ful.ci[i], 1)]));

/* ------------------------------------------------------------------ chapter 2: who uses it */
const rows = requesterRows(metrics, labels);
const ge1 = T.concentration.requesters_ge_1pct.value, geAny = T.concentration.requesters_ge_1pct_any_month.value;
$("h-who").textContent = `Demand is narrow: three requesters make ${approxPct(T.concentration.top3_share.value)} of all requests.`;
$("who-intro").textContent = `Over the whole period only ${ge1} requesters hold at least one percent of all requests; ${geAny} reached one percent in at least one single month. The requester is the account that called sign, not the transaction signer (those are mostly relayers). Each bar is a share of all requests since ${monthLabel(hero.firstMonth)}, with its 95% interval as a whisker.`;
const dots = { high: 3, medium: 2, low: 1 };
const labelText = (r) => (r.category === "unknown" && r.suspected ? "Unknown, suspected benchmark" : r.category ? categoryName(r.category) : "Not labeled");
const evidenceList = (ev) => `<ul>${ev.map((e) => `<li>${esc(e.claim)} <a href="${esc(e.url)}" rel="noopener noreferrer">source</a></li>`).join("")}</ul>`;
const axisMax = Math.max(...rows.map((r) => r.shareCi?.[1] ?? r.share)) * 1.05;
function rankRow(r, k) {
  const w = (r.share / axisMax) * 100, lo = ((r.shareCi?.[0] ?? r.share) / axisMax) * 100, hi = ((r.shareCi?.[1] ?? r.share) / axisMax) * 100;
  const n = dots[r.confidence] ?? 0;
  const note = [r.note ? `<p>${esc(r.note)}</p>` : "", r.integrator ? `<div class="integ"><strong>Dominant integrator: ${esc(r.integrator.name)}</strong> (confidence ${esc(r.integrator.confidence)}). ${esc(r.integrator.note ?? "")}${evidenceList(r.integrator.evidence)}</div>` : "", r.evidence.length ? `<p><strong>Evidence for the label</strong></p>${evidenceList(r.evidence)}` : ""].join("");
  return `<div class="rk" style="--i:${k};--w:${w.toFixed(2)}%;--lo:${lo.toFixed(2)}%;--hi:${hi.toFixed(2)}%">
    <div class="who"><span class="nm">${esc(requesterName(r))}</span><span class="acct">${esc(r.account)}</span></div>
    <div class="track" role="img" aria-label="${esc(requesterName(r))}: ${approxPct(r.share, 1)} of requests, 95% interval ${esc(rangePct(r.shareCi, 1))}"><span class="fill t-${requesterTone(r)}"></span><span class="whisk"></span></div>
    <div class="val"><b>${approxPct(r.share, r.share < 0.1 ? 1 : 0)}</b><small>${approx(r.requests)} requests</small></div>
    <div class="meta"><span>${esc(labelText(r))}${r.owner ? ` · ${esc(r.owner)}` : ""}</span>
      <span class="conf" title="Label confidence">${n ? `<span class="dotsc" aria-hidden="true">${[1, 2, 3].map((d) => `<i class="${d <= n ? "on" : ""}"></i>`).join("")}</span> ${esc(r.confidence)} confidence` : "no label"}</span>
      ${note ? `<details><summary>Notes and ${r.evidence.length} source${r.evidence.length === 1 ? "" : "s"}</summary><div>${note}</div></details>` : ""}</div>
  </div>`;
}
const SHOWN = 8;
$("who-list").innerHTML = rows.slice(0, SHOWN).map(rankRow).join("") + (rows.length > SHOWN ? `<details class="more rk-more"><summary>Show the other ${rows.length - SHOWN} requesters</summary>${rows.slice(SHOWN).map((r, k) => rankRow(r, k)).join("")}</details>` : "");
$("who-note").textContent = `The ${rows.length} largest requesters hold ${approxPct(rows.reduce((a, r) => a + r.share, 0))} of all requests. Label confidence: three dots = an official source or an on-chain fact names the owner; one dot = weak signals. Every label has evidence links.`;

/* ------------------------------------------------------------------ chapter 3: the boom */
const fa = rows.find((r) => r.account === "fast-auth.near");
const rel = T.relayer_share_of_requester["fast-auth.near via sweat-relayer.near"];
let boom = boomSeries(metrics);
const faPeak = boom.series[0].values.reduce((a, v, i) => (!boom.partial[i] && v > a.v ? { v, i } : a), { v: 0, i: 0 });
$("h-boom").textContent = `The boom was one integration, and its product ends in its present form on ${dayLabel(E.sweatEnds.date)}.`;
$("boom-intro").textContent = `FastAuth logins issued by the Sweat Foundation’s login domain went from almost nothing to ${approx(E.fastauthRamp.value)} requests in ${monthLabel(E.fastauthRamp.month)}, peaked at ${approx(faPeak.v)} in ${monthLabel(boom.months[faPeak.i])}, and by ${monthLabel(lastFull)} were down to ${approx(boom.series[0].values[boom.months.indexOf(lastFull)])}. ${approxPct(rel.value, 2)} of that traffic is relayed by sweat-relayer.near; that it is specifically Sweat Wallet is medium confidence. Over the whole period FastAuth is ${approxPct(fa.share)} of all requests.`;
const boomTip = (i) => ({
  title: monthTitle(boom.months, boom.partial, i),
  rows: boom.series.filter((s) => s.values[i]).map((s) => ({ tone: s.tone, label: s.label, value: approx(s.values[i]), ci: ci95(s.ci[i]) })),
  footer: `All shown: ${approx(boom.series.reduce((a, s) => a + s.values[i], 0))}`,
});
const boomEvents = [
  { at: E.sweatAnnounced.date, lane: 0, text: "Sweat announces the end date", sub: `${dayLabel(E.sweatAnnounced.date)} · source`, href: E.sweatAnnounced.source, align: "end" },
  { at: E.relayExit.month, lane: 1, text: "Relay’s allocator goes quiet", sub: `none in the sample from ${monthLabel(E.relayExit.month)}`, align: "end" },
  { at: E.fastauthRamp.month, lane: 2, text: "FastAuth ramps up", sub: `${monthLabel(E.fastauthRamp.month)}: ${approx(E.fastauthRamp.value)}`, align: "end" },
];
const boomSpec = (excl) => { boom = boomSeries(metrics, { excludeBenchmark: excl }); return { months: boom.months, partial: boom.partial, series: boom.series.map((s) => ({ ...s, type: "bar" })), tip: boomTip }; };
const boomChart = createChart($("chart-boom"), {
  ...boomSpec(false), yFormat: compact, height: height(280, 420, 0.44), lanes: 3, labelMargin: 150, events: boomEvents,
  labels: [{ id: "fastauth", text: "FastAuth logins" }, { id: "rest", text: "Everyone else" }, { id: "benchmark", text: "Suspected benchmark" }],
  aria: "Estimated requests per month: FastAuth logins, everyone else, and the suspected benchmark",
});
keyList("key-boom", [{ tone: "fastauth", label: "FastAuth logins" }, { tone: "muted", label: "Everyone else (bridges, apps, unidentified)" }, { tone: "hatch", label: "Suspected benchmark" }]);
const fillBoomTable = () => table("table-boom", ["Month", ...boom.series.map((s) => s.label)], boom.months.map((m, i) => [monthLabel(m) + (boom.partial[i] ? " (partial)" : ""), ...boom.series.map((s) => int(s.values[i]))]));
fillBoomTable();
$("excl-bench").addEventListener("change", (e) => {
  volChart.update(volSpec(e.target.checked)); boomChart.update(boomSpec(e.target.checked)); fillVolumeTable(); fillBoomTable();
});

const ev = scenarios.event;
$("sunset-callout").innerHTML = `<p>“${esc(ev.statement)}”</p><footer>${esc(ev.issuer)}. <a href="${esc(ev.source)}" rel="noopener noreferrer">Source</a></footer>`;
$("sunset-intro").textContent = `Pick what happens to FastAuth traffic after ${dayLabel(ev.date)}, whether the suspected benchmark keeps running, and how fast the rest (“structural” demand) grows. These are scenarios, not forecasts.`;
const opts = scenarioOptions(scenarios);
const sel = { retention: opts.retention[0], benchmark: opts.benchmark.includes("removed") ? "removed" : opts.benchmark[0], growth: opts.growth.find((g) => g === 0) ?? opts.growth[0] };
const sgn = (g) => (g > 0 ? "+" : g < 0 ? "−" : "") + pct(Math.abs(g));
const groups = [
  { key: "retention", legend: `FastAuth traffic after ${dayLabel(ev.date)}`, values: opts.retention, text: (v) => (v === 0 ? "stops" : v === 1 ? "all stays" : `${pct(v)} stays`) },
  { key: "benchmark", legend: "Suspected benchmark", values: opts.benchmark, text: (v) => (v === "kept" ? "keeps running" : "stops") },
  { key: "growth", legend: "Structural demand per month", values: opts.growth, text: (v) => (v === 0 ? "flat" : sgn(v)) },
];
$("scenario").innerHTML = groups.map((g) => `<fieldset><legend>${esc(g.legend)}</legend><div class="seg">${g.values.map((v) => `<label><input type="radio" name="${g.key}" value="${esc(String(v))}"${v === sel[g.key] ? " checked" : ""}><span>${esc(g.text(v))}</span></label>`).join("")}</div></fieldset>`).join("");
function scenarioSpec() {
  const ch = scenarioChart(metrics, scenarios, sel), s = ch.scenario, base = scenarios.baseline, baseI = ch.months.indexOf(ch.baselineMonth);
  $("scenario-result").textContent = `In ${monthLabel(s.end_month)} this scenario gives ${approx(s.end_month_total)} requests a month, ${s.end_month_vs_baseline >= 0 ? "+" : "−"}${pct(Math.abs(s.end_month_vs_baseline))} against the baseline month ${monthLabel(base.month)} (${approx(base.all)}). Cumulative from ${monthLabel(Object.keys(s.projection)[0])} to ${monthLabel(s.end_month)}: ${approx(s.cumulative_requests)}.`;
  table("table-scenario", ["Month", "Estimated", "Scenario: all", "Scenario: structural", "Scenario: FastAuth"], ch.months.map((m, i) => [monthLabel(m), ch.history[i] == null ? "" : int(ch.history[i]), ch.total[i] == null ? "" : int(ch.total[i]), ch.structural[i] == null ? "" : int(ch.structural[i]), ch.fastauth[i] == null ? "" : int(ch.fastauth[i])]));
  return {
    months: ch.months, partial: ch.months.map(() => false),
    series: [
      { id: "structural", label: "Structural", tone: "base", type: "line", values: ch.structural },
      { id: "fastauth", label: "FastAuth", tone: "fastauth", type: "line", values: ch.fastauth },
      { id: "total", label: "All requests (scenario)", tone: "near", type: "line", dash: true, values: ch.total },
      { id: "history", label: "Estimated", tone: "near", type: "line", values: ch.history },
    ],
    tip: (i) => ({ title: `${monthLabel(ch.months[i])}${i > baseI ? " (scenario)" : ""}`, rows: [["history", "Estimated"], ["total", "All requests"], ["fastauth", "FastAuth"], ["structural", "Structural"]].map(([id, label]) => ({ id, label, v: (id === "history" ? ch.history : id === "total" ? ch.total : id === "fastauth" ? ch.fastauth : ch.structural)[i] })).filter((r) => r.v != null).map((r) => ({ tone: r.id === "history" || r.id === "total" ? "near" : r.id === "fastauth" ? "fastauth" : "base", label: r.label, value: approx(r.v) })) }),
  };
}
const scChart = createChart($("chart-scenario"), {
  ...scenarioSpec(), yFormat: compact, height: height(260, 380, 0.4), lanes: 2, labelMargin: 150,
  events: [
    { at: E.sweatEnds.date, lane: 0, text: "Sweat wallet ends in its present form", sub: dayLabel(E.sweatEnds.date), href: E.sweatEnds.source, align: "start" },
    { at: E.sweatAnnounced.date, lane: 1, text: "Announced", sub: dayLabel(E.sweatAnnounced.date), align: "end" },
  ],
  labels: [{ id: "total", text: "All requests" }, { id: "structural", text: "Structural" }, { id: "fastauth", text: "FastAuth" }],
  aria: "Monthly requests: recent estimates and the selected scenario",
});
keyList("key-scenario", [{ tone: "near", label: "Estimated, then scenario (dashed)" }, { tone: "fastauth", label: "FastAuth" }, { tone: "base", label: "Structural" }]);
$("scenario").addEventListener("change", (e) => {
  const g = groups.find((x) => x.key === e.target.name); if (!g) return;
  sel[g.key] = g.values.find((v) => String(v) === e.target.value);
  scChart.update(scenarioSpec());
});
$("scenario-note").textContent = `Baseline = ${monthLabel(scenarios.baseline.month)}, the last full month: ${approx(scenarios.baseline.all)} requests, of which FastAuth ${approx(scenarios.baseline.fastauth)}, suspected benchmark ${approx(scenarios.baseline.benchmark)}, structural ${approx(scenarios.baseline.structural)}. ${scenarios.scenarios.length} precomputed combinations; edit assumptions.yaml and run npm run reproduce to try others. Two simplifications: FastAuth is held at its ${monthLabel(scenarios.baseline.month)} level until the Sweat end date although it has been falling every month, and the default selection (FastAuth stops, benchmark stops, flat structural demand) removes both large non-structural parts; it is a cautious view, not a forecast (shrinking structural demand would be lower still).`;

/* ------------------------------------------------------------------ chapter 4: bridges and destinations */
const br = bridgeStack(metrics);
const bi = br.months.indexOf(lastFull), bridgeSum = br.series.reduce((a, s) => a + s.values[bi], 0), pk = metrics.derived.bridges_peak_month;
$("h-bridges").textContent = "What remains is bridge traffic: the steadiest demand we see, but still young.";
$("bridges-intro").textContent = `The Omni, Bitcoin and Zcash connectors sign for bridge transfers. They peaked in ${monthLabel(pk.month)} at ${approx(pk.value)} requests, and in ${monthLabel(lastFull)} made ${approx(bridgeSum)} (${approxPct(Math.abs(metrics.derived.bridges_last_full_vs_peak))} below the peak), ${approxPct(bridgeSum / br.structural.values[bi])} of all structural requests (everything except the suspected benchmark and FastAuth). Over the whole period the three connectors made ${approx(T.series_requests_est.bridges.value)} requests.`;
createChart($("chart-bridges"), {
  months: br.months, partial: br.partial, series: br.series.map((s) => ({ ...s, type: "bar" })), yFormat: compact, height: height(250, 380, 0.4), lanes: 1, labelMargin: 150,
  events: [{ at: E.bridgesPeak.month, lane: 0, text: `Peak: ${monthLabel(E.bridgesPeak.month)}`, sub: approx(E.bridgesPeak.value), align: "end" }],
  labels: br.series.map((s) => ({ id: s.id, text: s.label })),
  tip: (i) => ({ title: monthTitle(br.months, br.partial, i), rows: br.series.filter((s) => s.values[i]).map((s) => ({ tone: s.tone, label: s.label, value: approx(s.values[i]), ci: ci95(s.ci[i]) })), footer: `All bridges: ${approx(br.total.values[i])}` }),
  aria: "Estimated bridge connector requests per month",
});
keyList("key-bridges", br.series.map((s) => ({ tone: s.tone, label: s.label })));
table("table-bridges", ["Month", ...br.series.map((s) => s.label), "All structural"], br.months.map((m, i) => [monthLabel(m) + (br.partial[i] ? " (partial)" : ""), ...br.series.map((s) => int(s.values[i])), int(br.structural.values[i])]));

const dl = destinationLines(metrics);
const fams = chainFamilies(metrics);
const FAM = { near: "NEAR itself", bitcoin: "Bitcoin", zcash: "Zcash", multi: "Several chains", unknown: "Not known", evm: "EVM chains", solana: "Solana", other: "Other" };
const nearFam = fams.find((f) => f.id === "near");
$("h-chains").textContent = dl.crossover ? `Since ${monthLabel(dl.crossover.month)}, more signatures serve other chains than NEAR itself` : "Where the signatures go";
$("chains-intro").textContent = `Share of requests by where the signature is used. “NEAR itself” means keys of NEAR accounts (FastAuth logins); “other chains” are Bitcoin, Zcash and bridges that sign for several chains; the band is “not known” (no evidence-backed rule). Over the whole period NEAR itself is ${approxPct(nearFam.share)} (interval ${rangePct(nearFam.ci)}), but that rests mostly on one medium-confidence rule.`;
const dlRows = (i) => [
  { tone: "near", label: "NEAR itself", value: pct(dl.near.values[i], 1), ci: ci95(dl.near.ci[i], (c) => rangePct(c, 1)) },
  { tone: "other", label: "Other chains", value: pct(dl.other.values[i], 1), ci: ci95(dl.other.ci[i], (c) => rangePct(c, 1)) },
  { tone: "unknown", label: "Not known", value: pct(dl.unknown.values[i], 1) },
];
createChart($("chart-chains"), {
  months: dl.months, partial: dl.partial, bandTop: 1,
  series: [
    { id: "unknown", label: "Not known", tone: "unknown", type: "band", values: dl.unknown.values.map((v) => 1 - v) },
    { id: "near", label: "NEAR itself", tone: "near", type: "line", values: dl.near.values },
    { id: "other", label: "Other chains", tone: "other", type: "line", values: dl.other.values },
  ],
  yMin: 0, yMax: 1, yFormat: (v) => pct(v), height: height(260, 380, 0.4), lanes: 1, labelMargin: 150,
  events: dl.crossover ? [{ at: dl.crossover.month, lane: 0, text: `${monthLabel(dl.crossover.month)}: other chains ${pct(dl.crossover.other)}, NEAR itself ${pct(dl.crossover.near)}`, align: "end" }] : [],
  labels: [{ id: "near", text: "NEAR itself" }, { id: "other", text: "Other chains" }, { id: "unknown", text: "Not known" }],
  tip: (i) => ({ title: monthTitle(dl.months, dl.partial, i), rows: dlRows(i) }),
  aria: "Monthly share of requests by destination: NEAR itself, other chains, and not known",
});
keyList("key-chains", [{ tone: "near", label: "NEAR itself" }, { tone: "other", label: "Other chains" }, { tone: "unknown", label: "Not known" }]);
table("table-chains", ["Month", "NEAR itself", "Other chains", "Not known"], dl.months.map((m, i) => [monthLabel(m), pct(dl.near.values[i], 1), pct(dl.other.values[i], 1), pct(dl.unknown.values[i], 1)]));
$("families").innerHTML = fams.map((f) => `<div class="row"><span>${esc(FAM[f.id] ?? f.id)}</span><span class="bar" aria-hidden="true"><i style="width:${(f.share * 100).toFixed(1)}%"></i></span><span>${approxPct(f.share)} (${rangePct(f.ci)})</span></div>`).join("");

/* ------------------------------------------------------------------ chapter 5: what to watch / chapter 6: re-run / chapter 7: evidence */
const lead = (b) => { const m = /^\*\*([^*]+?):?\*\*\s*(.*)$/s.exec(b); return m ? `<strong>${esc(m[1])}</strong>${inline(m[2].replace(/^[a-z]/, (c) => c.toUpperCase()))}` : inline(b); };
$("nearview").innerHTML = S["what-this-means-for-a-long-term-near-view"].bullets.map((b) => `<li>${lead(b)}</li>`).join("");
const wrongSec = S["what-would-prove-this-thesis-wrong"];
$("wrong-intro").innerHTML = inline(wrongSec.markdown.split(/\n\n+/)[0].replace(/\n/g, " "));
$("wrong").innerHTML = wrongSec.bullets.map((b) => {
  const { claim, why } = splitWhy(b);
  return why ? `<details><summary><span>${inline(claim)}</span></summary><p class="why">${inline(why)}</p></details>` : `<p class="note">${inline(claim)}</p>`;
}).join("");

const hash = manifest.files["data/metrics.json"];
const steps = [
  ["npm test", "Unit tests for parsing, labels, estimates, THESIS.md numbers, scenarios and this page’s data. Ends with the vitest summary and exit code 0."],
  ["npm run reproduce", `Rebuilds out/metrics.json, out/scenarios.json and THESIS.md from the committed data, offline. It prints: out/metrics.json written. sha256 ${hash.slice(0, 16)}… (this page was built from that exact file).`],
  [`npm run verify -- --sample ${verify.sample}`, `Draws ${verify.sample} seeded random transactions with sign receipts and re-checks signer, block height and sign receipts at an archival RPC node and at NearBlocks (add --seed <n> for another draw). It checks the parsing, not the estimate. Last run: ${verify.verified}/${verify.sample} verified (RPC ${verify.rpc_ok}/${verify.sample}, NearBlocks ${verify.nearblocks_ok}/${verify.sample}).`],
  ["npm run build:site && npm run site", "Copies the JSON files into site/data/ with their sha256 and serves this page on http://127.0.0.1:4173/."],
];
$("rerun-steps").innerHTML = steps.map(([cmd, what]) => `<div class="step"><div class="cmd"><code>${esc(cmd)}</code><button type="button" data-copy="${esc(cmd)}">Copy</button></div><p>${esc(what)}</p></div>`).join("");
$("rerun-steps").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-copy]"); if (!b) return;
  navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy"; }, 1400); }).catch(() => {});
});

const para = (md) => md.split(/\n\n+/).filter((p) => !p.startsWith("*")).map((p) => `<p>${inline(p.replace(/\n/g, " "))}</p>`).join("");
const block = (title, body) => `<details><summary><span>${esc(title)}</span></summary><div class="body">${body}</div></details>`;
const bulletList = (id) => `<ul>${S[id].bullets.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`;
$("honest-body").innerHTML = [
  block("Evidence against the thesis", bulletList("evidence-against-and-why-the-claim-could-be-too-pessimistic-or-too-optimistic")),
  block("What this census cannot measure", bulletList("what-this-census-cannot-measure")),
  block("Comparison with the existing Dune dashboard", para(S["comparison-with-the-existing-dashboard"].markdown)),
  block("Methodology in short", para(S["methodology-in-short"].markdown)),
  block("Read more", `<p><a href="docs/THESIS.md">THESIS.md</a> (full text, every number footnoted to its JSON path) · <a href="docs/METHODOLOGY.md">METHODOLOGY.md</a> (definitions, sampling, limits).</p>`),
].join("");
$("foot").innerHTML = `Data: exact transaction counts as of block ${int(metrics.meta.snapshot.block_height)} (${snapshotDay}); requests are estimates from a cluster sample. metrics.json sha256 <code>${hash}</code>. No cookies, no tracking, no network requests beyond this server.`;

/* ------------------------------------------------------------------ motion: scroll reveals, ranked bars, nav highlight */
const reveal = [...document.querySelectorAll(".hero > *, .chapter > *")];
reveal.forEach((el) => el.setAttribute("data-reveal", ""));
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
reveal.forEach((el) => io.observe(el));
const rkio = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rkio.unobserve(e.target); } }), { threshold: 0.3 });
document.querySelectorAll(".rk").forEach((el) => rkio.observe(el));
document.querySelector(".rk-more")?.addEventListener("toggle", (e) => { if (e.target.open) e.target.querySelectorAll(".rk").forEach((r) => r.classList.add("in")); });
const navLinks = [...document.querySelectorAll("#nav a")];
const navIo = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) navLinks.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === `#${e.target.id}`))); }), { rootMargin: "-30% 0px -60% 0px" });
document.querySelectorAll(".chapter").forEach((s) => navIo.observe(s));

document.documentElement.dataset.ready = "1";
document.documentElement.dataset.readyMs = String(Math.round(performance.now()));
stroke.play();
countUp();
