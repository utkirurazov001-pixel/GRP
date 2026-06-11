import { Router } from "express";
import { db } from "../db.js";
import { ok, ah } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { scopeGerpiQuery } from "../middleware/rbac.js";

export const analyticsRouter = Router();
analyticsRouter.use(auth());

/** Ko'rish doirasidagi orglar + oxirgi hisobot foizlari */
async function scopedOrgsWithLatest(user) {
  const orgs = await scopeGerpiQuery(
    db("gerpi_organizations")
      .leftJoin("ministries", "gerpi_organizations.ministry_id", "ministries.id")
      .leftJoin("donors", "gerpi_organizations.donor_id", "donors.id")
      .whereNull("gerpi_organizations.deleted_at")
      .select("gerpi_organizations.*",
        "ministries.name_uz_latn as ministry_name",
        "donors.short_name as donor_short"),
    user
  );
  const reports = await db("disbursement_reports")
    .whereIn("gerpi_id", orgs.map((o) => o.id))
    .whereIn("status", ["topshirilgan", "tasdiqlangan"])
    .orderBy([{ column: "year", order: "asc" }, { column: "quarter", order: "asc" }]);
  const latest = {};
  for (const r of reports) latest[r.gerpi_id] = r;
  for (const o of orgs) {
    const lr = latest[o.id];
    o.disbursed_pct = lr ? Number(lr.disbursed_pct) : 0;
    o.planned_pct = lr ? Number(lr.planned_pct) : 0;
    o.disbursed_usd = lr ? Number(lr.disbursed_usd_cumulative) : 0;
  }
  return orgs;
}

/** GET /api/analytics/dashboard — KPI + grafik agregatsiyalari */
analyticsRouter.get("/dashboard", ah(async (req, res) => {
  const orgs = await scopedOrgsWithLatest(req.user);
  const ids = orgs.map((o) => o.id);

  const [componentsCount, openAlerts] = await Promise.all([
    ids.length ? db("components").whereIn("gerpi_id", ids).whereNull("deleted_at").count({ c: "*" }).first() : { c: 0 },
    ids.length ? db("alerts").whereIn("gerpi_id", ids).where({ is_resolved: false }).whereNull("deleted_at")
      .select("severity").count({ c: "*" }).groupBy("severity") : [],
  ]);

  const totalBudget = orgs.reduce((s, o) => s + Number(o.budget_total_usd), 0);
  const totalDisbursed = orgs.reduce((s, o) => s + o.disbursed_usd, 0);
  const withReports = orgs.filter((o) => o.disbursed_pct > 0);
  const avgDisb = withReports.length
    ? withReports.reduce((s, o) => s + o.disbursed_pct, 0) / withReports.length : 0;

  const agg = (key) => {
    const m = {};
    for (const o of orgs) {
      const k = o[key] || "—";
      m[k] = m[k] || { count: 0, budget: 0, disbursed: 0 };
      m[k].count++;
      m[k].budget += Number(o.budget_total_usd);
      m[k].disbursed += o.disbursed_usd;
    }
    return Object.entries(m).map(([name, v]) => ({ name, ...v }));
  };

  // Reyting: reja-fakt farqi bo'yicha eng yaxshi / eng yomon 5
  const rated = orgs
    .filter((o) => o.status !== "tayyorgarlik" && o.disbursed_pct > 0)
    .map((o) => ({
      id: o.id, name: o.name_uz_latn, donor: o.donor_short,
      disbursed_pct: o.disbursed_pct, gap: o.planned_pct - o.disbursed_pct,
      risk_level: o.risk_level,
    }))
    .sort((a, b) => a.gap - b.gap);

  return ok(res, {
    kpi: {
      total_gerpi: orgs.length,
      active_components: Number(componentsCount.c),
      total_budget_usd: totalBudget,
      total_disbursed_usd: totalDisbursed,
      avg_disbursement_pct: Math.round(avgDisb * 10) / 10,
      open_alerts: openAlerts.reduce((s, r) => s + Number(r.c), 0),
      alerts_by_severity: Object.fromEntries(openAlerts.map((r) => [r.severity, Number(r.c)])),
    },
    by_donor: agg("donor_short"),
    by_ministry: agg("ministry_name"),
    by_status: agg("status"),
    by_risk: agg("risk_level"),
    top5: rated.slice(0, 5),
    bottom5: rated.slice(-5).reverse(),
  });
}));

