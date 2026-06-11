import { Router } from "express";
import { db } from "../db.js";
import { ok, fail, uuid, ah } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { canViewGerpi, canEditGerpiData } from "../middleware/rbac.js";
import { writeAudit } from "../middleware/audit.js";
import { runAlertEngine } from "../services/alertEngine.js";
import { takeKpiSnapshot } from "../services/snapshots.js";
import { prevQuarter } from "../utils/quarters.js";

/**
 * DCP-01: Choraklik o'zlashtirish hisoboti.
 * Workflow: qoralama → topshirilgan → tasdiqlangan YOKI qaytarilgan (izoh bilan).
 */
export const disbursementsRouter = Router({ mergeParams: true }); // /api/gerpi/:gerpiId/disbursements
export const disbursementActionsRouter = Router(); // /api/disbursements/:id/...
disbursementsRouter.use(auth());
disbursementActionsRouter.use(auth());

/** DCP-01 validatsiyasi */
async function validateReport(gerpiId, body, existingId = null) {
  const errors = [];
  const year = Number(body.year), quarter = Number(body.quarter);
  if (!year || year < 2000 || year > 2100) errors.push("year noto'g'ri");
  if (![1, 2, 3, 4].includes(quarter)) errors.push("quarter 1-4 oralig'ida bo'lishi kerak");
  const disbursed = Number(body.disbursed_usd_cumulative ?? 0);
  const disbursedPct = Number(body.disbursed_pct ?? 0);
  const plannedPct = Number(body.planned_pct ?? 0);
  if (disbursed < 0 || disbursedPct < 0 || disbursedPct > 100) errors.push("o'zlashtirish qiymatlari noto'g'ri");

  const org = await db("gerpi_organizations").where({ id: gerpiId }).whereNull("deleted_at").first();
  if (!org) return { errors: ["GERPI topilmadi"], org: null };
  // Summa byudjetdan oshmasligi
  if (disbursed > Number(org.budget_total_usd)) {
    errors.push("O'zlashtirilgan summa umumiy byudjetdan oshib ketdi");
  }
  // Kumulyativ foiz oldingi chorakdan kichik bo'lishi mumkin emas
  const prev = prevQuarter({ year, quarter });
  const prevReport = await db("disbursement_reports")
    .where({ gerpi_id: gerpiId, year: prev.year, quarter: prev.quarter })
    .whereIn("status", ["topshirilgan", "tasdiqlangan"])
    .first();
  if (prevReport && disbursedPct < Number(prevReport.disbursed_pct)) {
    errors.push(`O'zlashtirish foizi oldingi chorakdan (${prevReport.disbursed_pct}%) kichik bo'lishi mumkin emas`);
  }
  // Reja bilan farq >10% bo'lsa izoh majburiy (kamida 100 belgi)
  if (Math.abs(plannedPct - disbursedPct) > 10 && String(body.narrative || "").length < 100) {
    errors.push("Reja bilan farq 10% dan ortiq — kamida 100 belgilik izoh majburiy");
  }
  // Bir chorakka bitta hisobot
  const dupe = await db("disbursement_reports").where({ gerpi_id: gerpiId, year, quarter }).first();
  if (dupe && dupe.id !== existingId) errors.push("Bu chorak uchun hisobot allaqachon mavjud");
  return { errors, org };
}

/** GET hisobotlar ro'yxati */
disbursementsRouter.get("/", ah(async (req, res) => {
  const { gerpiId } = req.params;
  if (!(await canViewGerpi(req.user, gerpiId))) return fail(res, 403, "Ruxsat yo'q");
  const rows = await db("disbursement_reports")
    .where({ gerpi_id: gerpiId })
    .orderBy([{ column: "year", order: "asc" }, { column: "quarter", order: "asc" }]);
  return ok(res, rows);
}));

/** POST yangi hisobot (qoralama) — gerpi_staff o'z GERPI'si uchun */
disbursementsRouter.post("/", ah(async (req, res) => {
  const { gerpiId } = req.params;
  if (!canEditGerpiData(req.user, gerpiId)) return fail(res, 403, "Ruxsat yo'q");
  const { errors } = await validateReport(gerpiId, req.body || {});
  if (errors.length) return fail(res, 422, "Validatsiya xatosi", errors);
  const b = req.body;
  const row = {
    id: uuid(),
    gerpi_id: gerpiId,
    year: Number(b.year),
    quarter: Number(b.quarter),
    disbursed_usd_cumulative: Number(b.disbursed_usd_cumulative ?? 0),
    disbursed_pct: Number(b.disbursed_pct ?? 0),
    planned_pct: Number(b.planned_pct ?? 0),
    commitment_usd: Number(b.commitment_usd ?? 0),
    narrative: b.narrative || null,
    status: "qoralama",
  };
  await db("disbursement_reports").insert(row);
  await writeAudit(req, "create", "disbursement_reports", row.id, null, row);
  return ok(res, row, null, 201);
}));

