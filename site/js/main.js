// Dashboard wiring. Every number on the page is read from site/data/*.json (copied from out/ and exported at build); nothing is typed here.
import { compact, approx, precise, pct, approxPct, range, rangePct, int, monthLabel, monthShort, dayLabel } from "./format.js";
import { inline, esc } from "./md.js";
import { STACK, BRIDGES, stackedSeries, monthTotals, heroStats, requesterRows, chainSeries, chainFamilies, bridgeSeries, scenarioOptions, pickScenario, scenarioChart, categoryName, fullMonths } from "./model.js";

const $ = (id) => document.getElementById(id);
const getJSON = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(`cannot load data/${f}`); return r.json(); });
const [metrics, scenarios, labels, verify, thesis, manifest] = await Promise.all(["metrics.json", "scenarios.json", "labels.json", "verify.json", "thesis.json", "manifest.json"].map(getJSON));
const hero = heroStats(metrics, verify);
const snapshotDay = dayLabel(hero.snapshotTime);

/* ------------------------------------------------------------------ theme */
const themeBtn = $("theme");
const MODES = ["auto", "light", "dark"];
let mode = "auto";
try { mode = MODES.includes(localStorage.getItem("theme")) ? localStorage.getItem("theme") : "auto"; } catch { /* storage may be blocked */ }
function applyMode() {
  if (mode === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = mode;
  themeBtn.textContent = `Theme: ${mode}`;
  try { localStorage.setItem("theme", mode); } catch { /* ignore */ }
}
themeBtn.addEventListener("click", () => { mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; applyMode(); renderCharts(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (mode === "auto") renderCharts(); });
applyMode();

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function palette() {
  return { s: { 1: css("--s1"), 2: css("--s2"), 3: css("--s3"), 4: css("--s4"), 5: css("--s5"), neutral: css("--neutral") }, ink: css("--ink"), muted: css("--muted"), rule: css("--rule"), surface: css("--surface"), hatchBg: css("--hatch-bg"), hatchLine: css("--hatch-line") };
}
function hatch(c) {
  const k = document.createElement("canvas"); k.width = k.height = 10;
  const g = k.getContext("2d");
  g.fillStyle = c.hatchBg; g.fillRect(0, 0, 10, 10);
  g.strokeStyle = c.hatchLine; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-2, 12); g.lineTo(12, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(8, 12); g.lineTo(12, 8); g.stroke();
  return g.createPattern(k, "repeat");
}
const slotColor = (slot, c) => (slot === "hatch" ? hatch(c) : c.s[slot]);
const dim = (color) => (typeof color === "string" ? window.Chart.helpers.color(color).alpha(0.55).rgbString() : color);

/* ------------------------------------------------------------------ small DOM helpers */
const legend = (id, items) => { $(id).innerHTML = items.map((i) => `<li><span class="sw" data-slot="${i.slot}"></span>${esc(i.label)}</li>`).join(""); };
function table(id, head, rows) {
  $(id).innerHTML = `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table>`;
}
const monthTitle = (months, partial, i) => `${monthLabel(months[i])}${partial?.[i] ? ` (partial, data to ${snapshotDay})` : ""}`;
const withCi = (v, ci, f = approx, r = range) => `${f(v)}${ci ? ` (95% interval ${r(ci)})` : ""}`;

/* ------------------------------------------------------------------ hero */
$("hero-number").innerHTML = `<span aria-hidden="true">≈</span><span class="sr-only">about </span>${esc(compact(hero.requests))}`;
$("hero-lede").textContent = `signature requests on NEAR's MPC signer (v1.signer), ${monthLabel(hero.firstMonth)} to ${snapshotDay}: the volume behind the finding above. An estimate: the 95% interval of sampling error only is ${range(hero.requestsCi, precise)}.`;
$("facts").innerHTML = `
  <li><strong>${pct(hero.fulfilled, 1)}</strong>of sampled requests end with a successful signature callback (latency and downtime not measured)</li>
  <li><strong>${approx(hero.withoutBenchmark)}</strong>if the suspected benchmark account is left out</li>
  <li class="badge"><strong>${hero.verified}/${hero.sample} parsed correctly</strong>sampled transactions whose parsing matches an archival RPC node and NearBlocks (${dayLabel(hero.verifyDate)}); a check of the parsing, not of the estimate. Re-run: <code>npm run verify -- --sample ${hero.sample}</code></li>`;
let strokeAnimated = false;
function drawStroke() {
  // Drawn in real pixels of the container (no non-uniform SVG scaling, which kept the page repainting every frame); redrawn on resize.
  const svg = $("stroke");
  const full = fullMonths(metrics);
  const vals = full.map((m) => m.series_requests_est.all.value);
  const last = metrics.months.at(-1);
  const W = Math.max(280, Math.round(svg.parentElement.clientWidth)), H = Math.round(Math.min(230, Math.max(120, W * 0.24)));
  const padX = 6, top = 22, base = H - 14;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  const n = metrics.months.length;
  const max = Math.max(...vals);
  const x = (i) => padX + (i / (n - 1)) * (W - 2 * padX);
  const y = (v) => base - (v / max) * (base - top);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  // Catmull-Rom to cubic Bezier, clamped so the pen never dips below the baseline
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(base, p1[1] + (p2[1] - p0[1]) / 6)], c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(base, p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const lastFull = pts.at(-1);
  const tail = last.partial_month ? `<path class="tail" d="M${lastFull[0].toFixed(1)},${lastFull[1].toFixed(1)} L${x(n - 1).toFixed(1)},${y(last.series_requests_est.all.value).toFixed(1)}"/>` : "";
  const peakI = vals.indexOf(max);
  svg.innerHTML = `<line class="base" x1="0" x2="${W}" y1="${base}" y2="${base}"/><path class="ink" id="pen" d="${d}"/>${tail}`
    + `<circle cx="${pts[peakI][0].toFixed(1)}" cy="${pts[peakI][1].toFixed(1)}" r="5" fill="var(--paper)" stroke="var(--ink)" stroke-width="2.5"/>`;
  // One entrance, first draw only: the line is revealed left to right like a pen stroke (driven by requestAnimationFrame, no CSS transition), then the clip is removed.
  if (!strokeAnimated && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const t0 = performance.now(), dur = 2000;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    svg.style.clipPath = "inset(-10px 100% -10px -10px)";
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      if (t >= 1) { svg.style.clipPath = "none"; return; }
      svg.style.clipPath = `inset(-10px ${((1 - ease(t)) * 100).toFixed(2)}% -10px -10px)`;
      requestAnimationFrame(step);
    })(t0);
  }
  strokeAnimated = true;
  $("stroke-caption").textContent = `Estimated requests per month, ${monthLabel(hero.firstMonth)} to ${monthLabel(full.at(-1).month)}. The ring marks the peak: ${monthLabel(hero.peakMonth)}, ${approx(hero.peakValue)}.${last.partial_month ? ` The dotted tail is ${monthLabel(last.month)}, only counted to ${snapshotDay}.` : ""}`;
}
drawStroke();
let resizeTimer;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawStroke, 150); });

