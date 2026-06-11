# GERPI Monitoring — API hujjatlari

Barcha javoblar yagona konvert: `{ "success": bool, "data": ..., "error": { "message", "details" } | null, "meta": ... | null }`

- Autentifikatsiya: `Authorization: Bearer <access_token>` (15 daqiqa amal qiladi)
- Pagination: `?page=&limit=` → `meta: { page, limit, total }`
- Rate limit: 100 so'rov/daqiqa (`/api/*`)
- Xato kodlari: 400 (so'rov xato), 401 (token), 403 (ruxsat), 404, 422 (validatsiya), 500

## Rollar (RBAC)

| Rol | Doira |
|---|---|
| `admin` | Hammasi + foydalanuvchilar va spravochniklar |
| `mof_supervisor` | Barcha GERPI: ko'rish, tasdiqlash/qaytarish, alert yopish, eksport, registr tahriri |
| `ministry_officer` | Faqat o'z vazirligi GERPI'lari: ko'rish, tekshiruv, eksport |
| `gerpi_staff` | Faqat o'z GERPI'si: DCP formalar, hujjat yuklash |
| `donor_viewer` | Faqat o'z donori loyihalari: faqat ko'rish + eksport |

## Auth

| Metod | Yo'l | Tavsif |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` → `{access_token, refresh_token, user, demo_mode}` |
| POST | `/api/auth/refresh` | `{refresh_token}` → yangi juftlik (rotation: eskisi bekor bo'ladi) |
| POST | `/api/auth/logout` | `{refresh_token}` → token bekor qilinadi |

## GERPI registri

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/gerpi` | Ro'yxat. Filtr: `ministry_id, donor_id, status, risk_level, search`; saralash: `sort=name\|budget\|risk\|status`, `dir` |
| GET | `/api/gerpi/:id` | To'liq profil (hududlar, komponentlar, oxirgi hisobot, ochiq alertlar) |
| GET | `/api/gerpi/:id/history` | Audit izi (registr o'zgarishlari) |
| POST | `/api/gerpi` | Yangi GERPI (admin/mof). `region_ids: []` qabul qiladi |
| PATCH | `/api/gerpi/:id` | Tahrir (admin/mof) |

## Choraklik hisobotlar (DCP-01)

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/gerpi/:id/disbursements` | Hisobotlar tarixi |
| POST | `/api/gerpi/:id/disbursements` | Yangi qoralama. Maydonlar: `year, quarter, disbursed_usd_cumulative, disbursed_pct, planned_pct, commitment_usd, narrative` |
| PATCH | `/api/disbursements/:id` | Qoralama/qaytarilganni tahrirlash |
| PATCH | `/api/disbursements/:id/submit` | Topshirish (gerpi_staff) |
| PATCH | `/api/disbursements/:id/approve` | Tasdiqlash (mof/ministry/admin) → alert dvigateli + KPI snapshot darhol |
| PATCH | `/api/disbursements/:id/reject` | Qaytarish — `{comment}` MAJBURIY |

Validatsiya: foiz oldingi chorakdan kichik bo'lmasin; summa byudjetdan oshmasin;
reja-fakt farqi >10% bo'lsa izoh ≥100 belgi; bir chorakka bitta hisobot.

## Komponentlar (DCP-02) va xaridlar (DCP-03)

| Metod | Yo'l |
|---|---|
| GET/POST | `/api/gerpi/:id/components` · PATCH `/api/components/:id` |
| GET/POST | `/api/gerpi/:id/procurements` · PATCH `/api/procurements/:id` |

Xarid `status=bekor_qilingan` ga o'tsa `cancel_count` avtomatik +1;
`cancel_count >= 2` bo'lsa R4 alert avtomatik yaratiladi.

## Hujjatlar (DCP-04)

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/gerpi/:id/documents` | Ro'yxat |
| POST | `/api/gerpi/:id/documents` | Multipart: `file` (pdf/docx/xlsx/jpg/png, maks 20MB) + `title, type, period_year, period_quarter, due_date, has_findings` |
| GET | `/api/documents/:id/download` | Faylni yuklab olish |

## Ogohlantirishlar

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/alerts` | Filtr: `severity, type, gerpi_id, is_resolved` |
| POST | `/api/alerts` | Qo'lda alert (admin/mof) |
| PATCH | `/api/alerts/:id/resolve` | Hal qilish — `{note}` MAJBURIY |

Socket.IO: yangi alert `alert:new` eventi bilan barcha ulangan mijozlarga boradi.

## Analitika

| Yo'l | Tavsif |
|---|---|
| GET `/api/analytics/dashboard` | KPI + donor/vazirlik/holat/risk agregatsiyalari + top5/bottom5 |
| GET `/api/analytics/regions` | Hudud kesimi (xarita uchun, `geojson_id` bilan) |
| GET `/api/analytics/trends` | kpi_snapshots tarixiy qatori |
| GET `/api/analytics/risk-matrix` | Har faol GERPI: yopilishgacha oy / reja-fakt farqi / byudjet |

## Eksport

| Yo'l | Format |
|---|---|
| GET `/api/exports/registry.xlsx` | Excel registr |
| GET `/api/exports/quarterly-summary.pdf` | Choraklik yig'ma hisobot |
| GET `/api/exports/gerpi/:id/passport.pdf` | GERPI pasporti |

## Admin

| Metod | Yo'l | Kim |
|---|---|---|
| GET/POST | `/api/admin/users` · PATCH/DELETE `/api/admin/users/:id` | admin |
| POST/PATCH/DELETE | `/api/admin/ministries[/:id]`, `/api/admin/donors[/:id]`, `/api/admin/regions[/:id]` | admin |
| GET | `/api/admin/audit-log` (filtr: `action, entity_type, user_id`) | admin, mof |
| GET | `/api/ministries`, `/api/donors`, `/api/regions` | barcha rollar (o'qish) |

## Boshqa

- GET `/health` → `{ok: true, demo: bool}`
- GET `/api/meta` → lokallar, rollar, holatlar, turlar lug'atlari
