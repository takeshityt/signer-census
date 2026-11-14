// Hand-written docs (docs/METHODOLOGY.md) keep their numbers in sync through markers that `npm run reproduce` refills and `npm test` checks:
//   <!--{{m:path|fmt}}-->VALUE<!--/-->        a single value (m = out/metrics.json, s = out/scenarios.json, r = repository facts)
//   <!-- crosscheck-table -->...<!-- /crosscheck-table -->   the table built from out/crosscheck.json
import { resolve, format } from "./thesis.mjs";

const MARK = /<!--\{\{([msr]):([^|}]+)\|([^}]+)\}\}-->([\s\S]*?)<!--\/-->/g;
export function fillMarkers(text, { metrics, scenarios, repo }) {
  return text.replace(MARK, (_, kind, path, fmt) => `<!--{{${kind}:${path}|${fmt}}}-->${format(resolve(kind === "m" ? metrics : kind === "s" ? scenarios : repo, path), fmt)}<!--/-->`);
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mon = (m) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const int = (n) => Math.round(n).toLocaleString("en-US");
export function crosscheckTable(cc) {
  const head = "| Requester | Month | Our estimate | 95% interval | Exact count | Inside |\n|---|---|---:|---:|---:|---|";
  const rows = cc.comparisons.map((c) => `| ${c.name} | ${mon(c.month)} | ${int(c.estimate)} | ${int(c.ci95[0])}–${int(c.ci95[1])} | ${int(c.exact)} | ${c.inside ? "yes" : "**no**"} |`);
  const units = [...cc.verified, ...cc.not_compared].map((v) => `| ${v.name} | ${v.unit_check.map((u) => `${mon(u.month)}: ${u.sign_receipts} of ${u.txs}`).join("; ")} | ${v.reason ? "not compared" : "compared"} |`);
  return [`**${cc.summary.inside} of ${cc.summary.compared}** monthly comparisons fall inside our 95% intervals (months where the estimate or the exact count is at least ${int(cc.min_compared)}).`, "", head, ...rows, "",
    "Unit check (txs touching the account that carry one sign receipt by it, in sampled windows of the busiest month):", "", "| Requester | Sign receipts / txs checked | Result |\n|---|---|---|", ...units].join("\n");
}
const TABLE = /(<!-- crosscheck-table -->)[\s\S]*?(<!-- \/crosscheck-table -->)/;
export function fillCrosscheck(text, cc) { return text.replace(TABLE, (_, a, b) => `${a}\n${crosscheckTable(cc)}\n${b}`); }
