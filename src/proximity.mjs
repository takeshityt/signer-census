// PART B: our cumulative numbers on the cutoff dates of the proximity_team/v1signer dashboard (series starts 2024-10-01).
// Units compared (all cumulative from 2024-10-01 to the end of the cutoff UTC day):
//   all_txs (exact), request_side_txs (est: txs holding a sign receipt), respond_txs (est: node txs), sign_receipts (est = requests), all_receipts (est: every receipt on v1.signer).
export function compareProximity(point, monthTotals, reported, cutoffs) {
  const exactByMonth = new Map(monthTotals.map((m) => [m.month, Number(m.txs_count)]));
  const months = monthTotals.map((m) => m.month);
  const rows = [];
  for (const c of cutoffs.cutoffs) {
    const theirs = reported.points.find((p) => p.date === c.date).total_txns;
    const acc = { all_txs: 0, request_side_txs: 0, respond_txs: 0, sign_receipts: 0, all_receipts: 0 };
    for (const mo of months.filter((x) => x >= "2024-10" && x <= c.month)) {
      const rec = point.months[mo];
      const n = mo === c.month ? c.segment_txs_count : exactByMonth.get(mo); // partial month: exact count of the segment, ratios of the month
      acc.all_txs += n;
      acc.request_side_txs += n * rec.kinds.share.request;
      acc.respond_txs += n * rec.kinds.share.respond;
      acc.sign_receipts += n * rec.requests_per_tx;
      acc.all_receipts += n * rec.receipts_per_tx;
    }
    const ratios = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, theirs / v]));
    const closest = Object.entries(ratios).sort((a, b) => Math.abs(a[1] - 1) - Math.abs(b[1] - 1))[0][0];
    rows.push({ date: c.date, theirs, ours: acc, theirs_over_ours: ratios, closest_unit: closest });
  }
  return rows;
}
