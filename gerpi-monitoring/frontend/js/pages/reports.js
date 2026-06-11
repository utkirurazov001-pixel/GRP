import { api, downloadFile, esc } from "../api.js";
import { t, localName } from "../i18n.js";
import { toast } from "../ui.js";

/** P8: Tayyor hisobot shablonlari — bir tugma, yuklab olish. */
export async function renderReports(el) {
  const orgs = await api("/api/gerpi?limit=100");

  el.innerHTML = `
    <div class="page-title">${t("reports_title")}</div>
    <div class="page-sub">${t("reports_sub")}</div>
    <div class="grid cols3">
      <div class="card report-tile">
        <div class="r-ico">📑</div>
        <div class="r-body"><b>${t("report_quarterly")}</b><span>${t("report_quarterly_d")}</span></div>
        <button class="btn sm" id="rp-quarterly">⬇ PDF</button>
      </div>
      <div class="card report-tile">
        <div class="r-ico" style="background:linear-gradient(135deg,var(--green),#54bd80)">📊</div>
        <div class="r-body"><b>${t("report_registry")}</b><span>${t("report_registry_d")}</span></div>
        <button class="btn success sm" id="rp-registry">⬇ XLSX</button>
      </div>
      <div class="card">
        <div class="report-tile" style="margin-bottom:12px">
          <div class="r-ico" style="background:linear-gradient(135deg,#7e57c2,#9575cd)">🛂</div>
          <div class="r-body"><b>${t("report_passport")}</b><span>${t("report_passport_d")}</span></div>
        </div>
        <div class="field"><label>${t("report_select_gerpi")}</label>
          <select id="rp-org">${(orgs.data || []).map((o) => `<option value="${o.id}">${esc(localName(o))}</option>`).join("")}</select></div>
        <button class="btn sm" id="rp-passport" style="width:100%;justify-content:center">⬇ PDF</button>
      </div>
    </div>`;

  const dl = (path, name) => downloadFile(path, name).catch(() => toast(t("msg_error"), "error"));
  el.querySelector("#rp-quarterly").onclick = () => dl("/api/exports/quarterly-summary.pdf", "quarterly-summary.pdf");
  el.querySelector("#rp-registry").onclick = () => dl("/api/exports/registry.xlsx", "gerpi-registry.xlsx");
  el.querySelector("#rp-passport").onclick = () =>
    dl(`/api/exports/gerpi/${el.querySelector("#rp-org").value}/passport.pdf`, "gerpi-passport.pdf");
}
