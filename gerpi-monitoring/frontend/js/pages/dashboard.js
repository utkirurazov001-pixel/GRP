import { api, fmtMoney, esc } from "../api.js";
import { t } from "../i18n.js";
import { skeleton, registerChart, PALETTE, riskPill } from "../ui.js";

/** P2: Dashboard — 4+1 KPI, 4 grafik, risk matritsasi, top/bottom-5. */
export async function renderDashboard(el) {
  el.innerHTML = `<div class="page-title">${t("nav_dashboard")}</div>
    <div class="page-sub">${t("app_subtitle")}</div>${skeleton(8)}`;

  const [dash, trends, matrix] = await Promise.all([
    api("/api/analytics/dashboard"),
    api("/api/analytics/trends"),
    api("/api/analytics/risk-matrix"),
  ]);
  if (!dash.success) { el.innerHTML += `<div class="card">${esc(dash.error?.message)}</div>`; return; }
  const k = dash.data.kpi;

  el.innerHTML = `
    <div class="page-title">${t("nav_dashboard")}</div>
    <div class="page-sub">${t("app_subtitle")}</div>
    <div class="grid kpi4">
      <div class="card kpi-card"><div class="kpi-label">${t("kpi_total_gerpi")}</div>
        <div class="kpi-value">${k.total_gerpi}</div>
        <div class="kpi-extra">${t("kpi_components")}: ${k.active_components}</div>
        <div class="kpi-ico blue">🏛</div></div>
      <div class="card kpi-card"><div class="kpi-label">${t("kpi_portfolio")}</div>
        <div class="kpi-value">${fmtMoney(k.total_budget_usd)}</div>
        <div class="kpi-extra">${fmtMoney(k.total_disbursed_usd)} ${t("map_disbursed").toLowerCase()}</div>
        <div class="kpi-ico teal">💰</div></div>
      <div class="card kpi-card"><div class="kpi-label">${t("kpi_disbursement")}</div>
        <div class="kpi-value">${k.avg_disbursement_pct}%</div>
        <div class="kpi-extra">${t("vs_plan")}</div>
        <div class="kpi-ico green">📈</div></div>
      <div class="card kpi-card"><div class="kpi-label">${t("kpi_open_alerts")}</div>
        <div class="kpi-value">${k.open_alerts}</div>
        <div class="kpi-extra">${t("sev_yuqori")}: ${k.alerts_by_severity?.yuqori || 0} · ${t("sev_orta")}: ${k.alerts_by_severity?.orta || 0}</div>
        <div class="kpi-ico red">🔔</div></div>
    </div>

    <div class="grid cols2" style="margin-bottom:16px">
      <div class="card chart-box"><h3>${t("chart_trend")}</h3><div class="chart-wrap"><canvas id="ch-trend"></canvas></div></div>
      <div class="card chart-box"><h3>${t("chart_donors")}</h3><div class="chart-wrap"><canvas id="ch-donors"></canvas></div></div>
      <div class="card chart-box"><h3>${t("chart_ministries")}</h3><div class="chart-wrap"><canvas id="ch-min"></canvas></div></div>
      <div class="card chart-box"><h3>${t("chart_status")}</h3><div class="chart-wrap"><canvas id="ch-status"></canvas></div></div>
    </div>

    <div class="grid cols3">
      <div class="card chart-box" style="grid-column:span 1">
        <h3>${t("chart_risk_matrix")}</h3>
        <div class="chart-wrap"><canvas id="ch-matrix"></canvas></div>
        <div style="font-size:11px;color:var(--text-3);margin-top:8px">${t("risk_matrix_hint")}</div>
      </div>
      <div class="card"><h3 class="box-title">🏆 ${t("top5")}</h3><div id="top5"></div></div>
      <div class="card"><h3 class="box-title">⚠️ ${t("bottom5")}</h3><div id="bottom5"></div></div>
    </div>`;

  const ratingRow = (r) => `
    <div class="rating-row">
      <a class="rr-name" href="#/org/${r.id}" title="${esc(r.name)}">${esc(r.name)}</a>
      ${riskPill(r.risk_level)}
      <span class="rr-gap ${r.gap <= 5 ? "good" : "bad"}">${r.gap > 0 ? "−" : "+"}${Math.abs(r.gap).toFixed(1)}%</span>
    </div>`;
  el.querySelector("#top5").innerHTML = dash.data.top5.map(ratingRow).join("") || t("empty");
  el.querySelector("#bottom5").innerHTML = dash.data.bottom5.map(ratingRow).join("") || t("empty");

  const gridOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } } };

  // O'zlashtirish dinamikasi — kpi_snapshots'dan real tarixiy chiziq
  const tr = trends.data || [];
  registerChart(new Chart(el.querySelector("#ch-trend"), {
    type: "line",
    data: {
      labels: tr.map((x) => x.label),
      datasets: [
        { label: t("kpi_disbursement"), data: tr.map((x) => x.avg_disbursement_pct), borderColor: "#1b5fae", backgroundColor: "rgba(27,95,174,.08)", fill: true, tension: .35 },
        { label: t("map_disbursed") + " ($ mln)", data: tr.map((x) => x.total_disbursed_usd / 1e6), borderColor: "#1aa39a", borderDash: [5, 4], tension: .35, yAxisID: "y2" },
      ],
    },
    options: { ...gridOpts, scales: { y: { title: { display: true, text: "%" } }, y2: { position: "right", grid: { display: false } } } },
  }));

  const donors = dash.data.by_donor;
  registerChart(new Chart(el.querySelector("#ch-donors"), {
    type: "doughnut",
    data: { labels: donors.map((d) => d.name), datasets: [{ data: donors.map((d) => d.budget / 1e6), backgroundColor: PALETTE }] },
    options: { ...gridOpts, cutout: "58%" },
  }));

  const mins = dash.data.by_ministry.sort((a, b) => b.budget - a.budget);
  registerChart(new Chart(el.querySelector("#ch-min"), {
    type: "bar",
    data: { labels: mins.map((m) => m.name), datasets: [{ label: "$ mln", data: mins.map((m) => m.budget / 1e6), backgroundColor: "#1b5fae", borderRadius: 5 }] },
    options: { ...gridOpts, indexAxis: "y", plugins: { legend: { display: false } } },
  }));

  const sts = dash.data.by_status;
  const stColor = { faol: "#2e9e5b", kechikayotgan: "#e0a106", tayyorgarlik: "#1b5fae", yakunlangan: "#8da4bd", toxtatilgan: "#d64545" };
  registerChart(new Chart(el.querySelector("#ch-status"), {
    type: "bar",
    data: { labels: sts.map((s) => t("status_" + s.name)), datasets: [{ data: sts.map((s) => s.count), backgroundColor: sts.map((s) => stColor[s.name] || "#8da4bd"), borderRadius: 5 }] },
    options: { ...gridOpts, plugins: { legend: { display: false } }, scales: { y: { ticks: { stepSize: 1 } } } },
  }));

  // Risk matritsasi (bubble)
  const mx = matrix.data || [];
  const rColor = { past: "rgba(46,158,91,.65)", orta: "rgba(224,161,6,.7)", yuqori: "rgba(214,69,69,.75)" };
  registerChart(new Chart(el.querySelector("#ch-matrix"), {
    type: "bubble",
    data: {
      datasets: mx.map((p) => ({
        label: p.name,
        data: [{ x: p.months_to_close, y: p.gap, r: Math.max(6, Math.sqrt(p.budget_usd / 1e6) / 1.6) }],
        backgroundColor: rColor[p.risk_level],
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw.y}% / ${c.raw.x} oy` } } },
      scales: { x: { title: { display: true, text: t("months_to_close"), font: { size: 10 } } }, y: { title: { display: true, text: t("gap") + " %", font: { size: 10 } } } },
    },
  }));
}
