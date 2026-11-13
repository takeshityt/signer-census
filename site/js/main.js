// Dashboard wiring (version 2). Every number on the page is read from site/data/*.json (copied from out/ and config/ at build); nothing is typed here.
// Texts are short templates around those numbers. Colors live in css/style.css, motion in js/charts.js, bubbles.js and plus-field.js.
import { compact, approx, precise, pct, approxPct, range, rangePct, int, monthLabel, dayLabel } from "./format.js";
import { inline, esc } from "./md.js";
import { createChart, createHeroStroke, tween, reducedMotion, whenShown } from "./charts.js";
import { createWaffle, waffleGroups } from "./waffle.js";
import { sparkline } from "./spark.js";
import { createPlusField } from "./plus-field.js";
import { setupVerify } from "./verify-ui.js";
import { project } from "./scenario-core.js";
import { pendingInfo } from "./predictions-core.js";
import {
  headline, volumeSeries, boomSeries, fulfilledSeries, bridgeStack, destinationLines, timelineEvents, requesterRows, requesterName, requesterTone, splitWhy,
  chainFamilies, scenarioSeries, predictionLines, categoryName, fullMonths, heroStats,
} from "./model.js";

const $ = (id) => document.getElementById(id);
const getJSON = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(`cannot load data/${f}`); return r.json(); });
const [metrics, scenarios, labels, verify, thesis, manifest, predictions, vsample, rmonthly] = await Promise.all(["metrics.json", "scenarios.json", "labels.json", "verify.json", "thesis.json", "manifest.json", "predictions.json", "verify-sample.json", "requester-monthly.json"].map(getJSON));
const hero = heroStats(metrics, verify);
const E = timelineEvents(metrics, scenarios);
const T = metrics.totals;
const snapshotDay = dayLabel(hero.snapshotTime);
const S = thesis.sections;
const full = fullMonths(metrics);
const lastFull = full.at(-1).month;
const lastMonth = metrics.months.at(-1);

