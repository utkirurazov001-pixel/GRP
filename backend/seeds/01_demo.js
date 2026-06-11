/**
 * Demo seed — presentation-ready dataset.
 * 14 GERPI organizations (~$3.2B portfolio), 13 quarters of disbursement
 * history (2023-Q1 … 2026-Q1), components, alerts and 5 demo users
 * (one per role). Demo credentials are listed in README.md.
 */
const bcrypt = require('bcryptjs');

const MINISTRIES = [
  { code: 'MWR', latn: "Suv xo'jaligi vazirligi", cyrl: 'Сув хўжалиги вазирлиги', ru: 'Министерство водного хозяйства', en: 'Ministry of Water Resources' },
  { code: 'MOE', latn: 'Energetika vazirligi', cyrl: 'Энергетика вазирлиги', ru: 'Министерство энергетики', en: 'Ministry of Energy' },
  { code: 'MOT', latn: 'Transport vazirligi', cyrl: 'Транспорт вазирлиги', ru: 'Министерство транспорта', en: 'Ministry of Transport' },
  { code: 'MOA', latn: "Qishloq xo'jaligi vazirligi", cyrl: 'Қишлоқ хўжалиги вазирлиги', ru: 'Министерство сельского хозяйства', en: 'Ministry of Agriculture' },
  { code: 'MOH', latn: "Sog'liqni saqlash vazirligi", cyrl: 'Соғлиқни сақлаш вазирлиги', ru: 'Министерство здравоохранения', en: 'Ministry of Health' },
  { code: 'MPSE', latn: "Maktabgacha va maktab ta'limi vazirligi", cyrl: 'Мактабгача ва мактаб таълими вазирлиги', ru: 'Министерство дошкольного и школьного образования', en: 'Ministry of Preschool and School Education' },
  { code: 'MOF', latn: 'Iqtisodiyot va moliya vazirligi', cyrl: 'Иқтисодиёт ва молия вазирлиги', ru: 'Министерство экономики и финансов', en: 'Ministry of Economy and Finance' },
  { code: 'MDT', latn: 'Raqamli texnologiyalar vazirligi', cyrl: 'Рақамли технологиялар вазирлиги', ru: 'Министерство цифровых технологий', en: 'Ministry of Digital Technologies' },
];

const DONORS = [
  { short: 'WB', name: 'World Bank', country: 'USA' },
  { short: 'ADB', name: 'Asian Development Bank', country: 'Philippines' },
  { short: 'AIIB', name: 'Asian Infrastructure Investment Bank', country: 'China' },
  { short: 'IsDB', name: 'Islamic Development Bank', country: 'Saudi Arabia' },
  { short: 'IFAD', name: 'International Fund for Agricultural Development', country: 'Italy' },
  { short: 'EBRD', name: 'European Bank for Reconstruction and Development', country: 'UK' },
  { short: 'JICA', name: 'Japan International Cooperation Agency', country: 'Japan' },
  { short: 'AFD', name: 'Agence Française de Développement', country: 'France' },
];

