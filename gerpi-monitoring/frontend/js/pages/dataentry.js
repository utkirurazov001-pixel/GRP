import { api, fmtMoney, esc, session } from "../api.js";
import { t } from "../i18n.js";
import { skeleton, emptyState, rstatusPill, toast, confirmDialog } from "../ui.js";

/** P7: Ma'lumot kiritish (gerpi_staff) — 3 qadamli wizard + komponent/xarid/hujjat. */
export async function renderDataEntry(el) {
  el.innerHTML = skeleton(8);

  // gerpi_staff o'z GERPI'si; admin birinchi GERPI bilan sinab ko'rishi mumkin
  const orgsR = await api("/api/gerpi?limit=100");
  const orgs = orgsR.data || [];
  const myOrg = session.user.gerpi_id
    ? orgs.find((o) => o.id === session.user.gerpi_id) || orgs[0]
    : orgs[0];
  if (!myOrg) { el.innerHTML = emptyState(t("empty")); return; }

  el.innerHTML = `
    <div class="page-title">${t("de_title")}</div>
    <div class="page-sub">${esc(myOrg.name_uz_latn)} — ${t("de_sub")}</div>
    <div class="grid cols2" style="align-items:start">
      <div class="card">
        <h3 class="box-title">📝 ${t("de_quarterly")}</h3>
        <div class="wizard-steps" id="wsteps">
          <div class="wstep active">${t("de_step1")}</div>
          <div class="wstep">${t("de_step2")}</div>
          <div class="wstep">${t("de_step3")}</div>
        </div>
        <div id="wizard-body"></div>
      </div>
      <div>
        <div class="card" style="margin-bottom:16px">
          <h3 class="box-title">📋 ${t("de_my_reports")}</h3>
          <div id="my-reports">${skeleton(3)}</div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <h3 class="box-title">🧩 ${t("de_component_upd")}</h3>
          <div id="comp-box">${skeleton(2)}</div>
        </div>
        <div class="card">
          <h3 class="box-title">📁 ${t("de_doc_upload")}</h3>
          <div id="doc-box"></div>
        </div>
      </div>
    </div>`;

  const wiz = { step: 1, data: {}, file: null, draftId: null };
  renderWizardStep(el, myOrg, wiz);
  loadMyReports(el, myOrg);
  loadComponents(el, myOrg);
  renderDocForm(el, myOrg);
}

function setStep(el, n) {
  el.querySelectorAll("#wsteps .wstep").forEach((s, i) => {
    s.className = "wstep" + (i + 1 === n ? " active" : i + 1 < n ? " done" : "");
  });
}

