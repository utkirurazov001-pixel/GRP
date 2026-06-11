/**
 * Alert rules engine + automatic risk scoring (section 6 of the spec).
 * Runs daily at 06:00, on server start, and for a single org right after
 * a disbursement report is approved.
 *
 * Risk score (0–100): gap>15 → +40, gap 8–15 → +20; report lateness +10
 * per 7 days (max 30); <12 months to closing & <70% disbursed → +20;
 * open audit non-conformity → +15; tender cancelled 2+ times → +10.
 * Mapping: 0–25 past, 26–55 orta, 56+ yuqori.
 */
const db = require('../db');
const { createAlert } = require('../services/alert.service');

const MS_DAY = 24 * 60 * 60 * 1000;

function quarterEnd(year, quarter) {
  return new Date(Date.UTC(year, quarter * 3, 0, 23, 59, 59));
}

// The most recent quarter that has fully ended, with its reporting deadline
// (15 days after quarter end — DCP-01).
function expectedReportPeriod(now = new Date()) {
  let year = now.getUTCFullYear();
  let quarter = Math.floor(now.getUTCMonth() / 3); // 0 = previous year's Q4
  if (quarter === 0) { year -= 1; quarter = 4; }
  return { year, quarter, dueDate: new Date(quarterEnd(year, quarter).getTime() + 15 * MS_DAY) };
}

function riskLevelFromScore(score) {
  if (score >= 56) return 'yuqori';
  if (score >= 26) return 'orta';
  return 'past';
}

