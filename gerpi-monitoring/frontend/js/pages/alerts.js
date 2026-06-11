import { api, fmtDate, esc, session } from "../api.js";
import { t } from "../i18n.js";
import { skeleton, emptyState, sevPill, toast, promptNote, openModal, closeModal } from "../ui.js";

const ATYPES = ["ozlashtirish_past", "hisobot_kechikkan", "muddat_yaqin", "xarid_muammo", "audit_nomuvofiqlik", "hujjat_kutilmoqda", "eslatma"];

/** P6: Ogohlantirishlar — filtr + hal qilish + tarix. */
export async function renderAlerts(el) {
  const canResolve = ["admin", "mof_supervisor", "ministry_officer"].includes(session.user.role);
  const canCreate = ["admin", "mof_supervisor"].includes(session.user.role);
  const state = { severity: "", type: "", is_resolved: "false" };

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div><div class="page-title">${t("alerts_title")}</div><div class="page-sub">${t("alerts_sub")}</div></div>
      ${canCreate ? `<button class="btn sm" id="new-alert">＋ ${t("btn_new_alert")}</button>` : ""}
    </div>
    <div class="card">
      <div class="filters">
        <div class="field"><select id="f-sev"><option value="">${t("filter_severity")}: ${t("filter_all")}</option>
          ${["yuqori", "orta", "past"].map((s) => `<option value="${s}">${t("sev_" + s)}</option>`).join("")}</select></div>
        <div class="field"><select id="f-type"><option value="">${t("filter_type")}: ${t("filter_all")}</option>
          ${ATYPES.map((a) => `<option value="${a}">${t("atype_" + a)}</option>`).join("")}</select></div>
        <div class="field"><select id="f-res">
          <option value="false">${t("filter_open")}</option>
          <option value="true">${t("filter_resolved")}</option>
          <option value="">${t("filter_all")}</option></select></div>
      </div>
      <div id="alerts-list">${skeleton(6)}</div>
    </div>`;

  async function load() {
    const qs = new URLSearchParams({ limit: 100 });
    if (state.severity) qs.set("severity", state.severity);
    if (state.type) qs.set("type", state.type);
    if (state.is_resolved !== "") qs.set("is_resolved", state.is_resolved);
    const r = await api(`/api/alerts?${qs}`);
    const box = el.querySelector("#alerts-list");
    const rows = r.data || [];
    if (!rows.length) { box.innerHTML = emptyState(t("empty_alerts"), "✅"); return; }
    box.innerHTML = rows.map((a) => `
      <div class="alert-item">
        <div class="sev-dot ${a.severity}"></div>
        <div class="a-body">
          <div class="a-title">${esc(a.title)} ${a.rule_code ? `<span class="pill gray">${a.rule_code}</span>` : ""}</div>
          <div class="a-desc">${esc(a.description || "")}</div>
          <div class="a-meta">
            ${sevPill(a.severity)} · ${t("atype_" + a.type)} ·
            <a href="#/org/${a.gerpi_id}">${esc(a.gerpi_name)}</a> · ${fmtDate(a.created_at)}
            ${a.is_resolved ? `<br>✅ ${t("resolved_by")}: ${esc(a.resolution_note || "")}` : ""}
          </div>
        </div>
        ${!a.is_resolved && canResolve ? `<button class="btn secondary sm" data-resolve="${a.id}">${t("btn_resolve")}</button>` : ""}
      </div>`).join("");
    box.querySelectorAll("[data-resolve]").forEach((b) => b.onclick = async () => {
      const note = await promptNote(t("resolve_note"));
      if (!note) return;
      const r2 = await api(`/api/alerts/${b.dataset.resolve}/resolve`, { method: "PATCH", body: { note } });
      if (r2.success) { toast(t("msg_resolved"), "success"); load(); }
      else toast(r2.error?.message || t("msg_error"), "error");
    });
  }

  for (const [id, key] of [["f-sev", "severity"], ["f-type", "type"], ["f-res", "is_resolved"]]) {
    el.querySelector(`#${id}`).addEventListener("change", (e) => { state[key] = e.target.value; load(); });
  }

  if (canCreate) el.querySelector("#new-alert").onclick = async () => {
    const orgs = await api("/api/gerpi?limit=100");
    const ov = openModal(`
      <h3>${t("btn_new_alert")}</h3>
      <div class="field"><label>GERPI</label><select id="na-org">
        ${(orgs.data || []).map((o) => `<option value="${o.id}">${esc(o.name_uz_latn)}</option>`).join("")}</select></div>
      <div class="form-row">
        <div class="field"><label>${t("filter_severity")}</label><select id="na-sev">
          ${["yuqori", "orta", "past"].map((s) => `<option value="${s}">${t("sev_" + s)}</option>`).join("")}</select></div>
        <div class="field"><label>${t("filter_type")}</label><select id="na-type">
          ${ATYPES.map((a) => `<option value="${a}">${t("atype_" + a)}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>${t("th_title")}</label><input id="na-title"></div>
      <div class="field"><label>${t("de_narrative")}</label><textarea id="na-desc" rows="3"></textarea></div>
      <div class="modal-actions">
        <button class="btn secondary" data-close>${t("btn_cancel")}</button>
        <button class="btn" id="na-save">${t("btn_save")}</button>
      </div>`);
    ov.querySelector("#na-save").onclick = async () => {
      const body = {
        gerpi_id: ov.querySelector("#na-org").value,
        severity: ov.querySelector("#na-sev").value,
        type: ov.querySelector("#na-type").value,
        title: ov.querySelector("#na-title").value.trim(),
        description: ov.querySelector("#na-desc").value.trim() || null,
      };
      if (!body.title) return toast(t("msg_required"), "error");
      const r = await api("/api/alerts", { method: "POST", body });
      if (r.success) { closeModal(); toast(t("msg_saved"), "success"); load(); }
      else toast(r.error?.message || t("msg_error"), "error");
    };
  };

  await load();
}
