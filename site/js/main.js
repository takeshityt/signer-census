// Dashboard wiring (version 3, "case file", round 2). Every number on the page is read from site/data/*.json (copied from out/ and config/ at build);
// nothing is typed here. Texts are short templates around those numbers. Colors live in css/style.css; motion in charts.js, motion.js, dot-columns.js, waffle.js.
import { compact, approx, precise, pct, approxPct, range, rangePct, int, monthLabel, monthShort, dayLabel } from "./format.js";
import { inline, esc } from "./md.js";
import { createChart, tween, reducedMotion, whenShown } from "./charts.js";
import { createWaffle, waffleGroups } from "./waffle.js";
import { createDotColumns } from "./dot-columns.js";
import { createPlusField } from "./plus-field.js";
import { sparkline } from "./spark.js";
import { setupVerify } from "./verify-ui.js";
import { project } from "./scenario-core.js";
import { pendingInfo } from "./predictions-core.js";
import { onceVisible, tileHover, revealLines, typeOn, flip, roll } from "./motion.js";
import {
  headline, splitHeadline, volumeSeries, fulfilledSeries, bridgeStack, destinationLines, timelineEvents, requesterRows, requesterName, requesterTone, splitWhy,
  chainFamilies, scenarioSeries, predictionLines, predictionGauges, categoryName, fullMonths, heroStats, heroColumns, boomScene,
} from "./model.js";

const $ = (id) => document.getElementById(id);
const getJSON = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(`cannot load data/${f}`); return r.json(); });
const [metrics, scenarios, labels, verify, thesis, manifest, predictions, vsample, rmonthly, repo] = await Promise.all(["metrics.json", "scenarios.json", "labels.json", "verify.json", "thesis.json", "manifest.json", "predictions.json", "verify-sample.json", "requester-monthly.json", "repo.json"].map(getJSON));
const hero = heroStats(metrics, verify);
const E = timelineEvents(metrics, scenarios);
const T = metrics.totals;
const snapshotDay = dayLabel(hero.snapshotTime);
const S = thesis.sections;
const full = fullMonths(metrics);
const lastFull = full.at(-1).month;
const lastMonth = metrics.months.at(-1);
const ev = scenarios.event;
const calm = reducedMotion();
const desktop = () => matchMedia("(min-width: 1000px)").matches;

/* ------------------------------------------------------------------ theme: dark by default, light as the alternative */
const themeBtn = $("theme");
const curTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
function paintThemeBtn() { const next = curTheme() === "dark" ? "light" : "dark"; themeBtn.textContent = next === "light" ? "Light" : "Dark"; themeBtn.setAttribute("aria-label", `Switch to the ${next} theme`); }
themeBtn.addEventListener("click", () => {
  const next = curTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch { /* storage may be blocked */ }
  paintThemeBtn();
});
paintThemeBtn();

/* ------------------------------------------------------------------ small helpers */
const twoTone = (id, a, b) => { $(id).innerHTML = `<span class="t1">${esc(a)}</span>${b ? `<span class="t2">${esc(b)}</span>` : ""}`; };
const keyList = (id, items) => { $(id).innerHTML = items.map((i) => `<li class="t-${i.tone}"><span class="sw"></span>${esc(i.label)}</li>`).join(""); };
function table(id, head, rows) {
  $(id).innerHTML = `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table>`;
}
const monthTitle = (months, partial, i) => `${monthLabel(months[i])}${partial?.[i] ? ` (partial, data to ${snapshotDay})` : ""}`;
const ci95 = (ci, f = range) => (ci ? `95% interval ${f(ci)}` : null);
const height = (min, max, k) => (w) => Math.min(max, Math.max(min, w * k));
/** A big dot-matrix number; "≈", "." and "/" are set in the mono face (the dot font's period reads like a comma). */
const dotNum = (s) => {
  const t = String(s), body = t.startsWith("≈") ? t.slice(1) : t;
  return (t.startsWith("≈") ? `<span class="ap">≈</span>` : "") + esc(body).replace(/[./]/g, (c) => `<span class="dp">${c}</span>`);
};
const numTile = (label, value, sub) => `<div class="numtile"><p class="micro">${esc(label)}</p><p class="bignum">${dotNum(value)}</p>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>`;
/** Long account ids are shortened (7eda04920f…aurora); the full id shows on hover and focus. */
const acct = (a) => (a.includes(" ") || a.length <= 32 ? esc(a) : `<span class="acct-short" tabindex="0" title="${esc(a)}" aria-label="${esc(a)}"><span class="acct-cut" aria-hidden="true">${esc(a.slice(0, 10))}…${esc(a.split(".").pop())}</span><span class="acct-full" aria-hidden="true">${esc(a)}</span></span>`);
const tickStep = (lo, hi, k) => Array.from({ length: k + 1 }, (_, j) => lo + ((hi - lo) * j) / k); // clean ticks from an axis range

/* ------------------------------------------------------------------ hero: dot-matrix columns + the fast-auth.near case card */
const rows = requesterRows(metrics, labels);
const fa = rows.find((r) => r.account === "fast-auth.near");
const shareText = (r) => approxPct(r.share, r.share < 0.1 ? 1 : 0);
$("statusline").innerHTML = `<span><span class="pip" aria-hidden="true"></span><b>Signer Census</b> · NEAR Chain Signatures · v1.signer · data to ${esc(snapshotDay)}</span><span>Block ${esc(int(metrics.meta.snapshot.block_height))} · ${esc(monthLabel(hero.firstMonth))} to ${esc(monthLabel(lastMonth.month))}</span>`;
const [h1a, h1b] = splitHeadline(headline(thesis));
twoTone("h1", h1a, h1b);
$("deck").textContent = "A reproducible count of who asks NEAR’s MPC signer to sign, and for which chains. Each column is a month of requests.";
$("counters").innerHTML = [
  ["Signature requests", dotNum(approx(hero.requests))],
  ["Fulfilled", dotNum(pct(hero.fulfilled, 1))],
  ["Verified on-chain", dotNum(`${hero.verified}/${hero.sample}`)],
].map(([l, v]) => `<div><dt>${esc(l)}</dt><dd>${v}</dd></div>`).join("");
const cols = heroColumns(metrics);
const faVals = cols.groups.find((g) => g.id === "fastauth").values;
const faPeakI = faVals.reduce((a, v, i) => (!cols.partial[i] && v > faVals[a] ? i : a), 0);
$("casecard").innerHTML = `<div class="ch-line"><span class="micro">Case · ${esc(fa.account)}</span><span class="flag pulse-soft">Winding down</span></div>
  <p class="big">${dotNum(shareText(fa))}<small>of all requests</small></p>
  <dl><div class="row"><dt>Peak month</dt><dd>${esc(monthLabel(cols.months[faPeakI]))} · ${esc(approx(faVals[faPeakI]))}</dd></div>
  <div class="row"><dt>Dominant integrator</dt><dd>${esc(fa.integrator.name.split(" (")[0])} (confidence ${esc(fa.integrator.confidence)})</dd></div>
  <div class="row"><dt>Present form ends</dt><dd>${esc(dayLabel(ev.date))}</dd></div>
  <div class="row"><dt>Source</dt><dd><a href="${esc(ev.source)}" rel="noopener noreferrer">${esc(new URL(ev.source).host)}</a></dd></div></dl>`;
