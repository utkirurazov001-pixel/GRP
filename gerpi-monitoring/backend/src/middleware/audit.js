import { db } from "../db.js";
import { uuid } from "../utils/respond.js";

/** Barcha mutatsiya amallari audit_log'ga yoziladi (davlat tizimi talabi). */
export async function writeAudit(req, action, entityType, entityId, oldValue = null, newValue = null) {
  try {
    await db("audit_log").insert({
      id: uuid(),
      user_id: req.user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"] || null,
    });
  } catch (e) {
    console.error("Audit yozishda xato:", e.message);
  }
}
