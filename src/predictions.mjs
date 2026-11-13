// Pure evaluation of the falsification tests in config/predictions.json against out/metrics.json (no imports: usable in the browser too).
const OPS = { "<": (a, b) => a < b, ">=": (a, b) => a >= b };
// paths may contain account names with dots ("drivers_requests.fast-auth.near"), so resolve greedily
function pick(obj, path) {
  const parts = path.split(".");
  const go = (o, i) => {
    if (i === parts.length) return o;
    for (let j = parts.length; j > i; j--) { const key = parts.slice(i, j).join("."); if (o != null && Object.hasOwn(o, key)) { const r = go(o[key], j); if (r !== undefined) return r; } }
    return undefined;
  };
  return go(obj, 0);
}

/** Threshold of one condition in one month (a number, or a path into metrics such as derived.fastauth_trend.half_projection.2027-02). */
export function thresholdOf(cond, month, metrics) {
  if (cond.threshold_path) return pick(metrics, cond.threshold_path.replace("{month}", month));
  return cond.threshold;
}

/** Is the (point, interval) on the breaching side of the threshold? decisive = the whole interval is. */
export function breach(cond, v, t) {
  const holds = OPS[cond.op];
  return { breached: holds(v.value, t), decisive: v.ci95 ? holds(v.ci95[0], t) === holds(v.ci95[1], t) : false };
}

/** Evaluate one prediction: status "HOLDS" | "REFUTED" | "NO DATA", plus one line per month. */
export function evaluate(pred, metrics) {
  const rows = pred.months.map((month) => {
    const m = metrics.months.find((x) => x.month === month);
    if (!m || m.partial_month) return { month, status: "no data" };
    const hits = pred.any_of.map((cond) => {
      const v = pick(m, cond.path), t = thresholdOf(cond, month, metrics);
      if (v == null || t == null || typeof v.value !== "number") return null;
      return { path: cond.path, value: v.value, ci95: v.ci95 ?? null, threshold: t, ...breach(cond, v, t) };
    });
    if (hits.some((h) => h === null)) return { month, status: "no data" };
    const breached = hits.filter((h) => h.breached);
    return { month, status: breached.length ? "breached" : "ok", decisive: breached.length ? breached.every((h) => h.decisive) : hits.every((h) => !h.breached && h.decisive), hits };
  });
  if (rows.some((r) => r.status === "no data")) return { status: "NO DATA", breaches: rows.filter((r) => r.status === "breached").length, rows };
  const breaches = rows.filter((r) => r.status === "breached").length;
  return { status: breaches >= pred.needed ? "REFUTED" : "HOLDS", breaches, rows };
}

/** Days until the check date (UTC); pending until then. */
export function pendingInfo(checkAfter, now = new Date()) {
  const due = new Date(`${checkAfter}T00:00:00Z`);
  return { pending: now < due, days: Math.max(0, Math.ceil((due - now) / 86400000)), due };
}

/** Plain-language rule, filled with the numbers (from the config and from metrics.derived). */
