const db = require('../db');
const { ApiError } = require('../utils/respond');
const { getOrg, canEnterData } = require('./disbursement.service');

// DCP-02: component progress, updated by GERPI staff at least monthly.

async function listByGerpi(user, gerpiId) {
  await getOrg(user, gerpiId);
  return db('components').where({ gerpi_id: gerpiId }).whereNull('deleted_at').orderBy('name');
}

function validate(body, { partial = false } = {}) {
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.budget_usd !== undefined) data.budget_usd = Number(body.budget_usd);
  if (body.progress_pct !== undefined) data.progress_pct = parseInt(body.progress_pct, 10);
  if (body.planned_progress_pct !== undefined) data.planned_progress_pct = parseInt(body.planned_progress_pct, 10);
  for (const f of ['start_date', 'end_date', 'responsible_person']) {
    if (body[f] !== undefined) data[f] = body[f] || null;
  }
  if (!partial && (!data.name || !(data.budget_usd >= 0))) {
    throw new ApiError(422, 'VALIDATION', 'Komponent nomi va byudjeti majburiy');
  }
  for (const f of ['progress_pct', 'planned_progress_pct']) {
    if (data[f] !== undefined && !(data[f] >= 0 && data[f] <= 100)) {
      throw new ApiError(422, 'VALIDATION', 'Progress 0–100 oralig\'ida bo\'lishi kerak');
    }
  }
  if (data.budget_usd !== undefined && !(data.budget_usd >= 0)) {
    throw new ApiError(422, 'VALIDATION', 'Byudjet manfiy bo\'lishi mumkin emas');
  }
  return data;
}

async function requireEntryAccess(user, gerpiId) {
  const org = await getOrg(user, gerpiId);
  if (!canEnterData(user, org) && user.role !== 'mof_supervisor') {
    throw new ApiError(403, 'FORBIDDEN', 'Komponent ma\'lumotlarini o\'zgartirish vakolati yo\'q');
  }
  return org;
}

async function create(user, gerpiId, body) {
  await requireEntryAccess(user, gerpiId);
  const data = validate(body);
  const [row] = await db('components').insert({ ...data, gerpi_id: gerpiId }).returning('*');
  return row;
}

async function update(user, id, body) {
  const existing = await db('components').where({ id }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Komponent topilmadi');
  await requireEntryAccess(user, existing.gerpi_id);
  const data = validate(body, { partial: true });
  if (!Object.keys(data).length) throw new ApiError(400, 'EMPTY_UPDATE', 'O\'zgartirish uchun maydon berilmagan');
  const [row] = await db('components').where({ id })
    .update({ ...data, updated_at: db.fn.now() }).returning('*');
  return { row, old: existing };
}

module.exports = { listByGerpi, create, update };
