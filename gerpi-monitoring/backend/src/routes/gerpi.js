import { Router } from "express";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { ok, fail, uuid, ah, pagination } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { requireRole, scopeGerpiQuery, canViewGerpi } from "../middleware/rbac.js";
import { writeAudit } from "../middleware/audit.js";
import { runAlertEngine } from "../services/alertEngine.js";

export const gerpiRouter = Router();
gerpiRouter.use(auth());

const ORG_FIELDS = [
  "name_uz_latn", "name_uz_cyrl", "name_ru", "name_en", "ministry_id", "donor_id",
  "agreement_number", "agreement_date", "budget_total_usd", "start_year", "end_year",
  "closing_date", "status", "director_name", "director_phone", "address", "website",
];

function baseQuery(user) {
  const q = db("gerpi_organizations")
    .leftJoin("ministries", "gerpi_organizations.ministry_id", "ministries.id")
    .leftJoin("donors", "gerpi_organizations.donor_id", "donors.id")
    .whereNull("gerpi_organizations.deleted_at")
    .select(
      "gerpi_organizations.*",
      "ministries.name_uz_latn as ministry_name",
      "ministries.code as ministry_code",
      "donors.short_name as donor_short",
      "donors.name as donor_name"
    );
  return scopeGerpiQuery(q, user);
}

/** GET /api/gerpi — filtr (vazirlik, donor, holat, risk, qidiruv) + pagination */
gerpiRouter.get("/", ah(async (req, res) => {
  const { page, limit, offset } = pagination(req, 50);
  const q = baseQuery(req.user);
  if (req.query.ministry_id) q.where("gerpi_organizations.ministry_id", req.query.ministry_id);
  if (req.query.donor_id) q.where("gerpi_organizations.donor_id", req.query.donor_id);
  if (req.query.status) q.where("gerpi_organizations.status", req.query.status);
  if (req.query.risk_level) q.where("gerpi_organizations.risk_level", req.query.risk_level);
  if (req.query.search) {
    const s = `%${req.query.search}%`;
    q.where((b) => b.whereILike("gerpi_organizations.name_uz_latn", s)
      .orWhereILike("gerpi_organizations.name_ru", s)
      .orWhereILike("gerpi_organizations.name_en", s)
      .orWhereILike("gerpi_organizations.agreement_number", s));
  }
  const sortable = { name: "gerpi_organizations.name_uz_latn", budget: "budget_total_usd", risk: "risk_score", status: "gerpi_organizations.status" };
  const sort = sortable[req.query.sort] || "gerpi_organizations.name_uz_latn";
  const dir = req.query.dir === "desc" ? "desc" : "asc";

  const countRow = await q.clone().clearSelect().clearOrder().count({ c: "*" }).first();
  const rows = await q.orderBy(sort, dir).limit(limit).offset(offset);

  // Oxirgi tasdiqlangan o'zlashtirish foizi har bir org uchun
  const latest = await db("disbursement_reports")
    .whereIn("gerpi_id", rows.map((r) => r.id))
    .whereIn("status", ["topshirilgan", "tasdiqlangan"])
    .orderBy([{ column: "year", order: "asc" }, { column: "quarter", order: "asc" }]);
  const latestByOrg = {};
  for (const r of latest) latestByOrg[r.gerpi_id] = r; // oxirgisi qoladi
  for (const row of rows) {
    const lr = latestByOrg[row.id];
    row.disbursed_pct = lr ? Number(lr.disbursed_pct) : 0;
    row.planned_pct = lr ? Number(lr.planned_pct) : 0;
    row.disbursed_usd = lr ? Number(lr.disbursed_usd_cumulative) : 0;
  }
  return ok(res, rows, { page, limit, total: Number(countRow.c) });
}));

