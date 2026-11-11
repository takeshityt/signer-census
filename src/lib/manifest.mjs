// sha256 manifests: "<hex>  <relative path>" per line, sorted by path (same layout as `shasum -a 256`).
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
/** Content hash of a file. For *.gz files the hash is taken over the DECOMPRESSED bytes, so it does not depend on the zlib version that produced the archive. */
export const fileHash = (path) => { const b = readFileSync(path); return sha256(path.endsWith(".gz") ? gunzipSync(b) : b); };

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Hash every file under `dir` (paths relative to `root`), skipping files whose relative path matches `exclude`. */
export function buildManifest(root, dir, exclude = () => false) {
  return walk(join(root, dir))
    .map((p) => relative(root, p))
    .filter((rel) => !exclude(rel))
    .sort()
    .map((rel) => `${fileHash(join(root, rel))}  ${rel}`);
}

export function writeManifest(path, lines) {
  writeFileSync(path, lines.join("\n") + (lines.length ? "\n" : ""));
}

/** Returns { ok, checked, problems[] }. Missing manifest => not ok. */
export function checkManifest(root, manifestPath, { allowMissing = false } = {}) {
  if (!existsSync(manifestPath)) return { ok: false, checked: 0, problems: [`missing ${manifestPath}`] };
  const problems = [];
  let checked = 0, missing = 0;
  for (const line of readFileSync(manifestPath, "utf8").split("\n").filter(Boolean)) {
    const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    if (!m) { problems.push(`bad line: ${line}`); continue; }
    const file = join(root, m[2]);
    if (!existsSync(file)) { missing++; if (!allowMissing) problems.push(`missing file: ${m[2]}`); continue; }
    checked++;
    if (fileHash(file) !== m[1]) problems.push(`hash mismatch: ${m[2]}`);
  }
  return { ok: problems.length === 0, checked, missing, problems };
}
