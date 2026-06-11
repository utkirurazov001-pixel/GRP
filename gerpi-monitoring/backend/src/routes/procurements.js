import { Router } from "express";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { ok, fail, uuid, ah } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { canViewGerpi, canEditGerpiData } from "../middleware/rbac.js";
import { writeAudit } from "../middleware/audit.js";
import { runAlertEngine } from "../services/alertEngine.js";

/** DCP-03: xarid/tenderlar. cancel_count >= 2 → avtomatik 'xarid_muammo' alert. */
export const procurementsRouter = Router({ mergeParams: true }); // /api/gerpi/:gerpiId/procurements
export const procurementActionsRouter = Router(); // /api/procurements/:id
procurementsRouter.use(auth());
procurementActionsRouter.use(auth());

const FIELDS = ["title", "method", "estimated_usd", "contract_usd", "status", "cancel_count", "announced_date", "contract_date", "supplier"];

function validate(b) {
  if (b.method && !CONFIG.PROCUREMENT_METHODS.includes(b.method)) return "method noto'g'ri";
  if (b.status && !CONFIG.PROCUREMENT_STATUSES.includes(b.status)) return "status noto'g'ri";
  return null;
}

procurementsRouter.get("/", ah(async (req, res) => {
  if (!(await canViewGerpi(req.user, req.params.gerpiId))) return fail(res, 403, "Ruxsat yo'q");
  const rows = await db("procurement_records").where({ gerpi_id: req.params.gerpiId }).whereNull("deleted_at").orderBy("created_at", "desc");
  return ok(res, rows);
}));

procurementsRouter.post("/", ah(async (req, res) => {
  const { gerpiId } = req.params;
  if (!canEditGerpiData(req.user, gerpiId)) return fail(res, 403, "Ruxsat yo'q");
  const b = req.body || {};
  if (!b.title) return fail(res, 422, "title majburiy");
  const err = validate(b);
  if (err) return fail(res, 422, err);
  const row = { id: uuid(), gerpi_id: gerpiId };
  for (const f of FIELDS) if (b[f] !== undefined) row[f] = b[f];
  await db("procurement_records").insert(row);
  await writeAudit(req, "create", "procurement_records", row.id, null, row);
  if (Number(row.cancel_count) >= 2) await runAlertEngine({ gerpiId, io: req.app.get("io") });
  return ok(res, row, null, 201);
}));

procurementActionsRouter.patch("/:id", ah(async (req, res) => {
  const old = await db("procurement_records").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!old) return fail(res, 404, "Xarid yozuvi topilmadi");
  if (!canEditGerpiData(req.user, old.gerpi_id)) return fail(res, 403, "Ruxsat yo'q");
  const b = req.body || {};
  const err = validate(b);
  if (err) return fail(res, 422, err);
  const patch = {};
  for (const f of FIELDS) if (b[f] !== undefined) patch[f] = b[f];
  // Bekor qilinsa hisoblagich avtomatik oshadi
  if (b.status === "bekor_qilingan" && old.status !== "bekor_qilingan" && b.cancel_count === undefined) {
    patch.cancel_count = Number(old.cancel_count) + 1;
  }
  if (!Object.keys(patch).length) return fail(res, 400, "O'zgartirish yo'q");
  patch.updated_at = db.fn.now();
  await db("procurement_records").where({ id: old.id }).update(patch);
  await writeAudit(req, "update", "procurement_records", old.id, old, patch);
  const updated = await db("procurement_records").where({ id: old.id }).first();
  if (Number(updated.cancel_count) >= 2) await runAlertEngine({ gerpiId: old.gerpi_id, io: req.app.get("io") });
  return ok(res, updated);
}));
