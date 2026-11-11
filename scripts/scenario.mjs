#!/usr/bin/env node
// Writes out/scenarios.json from out/metrics.json + assumptions.yaml. Also run by `npm run reproduce`.
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import { baselineFrom, runScenarios } from "../src/scenario.mjs";
import { sha256 } from "../src/lib/manifest.mjs";
const ROOT = new URL("..", import.meta.url).pathname;
export function writeScenarios() {
  const metrics = JSON.parse(readFileSync(`${ROOT}out/metrics.json`, "utf8"));
  const a = parse(readFileSync(`${ROOT}assumptions.yaml`, "utf8"));
  const res = runScenarios(baselineFrom(metrics, a), a);
  const text = JSON.stringify({ note: "SCENARIOS, not forecasts. Change assumptions.yaml and re-run `npm run reproduce`.", assumptions_file: "assumptions.yaml", ...res }, null, 2) + "\n";
  writeFileSync(`${ROOT}out/scenarios.json`, text);
  return { count: res.scenarios.length, sha256: sha256(Buffer.from(text)), baseline: res.baseline.month };
}
if (import.meta.url === `file://${process.argv[1]}`) { const r = writeScenarios(); console.log(`out/scenarios.json written (${r.count} scenarios, baseline ${r.baseline}). sha256 ${r.sha256}`); }
