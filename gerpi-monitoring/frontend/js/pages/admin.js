import { api, fmtDate, esc, session } from "../api.js";
import { t, localName } from "../i18n.js";
import { skeleton, emptyState, toast, openModal, closeModal, confirmDialog, pill } from "../ui.js";

const ROLES = ["admin", "mof_supervisor", "ministry_officer", "gerpi_staff", "donor_viewer"];

/** P9: Administratsiya — foydalanuvchilar, spravochniklar, audit jurnali. */
export async function renderAdmin(el) {
  const isAdmin = session.user.role === "admin";
  const tabs = [
    ...(isAdmin ? [["users", "admin_users"], ["ministries", "admin_ministries"], ["donors", "admin_donors"], ["regions", "admin_regions"]] : []),
    ["audit", "admin_audit"],
  ];

  el.innerHTML = `
    <div class="page-title">${t("nav_admin")}</div>
    <div class="card">
      <div class="tabs" id="adm-tabs">
        ${tabs.map(([k, lbl], i) => `<button data-tab="${k}" class="${i === 0 ? "active" : ""}">${t(lbl)}</button>`).join("")}
      </div>
      <div id="adm-body">${skeleton(5)}</div>
    </div>`;

  const body = el.querySelector("#adm-body");
  const render = { users: tabUsers, ministries: () => tabRef(body, "ministries"), donors: () => tabRef(body, "donors"), regions: () => tabRef(body, "regions"), audit: tabAudit };
  el.querySelector("#adm-tabs").querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      el.querySelectorAll("#adm-tabs button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      render[b.dataset.tab](body);
    };
  });
  render[tabs[0][0]](body);
}

async function tabUsers(body) {
  body.innerHTML = skeleton(5);
  const [users, orgs, ministries, donors] = await Promise.all([
    api("/api/admin/users"), api("/api/gerpi?limit=100"), api("/api/ministries"), api("/api/donors"),
  ]);
  const rows = users.data || [];
  body.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn sm" id="u-new">＋ ${t("admin_new_user")}</button></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>${t("admin_full_name")}</th><th>${t("admin_email")}</th><th>${t("th_role")}</th><th>${t("admin_active")}</th><th></th></tr></thead>
      <tbody>${rows.map((u) => `
        <tr><td><b>${esc(u.full_name)}</b></td><td>${esc(u.email)}</td>
          <td>${pill(t("role_" + u.role), "blue")}</td>
          <td>${u.is_active ? "✅" : "⛔"}</td>
          <td style="white-space:nowrap">
            <button class="btn ghost sm" data-edit="${u.id}">${t("btn_edit")}</button>
            <button class="btn ghost sm" data-del="${u.id}" style="color:var(--red)">✕</button>
          </td></tr>`).join("")}</tbody></table></div>`;

  const userModal = (u) => {
    const ov = openModal(`
      <h3>${u ? t("btn_edit") : t("admin_new_user")}</h3>
      <div class="field"><label>${t("admin_full_name")}</label><input id="u-name" value="${esc(u?.full_name || "")}"></div>
      <div class="form-row">
        <div class="field"><label>${t("admin_email")}</label><input id="u-email" type="email" value="${esc(u?.email || "")}" ${u ? "disabled" : ""}></div>
        <div class="field"><label>${t("admin_password")}</label><input id="u-pass" type="password" placeholder="${u ? "(o'zgarmasin — bo'sh)" : ""}"></div>
      </div>
      <div class="field"><label>${t("admin_role")}</label><select id="u-role">
        ${ROLES.map((r) => `<option value="${r}" ${u?.role === r ? "selected" : ""}>${t("role_" + r)}</option>`).join("")}</select></div>
      <div class="form-row">
        <div class="field"><label>GERPI</label><select id="u-gerpi"><option value="">—</option>
          ${(orgs.data || []).map((o) => `<option value="${o.id}" ${u?.gerpi_id === o.id ? "selected" : ""}>${esc(o.name_uz_latn)}</option>`).join("")}</select></div>
        <div class="field"><label>${t("th_ministry")}</label><select id="u-min"><option value="">—</option>
          ${(ministries.data || []).map((m) => `<option value="${m.id}" ${u?.ministry_id === m.id ? "selected" : ""}>${esc(localName(m))}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>${t("th_donor")}</label><select id="u-donor"><option value="">—</option>
        ${(donors.data || []).map((d) => `<option value="${d.id}" ${u?.donor_id === d.id ? "selected" : ""}>${esc(d.short_name)}</option>`).join("")}</select></div>
      <div class="modal-actions">
        <button class="btn secondary" data-close>${t("btn_cancel")}</button>
        <button class="btn" id="u-save">${t("btn_save")}</button>
      </div>`);
    ov.querySelector("#u-save").onclick = async () => {
      const payload = {
        full_name: ov.querySelector("#u-name").value.trim(),
        role: ov.querySelector("#u-role").value,
        gerpi_id: ov.querySelector("#u-gerpi").value || null,
        ministry_id: ov.querySelector("#u-min").value || null,
        donor_id: ov.querySelector("#u-donor").value || null,
      };
      const pass = ov.querySelector("#u-pass").value;
      if (pass) payload.password = pass;
      let r;
      if (u) r = await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: payload });
      else r = await api("/api/admin/users", { method: "POST", body: { ...payload, email: ov.querySelector("#u-email").value.trim(), password: pass } });
      if (r.success) { closeModal(); toast(t("msg_saved"), "success"); tabUsers(body); }
      else toast(r.error?.message || t("msg_error"), "error");
    };
  };

  body.querySelector("#u-new").onclick = () => userModal(null);
  body.querySelectorAll("[data-edit]").forEach((b) =>
    b.onclick = () => userModal(rows.find((u) => u.id === b.dataset.edit)));
  body.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
    const u = rows.find((x) => x.id === b.dataset.del);
    if (await confirmDialog(`${u.full_name} — ${t("btn_cancel")}?`)) {
      const r = await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      if (r.success) { toast(t("msg_saved"), "success"); tabUsers(body); }
      else toast(r.error?.message || t("msg_error"), "error");
    }
  });
}