const leadLine = document.createElement("div"); leadLine.className = "card-lead"; leadLine.setAttribute("aria-hidden", "true");
$("dotcols").after(leadLine);
const dc = createDotColumns($("dotcols"), {
  data: cols,
  labelFor: (m) => (m.endsWith("-01") ? `’${m.slice(2, 4)}` : ""),
  aria: (per) => `Dot-matrix column chart: one column per month from ${monthLabel(cols.months[0])} to ${monthLabel(cols.months.at(-1))}, one dot = ${compact(per)} requests, coloured by FastAuth, bridges, suspected benchmark and everyone else. FastAuth peaks in ${monthLabel(cols.months[faPeakI])}.`,
  onLayout: ({ W, peaks }) => {
    // the case card sits in the empty top-left of the chart (the early months are small) and points at the FastAuth peak
    const card = $("casecard"), p = peaks.fastauth;
    if (!p || W < 560) { card.style.left = card.style.top = ""; leadLine.style.display = "none"; return; }
    card.style.left = "0px"; card.style.top = "0px";
    const cw = card.offsetWidth, x0 = cw, y0 = 34, x1 = p.x, y1 = p.y;
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    leadLine.style.cssText = `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px`;
    leadLine.innerHTML = `<svg width="${w}" height="${h}"><path d="M0,0 H${Math.max(0, w - 14)} L${w},${h}"/><circle cx="${w}" cy="${h}" r="3"/></svg>`;
  },
});
keyList("key-hero", [{ tone: "fastauth", label: "FastAuth" }, { tone: "bridge-dark", label: "Bridges" }, { tone: "hatch", label: "Suspected benchmark" }, { tone: "muted", label: "Everyone else" }]);
$("key-hero").insertAdjacentHTML("beforeend", `<li class="unit">One dot = ${esc(compact(dc.per))} requests</li>`);
$("hero-notes").innerHTML = `<p>Requests are estimated: exact monthly transaction totals times the share of sign receipts in a cluster sample; 95% interval (sampling error only) ${esc(range(hero.requestsCi, precise))}. “Fulfilled” = the callback of the sign receipt succeeded, in the sample; latency and downtime are not measured. “Verified on-chain” = ${hero.sample} sampled transactions re-parsed identically by an archival RPC node and NearBlocks (${esc(dayLabel(hero.verifyDate))}); it checks the parsing, not the estimate.</p><p>Columns: one dot = ${esc(compact(dc.per))} requests, rounded per month; ${esc(monthLabel(lastMonth.month))} is partial and drawn lighter. Every number is read from <code>out/metrics.json</code>, also served as <a href="data/metrics.json">data/metrics.json</a>.</p>`;

/* ------------------------------------------------------------------ chapter: it works */
twoTone("h-works", "It works.", "Almost every request ends in a signature.");
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
const volSpec = (excl) => { vol = volumeSeries(metrics, { excludeBenchmark: excl }); return { months: vol.months, partial: vol.partial, series: vol.series.map((s) => ({ ...s, type: "bar" })), tip: volTip }; };
volChart = createChart($("chart-volume"), {
  ...volSpec(false), yFormat: compact, height: height(240, 380, 0.4), lanes: 1, labelMargin: 140, layered: true, duration: 1700,
  events: [{ at: hero.peakMonth, lane: 0, text: `Peak ${monthLabel(hero.peakMonth)}`, align: "end" }],
  labels: [{ id: "all", text: "Requests" }, { id: "benchmark", text: "Suspected benchmark" }],
  aria: `Estimated signature requests per month, peaking at ${approx(hero.peakValue)} in ${monthLabel(hero.peakMonth)}, with the suspected benchmark hatched on top`,
});
keyList("key-volume", [{ tone: "base", label: "Requests" }, { tone: "hatch", label: "Suspected benchmark" }]);
const fillVolumeTable = () => table("table-volume", ["Month", "Requests", "Suspected benchmark"], vol.months.map((m, i) => [monthLabel(m) + (vol.partial[i] ? " (partial)" : ""), int(vol.series[0].values[i]), int(vol.series[1].values[i])]));
fillVolumeTable();
$("excl-bench").addEventListener("change", (e) => { volChart.update(volSpec(e.target.checked)); fillVolumeTable(); });
$("works-n1-label").textContent = "Without the suspected benchmark";
$("works-n1").innerHTML = dotNum(approx(hero.withoutBenchmark));
const ful = fulfilledSeries(metrics);
const lowSince = metrics.derived.fulfilled_rate_lowest_month_since, lowAll = metrics.derived.fulfilled_rate_lowest_month;
$("h-fulfilled").textContent = `Never below ${pct(lowSince.value, 1)} since ${monthLabel(lowSince.since)}`;
createChart($("chart-fulfilled"), {
  months: ful.months, partial: ful.partial, series: [{ id: "rate", label: "Success", tone: "near", type: "line", values: ful.values }],
  yMin: 0.5, yMax: 1, yTicks: tickStep(0.5, 1, 2), yFormat: (v) => pct(v), height: 160, lanes: 1, duration: 1500,
  events: [{ at: lowAll.month, lane: 0, text: `Low ${pct(lowAll.value)}`, align: "end" }],
  tip: (i) => ({ title: monthTitle(ful.months, ful.partial, i), rows: [{ tone: "near", label: "Callback success", value: pct(ful.values[i], 1), ci: ci95(ful.ci[i], (c) => rangePct(c, 1)) }] }),
  aria: "Share of sampled requests that end with a successful signature callback, per month",
});
table("table-fulfilled", ["Month", "Callback success", "95% interval"], ful.months.map((m, i) => [monthLabel(m) + (ful.partial[i] ? " (partial)" : ""), pct(ful.values[i], 1), rangePct(ful.ci[i], 1)]));
$("works-notes").innerHTML = `<p>Success means the callback of that sign receipt succeeded. The first months were rougher (${pct(lowAll.value)} in ${monthLabel(lowAll.month)}), mostly because the contract rejected duplicate requests. Hover, tap or use the arrow keys on a chart for the 95% interval; ${monthLabel(lastMonth.month)} is partial and drawn lighter.</p>`;