/* ------------------------------------------------------------------ theme (follows the system; one text button cycles auto, light, dark) */
const themeBtn = $("theme");
const MODES = ["auto", "light", "dark"];
let mode = "auto";
try { mode = MODES.includes(localStorage.getItem("theme")) ? localStorage.getItem("theme") : "auto"; } catch { /* storage may be blocked */ }
function applyMode() {
  if (mode === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = mode;
  themeBtn.textContent = `Theme: ${mode}`;
  themeBtn.setAttribute("aria-label", `Color theme: ${mode}. Click to change.`);
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
$("deck").textContent = "A reproducible count of who asks NEAR’s MPC signer to sign, and for which chains.";
$("facts").innerHTML = [
  [`<span class="count"><span class="ghost" aria-hidden="true">≈${esc(compact(hero.requests))}</span><span id="count-req" aria-hidden="true">≈${esc(compact(hero.requests))}</span></span><span class="sr-only">about ${esc(compact(hero.requests))}</span>`, `signature requests since ${esc(monthLabel(hero.firstMonth))}`],
  [esc(pct(hero.fulfilled, 1)), "end in a successful signature"],
  [esc(approx(hero.withoutBenchmark)), "without the suspected benchmark"],
  [`${hero.verified}/${hero.sample}`, "sampled transactions re-checked on-chain"],
].map(([v, l]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("");
$("hero-notes").innerHTML = `<p>The request count is an estimate: exact monthly transaction totals times the share of sign receipts in a cluster sample. Its 95% interval, sampling error only, is ${esc(range(hero.requestsCi, precise))}. Latency and downtime are not measured.</p><p>The re-check compares the parsing of each sampled transaction with an archival RPC node and NearBlocks (${esc(dayLabel(hero.verifyDate))}). It checks the parsing, not the estimate.</p><p>Every number on this page is read from <code>out/metrics.json</code>, which is also served as <a href="data/metrics.json">data/metrics.json</a>.</p>`;

const strokeEvents = [
  { at: E.sweatAnnounced.date, lane: 0, align: "end", text: "Sweat end date", sub: "" },
  { at: E.relayExit.month, lane: 1, align: "end", text: "Relay goes quiet", sub: "" },
  { at: E.fastauthRamp.month, lane: 2, align: "end", text: "FastAuth ramp", sub: "" },
];
const peakI = full.findIndex((m) => m.month === hero.peakMonth);
const stroke = createHeroStroke($("hero-stroke"), {
  months: metrics.months.map((m) => m.month), values: full.map((m) => m.series_requests_est.all.value),
  tailTo: lastMonth.partial_month ? lastMonth.series_requests_est.all.value : null, events: strokeEvents, peakIndex: peakI,
  aria: `Estimated requests per month from ${monthLabel(hero.firstMonth)} to ${monthLabel(lastFull)}, peaking in ${monthLabel(hero.peakMonth)} at ${approx(hero.peakValue)}, with three dated events marked: FastAuth ramp ${monthLabel(E.fastauthRamp.month)}, Relay goes quiet ${monthLabel(E.relayExit.month)}, Sweat end date announced ${dayLabel(E.sweatAnnounced.date)}.`,
});
$("stroke-caption").textContent = `Estimated requests per month, ${monthLabel(hero.firstMonth)} to ${monthLabel(lastFull)}; peak ${monthLabel(hero.peakMonth)}, ${approx(hero.peakValue)}.${lastMonth.partial_month ? ` The dotted tail is ${monthLabel(lastMonth.month)}, counted to ${snapshotDay}.` : ""}`;
function countUp() {
  const el = $("count-req");
  if (!el || reducedMotion()) return;
  tween(1600, (t) => { el.textContent = `≈${compact(hero.requests * t)}`; }, (t) => 1 - (1 - t) ** 3).done.then(() => { el.textContent = `≈${compact(hero.requests)}`; });
}

/* ------------------------------------------------------------------ chapter 1: it works */
$("h-works").textContent = "Almost every request ends in a signature.";
$("works-intro").textContent = "Estimated requests per month.";
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
  ...volSpec(false), yFormat: compact, height: height(250, 420, 0.38), lanes: 1, labelMargin: 150,
  events: [{ at: hero.peakMonth, lane: 0, text: `Peak ${monthLabel(hero.peakMonth)}`, align: "end" }],
  labels: [{ id: "all", text: "Requests" }, { id: "benchmark", text: "Suspected benchmark" }],
  aria: "Estimated signature requests per month, with the suspected benchmark hatched on top",
});
keyList("key-volume", [{ tone: "base", label: "Requests" }, { tone: "hatch", label: "Suspected benchmark" }]);
const fillVolumeTable = () => table("table-volume", ["Month", "Requests", "Suspected benchmark"], vol.months.map((m, i) => [monthLabel(m) + (vol.partial[i] ? " (partial)" : ""), int(vol.series[0].values[i]), int(vol.series[1].values[i])]));
fillVolumeTable();

const ful = fulfilledSeries(metrics);
const lowSince = metrics.derived.fulfilled_rate_lowest_month_since, lowAll = metrics.derived.fulfilled_rate_lowest_month;
$("h-fulfilled").textContent = `Never below ${pct(lowSince.value, 1)} since ${monthLabel(lowSince.since)}`;
createChart($("chart-fulfilled"), {
  months: ful.months, partial: ful.partial, series: [{ id: "rate", label: "Success", tone: "near", type: "line", smooth: false, values: ful.values }],
  yMin: 0.5, yMax: 1, yFormat: (v) => pct(v), height: 190, lanes: 1,
  events: [{ at: lowAll.month, lane: 0, text: `Low ${pct(lowAll.value)}`, align: "end" }],
  tip: (i) => ({ title: monthTitle(ful.months, ful.partial, i), rows: [{ tone: "near", label: "Callback success", value: pct(ful.values[i], 1), ci: ci95(ful.ci[i], (c) => rangePct(c, 1)) }] }),
  aria: "Share of sampled requests that end with a successful signature callback, per month",
});
table("table-fulfilled", ["Month", "Callback success", "95% interval"], ful.months.map((m, i) => [monthLabel(m) + (ful.partial[i] ? " (partial)" : ""), pct(ful.values[i], 1), rangePct(ful.ci[i], 1)]));
$("works-notes").innerHTML = `<p>Success means the callback of that sign receipt succeeded. The first months were rougher (${pct(lowAll.value)} in ${monthLabel(lowAll.month)}), mostly because the contract rejected duplicate requests. Hover, tap or use the arrow keys on a chart for the 95% interval; ${monthLabel(lastMonth.month)} is partial and drawn lighter.</p>`;

/* ------------------------------------------------------------------ chapter 2: who uses it (bubbles + ranking) */
const rows = requesterRows(metrics, labels);
const ge1 = T.concentration.requesters_ge_1pct.value, geAny = T.concentration.requesters_ge_1pct_any_month.value;
$("h-who").textContent = `Three requesters make ${approxPct(T.concentration.top3_share.value)} of requests.`;
$("who-intro").textContent = "One square is one percent of all requests.";
const dots = { high: 3, medium: 2, low: 1 };
const labelText = (r) => (r.category === "unknown" && r.suspected ? "Unknown, suspected benchmark" : r.category ? categoryName(r.category) : "Not labeled");
const shareText = (r) => approxPct(r.share, r.share < 0.1 ? 1 : 0);
const WTONE = { "near-infra:bridge-omni": "bridge-dark", "near-infra:bridge-btc": "bridge-mid", "near-infra:bridge-zcash": "bridge-light" };
const wgroups = waffleGroups(rows, 6, (r) => WTONE[r.category] ?? (requesterTone(r) === "muted" ? "base" : requesterTone(r)), requesterName);
createWaffle($("waffle"), {
  groups: wgroups,
  aria: "Waffle chart: 100 squares, each one percent of all requests, coloured by requester",
  text: { shareText: (g) => approxPct(g.share, g.share < 0.1 ? 1 : 0), ciText: (g) => (g.ci ? `95% interval ${rangePct(g.ci, 1)}` : "") },
  footnote: `Each square is 1% of all requests. Squares are rounded by the largest-remainder method so the grid sums to exactly 100: ${wgroups.map((g) => `${g.name} ${g.squares}`).join(", ")}. Exact shares and 95% intervals are in the legend and the list below.`,
});
const sparkLabels = rmonthly.months.map(monthLabel);
const evidenceList = (ev) => `<ul>${ev.map((e) => `<li>${esc(e.claim)} <a href="${esc(e.url)}" rel="noopener noreferrer">source</a></li>`).join("")}</ul>`;
function rankRow(r, k) {
  const axisMax = Math.max(...rows.map((x) => x.shareCi?.[1] ?? x.share)) * 1.05;
  const w = (r.share / axisMax) * 100, lo = ((r.shareCi?.[0] ?? r.share) / axisMax) * 100, hi = ((r.shareCi?.[1] ?? r.share) / axisMax) * 100;
  const series = rmonthly.months.map((m) => rmonthly.accounts[r.account]?.[m] ?? 0);
  const note = [r.note ? `<p>${esc(r.note)}</p>` : "", r.integrator ? `<p><strong>Dominant integrator: ${esc(r.integrator.name)}</strong> (confidence ${esc(r.integrator.confidence)}). ${esc(r.integrator.note ?? "")}</p>${evidenceList(r.integrator.evidence)}` : "", r.evidence.length ? `<p><strong>Evidence for the label</strong></p>${evidenceList(r.evidence)}` : ""].join("");
  return `<div class="rk" style="--i:${k};--w:${w.toFixed(2)}%;--lo:${lo.toFixed(2)}%;--hi:${hi.toFixed(2)}%">
    <div class="who"><span class="nm">${esc(requesterName(r))}</span><span class="acct">${esc(r.account)}</span></div>
    <div class="track" role="img" aria-label="${esc(requesterName(r))}: ${approxPct(r.share, 1)} of requests, 95% interval ${esc(rangePct(r.shareCi, 1))}"><span class="fill t-${requesterTone(r)}"></span><span class="whisk"></span></div>
    <div class="spk t-${requesterTone(r)}">${sparkline(series, { labels: sparkLabels, partialLast: !!lastMonth.partial_month, fmt: approx })}</div>
    <div class="val">${shareText(r)}</div>
    <div class="meta"><span>${esc(labelText(r))}${r.owner ? ` · ${esc(r.owner)}` : ""}</span><span>${r.confidence ? `${esc(r.confidence)} confidence (${dots[r.confidence]}/3)` : "no label"}</span>
      ${note ? `<details><summary>Notes and ${r.evidence.length} source${r.evidence.length === 1 ? "" : "s"}</summary><div>${note}</div></details>` : ""}</div>
  </div>`;
}
const TOP = 6;
$("who-list").innerHTML = rows.slice(0, TOP).map(rankRow).join("") + (rows.length > TOP ? `<details class="more rk-more"><summary>All ${rows.length} requesters</summary>${rows.slice(TOP).map((r, k) => rankRow(r, k)).join("")}</details>` : "");
$("who-notes").innerHTML = `<p>The requester is the account that called <code>sign</code>, not the transaction signer (those are mostly relayers). Only ${ge1} requesters hold 1% or more over the whole period; ${geAny} did so in at least one month. The ${rows.length} largest hold ${approxPct(rows.reduce((a, r) => a + r.share, 0))}. The bar is the share with its 95% interval; each sparkline is that requester’s estimated requests per month on its own scale (the dotted end is the partial month). Every label has evidence links; confidence three of three means an official source or an on-chain fact names the owner.</p>`;

/* ------------------------------------------------------------------ chapter 3: the boom */
const fa = rows.find((r) => r.account === "fast-auth.near");
const rel = T.relayer_share_of_requester["fast-auth.near via sweat-relayer.near"];
let boom = boomSeries(metrics);
const faPeak = boom.series[0].values.reduce((a, v, i) => (!boom.partial[i] && v > a.v ? { v, i } : a), { v: 0, i: 0 });
$("h-boom").textContent = "The boom was one integration, and it is ending.";
$("boom-intro").textContent = `FastAuth logins for Sweat Wallet, which ends ${dayLabel(E.sweatEnds.date)}.`;
const boomTip = (i) => ({
  title: monthTitle(boom.months, boom.partial, i),
  rows: boom.series.filter((s) => s.values[i]).map((s) => ({ tone: s.tone, label: s.label, value: approx(s.values[i]), ci: ci95(s.ci[i]) })),
  footer: `All shown: ${approx(boom.series.reduce((a, s) => a + s.values[i], 0))}`,
});
const boomEvents = [
  { at: E.sweatAnnounced.date, lane: 0, text: "End date announced", href: E.sweatAnnounced.source, align: "end" },
  { at: E.relayExit.month, lane: 1, text: "Relay goes quiet", align: "end" },
  { at: E.fastauthRamp.month, lane: 2, text: "FastAuth ramp", align: "end" },
];
const boomSpec = (excl) => { boom = boomSeries(metrics, { excludeBenchmark: excl }); return { months: boom.months, partial: boom.partial, series: boom.series.map((s) => ({ ...s, type: "bar" })), tip: boomTip }; };
const boomChart = createChart($("chart-boom"), {
  ...boomSpec(false), yFormat: compact, height: height(280, 460, 0.42), lanes: 3, labelMargin: 150, events: boomEvents,
  labels: [{ id: "fastauth", text: "FastAuth" }, { id: "rest", text: "Everyone else" }, { id: "benchmark", text: "Suspected benchmark" }],
  aria: `Estimated requests per month: FastAuth logins (peak ${approx(faPeak.v)} in ${monthLabel(boom.months[faPeak.i])}), everyone else, and the suspected benchmark`,
});
keyList("key-boom", [{ tone: "fastauth", label: "FastAuth" }, { tone: "muted", label: "Everyone else" }, { tone: "hatch", label: "Suspected benchmark" }]);
const fillBoomTable = () => table("table-boom", ["Month", ...boom.series.map((s) => s.label)], boom.months.map((m, i) => [monthLabel(m) + (boom.partial[i] ? " (partial)" : ""), ...boom.series.map((s) => int(s.values[i]))]));
fillBoomTable();
$("excl-bench").addEventListener("change", (e) => { volChart.update(volSpec(e.target.checked)); boomChart.update(boomSpec(e.target.checked)); fillVolumeTable(); fillBoomTable(); });
const ev = scenarios.event;
$("sunset-source").innerHTML = `Announced ${esc(dayLabel(E.sweatAnnounced.date))} by ${esc(ev.issuer.split(" (")[0])}. <a href="${esc(ev.source)}" rel="noopener noreferrer">Source</a>`;

/* scenario sliders: project() is the same arithmetic that produced out/scenarios.json (parity is a unit test) */
const base = scenarios.baseline;
const sgn = (g) => (g > 0 ? "+" : g < 0 ? "−" : "") + pct(Math.abs(g));
const st = { retention: 0, growth: 0, benchmark: false };
$("scenario").innerHTML = `
  <div class="sl"><label for="sl-ret">FastAuth after ${esc(dayLabel(ev.date))} <output id="o-ret"></output></label><input type="range" id="sl-ret" min="0" max="100" step="5" value="0"></div>
  <div class="sl"><label for="sl-gro">Other demand per month <output id="o-gro"></output></label><input type="range" id="sl-gro" min="-10" max="10" step="1" value="0"></div>
  <div class="sl"><label class="check" for="sl-ben"><input type="checkbox" id="sl-ben"><span>Suspected benchmark keeps running</span></label></div>`;
function scenarioSpec() {
  const proj = project(base, { retention: st.retention, benchmark: st.benchmark ? "kept" : "removed", growth: st.growth, horizon: scenarios.horizon.to, endMonth: scenarios.fastauth_end_month });
  const ch = scenarioSeries(metrics, scenarios, proj);
  $("o-ret").textContent = pct(st.retention); $("o-gro").textContent = sgn(st.growth);
  $("scenario-result").textContent = `${monthLabel(proj.end_month)}: ${approx(proj.end_month_total)} requests a month, ${proj.end_month_vs_baseline >= 0 ? "+" : "−"}${pct(Math.abs(proj.end_month_vs_baseline))} against ${monthLabel(base.month)}.`;
  table("table-scenario", ["Month", "Estimated", "Scenario: all", "Scenario: other demand", "Scenario: FastAuth"], ch.months.map((m, i) => [monthLabel(m), ch.history[i] == null ? "" : int(ch.history[i]), ch.total[i] == null ? "" : int(ch.total[i]), ch.structural[i] == null ? "" : int(ch.structural[i]), ch.fastauth[i] == null ? "" : int(ch.fastauth[i])]));
  const baseI = ch.months.indexOf(ch.baselineMonth);
  return {
    months: ch.months, partial: ch.months.map(() => false),
    series: [
      { id: "structural", label: "Other demand", tone: "base", type: "line", values: ch.structural },
      { id: "fastauth", label: "FastAuth", tone: "fastauth", type: "line", values: ch.fastauth },
      { id: "total", label: "All (scenario)", tone: "near", type: "line", dash: true, values: ch.total },
      { id: "history", label: "Estimated", tone: "near", type: "line", values: ch.history },
    ],
    tip: (i) => ({ title: `${monthLabel(ch.months[i])}${i > baseI ? " (scenario)" : ""}`, rows: [["history", "Estimated", ch.history, "near"], ["total", "All", ch.total, "near"], ["fastauth", "FastAuth", ch.fastauth, "fastauth"], ["structural", "Other demand", ch.structural, "base"]].filter((r) => r[2][i] != null).map(([, label, arr, tone]) => ({ tone, label, value: approx(arr[i]) })) }),
  };
}
const scChart = createChart($("chart-scenario"), {
  ...scenarioSpec(), yFormat: compact, height: height(260, 400, 0.38), lanes: 1, labelMargin: 150,
  events: [{ at: E.sweatEnds.date, lane: 0, text: "Sweat ends", href: E.sweatEnds.source, align: "start" }],
  labels: [{ id: "total", text: "All" }, { id: "structural", text: "Other demand" }, { id: "fastauth", text: "FastAuth" }],
  aria: "Monthly requests: recent estimates and the selected scenario",
});
keyList("key-scenario", [{ tone: "near", label: "Estimated, then scenario (dashed)" }, { tone: "fastauth", label: "FastAuth" }, { tone: "base", label: "Other demand" }]);
$("sl-ret").addEventListener("input", (e) => { st.retention = Number(e.target.value) / 100; scChart.update(scenarioSpec()); });
$("sl-gro").addEventListener("input", (e) => { st.growth = Number(e.target.value) / 100; scChart.update(scenarioSpec()); });
$("sl-ben").addEventListener("change", (e) => { st.benchmark = e.target.checked; scChart.update(scenarioSpec()); });
$("scenario-note").innerHTML = `“${esc(ev.statement)}” (${esc(ev.issuer)}). Scenarios, not forecasts. Baseline = ${monthLabel(base.month)}, the last full month: ${approx(base.all)} requests, of which FastAuth ${approx(base.fastauth)}, suspected benchmark ${approx(base.benchmark)}, other demand ${approx(base.structural)}. The sliders use the same arithmetic as the ${scenarios.scenarios.length} precomputed scenarios in out/scenarios.json (<code>assumptions.yaml</code> sets the grid). FastAuth is held at its ${monthLabel(base.month)} level until ${esc(monthLabel(scenarios.fastauth_end_month))} although it has been falling every month. The default (FastAuth stops, benchmark stops, flat other demand) removes both large non-structural parts: a cautious view, not a forecast. Over the whole period FastAuth is ${approxPct(fa.share)} of requests, ${approxPct(rel.value, 2)} of it relayed by <code>sweat-relayer.near</code> (that it is Sweat Wallet is medium confidence).`;

/* ------------------------------------------------------------------ chapter 4: bridges and destinations */
const br = bridgeStack(metrics);
const bi = br.months.indexOf(lastFull), bridgeSum = br.series.reduce((a, s) => a + s.values[bi], 0), pk = metrics.derived.bridges_peak_month;
$("h-bridges").textContent = "Bridges are what remains.";
$("bridges-intro").textContent = `The steadiest demand: ${approxPct(bridgeSum / br.structural.values[bi])} of the non-benchmark, non-FastAuth requests in ${monthLabel(lastFull)}.`;
createChart($("chart-bridges"), {
  months: br.months, partial: br.partial, series: br.series.map((s) => ({ ...s, type: "bar" })), yFormat: compact, height: height(250, 420, 0.38), lanes: 1, labelMargin: 150,
  events: [{ at: E.bridgesPeak.month, lane: 0, text: `Peak ${monthLabel(E.bridgesPeak.month)}`, align: "end" }],
  labels: br.series.map((s) => ({ id: s.id, text: s.label })),
  tip: (i) => ({ title: monthTitle(br.months, br.partial, i), rows: br.series.filter((s) => s.values[i]).map((s) => ({ tone: s.tone, label: s.label, value: approx(s.values[i]), ci: ci95(s.ci[i]) })), footer: `All bridges: ${approx(br.total.values[i])}` }),
  aria: `Estimated bridge connector requests per month, peaking at ${approx(pk.value)} in ${monthLabel(pk.month)}`,
});
keyList("key-bridges", br.series.map((s) => ({ tone: s.tone, label: s.label })));
table("table-bridges", ["Month", ...br.series.map((s) => s.label), "All structural"], br.months.map((m, i) => [monthLabel(m) + (br.partial[i] ? " (partial)" : ""), ...br.series.map((s) => int(s.values[i])), int(br.structural.values[i])]));

const dl = destinationLines(metrics);
const fams = chainFamilies(metrics);
const FAM = { near: "NEAR itself", bitcoin: "Bitcoin", zcash: "Zcash", multi: "Several chains", unknown: "Not known", evm: "EVM chains", solana: "Solana", other: "Other" };
const nearFam = fams.find((f) => f.id === "near");
$("h-chains").textContent = dl.crossover ? `Since ${monthLabel(dl.crossover.month)}, more signatures serve other chains than NEAR` : "Where the signatures go";
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
  yMin: 0, yMax: 1, yFormat: (v) => pct(v), height: height(260, 400, 0.36), lanes: 1, labelMargin: 150,
  events: dl.crossover ? [{ at: dl.crossover.month, lane: 0, text: "Crossover", align: "end" }] : [],
  labels: [{ id: "near", text: "NEAR itself" }, { id: "other", text: "Other chains" }, { id: "unknown", text: "Not known" }],
  tip: (i) => ({ title: monthTitle(dl.months, dl.partial, i), rows: dlRows(i) }),
  aria: "Monthly share of requests by destination: NEAR itself, other chains, and not known",
});
keyList("key-chains", [{ tone: "near", label: "NEAR itself" }, { tone: "other", label: "Other chains" }, { tone: "unknown", label: "Not known" }]);
table("table-chains", ["Month", "NEAR itself", "Other chains", "Not known"], dl.months.map((m, i) => [monthLabel(m), pct(dl.near.values[i], 1), pct(dl.other.values[i], 1), pct(dl.unknown.values[i], 1)]));
$("families").innerHTML = fams.map((f) => `<div class="row"><span>${esc(FAM[f.id] ?? f.id)}</span><span class="bar" aria-hidden="true"><i style="width:${(f.share * 100).toFixed(1)}%"></i></span><span>${approxPct(f.share)} (${rangePct(f.ci)})</span></div>`).join("");
$("chains-note").textContent = `“NEAR itself” means keys of NEAR accounts (FastAuth logins); the grey band is “not known” (no evidence-backed rule). Over the whole period NEAR itself is ${approxPct(nearFam.share)}, resting mostly on one medium-confidence rule.`;

