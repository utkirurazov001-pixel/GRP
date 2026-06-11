import { api, downloadFile, fmtMoney, esc, session } from "../api.js";
import { t, localName } from "../i18n.js";
import { skeleton, emptyState, statusPill, riskPill, progressBar, toast, openModal, closeModal } from "../ui.js";

/** P3: GERPI registri — filtr, qidiruv, saralash, eksport, yangi GERPI (admin/mof). */
export async function renderRegistry(el) {
  el.innerHTML = `<div class="page-title">${t("nav_registry")}</div>${skeleton(8)}`;

  const [ministries, donors, regions] = await Promise.all([
    api("/api/ministries"), api("/api/donors"), api("/api/regions"),
  ]);
  const canEdit = ["admin", "mof_supervisor"].includes(session.user.role);

  const state = { search: "", ministry_id: "", donor_id: "", status: "", sort: "name", dir: "asc" };

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div><div class="page-title">${t("nav_registry")}</div><div class="page-sub" id="reg-count"></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn secondary sm" id="exp-xlsx">⬇ ${t("btn_export_xlsx")}</button>
        <button class="btn secondary sm" id="exp-pdf">⬇ ${t("btn_export_pdf")}</button>
        ${canEdit ? `<button class="btn sm" id="new-gerpi">＋ ${t("btn_new_gerpi")}</button>` : ""}
      </div>
    </div>
    <div class="card">
      <div class="filters">
        <div class="field"><input type="search" id="f-search" placeholder="${t("filter_search")}"></div>
        <div class="field"><select id="f-ministry"><option value="">${t("th_ministry")}: ${t("filter_all")}</option>
          ${(ministries.data || []).map((m) => `<option value="${m.id}">${esc(localName(m))}</option>`).join("")}</select></div>
        <div class="field"><select id="f-donor"><option value="">${t("th_donor")}: ${t("filter_all")}</option>
          ${(donors.data || []).map((d) => `<option value="${d.id}">${esc(d.short_name)}</option>`).join("")}</select></div>
        <div class="field"><select id="f-status"><option value="">${t("th_status")}: ${t("filter_all")}</option>
          ${["tayyorgarlik", "faol", "kechikayotgan", "yakunlangan", "toxtatilgan"].map((s) => `<option value="${s}">${t("status_" + s)}</option>`).join("")}</select></div>
      </div>
      <div class="table-wrap" id="reg-table">${skeleton(6)}</div>
    </div>`;

  async function load() {
    const qs = new URLSearchParams({ limit: 100, sort: state.sort, dir: state.dir });
    if (state.search) qs.set("search", state.search);
    if (state.ministry_id) qs.set("ministry_id", state.ministry_id);
    if (state.donor_id) qs.set("donor_id", state.donor_id);
    if (state.status) qs.set("status", state.status);
    const r = await api(`/api/gerpi?${qs}`);
    const box = el.querySelector("#reg-table");
    el.querySelector("#reg-count").textContent = `${t("total")}: ${r.meta?.total ?? 0}`;
    const rows = r.data || [];
    if (!rows.length) { box.innerHTML = emptyState(t("empty")); return; }
    box.innerHTML = `
      <table class="data">
        <thead><tr>
          <th data-sort="name">${t("th_name")}</th><th>${t("th_ministry")}</th><th>${t("th_donor")}</th>
          <th data-sort="budget">${t("th_budget")}</th><th>${t("th_disbursed")}</th>
          <th data-sort="status">${t("th_status")}</th><th data-sort="risk">${t("th_risk")}</th>
        </tr></thead>
        <tbody>
        ${rows.map((o) => `
          <tr class="clickable" data-id="${o.id}">
            <td><b>${esc(localName(o))}</b><br><small style="color:var(--text-3)">${esc(o.agreement_number || "")}</small></td>
            <td>${esc(o.ministry_name || "—")}</td>
            <td><span class="pill blue">${esc(o.donor_short || "—")}</span></td>
            <td><b>${fmtMoney(o.budget_total_usd)}</b></td>
            <td style="min-width:140px">${progressBar(o.disbursed_pct, o.planned_pct)}</td>
            <td>${statusPill(o.status)}</td>
            <td>${riskPill(o.risk_level)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    box.querySelectorAll("tr.clickable").forEach((tr) =>
      tr.addEventListener("click", () => (location.hash = `#/org/${tr.dataset.id}`)));
    box.querySelectorAll("th[data-sort]").forEach((th) =>
      th.addEventListener("click", () => {
        const s = th.dataset.sort;
        state.dir = state.sort === s && state.dir === "asc" ? "desc" : "asc";
        state.sort = s;
        load();
      }));
  }

  let deb;
  el.querySelector("#f-search").addEventListener("input", (e) => {
    clearTimeout(deb);
    deb = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 300);
  });
  for (const [id, key] of [["f-ministry", "ministry_id"], ["f-donor", "donor_id"], ["f-status", "status"]]) {
    el.querySelector(`#${id}`).addEventListener("change", (e) => { state[key] = e.target.value; load(); });
  }
  el.querySelector("#exp-xlsx").onclick = () =>
    downloadFile("/api/exports/registry.xlsx", "gerpi-registry.xlsx").catch(() => toast(t("msg_error"), "error"));
  el.querySelector("#exp-pdf").onclick = () =>
    downloadFile("/api/exports/quarterly-summary.pdf", "quarterly-summary.pdf").catch(() => toast(t("msg_error"), "error"));

  if (canEdit) el.querySelector("#new-gerpi").onclick = () => newGerpiModal(ministries.data, donors.data, regions.data, load);

  await load();
}