/* ------------------------------------------------------------------ chapter: who uses it */
const ge1 = T.concentration.requesters_ge_1pct.value, geAny = T.concentration.requesters_ge_1pct_any_month.value;
twoTone("h-who", "Demand is narrow.", `Three requesters make ${approxPct(T.concentration.top3_share.value)} of requests.`);
const dots = { high: 3, medium: 2, low: 1 };
const WTONE = { "near-infra:bridge-omni": "bridge-dark", "near-infra:bridge-btc": "bridge-mid", "near-infra:bridge-zcash": "bridge-light" };
const toneOf = (r) => WTONE[r.category] ?? requesterTone(r);
const labelText = (r) => (r.category === "unknown" && r.suspected ? "Unknown, suspected benchmark" : r.category ? categoryName(r.category) : "Not labeled");
const shortOwner = (o) => (o ? o.split(/ \(| per |;|,/)[0].trim() : "");
const wgroups = waffleGroups(rows, 6, (r) => WTONE[r.category] ?? (requesterTone(r) === "muted" ? "base" : requesterTone(r)), requesterName);
createWaffle($("waffle"), {
  groups: wgroups,
  aria: "Square matrix: 100 squares, each one percent of all requests, coloured by requester",
  text: { shareText: (g) => approxPct(g.share, g.share < 0.1 ? 1 : 0), ciText: (g) => (g.ci ? `95% interval ${rangePct(g.ci, 1)}` : ""), acct },
  footnote: `Squares are rounded by the largest-remainder method so the grid sums to exactly 100: ${wgroups.map((g) => `${g.name} ${g.squares}`).join(", ")}. Exact shares and 95% intervals are in the legend and the list below.`,
});
const top15 = rows.reduce((a, r) => a + r.share, 0);
$("who-nums").innerHTML = numTile("Requesters with 1% or more", String(ge1), "over the whole period") + numTile("Reached 1% in some month", String(geAny), `95% interval ${range(T.concentration.requesters_ge_1pct_any_month.ci95, String)}`) + numTile(`The ${rows.length} largest hold`, approxPct(top15), "of all requests");
const sparkLabels = rmonthly.months.map(monthLabel);
const evidenceList = (evs) => `<ul>${evs.map((e) => `<li>${esc(e.claim)} <a href="${esc(e.url)}" rel="noopener noreferrer">source</a></li>`).join("")}</ul>`;
const axisMax = Math.max(...rows.map((x) => x.shareCi?.[1] ?? x.share)) * 1.05;
function rankRow(r, k) {
  const w = (r.share / axisMax) * 100, lo = ((r.shareCi?.[0] ?? r.share) / axisMax) * 100, hi = ((r.shareCi?.[1] ?? r.share) / axisMax) * 100;
  const series = rmonthly.months.map((m) => rmonthly.accounts[r.account]?.[m] ?? 0);
  const note = [r.owner ? `<p><strong>Owner:</strong> ${esc(r.owner)}</p>` : "", r.note ? `<p>${esc(r.note)}</p>` : "", r.integrator ? `<p><strong>Dominant integrator: ${esc(r.integrator.name)}</strong> (confidence ${esc(r.integrator.confidence)}). ${esc(r.integrator.note ?? "")}</p>${evidenceList(r.integrator.evidence)}` : "", r.evidence.length ? `<p><strong>Evidence for the label</strong></p>${evidenceList(r.evidence)}` : ""].join("");
  const meta = [labelText(r), shortOwner(r.owner), r.confidence ? `${r.confidence} confidence (${dots[r.confidence]}/3)` : "no label"].filter(Boolean).join(" · ");
  return `<div class="rk" style="--i:${k};--w:${w.toFixed(2)}%;--lo:${lo.toFixed(2)}%;--hi:${hi.toFixed(2)}%">
    <div class="who"><span class="nm">${esc(requesterName(r))}</span><span class="acct">${acct(r.account)}</span></div>
    <div class="track" role="img" aria-label="${esc(requesterName(r))}: ${approxPct(r.share, 1)} of requests, 95% interval ${esc(rangePct(r.shareCi, 1))}"><span class="fill t-${requesterTone(r)}"></span><span class="whisk"></span></div>
    <div class="spk t-${toneOf(r) === "muted" ? "base" : toneOf(r)}">${sparkline(series, { labels: sparkLabels, partialLast: !!lastMonth.partial_month, fmt: approx })}</div>
    <div class="val">${shareText(r)}</div>
    <div class="meta"><span>${esc(meta)}</span>${note ? `<details><summary>Notes and ${r.evidence.length} source${r.evidence.length === 1 ? "" : "s"}</summary><div>${note}</div></details>` : ""}</div>
  </div>`;
}
const TOP = 6;
$("who-list").innerHTML = rows.slice(0, TOP).map(rankRow).join("") + (rows.length > TOP ? `<details class="more rk-more"><summary>All ${rows.length} requesters</summary>${rows.slice(TOP).map((r, k) => rankRow(r, k)).join("")}</details>` : "");
$("who-notes").innerHTML = `<p>The requester is the account that called <code>sign</code>, not the transaction signer (those are mostly relayers). The bar is the share with its 95% interval; each sparkline is that requester’s estimated requests per month on its own scale (the dotted end is the partial month). Every label has evidence links; confidence three of three means an official source or an on-chain fact names the owner.</p>`;

/* ------------------------------------------------------------------ chapter: the boom — a scroll-driven scene (desktop), a static annotated chart otherwise */
const rel = T.relayer_share_of_requester["fast-auth.near via sweat-relayer.near"];
const relayRow = rows.find((r) => /relay/i.test(requesterName(r)));
const sc = boomScene(metrics, scenarios, relayRow.account);
const defaultSc = scenarios.scenarios.find((s) => s.id === sc.scenarioId);
twoTone("h-boom", "The boom was one integration.", `Its product ends in present form on ${dayLabel(ev.date)}.`);
const ramp = E.fastauthRamp, relayFrom = E.relayExit.month;
const EVENTS = [
  { at: ramp.month, lane: 2, text: "FastAuth ramp", align: "end" },
  { at: relayFrom, lane: 1, text: "Relay goes quiet", align: "end" },
  { at: ev.date, lane: 0, text: "Sweat ends · scenario after", href: ev.source, align: "start" },
];
const zero = sc.months.map(() => 0);
function boomStage(stage) {
  const split = stage >= 2;
  const series = [
    { id: "rest", label: split ? "Everyone else" : "Everyone else (incl. Relay)", tone: "muted", type: "bar", values: (split ? sc.rest : sc.restWithRelay).map((v, i) => v + (stage >= 1 ? 0 : sc.fastauth[i])) },
    { id: "relay", label: "Relay Protocol", tone: "relay", type: "bar", values: split ? sc.relay : zero },
    { id: "fastauth", label: "FastAuth", tone: "fastauth", type: "bar", values: stage >= 1 ? sc.fastauth : zero },
    { id: "benchmark", label: "Suspected benchmark", tone: "hatch", type: "bar", values: sc.benchmark },
    { id: "ghost", label: "Scenario, not a forecast", tone: "ghost", type: "bar", values: stage >= 3 ? sc.ghost : zero },
  ];
  return { months: sc.months, partial: sc.partial, series, events: EVENTS.slice(0, stage), tip: (i) => ({ title: `${monthTitle(sc.months, sc.partial, i)}${sc.future.includes(sc.months[i]) ? " (scenario, not a forecast)" : ""}`, rows: series.filter((s) => s.values[i]).map((s) => ({ tone: s.tone, label: s.label, value: approx(s.values[i]) })) }) };
}
const STAGE_LABEL = ["Requests per month · everyone in grey", "Step 1 · FastAuth logins arrive", "Step 2 · Relay goes quiet", "Step 3 · after the end date: scenario, not a forecast"];
const sceneMode = desktop() && !calm;
let stageNow = sceneMode ? 0 : 3;
const boomChart = createChart($("chart-boom"), {
  ...boomStage(stageNow), yFormat: compact, height: height(280, 460, 0.5), lanes: 3, labelMargin: 150, duration: 1200,
  labels: [{ id: "fastauth", text: "FastAuth", index: sc.months.indexOf(lastFull) }, { id: "relay", text: "Relay", index: sc.months.indexOf(E.relayExit.lastActive ?? relayFrom) }, { id: "rest", text: "Everyone else", index: sc.months.indexOf(lastFull) }, { id: "ghost", text: "Scenario", index: sc.months.length - 1 }],
  aria: `Estimated requests per month by requester (FastAuth, Relay Protocol, the suspected benchmark, everyone else), followed by the default scenario after ${dayLabel(ev.date)}: a scenario, not a forecast`,
});
keyList("key-boom", [{ tone: "fastauth", label: "FastAuth" }, { tone: "relay", label: "Relay Protocol" }, { tone: "muted", label: "Everyone else" }, { tone: "hatch", label: "Suspected benchmark" }, { tone: "ghost", label: "Scenario, not a forecast" }]);
$("boom-stage-label").textContent = STAGE_LABEL[stageNow];
const fin = boomStage(3);
table("table-boom", ["Month", ...fin.series.map((s) => s.label)], sc.months.map((m, i) => [monthLabel(m) + (sc.partial[i] ? " (partial)" : sc.future.includes(m) ? " (scenario)" : ""), ...fin.series.map((s) => int(s.values[i]))]));
$("accent-tile").innerHTML = `<p class="micro">One integration · ${esc(fa.account)}</p><div><p class="huge">${dotNum(shareText(fa))}</p><p class="line">of all requests since ${esc(monthLabel(hero.firstMonth))}. ${approxPct(rel.value, 2)} of it relayed by sweat-relayer.near.</p></div>`;
const STEPS = [
  ["Ramp", monthLabel(ramp.month), "FastAuth logins arrive", `<span class="stepcount" data-to="${ramp.value}">${esc(approx(ramp.value))}</span> requests in ${esc(monthLabel(ramp.month))} alone.`],
  ["Exit", monthLabel(relayFrom), "Relay goes quiet", `Relay Protocol, the largest third-party app: none in the sample from ${esc(monthLabel(relayFrom))}.`],
  ["Sunset", dayLabel(ev.date), "Sweat Wallet ends in present form", `Announced ${esc(dayLabel(E.sweatAnnounced.date))}. The translucent bars after it are the cautious default scenario: a scenario, not a forecast.`],
];
$("boom-steps").innerHTML = STEPS.map(([st, when, title, text], i) => `<li class="step-card" data-stage="${i + 1}"><p class="st"><i aria-hidden="true"></i>${String(i + 1).padStart(2, "0")} · ${esc(st)} · ${esc(when)}</p><h3>${esc(title)}</h3><p>${text}</p></li>`).join("");
function setStage(n) {
  if (n === stageNow) return;
  stageNow = n;
  $("boom-stage-label").textContent = STAGE_LABEL[n];
  document.querySelectorAll("#boom-steps .step-card").forEach((li) => li.classList.toggle("on", Number(li.dataset.stage) <= n));
  boomChart.update(boomStage(n));
  if (n === 1) { const c = document.querySelector(".stepcount"); if (c) roll(0, Number(c.dataset.to), (v) => { c.textContent = approx(v); }, 900); }
}
if (sceneMode) {
  $("boom-scene").classList.add("scroll-scene");
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) setStage(Number(e.target.dataset.stage)); }, { rootMargin: "-45% 0px -45% 0px" });
  document.querySelectorAll("#boom-steps .step-card").forEach((li) => io.observe(li));
  // scrolling back above the first step returns to the grey start
  const first = document.querySelector('#boom-steps .step-card[data-stage="1"]');
  new IntersectionObserver((es) => { for (const e of es) if (!e.isIntersecting && e.boundingClientRect.top > innerHeight * 0.5) setStage(0); }, { rootMargin: "-45% 0px -45% 0px" }).observe(first);
} else {
  document.querySelectorAll("#boom-steps .step-card").forEach((li) => li.classList.add("on"));
}

