import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { ok, fail, uuid, ah } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { canViewGerpi, canEditGerpiData } from "../middleware/rbac.js";
import { writeAudit } from "../middleware/audit.js";
import { runAlertEngine } from "../services/alertEngine.js";

/** DCP-04: hujjatlar arxivi. Faqat pdf/docx/xlsx/jpg/png, maks 20MB. */
export const documentsRouter = Router({ mergeParams: true }); // /api/gerpi/:gerpiId/documents
export const documentActionsRouter = Router(); // /api/documents/:id
documentsRouter.use(auth());
documentActionsRouter.use(auth());

fs.mkdirSync(CONFIG.UPLOADS.DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: CONFIG.UPLOADS.DIR,
  filename: (req, file, cb) => {
    // Nom sanitizatsiyasi: faqat xavfsiz belgilar + uuid prefiks
    const safe = path.basename(file.originalname).replace(/[^\w.\-]+/g, "_").slice(0, 80);
    cb(null, `${uuid()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: CONFIG.UPLOADS.MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!CONFIG.UPLOADS.ALLOWED_MIME.includes(file.mimetype)) {
      return cb(Object.assign(new Error("Faqat pdf/docx/xlsx/jpg/png fayllar qabul qilinadi"), { status: 422, expose: true }));
    }
    cb(null, true);
  },
});

documentsRouter.get("/", ah(async (req, res) => {
  if (!(await canViewGerpi(req.user, req.params.gerpiId))) return fail(res, 403, "Ruxsat yo'q");
  const rows = await db("documents")
    .leftJoin("users", "documents.uploaded_by", "users.id")
    .where({ gerpi_id: req.params.gerpiId })
    .whereNull("documents.deleted_at")
    .orderBy("documents.created_at", "desc")
    .select("documents.*", "users.full_name as uploaded_by_name");
  return ok(res, rows);
}));

/** POST multipart hujjat yuklash */
documentsRouter.post("/", upload.single("file"), ah(async (req, res) => {
  const { gerpiId } = req.params;
  if (!canEditGerpiData(req.user, gerpiId)) return fail(res, 403, "Ruxsat yo'q");
  const b = req.body || {};
  if (!b.title) return fail(res, 422, "title majburiy");
  if (b.type && !CONFIG.DOCUMENT_TYPES.includes(b.type)) return fail(res, 422, "type noto'g'ri");
  const row = {
    id: uuid(),
    gerpi_id: gerpiId,
    type: b.type || "boshqa",
    title: b.title,
    file_path: req.file ? req.file.filename : null,
    file_size: req.file ? req.file.size : null,
    mime_type: req.file ? req.file.mimetype : null,
    period_year: b.period_year ? Number(b.period_year) : null,
    period_quarter: b.period_quarter ? Number(b.period_quarter) : null,
    uploaded_by: req.user.id,
    due_date: b.due_date || null,
    has_findings: String(b.has_findings) === "true",
  };
  await db("documents").insert(row);
  await writeAudit(req, "create", "documents", row.id, null, { ...row, file_path: undefined });
  // Audit nomuvofiqligi belgilangan bo'lsa qoidalar qayta ishlaydi (R5)
  if (row.has_findings || row.type === "yillik_reja") {
    await runAlertEngine({ gerpiId, io: req.app.get("io") });
  }
  return ok(res, row, null, 201);
}));

/** GET /api/documents/:id/download */
documentActionsRouter.get("/:id/download", ah(async (req, res) => {
  const doc = await db("documents").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!doc) return fail(res, 404, "Hujjat topilmadi");
  if (!(await canViewGerpi(req.user, doc.gerpi_id))) return fail(res, 403, "Ruxsat yo'q");
  if (!doc.file_path) return fail(res, 404, "Fayl biriktirilmagan");
  const full = path.join(CONFIG.UPLOADS.DIR, path.basename(doc.file_path));
  if (!fs.existsSync(full)) return fail(res, 404, "Fayl topilmadi");
  return res.download(full, doc.file_path.replace(/^[0-9a-f-]{36}-/, ""));
}));
