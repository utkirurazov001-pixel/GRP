import { Router } from "express";
import { db } from "../db.js";
import { ok, fail, uuid, ah } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { canViewGerpi, canEditGerpiData } from "../middleware/rbac.js";
import { writeAudit } from "../middleware/audit.js";

/** DCP-02: komponent progressi (oyiga kamida 1 marta yangilanadi) */
export const componentsRouter = Router({ mergeParams: true }); // /api/gerpi/:gerpiId/components
export const componentActionsRouter = Router(); // /api/components/:id
componentsRouter.use(auth());
componentActionsRouter.use(auth());

const FIELDS = ["name", "budget_usd", "progress_pct", "planned_progress_pct", "start_date", "end_date", "responsible_person"];

const validPct = (v) => v === undefined || (Number(v) >= 0 && Number(v) <= 100);

componentsRouter.get("/", ah(async (req, res) => {
  if (!(await canViewGerpi(req.user, req.params.gerpiId))) return fail(res, 403, "Ruxsat yo'q");
  const rows = await db("components").where({ gerpi_id: req.params.gerpiId }).whereNull("deleted_at").orderBy("name");
  return ok(res, rows);
}));

componentsRouter.post("/", ah(async (req, res) => {
  const { gerpiId } = req.params;
  if (!canEditGerpiData(req.user, gerpiId)) return fail(res, 403, "Ruxsat yo'q");
  const b = req.body || {};
  if (!b.name) return fail(res, 422, "name majburiy");
  if (!validPct(b.progress_pct) || !validPct(b.planned_progress_pct)) return fail(res, 422, "progress 0-100 oralig'ida");
  const row = { id: uuid(), gerpi_id: gerpiId };
  for (const f of FIELDS) if (b[f] !== undefined) row[f] = b[f];
  await db("components").insert(row);
  await writeAudit(req, "create", "components", row.id, null, row);
  return ok(res, row, null, 201);
}));

componentActionsRouter.patch("/:id", ah(async (req, res) => {
  const old = await db("components").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!old) return fail(res, 404, "Komponent topilmadi");
  if (!canEditGerpiData(req.user, old.gerpi_id)) return fail(res, 403, "Ruxsat yo'q");
  const b = req.body || {};
  if (!validPct(b.progress_pct) || !validPct(b.planned_progress_pct)) return fail(res, 422, "progress 0-100 oralig'ida");
  const patch = {};
  for (const f of FIELDS) if (b[f] !== undefined) patch[f] = b[f];
  if (!Object.keys(patch).length) return fail(res, 400, "O'zgartirish yo'q");
  patch.updated_at = db.fn.now();
  await db("components").where({ id: old.id }).update(patch);
  await writeAudit(req, "update", "components", old.id, old, patch);
  return ok(res, await db("components").where({ id: old.id }).first());
}));
