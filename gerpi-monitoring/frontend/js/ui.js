import { t } from "./i18n.js";
import { esc } from "./api.js";

/** Toast bildirishnoma */
export function toast(msg, kind = "info") {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/** Modal (HTML kontent bilan). Yopish: overlay yoki [data-close]. */
export function openModal(html) {
  closeModal();
  const ov = document.createElement("div");
  ov.className = "modal-overlay open";
  ov.id = "modal-ov";
  ov.innerHTML = `<div class="modal">${html}</div>`;
  ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(); });
  ov.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  document.body.appendChild(ov);
  return ov;
}
export function closeModal() {
  document.getElementById("modal-ov")?.remove();
}

/** Tasdiqlash dialogi (Promise<boolean>) */
export function confirmDialog(text) {
  return new Promise((resolve) => {
    const ov = openModal(`
      <h3>${t("confirm_title")}</h3>
      <p style="color:var(--text-2)">${esc(text)}</p>
      <div class="modal-actions">
        <button class="btn secondary" data-x="no">${t("btn_cancel")}</button>
        <button class="btn" data-x="yes">${t("btn_approve")}</button>
      </div>`);
    ov.querySelector('[data-x="no"]').onclick = () => { closeModal(); resolve(false); };
    ov.querySelector('[data-x="yes"]').onclick = () => { closeModal(); resolve(true); };
  });
}

/** Izoh so'rovchi dialog (Promise<string|null>) */
export function promptNote(title, placeholder = "") {
  return new Promise((resolve) => {
    const ov = openModal(`
      <h3>${esc(title)}</h3>
      <div class="field"><textarea id="pn-text" rows="3" placeholder="${esc(placeholder)}"></textarea></div>
      <div class="modal-actions">
        <button class="btn secondary" data-x="no">${t("btn_cancel")}</button>
        <button class="btn" data-x="yes">${t("btn_save")}</button>
      </div>`);
    ov.querySelector('[data-x="no"]').onclick = () => { closeModal(); resolve(null); };
    ov.querySelector('[data-x="yes"]').onclick = () => {
      const v = ov.querySelector("#pn-text").value.trim();
      closeModal();
      resolve(v || null);
    };
  });
}

export const skeleton = (rows = 5) =>
  `<div>${Array.from({ length: rows }, () => '<div class="skeleton skel-row"></div>').join("")}</div>`;

export const emptyState = (msg, ico = "🗂") =>
  `<div class="empty-state"><div class="ico">${ico}</div><div>${esc(msg || t("empty"))}</div></div>`;

export const pill = (val, cls) => `<span class="pill ${cls || esc(val)}">${esc(val)}</span>`;
export const statusPill = (s) => `<span class="pill ${esc(s)}">${t("status_" + s)}</span>`;
export const riskPill = (r) => `<span class="pill risk-${esc(r)}">${t("risk_" + r)}</span>`;
export const rstatusPill = (s) => `<span class="pill ${esc(s)}">${t("rstatus_" + s)}</span>`;
export const sevPill = (s) => `<span class="pill sev-${esc(s)}">${t("sev_" + s)}</span>`;

export function progressBar(pct, planned) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const gap = planned !== undefined ? Number(planned) - p : 0;
  const cls = gap > 15 ? "danger" : gap > 8 ? "warn" : "";
  return `<div class="progress-cell"><div class="progress ${cls}" style="flex:1"><i style="width:${p}%"></i></div><span>${p.toFixed(0)}%</span></div>`;
}

/** Chart.js obyektlarini sahifa almashganda tozalash */
const charts = [];
export function registerChart(c) { charts.push(c); return c; }
export function destroyCharts() { while (charts.length) charts.pop().destroy(); }

export const PALETTE = ["#1b5fae", "#1aa39a", "#2e9e5b", "#e0a106", "#d64545", "#7e57c2", "#3e82d2", "#8da4bd"];
