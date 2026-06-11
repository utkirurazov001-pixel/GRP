# GERPI Monitoring

Loyihalarni amalga oshirish guruhlari (PIU) faoliyatini markazlashtirilgan nazorat qilish
milliy platformasi — byudjet, o'zlashtirish, muddatlar, risklar va hisobotlar yagona tizimda.

**Stack:** Node.js 20+ · Express · PostgreSQL 15+ · Knex.js · Vanilla JS + Chart.js

## O'rnatish

Talablar: Node.js ≥ 20 va ishlab turgan PostgreSQL.

```bash
# 1. Bazani yarating (bir marta):
#    CREATE USER gerpi WITH PASSWORD 'gerpi_dev_2026' CREATEDB;
#    CREATE DATABASE gerpi_monitoring OWNER gerpi;

# 2. O'rnatish (install + .env + migrate + demo seed):
npm run setup

# 3. Ishga tushirish:
npm run dev
```

Platforma: **http://localhost:4000**

Baza ulanishi standartdan farq qilsa, `backend/.env` faylida `DATABASE_URL` ni o'zgartiring
(namuna: `backend/.env.example`).

## Demo hisoblar

| Rol | Email | Parol | Ko'lami |
|---|---|---|---|
| Administrator | `admin@gerpi.uz` | `Admin2026!` | Hammasi + o'chirish |
| IMV nazoratchi | `nazoratchi@imv.uz` | `Mof2026!` | Barcha GERPI, registr tahriri |
| Vazirlik mas'uli | `masul@suv.uz` | `Ministry2026!` | Faqat Suv xo'jaligi GERPI'lari |
| GERPI xodimi | `monitoring@gerpi-suv.uz` | `Staff2026!` | Faqat o'z GERPI'si |
| Donor vakili | `viewer@worldbank.org` | `Donor2026!` | Faqat WB loyihalari (ko'rish) |

## Loyiha tuzilishi

```
backend/
  migrations/        — PostgreSQL sxema (13 jadval)
  seeds/             — demo ma'lumotlar (14 GERPI, 13 choraklik tarix, 8 alert)
  src/
    routes/          — API marshrutlar
    controllers/     — so'rov ishlovchilari
    services/        — biznes mantiq (auth, gerpi, analytics, audit)
    middleware/      — auth (JWT), rbac, error
frontend/
  index.html         — kirish sahifasi
  dashboard.html     — boshqaruv paneli (KPI + 4 grafik + reyting)
  orgs.html          — GERPI reestri (filtr, qidiruv, CRUD)
  org-detail.html    — to'liq profil: 6 tab (umumiy, o'zlashtirish, komponentlar,
                       xaridlar, hujjatlar, ogohlantirishlar)
  data-entry.html    — GERPI xodimi uchun 3 qadamli hisobot wizard'i
  assets/            — uslublar, skriptlar, Chart.js (lokal vendor)
```

API tavsifi: [API_DOCS.md](API_DOCS.md)

## Qurilish fazalari

- [x] **1-faza — Poydevor:** DB migratsiyalar + seed, JWT auth + RBAC (5 rol),
      GERPI CRUD + reestr sahifasi, jonli dashboard, audit log
- [x] **2-faza — Ma'lumot yig'ish:** DCP-01..04 formalari, hisobot workflow
      (qoralama → topshirilgan → tasdiqlangan/qaytarilgan), hujjat yuklash,
      tabli to'liq org-profil sahifasi, 3 qadamli hisobot wizard'i
- [ ] **3-faza — Intellekt:** alert rules engine + cron, risk score,
      KPI snapshotlar, Socket.IO, risk matritsasi
- [ ] **4-faza — Sayqal:** GeoJSON xarita, PDF/Excel eksport, i18n (4 til),
      Telegram bildirishnomalar, taqdimot ssenariysi