/* ------------------------------------------------------------------ charts */
const charts = {};
function mount(id, config) { charts[id]?.destroy(); charts[id] = new window.Chart($(id), config); }
function baseOptions(c, extra = {}) {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false }, ...extra.plugins },
    scales: { ...extra.scales },
  };
}
const axis = (c, months, stacked = true) => ({ stacked, grid: { display: false }, border: { color: c.rule }, ticks: { color: c.muted, autoSkip: true, maxRotation: 0, callback(v) { return monthShort(months[v]); } } });
const yAxis = (c, stacked, f = compact, extra = {}) => ({ stacked, beginAtZero: true, border: { display: false }, grid: { color: c.rule }, ticks: { color: c.muted, callback: (v) => f(v), maxTicksLimit: 6 }, ...extra });

function usageChart(c) {
  const excl = $("excl-bench").checked;
  const st = stackedSeries(metrics, { excludeBenchmark: excl });
  const lastI = st.months.length - 1;
  legend("legend-usage", st.series);
  mount("chart-usage", {
    type: "bar",
    data: { labels: st.months, datasets: st.series.map((s) => ({ label: s.label, data: s.values, stack: "s", borderColor: c.surface, borderWidth: 1.5, borderSkipped: false, backgroundColor: (ctx) => { const col = slotColor(s.slot, c); return st.partial[lastI] && ctx.dataIndex === lastI ? dim(col) : col; }, _ci: s.ci })) },
    options: baseOptions(c, {
      plugins: { tooltip: { callbacks: {
        title: (items) => monthTitle(st.months, st.partial, items[0].dataIndex),
        label: (ctx) => { const v = ctx.parsed.y; if (!v) return null; return ` ${ctx.dataset.label}: ${withCi(v, ctx.dataset._ci[ctx.dataIndex])}`; },
        footer: (items) => `All shown: ${approx(items.reduce((a, i) => a + i.parsed.y, 0))}`,
      } } },
      scales: { x: axis(c, st.months), y: yAxis(c, true) },
    }),
  });
  table("table-usage", ["Month", ...st.series.map((s) => s.label), "Total"], st.months.map((m, i) => [monthLabel(m) + (st.partial[i] ? " (partial)" : ""), ...st.series.map((s) => int(s.values[i])), int(st.series.reduce((a, s) => a + s.values[i], 0))]));
}