/** GET /api/analytics/regions — xarita uchun hudud kesimi */
analyticsRouter.get("/regions", ah(async (req, res) => {
  const orgs = await scopedOrgsWithLatest(req.user);
  const links = await db("gerpi_regions")
    .join("regions", "gerpi_regions.region_id", "regions.id")
    .select("gerpi_regions.gerpi_id", "regions.id as region_id", "regions.geojson_id",
      "regions.name_uz_latn", "regions.name_uz_cyrl", "regions.name_ru", "regions.name_en");
  const byOrg = Object.fromEntries(orgs.map((o) => [o.id, o]));
  const map = {};
  for (const l of links) {
    const o = byOrg[l.gerpi_id];
    if (!o) continue;
    map[l.region_id] = map[l.region_id] || {
      region_id: l.region_id, geojson_id: l.geojson_id,
      name_uz_latn: l.name_uz_latn, name_uz_cyrl: l.name_uz_cyrl, name_ru: l.name_ru, name_en: l.name_en,
      gerpi_count: 0, budget_usd: 0, disbursed_usd: 0, high_risk: 0,
      gerpi: [],
    };
    const m = map[l.region_id];
    m.gerpi_count++;
    m.budget_usd += Number(o.budget_total_usd);
    m.disbursed_usd += o.disbursed_usd;
    if (o.risk_level === "yuqori") m.high_risk++;
    m.gerpi.push({ id: o.id, name: o.name_uz_latn, donor: o.donor_short, status: o.status, disbursed_pct: o.disbursed_pct, risk_level: o.risk_level });
  }
  return ok(res, Object.values(map));
}));

/** GET /api/analytics/trends — kpi_snapshots'dan tarixiy chiziq */
analyticsRouter.get("/trends", ah(async (req, res) => {
  const rows = await db("kpi_snapshots")
    .whereNull("deleted_at")
    .orderBy([{ column: "year", order: "asc" }, { column: "quarter", order: "asc" }]);
  return ok(res, rows.map((r) => ({
    label: `${r.year}-Q${r.quarter}`,
    year: r.year, quarter: r.quarter,
    total_gerpi: r.total_gerpi, active_gerpi: r.active_gerpi,
    total_budget_usd: Number(r.total_budget_usd),
    total_disbursed_usd: Number(r.total_disbursed_usd),
    avg_disbursement_pct: Number(r.avg_disbursement_pct),
    high_risk_count: r.high_risk_count,
  })));
}));

/** GET /api/analytics/risk-matrix — X: yopilishgacha oy, Y: reja-fakt farqi, o'lcham: byudjet */
analyticsRouter.get("/risk-matrix", ah(async (req, res) => {
  const orgs = await scopedOrgsWithLatest(req.user);
  const now = new Date();
  const points = orgs
    .filter((o) => o.status === "faol" || o.status === "kechikayotgan")
    .map((o) => ({
      id: o.id,
      name: o.name_uz_latn,
      months_to_close: o.closing_date ? Math.max(0, Math.round((new Date(o.closing_date) - now) / (30.44 * 86400_000))) : null,
      gap: Math.round((o.planned_pct - o.disbursed_pct) * 10) / 10,
      budget_usd: Number(o.budget_total_usd),
      risk_level: o.risk_level,
      disbursed_pct: o.disbursed_pct,
    }))
    .filter((p) => p.months_to_close !== null);
  return ok(res, points);
}));
