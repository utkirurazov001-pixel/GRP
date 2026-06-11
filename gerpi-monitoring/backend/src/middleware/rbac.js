import { db } from "../db.js";
import { fail } from "../utils/respond.js";

/** Faqat ko'rsatilgan rollarga ruxsat. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, "Avtorizatsiya talab qilinadi");
    if (!roles.includes(req.user.role)) return fail(res, 403, "Ruxsat yo'q");
    next();
  };
}

/**
 * RBAC ko'rish chegarasi (7-bo'lim):
 *  - admin / mof_supervisor — hamma GERPI
 *  - ministry_officer — faqat o'z vazirligi
 *  - gerpi_staff — faqat o'z GERPI'si
 *  - donor_viewer — faqat o'z donori loyihalari
 * Knex so'roviga filtr qo'shadi.
 */
export function scopeGerpiQuery(query, user, gerpiTable = "gerpi_organizations") {
  switch (user.role) {
    case "ministry_officer":
      return query.where(`${gerpiTable}.ministry_id`, user.ministry_id);
    case "gerpi_staff":
      return query.where(`${gerpiTable}.id`, user.gerpi_id);
    case "donor_viewer":
      return query.where(`${gerpiTable}.donor_id`, user.donor_id);
    default:
      return query;
  }
}

/** Foydalanuvchi mazkur GERPI'ni ko'ra oladimi? */
export async function canViewGerpi(user, gerpiId) {
  if (["admin", "mof_supervisor"].includes(user.role)) return true;
  const org = await db("gerpi_organizations").where({ id: gerpiId }).first();
  if (!org) return false;
  if (user.role === "ministry_officer") return org.ministry_id === user.ministry_id;
  if (user.role === "gerpi_staff") return user.gerpi_id === gerpiId;
  if (user.role === "donor_viewer") return org.donor_id === user.donor_id;
  return false;
}

/** Faqat o'z GERPI'siga yozish (gerpi_staff) yoki to'liq huquq (admin/mof). */
export function canEditGerpiData(user, gerpiId) {
  if (["admin", "mof_supervisor"].includes(user.role)) return true;
  return user.role === "gerpi_staff" && user.gerpi_id === gerpiId;
}
