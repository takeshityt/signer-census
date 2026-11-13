#!/usr/bin/env node
// `npm run build:site`: prepares site/ (static, no runtime network). Copies out/metrics.json and out/scenarios.json into site/data/,
// exports labels.yaml, the verify result and the thesis sections as JSON, vendors the two variable fonts, writes site/data/manifest.json (sha256 of everything copied).
// Deterministic output (no timestamps) so the committed site/ can be compared with a fresh build.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { sha256 } from "../src/lib/manifest.mjs";
import { parseCsv } from "../src/lib/csv.mjs";
import { pickTxs } from "../src/verify.mjs";
import { clusterStats } from "../src/estimate.mjs";
import { parseLabels } from "../src/labels.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

/** Latest verify run that is not under superseded/ (files are named verify-<date>-seed<seed>-n<N>.json). */
export function latestVerify(dir) {
  const files = readdirSync(dir).filter((f) => /^verify-.*\.json$/.test(f)).sort();
  if (!files.length) throw new Error(`no verify-*.json in ${dir}; run: npm run verify -- --sample 50 --out docs/evidence/verify`);
  const file = files.at(-1);
  const d = JSON.parse(readFileSync(join(dir, file), "utf8"));
  return { file, date: /verify-(\d{4}-\d{2}-\d{2})/.exec(file)[1], seed: d.seed, sample: d.sample, verified: d.verified, rpc_ok: d.rpc_ok, nearblocks_ok: d.nearblocks_ok, sources: ["archival-rpc.mainnet.fastnear.com (EXPERIMENTAL_tx_status)", "api.nearblocks.io (/v1/txns, /v2/txns/<hash>/receipts)"] };
}

const slug = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clean = (s) => s.replace(/<sup>\[\d+\]<\/sup>/g, "").replace(/<!--[\s\S]*?-->/g, "");

/** THESIS.md -> { title, sections: { <slug>: { heading, markdown, bullets[] } } }. The footnote block at the end is dropped. */
export function parseThesis(md) {
  const body = clean(md.split("\n---\n")[0]);
  const title = /^# (.+)$/m.exec(body)?.[1] ?? "";
  const sections = {};
  const parts = body.split(/^## /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const heading = p.slice(0, nl).trim();
    const markdown = p.slice(nl + 1).trim();
    const bullets = [];
    for (const line of markdown.split("\n")) {
      if (/^\* /.test(line)) bullets.push(line.slice(2).trim());
      else if (bullets.length && /^\s+\S/.test(line)) bullets[bullets.length - 1] += " " + line.trim();
    }
    sections[slug(heading)] = { heading, markdown, bullets };
  }
  return { title, sections };
}

export function exportLabels(text) {
  const l = parseLabels(text);
  const one = (s) => (s ? String(s).replace(/\s+/g, " ").trim() : null);
  return l.entries.map((e) => ({
    account: e.account, category: e.category, suspected_category: e.suspected_category ?? null, confidence: e.confidence, owner: e.owner ?? null, note: one(e.note),
    evidence: e.evidence.map((x) => ({ url: x.url, claim: one(x.claim) })),
    dominant_integrator: e.dominant_integrator ? { name: e.dominant_integrator.name, confidence: e.dominant_integrator.confidence, note: one(e.dominant_integrator.note), evidence: e.dominant_integrator.evidence.map((x) => ({ url: x.url, claim: one(x.claim) })) } : null,
  }));
}

/** Small deterministic list of sampled sign transactions for the "Verify it yourself" button (expected values come from our parsed sample). */
export function verifySample(root, n = 120) {
  const cfg = JSON.parse(readFileSync(join(root, "config/verify.json"), "utf8"));
  const rows = parseCsv(gunzipSync(readFileSync(join(root, "data/derived/sample_parsed.csv.gz"))).toString());
  return { note: "Seeded random sample of sign transactions from data/derived/sample_parsed.csv.gz. `signs` = sorted requester|status of the sign receipts on v1.signer in the tx.", seed: cfg.seed, rpc: cfg.rpc, nearblocks: cfg.nearblocks, txs: pickTxs(rows, n, cfg.seed) };
}

