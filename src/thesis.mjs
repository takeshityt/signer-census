// Renders THESIS.md from docs/THESIS.template.md so that every number comes from out/metrics.json / out/scenarios.json.
// Placeholders:
//   {{m:<path>|<fmt>}}  value from out/metrics.json      {{s:<path>|<fmt>}}  value from out/scenarios.json
//   {{r:<path>|<fmt>}}  repository fact (src/repo-facts.mjs: test count, output sha256, last verify run)
//   {{include:<template file>#<section heading>}}  the body of that section of another template (expanded before rendering; used to reuse text, never retype it)
//   {{lit:<text>}}      a definition we set (dates, thresholds) - not a measurement
//   {{ext:<text>|<url>}} an external figure, always rendered with its source URL (as a Markdown link, or as "text (url)" when footnotes are off)
// Path syntax: dot-separated; "name[2026-10]" selects the array element whose month/id/requester equals the key;
// "name[field=value]" selects by an explicit field; "\"a.b c\"" quotes a key that contains dots or spaces.
// Formats: int, M1, M2, k0, pct0, pct1, pct2, r2, r3, raw; prefix "ci_" renders the 95% interval of an {value, ci95} object (path points at the object).
export const SENT_OPEN = "\u0001", SENT_CLOSE = "\u0002";

export function tokenize(path) {
  const out = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === ".") { i++; continue; }
    if (path[i] === '"') { const j = path.indexOf('"', i + 1); out.push({ key: path.slice(i + 1, j) }); i = j + 1; continue; }
    let j = i;
    while (j < path.length && path[j] !== "." && path[j] !== "[") j++;
    const name = path.slice(i, j);
    if (path[j] === "[") { const k = path.indexOf("]", j); out.push({ key: name, select: path.slice(j + 1, k) }); i = k + 1; }
    else { out.push({ key: name }); i = j; }
  }
  return out;
}

export function resolve(obj, path) {
  let cur = obj;
  for (const t of tokenize(path)) {
    cur = cur?.[t.key];
    if (t.select !== undefined) {
      if (!Array.isArray(cur)) throw new Error(`${path}: ${t.key} is not an array`);
      const [f, v] = t.select.includes("=") ? t.select.split("=") : [null, t.select];
      cur = cur.find((e) => (f ? String(e[f]) === v : e.month === v || e.id === v || e.requester === v || e.date === v));
    }
    if (cur === undefined) throw new Error(`thesis placeholder path not found: ${path}`);
  }
  return cur;
}

const fmtNum = (x, f) => {
  switch (f) {
    case "int": return Math.round(x).toLocaleString("en-US");
    case "M1": return `${(x / 1e6).toFixed(1)}M`;
    case "M2": return `${(x / 1e6).toFixed(2)}M`;
    case "k0": return `${Math.round(x / 1e3).toLocaleString("en-US")}k`;
    case "pct0": return `${Math.round(x * 100)}%`;
    case "pct1": return `${(x * 100).toFixed(1)}%`;
    case "pct2": return `${(x * 100).toFixed(2)}%`;
    case "r2": return x.toFixed(2);
    case "r3": return x.toFixed(3);
    case "raw": return String(x);
    case "Mw": return `${(x / 1e6).toFixed(1)} million`;   // spoken: "6.4 million"
    case "kw": return `${Math.round(x / 1e3).toLocaleString("en-US")} thousand`; // spoken: "237 thousand"
    case "word": case "Word": { const w = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][x]; if (w == null) throw new Error(`no word for ${x}`); return f === "Word" ? w[0].toUpperCase() + w.slice(1) : w; }
    default: throw new Error(`unknown format ${f}`);
  }
};

const EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const RU_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const ym = (x) => { const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(x)); if (!m) throw new Error(`not a date: ${x}`); return { y: m[1], m: Number(m[2]) - 1, d: m[3] ? Number(m[3]) : null }; };
/** Spoken dates for scripts: "2026-08" -> "August 2026"; "2026-12-30" -> "30 December 2026"; Russian nominative / genitive variants. */
const DATE_FMT = {
  month: (x) => { const d = ym(x); return `${EN[d.m]} ${d.y}`; },
  day: (x) => { const d = ym(x); return `${d.d} ${EN[d.m]} ${d.y}`; },
  month_ru: (x) => { const d = ym(x); return `${RU[d.m]} ${d.y}`; },
  month_ru_gen: (x) => { const d = ym(x); return `${RU_GEN[d.m]} ${d.y}`; },
  day_ru: (x) => { const d = ym(x); return `${d.d} ${RU_GEN[d.m]} ${d.y}`; },
};