/* ------------------------------------------------------------------ chapter: bridges */
const br = bridgeStack(metrics);
const bi = br.months.indexOf(lastFull), bridgeSum = br.series.reduce((a, s) => a + s.values[bi], 0), pk = metrics.derived.bridges_peak_month;
twoTone("h-bridges", "Bridges remain.", "The demand that stays — still young and uneven.");
createChart($("chart-bridges"), {
  months: br.months, partial: br.partial,
  series: [...br.series.map((s) => ({ ...s, type: "bar" })), { id: "trend", label: "All bridges", tone: "trend", type: "line", tail: false, values: br.total.values }],
  yFormat: compact, height: height(240, 380, 0.4), lanes: 1, labelMargin: 140, layered: true, linesAfter: true, duration: 2400,
  events: [{ at: E.bridgesPeak.month, lane: 0, text: `Peak ${monthLabel(E.bridgesPeak.month)}`, align: "end" }],
  labels: br.series.map((s) => ({ id: s.id, text: s.label })),
  tip: (i) => ({ title: monthTitle(br.months, br.partial, i), rows: br.series.filter((s) => s.values[i]).map((s) => ({ tone: s.tone, label: s.label, value: approx(s.values[i]), ci: ci95(s.ci[i]) })), footer: `All bridges: ${approx(br.total.values[i])}` }),
  aria: `Estimated bridge connector requests per month (Omni, Bitcoin, Zcash), peaking at ${approx(pk.value)} in ${monthLabel(pk.month)}`,
});
keyList("key-bridges", br.series.map((s) => ({ tone: s.tone, label: s.label })));
table("table-bridges", ["Month", ...br.series.map((s) => s.label), "All structural"], br.months.map((m, i) => [monthLabel(m) + (br.partial[i] ? " (partial)" : ""), ...br.series.map((s) => int(s.values[i])), int(br.structural.values[i])]));
$("bridge-nums").innerHTML = numTile(`Peak · ${monthLabel(pk.month)}`, approx(pk.value), "bridge requests in one month") + numTile(monthLabel(lastFull), approx(bridgeSum), `${approxPct(Math.abs(metrics.derived.bridges_last_full_vs_peak))} below the peak`) + numTile("Of structural demand", approxPct(bridgeSum / br.structural.values[bi]), `in ${monthLabel(lastFull)}: everything but FastAuth and the benchmark`);
const dl = destinationLines(metrics);
const fams = chainFamilies(metrics);
const FAM = { near: "NEAR itself", bitcoin: "Bitcoin", zcash: "Zcash", multi: "Several chains", unknown: "Not known", evm: "EVM chains", solana: "Solana", other: "Other" };
const nearFam = fams.find((f) => f.id === "near");
// low-volume early months (shares are noisy): months before the first one with at least 2% of the peak month's requests (rule from the data)
const peakReq = Math.max(...metrics.months.map((m) => m.requests_est.value));
const lowUntil = Math.max(0, metrics.months.findIndex((m) => m.requests_est.value >= 0.02 * peakReq));
$("h-chains").textContent = dl.crossover ? `Where signatures go · since ${monthLabel(dl.crossover.month)} more serve other chains than NEAR` : "Where signatures go";
const UNKNOWN_WHY = "mostly the suspected benchmark — its requests carry no target path";
const dlRows = (i) => [
  { tone: "near", label: "NEAR itself", value: pct(dl.near.values[i], 1), ci: ci95(dl.near.ci[i], (c) => rangePct(c, 1)) },
  { tone: "other", label: "Other chains", value: pct(dl.other.values[i], 1), ci: ci95(dl.other.ci[i], (c) => rangePct(c, 1)) },
  { tone: "unknown", label: "Not known", value: pct(dl.unknown.values[i], 1), ci: UNKNOWN_WHY },
];
const crossI = dl.crossover ? dl.months.indexOf(dl.crossover.month) : -1;
const midUnknown = dl.unknown.values.reduce((a, v, i) => (i >= lowUntil && v > dl.unknown.values[a] ? i : a), lowUntil);
createChart($("chart-chains"), {
  months: dl.months, partial: dl.partial, bandTop: 1,
  series: [
    { id: "unknown", label: "Not known", tone: "unknown", type: "band", hatch: true, values: dl.unknown.values.map((v) => 1 - v) },
    { id: "near", label: "NEAR itself", tone: "near", type: "line", values: dl.near.values },
    { id: "other", label: "Other chains", tone: "other", type: "line", values: dl.other.values },
  ],
  yMin: 0, yMax: 1, yTicks: tickStep(0, 1, 4), yFormat: (v) => pct(v), height: height(220, 340, 0.3), lanes: 1, labelMargin: 140, duration: 1500,
  shade: lowUntil > 0 ? { to: lowUntil, label: "low volume — shares are noisy" } : null,
  areaLabel: { id: "unknown", index: midUnknown, text: "Not known" },
  pulse: crossI >= 0 ? { id: "other", index: crossI } : null,
  events: crossI >= 0 ? [{ at: dl.crossover.month, lane: 0, text: "Crossover", align: "end" }] : [],
  labels: [{ id: "near", text: "NEAR itself" }, { id: "other", text: "Other chains" }],
  tip: (i) => ({ title: monthTitle(dl.months, dl.partial, i), rows: dlRows(i) }),
  aria: `Monthly share of requests by destination: NEAR itself, other chains, and not known (${UNKNOWN_WHY}); months before ${monthLabel(dl.months[lowUntil])} have low volume`,
});
keyList("key-chains", [{ tone: "near", label: "NEAR itself" }, { tone: "other", label: "Other chains" }, { tone: "unknown", label: "Not known" }]);
table("table-chains", ["Month", "NEAR itself", "Other chains", "Not known"], dl.months.map((m, i) => [monthLabel(m), pct(dl.near.values[i], 1), pct(dl.other.values[i], 1), pct(dl.unknown.values[i], 1)]));
$("families").innerHTML = fams.map((f) => `<div class="row"><span>${esc(FAM[f.id] ?? f.id)}</span><span class="bar" aria-hidden="true"><i style="width:${(f.share * 100).toFixed(1)}%"></i></span><span>${approxPct(f.share)} (${rangePct(f.ci)})</span></div>`).join("");
$("chains-note").textContent = `“NEAR itself” means keys of NEAR accounts (FastAuth logins). The hatched area is “not known”: ${UNKNOWN_WHY} (in the sample every tx-bench.near sign request has an empty path). Months before ${monthLabel(dl.months[lowUntil])} have under 2% of the peak month’s volume, so their shares are noisy. Over the whole period NEAR itself is ${approxPct(nearFam.share)}, resting mostly on one medium-confidence rule.`;

