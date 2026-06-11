(function () {
  'use strict';
  const G = window.GERPI;
  if (!G.requireAuth()) return;

  const orgId = new URLSearchParams(location.search).get('id');
  if (!orgId) { location.href = '/orgs.html'; return; }

  G.renderLayout('/orgs.html',
    '<a href="/dashboard.html">Boshqaruv paneli</a> / <a href="/orgs.html">GERPI reestri</a> / <b>Profil</b>');

  const user = G.Session.user;
  const isStaffHere = user.role === 'gerpi_staff' && user.gerpi_id === orgId;
  const canEnter = isStaffHere || user.role === 'admin' || user.role === 'mof_supervisor';
  const canReview = ['admin', 'mof_supervisor', 'ministry_officer'].includes(user.role);

  const REPORT_LABELS = {
    qoralama: 'Qoralama', topshirilgan: 'Topshirilgan',
    tasdiqlangan: 'Tasdiqlangan', qaytarilgan: 'Qaytarilgan',
  };
  const PROC_LABELS = {
    rejalashtirilgan: 'Rejalashtirilgan', elon_qilingan: "E'lon qilingan",
    baholashda: 'Baholashda', imzolangan: 'Imzolangan', bekor_qilingan: 'Bekor qilingan',
  };
  const DOC_LABELS = {
    choraklik_hisobot: 'Choraklik hisobot', yillik_reja: 'Yillik reja',
    audit_hisoboti: 'Audit hisoboti', donor_missiya: 'Donor missiyasi',
    shartnoma: 'Shartnoma', boshqa: 'Boshqa',
  };
  const pill = (s, labels) => '<span class="pill ' + G.esc(s) + '">' + G.esc(labels[s] || s) + '</span>';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('uz-UZ') : '—';

  let org = null;
  let rejectTargetId = null;
  let trendChart = null;

  // ---------- Tabs ----------
  document.getElementById('tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-pane').forEach((p) => { p.hidden = p.id !== 'tab-' + tab.dataset.tab; });
    if (tab.dataset.tab === 'disbursements' && trendChart) trendChart.resize();
  });

  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer.dataset.close);
    if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('open');
  });

  // ---------- Head + overview ----------
  function renderHead() {
    document.getElementById('org-head').innerHTML =
      '<div><div class="org-title">' + G.esc(org.name_uz_latn) + '</div>' +
      '<div class="org-meta">' +
      '<span>' + G.esc(org.ministry_name || '') + '</span>' +
      '<span>' + G.esc(org.donor_short || '') + ' · ' + G.esc(org.agreement_number || '') + '</span>' +
      '<span>' + (org.start_year || '—') + '–' + (org.end_year || '—') + '</span>' +
      '</div></div>' +
      '<div class="pills">' + G.statusPill(org.status) + G.riskPill(org.risk_level) + '</div>';
  }

  function detailItem(label, value) {
    return '<div class="detail-item"><div class="dl">' + label + '</div><div class="dv">' + value + '</div></div>';
  }

  function renderOverview() {
    const last = org.disbursements[org.disbursements.length - 1];
    const regions = org.regions.map((r) => G.esc(r.name_uz_latn)).join(', ') || '—';
    document.getElementById('tab-overview').innerHTML =
      '<div class="card" style="padding:20px"><div class="detail-grid">' +
      detailItem('Byudjet', G.fmtMoney(org.budget_total_usd)) +
      detailItem("O'zlashtirildi", last
        ? G.fmtMoney(last.disbursed_usd_cumulative) + ' (' + Number(last.disbursed_pct).toFixed(0) + '%)' : '—') +
      detailItem('Bitim raqami', G.esc(org.agreement_number || '—')) +
      detailItem('Yopilish sanasi', fmtDate(org.closing_date)) +
      detailItem('Direktor', G.esc(org.director_name || '—') +
        (org.director_phone ? ' · ' + G.esc(org.director_phone) : '')) +
      detailItem('Hududlar', regions) +
      '</div></div>';
  }

  // ---------- Disbursements tab ----------
  async function renderDisbursements() {
    const pane = document.getElementById('tab-disbursements');
    pane.innerHTML = '<div class="skeleton" style="height:200px"></div>';
    let rows;
    try {
      rows = (await G.api('/api/gerpi/' + orgId + '/disbursements')).data;
    } catch (err) { G.toast(err.message, 'error'); return; }

    const chron = rows.slice().reverse();
    let html = '<div class="card chart-box" style="margin-bottom:16px">' +
      '<h3>O\'zlashtirish dinamikasi (reja va fakt, %)</h3>' +
      '<div class="chart-wrap"><canvas id="org-trend"></canvas></div></div>';

    html += '<div class="card table-card"><div class="table-scroll"><table><thead><tr>' +
      '<th>Davr</th><th>O\'zlashtirildi</th><th>Fakt %</th><th>Reja %</th><th>Holat</th><th>Topshirdi</th><th></th>' +
      '</tr></thead><tbody>';
    for (const r of rows) {
      const gap = Number(r.planned_pct) - Number(r.disbursed_pct);
      let actions = '';
      if (canReview && r.status === 'topshirilgan') {
        actions = '<button class="btn btn-primary" style="padding:5px 11px;font-size:12px" data-approve="' + r.id + '">Tasdiqlash</button> ' +
          '<button class="btn btn-secondary" style="padding:5px 11px;font-size:12px" data-rejectbtn="' + r.id + '">Qaytarish</button>';
      }
      html += '<tr style="cursor:default"><td class="num"><b>' + r.year + '-Q' + r.quarter + '</b></td>' +
        '<td class="num">' + G.fmtMoney(r.disbursed_usd_cumulative) + '</td>' +
        '<td class="num"' + (gap > 15 ? ' style="color:var(--red);font-weight:700"' : '') + '>' + Number(r.disbursed_pct).toFixed(1) + '%</td>' +
        '<td class="num">' + Number(r.planned_pct).toFixed(1) + '%</td>' +
        '<td>' + pill(r.status, REPORT_LABELS) + '</td>' +
        '<td>' + G.esc(r.submitted_by_name || '—') + '</td>' +
        '<td style="white-space:nowrap">' + actions + '</td></tr>';
      if (r.status === 'qaytarilgan' && r.review_comment) {
        html += '<tr style="cursor:default"><td colspan="7"><div class="review-box">↩ ' + G.esc(r.review_comment) + '</div></td></tr>';
      }
    }
    html += '</tbody></table></div></div>';
    pane.innerHTML = html;

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('org-trend'), {
      type: 'line',
      data: {
        labels: chron.map((r) => r.year + '-Q' + r.quarter),
        datasets: [
          { label: 'Fakt', data: chron.map((r) => Number(r.disbursed_pct)),
            borderColor: '#1b5fae', backgroundColor: 'rgba(27,95,174,0.08)', fill: true, tension: 0.35 },
          { label: 'Reja', data: chron.map((r) => Number(r.planned_pct)),
            borderColor: '#1aa39a', borderDash: [6, 4], pointRadius: 0, tension: 0.35 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } },
        plugins: { legend: { position: 'bottom' } },
      },
    });

    pane.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', async () => {
      try {
        const r = (await G.api('/api/disbursements/' + b.dataset.approve + '/approve', { method: 'PATCH' })).data;
        G.toast('Hisobot tasdiqlandi');
        if (r.alert) G.toast('Avtomatik ogohlantirish yaratildi: ' + r.alert.title, 'error');
        renderDisbursements();
      } catch (err) { G.toast(err.message, 'error'); }
    }));
    pane.querySelectorAll('[data-rejectbtn]').forEach((b) => b.addEventListener('click', () => {
      rejectTargetId = b.dataset.rejectbtn;
      document.getElementById('reject-comment').value = '';
      document.getElementById('reject-error').style.display = 'none';
      openModal('reject-backdrop');
    }));
  }

  document.getElementById('btn-reject-confirm').addEventListener('click', async () => {
    const errBox = document.getElementById('reject-error');
    try {
      await G.api('/api/disbursements/' + rejectTargetId + '/reject', {
        method: 'PATCH',
        body: JSON.stringify({ comment: document.getElementById('reject-comment').value }),
      });
      closeModal('reject-backdrop');
      G.toast('Hisobot qaytarildi');
      renderDisbursements();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  });

  // ---------- Components tab ----------
  async function renderComponents() {
    const pane = document.getElementById('tab-components');
    pane.innerHTML = '<div class="skeleton" style="height:160px"></div>';
    let rows;
    try {
      rows = (await G.api('/api/gerpi/' + orgId + '/components')).data;
    } catch (err) { G.toast(err.message, 'error'); return; }

    let html = '<div class="card table-card"><div class="table-scroll"><table><thead><tr>' +
      '<th>Komponent</th><th>Byudjet</th><th>Fakt</th><th>Reja %</th><th>Mas\'ul</th>' +
      (canEnter ? '<th></th>' : '') + '</tr></thead><tbody>';
    if (!rows.length) {
      html += '<tr><td colspan="6"><div class="empty-state"><div class="big">▤</div>Komponentlar kiritilmagan</div></td></tr>';
    }
    for (const c of rows) {
      html += '<tr style="cursor:default"><td class="org-name">' + G.esc(c.name) + '</td>' +
        '<td class="num">' + G.fmtMoney(c.budget_usd) + '</td>' +
        '<td>' + G.progressBar(c.progress_pct, c.planned_progress_pct) + '</td>' +
        '<td class="num">' + c.planned_progress_pct + '%</td>' +
        '<td>' + G.esc(c.responsible_person || '—') + '</td>' +
        (canEnter
          ? '<td><input type="number" min="0" max="100" value="' + c.progress_pct + '" style="width:72px" data-comp="' + c.id + '">' +
            ' <button class="icon-btn" title="Saqlash" data-compsave="' + c.id + '">✓</button></td>'
          : '') + '</tr>';
    }
    html += '</tbody></table></div></div>';
    pane.innerHTML = html;

    pane.querySelectorAll('[data-compsave]').forEach((b) => b.addEventListener('click', async () => {
      const input = pane.querySelector('[data-comp="' + b.dataset.compsave + '"]');
      try {
        await G.api('/api/components/' + b.dataset.compsave, {
          method: 'PATCH',
          body: JSON.stringify({ progress_pct: input.value }),
        });
        G.toast('Komponent progressi yangilandi');
        renderComponents();
      } catch (err) { G.toast(err.message, 'error'); }
    }));
  }

  // ---------- Procurements tab ----------
  async function renderProcurements() {
    const pane = document.getElementById('tab-procurements');
    pane.innerHTML = '<div class="skeleton" style="height:160px"></div>';
    let rows;
    try {
      rows = (await G.api('/api/gerpi/' + orgId + '/procurements')).data;
    } catch (err) { G.toast(err.message, 'error'); return; }

    let html = '';
    let tbl = '<div class="card table-card"><div class="table-scroll"><table><thead><tr>' +
      '<th>Tender</th><th>Usul</th><th>Taxminiy</th><th>Shartnoma</th><th>Holat</th><th>Bekor</th>' +
      (canEnter ? '<th></th>' : '') + '</tr></thead><tbody>';
    if (!rows.length) {
      tbl += '<tr><td colspan="7"><div class="empty-state"><div class="big">📋</div>Xarid yozuvlari yo\'q</div></td></tr>';
    }
    for (const p of rows) {
      let statusCell = pill(p.status, PROC_LABELS);
      let actions = '';
      if (canEnter && p.status !== 'imzolangan') {
        actions = '<select data-procstatus="' + p.id + '" style="font-size:12px;padding:5px 8px">' +
          Object.entries(PROC_LABELS).map(([v, l]) =>
            '<option value="' + v + '"' + (v === p.status ? ' selected' : '') + '>' + l + '</option>').join('') +
          '</select>';
      }
      tbl += '<tr style="cursor:default"><td class="org-name">' + G.esc(p.title) + '</td>' +
        '<td>' + G.esc(p.method) + '</td>' +
        '<td class="num">' + G.fmtMoney(p.estimated_usd) + '</td>' +
        '<td class="num">' + (p.contract_usd ? G.fmtMoney(p.contract_usd) : '—') + '</td>' +
        '<td>' + statusCell + '</td>' +
        '<td class="num"' + (p.cancel_count >= 2 ? ' style="color:var(--red);font-weight:700"' : '') + '>' + p.cancel_count + '</td>' +
        (canEnter ? '<td>' + actions + '</td>' : '') + '</tr>';
    }
    tbl += '</tbody></table></div></div>';
    html += tbl;
    pane.innerHTML = html;

    pane.querySelectorAll('[data-procstatus]').forEach((sel) => sel.addEventListener('change', async () => {
      try {
        const r = (await G.api('/api/procurements/' + sel.dataset.procstatus, {
          method: 'PATCH',
          body: JSON.stringify({ status: sel.value }),
        })).data;
        G.toast('Tender holati yangilandi');
        if (r.alert) G.toast('Avtomatik ogohlantirish: ' + r.alert.title, 'error');
        renderProcurements();
      } catch (err) { G.toast(err.message, 'error'); renderProcurements(); }
    }));
  }

  // ---------- Documents tab ----------
  async function renderDocuments() {
    const pane = document.getElementById('tab-documents');
    pane.innerHTML = '<div class="skeleton" style="height:160px"></div>';
    let rows;
    try {
      rows = (await G.api('/api/gerpi/' + orgId + '/documents')).data;
    } catch (err) { G.toast(err.message, 'error'); return; }

    let html = '';
    if (canEnter) {
      html += '<div class="tab-actions"><button class="btn btn-primary" id="btn-upload">+ Hujjat yuklash</button></div>';
    }
    html += '<div class="card" style="padding:6px 20px">';
    if (!rows.length) {
      html += '<div class="empty-state"><div class="big">📁</div>Hujjatlar yuklanmagan</div>';
    }
    for (const d of rows) {
      const size = d.file_size ? (d.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';
      html += '<div class="doc-item"><div class="doc-ico">📄</div><div>' +
        '<div class="d-title">' + G.esc(d.title) + '</div>' +
        '<div class="d-meta">' + G.esc(DOC_LABELS[d.type] || d.type) + ' · ' + size +
        ' · ' + fmtDate(d.created_at) + ' · ' + G.esc(d.uploaded_by_name || '') + '</div></div>' +
        '<div class="d-act"><a class="btn btn-secondary" style="padding:6px 12px;font-size:12px" ' +
        'href="#" data-download="' + d.id + '">Yuklab olish</a></div></div>';
    }
    html += '</div>';
    pane.innerHTML = html;

    const uploadBtn = document.getElementById('btn-upload');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        document.getElementById('u-title').value = '';
        document.getElementById('u-file').value = '';
        document.getElementById('upload-error').style.display = 'none';
        openModal('upload-backdrop');
      });
    }
    pane.querySelectorAll('[data-download]').forEach((a) => a.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/documents/' + a.dataset.download + '/download', {
          headers: { Authorization: 'Bearer ' + G.Session.accessToken },
        });
        if (!res.ok) throw new Error('Yuklab olishda xato');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const cd = res.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename="?([^";]+)"?/);
        link.download = m ? decodeURIComponent(m[1]) : 'hujjat';
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) { G.toast(err.message, 'error'); }
    }));
  }

  document.getElementById('btn-upload-confirm').addEventListener('click', async () => {
    const errBox = document.getElementById('upload-error');
    errBox.style.display = 'none';
    const file = document.getElementById('u-file').files[0];
    const title = document.getElementById('u-title').value.trim();
    if (!file || !title) {
      errBox.textContent = 'Hujjat nomi va fayl majburiy';
      errBox.style.display = 'block';
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    fd.append('type', document.getElementById('u-type').value);
    try {
      const res = await fetch('/api/gerpi/' + orgId + '/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + G.Session.accessToken },
        body: fd,
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error ? body.error.message : 'Xato');
      closeModal('upload-backdrop');
      G.toast('Hujjat yuklandi');
      renderDocuments();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  });

  // ---------- Alerts tab ----------
  function renderAlerts() {
    const pane = document.getElementById('tab-alerts');
    let html = '<div class="card" style="padding:6px 20px">';
    if (!org.alerts.length) {
      html += '<div class="empty-state"><div class="big">✓</div>Ochiq ogohlantirishlar yo\'q</div>';
    }
    for (const a of org.alerts) {
      html += '<div class="alert-item"><div class="sev-dot ' + G.esc(a.severity) + '"></div><div>' +
        '<div class="a-title">' + G.esc(a.title) + '</div>' +
        '<div class="a-desc">' + G.esc(a.description || '') + '</div>' +
        '<div class="a-meta">' + (a.rule_code ? 'Qoida: ' + G.esc(a.rule_code) + ' · ' : '') + fmtDate(a.created_at) + '</div>' +
        '</div></div>';
    }
    html += '</div>';
    pane.innerHTML = html;

    const badge = document.getElementById('alert-badge');
    if (org.alerts.length) {
      badge.textContent = org.alerts.length;
      badge.hidden = false;
    }
  }

  // ---------- Init ----------
  async function init() {
    try {
      org = (await G.api('/api/gerpi/' + orgId)).data;
    } catch (err) {
      G.toast(err.message, 'error');
      setTimeout(() => { location.href = '/orgs.html'; }, 1200);
      return;
    }
    renderHead();
    renderOverview();
    renderAlerts();
    renderDisbursements();
    renderComponents();
    renderProcurements();
    renderDocuments();
  }

  init();
})();