/** PATCH qoralama/qaytarilgan hisobotni tahrirlash */
disbursementActionsRouter.patch("/:id", ah(async (req, res) => {
  const report = await db("disbursement_reports").where({ id: req.params.id }).first();
  if (!report) return fail(res, 404, "Hisobot topilmadi");
  if (!canEditGerpiData(req.user, report.gerpi_id)) return fail(res, 403, "Ruxsat yo'q");
  if (!["qoralama", "qaytarilgan"].includes(report.status)) {
    return fail(res, 422, "Faqat qoralama yoki qaytarilgan hisobot tahrirlanadi");
  }
  const merged = { ...report, ...req.body, year: report.year, quarter: report.quarter };
  const { errors } = await validateReport(report.gerpi_id, merged, report.id);
  if (errors.length) return fail(res, 422, "Validatsiya xatosi", errors);
  const patch = {};
  for (const f of ["disbursed_usd_cumulative", "disbursed_pct", "planned_pct", "commitment_usd", "narrative"]) {
    if (req.body[f] !== undefined) patch[f] = req.body[f];
  }
  patch.updated_at = db.fn.now();
  await db("disbursement_reports").where({ id: report.id }).update(patch);
  await writeAudit(req, "update", "disbursement_reports", report.id, report, patch);
  return ok(res, await db("disbursement_reports").where({ id: report.id }).first());
}));

/** PATCH /:id/submit — topshirish */
disbursementActionsRouter.patch("/:id/submit", ah(async (req, res) => {
  const report = await db("disbursement_reports").where({ id: req.params.id }).first();
  if (!report) return fail(res, 404, "Hisobot topilmadi");
  if (!canEditGerpiData(req.user, report.gerpi_id)) return fail(res, 403, "Ruxsat yo'q");
  if (!["qoralama", "qaytarilgan"].includes(report.status)) return fail(res, 422, "Hisobot allaqachon topshirilgan");
  const { errors } = await validateReport(report.gerpi_id, report, report.id);
  if (errors.length) return fail(res, 422, "Validatsiya xatosi", errors);
  await db("disbursement_reports").where({ id: report.id }).update({
    status: "topshirilgan", submitted_by: req.user.id, submitted_at: db.fn.now(), updated_at: db.fn.now(),
  });
  await writeAudit(req, "update", "disbursement_reports", report.id, { status: report.status }, { status: "topshirilgan" });
  return ok(res, await db("disbursement_reports").where({ id: report.id }).first());
}));

/** PATCH /:id/approve — tasdiqlash (mof/ministry/admin). Dashboard YANGILANADI. */
disbursementActionsRouter.patch("/:id/approve", ah(async (req, res) => {
  if (!["admin", "mof_supervisor", "ministry_officer"].includes(req.user.role)) return fail(res, 403, "Ruxsat yo'q");
  const report = await db("disbursement_reports").where({ id: req.params.id }).first();
  if (!report) return fail(res, 404, "Hisobot topilmadi");
  if (!(await canViewGerpi(req.user, report.gerpi_id))) return fail(res, 403, "Ruxsat yo'q");
  if (report.status !== "topshirilgan") return fail(res, 422, "Faqat topshirilgan hisobot tasdiqlanadi");
  await db("disbursement_reports").where({ id: report.id }).update({
    status: "tasdiqlangan", reviewed_by: req.user.id, reviewed_at: db.fn.now(),
    review_comment: req.body?.comment || null, updated_at: db.fn.now(),
  });
  await writeAudit(req, "approve", "disbursement_reports", report.id, { status: "topshirilgan" }, { status: "tasdiqlangan" });
  // Tasdiqlangach: alert dvigateli darhol + KPI snapshot yangilanadi
  await runAlertEngine({ gerpiId: report.gerpi_id, io: req.app.get("io") });
  await takeKpiSnapshot(report.year, report.quarter);
  return ok(res, await db("disbursement_reports").where({ id: report.id }).first());
}));

/** PATCH /:id/reject — qaytarish (izoh MAJBURIY) */
disbursementActionsRouter.patch("/:id/reject", ah(async (req, res) => {
  if (!["admin", "mof_supervisor", "ministry_officer"].includes(req.user.role)) return fail(res, 403, "Ruxsat yo'q");
  const report = await db("disbursement_reports").where({ id: req.params.id }).first();
  if (!report) return fail(res, 404, "Hisobot topilmadi");
  if (!(await canViewGerpi(req.user, report.gerpi_id))) return fail(res, 403, "Ruxsat yo'q");
  if (report.status !== "topshirilgan") return fail(res, 422, "Faqat topshirilgan hisobot qaytariladi");
  const comment = String(req.body?.comment || "").trim();
  if (!comment) return fail(res, 422, "Qaytarish izohi majburiy");
  await db("disbursement_reports").where({ id: report.id }).update({
    status: "qaytarilgan", reviewed_by: req.user.id, reviewed_at: db.fn.now(),
    review_comment: comment, updated_at: db.fn.now(),
  });
  await writeAudit(req, "reject", "disbursement_reports", report.id, { status: "topshirilgan" }, { status: "qaytarilgan", comment });
  return ok(res, await db("disbursement_reports").where({ id: report.id }).first());
}));
