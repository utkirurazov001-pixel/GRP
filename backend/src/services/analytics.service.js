const db = require('../db');
const { scopeGerpiQuery } = require('../middleware/rbac');

// All dashboard numbers are live aggregations over the user's visible scope.
function scopedOrgs(user) {
  return scopeGerpiQuery(db('gerpi_organizations as g').whereNull('g.deleted_at'), user);
}

async function dashboard(user) {
  const orgs = await scopedOrgs(user)
    .leftJoin('ministries as m', 'm.id', 'g.ministry_id')
    .leftJoin('donors as d', 'd.id', 'g.donor_id')
    .select('g.id', 'g.budget_total_usd', 'g.status', 'g.risk_level',
      'm.name_uz_latn as ministry_name', 'm.code as ministry_code', 'd.short_name as donor_short');

  const orgIds = orgs.map((o) => o.id);

  const [componentCountRow] = orgIds.length
    ? await db('components').whereIn('gerpi_id', orgIds).whereNull('deleted_at').count('id as count')
    : [{ count: 0 }];

  // Latest non-draft report per org → weighted disbursement
  const latest = orgIds.length
    ? await db('disbursement_reports as r')
      .distinctOn('r.gerpi_id')
      .whereIn('r.gerpi_id', orgIds)
      .whereNot('r.status', 'qoralama')
      .whereNull('r.deleted_at')
      .orderBy([{ column: 'r.gerpi_id' }, { column: 'r.year', order: 'desc' }, { column: 'r.quarter', order: 'desc' }])
      .select('r.gerpi_id', 'r.disbursed_pct', 'r.planned_pct', 'r.disbursed_usd_cumulative')
    : [];
  const latestByOrg = Object.fromEntries(latest.map((r) => [r.gerpi_id, r]));

  const totalBudget = orgs.reduce((s, o) => s + Number(o.budget_total_usd), 0);
  const totalDisbursed = latest.reduce((s, r) => s + Number(r.disbursed_usd_cumulative), 0);
  const avgDisbursementPct = totalBudget > 0 ? +(totalDisbursed / totalBudget * 100).toFixed(1) : 0;

  // Quarterly trend: average reported pct across the visible portfolio
  const trendRows = orgIds.length
    ? await db('disbursement_reports as r')
      .whereIn('r.gerpi_id', orgIds)
      .whereNot('r.status', 'qoralama')
      .whereNull('r.deleted_at')
      .groupBy('r.year', 'r.quarter')
      .orderBy([{ column: 'r.year' }, { column: 'r.quarter' }])
      .select('r.year', 'r.quarter',
        db.raw('round(avg(r.disbursed_pct), 1) as actual'),
        db.raw('round(avg(r.planned_pct), 1) as planned'))
    : [];

  const groupSum = (key) => {
    const map = new Map();
    for (const o of orgs) {
      const k = o[key] || '—';
      const cur = map.get(k) || { label: k, budget: 0, count: 0 };
      cur.budget += Number(o.budget_total_usd);
      cur.count += 1;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.budget - a.budget);
  };

  const statusCounts = {};
  const riskCounts = {};
  for (const o of orgs) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    riskCounts[o.risk_level] = (riskCounts[o.risk_level] || 0) + 1;
  }

  const alertCounts = orgIds.length
    ? await db('alerts').whereIn('gerpi_id', orgIds).where({ is_resolved: false }).whereNull('deleted_at')
      .groupBy('severity').select('severity', db.raw('count(*) as count'))
    : [];

  // Best / worst performers by plan-vs-actual gap
  const ranked = orgs
    .map((o) => {
      const r = latestByOrg[o.id];
      return r ? {
        id: o.id,
        disbursed_pct: Number(r.disbursed_pct),
        gap: +(Number(r.planned_pct) - Number(r.disbursed_pct)).toFixed(1),
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.gap - b.gap);
  const orgNames = orgIds.length
    ? Object.fromEntries((await db('gerpi_organizations').whereIn('id', orgIds)
      .select('id', 'name_uz_latn')).map((o) => [o.id, o.name_uz_latn]))
    : {};
  const decorate = (r) => ({ ...r, name: orgNames[r.id] });

  return {
    kpis: {
      total_gerpi: orgs.length,
      active_gerpi: orgs.filter((o) => o.status === 'faol').length,
      total_components: parseInt(componentCountRow.count, 10),
      total_budget_usd: totalBudget,
      total_disbursed_usd: totalDisbursed,
      avg_disbursement_pct: avgDisbursementPct,
      high_risk_count: riskCounts.yuqori || 0,
      open_alerts: alertCounts.reduce((s, a) => s + parseInt(a.count, 10), 0),
    },
    trend: trendRows.map((r) => ({
      label: `${r.year}-Q${r.quarter}`, actual: Number(r.actual), planned: Number(r.planned),
    })),
    by_donor: groupSum('donor_short'),
    by_ministry: groupSum('ministry_name'),
    by_status: statusCounts,
    by_risk: riskCounts,
    alerts_by_severity: Object.fromEntries(alertCounts.map((a) => [a.severity, parseInt(a.count, 10)])),
    top5: ranked.slice(0, 5).map(decorate),
    bottom5: ranked.slice(-5).reverse().map(decorate),
  };
}

module.exports = { dashboard };