/* ------------------------------------------------------------------ chapter: your scenario, live (project() = the arithmetic of out/scenarios.json; parity is a unit test) */
twoTone("h-scenario", "After the end date.", "Scenarios, not forecasts.");
const base = scenarios.baseline;
const sgn = (g) => (g > 0 ? "+" : g < 0 ? "−" : "") + pct(Math.abs(g));
const grid = { ret: [...new Set(scenarios.scenarios.map((s) => s.assumptions.fastauth_retention_after_end))].sort((a, b) => a - b), gro: [...new Set(scenarios.scenarios.map((s) => s.assumptions.structural_monthly_growth))].sort((a, b) => a - b) };
// presets are points of the precomputed grid in out/scenarios.json (assumptions.yaml): lowest, middle and highest retention; flat or highest growth
const PRESETS = [
  { name: "Cautious", retention: grid.ret[0], growth: 0 },
  { name: "Middle", retention: grid.ret[Math.floor((grid.ret.length - 1) / 2)], growth: 0 },
  { name: "Optimistic", retention: grid.ret.at(-1), growth: grid.gro.at(-1) },
];
const st = { retention: PRESETS[0].retention, growth: 0, benchmark: false };
$("scenario-form").innerHTML = `
  <div class="sl"><label for="sl-ret">FastAuth after ${esc(dayLabel(ev.date))} <output id="o-ret" class="acc"></output></label><input type="range" id="sl-ret" min="0" max="100" step="5" value="${Math.round(st.retention * 100)}"></div>
  <div class="sl bipolar"><label for="sl-gro">Other demand, per month <output id="o-gro"></output></label><input type="range" id="sl-gro" min="-10" max="10" step="1" value="0"><div class="sl-ends micro" aria-hidden="true"><span>decline</span><span>0</span><span>growth</span></div></div>
  <div class="sl"><label class="check" for="sl-ben"><input type="checkbox" id="sl-ben"><span>Suspected benchmark keeps running</span></label></div>`;
