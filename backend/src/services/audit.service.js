const db = require('../db');

// Every mutation (and login/approve/reject/export) is written to audit_log.
async function writeAudit(req, { action, entityType, entityId = null, oldValue = null, newValue = null }) {
  try {
    await db('audit_log').insert({
      user_id: req.user ? req.user.id : null,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });
  } catch (err) {
    // Audit failures must never break the main request, but they must be visible.
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = { writeAudit };
