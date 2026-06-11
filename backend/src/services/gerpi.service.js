const db = require('../db');
const { ApiError } = require('../utils/respond');
const { scopeGerpiQuery, canSeeGerpi } = require('../middleware/rbac');

const GERPI_STATUSES = ['tayyorgarlik', 'faol', 'kechikayotgan', 'yakunlangan', 'toxtatilgan'];
const RISK_LEVELS = ['past', 'orta', 'yuqori'];
const SORTABLE = {
  name: 'g.name_uz_latn',
  budget: 'g.budget_total_usd',
  disbursed: 'ld.disbursed_pct',
  risk: 'g.risk_level',
  status: 'g.status',
  end_year: 'g.end_year',
};

// Latest disbursement report per organization (any non-draft status).
function latestDisbursementSub() {
  return db('disbursement_reports as d')
    .distinctOn('d.gerpi_id')
    .select('d.gerpi_id', 'd.disbursed_pct', 'd.planned_pct', 'd.disbursed_usd_cumulative', 'd.year', 'd.quarter')
    .whereNot('d.status', 'qoralama')
    .whereNull('d.deleted_at')
    .orderBy([{ column: 'd.gerpi_id' }, { column: 'd.year', order: 'desc' }, { column: 'd.quarter', order: 'desc' }])
    .as('ld');
}

function baseQuery(user) {
  const q = db('gerpi_organizations as g')
    .leftJoin('ministries as m', 'm.id', 'g.ministry_id')
    .leftJoin('donors as d', 'd.id', 'g.donor_id')
    .leftJoin(latestDisbursementSub(), 'ld.gerpi_id', 'g.id')
    .whereNull('g.deleted_at');
  return scopeGerpiQuery(q, user);
}

const LIST_COLUMNS = [
  'g.id', 'g.name_uz_latn', 'g.name_uz_cyrl', 'g.name_ru', 'g.name_en',
  'g.ministry_id', 'g.donor_id', 'g.agreement_number', 'g.budget_total_usd',
  'g.start_year', 'g.end_year', 'g.closing_date', 'g.status', 'g.risk_level',
  'g.director_name',
  'm.name_uz_latn as ministry_name', 'm.code as ministry_code',
  'd.short_name as donor_short', 'd.name as donor_name',
  'ld.disbursed_pct', 'ld.planned_pct', 'ld.disbursed_usd_cumulative',
  'ld.year as last_report_year', 'ld.quarter as last_report_quarter',
];

async function list(user, filters) {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));

  const q = baseQuery(user);
  if (filters.ministry_id) q.where('g.ministry_id', filters.ministry_id);
  if (filters.donor_id) q.where('g.donor_id', filters.donor_id);
  if (filters.status) q.where('g.status', filters.status);
  if (filters.risk_level) q.where('g.risk_level', filters.risk_level);
  if (filters.q) {
    const like = `%${filters.q}%`;
    q.where((b) => b.whereILike('g.name_uz_latn', like)
      .orWhereILike('g.name_uz_cyrl', like)
      .orWhereILike('g.name_ru', like)
      .orWhereILike('g.name_en', like)
      .orWhereILike('g.agreement_number', like));
  }

  const [{ count }] = await q.clone().clearSelect().count('g.id as count');

  const sortCol = SORTABLE[filters.sort] || 'g.name_uz_latn';
  const sortDir = filters.dir === 'desc' ? 'desc' : 'asc';
  const rows = await q.select(LIST_COLUMNS)
    .orderByRaw(`${sortCol} ${sortDir} NULLS LAST`)
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    rows,
    meta: { page, limit, total: parseInt(count, 10), pages: Math.ceil(count / limit) },
  };
}

async function getById(user, id) {
  const org = await baseQuery(user).select(LIST_COLUMNS).where('g.id', id).first()
    .catch(() => null); // invalid uuid
  if (!org) throw new ApiError(404, 'NOT_FOUND', 'GERPI topilmadi yoki ruxsat yo\'q');

  const [regions, components, disbursements, alerts] = await Promise.all([
    db('gerpi_regions as gr')
      .join('regions as r', 'r.id', 'gr.region_id')
      .where('gr.gerpi_id', id)
      .select('r.id', 'r.name_uz_latn', 'r.name_uz_cyrl', 'r.name_ru', 'r.name_en', 'r.geojson_id'),
    db('components').where({ gerpi_id: id }).whereNull('deleted_at').orderBy('name'),
    db('disbursement_reports').where({ gerpi_id: id }).whereNull('deleted_at')
      .orderBy([{ column: 'year' }, { column: 'quarter' }]),
    db('alerts').where({ gerpi_id: id, is_resolved: false }).whereNull('deleted_at')
      .orderBy('created_at', 'desc'),
  ]);

  return { ...org, regions, components, disbursements, alerts };
}