const REGIONS = [
  { latn: "Qoraqalpog'iston R.", cyrl: 'Қорақалпоғистон Р.', ru: 'Республика Каракалпакстан', en: 'Republic of Karakalpakstan', geo: 'UZ-QR', soato: '1735' },
  { latn: 'Andijon', cyrl: 'Андижон', ru: 'Андижанская обл.', en: 'Andijan', geo: 'UZ-AN', soato: '1703' },
  { latn: 'Buxoro', cyrl: 'Бухоро', ru: 'Бухарская обл.', en: 'Bukhara', geo: 'UZ-BU', soato: '1706' },
  { latn: 'Jizzax', cyrl: 'Жиззах', ru: 'Джизакская обл.', en: 'Jizzakh', geo: 'UZ-JI', soato: '1708' },
  { latn: 'Qashqadaryo', cyrl: 'Қашқадарё', ru: 'Кашкадарьинская обл.', en: 'Kashkadarya', geo: 'UZ-QA', soato: '1710' },
  { latn: 'Navoiy', cyrl: 'Навоий', ru: 'Навоийская обл.', en: 'Navoi', geo: 'UZ-NW', soato: '1712' },
  { latn: 'Namangan', cyrl: 'Наманган', ru: 'Наманганская обл.', en: 'Namangan', geo: 'UZ-NG', soato: '1714' },
  { latn: 'Samarqand', cyrl: 'Самарқанд', ru: 'Самаркандская обл.', en: 'Samarkand', geo: 'UZ-SA', soato: '1718' },
  { latn: 'Surxondaryo', cyrl: 'Сурхондарё', ru: 'Сурхандарьинская обл.', en: 'Surkhandarya', geo: 'UZ-SU', soato: '1722' },
  { latn: 'Sirdaryo', cyrl: 'Сирдарё', ru: 'Сырдарьинская обл.', en: 'Syrdarya', geo: 'UZ-SI', soato: '1724' },
  { latn: 'Toshkent vil.', cyrl: 'Тошкент вил.', ru: 'Ташкентская обл.', en: 'Tashkent region', geo: 'UZ-TO', soato: '1727' },
  { latn: "Farg'ona", cyrl: 'Фарғона', ru: 'Ферганская обл.', en: 'Fergana', geo: 'UZ-FA', soato: '1730' },
  { latn: 'Xorazm', cyrl: 'Хоразм', ru: 'Хорезмская обл.', en: 'Khorezm', geo: 'UZ-XO', soato: '1733' },
  { latn: 'Toshkent sh.', cyrl: 'Тошкент ш.', ru: 'г. Ташкент', en: 'Tashkent city', geo: 'UZ-TK', soato: '1726' },
];