function renderWizardStep(el, org, wiz) {
  const body = el.querySelector("#wizard-body");
  setStep(el, wiz.step);
  const d = wiz.data;

  if (wiz.step === 1) {
    const now = new Date();
    const prevQ = now.getMonth() < 3
      ? { y: now.getFullYear() - 1, q: 4 }
      : { y: now.getFullYear(), q: Math.floor(now.getMonth() / 3) };
    body.innerHTML = `
      <div class="form-row">
        <div class="field"><label>${t("de_year")}</label><input type="number" id="w-year" value="${d.year ?? prevQ.y}"></div>
        <div class="field"><label>${t("de_quarter")}</label><select id="w-quarter">
          ${[1, 2, 3, 4].map((q) => `<option value="${q}" ${q === (d.quarter ?? prevQ.q) ? "selected" : ""}>Q${q}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>${t("de_disbursed_usd")}</label>
        <input type="number" id="w-usd" min="0" value="${d.disbursed_usd_cumulative ?? ""}">
        <div class="hint">${t("th_budget")}: ${fmtMoney(org.budget_total_usd)}</div></div>
      <div class="form-row">
        <div class="field"><label>${t("de_disbursed_pct")}</label><input type="number" id="w-pct" min="0" max="100" step="0.1" value="${d.disbursed_pct ?? ""}"></div>
        <div class="field"><label>${t("de_planned_pct")}</label><input type="number" id="w-plan" min="0" max="100" step="0.1" value="${d.planned_pct ?? ""}"></div>
      </div>
      <div class="field"><label>${t("de_commitment")}</label><input type="number" id="w-comm" min="0" value="${d.commitment_usd ?? ""}"></div>
      <div class="field"><label>${t("de_narrative")}</label>
        <textarea id="w-narr" rows="3">${esc(d.narrative || "")}</textarea>
        <div class="hint">${t("de_narrative_hint")}</div></div>
      <div class="modal-actions" style="justify-content:flex-end">
        <button class="btn" id="w-next">${t("btn_next")} →</button>
      </div>`;
    body.querySelector("#w-next").onclick = () => {
      wiz.data = {
        year: Number(body.querySelector("#w-year").value),
        quarter: Number(body.querySelector("#w-quarter").value),
        disbursed_usd_cumulative: Number(body.querySelector("#w-usd").value || 0),
        disbursed_pct: Number(body.querySelector("#w-pct").value || 0),
        planned_pct: Number(body.querySelector("#w-plan").value || 0),
        commitment_usd: Number(body.querySelector("#w-comm").value || 0),
        narrative: body.querySelector("#w-narr").value.trim(),
      };
      if (!wiz.data.year || !wiz.data.disbursed_pct) return toast(t("msg_required"), "error");
      wiz.step = 2;
      renderWizardStep(el, org, wiz);
    };
  }

  if (wiz.step === 2) {
    body.innerHTML = `
      <div class="field"><label>${t("de_attach")}</label>
        <input type="file" id="w-file" accept=".pdf,.docx,.xlsx,.jpg,.png">
        <div class="hint">${t("de_attach_skip")}</div></div>
      <div class="modal-actions" style="justify-content:space-between">
        <button class="btn secondary" id="w-back">← ${t("btn_back")}</button>
        <button class="btn" id="w-next">${t("btn_next")} →</button>
      </div>`;
    body.querySelector("#w-back").onclick = () => { wiz.step = 1; renderWizardStep(el, org, wiz); };
    body.querySelector("#w-next").onclick = () => {
      wiz.file = body.querySelector("#w-file").files[0] || null;
      wiz.step = 3;
      renderWizardStep(el, org, wiz);
    };
  }

  if (wiz.step === 3) {
    const d2 = wiz.data;
    body.innerHTML = `
      <p style="color:var(--text-2);margin-bottom:14px">${t("de_confirm_text")}</p>
      <table class="data"><tbody>
        <tr><td>${t("th_quarter")}</td><td><b>${d2.year}-Q${d2.quarter}</b></td></tr>
        <tr><td>${t("de_disbursed_usd")}</td><td><b>${fmtMoney(d2.disbursed_usd_cumulative)}</b></td></tr>
        <tr><td>${t("th_fact")}</td><td><b>${d2.disbursed_pct}%</b></td></tr>
        <tr><td>${t("th_plan")}</td><td>${d2.planned_pct}%</td></tr>
        <tr><td>${t("de_attach")}</td><td>${wiz.file ? esc(wiz.file.name) : t("no_file")}</td></tr>
      </tbody></table>
      <div class="modal-actions" style="justify-content:space-between">
        <button class="btn secondary" id="w-back">← ${t("btn_back")}</button>
        <div style="display:flex;gap:8px">
          <button class="btn secondary" id="w-draft">${t("de_save_draft")}</button>
          <button class="btn success" id="w-submit">${t("btn_submit")}</button>
        </div>
      </div>`;
    body.querySelector("#w-back").onclick = () => { wiz.step = 2; renderWizardStep(el, org, wiz); };

    async function save(submit) {
      const r = await api(`/api/gerpi/${org.id}/disbursements`, { method: "POST", body: wiz.data });
      if (!r.success) return toast(r.error?.details?.join("; ") || r.error?.message || t("msg_error"), "error");
      if (wiz.file) {
        const fd = new FormData();
        fd.append("file", wiz.file);
        fd.append("title", `${org.name_uz_latn} — ${wiz.data.year}-Q${wiz.data.quarter} hisobot`);
        fd.append("type", "choraklik_hisobot");
        fd.append("period_year", wiz.data.year);
        fd.append("period_quarter", wiz.data.quarter);
        await api(`/api/gerpi/${org.id}/documents`, { method: "POST", body: fd });
      }
      if (submit) {
        const r2 = await api(`/api/disbursements/${r.data.id}/submit`, { method: "PATCH", body: {} });
        if (!r2.success) return toast(r2.error?.details?.join("; ") || r2.error?.message, "error");
        toast(t("msg_submitted"), "success");
      } else {
        toast(t("msg_saved"), "success");
      }
      wiz.step = 1; wiz.data = {}; wiz.file = null;
      renderWizardStep(el, org, wiz);
      loadMyReports(el, org);
    }
    body.querySelector("#w-draft").onclick = () => save(false);
    body.querySelector("#w-submit").onclick = async () => {
      if (await confirmDialog(`${wiz.data.year}-Q${wiz.data.quarter} — ${t("btn_submit")}?`)) save(true);
    };
  }
}

async function loadMyReports(el, org) {
  const box = el.querySelector("#my-reports");
  const r = await api(`/api/gerpi/${org.id}/disbursements`);
  const rows = (r.data || []).slice(-6).reverse();
  if (!rows.length) { box.innerHTML = emptyState(t("empty")); return; }
  box.innerHTML = rows.map((x) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <div><b>${x.year}-Q${x.quarter}</b> <small style="color:var(--text-3)">${Number(x.disbursed_pct).toFixed(1)}%</small>
        ${x.review_comment && x.status === "qaytarilgan" ? `<br><small style="color:var(--red)">↩ ${esc(x.review_comment)}</small>` : ""}</div>
      <div style="display:flex;gap:6px;align-items:center">
        ${rstatusPill(x.status)}
        ${["qoralama", "qaytarilgan"].includes(x.status) ? `<button class="btn sm" data-submit="${x.id}">${t("btn_submit")}</button>` : ""}
      </div>
    </div>`).join("");
  box.querySelectorAll("[data-submit]").forEach((b) => b.onclick = async () => {
    const r2 = await api(`/api/disbursements/${b.dataset.submit}/submit`, { method: "PATCH", body: {} });
    if (r2.success) { toast(t("msg_submitted"), "success"); loadMyReports(el, org); }
    else toast(r2.error?.details?.join("; ") || r2.error?.message, "error");
  });
}

