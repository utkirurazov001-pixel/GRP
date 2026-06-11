import { api, downloadFile, fmtMoney, fmtDate, esc, session } from "../api.js";
import { t, localName } from "../i18n.js";
import {
  skeleton, emptyState, statusPill, riskPill, rstatusPill, sevPill,
  progressBar, toast, registerChart, promptNote, pill,
} from "../ui.js";

/** P4: GERPI profili — to'liq sahifa, 6 tab. */
export async function renderOrg(el, id) {
  el.innerHTML = skeleton(10);
  const r = await api(`/api/gerpi/${id}`);
  if (!r.success) { el.innerHTML = emptyState(r.error?.message, "🚫"); return; }
  const o = r.data;
  const canReview = ["admin", "mof_supervisor", "ministry_officer"].includes(session.user.role);

  el.innerHTML = `
    <a href="#/registry" style="font-size:13px">← ${t("nav_registry")}</a>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-top:8px">
      <div>
        <div class="page-title">${esc(localName(o))}</div>
        <div class="page-sub">${esc(o.ministry_name || "")} · <span class="pill blue">${esc(o.donor_short || "")}</span>
          ${statusPill(o.status)} ${riskPill(o.risk_level)}</div>
      </div>
      <button class="btn secondary sm" id="org-pdf">⬇ ${t("org_passport")}</button>
    </div>

    <div class="grid kpi4">
      <div class="card kpi-card"><div class="kpi-label">${t("th_budget")}</div>
        <div class="kpi-value">${fmtMoney(o.budget_total_usd)}</div><div class="kpi-ico blue">💼</div></div>
      <div class="card kpi-card"><div class="kpi-label">${t("th_disbursed")}</div>
        <div class="kpi-value">${Number(o.disbursed_pct).toFixed(1)}%</div>
        <div class="kpi-extra">${fmtMoney(o.disbursed_usd)} · ${t("th_plan")} ${Number(o.planned_pct).toFixed(1)}%</div>
        <div class="kpi-ico teal">📈</div></div>
      <div class="card kpi-card"><div class="kpi-label">${t("org_risk_score")}</div>
        <div class="kpi-value">${o.risk_score}/100</div><div class="kpi-ico ${o.risk_level === "yuqori" ? "red" : o.risk_level === "orta" ? "amber" : "green"}">🛡</div></div>
      <div class="card kpi-card"><div class="kpi-label">${t("kpi_open_alerts")}</div>
        <div class="kpi-value">${o.open_alerts}</div><div class="kpi-ico ${o.open_alerts ? "red" : "green"}">🔔</div></div>
    </div>

    <div class="card">
      <div class="tabs" id="org-tabs">
        ${["overview", "disbursements", "components", "procurements", "documents", "alerts", "history"]
          .map((k, i) => `<button data-tab="${k}" class="${i === 0 ? "active" : ""}">${t("tab_" + k)}</button>`).join("")}
      </div>
      <div id="tab-body">${skeleton(5)}</div>
    </div>`;

  el.querySelector("#org-pdf").onclick = () =>
    downloadFile(`/api/exports/gerpi/${id}/passport.pdf`, "gerpi-passport.pdf").catch(() => toast(t("msg_error"), "error"));

  const body = el.querySelector("#tab-body");
  const tabs = {
    overview: () => tabOverview(body, o),
    disbursements: () => tabDisbursements(body, o, canReview),
    components: () => tabComponents(body, o),
    procurements: () => tabProcurements(body, o),
    documents: () => tabDocuments(body, o),
    alerts: () => tabAlerts(body, o, canReview),
    history: () => tabHistory(body, o),
  };
  el.querySelector("#org-tabs").querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      el.querySelectorAll("#org-tabs button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      tabs[b.dataset.tab]();
    };
  });
  tabOverview(body, o);
}