async function tabRef(body, table) {
  body.innerHTML = skeleton(4);
  const r = await api(`/api/${table}`);
  const rows = r.data || [];
  const nameField = table === "donors" ? "name" : "name_uz_latn";
  body.innerHTML = `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>${t("th_name")}</th><th>${table === "donors" ? t("th_donor") : table === "ministries" ? "Code" : "SOATO"}</th></tr></thead>
      <tbody>${rows.map((x) => `
        <tr><td><b>${esc(x[nameField])}</b></td>
          <td>${esc(x.short_name || x.code || x.soato_code || "—")}</td></tr>`).join("")}</tbody></table></div>`;
  if (!rows.length) body.innerHTML = emptyState(t("empty"));
}

async function tabAudit(body) {
  body.innerHTML = skeleton(6);
  const r = await api("/api/admin/audit-log?limit=50");
  const rows = r.data || [];
  if (!rows.length) { body.innerHTML = emptyState(t("empty"), "🕓"); return; }
  body.innerHTML = `<div class="table-wrap"><table class="data">
    <thead><tr><th>${t("th_date")}</th><th>${t("th_user")}</th><th>${t("th_action")}</th><th>${t("th_entity")}</th><th></th></tr></thead>
    <tbody>${rows.map((h) => `
      <tr><td style="white-space:nowrap">${fmtDate(h.created_at)}</td>
        <td>${esc(h.user_name || "—")}<br><small style="color:var(--text-3)">${h.user_role ? t("role_" + h.user_role) : ""}</small></td>
        <td>${pill(h.action, h.action === "delete" ? "red" : h.action === "approve" ? "green" : "gray")}</td>
        <td><small>${esc(h.entity_type)}</small></td>
        <td><small style="color:var(--text-3)">${esc(String(h.new_value || "").slice(0, 100))}</small></td></tr>`).join("")}</tbody></table></div>`;
}