$("presets").innerHTML = `<p class="micro">Presets</p><div class="preset-row">` + PRESETS.map((p, i) => `<button type="button" class="preset" data-i="${i}"><b>${esc(p.name)}</b><span>FastAuth ${esc(pct(p.retention))} · other ${esc(sgn(p.growth))}/mo</span></button>`).join("") + `</div>`;
const fillTrack = (el) => {
  const min = Number(el.min), max = Number(el.max), p = ((Number(el.value) - min) / (max - min)) * 100;
  if (el.closest(".bipolar")) { const z = ((0 - min) / (max - min)) * 100; el.style.setProperty("--a", `${Math.min(z, p)}%`); el.style.setProperty("--b", `${Math.max(z, p)}%`); }
  else el.style.setProperty("--p", `${p}%`);
};
let resultNow = null;
function scenarioSpec() {
  const proj = project(base, { retention: st.retention, benchmark: st.benchmark ? "kept" : "removed", growth: st.growth, horizon: scenarios.horizon.to, endMonth: scenarios.fastauth_end_month });
  const ch = scenarioSeries(metrics, scenarios, proj);
  $("o-ret").textContent = pct(st.retention); $("o-gro").textContent = sgn(st.growth);
  const target = proj.end_month_total;
  roll(resultNow ?? target, target, (v) => { $("scenario-result").innerHTML = `${dotNum(approx(v))}<span class="sr-only"> requests a month in ${esc(monthLabel(proj.end_month))}</span>`; });
  resultNow = target;
  $("scenario-sub").textContent = `Requests a month in ${monthLabel(proj.end_month)} · ${proj.end_month_vs_baseline >= 0 ? "+" : "−"}${pct(Math.abs(proj.end_month_vs_baseline))} vs ${monthLabel(base.month)}`;
  table("table-scenario", ["Month", "Estimated", "Scenario: all", "Scenario: other demand", "Scenario: FastAuth"], ch.months.map((m, i) => [monthLabel(m), ch.history[i] == null ? "" : int(ch.history[i]), ch.total[i] == null ? "" : int(ch.total[i]), ch.structural[i] == null ? "" : int(ch.structural[i]), ch.fastauth[i] == null ? "" : int(ch.fastauth[i])]));
  const baseI = ch.months.indexOf(ch.baselineMonth);
  document.querySelectorAll(".preset").forEach((b) => { const p = PRESETS[Number(b.dataset.i)]; b.setAttribute("aria-pressed", String(p.retention === st.retention && p.growth === st.growth)); });
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
  ...scenarioSpec(), yFormat: compact, height: height(220, 340, 0.42), lanes: 1, labelMargin: 120, duration: 1900,
  events: [{ at: E.sweatEnds.date, lane: 0, text: "Sweat ends", href: E.sweatEnds.source, align: "start" }],
  labels: [{ id: "total", text: "All" }, { id: "structural", text: "Other demand" }, { id: "fastauth", text: "FastAuth" }],
  aria: "Monthly requests: recent estimates and the selected scenario",
});
keyList("key-scenario", [{ tone: "near", label: "Estimated, then scenario (dashed)" }, { tone: "fastauth", label: "FastAuth" }, { tone: "base", label: "Other demand" }]);
["sl-ret", "sl-gro"].forEach((id) => fillTrack($(id)));
$("sl-ret").addEventListener("input", (e) => { st.retention = Number(e.target.value) / 100; fillTrack(e.target); scChart.update(scenarioSpec()); });
$("sl-gro").addEventListener("input", (e) => { st.growth = Number(e.target.value) / 100; fillTrack(e.target); scChart.update(scenarioSpec()); });
$("sl-ben").addEventListener("change", (e) => { st.benchmark = e.target.checked; scChart.update(scenarioSpec()); });
$("presets").addEventListener("click", (e) => {
  const b = e.target.closest(".preset"); if (!b) return;
  const p = PRESETS[Number(b.dataset.i)];
  const r = $("sl-ret"), g = $("sl-gro"), r0 = Number(r.value), g0 = Number(g.value), r1 = Math.round(p.retention * 100), g1 = Math.round(p.growth * 100);
  const finish = () => { r.value = r1; g.value = g1; fillTrack(r); fillTrack(g); st.retention = p.retention; st.growth = p.growth; scChart.update(scenarioSpec()); };
  if (calm) { finish(); return; }
  tween(450, (t) => { r.value = Math.round(r0 + (r1 - r0) * t); g.value = Math.round(g0 + (g1 - g0) * t); fillTrack(r); fillTrack(g); $("o-ret").textContent = pct(Number(r.value) / 100); $("o-gro").textContent = sgn(Number(g.value) / 100); }).done.then(finish);
});
onceVisible($("scenario-form"), (el) => { if (!calm) el.classList.add("nudge"); }, 0.6);
$("scenario-note").innerHTML = `“${esc(ev.statement)}” (${esc(ev.issuer)}). Baseline = ${monthLabel(base.month)}, the last full month: ${approx(base.all)} requests, of which FastAuth ${approx(base.fastauth)}, suspected benchmark ${approx(base.benchmark)}, other demand ${approx(base.structural)}. The sliders use the same arithmetic as the ${scenarios.scenarios.length} precomputed scenarios in out/scenarios.json; the presets are points of that grid (<code>assumptions.yaml</code>). FastAuth is held at its ${monthLabel(base.month)} level until ${esc(monthLabel(scenarios.fastauth_end_month))} although it has been falling every month. The default (FastAuth stops, benchmark stops, flat other demand) is a cautious view, not a forecast. Over the whole period FastAuth is ${approxPct(fa.share)} of requests, ${approxPct(rel.value, 2)} of it relayed by <code>sweat-relayer.near</code> (that it is Sweat Wallet is medium confidence).`;