// disbursed = current cumulative %, planned = contract schedule %.
// risk is pre-computed per the section-6 formula (engine itself lands in phase 3).
const GERPIS = [
  {
    latn: "Suv ta'minoti va kanalizatsiya tizimlarini rivojlantirish GERPI", cyrl: 'Сув таъминоти ва канализация тизимларини ривожлантириш ГЕРПИ',
    ru: 'ГРП развития систем водоснабжения и канализации', en: 'PIU for Water Supply and Sewerage Development',
    ministry: 'MWR', donor: 'WB', budget: 450_000_000, start: 2021, end: 2027, status: 'faol',
    disbursed: 58, planned: 64, risk: 'orta', agreement: 'UZB-WB-2021-014',
    regions: ['Qoraqalpog\'iston R.', 'Xorazm', 'Buxoro', 'Navoiy'],
    director: 'A. Karimov', phone: '+998 71 200-11-01',
  },
  {
    latn: "Energetika tarmog'ini modernizatsiya qilish GERPI", cyrl: 'Энергетика тармоғини модернизация қилиш ГЕРПИ',
    ru: 'ГРП модернизации энергетической сети', en: 'PIU for Power Grid Modernization',
    ministry: 'MOE', donor: 'ADB', budget: 380_000_000, start: 2022, end: 2027, status: 'faol',
    disbursed: 62, planned: 60, risk: 'past', agreement: 'UZB-ADB-2022-008',
    regions: ['Toshkent vil.', 'Sirdaryo', 'Jizzax'],
    director: 'B. Tursunov', phone: '+998 71 200-11-02',
  },
  {
    latn: 'Transport infratuzilmasini rivojlantirish GERPI', cyrl: 'Транспорт инфратузилмасини ривожлантириш ГЕРПИ',
    ru: 'ГРП развития транспортной инфраструктуры', en: 'PIU for Transport Infrastructure Development',
    ministry: 'MOT', donor: 'WB', budget: 320_000_000, start: 2021, end: 2026, status: 'kechikayotgan',
    disbursed: 34, planned: 58, risk: 'yuqori', agreement: 'UZB-WB-2021-021',
    regions: ['Qashqadaryo', 'Surxondaryo'],
    director: 'D. Raximov', phone: '+998 71 200-11-03',
  },
  {
    latn: "Qishloq xo'jaligini modernizatsiya qilish GERPI", cyrl: 'Қишлоқ хўжалигини модернизация қилиш ГЕРПИ',
    ru: 'ГРП модернизации сельского хозяйства', en: 'PIU for Agriculture Modernization',
    ministry: 'MOA', donor: 'IFAD', budget: 210_000_000, start: 2022, end: 2028, status: 'faol',
    disbursed: 51, planned: 55, risk: 'past', agreement: 'UZB-IFAD-2022-003',
    regions: ['Samarqand', 'Jizzax', 'Sirdaryo'],
    director: 'G. Yusupova', phone: '+998 71 200-11-04',
  },
  {
    latn: "Sog'liqni saqlash tizimini mustahkamlash GERPI", cyrl: 'Соғлиқни сақлаш тизимини мустаҳкамлаш ГЕРПИ',
    ru: 'ГРП укрепления системы здравоохранения', en: 'PIU for Health System Strengthening',
    ministry: 'MOH', donor: 'WB', budget: 250_000_000, start: 2021, end: 2026, status: 'faol',
    disbursed: 66, planned: 70, risk: 'past', agreement: 'UZB-WB-2021-030',
    regions: ['Toshkent sh.', 'Andijon', 'Namangan', "Farg'ona"],
    director: 'N. Saidova', phone: '+998 71 200-11-05',
  },
  {
    latn: "Maktab ta'limini rivojlantirish GERPI", cyrl: 'Мактаб таълимини ривожлантириш ГЕРПИ',
    ru: 'ГРП развития школьного образования', en: 'PIU for School Education Development',
    ministry: 'MPSE', donor: 'WB', budget: 180_000_000, start: 2022, end: 2027, status: 'faol',
    disbursed: 72, planned: 68, risk: 'past', agreement: 'UZB-WB-2022-011',
    regions: ['Toshkent sh.', 'Samarqand', 'Buxoro'],
    director: 'M. Abdullayeva', phone: '+998 71 200-11-06',
  },
  {
    latn: 'Issiqxona iqtisodiyoti va agroklaster GERPI', cyrl: 'Иссиқхона иқтисодиёти ва агрокластер ГЕРПИ',
    ru: 'ГРП тепличной экономики и агрокластеров', en: 'PIU for Greenhouse Economy and Agro-clusters',
    ministry: 'MOA', donor: 'EBRD', budget: 150_000_000, start: 2022, end: 2026, status: 'kechikayotgan',
    disbursed: 29, planned: 52, risk: 'yuqori', agreement: 'UZB-EBRD-2022-006',
    regions: ['Surxondaryo', 'Qashqadaryo', 'Samarqand'],
    director: 'S. Ergashev', phone: '+998 71 200-11-07',
  },
  {
    latn: 'Quyosh energetikasi GERPI', cyrl: 'Қуёш энергетикаси ГЕРПИ',
    ru: 'ГРП солнечной энергетики', en: 'PIU for Solar Energy',
    ministry: 'MOE', donor: 'AIIB', budget: 300_000_000, start: 2023, end: 2028, status: 'faol',
    disbursed: 47, planned: 45, risk: 'past', agreement: 'UZB-AIIB-2023-002',
    regions: ['Navoiy', 'Buxoro', 'Qashqadaryo'],
    director: 'J. Nazarov', phone: '+998 71 200-11-08',
  },
  {
    latn: "Ichki yo'llarni rekonstruksiya qilish GERPI", cyrl: 'Ички йўлларни реконструкция қилиш ГЕРПИ',
    ru: 'ГРП реконструкции внутренних дорог', en: 'PIU for Local Roads Reconstruction',
    ministry: 'MOT', donor: 'ADB', budget: 275_000_000, start: 2021, end: 2026, status: 'faol',
    disbursed: 55, planned: 63, risk: 'orta', agreement: 'UZB-ADB-2021-017',
    regions: ['Andijon', 'Namangan', "Farg'ona"],
    director: 'O. Mirzayev', phone: '+998 71 200-11-09',
  },
  {
    latn: 'Raqamli iqtisodiyotni rivojlantirish GERPI', cyrl: 'Рақамли иқтисодиётни ривожлантириш ГЕРПИ',
    ru: 'ГРП развития цифровой экономики', en: 'PIU for Digital Economy Development',
    ministry: 'MDT', donor: 'WB', budget: 140_000_000, start: 2025, end: 2030, status: 'tayyorgarlik',
    disbursed: 8, planned: 12, risk: 'past', agreement: 'UZB-WB-2025-004',
    regions: ['Toshkent sh.'],
    director: 'F. Xolmatov', phone: '+998 71 200-11-10',
  },
  {
    latn: 'Suv resurslarini boshqarish GERPI', cyrl: 'Сув ресурсларини бошқариш ГЕРПИ',
    ru: 'ГРП управления водными ресурсами', en: 'PIU for Water Resources Management',
    ministry: 'MWR', donor: 'IsDB', budget: 190_000_000, start: 2022, end: 2027, status: 'faol',
    disbursed: 49, planned: 57, risk: 'orta', agreement: 'UZB-ISDB-2022-009',
    regions: ['Xorazm', "Qoraqalpog'iston R."],
    director: 'T. Allanazarov', phone: '+998 71 200-11-11',
  },
  {
    latn: "Kasb-hunar ta'limi GERPI", cyrl: 'Касб-ҳунар таълими ГЕРПИ',
    ru: 'ГРП профессионального образования', en: 'PIU for Vocational Education',
    ministry: 'MPSE', donor: 'ADB', budget: 120_000_000, start: 2022, end: 2026, status: 'faol',
    disbursed: 61, planned: 65, risk: 'past', agreement: 'UZB-ADB-2022-013',
    regions: ['Toshkent vil.', 'Samarqand', 'Andijon'],
    director: 'L. Qodirova', phone: '+998 71 200-11-12',
  },
  {
    latn: 'Shahar transporti GERPI', cyrl: 'Шаҳар транспорти ГЕРПИ',
    ru: 'ГРП городского транспорта', en: 'PIU for Urban Transport',
    ministry: 'MOT', donor: 'JICA', budget: 220_000_000, start: 2021, end: 2027, status: 'faol',
    disbursed: 58, planned: 61, risk: 'past', agreement: 'UZB-JICA-2021-005',
    regions: ['Toshkent sh.', 'Toshkent vil.'],
    director: 'R. Sobirov', phone: '+998 71 200-11-13',
  },
  {
    latn: "Hududiy kichik biznesni qo'llab-quvvatlash GERPI", cyrl: 'Ҳудудий кичик бизнесни қўллаб-қувватлаш ГЕРПИ',
    ru: 'ГРП поддержки регионального малого бизнеса', en: 'PIU for Regional Small Business Support',
    ministry: 'MOF', donor: 'AFD', budget: 95_000_000, start: 2020, end: 2025, status: 'yakunlangan',
    disbursed: 97, planned: 100, risk: 'past', agreement: 'UZB-AFD-2020-002',
    regions: ['Jizzax', 'Sirdaryo', 'Navoiy'],
    director: 'Sh. Islomov', phone: '+998 71 200-11-14',
  },
];

