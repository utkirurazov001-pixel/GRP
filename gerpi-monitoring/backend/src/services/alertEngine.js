import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { uuid } from "../utils/respond.js";
import { currentQuarter, prevQuarter, reportDeadline, quarterLabel } from "../utils/quarters.js";
import { notifyHighAlert } from "./notify.js";

/**
 * Qoidalar dvigateli (6-bo'lim): R1–R7 + risk ball.
 * Cron: har kuni 06:00 + hisobot tasdiqlanganda darhol chaqiriladi.
 */

/** Bitta GERPI bo'yicha kontekst yig'ish */
async function orgContext(org, now = new Date()) {
  const last = await db("disbursement_reports")
    .where({ gerpi_id: org.id })
    .whereIn("status", ["topshirilgan", "tasdiqlangan"])
    .orderBy([{ column: "year", order: "desc" }, { column: "quarter", order: "desc" }])
    .first();

  // Kutilayotgan hisobot: oxirgi to'liq chorak
  const expected = prevQuarter(currentQuarter(now));
  const expectedReport = await db("disbursement_reports")
    .where({ gerpi_id: org.id, year: expected.year, quarter: expected.quarter })
    .whereIn("status", ["topshirilgan", "tasdiqlangan"])
    .first();
  const deadline = reportDeadline(expected.year, expected.quarter, CONFIG.REPORT_DEADLINE_DAYS);
  const lateDays = !expectedReport && now > deadline
    ? Math.floor((now - deadline) / 86400_000)
    : 0;

  const cancelledTender = await db("procurement_records")
    .where({ gerpi_id: org.id })
    .where("cancel_count", ">=", 2)
    .first();

  const auditFinding = await db("documents")
    .where({ gerpi_id: org.id, type: "audit_hisoboti", has_findings: true })
    .whereNull("deleted_at")
    .first();

  const annualPlan = await db("documents")
    .where({ gerpi_id: org.id, type: "yillik_reja", period_year: now.getFullYear() })
    .whereNull("deleted_at")
    .first();

  const monthsToClose = org.closing_date
    ? (new Date(org.closing_date) - now) / (30.44 * 86400_000)
    : Infinity;

  return { last, expected, lateDays, cancelledTender, auditFinding, annualPlan, monthsToClose };
}

/** Risk ball formulasi: 0-100 → past/orta/yuqori */
export function computeRiskScore(ctx) {
  const R = CONFIG.RISK;
  let score = 0;
  const gap = ctx.last ? Number(ctx.last.planned_pct) - Number(ctx.last.disbursed_pct) : 0;
  if (gap > R.GAP_HIGH.THRESHOLD) score += R.GAP_HIGH.SCORE;
  else if (gap >= R.GAP_MID.MIN) score += R.GAP_MID.SCORE;
  if (ctx.lateDays > 0) {
    score += Math.min(R.LATE_REPORT_MAX, Math.floor(ctx.lateDays / 7 + 1) * R.LATE_REPORT_PER_7D);
  }
  const disb = ctx.last ? Number(ctx.last.disbursed_pct) : 0;
  if (ctx.monthsToClose < R.CLOSING_SOON.MONTHS && disb < R.CLOSING_SOON.DISB_BELOW) {
    score += R.CLOSING_SOON.SCORE;
  }
  if (ctx.auditFinding) score += R.AUDIT_FINDING;
  if (ctx.cancelledTender) score += R.TENDER_CANCELLED;
  score = Math.min(100, score);
  const level = score <= R.LEVELS.PAST_MAX ? "past" : score <= R.LEVELS.ORTA_MAX ? "orta" : "yuqori";
  return { score, level };
}

/** Dublikatga yo'l qo'ymasdan alert yaratish. Yangi alert obyektini qaytaradi (yoki null). */
async function upsertAlert(org, { rule_code, severity, type, title, description }) {
  const existing = await db("alerts")
    .where({ gerpi_id: org.id, rule_code, is_resolved: false })
    .whereNull("deleted_at")
    .first();
  if (existing) return null;
  const alert = {
    id: uuid(),
    gerpi_id: org.id,
    severity,
    type,
    title,
    description,
    rule_code,
    is_resolved: false,
  };
  await db("alerts").insert(alert);
  return alert;
}

