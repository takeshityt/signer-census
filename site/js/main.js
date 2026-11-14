// Dashboard wiring (version 3, "case file"). Every number on the page is read from site/data/*.json (copied from out/ and config/ at build); nothing is typed here.
// Texts are short templates around those numbers. Colors live in css/style.css; motion in charts.js, dot-field.js and waffle.js.
import { compact, approx, precise, pct, approxPct, range, rangePct, int, monthLabel, dayLabel } from "./format.js";
import { inline, esc } from "./md.js";
import { createChart, tween, reducedMotion, whenShown } from "./charts.js";
import { createWaffle, waffleGroups } from "./waffle.js";
import { createDotField } from "./dot-field.js";
import { sparkline } from "./spark.js";
import { setupVerify } from "./verify-ui.js";
import { project } from "./scenario-core.js";
import { pendingInfo } from "./predictions-core.js";
import {
  headline, splitHeadline, volumeSeries, boomSeries, fulfilledSeries, bridgeStack, destinationLines, timelineEvents, requesterRows, requesterName, requesterTone, splitWhy,
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
const ev = scenarios.event;

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
/** A big dot-matrix number; a leading "≈" is set in the mono face (the dot font has no such glyph). */
const dotNum = (s) => {
  const t = String(s), body = t.startsWith("≈") ? t.slice(1) : t;
  // the dot font's period reads like a comma, so decimal points and slashes are set in the mono face
  return (t.startsWith("≈") ? `<span class="ap">≈</span>` : "") + esc(body).replace(/[./]/g, (c) => `<span class="dp">${c}</span>`);
};
const numTile = (label, value, sub) => `<div class="numtile"><p class="micro">${esc(label)}</p><p class="bignum">${dotNum(value)}</p>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>`;

/* ------------------------------------------------------------------ hero */
const rows = requesterRows(metrics, labels);
const fa = rows.find((r) => r.account === "fast-auth.near");
const shareText = (r) => approxPct(r.share, r.share < 0.1 ? 1 : 0);
$("statusline").innerHTML = `<span><span class="pip" aria-hidden="true"></span><b>Signer Census</b> · NEAR Chain Signatures · v1.signer · data to ${esc(snapshotDay)}</span><span>Block ${esc(int(metrics.meta.snapshot.block_height))} · ${esc(monthLabel(hero.firstMonth))} to ${esc(monthLabel(lastMonth.month))}</span>`;
const [h1a, h1b] = splitHeadline(headline(thesis));
twoTone("h1", h1a, h1b);
$("deck").textContent = "A reproducible count of who asks NEAR’s MPC signer to sign, and for which chains. Each cluster of dots is a real requester.";
$("counters").innerHTML = [
  ["Signature requests", `<span class="count"><span class="ghost" aria-hidden="true">${dotNum(approx(hero.requests))}</span><span id="count-req" aria-hidden="true">${dotNum(approx(hero.requests))}</span></span><span class="sr-only">about ${esc(compact(hero.requests))}</span>`],
  ["Fulfilled", dotNum(pct(hero.fulfilled, 1))],
  ["Verified on-chain", dotNum(`${hero.verified}/${hero.sample}`)],
].map(([l, v]) => `<div><dt>${esc(l)}</dt><dd>${v}</dd></div>`).join("");
$("hero-notes").innerHTML = `<p>Requests are estimated: exact monthly transaction totals times the share of sign receipts in a cluster sample; 95% interval (sampling error only) ${esc(range(hero.requestsCi, precise))}. “Fulfilled” = the callback of the sign receipt succeeded, in the sample; latency and downtime are not measured. “Verified on-chain” = ${hero.sample} sampled transactions re-parsed identically by an archival RPC node and NearBlocks (${esc(dayLabel(hero.verifyDate))}); it checks the parsing, not the estimate.</p><p>Dots: ten dots per one percent of all requests, one cluster per listed requester. Every number is read from <code>out/metrics.json</code>, also served as <a href="data/metrics.json">data/metrics.json</a>.</p>`;

const WTONE = { "near-infra:bridge-omni": "bridge-dark", "near-infra:bridge-btc": "bridge-mid", "near-infra:bridge-zcash": "bridge-light" };
const toneOf = (r) => WTONE[r.category] ?? requesterTone(r);
$("casecard").innerHTML = `<div class="ch-line"><span class="micro">Case · ${esc(fa.account)}</span><span class="flag">Winding down</span></div>
  <p class="big">${dotNum(shareText(fa))}<small>of all requests</small></p>
  <dl><dt>Dominant integrator</dt><dd>${esc(fa.integrator.name.split(" (")[0])} (confidence ${esc(fa.integrator.confidence)})</dd>
  <dt>Present form ends</dt><dd>${esc(dayLabel(ev.date))}</dd>
  <dt>Source</dt><dd><a href="${esc(ev.source)}" rel="noopener noreferrer">${esc(new URL(ev.source).host)}</a></dd></dl>`;
createDotField($("dotfield"), {
  items: rows.map((r) => ({ id: r.account, share: r.share, tone: toneOf(r), label: `${requesterName(r)} · ${shareText(r)}` })),
  highlight: fa.account,
  aria: `Dot field: one cluster per requester, ten dots per percent of all requests. Largest: ${rows.slice(0, 3).map((r) => `${requesterName(r)} ${shareText(r)}`).join(", ")}.`,
  // the case card sits in a reserved top-right corner of the field (on phones it moves below the field)
  reserve: (W) => { if (W < 560) return null; const c = $("casecard"); return { w: Math.min(c.offsetWidth || 320, W * 0.5), h: c.offsetHeight || 240 }; },
});
function countUp() {
  const el = $("count-req");
  if (!el || reducedMotion()) return;
  tween(1600, (t) => { el.innerHTML = dotNum(approx(hero.requests * t)); }, (t) => 1 - (1 - t) ** 3).done.then(() => { el.innerHTML = dotNum(approx(hero.requests)); });
}

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
  ...volSpec(false), yFormat: compact, height: height(240, 380, 0.4), lanes: 1, labelMargin: 140,
  events: [{ at: hero.peakMonth, lane: 0, text: `Peak ${monthLabel(hero.peakMonth)}`, align: "end" }],
  labels: [{ id: "all", text: "Requests" }, { id: "benchmark", text: "Suspected benchmark" }],
  aria: `Estimated signature requests per month, peaking at ${approx(hero.peakValue)} in ${monthLabel(hero.peakMonth)}, with the suspected benchmark hatched on top`,
});
keyList("key-volume", [{ tone: "base", label: "Requests" }, { tone: "hatch", label: "Suspected benchmark" }]);
const fillVolumeTable = () => table("table-volume", ["Month", "Requests", "Suspected benchmark"], vol.months.map((m, i) => [monthLabel(m) + (vol.partial[i] ? " (partial)" : ""), int(vol.series[0].values[i]), int(vol.series[1].values[i])]));
fillVolumeTable();
$("works-n1-label").textContent = "Without the suspected benchmark";
$("works-n1").innerHTML = dotNum(approx(hero.withoutBenchmark));
const ful = fulfilledSeries(metrics);
const lowSince = metrics.derived.fulfilled_rate_lowest_month_since, lowAll = metrics.derived.fulfilled_rate_lowest_month;
$("h-fulfilled").textContent = `Never below ${pct(lowSince.value, 1)} since ${monthLabel(lowSince.since)}`;
createChart($("chart-fulfilled"), {
  months: ful.months, partial: ful.partial, series: [{ id: "rate", label: "Success", tone: "near", type: "line", smooth: false, values: ful.values }],
  yMin: 0.5, yMax: 1, yFormat: (v) => pct(v), height: 160, lanes: 1,
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
const labelText = (r) => (r.category === "unknown" && r.suspected ? "Unknown, suspected benchmark" : r.category ? categoryName(r.category) : "Not labeled");
const wgroups = waffleGroups(rows, 6, (r) => WTONE[r.category] ?? (requesterTone(r) === "muted" ? "base" : requesterTone(r)), requesterName);
createWaffle($("waffle"), {
  groups: wgroups,
  aria: "Dot matrix: 100 dots, each one percent of all requests, coloured by requester",
  text: { shareText: (g) => approxPct(g.share, g.share < 0.1 ? 1 : 0), ciText: (g) => (g.ci ? `95% interval ${rangePct(g.ci, 1)}` : "") },
  footnote: `Dots are rounded by the largest-remainder method so the grid sums to exactly 100: ${wgroups.map((g) => `${g.name} ${g.squares}`).join(", ")}. Exact shares and 95% intervals are in the legend and the list below.`,
});
const top15 = rows.reduce((a, r) => a + r.share, 0);
$("who-nums").innerHTML = numTile("Requesters with 1% or more", String(ge1), "over the whole period") + numTile("Reached 1% in some month", String(geAny), `95% interval ${range(T.concentration.requesters_ge_1pct_any_month.ci95, String)}`) + numTile(`The ${rows.length} largest hold`, approxPct(top15), "of all requests");
const sparkLabels = rmonthly.months.map(monthLabel);
const evidenceList = (evs) => `<ul>${evs.map((e) => `<li>${esc(e.claim)} <a href="${esc(e.url)}" rel="noopener noreferrer">source</a></li>`).join("")}</ul>`;
const axisMax = Math.max(...rows.map((x) => x.shareCi?.[1] ?? x.share)) * 1.05;
function rankRow(r, k) {
  const w = (r.share / axisMax) * 100, lo = ((r.shareCi?.[0] ?? r.share) / axisMax) * 100, hi = ((r.shareCi?.[1] ?? r.share) / axisMax) * 100;
  const series = rmonthly.months.map((m) => rmonthly.accounts[r.account]?.[m] ?? 0);
  const note = [r.note ? `<p>${esc(r.note)}</p>` : "", r.integrator ? `<p><strong>Dominant integrator: ${esc(r.integrator.name)}</strong> (confidence ${esc(r.integrator.confidence)}). ${esc(r.integrator.note ?? "")}</p>${evidenceList(r.integrator.evidence)}` : "", r.evidence.length ? `<p><strong>Evidence for the label</strong></p>${evidenceList(r.evidence)}` : ""].join("");
  return `<div class="rk" style="--i:${k};--w:${w.toFixed(2)}%;--lo:${lo.toFixed(2)}%;--hi:${hi.toFixed(2)}%">
    <div class="who"><span class="nm">${esc(requesterName(r))}</span><span class="acct">${esc(r.account)}</span></div>
    <div class="track" role="img" aria-label="${esc(requesterName(r))}: ${approxPct(r.share, 1)} of requests, 95% interval ${esc(rangePct(r.shareCi, 1))}"><span class="fill t-${requesterTone(r)}"></span><span class="whisk"></span></div>
    <div class="spk t-${toneOf(r) === "muted" ? "base" : toneOf(r)}">${sparkline(series, { labels: sparkLabels, partialLast: !!lastMonth.partial_month, fmt: approx })}</div>
    <div class="val">${shareText(r)}</div>
    <div class="meta"><span>${esc(labelText(r))}${r.owner ? ` · ${esc(r.owner)}` : ""}</span><span>${r.confidence ? `${esc(r.confidence)} confidence (${dots[r.confidence]}/3)` : "no label"}</span>
      ${note ? `<details><summary>Notes and ${r.evidence.length} source${r.evidence.length === 1 ? "" : "s"}</summary><div>${note}</div></details>` : ""}</div>
  </div>`;
}
const TOP = 6;
$("who-list").innerHTML = rows.slice(0, TOP).map(rankRow).join("") + (rows.length > TOP ? `<details class="more rk-more"><summary>All ${rows.length} requesters</summary>${rows.slice(TOP).map((r, k) => rankRow(r, k)).join("")}</details>` : "");
$("who-notes").innerHTML = `<p>The requester is the account that called <code>sign</code>, not the transaction signer (those are mostly relayers). The bar is the share with its 95% interval; each sparkline is that requester’s estimated requests per month on its own scale (the dotted end is the partial month). Every label has evidence links; confidence three of three means an official source or an on-chain fact names the owner.</p>`;

/* ------------------------------------------------------------------ chapter: the boom */
const rel = T.relayer_share_of_requester["fast-auth.near via sweat-relayer.near"];
let boom = boomSeries(metrics);
const faPeak = boom.series[0].values.reduce((a, v, i) => (!boom.partial[i] && v > a.v ? { v, i } : a), { v: 0, i: 0 });
twoTone("h-boom", "The boom was one integration.", `Its product ends in present form on ${dayLabel(ev.date)}.`);
const boomTip = (i) => ({
  title: monthTitle(boom.months, boom.partial, i),
  rows: boom.series.filter((s) => s.values[i]).map((s) => ({ tone: s.tone, label: s.label, value: approx(s.values[i]), ci: ci95(s.ci[i]) })),
  footer: `All shown: ${approx(boom.series.reduce((a, s) => a + s.values[i], 0))}`,
});
const boomSpec = (excl) => { boom = boomSeries(metrics, { excludeBenchmark: excl }); return { months: boom.months, partial: boom.partial, series: boom.series.map((s) => ({ ...s, type: "bar" })), tip: boomTip }; };
const boomChart = createChart($("chart-boom"), {
  ...boomSpec(false), yFormat: compact, height: height(260, 420, 0.44), lanes: 3, labelMargin: 140,
  events: [
    { at: E.sweatAnnounced.date, lane: 0, text: "End date announced", href: E.sweatAnnounced.source, align: "end" },
    { at: E.relayExit.month, lane: 1, text: "Relay goes quiet", align: "end" },
    { at: E.fastauthRamp.month, lane: 2, text: "FastAuth ramp", align: "end" },
  ],
  labels: [{ id: "fastauth", text: "FastAuth" }, { id: "rest", text: "Everyone else" }, { id: "benchmark", text: "Benchmark" }],
  aria: `Estimated requests per month: FastAuth logins (peak ${approx(faPeak.v)} in ${monthLabel(boom.months[faPeak.i])}), everyone else, and the suspected benchmark`,
});
keyList("key-boom", [{ tone: "fastauth", label: "FastAuth" }, { tone: "muted", label: "Everyone else" }, { tone: "hatch", label: "Suspected benchmark" }]);
const fillBoomTable = () => table("table-boom", ["Month", ...boom.series.map((s) => s.label)], boom.months.map((m, i) => [monthLabel(m) + (boom.partial[i] ? " (partial)" : ""), ...boom.series.map((s) => int(s.values[i]))]));
fillBoomTable();
$("excl-bench").addEventListener("change", (e) => { volChart.update(volSpec(e.target.checked)); boomChart.update(boomSpec(e.target.checked)); fillVolumeTable(); fillBoomTable(); });
$("accent-tile").innerHTML = `<p class="micro">One integration · ${esc(fa.account)}</p><div><p class="huge">${dotNum(shareText(fa))}</p><p class="line">of every request since ${esc(monthLabel(hero.firstMonth))}. ${approxPct(rel.value, 2)} of it relayed by sweat-relayer.near.</p></div>`;
$("boom-steps").innerHTML = [
  ["Ramp", E.fastauthRamp.month && monthLabel(E.fastauthRamp.month), "FastAuth logins arrive", `${approx(E.fastauthRamp.value)} requests in one month.`, true],
  ["Exit", monthLabel(E.relayExit.month), "Relay goes quiet", `The largest third-party app: none in the sample from ${monthLabel(E.relayExit.month)}.`, false],
  ["Sunset", dayLabel(ev.date), "Sweat Wallet ends in present form", `Announced ${dayLabel(E.sweatAnnounced.date)} by ${ev.issuer.split(" (")[0]}.`, true],
].map(([st, when, title, text, on], i) => `<li class="${on ? "on" : ""}"><p class="st"><i aria-hidden="true"></i>${String(i + 1).padStart(2, "0")} · ${esc(st)} · ${esc(when)}</p><h3>${esc(title)}</h3><p>${esc(text)}</p></li>`).join("");

/* ------------------------------------------------------------------ chapter: bridges */
const br = bridgeStack(metrics);
const bi = br.months.indexOf(lastFull), bridgeSum = br.series.reduce((a, s) => a + s.values[bi], 0), pk = metrics.derived.bridges_peak_month;
twoTone("h-bridges", "Bridges remain.", "The steadiest demand we see, and still young.");
createChart($("chart-bridges"), {
  months: br.months, partial: br.partial, series: br.series.map((s) => ({ ...s, type: "bar" })), yFormat: compact, height: height(240, 380, 0.4), lanes: 1, labelMargin: 140,
  events: [{ at: E.bridgesPeak.month, lane: 0, text: `Peak ${monthLabel(E.bridgesPeak.month)}`, align: "end" }],
  labels: br.series.map((s) => ({ id: s.id, text: s.label })),
  tip: (i) => ({ title: monthTitle(br.months, br.partial, i), rows: br.series.filter((s) => s.values[i]).map((s) => ({ tone: s.tone, label: s.label, value: approx(s.values[i]), ci: ci95(s.ci[i]) })), footer: `All bridges: ${approx(br.total.values[i])}` }),
  aria: `Estimated bridge connector requests per month, peaking at ${approx(pk.value)} in ${monthLabel(pk.month)}`,
});
keyList("key-bridges", br.series.map((s) => ({ tone: s.tone, label: s.label })));
table("table-bridges", ["Month", ...br.series.map((s) => s.label), "All structural"], br.months.map((m, i) => [monthLabel(m) + (br.partial[i] ? " (partial)" : ""), ...br.series.map((s) => int(s.values[i])), int(br.structural.values[i])]));
$("bridge-nums").innerHTML = numTile(`Peak · ${monthLabel(pk.month)}`, approx(pk.value), "bridge requests in one month") + numTile(monthLabel(lastFull), approx(bridgeSum), `${approxPct(Math.abs(metrics.derived.bridges_last_full_vs_peak))} below the peak`) + numTile("Of structural demand", approxPct(bridgeSum / br.structural.values[bi]), `in ${monthLabel(lastFull)}: everything but FastAuth and the benchmark`);
const dl = destinationLines(metrics);
const fams = chainFamilies(metrics);
const FAM = { near: "NEAR itself", bitcoin: "Bitcoin", zcash: "Zcash", multi: "Several chains", unknown: "Not known", evm: "EVM chains", solana: "Solana", other: "Other" };
const nearFam = fams.find((f) => f.id === "near");
$("h-chains").textContent = dl.crossover ? `Where signatures go · since ${monthLabel(dl.crossover.month)} more serve other chains than NEAR` : "Where signatures go";
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
  yMin: 0, yMax: 1, yFormat: (v) => pct(v), height: height(220, 340, 0.3), lanes: 1, labelMargin: 140,
  events: dl.crossover ? [{ at: dl.crossover.month, lane: 0, text: "Crossover", align: "end" }] : [],
  labels: [{ id: "near", text: "NEAR itself" }, { id: "other", text: "Other chains" }, { id: "unknown", text: "Not known" }],
  tip: (i) => ({ title: monthTitle(dl.months, dl.partial, i), rows: dlRows(i) }),
  aria: "Monthly share of requests by destination: NEAR itself, other chains, and not known",
});
keyList("key-chains", [{ tone: "near", label: "NEAR itself" }, { tone: "other", label: "Other chains" }, { tone: "unknown", label: "Not known" }]);
table("table-chains", ["Month", "NEAR itself", "Other chains", "Not known"], dl.months.map((m, i) => [monthLabel(m), pct(dl.near.values[i], 1), pct(dl.other.values[i], 1), pct(dl.unknown.values[i], 1)]));
$("families").innerHTML = fams.map((f) => `<div class="row"><span>${esc(FAM[f.id] ?? f.id)}</span><span class="bar" aria-hidden="true"><i style="width:${(f.share * 100).toFixed(1)}%"></i></span><span>${approxPct(f.share)} (${rangePct(f.ci)})</span></div>`).join("");
$("chains-note").textContent = `“NEAR itself” means keys of NEAR accounts (FastAuth logins); the grey band is “not known” (no evidence-backed rule). Over the whole period NEAR itself is ${approxPct(nearFam.share)}, resting mostly on one medium-confidence rule.`;

