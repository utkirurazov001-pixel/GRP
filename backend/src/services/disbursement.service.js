const db = require('../db');
const { ApiError } = require('../utils/respond');
const { canSeeGerpi } = require('../middleware/rbac');

// DCP-01 workflow: qoralama → topshirilgan → tasdiqlangan | qaytarilgan

async function getOrg(user, gerpiId) {
  const org = await db('gerpi_organizations').where({ id: gerpiId }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!org || !canSeeGerpi(user, org)) {
    throw new ApiError(404, 'NOT_FOUND', 'GERPI topilmadi yoki ruxsat yo\'q');
  }
  return org;
}

function canEnterData(user, org) {
  return user.role === 'admin'
    || (user.role === 'gerpi_staff' && user.gerpi_id === org.id);
}

function canReview(user, org) {
  return user.role === 'admin'
    || user.role === 'mof_supervisor'
    || (user.role === 'ministry_officer' && user.ministry_id === org.ministry_id);
}

async function listByGerpi(user, gerpiId) {
  await getOrg(user, gerpiId);
  return db('disbursement_reports as r')
    .leftJoin('users as su', 'su.id', 'r.submitted_by')
    .leftJoin('users as ru', 'ru.id', 'r.reviewed_by')
    .where('r.gerpi_id', gerpiId)
    .whereNull('r.deleted_at')
    .orderBy([{ column: 'r.year', order: 'desc' }, { column: 'r.quarter', order: 'desc' }])
    .select('r.*', 'su.full_name as submitted_by_name', 'ru.full_name as reviewed_by_name');
}

// Upsert a draft for (gerpi, year, quarter). Re-drafting is allowed only
// while the report is qoralama or qaytarilgan.
async function saveDraft(user, gerpiId, body) {
  const org = await getOrg(user, gerpiId);
  if (!canEnterData(user, org)) {
    throw new ApiError(403, 'FORBIDDEN', 'Hisobot kiritish faqat GERPI xodimiga ruxsat etilgan');
  }

  const year = parseInt(body.year, 10);
  const quarter = parseInt(body.quarter, 10);
  if (!year || year < 2000 || year > 2100 || !(quarter >= 1 && quarter <= 4)) {
    throw new ApiError(422, 'VALIDATION', 'Yil yoki chorak noto\'g\'ri');
  }

  const disbursed = Number(body.disbursed_usd_cumulative);
  const disbursedPct = Number(body.disbursed_pct);
  const plannedPct = Number(body.planned_pct);
  if (!(disbursed >= 0) || !(disbursedPct >= 0 && disbursedPct <= 100) || !(plannedPct >= 0 && plannedPct <= 100)) {
    throw new ApiError(422, 'VALIDATION', 'Summalar va foizlar noto\'g\'ri kiritilgan');
  }
  if (disbursed > Number(org.budget_total_usd)) {
    throw new ApiError(422, 'VALIDATION', 'O\'zlashtirilgan summa byudjetdan oshmasligi kerak');
  }

  const data = {
    disbursed_usd_cumulative: disbursed,
    disbursed_pct: disbursedPct,
    planned_pct: plannedPct,
    commitment_usd: body.commitment_usd != null && body.commitment_usd !== '' ? Number(body.commitment_usd) : null,
    narrative: body.narrative || null,
    updated_at: db.fn.now(),
  };

  const existing = await db('disbursement_reports')
    .where({ gerpi_id: gerpiId, year, quarter }).whereNull('deleted_at').first();
  if (existing) {
    if (!['qoralama', 'qaytarilgan'].includes(existing.status)) {
      throw new ApiError(422, 'ALREADY_SUBMITTED', `${year}-Q${quarter} hisoboti allaqachon topshirilgan`);
    }
    const [row] = await db('disbursement_reports').where({ id: existing.id })
      .update({ ...data, status: 'qoralama' }).returning('*');
    return { row, old: existing };
  }
  const [row] = await db('disbursement_reports')
    .insert({ ...data, gerpi_id: gerpiId, year, quarter, status: 'qoralama' })
    .returning('*');
  return { row, old: null };
}

async function getReport(id) {
  const report = await db('disbursement_reports').where({ id }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!report) throw new ApiError(404, 'NOT_FOUND', 'Hisobot topilmadi');
  return report;
}