function chainsChart(c) {
  const cs = chainSeries(metrics);
  legend("legend-chains", cs.series);
  const partial = metrics.months.map((m) => m.partial_month);
  mount("chart-chains", {
    type: "bar",
    data: { labels: cs.months, datasets: cs.series.map((s) => ({ label: s.label, data: s.values, stack: "s", borderColor: c.surface, borderWidth: 1.5, borderSkipped: false, backgroundColor: slotColor(s.slot, c), _ci: s.ci })) },
    options: baseOptions(c, {
      plugins: { tooltip: { callbacks: { title: (items) => monthTitle(cs.months, partial, items[0].dataIndex), label: (ctx) => ` ${ctx.dataset.label}: ${withCi(ctx.parsed.y, ctx.dataset._ci[ctx.dataIndex], (v) => approxPct(v), (ci) => rangePct(ci))}` } } },
      scales: { x: axis(c, cs.months), y: yAxis(c, true, (v) => pct(v), { max: 1 }) },
    }),
  });
  table("table-chains", ["Month", ...cs.series.map((s) => s.label)], cs.months.map((m, i) => [monthLabel(m), ...cs.series.map((s) => pct(s.values[i], 1))]));
}

function bridgesChart(c) {
  const b = bridgeSeries(metrics);
  const lineColor = c.ink;
  legend("legend-bridges", [...BRIDGES, { label: b.structural.label, slot: "ink" }]);
  mount("chart-bridges", {
    data: { labels: b.months, datasets: [
      ...b.series.map((s) => ({ type: "bar", label: s.label, data: s.values, stack: "s", order: 2, borderColor: c.surface, borderWidth: 1.5, borderSkipped: false, backgroundColor: slotColor(s.slot, c), _ci: s.ci })),
      { type: "line", label: "All structural requests", data: b.structural.values, order: 1, borderColor: lineColor, backgroundColor: lineColor, borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, tension: 0.25, _ci: b.structural.ci },
    ] },
    options: baseOptions(c, {
      plugins: { tooltip: { callbacks: { title: (items) => monthTitle(b.months, b.partial, items[0].dataIndex), label: (ctx) => { if (!ctx.parsed.y) return null; return ` ${ctx.dataset.label}: ${withCi(ctx.parsed.y, ctx.dataset._ci[ctx.dataIndex])}`; } } } },
      scales: { x: axis(c, b.months), y: yAxis(c, true) },
    }),
  });
  table("table-bridges", ["Month", ...b.series.map((s) => s.label), "All structural"], b.months.map((m, i) => [monthLabel(m) + (b.partial[i] ? " (partial)" : ""), ...b.series.map((s) => int(s.values[i])), int(b.structural.values[i])]));
}