/* ------------------------------------------------------------------ chapter 5: what would prove us wrong (prediction cards from config/predictions.json) */
const lead = (b) => { const m = /^\*\*([^*]+?):?\*\*\s*(.*)$/s.exec(b); return m ? `<strong>${esc(m[1])}</strong>${inline(m[2].replace(/^[a-z]/, (c) => c.toUpperCase()))}` : inline(b); };
$("nearview").innerHTML = S["what-this-means-for-a-long-term-near-view"].bullets.map((b) => `<li>${lead(b)}</li>`).join("");
const pend = pendingInfo(predictions.check_after);
const FMT = { pct: (v) => pct(v), pct1: (v) => pct(v, 1), int: (v) => String(v), k: (v) => compact(v) };
$("wrong-intro").textContent = "Four tests, set before the data exists.";
$("preds").innerHTML = predictions.predictions.map((p) => {
  const lines = predictionLines(p, metrics, FMT);
  const need = p.needed === 1 ? "in any of" : p.needed === p.months.length ? "in each of" : `in ${p.needed} of`;
  return `<div class="pred"><h3>${esc(p.claim)}</h3>
    <ul>${lines.map((l) => `<li>Wrong if ${esc(l)}</li>`).join("")}</ul>
    <p class="small">${need} ${p.months.length} months: ${esc(p.months.map(monthLabel).join(", "))}</p>
    <div class="when">${pend.pending ? `Pending until ${esc(dayLabel(predictions.check_after))}<b>${pend.days} days</b>` : "Due: run <code>npm run check:predictions</code>"}</div></div>`;
}).join("");
const wrongSec = S["what-would-prove-this-thesis-wrong"];
$("wrong-full").innerHTML = `<p>${inline(wrongSec.markdown.split(/\n\n+/)[0].replace(/\n/g, " "))}</p>` + `<ul>${wrongSec.bullets.map((b) => { const { claim, why } = splitWhy(b); return `<li>${inline(claim)}${why ? ` <span class="small">${inline(why)}</span>` : ""}</li>`; }).join("")}</ul><p>Check after the date with <code>npm run check:predictions</code> (rules in <code>config/predictions.json</code>).</p>`;

