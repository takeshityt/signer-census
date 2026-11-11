#!/usr/bin/env node
// Verifies committed data against data/MANIFEST.sha256 (and the raw-sample manifest if the raw files are present).
import { checkManifest } from "../src/lib/manifest.mjs";
import { existsSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
let bad = false;
for (const m of ["data/MANIFEST.sha256", "data/MANIFEST.raw-sample.sha256"]) {
  if (m.includes("raw-sample") && !existsSync(root + m)) { console.log(`${m}: not present (skipped)`); continue; }
  const raw = m.includes("raw-sample");
  const r = checkManifest(root, root + m, { allowMissing: raw }); // raw sample files are not committed (229 MB); verify those that exist
  console.log(`${m}: ${r.ok ? "OK" : "FAIL"} (${r.checked} files checked${r.missing ? `, ${r.missing} not downloaded` : ""})`);
  for (const p of r.problems) console.log("  -", p);
  if (!r.ok) bad = true;
}
process.exit(bad ? 1 : 0);