function newGerpiModal(ministries, donors, regions, onDone) {
  const ov = openModal(`
    <h3>${t("btn_new_gerpi")}</h3>
    <div class="field"><label>${t("th_name")} (uz)</label><input id="g-name" required></div>
    <div class="form-row">
      <div class="field"><label>${t("th_ministry")}</label><select id="g-min">${ministries.map((m) => `<option value="${m.id}">${esc(localName(m))}</option>`).join("")}</select></div>
      <div class="field"><label>${t("th_donor")}</label><select id="g-don">${donors.map((d) => `<option value="${d.id}">${esc(d.short_name)}</option>`).join("")}</select></div>
    </div>
    <div class="form-row">
      <div class="field"><label>${t("th_budget")} (USD)</label><input id="g-budget" type="number" min="0"></div>
      <div class="field"><label>${t("org_agreement")} №</label><input id="g-agr"></div>
    </div>
    <div class="form-row">
      <div class="field"><label>${t("th_closing")}</label><input id="g-closing" type="date"></div>
      <div class="field"><label>${t("th_status")}</label><select id="g-status">
        ${["tayyorgarlik", "faol"].map((s) => `<option value="${s}">${t("status_" + s)}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label>${t("org_regions")}</label>
      <select id="g-regions" multiple size="5">${regions.map((r) => `<option value="${r.id}">${esc(localName(r))}</option>`).join("")}</select></div>
    <div class="modal-actions">
      <button class="btn secondary" data-close>${t("btn_cancel")}</button>
      <button class="btn" id="g-save">${t("btn_save")}</button>
    </div>`);
  ov.querySelector("#g-save").onclick = async () => {
    const name = ov.querySelector("#g-name").value.trim();
    if (!name) return toast(t("msg_required"), "error");
    const r = await api("/api/gerpi", {
      method: "POST",
      body: {
        name_uz_latn: name,
        ministry_id: ov.querySelector("#g-min").value,
        donor_id: ov.querySelector("#g-don").value,
        budget_total_usd: Number(ov.querySelector("#g-budget").value || 0),
        agreement_number: ov.querySelector("#g-agr").value || null,
        closing_date: ov.querySelector("#g-closing").value || null,
        status: ov.querySelector("#g-status").value,
        region_ids: [...ov.querySelector("#g-regions").selectedOptions].map((o) => o.value),
      },
    });
    if (r.success) { closeModal(); toast(t("msg_saved"), "success"); onDone(); }
    else toast(r.error?.message || t("msg_error"), "error");
  };
}