/* scenario chart */
const sel = { retention: null, benchmark: null, growth: null };
const sunsetPlugin = { id: "sunset", afterDatasetsDraw(chart, _a, o) {
  const i = o.index; if (i < 0) return;
  const { ctx, chartArea, scales } = chart; const x = scales.x.getPixelForValue(i);
  ctx.save(); ctx.strokeStyle = o.color; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = o.color; ctx.font = `600 12px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = x > chartArea.right - 120 ? "right" : "left";
  ctx.fillText(o.text, x + (ctx.textAlign === "left" ? 6 : -6), chartArea.top + 12); ctx.restore();
} };
function scenarioView(c) {
  const ch = scenarioChart(metrics, scenarios, sel);
  const s = ch.scenario;
  const base = scenarios.baseline;
  const endMonth = scenarios.fastauth_end_month;
  const baseI = ch.months.indexOf(ch.baselineMonth);
  $("scenario-result").textContent = `In ${monthLabel(s.end_month)} this scenario gives ${approx(s.end_month_total)} requests a month, ${s.end_month_vs_baseline >= 0 ? "+" : "−"}${pct(Math.abs(s.end_month_vs_baseline))} against the baseline month ${monthLabel(base.month)} (${approx(base.all)}). Cumulative from ${monthLabel(s.projection ? Object.keys(s.projection)[0] : s.end_month)} to ${monthLabel(s.end_month)}: ${approx(s.cumulative_requests)}.`;
  legend("legend-scenario", [{ label: "Estimated, recent months", slot: "ink" }, { label: "Scenario: all requests", slot: "line" }, { label: "Scenario: structural", slot: 3 }, { label: "Scenario: FastAuth", slot: 1 }]);
  const line = (label, data, color, extra = {}) => ({ type: "line", label, data, borderColor: color, backgroundColor: color, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 5, tension: 0.2, spanGaps: false, ...extra });
  mount("chart-scenario", {
    data: { labels: ch.months, datasets: [
      line("Estimated", ch.history, c.ink, { pointRadius: 2.5 }),
      line("Scenario: all requests", ch.total, c.ink, { borderDash: [6, 5] }),
      line("Scenario: structural", ch.structural, c.s[3]),
      line("Scenario: FastAuth", ch.fastauth, c.s[1]),
    ] },
    options: { ...baseOptions(c, {
      plugins: { tooltip: { callbacks: { title: (items) => `${monthLabel(ch.months[items[0].dataIndex])}${items[0].dataIndex > baseI ? " (scenario)" : ""}`, label: (ctx) => (ctx.parsed.y == null ? null : ` ${ctx.dataset.label}: ${approx(ctx.parsed.y)}`) } },
        sunset: { index: ch.months.indexOf(endMonth), color: c.ink, text: `Sweat ends: ${dayLabel(scenarios.event.date)}` } },
      scales: { x: axis(c, ch.months, false), y: yAxis(c, false) },
    }) },
    plugins: [sunsetPlugin],
  });
  table("table-scenario", ["Month", "Estimated", "Scenario: all", "Scenario: structural", "Scenario: FastAuth"], ch.months.map((m, i) => [monthLabel(m), ch.history[i] == null ? "" : int(ch.history[i]), ch.total[i] == null ? "" : int(ch.total[i]), ch.structural[i] == null ? "" : int(ch.structural[i]), ch.fastauth[i] == null ? "" : int(ch.fastauth[i])]));
}

function renderCharts() {
  const c = palette();
  window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  window.Chart.defaults.font.size = 12;
  window.Chart.defaults.color = c.muted;
  usageChart(c); chainsChart(c); bridgesChart(c); scenarioView(c);
}

/* ------------------------------------------------------------------ usage / who / chains text */
const peakInfo = `Largest month: ${monthLabel(hero.peakMonth)}, ${approx(hero.peakValue)}.`;
$("usage-intro").textContent = `Estimated signature requests per month, stacked by who sends them. ${peakInfo} Hover a bar for the 95% sampling interval, or open the table. ${monthLabel(hero.lastMonth)} is partial (data to ${snapshotDay}) and drawn lighter.`;
$("excl-bench").addEventListener("change", () => usageChart(palette()));

const rows = requesterRows(metrics, labels);
const topShare = rows.reduce((a, r) => a + r.share, 0);
$("who-intro").textContent = `The ${rows.length} largest requesters hold ${approxPct(topShare)} of all requests. Share is of all requests since ${monthLabel(hero.firstMonth)}, with its 95% interval; the requester is the account that called sign, not the transaction signer. A label needs evidence, and every row links its sources.`;
const dots = { high: "●●●", medium: "●●○", low: "●○○" };
const labelText = (r) => (r.category === "unknown" && r.suspected ? "Unknown, suspected benchmark" : r.category ? categoryName(r.category) : "Not labeled");
/** first sentence visible, the rest behind a toggle (labels carry long notes) */
function noteBlock(note) {
  const t = String(note ?? "").trim();
  const m = /^(.{40,}?[.!?])\s+(.+)$/s.exec(t);
  if (!m) return esc(t);
  return `${esc(m[1])}<details><summary>Read the full note</summary>${esc(m[2])}</details>`;
}
const evidenceList = (ev) => `<ul>${ev.map((e) => `<li>${esc(e.claim)} <a href="${esc(e.url)}" rel="noopener noreferrer">source</a></li>`).join("")}</ul>`;
$("who-table").innerHTML = `<table class="rq"><thead><tr><th scope="col">Requester</th><th scope="col" class="num">Share of requests</th><th scope="col" class="num">Requests</th><th scope="col">Label confidence</th><th scope="col">Evidence</th></tr></thead><tbody>${rows.map((r) => `
  <tr class="main"><td class="acctcell" data-label="Requester"><span class="acct">${esc(r.account)}</span><span class="sub">${esc(labelText(r))}${r.owner ? ` · ${esc(r.owner)}` : ""}</span></td>
  <td class="num" data-label="Share"><span class="share">${approxPct(r.share, r.share < 0.1 ? 1 : 0)}</span><span class="ci">${rangePct(r.shareCi, 1)}</span></td>
  <td class="num" data-label="Requests">${approx(r.requests)}<span class="ci">${range(r.requestsCi)}</span></td>
  <td class="conf" data-label="Confidence">${r.confidence ? `<span class="dots" aria-hidden="true">${dots[r.confidence]}</span> ${esc(r.confidence)}` : "no label"}</td>
  <td data-label="Evidence">${r.evidence.length ? `<details><summary>${r.evidence.length} source${r.evidence.length > 1 ? "s" : ""}</summary>${evidenceList(r.evidence)}</details>` : "none"}</td></tr>
  ${r.integrator ? `<tr class="integrator"><td colspan="5"><div class="integ"><strong>Dominant integrator: ${esc(r.integrator.name)}</strong> (confidence ${esc(r.integrator.confidence)}). ${noteBlock(r.integrator.note)}<details><summary>${r.integrator.evidence.length} sources for this</summary>${evidenceList(r.integrator.evidence)}</details></div></td></tr>`
    : r.suspected ? `<tr class="integrator"><td colspan="5"><div class="integ bench">${noteBlock(r.note)}</div></td></tr>` : ""}`).join("")}</tbody></table>`;

const fams = chainFamilies(metrics);
const FAM = { near: "NEAR itself", bitcoin: "Bitcoin", zcash: "Zcash", multi: "Several chains", unknown: "Not known", evm: "EVM chains", solana: "Solana", other: "Other" };
const near = fams.find((f) => f.id === "near");
$("chains-intro").textContent = `Share of requests by where the signature is used, per month. “NEAR itself” means keys of NEAR accounts (FastAuth logins); “other chains” are Bitcoin, Zcash and bridges that sign for several chains; “not known” means no evidence-backed rule. Over the whole period NEAR itself is ${approxPct(near.share)} (interval ${rangePct(near.ci)}).`;
$("families").innerHTML = fams.map((f) => `<div class="row"><span>${esc(FAM[f.id] ?? f.id)}</span><span class="bar" aria-hidden="true"><i style="width:${(f.share * 100).toFixed(1)}%"></i></span><span>${approxPct(f.share)} <span class="ci" style="display:inline">${rangePct(f.ci)}</span></span></div>`).join("");

/* ------------------------------------------------------------------ sunset + scenarios */
const ev = scenarios.event;
$("sunset-callout").innerHTML = `<p>“${esc(ev.statement)}”</p><footer>${esc(ev.issuer)}. Date: ${dayLabel(ev.date)}. <a href="${esc(ev.source)}" rel="noopener noreferrer">Source</a></footer>`;
const rel = metrics.totals.relayer_share_of_requester["fast-auth.near via sweat-relayer.near"];
const fa = rows.find((r) => r.account === "fast-auth.near");
$("sunset-intro").textContent = `${approxPct(rel.value, 2)} of FastAuth requests are relayed by sweat-relayer.near under the Sweat Foundation's login issuer, and FastAuth is ${approxPct(fa.share)} of all requests. Pick what happens to that traffic after ${dayLabel(ev.date)}, whether the suspected benchmark keeps running, and how fast the rest (“structural” demand) grows. These are scenarios, not forecasts.`;
const opts = scenarioOptions(scenarios);
sel.retention = opts.retention[0]; sel.benchmark = opts.benchmark.includes("removed") ? "removed" : opts.benchmark[0]; sel.growth = opts.growth.find((g) => g === 0) ?? opts.growth[0];
const sgn = (g) => (g > 0 ? "+" : g < 0 ? "−" : "") + pct(Math.abs(g));
const groups = [
  { key: "retention", legend: `FastAuth traffic after ${dayLabel(ev.date)}`, values: opts.retention, text: (v) => (v === 0 ? "stops" : v === 1 ? "all stays" : `${pct(v)} stays`) },
  { key: "benchmark", legend: "Suspected benchmark", values: opts.benchmark, text: (v) => (v === "kept" ? "keeps running" : "stops") },
  { key: "growth", legend: "Structural demand per month", values: opts.growth, text: (v) => (v === 0 ? "flat" : sgn(v)) },
];
$("scenario").innerHTML = groups.map((g) => `<fieldset><legend>${esc(g.legend)}</legend><div class="seg">${g.values.map((v) => `<label><input type="radio" name="${g.key}" value="${esc(String(v))}"${v === sel[g.key] ? " checked" : ""}><span>${esc(g.text(v))}</span></label>`).join("")}</div></fieldset>`).join("");
$("scenario").addEventListener("change", (e) => {
  const g = groups.find((x) => x.key === e.target.name); if (!g) return;
  sel[g.key] = g.values.find((v) => String(v) === e.target.value);
  scenarioView(palette());
});
$("scenario-note").textContent = `Baseline = ${monthLabel(scenarios.baseline.month)}, the last full month: ${approx(scenarios.baseline.all)} requests, of which FastAuth ${approx(scenarios.baseline.fastauth)}, suspected benchmark ${approx(scenarios.baseline.benchmark)}, structural ${approx(scenarios.baseline.structural)}. ${scenarios.scenarios.length} precomputed combinations; edit assumptions.yaml and run npm run reproduce to try others. Two simplifications to keep in mind: FastAuth is held at its ${monthLabel(scenarios.baseline.month)} level until the Sweat end date although it has been falling every month, and the default selection (FastAuth stops, benchmark stops, flat structural demand) removes both large non-structural parts; it is a cautious view, not a forecast (shrinking structural demand would be lower still).`;

/* ------------------------------------------------------------------ bridges */
{
  const b = bridgeSeries(metrics);
  const lastFull = fullMonths(metrics).at(-1).month;
  const i = b.months.indexOf(lastFull);
  const sum = b.series.reduce((a, s) => a + s.values[i], 0);
  const pk = metrics.derived.bridges_peak_month;
  $("bridges-intro").textContent = `The Omni, Bitcoin and Zcash connectors sign for bridge transfers. They peaked in ${monthLabel(pk.month)} at ${approx(pk.value)} requests, and in ${monthLabel(lastFull)} made ${approx(sum)} (${approxPct(Math.abs(metrics.derived.bridges_last_full_vs_peak))} below the peak), ${approxPct(sum / b.structural.values[i])} of all structural requests (everything except the suspected benchmark and FastAuth). Every month is in the chart and the table. Over the whole period the three connectors made ${approx(metrics.totals.series_requests_est.bridges.value)} requests.`;
}

/* ------------------------------------------------------------------ thesis, re-run, honest notes */
const S = thesis.sections;
$("fivelines").innerHTML = S["in-five-lines"].bullets.map((b) => `<li>${inline(b)}</li>`).join("");
$("nearview").innerHTML = S["what-this-means-for-a-long-term-near-view"].bullets.map((b) => `<li>${inline(b)}</li>`).join("");
$("wrong").innerHTML = S["what-would-prove-this-thesis-wrong"].bullets.map((b) => `<li>${inline(b)}</li>`).join("");
const hash = manifest.files["data/metrics.json"];
$("rerun-steps").innerHTML = [
  ["npm test", "Unit tests for parsing, labels, estimates, THESIS.md numbers, scenarios and this page's data. Ends with the vitest summary and exit code 0."],
  ["npm run reproduce", `Rebuilds out/metrics.json, out/scenarios.json and THESIS.md from the committed data, offline. It prints: out/metrics.json written. sha256 ${hash.slice(0, 16)}… (this page was built from that exact file).`],
  [`npm run verify -- --sample ${verify.sample}`, `Draws ${verify.sample} seeded random transactions with sign receipts and re-checks signer, block height and sign receipts at an archival RPC node and at NearBlocks (add --seed <n> for another draw). It checks the parsing, not the estimate. Last run: ${verify.verified}/${verify.sample} verified (RPC ${verify.rpc_ok}/${verify.sample}, NearBlocks ${verify.nearblocks_ok}/${verify.sample}).`],
  ["npm run build:site && npm run site", "Copies the two JSON files into site/data/ with their sha256 and serves this page on http://127.0.0.1:4173/."],
].map(([cmd, what]) => `<div class="step"><h3>${esc(cmd)}</h3><p>${esc(what)}</p></div>`).join("");
const para = (md) => md.split(/\n\n+/).filter((p) => !p.startsWith("*")).map((p) => `<p>${inline(p.replace(/\n/g, " "))}</p>`).join("");
$("honest-body").innerHTML = `
  <h3>Comparison with the existing dashboard</h3>${para(S["comparison-with-the-existing-dashboard"].markdown)}
  <h3>What this census cannot measure</h3><ul>${S["what-this-census-cannot-measure"].bullets.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>
  <h3>Evidence against the thesis</h3><ul>${S["evidence-against-and-why-the-claim-could-be-too-pessimistic-or-too-optimistic"].bullets.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>
  <h3>Read more</h3><p><a href="docs/THESIS.md">THESIS.md</a> (full text, every number footnoted to its JSON path) · <a href="docs/METHODOLOGY.md">METHODOLOGY.md</a> (definitions, sampling, limits).</p>`;
$("foot").innerHTML = `Data: exact transaction counts as of block ${int(metrics.meta.snapshot.block_height)} (${snapshotDay}); requests are estimates from a cluster sample. metrics.json sha256 <code>${hash}</code>. No cookies, no tracking, no network requests beyond this server.`;

renderCharts();
document.documentElement.dataset.ready = "1";
document.documentElement.dataset.readyMs = String(Math.round(performance.now())); // ms from navigation start to "all sections rendered" (used by the load-time check)