export function format(v, fmt) {
  if (fmt.startsWith("ci_")) {
    if (!v || !Array.isArray(v.ci95)) throw new Error("ci_ format needs an object with ci95");
    const f = fmt.slice(3);
    return `${fmtNum(v.ci95[0], f)}–${fmtNum(v.ci95[1], f)}`;
  }
  const x = typeof v === "object" && v !== null && "value" in v ? v.value : v;
  if (fmt === "raw" && typeof x === "string") return x; // e.g. a month label
  if (DATE_FMT[fmt]) return DATE_FMT[fmt](x);
  if (typeof x !== "number") throw new Error(`placeholder does not resolve to a number (${JSON.stringify(v).slice(0, 60)})`);
  return fmtNum(x, fmt);
}

/** Expand {{include:file#Heading}} with the body of that "## Heading" section of another template. readFile(path) -> text. */
export function expandIncludes(template, readFile) {
  return template.replace(/\{\{include:([^#}]+)#([^}]+)\}\}/g, (_, file, heading) => {
    const src = readFile(file.trim());
    const m = new RegExp(`^## ${heading.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(src);
    if (!m) throw new Error(`include: section "${heading}" not found in ${file}`);
    return m[1].trim();
  });
}

const SOURCES = { m: "out/metrics.json", s: "out/scenarios.json", r: "repository facts (src/repo-facts.mjs)" };

/** Render. With { sentinels: true } every expansion is wrapped in SENT_OPEN/SENT_CLOSE (used by the "no stray numbers" test).
 *  With { footnotes: false } values are rendered without footnote markers and without the source list (for text that will be pasted elsewhere). */
export function render(template, { metrics, scenarios, repo = {} }, { sentinels = false, footnotes = true } = {}) {
  const notes = [];
  const wrap = (s) => (sentinels ? `${SENT_OPEN}${s}${SENT_CLOSE}` : s);
  const body = template.replace(/\{\{(m|s|r|lit|ext):([^}]*)\}\}/g, (_, kind, rest) => {
    if (kind === "lit") return wrap(rest);
    if (kind === "ext") { const k = rest.lastIndexOf("|"); return wrap(footnotes ? `${rest.slice(0, k)} ([source](${rest.slice(k + 1)}))` : `${rest.slice(0, k)} (${rest.slice(k + 1)})`); }
    const k = rest.lastIndexOf("|");
    const path = rest.slice(0, k), fmt = rest.slice(k + 1);
    const text = format(resolve(kind === "m" ? metrics : kind === "s" ? scenarios : repo, path), fmt);
    if (!footnotes) return wrap(text);
    let n = notes.findIndex((x) => x.kind === kind && x.path === path) + 1;
    if (!n) { notes.push({ kind, path }); n = notes.length; }
    return wrap(`${text}<sup>[${n}]</sup>`);
  });
  if (!footnotes) return body;
  const list = notes.map((x, i) => `${i + 1}. \`${SOURCES[x.kind]}\` → \`${x.path}\``).join("\n");
  const footer = `\n\n---\n\n### Where every number comes from\n\nAll numbers above are generated by \`npm run reproduce\` from committed data (this file is rendered from a template listed in config/rendered-docs.json). Footnotes give the source and path:\n\n${list}\n`;
  return body + (sentinels ? `${SENT_OPEN}${footer}${SENT_CLOSE}` : footer);
}

/** Digits that are NOT produced by a placeholder: outside sentinel spans, code spans, link targets and HTML comments. */
export function strayNumbers(renderedWithSentinels) {
  let t = renderedWithSentinels;
  t = t.replace(new RegExp(`${SENT_OPEN}[\\s\\S]*?${SENT_CLOSE}`, "g"), " ");
  t = t.replace(/<!--[\s\S]*?-->/g, " ").replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ").replace(/\]\([^)]*\)/g, "] ").replace(/https?:\/\/\S+/g, " ");
  const out = [];
  for (const [i, line] of t.split("\n").entries()) { const m = line.match(/\d[\d,.]*/g); if (m) out.push({ line: i + 1, numbers: m, text: line.trim().slice(0, 120) }); }
  return out;
}