async function evaluateOrg(org, now = new Date()) {
  if (['yakunlangan', 'toxtatilgan'].includes(org.status)) return null;

  const latest = await db('disbursement_reports')
    .where({ gerpi_id: org.id })
    .whereNot('status', 'qoralama')
    .whereNull('deleted_at')
    .orderBy([{ column: 'year', order: 'desc' }, { column: 'quarter', order: 'desc' }])
    .first();

  let score = 0;
  const gap = latest ? Number(latest.planned_pct) - Number(latest.disbursed_pct) : 0;
  const disbursedPct = latest ? Number(latest.disbursed_pct) : 0;

  // Factor 1: plan-vs-actual gap
  if (gap > 15) score += 40;
  else if (gap >= 8) score += 20;

  // Factor 2: report lateness (R2)
  const expected = expectedReportPeriod(now);
  const expectedReport = await db('disbursement_reports')
    .where({ gerpi_id: org.id, year: expected.year, quarter: expected.quarter })
    .whereNot('status', 'qoralama')
    .whereNull('deleted_at')
    .first();
  let daysLate = 0;
  if (!expectedReport && now > expected.dueDate && org.status !== 'tayyorgarlik') {
    daysLate = Math.floor((now - expected.dueDate) / MS_DAY);
    score += Math.min(30, Math.floor(daysLate / 7) * 10);
  }

  // Factor 3: closing horizon vs disbursement
  let monthsToClose = null;
  if (org.closing_date) {
    monthsToClose = (new Date(org.closing_date) - now) / (30 * MS_DAY);
    if (monthsToClose < 12 && disbursedPct < 70) score += 20;
  }

  // Factor 4: open audit non-conformity (R5 alerts are entered manually
  // or via document review; they feed the score here)
  const auditOpen = await db('alerts')
    .where({ gerpi_id: org.id, type: 'audit_nomuvofiqlik', is_resolved: false })
    .whereNull('deleted_at').first();
  if (auditOpen) score += 15;

  // Factor 5: repeatedly cancelled tenders
  const badTender = await db('procurement_records')
    .where('gerpi_id', org.id).where('cancel_count', '>=', 2)
    .whereNull('deleted_at').first();
  if (badTender) score += 10;

  const riskLevel = riskLevelFromScore(score);
  if (riskLevel !== org.risk_level) {
    await db('gerpi_organizations').where({ id: org.id })
      .update({ risk_level: riskLevel, updated_at: db.fn.now() });
  }

  // ---- Alert rules (deduplicated by rule_code in createAlert) ----
  const alerts = [];

  // R1: 15%+ behind schedule
  if (latest && gap > 15) {
    alerts.push(createAlert({
      gerpiId: org.id, severity: 'yuqori', type: 'ozlashtirish_past', ruleCode: 'R1',
      title: `O'zlashtirish ${disbursedPct.toFixed(0)}% — grafikdan ${gap.toFixed(0)}% ortda`,
      description: `${latest.year}-Q${latest.quarter} hisoboti bo'yicha reja-fakt farqi ${gap.toFixed(1)}%.`,
    }));
  }

  // R2: quarterly report 7+ days late
  if (daysLate >= 7) {
    alerts.push(createAlert({
      gerpiId: org.id, severity: 'yuqori', type: 'hisobot_kechikkan', ruleCode: 'R2',
      title: `${expected.year}-Q${expected.quarter} hisoboti ${daysLate} kun kechikdi`,
      description: 'Choraklik o\'zlashtirish hisoboti muddatdan kechiktirilgan (muddat: chorak tugagach 15 kun).',
    }));
  }

  // R3: ≤6 months to closing and <60% disbursed
  if (monthsToClose != null && monthsToClose <= 6 && monthsToClose > 0 && disbursedPct < 60) {
    alerts.push(createAlert({
      gerpiId: org.id, severity: 'orta', type: 'muddat_yaqin', ruleCode: 'R3',
      title: `Yopilishgacha ${Math.ceil(monthsToClose)} oy, o'zlashtirish ${disbursedPct.toFixed(0)}%`,
      description: 'Kredit muddatini uzaytirish yoki jadval qayta ko\'rib chiqish masalasini donor bilan muhokama qilish zarur.',
    }));
  }

  // R4: tender cancelled twice or more
  if (badTender) {
    alerts.push(createAlert({
      gerpiId: org.id, severity: 'orta', type: 'xarid_muammo', ruleCode: 'R4',
      title: `Tender ${badTender.cancel_count} marta bekor qilingan`,
      description: `"${badTender.title}" tenderi takroran bekor qilindi.`,
    }));
  }

  // R6: annual plan not uploaded by Feb 1
  if (now.getUTCMonth() >= 1 && org.status !== 'tayyorgarlik') {
    const plan = await db('documents')
      .where({ gerpi_id: org.id, type: 'yillik_reja', period_year: now.getUTCFullYear() })
      .whereNull('deleted_at').first();
    if (!plan) {
      alerts.push(createAlert({
        gerpiId: org.id, severity: 'past', type: 'hujjat_kutilmoqda', ruleCode: 'R6',
        title: `${now.getUTCFullYear()}-yillik ish rejasi yuklanmagan`,
        description: 'Yillik ish rejasi har yili 1-fevralgacha platformaga yuklanishi kerak.',
      }));
    }
  }

  // R7: preparation phase longer than 18 months
  if (org.status === 'tayyorgarlik') {
    const since = org.agreement_date ? new Date(org.agreement_date) : new Date(org.created_at);
    if ((now - since) / (30 * MS_DAY) > 18) {
      alerts.push(createAlert({
        gerpiId: org.id, severity: 'orta', type: 'eslatma', ruleCode: 'R7',
        title: 'Tayyorgarlik bosqichi 18 oydan oshdi',
        description: 'Loyihani faollashtirishga to\'sqinlik qilayotgan omillarni aniqlash zarur.',
      }));
    }
  }

  await Promise.all(alerts);
  return { orgId: org.id, score, riskLevel };
}

async function runForOrg(gerpiId) {
  const org = await db('gerpi_organizations').where({ id: gerpiId }).whereNull('deleted_at').first();
  if (!org) return null;
  return evaluateOrg(org);
}

async function runAll() {
  const orgs = await db('gerpi_organizations').whereNull('deleted_at');
  const results = [];
  for (const org of orgs) {
    try {
      const r = await evaluateOrg(org);
      if (r) results.push(r);
    } catch (err) {
      console.error('[alert-engine] org', org.id, err.message);
    }
  }
  console.log(`[alert-engine] evaluated ${results.length} organizations`);
  return results;
}

module.exports = { runAll, runForOrg, expectedReportPeriod };
