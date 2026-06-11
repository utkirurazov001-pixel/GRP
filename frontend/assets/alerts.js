(function () {
  'use strict';
  const G = window.GERPI;
  if (!G.requireAuth()) return;

  G.renderLayout('/alerts.html', '<a href="/dashboard.html">Boshqaruv paneli</a> / <b>Ogohlantirishlar</b>');

  const user = G.Session.user;
  const canResolve = ['admin', 'mof_supervisor'].includes(user.role);

  const SEV_LABELS = { yuqori: 'Yuqori', orta: "O'rta", past: 'Past' };
  const TYPE_LABELS = {
    ozlashtirish_past: "O'zlashtirish past", hisobot_kechikkan: 'Hisobot kechikkan',
    muddat_yaqin: 'Muddat yaqin', xarid_muammo: 'Xarid muammosi',
    audit_nomuvofiqlik: 'Audit nomuvofiqligi', hujjat_kutilmoqda: 'Hujjat kutilmoqda',
    eslatma: 'Eslatma',
  };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('uz-UZ') : '—';

  const state = { page: 1, limit: 15, filters: { status: 'open' } };
  let resolveTargetId = null;

  const list = document.getElementById('alerts-list');
  const pagination = document.getElementById('pagination');

  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer.dataset.close);
    if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('open');
  });

  function itemHtml(a) {
    let action = '';
    if (canResolve && !a.is_resolved) {
      action = '<div class="d-act"><button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" data-resolve="' + a.id + '">Hal qilindi</button></div>';
    }
    let resolved = '';
    if (a.is_resolved) {
      resolved = '<div class="review-box" style="margin-top:7px">✓ ' + fmtDate(a.resolved_at) + ' · ' +
        G.esc(a.resolved_by_name || '') + ': ' + G.esc(a.resolution_note || '') + '</div>';
    }
    return '<div class="alert-item"' + (a.is_resolved ? ' style="opacity:.62"' : '') + '>' +
      '<div class="sev-dot ' + G.esc(a.severity) + '"></div><div style="flex:1">' +
      '<div class="a-title">' + G.esc(a.title) + '</div>' +
      '<div class="a-desc">' + G.esc(a.description || '') + '</div>' +
      '<div class="a-meta"><a href="/org-detail.html?id=' + a.gerpi_id + '">' + G.esc(a.gerpi_name) + '</a>' +
      ' · ' + G.esc(TYPE_LABELS[a.type] || a.type) +
      (a.rule_code ? ' · Qoida: ' + G.esc(a.rule_code) : '') +
      ' · ' + fmtDate(a.created_at) + '</div>' + resolved + '</div>' + action + '</div>';
  }

  async function load() {
    const params = new URLSearchParams({ page: state.page, limit: state.limit });
    for (const [k, v] of Object.entries(state.filters)) if (v) params.set(k, v);
    let body;
    try {
      body = await G.api('/api/alerts?' + params);
    } catch (err) { G.toast(err.message, 'error'); return; }

    if (!body.data.length) {
      list.innerHTML = '<div class="empty-state"><div class="big">✓</div>Ogohlantirishlar topilmadi</div>';
      pagination.innerHTML = '';
      return;
    }
    list.innerHTML = body.data.map(itemHtml).join('');
    renderPagination(body.meta);

    list.querySelectorAll('[data-resolve]').forEach((b) => b.addEventListener('click', () => {
      resolveTargetId = b.dataset.resolve;
      document.getElementById('resolve-note').value = '';
      document.getElementById('resolve-error').style.display = 'none';
      openModal('resolve-backdrop');
    }));
  }

  function renderPagination(meta) {
    let html = '<span>Jami: ' + meta.total + ' ta</span><span class="spacer"></span>';
    html += '<button class="page-btn" data-page="' + (meta.page - 1) + '"' + (meta.page <= 1 ? ' disabled' : '') + '>‹</button>';
    for (let p = 1; p <= meta.pages; p++) {
      html += '<button class="page-btn' + (p === meta.page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    html += '<button class="page-btn" data-page="' + (meta.page + 1) + '"' + (meta.page >= meta.pages ? ' disabled' : '') + '>›</button>';
    pagination.innerHTML = html;
  }

  pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    state.page = parseInt(btn.dataset.page, 10);
    load();
  });

  for (const [id, key] of [['f-severity', 'severity'], ['f-type', 'type'], ['f-status', 'status'], ['f-gerpi', 'gerpi_id']]) {
    document.getElementById(id).addEventListener('change', (e) => {
      state.filters[key] = e.target.value;
      state.page = 1;
      load();
    });
  }

  document.getElementById('btn-resolve-confirm').addEventListener('click', async () => {
    const errBox = document.getElementById('resolve-error');
    try {
      await G.api('/api/alerts/' + resolveTargetId + '/resolve', {
        method: 'PATCH',
        body: JSON.stringify({ note: document.getElementById('resolve-note').value }),
      });
      closeModal('resolve-backdrop');
      G.toast('Ogohlantirish hal qilindi');
      load();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  });

  // GERPI filter options
  (async () => {
    try {
      const orgs = (await G.api('/api/gerpi?limit=100')).data;
      const sel = document.getElementById('f-gerpi');
      for (const o of orgs) {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name_uz_latn;
        sel.appendChild(opt);
      }
    } catch { /* filter stays empty */ }
  })();

  // Live updates
  G.connectSocket((alert) => {
    G.toast('Yangi ogohlantirish: ' + alert.title, 'error');
    load();
  });

  load();
})();