/* ------------------------------------------------------------------ chapter: what would prove us wrong (case files from config/predictions.json) */
twoTone("h-wrong", "What would prove us wrong.", "Four tests, set before the data exists.");
const leadB = (b) => { const m = /^\*\*([^*]+?):?\*\*\s*(.*)$/s.exec(b); return m ? `<strong>${esc(m[1])}</strong>${inline(m[2].replace(/^[a-z]/, (c) => c.toUpperCase()))}` : inline(b); };
$("nearview").innerHTML = S["what-this-means-for-a-long-term-near-view"].bullets.map((b) => `<li>${leadB(b)}</li>`).join("");
const pend = pendingInfo(predictions.check_after);
const FMT = { pct: (v) => pct(v), pct1: (v) => pct(v, 1), int: (v) => String(v), k: (v) => compact(v) };
const GAUGE_NAME = { "concentration.top3_share": "Top 3 now", "concentration.requesters_ge_1pct": "Requesters at 1%+ now", "drivers_requests.fast-auth.near": "FastAuth now", "series_requests_est.bridges": "Bridges now", "fulfilled_rate": "Success now" };
$("countdown").innerHTML = pend.pending ? `<p class="micro">Check on ${esc(dayLabel(predictions.check_after))}</p><p class="cd"><span class="bignum">${dotNum(String(pend.days))}</span><span class="micro">days left</span></p>` : `<p class="micro">Due · run <code>npm run check:predictions</code></p>`;
$("preds").innerHTML = predictions.predictions.map((p, pi) => {
  const lines = predictionLines(p, metrics, FMT);
  const need = p.needed === 1 ? "in any of" : p.needed === p.months.length ? "in each of" : `in ${p.needed} of`;
  const status = pend.pending ? `Pending · ${dayLabel(predictions.check_after)}` : "Due";
  const gauges = predictionGauges(p, metrics).map((gg) => {
    const f = FMT[gg.fmt], pos = (v) => Math.max(0, Math.min(100, ((v - gg.min) / (gg.max - gg.min)) * 100));
    const name = GAUGE_NAME[gg.path] ?? "Now", thr = gg.thresholds.map(f).join(" / ");
    return `<div class="gauge${gg.wrongNow ? " wrong" : ""}" style="--v:${pos(gg.now).toFixed(1)}%;--t:${pos(gg.threshold).toFixed(1)}%">
      <p class="g-txt"><span>${esc(name)} ≈${esc(f(gg.now))}</span><span>wrong if ${gg.op === "<" ? "&lt;" : "≥"} ${esc(thr)}</span></p>
      <div class="g-bar" role="img" aria-label="${esc(name)} ${esc(f(gg.now))} in ${esc(monthLabel(gg.month))}; wrong if ${gg.op === "<" ? "below" : "at or above"} ${esc(thr)}"><span class="g-zone ${gg.op === "<" ? "left" : "right"}"></span><span class="g-thr"></span><span class="g-now"></span></div>
    </div>`;
  }).join("");
  return `<article class="tile case" style="--d:${pi}"><p class="micro status"><i aria-hidden="true"></i>${esc(status)}</p><p class="micro">Case ${esc(p.id)}</p><h3>${esc(p.claim)}</h3>
    <ul>${lines.map((l) => `<li>Wrong if ${esc(l)}</li>`).join("")}<li>${esc(need)} ${p.months.length} months: ${esc(p.months.map(monthShort).join(", "))}</li></ul>
    <div class="gauges"><p class="micro">Now (${esc(monthLabel(lastFull))}) vs threshold</p>${gauges}</div></article>`;
}).join("");
onceVisible($("preds"), (el) => { if (!calm) el.classList.add("deal"); }, 0.2);
const wrongSec = S["what-would-prove-this-thesis-wrong"];
$("wrong-full").innerHTML = `<p>${inline(wrongSec.markdown.split(/\n\n+/)[0].replace(/\n/g, " "))}</p>` + `<ul>${wrongSec.bullets.map((b) => { const { claim, why } = splitWhy(b); return `<li>${inline(claim)}${why ? ` ${inline(why)}` : ""}</li>`; }).join("")}</ul><p>Check after the date with <code>npm run check:predictions</code> (rules in <code>config/predictions.json</code>).</p>`;