async function loadComponents(el, org) {
  const box = el.querySelector("#comp-box");
  const r = await api(`/api/gerpi/${org.id}/components`);
  const rows = r.data || [];
  if (!rows.length) { box.innerHTML = emptyState(t("empty")); return; }
  box.innerHTML = rows.map((c) => `
    <div style="display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:12.5px">${esc(c.name)}</span>
      <input type="number" min="0" max="100" value="${c.progress_pct}" data-comp="${c.id}"
        style="width:64px;padding:5px 8px;border:1px solid var(--border);border-radius:7px">
      <button class="btn sm" data-save="${c.id}">✓</button>
    </div>`).join("");
  box.querySelectorAll("[data-save]").forEach((b) => b.onclick = async () => {
    const val = Number(box.querySelector(`[data-comp="${b.dataset.save}"]`).value);
    const r2 = await api(`/api/components/${b.dataset.save}`, { method: "PATCH", body: { progress_pct: val } });
    if (r2.success) toast(t("msg_saved"), "success");
    else toast(r2.error?.message || t("msg_error"), "error");
  });
}

function renderDocForm(el, org) {
  const box = el.querySelector("#doc-box");
  box.innerHTML = `
    <div class="field"><label>${t("th_title")}</label><input id="d-title"></div>
    <div class="form-row">
      <div class="field"><label>${t("th_type")}</label><select id="d-type">
        ${["choraklik_hisobot", "yillik_reja", "audit_hisoboti", "donor_missiya", "shartnoma", "boshqa"]
          .map((x) => `<option value="${x}">${x.replace(/_/g, " ")}</option>`).join("")}</select></div>
      <div class="field"><label>${t("year")}</label><input id="d-year" type="number" value="${new Date().getFullYear()}"></div>
    </div>
    <div class="field"><input type="file" id="d-file" accept=".pdf,.docx,.xlsx,.jpg,.png"></div>
    <button class="btn sm" id="d-save" style="width:100%;justify-content:center">⬆ ${t("de_doc_upload")}</button>`;
  box.querySelector("#d-save").onclick = async () => {
    const title = box.querySelector("#d-title").value.trim();
    if (!title) return toast(t("msg_required"), "error");
    const fd = new FormData();
    const f = box.querySelector("#d-file").files[0];
    if (f) fd.append("file", f);
    fd.append("title", title);
    fd.append("type", box.querySelector("#d-type").value);
    fd.append("period_year", box.querySelector("#d-year").value);
    const r = await api(`/api/gerpi/${org.id}/documents`, { method: "POST", body: fd });
    if (r.success) { toast(t("msg_saved"), "success"); box.querySelector("#d-title").value = ""; }
    else toast(r.error?.message || t("msg_error"), "error");
  };
}
