# GERPI Monitoring — API Documentation

Base URL: `/api` · All responses use the envelope:

```json
{ "success": true, "data": …, "error": null, "meta": null }
```

Errors: `400 / 401 / 403 / 404 / 422 / 500` with
`{ "success": false, "error": { "code", "message", "details" } }`.
Rate limit: **100 req/min** per IP.

Authentication: `Authorization: Bearer <accessToken>` (JWT, 15 min).
Refresh tokens live 7 days.

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | → `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | `{ refreshToken }` | → new token pair |
| POST | `/auth/logout` | — | requires auth; audit-logged |
| GET | `/auth/me` | — | current user profile |

## GERPI registry

Visibility is scoped by role: `ministry_officer` → own ministry,
`gerpi_staff` → own organization, `donor_viewer` → own donor's projects.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/gerpi` | all | filters: `ministry_id, donor_id, status, risk_level, q`; pagination `page, limit`; sorting `sort` (`name,budget,disbursed,risk,status,end_year`) + `dir` |
| GET | `/gerpi/:id` | all (scoped) | includes `regions, components, disbursements, alerts` |
| GET | `/gerpi/:id/history` | all (scoped) | audit trail for the organization |
| POST | `/gerpi` | admin, mof_supervisor | required: `name_uz_latn, ministry_id, donor_id, budget_total_usd`; optional `region_ids[]` |
| PATCH | `/gerpi/:id` | admin, mof_supervisor | partial update; audit-logged |
| DELETE | `/gerpi/:id` | admin | soft delete; audit-logged |

GERPI statuses: `tayyorgarlik · faol · kechikayotgan · yakunlangan · toxtatilgan`
Risk levels: `past · orta · yuqori`

## Reference data

| Method | Path | Notes |
|---|---|---|
| GET | `/meta/ministries` | id + names in 4 locales + code |
| GET | `/meta/donors` | id, name, short_name, country |
| GET | `/meta/regions` | 14 regions with geojson_id / soato_code |

## Analytics

| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/dashboard` | live aggregation over the caller's visible scope |

Dashboard payload:

```json
{
  "kpis": { "total_gerpi", "active_gerpi", "total_components",
            "total_budget_usd", "total_disbursed_usd",
            "avg_disbursement_pct", "high_risk_count", "open_alerts" },
  "trend": [ { "label": "2024-Q3", "actual": 41.2, "planned": 45.0 } ],
  "by_donor": [ { "label": "WB", "budget": 1340000000, "count": 5 } ],
  "by_ministry": [ … ],
  "by_status": { "faol": 10, … },
  "by_risk": { "yuqori": 2, … },
  "alerts_by_severity": { "yuqori": 3, … },
  "top5": [ { "id", "name", "disbursed_pct", "gap" } ],
  "bottom5": [ … ]
}
```

`avg_disbursement_pct` is budget-weighted: Σ disbursed / Σ budget.

## Disbursement reports (DCP-01)

Workflow: `qoralama → topshirilgan → tasdiqlangan | qaytarilgan`.
Entry: `gerpi_staff` (own org) or `admin`. Review: `mof_supervisor`,
`ministry_officer` (own ministry), `admin`.

| Method | Path | Notes |
|---|---|---|
| GET | `/gerpi/:id/disbursements` | full history, newest first |
| POST | `/gerpi/:id/disbursements` | upsert draft for `{year, quarter}`; fields: `disbursed_usd_cumulative, disbursed_pct, planned_pct, commitment_usd, narrative` |
| PATCH | `/disbursements/:id/submit` | validations: pct ≥ previous quarter, sum ≤ budget, narrative ≥ 100 chars when plan−actual > 10% |
| PATCH | `/disbursements/:id/approve` | → `tasdiqlangan`; if plan−actual > 15% an automatic `R1` high alert is created (returned as `data.alert`) |
| PATCH | `/disbursements/:id/reject` | body `{ comment }` (≥ 10 chars) → `qaytarilgan` |

## Components (DCP-02)

| Method | Path | Notes |
|---|---|---|
| GET | `/gerpi/:id/components` | |
| POST | `/gerpi/:id/components` | staff/admin/mof; `name, budget_usd` required |
| PATCH | `/components/:id` | partial update, e.g. `{ progress_pct }` |

## Procurements (DCP-03)

| Method | Path | Notes |
|---|---|---|
| GET | `/gerpi/:id/procurements` | |
| POST | `/gerpi/:id/procurements` | `title, estimated_usd` required; `method`: ICB/NCB/shopping/direct/QCBS/boshqa |
| PATCH | `/procurements/:id` | setting status to `bekor_qilingan` increments `cancel_count`; at 2+ an automatic `R4` alert is created (returned as `data.alert`) |

## Documents (DCP-04)

| Method | Path | Notes |
|---|---|---|
| GET | `/gerpi/:id/documents` | |
| POST | `/gerpi/:id/documents` | `multipart/form-data`: `file` (PDF/DOCX/XLSX/JPG/PNG, ≤ 20MB), `title`, `type`, optional `period_year/period_quarter/due_date` |
| GET | `/documents/:id/download` | scope-checked; download is audit-logged as `export` |

## Misc

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | unauthenticated liveness probe |

*Planned for later phases:* alerts management, analytics extensions
(risk matrix, regions), exports, and admin CRUD — see the build phases in README.md.