/** R1–R7 qoidalarini bitta GERPI uchun qo'llash */
async function applyRules(org, ctx) {
  const created = [];
  const name = org.name_uz_latn;
  const gap = ctx.last ? Number(ctx.last.planned_pct) - Number(ctx.last.disbursed_pct) : 0;
  const disb = ctx.last ? Number(ctx.last.disbursed_pct) : 0;

  if (ctx.last && gap > 15) {
    created.push(await upsertAlert(org, {
      rule_code: "R1", severity: "yuqori", type: "ozlashtirish_past",
      title: `O'zlashtirish ${disb.toFixed(0)}% — grafikdan ${gap.toFixed(0)}% ortda`,
      description: `${name}: ${quarterLabel(ctx.last.year, ctx.last.quarter)} hisobotida o'zlashtirish ${disb.toFixed(1)}%, reja ${Number(ctx.last.planned_pct).toFixed(1)}%.`,
    }));
  }
  if (ctx.lateDays >= 7) {
    created.push(await upsertAlert(org, {
      rule_code: "R2", severity: "yuqori", type: "hisobot_kechikkan",
      title: `Choraklik hisobot ${ctx.lateDays} kun kechikkan`,
      description: `${name}: ${quarterLabel(ctx.expected.year, ctx.expected.quarter)} hisoboti topshirilmagan (muddat: chorak tugagach ${CONFIG.REPORT_DEADLINE_DAYS} kun).`,
    }));
  }
  if (ctx.monthsToClose < 6 && disb < 60 && org.status !== "yakunlangan") {
    created.push(await upsertAlert(org, {
      rule_code: "R3", severity: "orta", type: "muddat_yaqin",
      title: `Yopilishgacha 6 oydan kam, o'zlashtirish ${disb.toFixed(0)}%`,
      description: `${name}: yopilish sanasi ${org.closing_date}, o'zlashtirish 60% dan past.`,
    }));
  }
  if (ctx.cancelledTender) {
    created.push(await upsertAlert(org, {
      rule_code: "R4", severity: "orta", type: "xarid_muammo",
      title: `Tender 2+ marta bekor qilingan`,
      description: `${name}: "${ctx.cancelledTender.title}" tenderi ${ctx.cancelledTender.cancel_count} marta bekor qilingan.`,
    }));
  }
  if (ctx.auditFinding) {
    created.push(await upsertAlert(org, {
      rule_code: "R5", severity: "yuqori", type: "audit_nomuvofiqlik",
      title: `Audit hisobotida nomuvofiqlik`,
      description: `${name}: "${ctx.auditFinding.title}" hujjatida nomuvofiqlik belgilangan.`,
    }));
  }
  const now = new Date();
  const feb1 = new Date(now.getFullYear(), 1, 1);
  if (now > feb1 && !ctx.annualPlan && org.status !== "yakunlangan") {
    created.push(await upsertAlert(org, {
      rule_code: "R6", severity: "past", type: "hujjat_kutilmoqda",
      title: `${now.getFullYear()} yillik reja yuklanmagan`,
      description: `${name}: yillik reja hujjati 1-fevralgacha yuklanishi kerak edi.`,
    }));
  }
  if (org.status === "tayyorgarlik" && org.agreement_date) {
    const months = (now - new Date(org.agreement_date)) / (30.44 * 86400_000);
    if (months > 18) {
      created.push(await upsertAlert(org, {
        rule_code: "R7", severity: "orta", type: "eslatma",
        title: `Tayyorgarlik bosqichi 18 oydan oshdi`,
        description: `${name}: bitim ${org.agreement_date} da imzolangan, loyiha hali ham tayyorgarlik bosqichida.`,
      }));
    }
  }
  return created.filter(Boolean);
}

/**
 * To'liq sikl: barcha (yoki bitta) GERPI bo'yicha risk ballini yangilash + alertlar.
 * @param {object} [opts] — { gerpiId, io } (io — Socket.IO server, jonli yangilanish)
 */
export async function runAlertEngine(opts = {}) {
  const query = db("gerpi_organizations").whereNull("deleted_at");
  if (opts.gerpiId) query.where({ id: opts.gerpiId });
  const orgs = await query;
  const allCreated = [];

  for (const org of orgs) {
    const ctx = await orgContext(org);
    const { score, level } = computeRiskScore(ctx);
    if (org.risk_score !== score || org.risk_level !== level) {
      await db("gerpi_organizations").where({ id: org.id })
        .update({ risk_score: score, risk_level: level, updated_at: db.fn.now() });
    }
    if (org.status === "yakunlangan" || org.status === "toxtatilgan") continue;
    const created = await applyRules(org, ctx);
    for (const alert of created) {
      allCreated.push(alert);
      if (opts.io) opts.io.emit("alert:new", { ...alert, gerpi_name: org.name_uz_latn });
      if (alert.severity === "yuqori") await notifyHighAlert(org, alert);
    }
  }
  if (allCreated.length) console.log(`Alert dvigateli: ${allCreated.length} ta yangi ogohlantirish`);
  return allCreated;
}