/** GET /api/gerpi/:id — to'liq profil */
gerpiRouter.get("/:id", ah(async (req, res) => {
  if (!(await canViewGerpi(req.user, req.params.id))) return fail(res, 403, "Ruxsat yo'q");
  const org = await baseQuery(req.user).where("gerpi_organizations.id", req.params.id).first();
  if (!org) return fail(res, 404, "GERPI topilmadi");

  const [regions, components, openAlerts, lastReport] = await Promise.all([
    db("gerpi_regions")
      .join("regions", "gerpi_regions.region_id", "regions.id")
      .where("gerpi_regions.gerpi_id", org.id)
      .select("regions.*"),
    db("components").where({ gerpi_id: org.id }).whereNull("deleted_at").orderBy("name"),
    db("alerts").where({ gerpi_id: org.id, is_resolved: false }).whereNull("deleted_at").count({ c: "*" }).first(),
    db("disbursement_reports").where({ gerpi_id: org.id })
      .whereIn("status", ["topshirilgan", "tasdiqlangan"])
      .orderBy([{ column: "year", order: "desc" }, { column: "quarter", order: "desc" }]).first(),
  ]);

  return ok(res, {
    ...org,
    regions,
    components,
    open_alerts: Number(openAlerts.c),
    disbursed_pct: lastReport ? Number(lastReport.disbursed_pct) : 0,
    planned_pct: lastReport ? Number(lastReport.planned_pct) : 0,
    disbursed_usd: lastReport ? Number(lastReport.disbursed_usd_cumulative) : 0,
  });
}));

/** GET /api/gerpi/:id/history — audit izi (registr o'zgarishlari) */
gerpiRouter.get("/:id/history", ah(async (req, res) => {
  if (!(await canViewGerpi(req.user, req.params.id))) return fail(res, 403, "Ruxsat yo'q");
  const rows = await db("audit_log")
    .leftJoin("users", "audit_log.user_id", "users.id")
    .where({ entity_type: "gerpi_organizations", entity_id: req.params.id })
    .orderBy("audit_log.created_at", "desc")
    .limit(100)
    .select("audit_log.*", "users.full_name as user_name");
  return ok(res, rows);
}));

/** POST /api/gerpi — yangi GERPI (admin/mof) */
gerpiRouter.post("/", requireRole("admin", "mof_supervisor"), ah(async (req, res) => {
  const body = req.body || {};
  if (!body.name_uz_latn) return fail(res, 422, "name_uz_latn majburiy");
  if (body.status && !CONFIG.GERPI_STATUSES.includes(body.status)) return fail(res, 422, "status noto'g'ri");
  const row = { id: uuid() };
  for (const f of ORG_FIELDS) if (body[f] !== undefined) row[f] = body[f];
  await db("gerpi_organizations").insert(row);
  if (Array.isArray(body.region_ids)) {
    for (const rid of body.region_ids) {
      await db("gerpi_regions").insert({ id: uuid(), gerpi_id: row.id, region_id: rid });
    }
  }
  await writeAudit(req, "create", "gerpi_organizations", row.id, null, row);
  await runAlertEngine({ gerpiId: row.id, io: req.app.get("io") });
  const org = await db("gerpi_organizations").where({ id: row.id }).first();
  return ok(res, org, null, 201);
}));

/** PATCH /api/gerpi/:id — registr tahriri (admin/mof) */
gerpiRouter.patch("/:id", requireRole("admin", "mof_supervisor"), ah(async (req, res) => {
  const old = await db("gerpi_organizations").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!old) return fail(res, 404, "GERPI topilmadi");
  const body = req.body || {};
  if (body.status && !CONFIG.GERPI_STATUSES.includes(body.status)) return fail(res, 422, "status noto'g'ri");
  const patch = {};
  for (const f of ORG_FIELDS) if (body[f] !== undefined) patch[f] = body[f];
  if (!Object.keys(patch).length && !Array.isArray(body.region_ids)) return fail(res, 400, "O'zgartirish yo'q");
  if (Object.keys(patch).length) {
    patch.updated_at = db.fn.now();
    await db("gerpi_organizations").where({ id: old.id }).update(patch);
  }
  if (Array.isArray(body.region_ids)) {
    await db("gerpi_regions").where({ gerpi_id: old.id }).del();
    for (const rid of body.region_ids) {
      await db("gerpi_regions").insert({ id: uuid(), gerpi_id: old.id, region_id: rid });
    }
  }
  await writeAudit(req, "update", "gerpi_organizations", old.id, old, patch);
  await runAlertEngine({ gerpiId: old.id, io: req.app.get("io") });
  const org = await db("gerpi_organizations").where({ id: old.id }).first();
  return ok(res, org);
}));
