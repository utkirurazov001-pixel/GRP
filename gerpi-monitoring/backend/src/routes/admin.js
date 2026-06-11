import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { ok, fail, uuid, ah, pagination } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { writeAudit } from "../middleware/audit.js";

/** Spravochniklar (hamma autentlangan foydalanuvchi o'qiy oladi) */
export const refsRouter = Router();
refsRouter.use(auth());

refsRouter.get("/ministries", ah(async (req, res) =>
  ok(res, await db("ministries").whereNull("deleted_at").orderBy("name_uz_latn"))));
refsRouter.get("/donors", ah(async (req, res) =>
  ok(res, await db("donors").whereNull("deleted_at").orderBy("short_name"))));
refsRouter.get("/regions", ah(async (req, res) =>
  ok(res, await db("regions").whereNull("deleted_at").orderBy("name_uz_latn"))));

/** Admin CRUD */
export const adminRouter = Router();
adminRouter.use(auth());

const sanitizeUser = (u) => {
  const { password_hash, ...rest } = u;
  return rest;
};

/* ----- Foydalanuvchilar ----- */
adminRouter.get("/users", requireRole("admin"), ah(async (req, res) => {
  const rows = await db("users").whereNull("deleted_at").orderBy("full_name");
  return ok(res, rows.map(sanitizeUser));
}));

adminRouter.post("/users", requireRole("admin"), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.full_name || !b.email || !b.password) return fail(res, 422, "full_name, email, password majburiy");
  if (String(b.password).length < 8) return fail(res, 422, "Parol kamida 8 belgi");
  if (!CONFIG.ROLES.includes(b.role)) return fail(res, 422, "role noto'g'ri");
  if (b.locale && !CONFIG.LOCALES.includes(b.locale)) return fail(res, 422, "locale noto'g'ri");
  const exists = await db("users").where({ email: String(b.email).toLowerCase() }).first();
  if (exists) return fail(res, 422, "Bu email allaqachon ro'yxatda");
  const row = {
    id: uuid(),
    full_name: b.full_name,
    email: String(b.email).toLowerCase(),
    phone: b.phone || null,
    password_hash: await bcrypt.hash(String(b.password), CONFIG.BCRYPT_ROUNDS),
    role: b.role,
    gerpi_id: b.gerpi_id || null,
    ministry_id: b.ministry_id || null,
    donor_id: b.donor_id || null,
    locale: b.locale || "uz_latn",
    telegram_chat_id: b.telegram_chat_id || null,
    is_active: b.is_active !== false,
  };
  await db("users").insert(row);
  await writeAudit(req, "create", "users", row.id, null, { ...row, password_hash: "***" });
  return ok(res, sanitizeUser(row), null, 201);
}));

adminRouter.patch("/users/:id", requireRole("admin"), ah(async (req, res) => {
  const old = await db("users").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!old) return fail(res, 404, "Foydalanuvchi topilmadi");
  const b = req.body || {};
  const patch = {};
  for (const f of ["full_name", "phone", "role", "gerpi_id", "ministry_id", "donor_id", "locale", "telegram_chat_id", "is_active"]) {
    if (b[f] !== undefined) patch[f] = b[f];
  }
  if (b.role && !CONFIG.ROLES.includes(b.role)) return fail(res, 422, "role noto'g'ri");
  if (b.password) {
    if (String(b.password).length < 8) return fail(res, 422, "Parol kamida 8 belgi");
    patch.password_hash = await bcrypt.hash(String(b.password), CONFIG.BCRYPT_ROUNDS);
  }
  if (!Object.keys(patch).length) return fail(res, 400, "O'zgartirish yo'q");
  patch.updated_at = db.fn.now();
  await db("users").where({ id: old.id }).update(patch);
  await writeAudit(req, "update", "users", old.id, sanitizeUser(old), { ...patch, password_hash: patch.password_hash ? "***" : undefined });
  return ok(res, sanitizeUser(await db("users").where({ id: old.id }).first()));
}));

adminRouter.delete("/users/:id", requireRole("admin"), ah(async (req, res) => {
  const old = await db("users").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!old) return fail(res, 404, "Foydalanuvchi topilmadi");
  if (old.id === req.user.id) return fail(res, 422, "O'zingizni o'chira olmaysiz");
  await db("users").where({ id: old.id }).update({ deleted_at: db.fn.now(), is_active: false });
  await writeAudit(req, "delete", "users", old.id, sanitizeUser(old), null);
  return ok(res, { deleted: true });
}));

/* ----- Spravochnik CRUD (vazirlik/donor/hudud) ----- */
function refCrud(table, requiredField) {
  const r = Router();
  r.post("/", requireRole("admin"), ah(async (req, res) => {
    const b = req.body || {};
    if (!b[requiredField]) return fail(res, 422, `${requiredField} majburiy`);
    const row = { id: uuid(), ...b };
    await db(table).insert(row);
    await writeAudit(req, "create", table, row.id, null, row);
    return ok(res, row, null, 201);
  }));
  r.patch("/:id", requireRole("admin"), ah(async (req, res) => {
    const old = await db(table).where({ id: req.params.id }).whereNull("deleted_at").first();
    if (!old) return fail(res, 404, "Topilmadi");
    const patch = { ...req.body, id: undefined, updated_at: db.fn.now() };
    delete patch.id;
    await db(table).where({ id: old.id }).update(patch);
    await writeAudit(req, "update", table, old.id, old, patch);
    return ok(res, await db(table).where({ id: old.id }).first());
  }));
  r.delete("/:id", requireRole("admin"), ah(async (req, res) => {
    const old = await db(table).where({ id: req.params.id }).whereNull("deleted_at").first();
    if (!old) return fail(res, 404, "Topilmadi");
    await db(table).where({ id: old.id }).update({ deleted_at: db.fn.now() });
    await writeAudit(req, "delete", table, old.id, old, null);
    return ok(res, { deleted: true });
  }));
  return r;
}

adminRouter.use("/ministries", refCrud("ministries", "name_uz_latn"));
adminRouter.use("/donors", refCrud("donors", "name"));
adminRouter.use("/regions", refCrud("regions", "name_uz_latn"));

/* ----- Audit log ----- */
adminRouter.get("/audit-log", requireRole("admin", "mof_supervisor"), ah(async (req, res) => {
  const { page, limit, offset } = pagination(req, 50);
  const q = db("audit_log")
    .leftJoin("users", "audit_log.user_id", "users.id")
    .select("audit_log.*", "users.full_name as user_name", "users.role as user_role");
  if (req.query.action) q.where("audit_log.action", req.query.action);
  if (req.query.entity_type) q.where("audit_log.entity_type", req.query.entity_type);
  if (req.query.user_id) q.where("audit_log.user_id", req.query.user_id);
  const countRow = await q.clone().clearSelect().clearOrder().count({ c: "*" }).first();
  const rows = await q.orderBy("audit_log.created_at", "desc").limit(limit).offset(offset);
  return ok(res, rows, { page, limit, total: Number(countRow.c) });
}));