async function submit(user, id) {
  const report = await getReport(id);
  const org = await getOrg(user, report.gerpi_id);
  if (!canEnterData(user, org)) {
    throw new ApiError(403, 'FORBIDDEN', 'Hisobot topshirish faqat GERPI xodimiga ruxsat etilgan');
  }
  if (!['qoralama', 'qaytarilgan'].includes(report.status)) {
    throw new ApiError(422, 'BAD_STATUS', 'Faqat qoralama yoki qaytarilgan hisobot topshiriladi');
  }

  // Cumulative pct must not fall below the previous quarter's reported value
  const prev = await db('disbursement_reports')
    .where({ gerpi_id: report.gerpi_id })
    .whereNot('status', 'qoralama')
    .whereNull('deleted_at')
    .where((b) => b.where('year', '<', report.year)
      .orWhere((b2) => b2.where('year', report.year).andWhere('quarter', '<', report.quarter)))
    .orderBy([{ column: 'year', order: 'desc' }, { column: 'quarter', order: 'desc' }])
    .first();
  if (prev && Number(report.disbursed_pct) < Number(prev.disbursed_pct)) {
    throw new ApiError(422, 'VALIDATION',
      `O'zlashtirish foizi oldingi chorakdan (${prev.year}-Q${prev.quarter}: ${prev.disbursed_pct}%) kichik bo'lishi mumkin emas`);
  }

  const gap = Number(report.planned_pct) - Number(report.disbursed_pct);
  if (gap > 10 && (!report.narrative || report.narrative.trim().length < 100)) {
    throw new ApiError(422, 'VALIDATION',
      'Reja bilan farq 10% dan oshganda kamida 100 belgilik izoh majburiy');
  }

  const [row] = await db('disbursement_reports').where({ id }).update({
    status: 'topshirilgan',
    submitted_by: user.id,
    submitted_at: db.fn.now(),
    reviewed_by: null,
    reviewed_at: null,
    review_comment: null,
    updated_at: db.fn.now(),
  }).returning('*');
  return { row, old: report };
}

async function approve(user, id) {
  const report = await getReport(id);
  const org = await getOrg(user, report.gerpi_id);
  if (!canReview(user, org)) {
    throw new ApiError(403, 'FORBIDDEN', 'Hisobot tasdiqlash vakolati yo\'q');
  }
  if (report.status !== 'topshirilgan') {
    throw new ApiError(422, 'BAD_STATUS', 'Faqat topshirilgan hisobot tasdiqlanadi');
  }
  const [row] = await db('disbursement_reports').where({ id }).update({
    status: 'tasdiqlangan',
    reviewed_by: user.id,
    reviewed_at: db.fn.now(),
    review_comment: null,
    updated_at: db.fn.now(),
  }).returning('*');

  // Rule R1: approved report 15%+ behind schedule → automatic high alert
  const { createAlert } = require('./alert.service');
  const gap = +(Number(row.planned_pct) - Number(row.disbursed_pct)).toFixed(1);
  let alert = null;
  if (gap > 15) {
    alert = await createAlert({
      gerpiId: org.id,
      severity: 'yuqori',
      type: 'ozlashtirish_past',
      ruleCode: 'R1',
      title: `O'zlashtirish ${Number(row.disbursed_pct).toFixed(0)}% — grafikdan ${gap.toFixed(0)}% ortda`,
      description: `${row.year}-Q${row.quarter} tasdiqlangan hisobot bo'yicha reja-fakt farqi ${gap}%`,
    });
  }
  // Re-score the organization right away so the registry reflects reality
  setImmediate(() => {
    require('../jobs/alert-engine').runForOrg(org.id)
      .catch((err) => console.error('[alert-engine] re-score failed:', err.message));
  });
  return { row, old: report, alert };
}

async function reject(user, id, comment) {
  const report = await getReport(id);
  const org = await getOrg(user, report.gerpi_id);
  if (!canReview(user, org)) {
    throw new ApiError(403, 'FORBIDDEN', 'Hisobot qaytarish vakolati yo\'q');
  }
  if (report.status !== 'topshirilgan') {
    throw new ApiError(422, 'BAD_STATUS', 'Faqat topshirilgan hisobot qaytariladi');
  }
  if (!comment || comment.trim().length < 10) {
    throw new ApiError(422, 'VALIDATION', 'Qaytarish sababi (kamida 10 belgi) majburiy');
  }
  const [row] = await db('disbursement_reports').where({ id }).update({
    status: 'qaytarilgan',
    reviewed_by: user.id,
    reviewed_at: db.fn.now(),
    review_comment: comment.trim(),
    updated_at: db.fn.now(),
  }).returning('*');
  return { row, old: report };
}

module.exports = { listByGerpi, saveDraft, submit, approve, reject, getOrg, canEnterData, canReview };
