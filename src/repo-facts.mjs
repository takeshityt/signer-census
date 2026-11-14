// Facts about the repository itself that documents quote (test count, output hashes, manifest sizes, last verify run).
// Computed deterministically from committed files, so README.md and the submission drafts can be checked by `npm test`.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "./lib/manifest.mjs";
import { latestVerify } from "../scripts/build-site.mjs";

/** Number of test cases: static count of `it(` calls in test/*.test.mjs (equals the vitest "Tests N passed" count; no it.each is used). */
export function countTests(root) {
  return readdirSync(join(root, "test")).filter((f) => f.endsWith(".test.mjs"))
    .reduce((n, f) => n + (readFileSync(join(root, "test", f), "utf8").match(/(?<![\w.])it\(/g) ?? []).length, 0);
}
const lines = (p) => readFileSync(p, "utf8").split("\n").filter(Boolean).length;

export function repoFacts(root) {
  const v = latestVerify(join(root, "docs/evidence/verify"));
  return {
    tests: countTests(root),
    test_files: readdirSync(join(root, "test")).filter((f) => f.endsWith(".test.mjs")).length,
    metrics_sha256: sha256(readFileSync(join(root, "out/metrics.json"))),
    scenarios_sha256: sha256(readFileSync(join(root, "out/scenarios.json"))),
    data_manifest_files: lines(join(root, "data/MANIFEST.sha256")),
    raw_manifest_files: lines(join(root, "data/MANIFEST.raw-sample.sha256")),
    crosscheck: existsSync(join(root, "out/crosscheck.json")) ? JSON.parse(readFileSync(join(root, "out/crosscheck.json"), "utf8")) : null,
    predictions_check_after: JSON.parse(readFileSync(join(root, "config/predictions.json"), "utf8")).check_after,
    predictions_count: JSON.parse(readFileSync(join(root, "config/predictions.json"), "utf8")).predictions.length,
    node_engines: JSON.parse(readFileSync(join(root, "package.json"), "utf8")).engines.node,
    verify: { verified: v.verified, sample: v.sample, rpc_ok: v.rpc_ok, nearblocks_ok: v.nearblocks_ok, date: v.date, file: v.file, seed: v.seed },
  };
}
