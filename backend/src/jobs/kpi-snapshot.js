// Quarterly KPI snapshots for historical trend analysis. The scheduler
// checks daily whether the just-finished quarter is missing a snapshot.
const db = require('../db');

function lastFinishedQuarter(now = new Date()) {
  let year = now.getUTCFullYear();
  let quarter = Math.floor(now.getUTCMonth() / 3);
  if (quarter === 0) { year -= 1; quarter = 4; }
  return { year, quarter };
}

async function buildSnapshot(year, quarter) {
  const orgs = await db('gerpi_organizations').whereNull('deleted_at')
    .select('id', 'budget_total_usd', 'status', 'risk_level');

  const reports = await db('disbursement_reports as r')
    .distinctOn('r.gerpi_id')
    .whereIn('r.gerpi_id', orgs.map((o) => o.id))
    .whereNot('r.status', 'qoralama')
    .whereNull('r.deleted_at')
    .where((b) => b.where('r.year', '<', year)
      .orWhere((b2) => b2.where('r.year', year).andWhere('r.quarter', '<=', quarter)))
    .orderBy([{ column: 'r.gerpi_id' }, { column: 'r.year', order: 'desc' }, { column: 'r.quarter', order: 'desc' }])
    .select('r.gerpi_id', 'r.disbursed_pct', 'r.disbursed_usd_cumulative');

  const totalBudget = orgs.reduce((s, o) => s + Number(o.budget_total_usd), 0);
  const totalDisbursed = reports.reduce((s, r) => s + Number(r.disbursed_usd_cumulative), 0);

  return {
    year,
    quarter,
    total_gerpi: orgs.length,
    active_gerpi: orgs.filter((o) => o.status === 'faol').length,
    total_budget_usd: totalBudget,
    total_disbursed_usd: totalDisbursed,
    avg_disbursement_pct: totalBudget > 0 ? +(totalDisbursed / totalBudget * 100).toFixed(2) : 0,
    high_risk_count: orgs.filter((o) => o.risk_level === 'yuqori').length,
    snapshot_json: JSON.stringify({
      by_status: orgs.reduce((m, o) => ({ ...m, [o.status]: (m[o.status] || 0) + 1 }), {}),
      by_risk: orgs.reduce((m, o) => ({ ...m, [o.risk_level]: (m[o.risk_level] || 0) + 1 }), {}),
    }),
  };
}

async function ensureSnapshot(now = new Date()) {
  const { year, quarter } = lastFinishedQuarter(now);
  const existing = await db('kpi_snapshots').where({ year, quarter }).first();
  if (existing) return existing;
  const snap = await buildSnapshot(year, quarter);
  const [row] = await db('kpi_snapshots').insert(snap).returning('*');
  console.log(`[kpi-snapshot] created snapshot ${year}-Q${quarter}`);
  return row;
}

module.exports = { ensureSnapshot, buildSnapshot, lastFinishedQuarter };
