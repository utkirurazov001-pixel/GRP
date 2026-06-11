import { api, fmtMoney, esc } from "../api.js";
import { t, localName, currentLocale } from "../i18n.js";
import { skeleton, riskPill } from "../ui.js";

/** P5: Hududiy xarita — viloyat poligonlari (SVG), hover tooltip, yon panel. */
export async function renderMap(el) {
  el.innerHTML = `<div class="page-title">${t("map_title")}</div>
    <div class="page-sub">${t("map_sub")}</div>${skeleton(8)}`;

  const [svgText, regs] = await Promise.all([
    fetch("/assets/uzbekistan.svg").then((r) => r.text()),
    api("/api/analytics/regions"),
  ]);
  const byGid = Object.fromEntries((regs.data || []).map((r) => [r.geojson_id, r]));
  const maxCount = Math.max(1, ...(regs.data || []).map((r) => r.gerpi_count));

  el.innerHTML = `
    <div class="page-title">${t("map_title")}</div>
    <div class="page-sub">${t("map_sub")}</div>
    <div class="map-layout">
      <div class="card"><div id="uz-map">${svgText}</div>
        <div style="display:flex;gap:14px;margin-top:10px;font-size:11.5px;color:var(--text-2);flex-wrap:wrap">
          ${[1, 2, 3, 4].map((h) => `<span style="display:flex;align-items:center;gap:5px"><i style="width:14px;height:14px;border-radius:4px;display:inline-block;background:${["#c9dcf2", "#8db8e3", "#4a8ace", "#1b5fae"][h - 1]}"></i>${h === 1 ? "1" : h === 4 ? maxCount : ""}</span>`).join("")}
          <span>← ${t("map_gerpi_count")}</span>
        </div>
      </div>
      <div class="card region-panel" id="region-panel">
        <div class="empty-state"><div class="ico">🗺</div><div>${t("map_select_hint")}</div></div>
      </div>
    </div>
    <div class="map-tooltip" id="map-tip"></div>`;

  const tip = el.querySelector("#map-tip");
  const svg = el.querySelector("#uz-map svg");
  const locKey = { uz_latn: "name_uz_latn", uz_cyrl: "name_uz_cyrl", ru: "name_ru", en: "name_en" }[currentLocale()];

  svg.querySelectorAll("path").forEach((p) => {
    if (p.id === "aral-sea") return;
    const reg = byGid[p.id];
    if (reg && reg.gerpi_count > 0) {
      p.classList.add(`heat-${Math.max(1, Math.ceil((reg.gerpi_count / maxCount) * 4))}`);
    }
    p.addEventListener("mousemove", (e) => {
      const name = reg?.[locKey] || p.getAttribute("aria-label");
      tip.textContent = `${name}: ${reg ? reg.gerpi_count : 0} GERPI`;
      tip.style.display = "block";
      tip.style.left = `${e.clientX + 14}px`;
      tip.style.top = `${e.clientY - 10}px`;
    });
    p.addEventListener("mouseleave", () => (tip.style.display = "none"));
    p.addEventListener("click", () => {
      svg.querySelectorAll("path.sel").forEach((x) => x.classList.remove("sel"));
      p.classList.add("sel");
      showRegion(el, reg, p.getAttribute("aria-label"));
    });
  });
}

function showRegion(el, reg, fallbackName) {
  const panel = el.querySelector("#region-panel");
  if (!reg) {
    panel.innerHTML = `<h3 class="box-title">${esc(fallbackName)}</h3><div class="empty-state"><div class="ico">📭</div><div>${t("empty")}</div></div>`;
    return;
  }
  panel.innerHTML = `
    <h3 class="box-title">📍 ${esc(localName(reg))}</h3>
    <div class="rstat"><span>${t("map_gerpi_count")}</span><b>${reg.gerpi_count}</b></div>
    <div class="rstat"><span>${t("map_budget")}</span><b>${fmtMoney(reg.budget_usd)}</b></div>
    <div class="rstat"><span>${t("map_disbursed")}</span><b>${fmtMoney(reg.disbursed_usd)}</b></div>
    <div class="rstat"><span>${t("map_high_risk")}</span><b style="color:${reg.high_risk ? "var(--red)" : "var(--green)"}">${reg.high_risk}</b></div>
    <div style="margin-top:14px">
      ${reg.gerpi.map((g) => `
        <a href="#/org/${g.id}" style="display:block;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <span style="font-size:12.5px;font-weight:600;color:var(--text)">${esc(g.name)}</span>
            ${riskPill(g.risk_level)}
          </div>
          <small style="color:var(--text-3)">${esc(g.donor)} · ${Number(g.disbursed_pct).toFixed(0)}%</small>
        </a>`).join("")}
    </div>`;
}