/* ------------------------------------------------------------------ chapter: your scenario, live (project() = the arithmetic of out/scenarios.json; parity is a unit test) */
twoTone("h-scenario", "After the end date.", "Scenarios, not forecasts.");
const base = scenarios.baseline;
const sgn = (g) => (g > 0 ? "+" : g < 0 ? "−" : "") + pct(Math.abs(g));
const st = { retention: 0, growth: 0, benchmark: false };
$("scenario-form").innerHTML = `
  <div class="sl"><label for="sl-ret">FastAuth after ${esc(dayLabel(ev.date))} <output id="o-ret" class="acc"></output></label><input type="range" id="sl-ret" min="0" max="100" step="5" value="0"></div>
  <div class="sl"><label for="sl-gro">Other demand, per month <output id="o-gro"></output></label><input type="range" id="sl-gro" min="-10" max="10" step="1" value="0"></div>
  <div class="sl"><label class="check" for="sl-ben"><input type="checkbox" id="sl-ben"><span>Suspected benchmark keeps running</span></label></div>`;
const fillTrack = (el) => { const p = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100; el.style.setProperty("--p", `${p}%`); };
function scenarioSpec() {
  const proj = project(base, { retention: st.retention, benchmark: st.benchmark ? "kept" : "removed", growth: st.growth, horizon: scenarios.horizon.to, endMonth: scenarios.fastauth_end_month });
  const ch = scenarioSeries(metrics, scenarios, proj);
  $("o-ret").textContent = pct(st.retention); $("o-gro").textContent = sgn(st.growth);
  $("scenario-result").innerHTML = `${dotNum(approx(proj.end_month_total))}<span class="sr-only"> requests a month in ${esc(monthLabel(proj.end_month))}</span>`;
  $("scenario-sub").textContent = `Requests a month in ${monthLabel(proj.end_month)} · ${proj.end_month_vs_baseline >= 0 ? "+" : "−"}${pct(Math.abs(proj.end_month_vs_baseline))} vs ${monthLabel(base.month)}`;
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
  ...scenarioSpec(), yFormat: compact, height: height(220, 340, 0.42), lanes: 1, labelMargin: 120,
  events: [{ at: E.sweatEnds.date, lane: 0, text: "Sweat ends", href: E.sweatEnds.source, align: "start" }],
  labels: [{ id: "total", text: "All" }, { id: "structural", text: "Other demand" }, { id: "fastauth", text: "FastAuth" }],
  aria: "Monthly requests: recent estimates and the selected scenario",
});
keyList("key-scenario", [{ tone: "near", label: "Estimated, then scenario (dashed)" }, { tone: "fastauth", label: "FastAuth" }, { tone: "base", label: "Other demand" }]);
["sl-ret", "sl-gro"].forEach((id) => fillTrack($(id)));
$("sl-ret").addEventListener("input", (e) => { st.retention = Number(e.target.value) / 100; fillTrack(e.target); scChart.update(scenarioSpec()); });
$("sl-gro").addEventListener("input", (e) => { st.growth = Number(e.target.value) / 100; fillTrack(e.target); scChart.update(scenarioSpec()); });
$("sl-ben").addEventListener("change", (e) => { st.benchmark = e.target.checked; scChart.update(scenarioSpec()); });
$("scenario-note").innerHTML = `“${esc(ev.statement)}” (${esc(ev.issuer)}). Baseline = ${monthLabel(base.month)}, the last full month: ${approx(base.all)} requests, of which FastAuth ${approx(base.fastauth)}, suspected benchmark ${approx(base.benchmark)}, other demand ${approx(base.structural)}. The sliders use the same arithmetic as the ${scenarios.scenarios.length} precomputed scenarios in out/scenarios.json (<code>assumptions.yaml</code> sets the grid). FastAuth is held at its ${monthLabel(base.month)} level until ${esc(monthLabel(scenarios.fastauth_end_month))} although it has been falling every month. The default (FastAuth stops, benchmark stops, flat other demand) is a cautious view, not a forecast. Over the whole period FastAuth is ${approxPct(fa.share)} of requests, ${approxPct(rel.value, 2)} of it relayed by <code>sweat-relayer.near</code> (that it is Sweat Wallet is medium confidence).`;