/* ------------------------------------------------------------------ chapter: verify it yourself */
twoTone("h-verify", "Verify it yourself.", "One click, one sampled transaction, a public node.");
setupVerify({ button: $("verify-btn"), log: $("verify-log"), counter: $("verify-count"), out: $("verify-out"), sample: vsample, command: `npm run verify -- --sample ${verify.sample}` });

/* ------------------------------------------------------------------ chapter: re-run it, honest notes, footer */
twoTone("h-rerun", "Re-run it yourself.", "Node and nothing else. No account, no key.");
const hash = manifest.files["data/metrics.json"];
const repoUrl = "https://github.com/takeshityt/signer-census";
const steps = [
  [`git clone ${repoUrl} && cd signer-census && npm ci`, "Gets the code and the exact locked dependencies.", "✓ dependencies installed from package-lock.json"],
  ["npm test", "Unit tests, including that every number in the documents comes from the JSON outputs.", `✓ Tests  ${repo.tests} passed (${repo.tests})`],
  ["npm run reproduce", "Rebuilds out/metrics.json and THESIS.md offline, from the committed data.", `✓ out/metrics.json written. sha256 ${hash.slice(0, 12)}…`],
  [`npm run verify -- --sample ${verify.sample}`, "Re-checks random sampled transactions at an archival node and NearBlocks.", `✓ ${verify.verified}/${verify.sample} verified (last run ${dayLabel(verify.date)})`],
  ["npm run check:predictions", "Shows each test as pending until its date, then evaluates it against fresh data.", `✓ ${predictions.predictions.length} tests pending until ${predictions.check_after}`],
];
$("rerun-steps").innerHTML = steps.map(([cmd, what, outLine], i) => `<article class="tile step${i === 0 ? " first" : ""}" style="--d:${i}"><div class="cmd"><code>${esc(cmd)}</code><button type="button" data-copy="${esc(cmd)}">Copy</button></div><p class="expect mono">${esc(outLine)}</p><p>${esc(what)}</p></article>`).join("");
$("rerun-steps").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-copy]"); if (!b) return;
  navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.textContent = "Copied ✓"; b.classList.add("done"); setTimeout(() => { b.textContent = "Copy"; b.classList.remove("done"); }, 1400); }).catch(() => {});
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
$("foot").innerHTML = `Signer Census · exact transaction counts as of block ${int(metrics.meta.snapshot.block_height)} (${snapshotDay}); requests are estimates from a cluster sample · metrics.json sha256 <code>${hash}</code> · no cookies, no tracking, no network request except “Check a random transaction”.`;
createPlusField($("rerun"));

/* ------------------------------------------------------------------ motion: tiles, headlines, labels, dot numbers, reveals (all once, all into the visible state) */
tileHover();
const reveal = [...document.querySelectorAll(".chapter .ch-head, .bento > .tile, .scene, .chapter > .more, .countdown")];
// Visible by default. Only elements still below the fold wait ("pending") until they scroll in; a timer reveals them if the observer never fires.
const canObserve = "IntersectionObserver" in window && !calm;
reveal.forEach((el) => { el.setAttribute("data-reveal", ""); if (canObserve && el.getBoundingClientRect().top > innerHeight) el.classList.add("pending"); });
const show = (el) => el.classList.remove("pending");
if (canObserve) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
  reveal.forEach((el) => io.observe(el));
  setTimeout(() => reveal.forEach(show), 8000);
}
if (!calm) {
  const rkio = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("play"); rkio.unobserve(e.target); } }), { threshold: 0.3 });
  document.querySelectorAll(".rk").forEach((el) => rkio.observe(el));
  document.querySelector(".rk-more")?.addEventListener("toggle", (e) => { if (e.target.open) e.target.querySelectorAll(".rk").forEach((r) => r.classList.add("play")); });
  document.querySelectorAll(".chapter h2").forEach((h) => onceVisible(h, revealLines, 0.6));
  document.querySelectorAll(".ch-head .micro").forEach((m) => onceVisible(m, (el) => typeOn(el), 0.9));
  document.querySelectorAll("main .bignum").forEach((n) => onceVisible(n, (el) => { const stack = el.closest(".stack"); flip(el, { delay: stack ? [...stack.querySelectorAll(".bignum")].indexOf(el) * 180 : 0 }); }, 0.6));
  onceVisible($("accent-tile"), (el) => { flip(el.querySelector(".huge")); el.classList.add("sweep"); }, 0.5);
  onceVisible($("waffle"), (el) => el.querySelector(".wf-grid")?.classList.add("bygroup"), 0.3);
  onceVisible($("rerun-steps"), () => { document.querySelectorAll("#rerun-steps code").forEach((c, i) => setTimeout(() => typeOn(c, 14), i * 380)); }, 0.3);
}
const navLinks = [...document.querySelectorAll("#nav a")];
const navIo = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) navLinks.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === `#${e.target.id}`))); }), { rootMargin: "-30% 0px -60% 0px" });
document.querySelectorAll("main section[id]").forEach((s) => navIo.observe(s));

document.documentElement.dataset.ready = "1";
document.documentElement.dataset.readyMs = String(Math.round(performance.now()));
if (!calm) $("top").classList.add("intro");
whenShown(120).then(() => {
  if (calm) return;
  revealLines($("h1"));
  document.querySelectorAll(".counters dd, #casecard .big").forEach((d, i) => flip(d, { delay: 300 + i * 180 }));
});
