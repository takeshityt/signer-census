// Number and date formatting for the dashboard. Pure functions (unit-tested). Estimates are shown with "≈" and rounded.
export function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}
export const approx = (n) => `≈${compact(n)}`;
export const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
export const approxPct = (x, d = 0) => `≈${pct(x, d)}`;
export const range = (ci, fmt = compact) => (ci ? `${fmt(ci[0])}–${fmt(ci[1])}` : null);
export const rangePct = (ci, d = 0) => range(ci, (x) => pct(x, d));
export const int = (n) => Math.round(n).toLocaleString("en-US");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10" -> "Oct 2026" (no Intl, so it is identical in every locale and in tests) */
export const monthLabel = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export const monthShort = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ’${m.slice(2, 4)}`;
/** "2026-12-30" or ISO timestamp -> "30 Dec 2026" */
export const dayLabel = (s) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