const EDITABLE_FIELDS = [
  'name_uz_latn', 'name_uz_cyrl', 'name_ru', 'name_en', 'ministry_id', 'donor_id',
  'agreement_number', 'agreement_date', 'budget_total_usd', 'start_year', 'end_year',
  'closing_date', 'status', 'director_name', 'director_phone', 'address', 'website',
];

function validatePayload(body, { partial = false } = {}) {
  const data = {};
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
  }
  if (!partial) {
    for (const required of ['name_uz_latn', 'ministry_id', 'donor_id', 'budget_total_usd']) {
      if (data[required] == null) {
        throw new ApiError(422, 'VALIDATION', `Majburiy maydon to'ldirilmagan: ${required}`);
      }
    }
    // Fall back to the latin name for the other locales until translations are provided
    data.name_uz_cyrl = data.name_uz_cyrl || data.name_uz_latn;
    data.name_ru = data.name_ru || data.name_uz_latn;
    data.name_en = data.name_en || data.name_uz_latn;
  }
  if (data.status && !GERPI_STATUSES.includes(data.status)) {
    throw new ApiError(422, 'VALIDATION', `Noto'g'ri holat: ${data.status}`);
  }
  if (data.budget_total_usd != null && !(Number(data.budget_total_usd) >= 0)) {
    throw new ApiError(422, 'VALIDATION', 'Byudjet manfiy bo\'lishi mumkin emas');
  }
  if (data.risk_level && !RISK_LEVELS.includes(data.risk_level)) {
    throw new ApiError(422, 'VALIDATION', `Noto'g'ri risk darajasi: ${data.risk_level}`);
  }
  return data;
}

async function create(body) {
  const data = validatePayload(body);
  const [row] = await db('gerpi_organizations').insert(data).returning('*');
  if (Array.isArray(body.region_ids) && body.region_ids.length) {
    await db('gerpi_regions').insert(body.region_ids.map((rid) => ({ gerpi_id: row.id, region_id: rid })));
  }
  return row;
}

async function update(user, id, body) {
  const existing = await db('gerpi_organizations').where({ id }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!existing || !canSeeGerpi(user, existing)) {
    throw new ApiError(404, 'NOT_FOUND', 'GERPI topilmadi yoki ruxsat yo\'q');
  }
  const data = validatePayload(body, { partial: true });
  if (!Object.keys(data).length && !Array.isArray(body.region_ids)) {
    throw new ApiError(400, 'EMPTY_UPDATE', 'O\'zgartirish uchun maydon berilmagan');
  }
  data.updated_at = db.fn.now();
  const [row] = await db('gerpi_organizations').where({ id }).update(data).returning('*');
  if (Array.isArray(body.region_ids)) {
    await db('gerpi_regions').where({ gerpi_id: id }).del();
    if (body.region_ids.length) {
      await db('gerpi_regions').insert(body.region_ids.map((rid) => ({ gerpi_id: id, region_id: rid })));
    }
  }
  return { old: existing, row };
}

async function softDelete(id) {
  const existing = await db('gerpi_organizations').where({ id }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'GERPI topilmadi');
  await db('gerpi_organizations').where({ id }).update({ deleted_at: db.fn.now() });
  return existing;
}

async function history(user, id) {
  const org = await db('gerpi_organizations').where({ id }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!org || !canSeeGerpi(user, org)) throw new ApiError(404, 'NOT_FOUND', 'GERPI topilmadi yoki ruxsat yo\'q');
  return db('audit_log')
    .leftJoin('users as u', 'u.id', 'audit_log.user_id')
    .where({ entity_type: 'gerpi_organization', entity_id: String(id) })
    .orderBy('audit_log.created_at', 'desc')
    .limit(200)
    .select('audit_log.*', 'u.full_name as user_name');
}

module.exports = { list, getById, create, update, softDelete, history };
