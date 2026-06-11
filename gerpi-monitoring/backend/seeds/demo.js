/**
 * Demo ma'lumotlar (10-bo'lim, master prompt):
 *  - 14 GERPI, 14 hudud, 8 vazirlik, 8 donor
 *  - Har GERPI uchun 2023-Q1 dan 2026-Q1 gacha 13 choraklik o'zlashtirish tarixi
 *  - 5 demo foydalanuvchi (har rol uchun bittadan) — parollar README'da
 *  - kpi_snapshots tarixiy trend + qoidalar dvigateli orqali avtomatik alertlar
 */
import bcrypt from "bcryptjs";

const uuid = () => globalThis.crypto.randomUUID();

// Deterministik "tasodifiy" (seed barqarorligi uchun)
const wiggle = (i, j) => ((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1 + 1) % 1;

const REGIONS = [
  ["Qoraqalpog'iston Respublikasi", "Қорақалпоғистон Республикаси", "Республика Каракалпакстан", "Republic of Karakalpakstan", "karakalpakstan", "1735"],
  ["Andijon viloyati", "Андижон вилояти", "Андижанская область", "Andijan region", "andijan", "1703"],
  ["Buxoro viloyati", "Бухоро вилояти", "Бухарская область", "Bukhara region", "bukhara", "1706"],
  ["Farg'ona viloyati", "Фарғона вилояти", "Ферганская область", "Fergana region", "fergana", "1730"],
  ["Jizzax viloyati", "Жиззах вилояти", "Джизакская область", "Jizzakh region", "jizzakh", "1708"],
  ["Namangan viloyati", "Наманган вилояти", "Наманганская область", "Namangan region", "namangan", "1714"],
  ["Navoiy viloyati", "Навоий вилояти", "Навоийская область", "Navoiy region", "navoiy", "1712"],
  ["Qashqadaryo viloyati", "Қашқадарё вилояти", "Кашкадарьинская область", "Kashkadarya region", "qashqadaryo", "1710"],
  ["Samarqand viloyati", "Самарқанд вилояти", "Самаркандская область", "Samarkand region", "samarqand", "1718"],
  ["Sirdaryo viloyati", "Сирдарё вилояти", "Сырдарьинская область", "Sirdarya region", "sirdaryo", "1724"],
  ["Surxondaryo viloyati", "Сурхондарё вилояти", "Сурхандарьинская область", "Surkhandarya region", "surxondaryo", "1722"],
  ["Toshkent viloyati", "Тошкент вилояти", "Ташкентская область", "Tashkent region", "tashkent", "1727"],
  ["Toshkent shahri", "Тошкент шаҳри", "город Ташкент", "Tashkent city", "tashkent-city", "1726"],
  ["Xorazm viloyati", "Хоразм вилояти", "Хорезмская область", "Khorezm region", "xorazm", "1733"],
];

const MINISTRIES = [
  ["Qishloq xo'jaligi vazirligi", "Қишлоқ хўжалиги вазирлиги", "Министерство сельского хозяйства", "Ministry of Agriculture", "AGR"],
  ["Transport vazirligi", "Транспорт вазирлиги", "Министерство транспорта", "Ministry of Transport", "TRN"],
  ["Energetika vazirligi", "Энергетика вазирлиги", "Министерство энергетики", "Ministry of Energy", "ENG"],
  ["Suv xo'jaligi vazirligi", "Сув хўжалиги вазирлиги", "Министерство водного хозяйства", "Ministry of Water Resources", "WTR"],
  ["Sog'liqni saqlash vazirligi", "Соғлиқни сақлаш вазирлиги", "Министерство здравоохранения", "Ministry of Health", "HLT"],
  ["Maktabgacha va maktab ta'limi vazirligi", "Мактабгача ва мактаб таълими вазирлиги", "Министерство дошкольного и школьного образования", "Ministry of Preschool and School Education", "EDU"],
  ["Raqamli texnologiyalar vazirligi", "Рақамли технологиялар вазирлиги", "Министерство цифровых технологий", "Ministry of Digital Technologies", "ICT"],
  ["Kambag'allikni qisqartirish va bandlik vazirligi", "Камбағалликни қисқартириш ва бандлик вазирлиги", "Министерство занятости и сокращения бедности", "Ministry of Employment and Poverty Reduction", "EMP"],
];

const DONORS = [
  ["Jahon banki", "WB", "USA"],
  ["Osiyo taraqqiyot banki", "ADB", "Philippines"],
  ["Osiyo infratuzilma investitsiyalari banki", "AIIB", "China"],
  ["Islom taraqqiyot banki", "IsDB", "Saudi Arabia"],
  ["Qishloq xo'jaligini rivojlantirish xalqaro jamg'armasi", "IFAD", "Italy"],
  ["Yevropa tiklanish va taraqqiyot banki", "EBRD", "UK"],
  ["Fransiya taraqqiyot agentligi", "AFD", "France"],
  ["Yaponiya xalqaro hamkorlik agentligi", "JICA", "Japan"],
];

/**
 * 14 GERPI: [nomi(uz), nomi(ru), nomi(en), vazirlik kodi, donor, byudjet $M,
 *  start, end, yopilish, holat, reja% (2026-Q1), fakt% (2026-Q1), hududlar(geojson_id), bayroqlar]
 */
const ORGS = [
  {
    name: "Qishloq xo'jaligini modernizatsiya qilish loyihasi GERPI",
    name_ru: "ГРПИ «Модернизация сельского хозяйства»", name_en: "Agriculture Modernization Project PIU",
    ministry: "AGR", donor: "WB", budget: 500, start: 2022, end: 2027, closing: "2027-12-31",
    status: "faol", planned: 62, fact: 58, regions: ["samarqand", "jizzakh", "qashqadaryo", "surxondaryo"],
    director: "A. Karimov", phone: "+998 71 200-11-01",
    reportsFrom: { y: 2023, q: 1 }, lastStatus: "topshirilgan", // demo: MoF tasdiqlashi uchun
  },
  {
    name: "Toshkent metropolitenini kengaytirish loyihasi GERPI",
    name_ru: "ГРПИ «Расширение Ташкентского метрополитена»", name_en: "Tashkent Metro Expansion PIU",
    ministry: "TRN", donor: "ADB", budget: 400, start: 2022, end: 2028, closing: "2028-06-30",
    status: "faol", planned: 48, fact: 45, regions: ["tashkent-city"],
    director: "B. Tashpulatov", phone: "+998 71 200-11-02",
    reportsFrom: { y: 2023, q: 1 },
  },
  {
    name: "Energiya samaradorligi va ta'minoti dasturi GERPI",
    name_ru: "ГРПИ «Программа энергоэффективности»", name_en: "Energy Efficiency Program PIU",
    ministry: "ENG", donor: "WB", budget: 380, start: 2022, end: 2027, closing: "2027-09-30",
    status: "faol", planned: 58, fact: 56, regions: ["tashkent", "navoiy", "bukhara"],
    director: "D. Yusupova", phone: "+998 71 200-11-03",
    reportsFrom: { y: 2023, q: 1 },
  },
  {
    name: "Suv resurslarini boshqarish milliy loyihasi GERPI",
    name_ru: "ГРПИ «Управление водными ресурсами»", name_en: "Water Resources Management PIU",
    ministry: "WTR", donor: "IsDB", budget: 250, start: 2023, end: 2028, closing: "2028-03-31",
    status: "faol", planned: 40, fact: 37, regions: ["karakalpakstan", "xorazm", "bukhara"],
    director: "E. Rahmatov", phone: "+998 71 200-11-04",
    reportsFrom: { y: 2023, q: 1 },
  },
  {
    name: "Sog'liqni saqlash tizimini rivojlantirish GERPI",
    name_ru: "ГРПИ «Развитие системы здравоохранения»", name_en: "Health System Development PIU",
    ministry: "HLT", donor: "WB", budget: 300, start: 2022, end: 2027, closing: "2027-06-30",
    status: "faol", planned: 55, fact: 50, regions: ["tashkent-city", "samarqand", "fergana", "andijan"],
    director: "F. Nazarova", phone: "+998 71 200-11-05",
    reportsFrom: { y: 2023, q: 1 }, auditFinding: true, // R5
  },
  {
    name: "Umumiy o'rta ta'limni rivojlantirish loyihasi GERPI",
    name_ru: "ГРПИ «Развитие школьного образования»", name_en: "School Education Development PIU",
    ministry: "EDU", donor: "ADB", budget: 220, start: 2023, end: 2027, closing: "2027-12-31",
    status: "faol", planned: 44, fact: 42, regions: ["namangan", "andijan", "fergana"],
    director: "G. Sobirova", phone: "+998 71 200-11-06",
    reportsFrom: { y: 2023, q: 2 },
  },
  {
    name: "Qishloq hududlari infratuzilmasini rivojlantirish GERPI",
    name_ru: "ГРПИ «Развитие сельской инфраструктуры»", name_en: "Rural Infrastructure Development PIU",
    ministry: "AGR", donor: "IFAD", budget: 150, start: 2023, end: 2027, closing: "2027-03-31",
    status: "faol", planned: 50, fact: 47, regions: ["surxondaryo", "qashqadaryo", "jizzakh"],
    director: "H. Ismoilov", phone: "+998 71 200-11-07",
    reportsFrom: { y: 2023, q: 1 },
  },
  {
    name: "Issiqxona gazlari emissiyasini kamaytirish dasturi GERPI",
    name_ru: "ГРПИ «Снижение выбросов парниковых газов»", name_en: "GHG Emission Reduction Program PIU",
    ministry: "ENG", donor: "EBRD", budget: 180, start: 2022, end: 2027, closing: "2027-06-30",
    status: "kechikayotgan", planned: 60, fact: 41, regions: ["navoiy", "qashqadaryo"], // R1: gap 19%
    director: "I. Qodirov", phone: "+998 71 200-11-08",
    reportsFrom: { y: 2023, q: 1 }, noAnnualPlan: true, // R6
  },
  {
    name: "Raqamli iqtisodiyotni rivojlantirish loyihasi GERPI",
    name_ru: "ГРПИ «Развитие цифровой экономики»", name_en: "Digital Economy Development PIU",
    ministry: "ICT", donor: "AIIB", budget: 160, start: 2023, end: 2027, closing: "2027-12-31",
    status: "faol", planned: 46, fact: 44, regions: ["tashkent-city", "tashkent", "samarqand"],
    director: "J. Abdullayev", phone: "+998 71 200-11-09",
    reportsFrom: { y: 2023, q: 3 },
  },
  {
    name: "Avtomobil yo'llarini rekonstruksiya qilish GERPI",
    name_ru: "ГРПИ «Реконструкция автомобильных дорог»", name_en: "Road Reconstruction PIU",
    ministry: "TRN", donor: "AIIB", budget: 280, start: 2022, end: 2027, closing: "2027-09-30",
    status: "kechikayotgan", planned: 56, fact: 40, regions: ["sirdaryo", "jizzakh", "samarqand"],
    director: "K. Mirzayev", phone: "+998 71 200-11-10",
    reportsFrom: { y: 2023, q: 1 }, missLastReport: true, noAnnualPlan: true, // R2 + R6
  },
  {
    name: "Ichimlik suvi ta'minotini yaxshilash loyihasi GERPI",
    name_ru: "ГРПИ «Улучшение питьевого водоснабжения»", name_en: "Drinking Water Supply Improvement PIU",
    ministry: "WTR", donor: "IsDB", budget: 120, start: 2021, end: 2026, closing: "2026-09-30",
    status: "kechikayotgan", planned: 72, fact: 55, regions: ["karakalpakstan", "xorazm"], // R3: yopilishga <6 oy, <60%
    director: "L. Saidova", phone: "+998 71 200-11-11",
    reportsFrom: { y: 2023, q: 1 },
  },
  {
    name: "Kasb-hunar ta'limi tizimini transformatsiya qilish GERPI",
    name_ru: "ГРПИ «Трансформация профессионального образования»", name_en: "Vocational Education Transformation PIU",
    ministry: "EMP", donor: "EBRD", budget: 90, start: 2024, end: 2028, closing: "2028-12-31",
    status: "tayyorgarlik", planned: 0, fact: 0, regions: ["bukhara", "navoiy"],
    director: "M. To'rayev", phone: "+998 71 200-11-12",
    reportsFrom: null, agreement_date: "2024-09-15", // R7: 18 oydan oshgan tayyorgarlik
  },
  {
    name: "Farg'ona vodiysi suv xo'jaligini rivojlantirish GERPI",
    name_ru: "ГРПИ «Развитие водного хозяйства Ферганской долины»", name_en: "Fergana Valley Water Management PIU",
    ministry: "WTR", donor: "WB", budget: 145, start: 2022, end: 2027, closing: "2027-03-31",
    status: "faol", planned: 54, fact: 51, regions: ["fergana", "namangan", "andijan"],
    director: "N. Hakimov", phone: "+998 71 200-11-13",
    reportsFrom: { y: 2023, q: 1 }, cancelledTender: true, // R4
  },
  {
    name: "Onkologiya xizmatini rivojlantirish loyihasi GERPI",
    name_ru: "ГРПИ «Развитие онкологической службы»", name_en: "Oncology Service Development PIU",
    ministry: "HLT", donor: "JICA", budget: 75, start: 2020, end: 2025, closing: "2025-06-30",
    status: "yakunlangan", planned: 100, fact: 100, regions: ["tashkent-city"],
    director: "O. Yo'ldosheva", phone: "+998 71 200-11-14",
    reportsFrom: { y: 2023, q: 1 }, reportsTo: { y: 2025, q: 2 },
  },
];

const QUARTERS = [];
for (let y = 2023; y <= 2026; y++) {
  for (let q = 1; q <= 4; q++) {
    if (y === 2026 && q > 1) break;
    QUARTERS.push({ y, q });
  }
}

export async function seed(knex) {
  // Tozalash (FK tartibida)
  for (const t of ["kpi_snapshots", "audit_log", "alerts", "documents", "procurement_records",
    "disbursement_reports", "components", "gerpi_regions", "refresh_tokens", "users",
    "gerpi_organizations", "regions", "donors", "ministries"]) {
    await knex(t).del();
  }

  /* --- Spravochniklar --- */
  const regionIds = {};
  for (const [latn, cyrl, ru, en, gid, soato] of REGIONS) {
    const id = uuid();
    regionIds[gid] = id;
    await knex("regions").insert({ id, name_uz_latn: latn, name_uz_cyrl: cyrl, name_ru: ru, name_en: en, geojson_id: gid, soato_code: soato });
  }
  const ministryIds = {};
  for (const [latn, cyrl, ru, en, code] of MINISTRIES) {
    const id = uuid();
    ministryIds[code] = id;
    await knex("ministries").insert({ id, name_uz_latn: latn, name_uz_cyrl: cyrl, name_ru: ru, name_en: en, code });
  }
  const donorIds = {};
  for (const [name, short, country] of DONORS) {
    const id = uuid();
    donorIds[short] = id;
    await knex("donors").insert({ id, name, short_name: short, country });
  }

  /* --- GERPI tashkilotlari + tarix --- */
  const orgIds = [];
  for (let i = 0; i < ORGS.length; i++) {
    const o = ORGS[i];
    const id = uuid();
    orgIds.push(id);
    const budgetUsd = o.budget * 1_000_000;
    await knex("gerpi_organizations").insert({
      id,
      name_uz_latn: o.name,
      name_uz_cyrl: o.name, // demo: kirill varianti keyin to'ldiriladi
      name_ru: o.name_ru,
      name_en: o.name_en,
      ministry_id: ministryIds[o.ministry],
      donor_id: donorIds[o.donor],
      agreement_number: `UZB-${o.donor}-${2000 + i + 1}`,
      agreement_date: o.agreement_date || `${o.start}-03-15`,
      budget_total_usd: budgetUsd,
      start_year: o.start,
      end_year: o.end,
      closing_date: o.closing,
      status: o.status,
      director_name: o.director,
      director_phone: o.phone,
      address: "Toshkent sh., Istiqbol ko'chasi, 21",
    });

    for (const gid of o.regions) {
      await knex("gerpi_regions").insert({ id: uuid(), gerpi_id: id, region_id: regionIds[gid] });
    }

    /* Choraklik hisobotlar: reportsFrom..(reportsTo|2026-Q1) */
    if (o.reportsFrom) {
      const list = QUARTERS.filter(({ y, q }) => {
        if (y < o.reportsFrom.y || (y === o.reportsFrom.y && q < o.reportsFrom.q)) return false;
        if (o.reportsTo && (y > o.reportsTo.y || (y === o.reportsTo.y && q > o.reportsTo.q))) return false;
        return true;
      });
      const n = list.length;
      let prevFact = 0;
      for (let j = 0; j < n; j++) {
        const { y, q } = list[j];
        const isLast = j === n - 1;
        if (isLast && o.missLastReport) continue; // R2: oxirgi hisobot topshirilmagan
        const tt = n === 1 ? 1 : (j + 1) / n;
        const planned = Math.round(o.planned * tt * 10) / 10;
        let fact = o.fact * tt * (0.92 + 0.16 * wiggle(i, j));
        fact = Math.max(prevFact, Math.min(o.fact, Math.round(fact * 10) / 10));
        if (isLast) fact = o.fact;
        prevFact = fact;
        const status = isLast && o.lastStatus ? o.lastStatus : "tasdiqlangan";
        const gap = planned - fact;
        await knex("disbursement_reports").insert({
          id: uuid(),
          gerpi_id: id,
          year: y,
          quarter: q,
          disbursed_usd_cumulative: Math.round(budgetUsd * fact / 100),
          disbursed_pct: fact,
          planned_pct: planned,
          commitment_usd: Math.round(budgetUsd * Math.min(100, fact + 8) / 100),
          narrative: gap > 10
            ? `Reja bilan farq ${gap.toFixed(1)}% ni tashkil etdi. Asosiy sabablar: pudratchi tanlovidagi kechikishlar, mavsumiy ishlarning siljishi hamda hamkor tashkilotlar bilan kelishuvlarning cho'zilishi. Tezlashtirish choralari ishlab chiqilgan.`
            : `${y}-yil ${q}-chorak bo'yicha o'zlashtirish reja asosida bormoqda.`,
          status,
          submitted_at: knex.fn.now(),
          created_at: `${y}-${String(q * 3).padStart(2, "0")}-28`,
        });
      }
    }

    /* Komponentlar */
    const compCount = 2 + (i % 3);
    for (let c = 0; c < compCount; c++) {
      const plannedP = Math.min(100, Math.round(o.planned + 10 - c * 5));
      await knex("components").insert({
        id: uuid(),
        gerpi_id: id,
        name: `${c + 1}-komponent: ${["Infratuzilma qurilishi", "Texnik yordam va salohiyat", "Uskunalar yetkazib berish", "Monitoring va baholash"][c]}`,
        budget_usd: Math.round(budgetUsd / compCount),
        progress_pct: Math.max(0, Math.min(100, Math.round(o.fact + 8 - c * 6))),
        planned_progress_pct: Math.max(0, plannedP),
        start_date: `${o.start}-06-01`,
        end_date: `${o.end}-06-01`,
        responsible_person: o.director,
      });
    }

    /* Xaridlar */
    await knex("procurement_records").insert({
      id: uuid(), gerpi_id: id,
      title: "Qurilish ishlari bo'yicha bosh pudrat", method: "ICB",
      estimated_usd: Math.round(budgetUsd * 0.3),
      contract_usd: o.status === "tayyorgarlik" ? null : Math.round(budgetUsd * 0.28),
      status: o.status === "tayyorgarlik" ? "rejalashtirilgan" : "imzolangan",
      announced_date: `${o.start + 1}-02-10`,
      contract_date: o.status === "tayyorgarlik" ? null : `${o.start + 1}-07-20`,
      supplier: o.status === "tayyorgarlik" ? null : "Konsorsium UzbuildPro",
    });
    if (o.cancelledTender) {
      await knex("procurement_records").insert({
        id: uuid(), gerpi_id: id,
        title: "Nasos stansiyalari uchun uskunalar yetkazib berish", method: "NCB",
        estimated_usd: 4_500_000, status: "bekor_qilingan", cancel_count: 2,
        announced_date: "2025-11-05",
      });
    }

    /* Hujjatlar (metadata, demo fayllarsiz) */
    if (!o.noAnnualPlan && o.status !== "yakunlangan") {
      await knex("documents").insert({
        id: uuid(), gerpi_id: id, type: "yillik_reja",
        title: `${o.name.split(" GERPI")[0]} — 2026-yillik ish rejasi`,
        period_year: 2026,
      });
    }
    if (o.auditFinding) {
      await knex("documents").insert({
        id: uuid(), gerpi_id: id, type: "audit_hisoboti",
        title: "2025-yil moliyaviy auditi hisoboti (nomuvofiqliklar bilan)",
        period_year: 2025, has_findings: true,
      });
    }
  }

  /* --- Foydalanuvchilar (parollar README.md da) --- */
  const hash = (p) => bcrypt.hash(p, 12);
  const users = [
    ["Tizim administratori", "admin@gerpi.uz", "admin", "Admin2026!", {}],
    ["IMV bosh nazoratchisi", "nazoratchi@imv.uz", "mof_supervisor", "Nazorat2026!", {}],
    ["Transport vazirligi mas'uli", "masul@transport.uz", "ministry_officer", "Vazirlik2026!", { ministry_id: ministryIds.TRN }],
    ["GERPI monitoring mutaxassisi", "monitoring@agro-piu.uz", "gerpi_staff", "Gerpi2026!", { gerpi_id: orgIds[0] }],
    ["Jahon banki vakili", "viewer@worldbank.org", "donor_viewer", "Donor2026!", { donor_id: donorIds.WB }],
  ];
  for (const [full_name, email, role, password, extra] of users) {
    await knex("users").insert({
      id: uuid(), full_name, email, role,
      password_hash: await hash(password),
      locale: "uz_latn", is_active: true, ...extra,
    });
  }

  /* --- KPI snapshotlar (tarixiy trend) --- */
  const allReports = await knex("disbursement_reports").where("status", "tasdiqlangan");
  const allOrgs = await knex("gerpi_organizations");
  const totalBudget = allOrgs.reduce((s, o) => s + Number(o.budget_total_usd), 0);
  for (const { y, q } of QUARTERS) {
    const inQ = allReports.filter((r) => r.year === y && r.quarter === q);
    if (!inQ.length) continue;
    await knex("kpi_snapshots").insert({
      id: uuid(), year: y, quarter: q,
      total_gerpi: allOrgs.length,
      active_gerpi: inQ.length,
      total_budget_usd: totalBudget,
      total_disbursed_usd: inQ.reduce((s, r) => s + Number(r.disbursed_usd_cumulative), 0),
      avg_disbursement_pct: Math.round(inQ.reduce((s, r) => s + Number(r.disbursed_pct), 0) / inQ.length * 100) / 100,
      high_risk_count: 0,
      snapshot_json: JSON.stringify({ report_count: inQ.length }),
    });
  }

  /* --- Qoidalar dvigateli: risk ballari + avtomatik alertlar --- */
  const { runAlertEngine } = await import("../src/services/alertEngine.js");
  const created = await runAlertEngine();
  // Yakuniy snapshot yuqori risk soni bilan yangilanadi
  const { takeKpiSnapshot } = await import("../src/services/snapshots.js");
  await takeKpiSnapshot(2026, 1);
  console.log(`✓ Seed tayyor: ${allOrgs.length} GERPI, ${allReports.length} hisobot, ${created.length} avtomatik alert`);
}