const COMPONENT_TEMPLATES = [
  'Infratuzilmani qurish va rekonstruksiya',
  'Uskunalar yetkazib berish va o\'rnatish',
  'Institutsional salohiyatni oshirish',
  'Loyihani boshqarish va monitoring',
];

// 13 quarters: 2023-Q1 … 2026-Q1
const QUARTERS = [];
for (let y = 2023; y <= 2026; y++) {
  for (let q = 1; q <= 4; q++) {
    if (y === 2026 && q > 1) break;
    QUARTERS.push({ year: y, quarter: q });
  }
}

function buildHistory(g, gerpiId, staffUserId, mofUserId) {
  // Cumulative curve from a starting share of today's value up to the current pct.
  const startShare = g.start >= 2023 ? 0 : 0.25;
  const rows = [];
  const active = QUARTERS.filter((qt) => qt.year > g.start || g.start <= 2023);
  const n = active.length;
  active.forEach((qt, i) => {
    const frac = n === 1 ? 1 : i / (n - 1);
    const pct = Math.min(100, +(g.disbursed * (startShare + (1 - startShare) * frac)).toFixed(1));
    const planned = Math.min(100, +(g.planned * (startShare + (1 - startShare) * frac)).toFixed(1));
    const isLast = i === n - 1;
    rows.push({
      gerpi_id: gerpiId,
      year: qt.year,
      quarter: qt.quarter,
      disbursed_usd_cumulative: +(g.budget * pct / 100).toFixed(2),
      disbursed_pct: pct,
      disbursed_planned: planned,
      commitment_usd: +(g.budget * Math.min(100, pct + 8) / 100).toFixed(2),
      narrative: isLast && planned - pct > 10
        ? 'Reja bilan farq pudrat ishlarining kechikishi va tender jarayonlarining cho\'zilishi bilan izohlanadi. Tuzatish choralari: pudratchi bilan jadval qayta kelishildi, qo\'shimcha brigadalar jalb qilindi.'
        : 'Hisobot davri rejaga muvofiq yakunlandi.',
      status: isLast && g.status !== 'yakunlangan' ? 'topshirilgan' : 'tasdiqlangan',
      submitted_by: staffUserId,
      submitted_at: new Date(qt.year, qt.quarter * 3, 10),
      reviewed_by: isLast && g.status !== 'yakunlangan' ? null : mofUserId,
      reviewed_at: isLast && g.status !== 'yakunlangan' ? null : new Date(qt.year, qt.quarter * 3, 20),
    });
  });
  return rows;
}