/* ------------------------------------------------------------------ chapter: what would prove us wrong (case files from config/predictions.json) */
twoTone("h-wrong", "What would prove us wrong.", "Four tests, set before the data exists.");
const lead = (b) => { const m = /^\*\*([^*]+?):?\*\*\s*(.*)$/s.exec(b); return m ? `<strong>${esc(m[1])}</strong>${inline(m[2].replace(/^[a-z]/, (c) => c.toUpperCase()))}` : inline(b); };
$("nearview").innerHTML = S["what-this-means-for-a-long-term-near-view"].bullets.map((b) => `<li>${lead(b)}</li>`).join("");
const pend = pendingInfo(predictions.check_after);
const FMT = { pct: (v) => pct(v), pct1: (v) => pct(v, 1), int: (v) => String(v), k: (v) => compact(v) };
$("preds").innerHTML = predictions.predictions.map((p) => {
  const lines = predictionLines(p, metrics, FMT);
  const need = p.needed === 1 ? "in any of" : p.needed === p.months.length ? "in each of" : `in ${p.needed} of`;
  const status = pend.pending ? `Pending · check on ${dayLabel(predictions.check_after)}` : "Due · run npm run check:predictions";
  return `<article class="tile case"><p class="micro status"><i aria-hidden="true"></i>${esc(status)}</p><p class="micro">Case ${esc(p.id)}</p><h3>${esc(p.claim)}</h3>
    <ul>${lines.map((l) => `<li>Wrong if ${esc(l)}</li>`).join("")}<li>${esc(need)} ${p.months.length} months: ${esc(p.months.map(monthLabel).join(", "))}</li></ul>
    <div class="count"><span class="micro">${pend.pending ? "Days left" : "Status"}</span><b>${pend.pending ? esc(String(pend.days)) : "Due"}</b></div></article>`;
}).join("");
const wrongSec = S["what-would-prove-this-thesis-wrong"];
$("wrong-full").innerHTML = `<p>${inline(wrongSec.markdown.split(/\n\n+/)[0].replace(/\n/g, " "))}</p>` + `<ul>${wrongSec.bullets.map((b) => { const { claim, why } = splitWhy(b); return `<li>${inline(claim)}${why ? ` ${inline(why)}` : ""}</li>`; }).join("")}</ul><p>Check after the date with <code>npm run check:predictions</code> (rules in <code>config/predictions.json</code>).</p>`;