/* ------------------------------------------------------------------ chapter 6: verify it yourself */
$("verify-intro").textContent = "One click, one sampled transaction, checked on a public node.";
setupVerify({ button: $("verify-btn"), out: $("verify-out"), sample: vsample, command: `npm run verify -- --sample ${verify.sample}` });

/* ------------------------------------------------------------------ chapter 7: re-run it, and the evidence */
const hash = manifest.files["data/metrics.json"];
const steps = [
  ["npm test", "Unit tests, including that every number in the documents comes from the JSON outputs."],
  ["npm run reproduce", `Rebuilds out/metrics.json and THESIS.md offline. Prints sha256 ${hash.slice(0, 12)}… (this page was built from that file).`],
  [`npm run verify -- --sample ${verify.sample}`, `Re-checks ${verify.sample} random transactions at an archival node and NearBlocks. Last run: ${verify.verified}/${verify.sample}.`],
  ["npm run check:predictions", "Shows each test as pending until its date, then evaluates it against fresh data."],
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
  block("Read more", `<p><a href="docs/THESIS.md">THESIS.md</a> (every number footnoted to its JSON path) · <a href="docs/METHODOLOGY.md">METHODOLOGY.md</a> · <a href="data/metrics.json">metrics.json</a> (open data, free to reuse).</p>`),
].join("");
$("foot").innerHTML = `Data: exact transaction counts as of block ${int(metrics.meta.snapshot.block_height)} (${snapshotDay}); requests are estimates from a cluster sample. metrics.json sha256 <code>${hash}</code>. No cookies, no tracking. The page makes no network request except when you press “Check a random transaction”.`;

