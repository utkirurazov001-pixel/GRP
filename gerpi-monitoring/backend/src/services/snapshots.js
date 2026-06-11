import { db } from "../db.js";
import { uuid } from "../utils/respond.js";

/**
 * Chorak yakunida KPI snapshot — tarixiy trend tahlili uchun (GAP-11).
 * Mavjud chorak qayta hisoblansa yangilanadi.
 */
export async function takeKpiSnapshot(year, quarter) {
  const orgs = await db("gerpi_organizations").whereNull("deleted_at");
  const reports = await db("disbursement_reports")
    .where({ year, quarter })
    .whereIn("status", ["tasdiqlangan", "topshirilgan"]);

  const totalBudget = orgs.reduce((s, o) => s + Number(o.budget_total_usd), 0);
  const totalDisbursed = reports.reduce((s, r) => s + Number(r.disbursed_usd_cumulative), 0);
  const avgPct = reports.length
    ? reports.reduce((s, r) => s + Number(r.disbursed_pct), 0) / reports.length
    : 0;

  const row = {
    year,
    quarter,
    total_gerpi: orgs.length,
    active_gerpi: orgs.filter((o) => o.status === "faol" || o.status === "kechikayotgan").length,
    total_budget_usd: totalBudget,
    total_disbursed_usd: totalDisbursed,
    avg_disbursement_pct: Math.round(avgPct * 100) / 100,
    high_risk_count: orgs.filter((o) => o.risk_level === "yuqori").length,
    snapshot_json: JSON.stringify({
      by_status: orgs.reduce((m, o) => ((m[o.status] = (m[o.status] || 0) + 1), m), {}),
      report_count: reports.length,
    }),
    updated_at: db.fn.now(),
  };

  const existing = await db("kpi_snapshots").where({ year, quarter }).first();
  if (existing) {
    await db("kpi_snapshots").where({ id: existing.id }).update(row);
    return existing.id;
  }
  const id = uuid();
  await db("kpi_snapshots").insert({ id, ...row });
  return id;
}
