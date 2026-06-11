import { Router } from "express";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { ok, fail, uuid, ah, pagination } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { requireRole, scopeGerpiQuery, canViewGerpi } from "../middleware/rbac.js";
import { writeAudit } from "../middleware/audit.js";

export const alertsRouter = Router();
alertsRouter.use(auth());

/** GET /api/alerts — filtr: severity, type, gerpi_id, is_resolved */
alertsRouter.get("/", ah(async (req, res) => {
  const { page, limit, offset } = pagination(req, 50);
  const q = db("alerts")
    .join("gerpi_organizations", "alerts.gerpi_id", "gerpi_organizations.id")
    .whereNull("alerts.deleted_at")
    .select("alerts.*", "gerpi_organizations.name_uz_latn as gerpi_name");
  scopeGerpiQuery(q, req.user);
  if (req.query.severity) q.where("alerts.severity", req.query.severity);
  if (req.query.type) q.where("alerts.type", req.query.type);
  if (req.query.gerpi_id) q.where("alerts.gerpi_id", req.query.gerpi_id);
  if (req.query.is_resolved !== undefined && req.query.is_resolved !== "") {
    q.where("alerts.is_resolved", req.query.is_resolved === "true");
  }
  const countRow = await q.clone().clearSelect().clearOrder().count({ c: "*" }).first();
  const rows = await q.orderBy("alerts.created_at", "desc").limit(limit).offset(offset);
  return ok(res, rows, { page, limit, total: Number(countRow.c) });
}));

/** POST /api/alerts — qo'lda alert qo'shish (mof/admin) */
alertsRouter.post("/", requireRole("admin", "mof_supervisor"), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.gerpi_id || !b.title) return fail(res, 422, "gerpi_id va title majburiy");
  if (!["yuqori", "orta", "past"].includes(b.severity)) return fail(res, 422, "severity noto'g'ri");
  if (b.type && !CONFIG.ALERT_TYPES.includes(b.type)) return fail(res, 422, "type noto'g'ri");
  const row = {
    id: uuid(),
    gerpi_id: b.gerpi_id,
    severity: b.severity,
    type: b.type || "eslatma",
    title: b.title,
    description: b.description || null,
    rule_code: null,
    is_resolved: false,
  };
  await db("alerts").insert(row);
  await writeAudit(req, "create", "alerts", row.id, null, row);
  req.app.get("io")?.emit("alert:new", row);
  return ok(res, row, null, 201);
}));

/** PATCH /api/alerts/:id/resolve — hal qilindi (izoh bilan) */
alertsRouter.patch("/:id/resolve", ah(async (req, res) => {
  if (!["admin", "mof_supervisor", "ministry_officer"].includes(req.user.role)) return fail(res, 403, "Ruxsat yo'q");
  const alert = await db("alerts").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!alert) return fail(res, 404, "Ogohlantirish topilmadi");
  if (!(await canViewGerpi(req.user, alert.gerpi_id))) return fail(res, 403, "Ruxsat yo'q");
  if (alert.is_resolved) return fail(res, 422, "Allaqachon hal qilingan");
  const note = String(req.body?.note || "").trim();
  if (!note) return fail(res, 422, "Hal qilish izohi majburiy");
  await db("alerts").where({ id: alert.id }).update({
    is_resolved: true, resolved_by: req.user.id, resolved_at: db.fn.now(),
    resolution_note: note, updated_at: db.fn.now(),
  });
  await writeAudit(req, "update", "alerts", alert.id, { is_resolved: false }, { is_resolved: true, note });
  return ok(res, await db("alerts").where({ id: alert.id }).first());
}));