function tabOverview(body, o) {
  body.innerHTML = `
    <div class="grid cols2">
      <div>
        ${[
          [t("org_agreement"), `${o.agreement_number || "—"} (${fmtDate(o.agreement_date)})`],
          [t("th_period"), `${o.start_year || "—"} – ${o.end_year || "—"}`],
          [t("th_closing"), fmtDate(o.closing_date)],
          [t("org_director"), `${o.director_name || "—"} ${o.director_phone || ""}`],
          [t("org_regions"), (o.regions || []).map((r) => esc(localName(r))).join(", ") || "—"],
          [t("org_address"), o.address || "—"],
        ].map(([k, v]) => `<div class="rstat" style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-2)">${k}</span><b style="text-align:right;max-width:60%">${v}</b></div>`).join("")}
      </div>
      <div class="chart-wrap" style="height:280px"><canvas id="org-trend"></canvas></div>
    </div>`;
  drawOrgTrend(body, o.id);
}

async function drawOrgTrend(body, id) {
  const r = await api(`/api/gerpi/${id}/disbursements`);
  const rows = (r.data || []).filter((x) => ["tasdiqlangan", "topshirilgan"].includes(x.status));
  const cv = body.querySelector("#org-trend");
  if (!cv || !rows.length) return;
  registerChart(new Chart(cv, {
    type: "line",
    data: {
      labels: rows.map((x) => `${x.year}-Q${x.quarter}`),
      datasets: [
        { label: t("th_fact"), data: rows.map((x) => Number(x.disbursed_pct)), borderColor: "#1b5fae", backgroundColor: "rgba(27,95,174,.1)", fill: true, tension: .3 },
        { label: t("th_plan"), data: rows.map((x) => Number(x.planned_pct)), borderColor: "#8da4bd", borderDash: [6, 4], tension: .3 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } } },
  }));
}

async function tabDisbursements(body, o, canReview) {
  body.innerHTML = skeleton(5);
  const r = await api(`/api/gerpi/${o.id}/disbursements`);
  const rows = (r.data || []).slice().reverse();
  if (!rows.length) { body.innerHTML = emptyState(t("empty")); return; }
  body.innerHTML = `<div class="table-wrap"><table class="data">
    <thead><tr><th>${t("th_quarter")}</th><th>${t("th_amount")}</th><th>${t("th_fact")}</th><th>${t("th_plan")}</th><th>${t("th_status")}</th><th>${t("de_narrative")}</th>${canReview ? `<th>${t("th_actions")}</th>` : ""}</tr></thead>
    <tbody>${rows.map((x) => `
      <tr>
        <td><b>${x.year}-Q${x.quarter}</b></td>
        <td>${fmtMoney(x.disbursed_usd_cumulative)}</td>
        <td><b>${Number(x.disbursed_pct).toFixed(1)}%</b></td>
        <td>${Number(x.planned_pct).toFixed(1)}%</td>
        <td>${rstatusPill(x.status)}</td>
        <td style="max-width:280px"><small>${esc((x.narrative || "").slice(0, 140))}${(x.narrative || "").length > 140 ? "…" : ""}</small>
          ${x.review_comment ? `<br><small style="color:var(--red)">↩ ${esc(x.review_comment)}</small>` : ""}</td>
        ${canReview ? `<td style="white-space:nowrap">${x.status === "topshirilgan"
          ? `<button class="btn success sm" data-approve="${x.id}">${t("btn_approve")}</button>
             <button class="btn danger sm" data-reject="${x.id}">${t("btn_reject")}</button>` : ""}</td>` : ""}
      </tr>`).join("")}</tbody></table></div>`;

  body.querySelectorAll("[data-approve]").forEach((b) => b.onclick = async () => {
    const r2 = await api(`/api/disbursements/${b.dataset.approve}/approve`, { method: "PATCH", body: {} });
    if (r2.success) { toast(t("msg_approved"), "success"); tabDisbursements(body, o, canReview); }
    else toast(r2.error?.message || t("msg_error"), "error");
  });
  body.querySelectorAll("[data-reject]").forEach((b) => b.onclick = async () => {
    const note = await promptNote(t("btn_reject"), t("de_review_comment"));
    if (!note) return;
    const r2 = await api(`/api/disbursements/${b.dataset.reject}/reject`, { method: "PATCH", body: { comment: note } });
    if (r2.success) { toast(t("msg_rejected"), "success"); tabDisbursements(body, o, canReview); }
    else toast(r2.error?.message || t("msg_error"), "error");
  });
}

async function tabComponents(body, o) {
  body.innerHTML = skeleton(4);
  const r = await api(`/api/gerpi/${o.id}/components`);
  const rows = r.data || [];
  if (!rows.length) { body.innerHTML = emptyState(t("empty")); return; }
  body.innerHTML = `<div class="table-wrap"><table class="data">
    <thead><tr><th>${t("th_title")}</th><th>${t("th_budget")}</th><th style="min-width:160px">${t("th_progress")}</th><th>${t("th_plan")}</th><th>${t("th_period")}</th></tr></thead>
    <tbody>${rows.map((c) => `
      <tr><td><b>${esc(c.name)}</b><br><small style="color:var(--text-3)">${esc(c.responsible_person || "")}</small></td>
        <td>${fmtMoney(c.budget_usd)}</td>
        <td>${progressBar(c.progress_pct, c.planned_progress_pct)}</td>
        <td>${c.planned_progress_pct}%</td>
        <td><small>${fmtDate(c.start_date)} – ${fmtDate(c.end_date)}</small></td></tr>`).join("")}</tbody></table></div>`;
}

async function tabProcurements(body, o) {
  body.innerHTML = skeleton(4);
  const r = await api(`/api/gerpi/${o.id}/procurements`);
  const rows = r.data || [];
  if (!rows.length) { body.innerHTML = emptyState(t("empty")); return; }
  body.innerHTML = `<div class="table-wrap"><table class="data">
    <thead><tr><th>${t("th_title")}</th><th>${t("th_method")}</th><th>${t("th_amount")}</th><th>${t("th_status")}</th><th>${t("th_supplier")}</th></tr></thead>
    <tbody>${rows.map((p) => `
      <tr><td><b>${esc(p.title)}</b>${Number(p.cancel_count) >= 2 ? ` <span class="pill red">✕${p.cancel_count}</span>` : ""}</td>
        <td>${esc(p.method)}</td>
        <td>${fmtMoney(p.contract_usd || p.estimated_usd)}</td>
        <td>${pill(t("rstatus_" + p.status) === "rstatus_" + p.status ? p.status : p.status, p.status)}</td>
        <td>${esc(p.supplier || "—")}</td></tr>`).join("")}</tbody></table></div>`;
}

async function tabDocuments(body, o) {
  body.innerHTML = skeleton(4);
  const r = await api(`/api/gerpi/${o.id}/documents`);
  const rows = r.data || [];
  if (!rows.length) { body.innerHTML = emptyState(t("empty"), "📁"); return; }
  body.innerHTML = `<div class="table-wrap"><table class="data">
    <thead><tr><th>${t("th_title")}</th><th>${t("th_type")}</th><th>${t("period")}</th><th>${t("th_date")}</th><th></th></tr></thead>
    <tbody>${rows.map((d) => `
      <tr><td><b>${esc(d.title)}</b>${d.has_findings ? ` <span class="pill red">⚠</span>` : ""}</td>
        <td><span class="pill gray">${esc(d.type)}</span></td>
        <td>${d.period_year ? `${d.period_year}${d.period_quarter ? "-Q" + d.period_quarter : ""}` : "—"}</td>
        <td>${fmtDate(d.created_at)}</td>
        <td>${d.file_path ? `<button class="btn ghost sm" data-dl="${d.id}">⬇ ${t("btn_download")}</button>` : `<small style="color:var(--text-3)">${t("no_file")}</small>`}</td></tr>`).join("")}</tbody></table></div>`;
  body.querySelectorAll("[data-dl]").forEach((b) =>
    b.onclick = () => downloadFile(`/api/documents/${b.dataset.dl}/download`).catch(() => toast(t("msg_error"), "error")));
}

async function tabAlerts(body, o, canReview) {
  body.innerHTML = skeleton(4);
  const r = await api(`/api/alerts?gerpi_id=${o.id}&limit=50`);
  const rows = r.data || [];
  if (!rows.length) { body.innerHTML = emptyState(t("empty_alerts"), "✅"); return; }
  body.innerHTML = rows.map((a) => `
    <div class="alert-item">
      <div class="sev-dot ${a.severity}"></div>
      <div class="a-body">
        <div class="a-title">${esc(a.title)} ${a.rule_code ? `<span class="pill gray">${a.rule_code}</span>` : ""}</div>
        <div class="a-desc">${esc(a.description || "")}</div>
        <div class="a-meta">${sevPill(a.severity)} · ${t("atype_" + a.type)} · ${fmtDate(a.created_at)}
          ${a.is_resolved ? ` · ✅ ${esc(a.resolution_note || "")}` : ""}</div>
      </div>
      ${!a.is_resolved && canReview ? `<button class="btn secondary sm" data-resolve="${a.id}">${t("btn_resolve")}</button>` : ""}
    </div>`).join("");
  body.querySelectorAll("[data-resolve]").forEach((b) => b.onclick = async () => {
    const note = await promptNote(t("resolve_note"));
    if (!note) return;
    const r2 = await api(`/api/alerts/${b.dataset.resolve}/resolve`, { method: "PATCH", body: { note } });
    if (r2.success) { toast(t("msg_resolved"), "success"); tabAlerts(body, o, canReview); }
    else toast(r2.error?.message || t("msg_error"), "error");
  });
}

async function tabHistory(body, o) {
  body.innerHTML = skeleton(4);
  const r = await api(`/api/gerpi/${o.id}/history`);
  const rows = r.data || [];
  if (!rows.length) { body.innerHTML = emptyState(t("empty"), "🕓"); return; }
  body.innerHTML = `<div class="table-wrap"><table class="data">
    <thead><tr><th>${t("th_date")}</th><th>${t("th_user")}</th><th>${t("th_action")}</th><th></th></tr></thead>
    <tbody>${rows.map((h) => `
      <tr><td>${fmtDate(h.created_at)}</td><td>${esc(h.user_name || "—")}</td>
        <td><span class="pill gray">${esc(h.action)}</span></td>
        <td><small style="color:var(--text-3)">${esc(String(h.new_value || "").slice(0, 120))}</small></td></tr>`).join("")}</tbody></table></div>`;
}
