# GERPI Monitoring — taqdimot ssenariysi (7 qadam)

> Tayyorgarlik: `npm run setup && npm run dev` → brauzerda `http://localhost:4000`.
> Interfeys tepasida "Namunaviy ma'lumotlar — demo rejim" banneri ko'rinadi.
> Har bir qadam ~1.5–2 daqiqa. Jami: ~12 daqiqa.

---

## 1-qadam. Kirish va rollar (login)

- Login sahifasida til tugmalarini ko'rsating (O'z / Ўз / Ру / En) — davlat platformasi 4 tilda.
- **IMV nazoratchisi** sifatida kiring: `nazoratchi@imv.uz` / `Nazorat2026!`
- Gapiring: *"Tizimda 5 rol bor — administrator, IMV nazoratchisi, vazirlik mas'uli,
  GERPI xodimi va donor vakili. Har biri faqat o'z doirasini ko'radi."*

## 2-qadam. Boshqaruv paneli (dashboard)

- KPI kartalar: **14 GERPI, $3.25 mlrd portfel, o'rtacha o'zlashtirish, ochiq ogohlantirishlar**.
- O'zlashtirish dinamikasi — 2023-Q1 dan beri **real tarixiy chiziq** (choraklik snapshotlardan).
- Pastda **risk matritsasi**: har bir doira — bitta GERPI (o'lchami byudjet, rangi risk).
  *"Qaysi loyiha muddati tugayapti-yu o'zlashtirolmayapti — bir qarashda."*
- "E'tibor talab 5 GERPI" reytingini ko'rsating.

## 3-qadam. Hududiy xarita

- "Hududiy xarita" bo'limiga o'ting — **real O'zbekiston viloyatlari poligonlari**, rang —
  GERPI soni bo'yicha choropleth.
- **Samarqand** viloyatini bosing: yon panelda hudud portfeli, o'zlashtirish, GERPI ro'yxati.
- Ro'yxatdan istalgan GERPI'ga o'tish mumkinligini ko'rsating.

## 4-qadam. Muammoli GERPI profili

- Registrga o'ting, **"Avtomobil yo'llarini rekonstruksiya qilish GERPI"** ni oching
  (holat: Kechikayotgan, risk: yuqori ball).
- Tablarni ko'rsating: **O'zlashtirish tarixi** (reja vs fakt grafigi — farq ochilib boradi),
  **Ogohlantirishlar** tabida R2 (hisobot kechikkan) avtomatik alertini ko'rsating.
- Gapiring: *"Bu alertni hech kim qo'lda yozmagan — qoidalar dvigateli har kuni 06:00 da
  tekshiradi: 7 ta qoida, risk ball 0–100."*

## 5-qadam. Ogohlantirishni hal qilish

- "Ogohlantirishlar" bo'limi: filtrlar (daraja/tur/holat).
- Bitta alertda **"Hal qilindi"** tugmasini bosing, izoh yozing
  (masalan: *"GERPI bilan bog'lanildi, hisobot 3 kun ichida topshiriladi"*).
- Alert tarixda saqlanib qoladi — "Hal qilingan" filtri bilan ko'rsating.

## 6-qadam. Hisobot topshirish va tasdiqlash (asosiy workflow)

- Chiqing, **GERPI xodimi** sifatida kiring: `monitoring@agro-piu.uz` / `Gerpi2026!`
- "Ma'lumot kiritish" → 3 qadamli wizard: ma'lumot → hujjat → tasdiqlash.
  "Mening hisobotlarim" da **2026-Q1 "Topshirilgan"** hisobot turganini ko'rsating.
- Chiqing, yana **IMV nazoratchisi** bilan kiring → o'sha GERPI profili →
  "O'zlashtirish tarixi" tabi → **"Tasdiqlash"** tugmasini bosing.
- Dashboardga qayting: *"Raqamlar yangilandi — ma'lumot zanjiri GERPI'dan vazirgacha
  hech qanday Excel-faylsiz."*

## 7-qadam. Eksport (davlat hisobotchiligi)

- "Hisobotlar" bo'limi: **Excel registr** va **Choraklik yig'ma PDF** ni yuklab oling, oching.
- GERPI profili sahifasidan **"GERPI pasporti (PDF)"** ni yuklab ko'rsating.
- Yakun: *"Administratsiya bo'limida har bir amal audit jurnalida — kim, qachon, nimani
  o'zgartirgani. Davlat tizimi talabi to'liq bajarilgan."*

---

## Zaxira savol-javoblar

- **"Ma'lumot xavfsizligi?"** — JWT 15 daqiqalik access + refresh rotation, bcrypt(12),
  parametrlangan so'rovlar, fayl turi/hajmi cheklovi, HTTPS, audit trail.
- **"Yangi GERPI qanday qo'shiladi?"** — Registr sahifasida "Yangi GERPI" (admin/IMV),
  barcha o'zgarishlar tarix tabida ko'rinadi.
- **"Telegram?"** — `TELEGRAM_BOT_TOKEN` o'rnatilsa yuqori darajali alertlar GERPI direktori,
  vazirlik mas'uli va IMV nazoratchisiga avtomatik boradi.