/* ------------------------------------------------------------------ chapter: verify it yourself */
twoTone("h-verify", "Verify it yourself.", "One click, one sampled transaction, a public node.");
setupVerify({ button: $("verify-btn"), out: $("verify-out"), sample: vsample, command: `npm run verify -- --sample ${verify.sample}` });

/* ------------------------------------------------------------------ chapter: re-run it, honest notes, footer */
twoTone("h-rerun", "Re-run it yourself.", "Node and nothing else. No account, no key.");
const hash = manifest.files["data/metrics.json"];
const steps = [
  ["npm test", "Unit tests, including that every number in the documents comes from the JSON outputs."],
  ["npm run reproduce", `Rebuilds out/metrics.json and THESIS.md offline. Prints sha256 ${hash.slice(0, 12)}… (this page was built from that file).`],
  [`npm run verify -- --sample ${verify.sample}`, `Re-checks ${verify.sample} random transactions at an archival node and NearBlocks. Last run: ${verify.verified}/${verify.sample}.`],
  ["npm run check:predictions", "Shows each test as pending until its date, then evaluates it against fresh data."],
];
$("rerun-steps").innerHTML = steps.map(([cmd, what]) => `<article class="tile step"><div class="cmd"><code>${esc(cmd)}</code><button type="button" data-copy="${esc(cmd)}">Copy</button></div><p>${esc(what)}</p></article>`).join("");
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
$("foot").innerHTML = `Signer Census · exact transaction counts as of block ${int(metrics.meta.snapshot.block_height)} (${snapshotDay}); requests are estimates from a cluster sample · metrics.json sha256 <code>${hash}</code> · no cookies, no tracking, no network request except “Check a random transaction”.`;

