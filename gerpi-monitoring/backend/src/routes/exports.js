import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { db } from "../db.js";
import { ok, fail, ah } from "../utils/respond.js";
import { auth } from "../middleware/auth.js";
import { scopeGerpiQuery, canViewGerpi } from "../middleware/rbac.js";
import { writeAudit } from "../middleware/audit.js";
import { currentQuarter, prevQuarter, quarterLabel } from "../utils/quarters.js";

export const exportsRouter = Router();
exportsRouter.use(auth());

const STATUS_LABEL = {
  tayyorgarlik: "Tayyorgarlik", faol: "Faol", kechikayotgan: "Kechikayotgan",
  yakunlangan: "Yakunlangan", toxtatilgan: "To'xtatilgan",
};
const RISK_LABEL = { past: "Past", orta: "O'rta", yuqori: "Yuqori" };
const money = (n) => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

async function scopedOrgs(user) {
  const orgs = await scopeGerpiQuery(
    db("gerpi_organizations")
      .leftJoin("ministries", "gerpi_organizations.ministry_id", "ministries.id")
      .leftJoin("donors", "gerpi_organizations.donor_id", "donors.id")
      .whereNull("gerpi_organizations.deleted_at")
      .select("gerpi_organizations.*",
        "ministries.name_uz_latn as ministry_name",
        "donors.short_name as donor_short")
      .orderBy("gerpi_organizations.name_uz_latn"),
    user
  );
  const reports = await db("disbursement_reports")
    .whereIn("gerpi_id", orgs.map((o) => o.id))
    .whereIn("status", ["topshirilgan", "tasdiqlangan"])
    .orderBy([{ column: "year", order: "asc" }, { column: "quarter", order: "asc" }]);
  const latest = {};
  for (const r of reports) latest[r.gerpi_id] = r;
  for (const o of orgs) {
    const lr = latest[o.id];
    o.disbursed_pct = lr ? Number(lr.disbursed_pct) : 0;
    o.planned_pct = lr ? Number(lr.planned_pct) : 0;
    o.disbursed_usd = lr ? Number(lr.disbursed_usd_cumulative) : 0;
  }
  return orgs;
}

