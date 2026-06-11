import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { ok, fail, uuid, ah } from "../utils/respond.js";
import { writeAudit } from "../middleware/audit.js";

export const authRouter = Router();

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function signAccess(user) {
  return jwt.sign({ sub: user.id, role: user.role }, CONFIG.JWT.ACCESS_SECRET, {
    expiresIn: CONFIG.JWT.ACCESS_TTL,
  });
}

/** Refresh token yaratish (rotation: har yangilashda eski bekor qilinadi) */
async function issueRefresh(userId) {
  const raw = crypto.randomBytes(48).toString("hex");
  await db("refresh_tokens").insert({
    id: uuid(),
    user_id: userId,
    token_hash: sha256(raw),
    expires_at: new Date(Date.now() + CONFIG.JWT.REFRESH_TTL_DAYS * 86400_000),
  });
  return raw;
}

const publicUser = (u) => ({
  id: u.id, full_name: u.full_name, email: u.email, role: u.role,
  gerpi_id: u.gerpi_id, ministry_id: u.ministry_id, donor_id: u.donor_id,
  locale: u.locale,
});

authRouter.post("/login", ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 400, "Email va parol talab qilinadi");
  const user = await db("users").where({ email: String(email).toLowerCase() }).whereNull("deleted_at").first();
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    return fail(res, 401, "Email yoki parol noto'g'ri");
  }
  const refresh = await issueRefresh(user.id);
  req.user = user;
  await writeAudit(req, "login", "users", user.id);
  return ok(res, {
    access_token: signAccess(user),
    refresh_token: refresh,
    user: publicUser(user),
    demo_mode: CONFIG.DEMO_MODE,
  });
}));

authRouter.post("/refresh", ah(async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) return fail(res, 400, "refresh_token talab qilinadi");
  const row = await db("refresh_tokens").where({ token_hash: sha256(refresh_token) }).first();
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    return fail(res, 401, "Refresh token yaroqsiz");
  }
  const user = await db("users").where({ id: row.user_id }).whereNull("deleted_at").first();
  if (!user || !user.is_active) return fail(res, 401, "Foydalanuvchi faol emas");
  // Rotation: eskisini bekor qilib, yangisini beramiz
  await db("refresh_tokens").where({ id: row.id }).update({ revoked_at: db.fn.now() });
  const refresh = await issueRefresh(user.id);
  return ok(res, { access_token: signAccess(user), refresh_token: refresh, user: publicUser(user) });
}));

authRouter.post("/logout", ah(async (req, res) => {
  const { refresh_token } = req.body || {};
  if (refresh_token) {
    await db("refresh_tokens").where({ token_hash: sha256(refresh_token) }).update({ revoked_at: db.fn.now() });
  }
  return ok(res, { logged_out: true });
}));
