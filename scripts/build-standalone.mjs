#!/usr/bin/env node
// Builds ONE self-contained HTML file from a site/ folder: CSS, JS (a tiny module bundler, no dependencies), fonts as base64 and every data/*.json inlined.
// It opens by double-click via file:// and needs no network. Usage: node scripts/build-standalone.mjs <site dir> <out.html>
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export function buildStandalone(siteDir, outFile) {
  const read = (p) => readFileSync(join(siteDir, p), "utf8");
  // --- JS: every module becomes a function; "import {a} from './x.js'" becomes a lookup, "export" becomes an assignment on the module's exports
  const mods = {};
  for (const f of readdirSync(join(siteDir, "js")).filter((f) => f.endsWith(".js"))) {
    let src = read(`js/${f}`);
    const names = [];
    src = src.replace(/import\s*\{([^}]*)\}\s*from\s*"\.\/([^"]+)";?/g, (_, list, file) => `const {${list.replace(/\s+as\s+/g, ": ")}} = __req("${file}");`);
    src = src.replace(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (m, n) => { names.push(n); return m.replace(/^export\s+/, ""); });
    if (/^export\s/m.test(src)) throw new Error(`${f}: unsupported export form`);
    mods[f] = { src, names };
  }
  const wrap = (f, { src, names }) => f === "main.js"
    ? `(async () => {\nconst __req = (n) => __modules(n);\n${src}\n})().catch((e) => { document.body.insertAdjacentHTML("afterbegin", "<pre>" + e + "</pre>"); throw e; });`
    : `__define(${JSON.stringify(f)}, (__exp, __req) => {\n${src}\n${names.map((n) => `__exp.${n} = ${n};`).join("\n")}\n});`;
  const runtime = `const __defs = {}, __cache = {};
const __define = (n, fn) => { __defs[n] = fn; };
function __modules(n) { if (__cache[n]) return __cache[n]; const e = (__cache[n] = {}); if (!__defs[n]) throw new Error("module " + n + " missing"); __defs[n](e, __modules); return e; }`;
  const js = runtime + "\n" + Object.entries(mods).filter(([f]) => f !== "main.js").map(([f, m]) => wrap(f, m)).join("\n") + "\n" + wrap("main.js", mods["main.js"]);
  // --- data
  const data = {};
  for (const f of readdirSync(join(siteDir, "data")).filter((f) => f.endsWith(".json"))) data[f] = JSON.parse(read(`data/${f}`));
  const dataJs = `window.__DATA = ${JSON.stringify(data).replace(/<\//g, "<\\/")};`;
  let main = js.replace(/const getJSON = [^\n]*\n/, "const getJSON = (f) => Promise.resolve(window.__DATA[f]);\n");
  if (!/window\.__DATA\[f\]/.test(main)) throw new Error("getJSON line not found in main.js");
  // --- CSS with fonts inlined
  const css = read("css/style.css").replace(/url\("\.\.\/vendor\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(siteDir, "vendor/fonts", f)).toString("base64")}")`);
  // --- HTML
  let html = read("index.html")
    .replace(/<link rel="preload"[^>]*>\n?/g, "")
    .replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>\n${css}\n</style>`)
    .replace(/<script type="module" src="js\/main.js"><\/script>/, () => `<script>\n${dataJs}\n</script>\n<script>\n${main.replace(/<\/script/gi, "<\\/script")}\n</script>`);
  { const m = html.replace(dataJs, "").replace(/data:font[^"')]*/g, "").match(/.{30}(?:href="css\/|src="js\/|vendor\/fonts).{30}/s); if (m) throw new Error("an external reference is left in the page: " + m[0]); }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
  return html.length;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [site, out] = process.argv.slice(2);
  if (!site || !out) { console.error("usage: node scripts/build-standalone.mjs <site dir> <out.html>"); process.exit(2); }
  console.log(`${out}: ${(buildStandalone(site, out) / 1024).toFixed(0)} KB`);
}
