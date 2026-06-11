(function () {
  'use strict';
  const G = window.GERPI;
  if (!G.requireAuth()) return;

  G.renderLayout('/dashboard.html', '<b>Boshqaruv paneli</b>');

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#6b7a90';

  function kpiCard(icon, cls, value, label, deltaHtml) {
    return '<div class="card kpi-card">' +
      '<div class="kpi-ico ' + cls + '">' + icon + '</div>' +
      '<div><div class="kpi-value">' + value + '</div>' +
      '<div class="kpi-label">' + label + '</div>' +
      (deltaHtml || '') + '</div></div>';
  }

  function rankItem(r, i, bad) {
    const gap = -r.gap; // positive = ahead of plan
    const cls = gap >= 0 ? 'pos' : 'neg';
    const sign = gap >= 0 ? '+' : '';
    return '<li><span class="rank-num' + (bad ? ' bad' : '') + '">' + (i + 1) + '</span>' +
      '<span class="rank-name" title="' + G.esc(r.name) + '">' + G.esc(r.name) + '</span>' +
      '<span class="rank-gap ' + cls + '">' + sign + gap.toFixed(1) + '%</span></li>';
  }

  async function load() {
    let d;
    try {
      d = (await G.api('/api/analytics/dashboard')).data;
    } catch (err) {
      G.toast(err.message, 'error');
      return;
    }

    const k = d.kpis;
    document.getElementById('kpi-grid').innerHTML =
      kpiCard('🏛', 'blue', G.fmtNum(k.total_gerpi), 'GERPI tashkilotlari',
        '<div class="kpi-delta up">' + k.active_gerpi + ' tasi faol</div>') +
      kpiCard('▤', 'teal', G.fmtNum(k.total_components), 'Tarkibiy komponentlar') +
      kpiCard('$', 'green', G.fmtMoney(k.total_budget_usd), 'Umumiy portfel',
        '<div class="kpi-delta">' + G.fmtMoney(k.total_disbursed_usd) + ' o\'zlashtirildi</div>') +
      kpiCard('%', 'amber', k.avg_disbursement_pct + '%', 'O\'rtacha o\'zlashtirish',
        '<div class="kpi-delta ' + (k.high_risk_count ? 'down' : 'up') + '">' +
        k.high_risk_count + ' ta yuqori riskli</div>');

    new Chart(document.getElementById('chart-trend'), {
      type: 'line',
      data: {
        labels: d.trend.map((t) => t.label),
        datasets: [
          {
            label: 'Fakt', data: d.trend.map((t) => t.actual),
            borderColor: '#1b5fae', backgroundColor: 'rgba(27,95,174,0.08)',
            fill: true, tension: 0.35, pointRadius: 3,
          },
          {
            label: 'Reja', data: d.trend.map((t) => t.planned),
            borderColor: '#1aa39a', borderDash: [6, 4], pointRadius: 0, tension: 0.35,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } },
        plugins: { legend: { position: 'bottom' } },
      },
    });

    new Chart(document.getElementById('chart-donors'), {
      type: 'doughnut',
      data: {
        labels: d.by_donor.map((x) => x.label),
        datasets: [{ data: d.by_donor.map((x) => x.budget), backgroundColor: G.PALETTE }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: { callbacks: { label: (c) => ' ' + c.label + ': ' + G.fmtMoney(c.parsed) } },
        },
      },
    });

    new Chart(document.getElementById('chart-ministries'), {
      type: 'bar',
      data: {
        labels: d.by_ministry.map((x) => x.label),
        datasets: [{ data: d.by_ministry.map((x) => x.budget), backgroundColor: '#1b5fae', borderRadius: 5 }],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        scales: { x: { ticks: { callback: (v) => '$' + (v / 1e6).toFixed(0) + 'M' } } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ' ' + G.fmtMoney(c.parsed.x) } },
        },
      },
    });

    const STATUS_COLOR = {
      faol: '#2e9e5b', kechikayotgan: '#d64545', tayyorgarlik: '#1b5fae',
      yakunlangan: '#6b7a90', toxtatilgan: '#8246c9',
    };
    const statuses = Object.keys(d.by_status);
    new Chart(document.getElementById('chart-status'), {
      type: 'bar',
      data: {
        labels: statuses.map((s) => G.STATUS_LABELS[s] || s),
        datasets: [{
          data: statuses.map((s) => d.by_status[s]),
          backgroundColor: statuses.map((s) => STATUS_COLOR[s] || '#1b5fae'),
          borderRadius: 5, maxBarThickness: 56,
        }],
      },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        plugins: { legend: { display: false } },
      },
    });

    document.getElementById('top5').innerHTML =
      d.top5.map((r, i) => rankItem(r, i, false)).join('') ||
      '<div class="empty-state">Ma\'lumot yo\'q</div>';
    document.getElementById('bottom5').innerHTML =
      d.bottom5.map((r, i) => rankItem(r, i, true)).join('') ||
      '<div class="empty-state">Ma\'lumot yo\'q</div>';

    loadRiskMatrix();
  }

  const RISK_COLOR = {
    past: 'rgba(46,158,91,0.65)', orta: 'rgba(224,161,6,0.7)', yuqori: 'rgba(214,69,69,0.75)',
  };

  async function loadRiskMatrix() {
    let rows;
    try {
      rows = (await G.api('/api/analytics/risk-matrix')).data;
    } catch { return; }
    const maxBudget = Math.max(...rows.map((r) => r.budget_usd), 1);
    new Chart(document.getElementById('chart-risk'), {
      type: 'bubble',
      data: {
        datasets: rows.map((r) => ({
          label: r.name,
          data: [{
            x: r.months_to_close,
            y: r.gap,
            r: 6 + 16 * Math.sqrt(r.budget_usd / maxBudget),
          }],
          backgroundColor: RISK_COLOR[r.risk_level] || RISK_COLOR.past,
          borderColor: 'rgba(14,42,71,0.25)',
        })),
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Yopilishgacha qolgan oy' }, beginAtZero: true },
          y: { title: { display: true, text: 'Reja-fakt farqi, %' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const r = rows[c.datasetIndex];
                return ' ' + r.name + ' — farq ' + r.gap + '%, ' +
                  r.months_to_close + ' oy, ' + G.fmtMoney(r.budget_usd);
              },
            },
          },
        },
      },
    });
  }

  // Live alerts → toast
  G.connectSocket((alert) => {
    G.toast('Yangi ogohlantirish: ' + alert.title, 'error');
  });

  load();
})();
