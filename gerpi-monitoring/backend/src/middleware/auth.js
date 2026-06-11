import jwt from "jsonwebtoken";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { fail } from "../utils/respond.js";

/** Bearer access-token tekshiruvi. req.user ni to'ldiradi. */
export function auth() {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return fail(res, 401, "Avtorizatsiya talab qilinadi");
    try {
      const payload = jwt.verify(token, CONFIG.JWT.ACCESS_SECRET);
      const user = await db("users").where({ id: payload.sub }).whereNull("deleted_at").first();
      if (!user || !user.is_active) return fail(res, 401, "Foydalanuvchi faol emas");
      req.user = user;
      next();
    } catch {
      return fail(res, 401, "Token yaroqsiz yoki muddati o'tgan");
    }
  };
}