/** Monthly estimated requests of the largest requesters (point estimates = exact monthly tx total x sampled requests per tx), for the sparklines. */
export function requesterMonthly(root) {
  const metrics = JSON.parse(readFileSync(join(root, "out/metrics.json"), "utf8"));
  const accounts = metrics.totals.top_requesters.map((r) => r.requester);
  const clusters = clusterStats(parseCsv(gunzipSync(readFileSync(join(root, "data/derived/sample_parsed.csv.gz"))).toString()));
  const out = Object.fromEntries(accounts.map((a) => [a, {}]));
  for (const m of metrics.months) {
    const list = clusters.filter((c) => c.month === m.month);
    const n = list.reduce((a, c) => a + c.n_tx, 0);
    if (!n) continue;
    const f = m.tx_total.value / n;
    for (const a of accounts) out[a][m.month] = Math.round(list.reduce((t, c) => t + (c.requesters[a] ?? 0), 0) * f);
  }
  return { note: "Point estimates per month (exact monthly tx total x sampled requests per tx), no intervals. Same method as out/metrics.json.", months: metrics.months.map((m) => m.month), accounts: out };
}

export function buildSite({ root = ROOT, siteDir = join(root, "site") } = {}) {
  for (const f of ["out/metrics.json", "out/scenarios.json", "THESIS.md"]) if (!existsSync(join(root, f))) throw new Error(`${f} is missing; run: npm run reproduce`);
  mkdirSync(join(siteDir, "data"), { recursive: true });
  mkdirSync(join(siteDir, "docs"), { recursive: true });
  mkdirSync(join(siteDir, "vendor/fonts"), { recursive: true });
  const manifest = { note: "sha256 of every file the dashboard reads; `sources` are the files they were copied from", files: {}, sources: {} };
  const copy = (from, to) => { const buf = readFileSync(join(root, from)); writeFileSync(join(siteDir, to), buf); manifest.files[to] = sha256(buf); manifest.sources[to] = from; };
  const emit = (to, obj, from) => { const text = JSON.stringify(obj, null, 1) + "\n"; writeFileSync(join(siteDir, to), text); manifest.files[to] = sha256(Buffer.from(text)); manifest.sources[to] = from; };

  copy("out/metrics.json", "data/metrics.json");
  copy("out/scenarios.json", "data/scenarios.json");
  emit("data/labels.json", exportLabels(readFileSync(join(root, "labels.yaml"), "utf8")), "labels.yaml");
  emit("data/verify.json", latestVerify(join(root, "docs/evidence/verify")), "docs/evidence/verify/verify-*.json (latest)");
  emit("data/thesis.json", parseThesis(readFileSync(join(root, "THESIS.md"), "utf8")), "THESIS.md");
  copy("THESIS.md", "docs/THESIS.md");
  copy("docs/METHODOLOGY.md", "docs/METHODOLOGY.md");
  // browser copies of the pure, import-free modules the page shares with the command line (one implementation, tested)
  mkdirSync(join(siteDir, "js"), { recursive: true });
  for (const [from, to] of [["src/scenario-core.mjs", "js/scenario-core.js"], ["src/verify-core.mjs", "js/verify-core.js"], ["src/predictions.mjs", "js/predictions-core.js"]]) copy(from, to);
  copy("config/predictions.json", "data/predictions.json");
  emit("data/requester-monthly.json", requesterMonthly(root), "data/derived/sample_parsed.csv.gz + out/metrics.json");
  emit("data/verify-sample.json", verifySample(root), "data/derived/sample_parsed.csv.gz (seeded draw, config/verify.json)");
  for (const [pkg, file] of [["bricolage-grotesque", "bricolage-grotesque-latin-wght-normal"], ["geist", "geist-latin-wght-normal"], ["geist-mono", "geist-mono-latin-wght-normal"]]) {
    copy(`node_modules/@fontsource-variable/${pkg}/files/${file}.woff2`, `vendor/fonts/${file}.woff2`);
    copy(`node_modules/@fontsource-variable/${pkg}/LICENSE`, `vendor/fonts/LICENSE-OFL-${pkg}.txt`);
  }
  manifest.files = Object.fromEntries(Object.entries(manifest.files).sort());
  manifest.sources = Object.fromEntries(Object.entries(manifest.sources).sort());
  writeFileSync(join(siteDir, "data/manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = buildSite();
  console.log(`site built: ${Object.keys(m.files).length} files; data/metrics.json sha256 ${m.files["data/metrics.json"]}`);
}
