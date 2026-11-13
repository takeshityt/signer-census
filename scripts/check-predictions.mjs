#!/usr/bin/env node
// `npm run check:predictions`: the falsification tests of THESIS.md (config/predictions.json) against out/metrics.json.
// Before the check date every test is "pending until <date>". After it, refresh the data (see docs/METHODOLOGY.md "Refreshing the data")
// and run this again. Options: --metrics <file> (default out/metrics.json), --as-of YYYY-MM-DD (pretend today is that date; used by the backtest).
import { readFileSync } from "node:fs";
import { evaluate, pendingInfo } from "../src/predictions.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync(`${ROOT}config/predictions.json`, "utf8"));
const metrics = JSON.parse(readFileSync(`${ROOT}${arg("metrics", "out/metrics.json")}`, "utf8"));
const now = arg("as-of") ? new Date(`${arg("as-of")}T00:00:00Z`) : new Date();
const p = pendingInfo(cfg.check_after, now);
if (p.pending) {
  for (const x of cfg.predictions) console.log(`${x.id} ${x.claim}: pending until ${cfg.check_after} (${p.days} days), target months ${x.months.join(", ")}`);
  process.exit(0);
}
let refuted = 0, missing = 0;
for (const x of cfg.predictions) {
  const r = evaluate(x, metrics);
  if (r.status === "REFUTED") refuted++;
  if (r.status === "NO DATA") missing++;
  console.log(`${x.id} ${x.claim}: ${r.status} (${r.breaches} of ${x.months.length} months breached, ${x.needed} needed to refute)`);
  for (const row of r.rows) console.log(`   ${row.month}: ${row.status}${row.hits ? " " + row.hits.map((h) => `${h.path}=${h.value} vs ${h.threshold}${h.breached ? (h.decisive ? " (decisive)" : " (within sampling noise)") : ""}`).join("; ") : " (refresh the data for this month first)"}`);
}
process.exit(refuted || missing ? 1 : 0);
