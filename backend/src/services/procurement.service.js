const db = require('../db');
const { ApiError } = require('../utils/respond');
const { getOrg, canEnterData } = require('./disbursement.service');

// DCP-03: procurement records, updated whenever a tender changes state.

const METHODS = ['ICB', 'NCB', 'shopping', 'direct', 'QCBS', 'boshqa'];
const STATUSES = ['rejalashtirilgan', 'elon_qilingan', 'baholashda', 'imzolangan', 'bekor_qilingan'];

async function listByGerpi(user, gerpiId) {
  await getOrg(user, gerpiId);
  return db('procurement_records').where({ gerpi_id: gerpiId }).whereNull('deleted_at')
    .orderBy('created_at', 'desc');
}

function validate(body, { partial = false } = {}) {
  const data = {};
  if (body.title !== undefined) data.title = String(body.title).trim();
  if (body.method !== undefined) data.method = body.method;
  if (body.estimated_usd !== undefined) data.estimated_usd = Number(body.estimated_usd);
  if (body.contract_usd !== undefined) data.contract_usd = body.contract_usd === '' || body.contract_usd == null ? null : Number(body.contract_usd);
  if (body.status !== undefined) data.status = body.status;
  for (const f of ['announced_date', 'contract_date', 'supplier']) {
    if (body[f] !== undefined) data[f] = body[f] || null;
  }
  if (!partial && (!data.title || !(data.estimated_usd >= 0))) {
    throw new ApiError(422, 'VALIDATION', 'Tender nomi va taxminiy summa majburiy');
  }
  if (data.method && !METHODS.includes(data.method)) {
    throw new ApiError(422, 'VALIDATION', `Noto'g'ri xarid usuli: ${data.method}`);
  }
  if (data.status && !STATUSES.includes(data.status)) {
    throw new ApiError(422, 'VALIDATION', `Noto'g'ri tender holati: ${data.status}`);
  }
  return data;
}

async function requireEntryAccess(user, gerpiId) {
  const org = await getOrg(user, gerpiId);
  if (!canEnterData(user, org) && user.role !== 'mof_supervisor') {
    throw new ApiError(403, 'FORBIDDEN', 'Xarid ma\'lumotlarini o\'zgartirish vakolati yo\'q');
  }
  return org;
}

async function create(user, gerpiId, body) {
  await requireEntryAccess(user, gerpiId);
  const data = validate(body);
  const [row] = await db('procurement_records').insert({ ...data, gerpi_id: gerpiId }).returning('*');
  return row;
}

async function update(user, id, body) {
  const existing = await db('procurement_records').where({ id }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Tender topilmadi');
  await requireEntryAccess(user, existing.gerpi_id);
  const data = validate(body, { partial: true });
  if (!Object.keys(data).length) throw new ApiError(400, 'EMPTY_UPDATE', 'O\'zgartirish uchun maydon berilmagan');

  // Cancelling a tender bumps cancel_count; the record returns to planning.
  if (data.status === 'bekor_qilingan' && existing.status !== 'bekor_qilingan') {
    data.cancel_count = (existing.cancel_count || 0) + 1;
  }

  const [row] = await db('procurement_records').where({ id })
    .update({ ...data, updated_at: db.fn.now() }).returning('*');

  // Rule R4: tender cancelled 2+ times → automatic medium alert (once)
  const { createAlert } = require('./alert.service');
  let alert = null;
  if (row.cancel_count >= 2 && existing.cancel_count < 2) {
    alert = await createAlert({
      gerpiId: row.gerpi_id,
      severity: 'orta',
      type: 'xarid_muammo',
      ruleCode: 'R4',
      title: `Tender ${row.cancel_count} marta bekor qilingan`,
      description: `"${row.title}" tenderi takroran bekor qilindi — xarid jarayonini ko'rib chiqish zarur.`,
    });
  }
  return { row, old: existing, alert };
}

module.exports = { listByGerpi, create, update };