exports.seed = async function (knex) {
  // Wipe in FK order
  for (const t of ['kpi_snapshots', 'audit_log', 'alerts', 'documents', 'procurement_records',
    'disbursement_reports', 'components', 'gerpi_regions', 'users', 'gerpi_organizations',
    'regions', 'donors', 'ministries']) {
    await knex(t).del();
  }

  const ministries = await knex('ministries').insert(MINISTRIES.map((m) => ({
    name_uz_latn: m.latn, name_uz_cyrl: m.cyrl, name_ru: m.ru, name_en: m.en, code: m.code,
  }))).returning(['id', 'code']);
  const minByCode = Object.fromEntries(ministries.map((m) => [m.code, m.id]));

  const donors = await knex('donors').insert(DONORS.map((d) => ({
    name: d.name, short_name: d.short, country: d.country,
  }))).returning(['id', 'short_name']);
  const donorByShort = Object.fromEntries(donors.map((d) => [d.short_name, d.id]));

  const regions = await knex('regions').insert(REGIONS.map((r) => ({
    name_uz_latn: r.latn, name_uz_cyrl: r.cyrl, name_ru: r.ru, name_en: r.en,
    geojson_id: r.geo, soato_code: r.soato,
  }))).returning(['id', 'name_uz_latn']);
  const regionByName = Object.fromEntries(regions.map((r) => [r.name_uz_latn, r.id]));

  const orgRows = [];
  for (const g of GERPIS) {
    const [org] = await knex('gerpi_organizations').insert({
      name_uz_latn: g.latn, name_uz_cyrl: g.cyrl, name_ru: g.ru, name_en: g.en,
      ministry_id: minByCode[g.ministry], donor_id: donorByShort[g.donor],
      agreement_number: g.agreement, agreement_date: `${g.start}-03-15`,
      budget_total_usd: g.budget, start_year: g.start, end_year: g.end,
      closing_date: `${g.end}-12-31`, status: g.status, risk_level: g.risk,
      director_name: g.director, director_phone: g.phone,
      address: 'Toshkent sh., Islom Karimov ko\'chasi, 45',
    }).returning('id');
    orgRows.push({ ...g, id: org.id });

    await knex('gerpi_regions').insert(g.regions.map((rn) => ({
      gerpi_id: org.id, region_id: regionByName[rn],
    })));
  }

  const hash = (p) => bcrypt.hashSync(p, 12);
  const firstOrg = orgRows[0];
  const users = await knex('users').insert([
    { full_name: 'Tizim administratori', email: 'admin@gerpi.uz', password_hash: hash('Admin2026!'), role: 'admin', locale: 'uz_latn' },
    { full_name: 'U. Urazov (IMV nazoratchi)', email: 'nazoratchi@imv.uz', password_hash: hash('Mof2026!'), role: 'mof_supervisor', locale: 'uz_latn' },
    { full_name: 'Vazirlik mas\'uli (Suv xo\'jaligi)', email: 'masul@suv.uz', password_hash: hash('Ministry2026!'), role: 'ministry_officer', ministry_id: minByCode.MWR, locale: 'uz_latn' },
    { full_name: 'GERPI monitoring mutaxassisi', email: 'monitoring@gerpi-suv.uz', password_hash: hash('Staff2026!'), role: 'gerpi_staff', gerpi_id: firstOrg.id, locale: 'uz_latn' },
    { full_name: 'Donor vakili (World Bank)', email: 'viewer@worldbank.org', password_hash: hash('Donor2026!'), role: 'donor_viewer', donor_id: donorByShort.WB, locale: 'en' },
  ]).returning(['id', 'role']);
  const userByRole = Object.fromEntries(users.map((u) => [u.role, u.id]));

  // Components: 4 per organization, budget split 40/30/20/10
  const split = [0.4, 0.3, 0.2, 0.1];
  const compRows = [];
  for (const g of orgRows) {
    COMPONENT_TEMPLATES.forEach((name, i) => {
      const jitter = (i * 7 - 10); // deterministic spread around org progress
      compRows.push({
        gerpi_id: g.id,
        name: `${i + 1}-komponent: ${name}`,
        budget_usd: +(g.budget * split[i]).toFixed(2),
        progress_pct: Math.max(0, Math.min(100, Math.round(g.disbursed + jitter))),
        planned_progress_pct: Math.max(0, Math.min(100, Math.round(g.planned + jitter))),
        start_date: `${g.start}-06-01`,
        end_date: `${g.end}-06-30`,
        responsible_person: g.director,
      });
    });
  }
  await knex('components').insert(compRows);

  // Disbursement history
  for (const g of orgRows) {
    const rows = buildHistory(g, g.id, userByRole.gerpi_staff, userByRole.mof_supervisor)
      .map(({ disbursed_planned, ...r }) => ({ ...r, planned_pct: disbursed_planned }));
    if (rows.length) await knex('disbursement_reports').insert(rows);
  }

  // Procurement examples (incl. a problematic one — 2x cancelled)
  await knex('procurement_records').insert([
    { gerpi_id: orgRows[2].id, title: 'Yo\'l qurilish ishlari — 4-lot (Qashqadaryo)', method: 'ICB', estimated_usd: 45_000_000, status: 'baholashda', cancel_count: 2, announced_date: '2025-11-10' },
    { gerpi_id: orgRows[6].id, title: 'Issiqxona uskunalari yetkazib berish', method: 'NCB', estimated_usd: 12_000_000, status: 'elon_qilingan', cancel_count: 1, announced_date: '2026-02-01' },
    { gerpi_id: orgRows[0].id, title: 'Suv tozalash inshooti qurilishi (Nukus)', method: 'ICB', estimated_usd: 60_000_000, contract_usd: 57_400_000, status: 'imzolangan', announced_date: '2024-05-20', contract_date: '2024-11-15', supplier: 'Aqua Build JV' },
    { gerpi_id: orgRows[7].id, title: '100 MVt quyosh stansiyasi EPC', method: 'QCBS', estimated_usd: 85_000_000, status: 'baholashda', announced_date: '2026-01-15' },
  ]);

  // Annual work plans for 2026 — uploaded for everyone except the Raqamli
  // iqtisodiyot GERPI, so rule R6 fires exactly once in the demo.
  await knex('documents').insert(orgRows
    .filter((g) => g.latn !== 'Raqamli iqtisodiyotni rivojlantirish GERPI')
    .map((g) => ({
      gerpi_id: g.id,
      type: 'yillik_reja',
      title: '2026-yillik ish rejasi',
      file_path: null,
      mime_type: 'application/pdf',
      period_year: 2026,
      uploaded_by: userByRole.gerpi_staff,
      due_date: '2026-02-01',
    })));

  // Alerts — 8, three severities (auto rules engine arrives in phase 3)
  const A = (g, severity, type, title, description, rule) => ({
    gerpi_id: g.id, severity, type, title, description, rule_code: rule, is_resolved: false,
  });
  await knex('alerts').insert([
    A(orgRows[2], 'yuqori', 'ozlashtirish_past', "O'zlashtirish 34% — grafikdan 24% ortda", 'Transport infratuzilmasi GERPI rejadan jiddiy ortda. Yopilishgacha 7 oy qoldi.', 'R1'),
    A(orgRows[6], 'yuqori', 'ozlashtirish_past', "O'zlashtirish 29% — grafikdan 23% ortda", 'Issiqxona GERPI bo\'yicha pudrat ishlari to\'xtab qolgan.', 'R1'),
    A(orgRows[2], 'yuqori', 'muddat_yaqin', 'Yopilishgacha 7 oy, o\'zlashtirish 60% dan past', 'Kredit muddatini uzaytirish masalasini donor bilan muhokama qilish zarur.', 'R3'),
    A(orgRows[2], 'orta', 'xarid_muammo', 'Tender 2 marta bekor qilingan', "Yo'l qurilish ishlari — 4-lot bo'yicha tender ikki marta bekor qilindi.", 'R4'),
    A(orgRows[10], 'orta', 'ozlashtirish_past', "O'zlashtirish 49% — grafikdan 8% ortda", 'Suv resurslari GERPI kuzatuv ostida.', 'R1'),
    A(orgRows[8], 'orta', 'hisobot_kechikkan', '2026-Q1 hisoboti 9 kun kechikdi', "Ichki yo'llar GERPI choraklik hisobotni muddatida topshirmadi.", 'R2'),
    A(orgRows[9], 'past', 'hujjat_kutilmoqda', '2026-yillik ish rejasi yuklanmagan', 'Raqamli iqtisodiyot GERPI yillik rejani 1-fevralgacha yuklashi kerak edi.', 'R6'),
    A(orgRows[4], 'past', 'eslatma', 'Donor missiyasi 2026-iyulda kutilmoqda', "Sog'liqni saqlash GERPI uchun World Bank kuzatuv missiyasiga tayyorgarlik ko'rish.", null),
  ]);

  // Historical KPI snapshots for trend continuity (rough aggregates)
  const totalBudget = GERPIS.reduce((s, g) => s + g.budget, 0);
  const snapRows = QUARTERS.slice(0, -1).map((qt, i) => {
    const frac = (i + 1) / QUARTERS.length;
    const avg = +(55 * (0.3 + 0.7 * frac)).toFixed(1);
    return {
      year: qt.year, quarter: qt.quarter,
      total_gerpi: 14, active_gerpi: qt.year < 2025 ? 12 : 10,
      total_budget_usd: totalBudget,
      total_disbursed_usd: +(totalBudget * avg / 100).toFixed(2),
      avg_disbursement_pct: avg,
      high_risk_count: qt.year >= 2025 ? 2 : 1,
    };
  });
  await knex('kpi_snapshots').insert(snapRows);
};