/* ------------------------------------------------------------------ motion: fade-in on scroll, ranked bars, nav highlight, the "+" fields */
const reveal = [...document.querySelectorAll(".hero .wrap > *, .chapter .ch-head, .chapter .ch-body > *, .rerun .ch > *")];
reveal.forEach((el) => el.setAttribute("data-reveal", ""));
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
reveal.forEach((el) => io.observe(el));
const rkio = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rkio.unobserve(e.target); } }), { threshold: 0.3 });
document.querySelectorAll(".rk").forEach((el) => rkio.observe(el));
document.querySelector(".rk-more")?.addEventListener("toggle", (e) => { if (e.target.open) e.target.querySelectorAll(".rk").forEach((r) => r.classList.add("in")); });
const navLinks = [...document.querySelectorAll("#nav a")];
const navIo = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) navLinks.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === `#${e.target.id}`))); }), { rootMargin: "-30% 0px -60% 0px" });
document.querySelectorAll("main section[id]").forEach((s) => navIo.observe(s));
createPlusField($("top"));
createPlusField($("rerun"));

document.documentElement.dataset.ready = "1";
document.documentElement.dataset.readyMs = String(Math.round(performance.now()));
if (!reducedMotion() && $("count-req")) $("count-req").textContent = "≈0"; // starts at zero, counts up once the page is on screen
whenShown(350).then(() => { stroke.play(); countUp(); });