/* ------------------------------------------------------------------ motion: tiles reveal on scroll, bars grow, nav highlight */
const reveal = [...document.querySelectorAll(".chapter .ch-head, .bento > .tile, .chapter > .more")];
// Visible by default. Only elements still below the fold wait ("pending") until they scroll in; a timer reveals them if the observer never fires.
const canObserve = "IntersectionObserver" in window && !reducedMotion();
reveal.forEach((el) => { el.setAttribute("data-reveal", ""); if (canObserve && el.getBoundingClientRect().top > innerHeight) el.classList.add("pending"); });
const show = (el) => el.classList.remove("pending");
if (canObserve) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
  reveal.forEach((el) => io.observe(el));
  setTimeout(() => reveal.forEach(show), 8000);
}
const rkio = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("play"); rkio.unobserve(e.target); } }), { threshold: 0.3 });
if (!reducedMotion()) document.querySelectorAll(".rk").forEach((el) => rkio.observe(el));
document.querySelector(".rk-more")?.addEventListener("toggle", (e) => { if (e.target.open && !reducedMotion()) e.target.querySelectorAll(".rk").forEach((r) => r.classList.add("play")); });
const navLinks = [...document.querySelectorAll("#nav a")];
const navIo = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) navLinks.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === `#${e.target.id}`))); }), { rootMargin: "-30% 0px -60% 0px" });
document.querySelectorAll("main section[id]").forEach((s) => navIo.observe(s));

document.documentElement.dataset.ready = "1";
document.documentElement.dataset.readyMs = String(Math.round(performance.now()));
if (!reducedMotion() && $("count-req")) $("count-req").innerHTML = dotNum("≈0"); // starts at zero, counts up once the page is on screen
whenShown(250).then(countUp);