/** GET /api/exports/registry.xlsx — Excel registr */
exportsRouter.get("/registry.xlsx", ah(async (req, res) => {
  const orgs = await scopedOrgs(req.user);
  const wb = new ExcelJS.Workbook();
  wb.creator = "GERPI Monitoring";
  const ws = wb.addWorksheet("GERPI registri");
  ws.columns = [
    { header: "№", key: "n", width: 5 },
    { header: "GERPI nomi", key: "name", width: 50 },
    { header: "Vazirlik", key: "ministry", width: 30 },
    { header: "Donor", key: "donor", width: 10 },
    { header: "Bitim raqami", key: "agreement", width: 16 },
    { header: "Byudjet (USD)", key: "budget", width: 16 },
    { header: "O'zlashtirilgan (USD)", key: "disbursed", width: 18 },
    { header: "O'zlashtirish %", key: "pct", width: 14 },
    { header: "Reja %", key: "plan", width: 10 },
    { header: "Holat", key: "status", width: 14 },
    { header: "Risk", key: "risk", width: 10 },
    { header: "Yopilish sanasi", key: "closing", width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E2A47" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  orgs.forEach((o, i) => {
    ws.addRow({
      n: i + 1, name: o.name_uz_latn, ministry: o.ministry_name, donor: o.donor_short,
      agreement: o.agreement_number, budget: Number(o.budget_total_usd),
      disbursed: o.disbursed_usd, pct: o.disbursed_pct, plan: o.planned_pct,
      status: STATUS_LABEL[o.status] || o.status, risk: RISK_LABEL[o.risk_level] || o.risk_level,
      closing: o.closing_date,
    });
  });
  ws.getColumn("budget").numFmt = "#,##0";
  ws.getColumn("disbursed").numFmt = "#,##0";
  await writeAudit(req, "export", "gerpi_organizations", "registry.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="gerpi-registry-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

/* ---------- PDF yordamchilari ---------- */

function pdfHeader(doc, title, subtitle) {
  doc.rect(0, 0, doc.page.width, 70).fill("#0e2a47");
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(16).text("GERPI MONITORING", 40, 18);
  doc.font("Helvetica").fontSize(9).fill("#9fb3c8")
    .text("Loyihalarni amalga oshirish guruhlari faoliyatini markazlashtirilgan nazorat qilish milliy platformasi", 40, 40, { width: 500 });
  doc.fill("#0e2a47").font("Helvetica-Bold").fontSize(14).text(title, 40, 90);
  if (subtitle) doc.font("Helvetica").fontSize(10).fill("#5a6b7e").text(subtitle, 40, 110);
  doc.moveTo(40, 128).lineTo(doc.page.width - 40, 128).strokeColor("#e3e8f0").stroke();
  return 140;
}

function pdfRow(doc, y, cols, widths, opts = {}) {
  let x = 40;
  doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 9)
    .fill(opts.color || "#15202b");
  cols.forEach((c, i) => {
    doc.text(String(c ?? "—"), x, y, { width: widths[i] - 6, ellipsis: true });
    x += widths[i];
  });
}

/** GET /api/exports/quarterly-summary.pdf — choraklik yig'ma hisobot */
exportsRouter.get("/quarterly-summary.pdf", ah(async (req, res) => {
  const orgs = await scopedOrgs(req.user);
  const q = prevQuarter(currentQuarter());
  const totalBudget = orgs.reduce((s, o) => s + Number(o.budget_total_usd), 0);
  const totalDisb = orgs.reduce((s, o) => s + o.disbursed_usd, 0);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="gerpi-quarterly-${quarterLabel(q.year, q.quarter)}.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  doc.pipe(res);

  let y = pdfHeader(doc, `Choraklik yig'ma hisobot — ${quarterLabel(q.year, q.quarter)}`,
    `Tayyorlandi: ${new Date().toLocaleDateString("en-GB")} | Jami ${orgs.length} ta GERPI`);

  // KPI bloki
  const kpis = [
    ["Jami GERPI", String(orgs.length)],
    ["Umumiy portfel", money(totalBudget)],
    ["O'zlashtirilgan", money(totalDisb)],
    ["O'zlashtirish", totalBudget ? `${((totalDisb / totalBudget) * 100).toFixed(1)}%` : "—"],
  ];
  let x = 40;
  for (const [label, value] of kpis) {
    doc.roundedRect(x, y, 122, 50, 6).fill("#eef1f7");
    doc.fill("#5a6b7e").font("Helvetica").fontSize(8).text(label, x + 10, y + 10);
    doc.fill("#0e2a47").font("Helvetica-Bold").fontSize(13).text(value, x + 10, y + 24, { width: 105 });
    x += 130;
  }
  y += 70;

  const widths = [165, 90, 45, 75, 60, 60];
  pdfRow(doc, y, ["GERPI nomi", "Vazirlik", "Donor", "Byudjet", "Fakt %", "Risk"], widths, { bold: true, color: "#0e2a47" });
  y += 16;
  doc.moveTo(40, y - 4).lineTo(doc.page.width - 40, y - 4).strokeColor("#e3e8f0").stroke();
  for (const o of orgs) {
    if (y > doc.page.height - 70) { doc.addPage(); y = 50; }
    pdfRow(doc, y, [
      o.name_uz_latn, o.ministry_name, o.donor_short, money(o.budget_total_usd),
      `${o.disbursed_pct.toFixed(1)}%`, RISK_LABEL[o.risk_level],
    ], widths);
    y += 16;
  }
  doc.font("Helvetica").fontSize(8).fill("#8896a6")
    .text("GERPI Monitoring platformasi tomonidan avtomatik shakllantirildi.", 40, doc.page.height - 50);
  await writeAudit(req, "export", "disbursement_reports", "quarterly-summary.pdf");
  doc.end();
}));

/** GET /api/exports/gerpi/:id/passport.pdf — GERPI pasporti */
exportsRouter.get("/gerpi/:id/passport.pdf", ah(async (req, res) => {
  if (!(await canViewGerpi(req.user, req.params.id))) return fail(res, 403, "Ruxsat yo'q");
  const org = await db("gerpi_organizations")
    .leftJoin("ministries", "gerpi_organizations.ministry_id", "ministries.id")
    .leftJoin("donors", "gerpi_organizations.donor_id", "donors.id")
    .where("gerpi_organizations.id", req.params.id)
    .select("gerpi_organizations.*", "ministries.name_uz_latn as ministry_name", "donors.name as donor_name", "donors.short_name as donor_short")
    .first();
  if (!org) return fail(res, 404, "GERPI topilmadi");

  const [components, reports, regions, alerts] = await Promise.all([
    db("components").where({ gerpi_id: org.id }).whereNull("deleted_at"),
    db("disbursement_reports").where({ gerpi_id: org.id })
      .whereIn("status", ["topshirilgan", "tasdiqlangan"])
      .orderBy([{ column: "year", order: "desc" }, { column: "quarter", order: "desc" }]).limit(8),
    db("gerpi_regions").join("regions", "gerpi_regions.region_id", "regions.id")
      .where("gerpi_regions.gerpi_id", org.id).select("regions.name_uz_latn"),
    db("alerts").where({ gerpi_id: org.id, is_resolved: false }).whereNull("deleted_at"),
  ]);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="gerpi-passport.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(res);

  let y = pdfHeader(doc, "GERPI pasporti", org.name_uz_latn);

  const info = [
    ["Vazirlik", org.ministry_name],
    ["Donor", `${org.donor_name} (${org.donor_short})`],
    ["Bitim", `${org.agreement_number || "—"} / ${org.agreement_date || "—"}`],
    ["Byudjet", money(org.budget_total_usd)],
    ["Davr", `${org.start_year || "—"} – ${org.end_year || "—"} (yopilish: ${org.closing_date || "—"})`],
    ["Holat", STATUS_LABEL[org.status]],
    ["Risk darajasi", `${RISK_LABEL[org.risk_level]} (${org.risk_score} ball)`],
    ["Hududlar", regions.map((r) => r.name_uz_latn).join(", ") || "—"],
    ["Direktor", `${org.director_name || "—"} ${org.director_phone || ""}`],
    ["Ochiq ogohlantirishlar", String(alerts.length)],
  ];
  for (const [k, v] of info) {
    doc.font("Helvetica-Bold").fontSize(9).fill("#5a6b7e").text(k, 40, y, { width: 140 });
    doc.font("Helvetica").fontSize(9).fill("#15202b").text(String(v ?? "—"), 190, y, { width: 360 });
    y += 18;
  }

  y += 10;
  doc.font("Helvetica-Bold").fontSize(11).fill("#0e2a47").text("O'zlashtirish tarixi (oxirgi choraklar)", 40, y);
  y += 18;
  const w1 = [80, 110, 80, 80];
  pdfRow(doc, y, ["Chorak", "O'zlashtirilgan", "Fakt %", "Reja %"], w1, { bold: true });
  y += 14;
  for (const r of reports) {
    pdfRow(doc, y, [quarterLabel(r.year, r.quarter), money(r.disbursed_usd_cumulative),
      `${Number(r.disbursed_pct).toFixed(1)}%`, `${Number(r.planned_pct).toFixed(1)}%`], w1);
    y += 14;
  }

  y += 12;
  doc.font("Helvetica-Bold").fontSize(11).fill("#0e2a47").text("Tarkibiy komponentlar", 40, y);
  y += 18;
  const w2 = [240, 90, 60, 60];
  pdfRow(doc, y, ["Komponent", "Byudjet", "Fakt %", "Reja %"], w2, { bold: true });
  y += 14;
  for (const c of components) {
    if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
    pdfRow(doc, y, [c.name, money(c.budget_usd), `${c.progress_pct}%`, `${c.planned_progress_pct}%`], w2);
    y += 14;
  }

  await writeAudit(req, "export", "gerpi_organizations", `passport:${org.id}`);
  doc.end();
}));
