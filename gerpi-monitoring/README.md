# GERPI Monitoring

**Loyihalarni amalga oshirish guruhlari (PIU) faoliyatini markazlashtirilgan nazorat qilish milliy platformasi.**

O'zbekiston Respublikasidagi barcha xalqaro donor loyihalarini amalga oshiruvchi GERPI (PIU)
tashkilotlari faoliyatini — byudjet, o'zlashtirish, muddatlar, risklar, hisobotlar — yagona
platformada real vaqtda nazorat qilish.

## Imkoniyatlar

- 📊 **Dashboard** — KPI kartalar, o'zlashtirish dinamikasi (tarixiy snapshotlardan), donor/vazirlik
  kesimi, risk matritsasi, eng yaxshi/eng yomon 5 reyting
- 🗂 **GERPI registri** — filtr, qidiruv, saralash, Excel/PDF eksport
- 🏛 **GERPI profili** — 7 tabli to'liq sahifa (umumiy, o'zlashtirish tarixi grafigi, komponentlar,
  xaridlar, hujjatlar, ogohlantirishlar, audit izi)
- 🗺 **Hududiy xarita** — O'zbekiston viloyatlari choropleth, hover tooltip, yon panel statistikasi
- 🔔 **Ogohlantirishlar** — avtomatik qoidalar dvigateli (R1–R7) + risk ball (0–100) + qo'lda kiritish,
  Socket.IO orqali jonli yangilanish, Telegram bildirishnoma (ixtiyoriy)
- 📝 **Ma'lumot kiritish (DCP-01..05)** — 3 qadamli choraklik hisobot wizard'i, workflow:
  qoralama → topshirilgan → tasdiqlangan/qaytarilgan, komponent progressi, xaridlar, hujjat yuklash
- 📄 **Tayyor hisobotlar** — choraklik yig'ma PDF, Excel registr, GERPI pasporti PDF
- 🔐 **Auth + RBAC** — JWT (access 15min + refresh rotation 7d), bcrypt(12), 5 rol
- 🧾 **Audit trail** — barcha mutatsiyalar audit jurnaliga yoziladi
- 🌐 **4 til** — o'zbek lotin, o'zbek kirill, rus, ingliz

## Ishga tushirish (bitta urinishda)

```bash
npm run setup   # backend deps + migratsiya + demo seed
npm run dev     # http://localhost:4000
```

Baza: `DATABASE_URL` o'rnatilmagan bo'lsa avtomatik **SQLite** (`backend/data/gerpi.sqlite`) —
hech qanday qo'shimcha sozlash kerak emas. Production uchun `.env` da PostgreSQL ulang:

```
DATABASE_URL=postgres://user:pass@host:5432/gerpi
```

`.env` namunasi: [`.env.example`](.env.example) (nusxalang: `cp .env.example backend/.env`).

## Demo foydalanuvchilar

| Rol | Email | Parol | Ko'rish doirasi |
|---|---|---|---|
| Administrator | `admin@gerpi.uz` | `Admin2026!` | Hammasi + spravochniklar |
| IMV nazoratchisi | `nazoratchi@imv.uz` | `Nazorat2026!` | Barcha GERPI, tasdiqlash, eksport |
| Vazirlik mas'uli | `masul@transport.uz` | `Vazirlik2026!` | Faqat Transport vazirligi GERPI'lari |
| GERPI xodimi | `monitoring@agro-piu.uz` | `Gerpi2026!` | Faqat o'z GERPI'si, ma'lumot kiritadi |
| Donor vakili | `viewer@worldbank.org` | `Donor2026!` | Faqat WB loyihalari, faqat ko'rish |

## Texnologiyalar

- **Backend:** Node.js 20+ (ESM), Express, Knex (PostgreSQL 15+/SQLite), Socket.IO,
  JWT, bcryptjs, ExcelJS, PDFKit, node-cron, Helmet, CORS whitelist, rate-limit (100 req/min)
- **Frontend:** Vanilla JS (build'siz, ES-modullar), Chart.js (lokal vendorlangan),
  hash-router SPA — backend'dan statik
- **Xarita:** `@svg-maps/uzbekistan` (CC-BY-4.0) viloyat poligonlari.
  Real GeoJSON kerak bo'lsa `frontend/assets/` ga qo'shib `map.js` da almashtirish mumkin —
  region bog'lash `regions.geojson_id` ustuni orqali.

## Loyiha tuzilishi

```
backend/
  src/routes/        # auth, gerpi, disbursements, components, procurements,
                     # documents, alerts, analytics, exports, admin
  src/services/      # alertEngine (R1-R7 + risk ball), snapshots, notify
  src/middleware/    # auth (JWT), rbac (5 rol), audit, errors
  src/jobs/          # cron: har kuni 06:00 (Asia/Tashkent)
  migrations/        # Knex sxema (14 jadval)
  seeds/demo.js      # 14 GERPI, 13 chorak tarix, 5 foydalanuvchi
frontend/
  js/pages/          # dashboard, registry, org, map, alerts, dataentry, reports, admin, login
  i18n/              # uz_latn, uz_cyrl, ru, en
  assets/            # chart.umd.min.js, uzbekistan.svg
```

## Qoidalar dvigateli (har kuni 06:00 + hisobot tasdiqlanganda)

| Kod | Shart | Daraja |
|---|---|---|
| R1 | o'zlashtirish < reja − 15% | Yuqori |
| R2 | choraklik hisobot 7+ kun kechikkan | Yuqori |
| R3 | yopilishgacha 6 oy qoldi VA o'zlashtirish < 60% | O'rta |
| R4 | tender 2+ marta bekor qilingan | O'rta |
| R5 | audit hisobotida nomuvofiqlik | Yuqori |
| R6 | yillik reja 1-fevralgacha yuklanmagan | Past |
| R7 | tayyorgarlik bosqichi 18 oydan oshgan | O'rta |

**Risk ball:** gap>15 → +40; gap 8–15 → +20; hisobot kechikishi har 7 kun → +10 (maks 30);
yopilishgacha <12 oy va <70% → +20; ochiq audit nomuvofiqligi → +15; tender 2+ bekor → +10.
Xaritalash: 0–25 Past, 26–55 O'rta, 56+ Yuqori.

## Hujjatlar

- [API_DOCS.md](API_DOCS.md) — barcha endpointlar
- [PRESENTATION_SCRIPT.md](PRESENTATION_SCRIPT.md) — 7 qadamlik taqdimot ssenariysi

## Deploy (Render/Railway)

1. PostgreSQL instans yarating, `DATABASE_URL` ni servisga bering
2. Build: `npm --prefix backend install`
3. Pre-deploy/release: `npm --prefix backend run migrate && npm --prefix backend run seed` (seed faqat birinchi marta)
4. Start: `npm --prefix backend start`
5. `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS` ni o'rnating (HTTPS majburiy)
