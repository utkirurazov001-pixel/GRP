const db = require('../db');
const { ApiError } = require('../utils/respond');
const { scopeGerpiQuery, canSeeGerpi } = require('../middleware/rbac');
const realtime = require('../realtime');

// Single creation point: deduplicates by (gerpi, rule_code) among open
// alerts and pushes the new alert over Socket.IO.
async function createAlert({ gerpiId, severity, type, title, description = null, ruleCode = null }) {
  if (ruleCode) {
    const dup = await db('alerts')
      .where({ gerpi_id: gerpiId, rule_code: ruleCode, is_resolved: false })
      .whereNull('deleted_at')
      .first();
    if (dup) return null;
  }
  const [alert] = await db('alerts').insert({
    gerpi_id: gerpiId, severity, type, title, description, rule_code: ruleCode,
  }).returning('*');

  const org = await db('gerpi_organizations').where({ id: gerpiId }).first();
  if (org) realtime.emitAlert(alert, org);
  return alert;
}

async function list(user, filters) {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));

  const q = scopeGerpiQuery(
    db('alerts as a')
      .join('gerpi_organizations as g', 'g.id', 'a.gerpi_id')
      .leftJoin('users as ru', 'ru.id', 'a.resolved_by')
      .whereNull('a.deleted_at')
      .whereNull('g.deleted_at'),
    user,
  );
  if (filters.severity) q.where('a.severity', filters.severity);
  if (filters.type) q.where('a.type', filters.type);
  if (filters.gerpi_id) q.where('a.gerpi_id', filters.gerpi_id);
  if (filters.status === 'open') q.where('a.is_resolved', false);
  if (filters.status === 'resolved') q.where('a.is_resolved', true);

  const [{ count }] = await q.clone().clearSelect().count('a.id as count');
  const rows = await q
    .orderBy([{ column: 'a.is_resolved' }, { column: 'a.created_at', order: 'desc' }])
    .limit(limit).offset((page - 1) * limit)
    .select('a.*', 'g.name_uz_latn as gerpi_name', 'ru.full_name as resolved_by_name');

  return { rows, meta: { page, limit, total: parseInt(count, 10), pages: Math.ceil(count / limit) } };
}

async function resolve(user, id, note) {
  if (!['admin', 'mof_supervisor'].includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Ogohlantirishni yopish vakolati yo\'q');
  }
  const alert = await db('alerts').where({ id }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!alert) throw new ApiError(404, 'NOT_FOUND', 'Ogohlantirish topilmadi');
  if (alert.is_resolved) throw new ApiError(422, 'ALREADY_RESOLVED', 'Ogohlantirish allaqachon yopilgan');
  if (!note || note.trim().length < 5) {
    throw new ApiError(422, 'VALIDATION', 'Hal qilish izohi (kamida 5 belgi) majburiy');
  }
  const [row] = await db('alerts').where({ id }).update({
    is_resolved: true,
    resolved_by: user.id,
    resolved_at: db.fn.now(),
    resolution_note: note.trim(),
    updated_at: db.fn.now(),
  }).returning('*');
  return { row, old: alert };
}

module.exports = { createAlert, list, resolve };
