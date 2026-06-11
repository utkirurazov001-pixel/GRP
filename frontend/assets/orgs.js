(function () {
  'use strict';
  const G = window.GERPI;
  if (!G.requireAuth()) return;

  G.renderLayout('/orgs.html', '<a href="/dashboard.html">Boshqaruv paneli</a> / <b>GERPI reestri</b>');

  const user = G.Session.user;
  const canEdit = ['admin', 'mof_supervisor'].includes(user.role);
  const canDelete = user.role === 'admin';

  const state = { page: 1, limit: 10, sort: 'name', dir: 'asc', filters: {} };
  let editingId = null;

  const tbody = document.getElementById('orgs-tbody');
  const pagination = document.getElementById('pagination');

  if (canEdit) {
    document.getElementById('btn-add').hidden = false;
    document.getElementById('th-actions').hidden = false;
  }
  const colCount = canEdit ? 9 : 8;

  // ---------- Reference data ----------
  async function loadMeta() {
    const [ministries, donors] = await Promise.all([
      G.api('/api/meta/ministries'), G.api('/api/meta/donors'),
    ]);
    const fill = (selectIds, rows, labelFn) => {
      for (const sid of selectIds) {
        const sel = document.getElementById(sid);
        for (const r of rows) {
          const o = document.createElement('option');
          o.value = r.id;
          o.textContent = labelFn(r);
          sel.appendChild(o);
        }
      }
    };
    fill(['f-ministry', 'e-ministry'], ministries.data, (m) => m.name_uz_latn);
    fill(['f-donor', 'e-donor'], donors.data, (d) => d.short_name + ' — ' + d.name);
  }

  // ---------- Table ----------
  function skeletonRows() {
    tbody.innerHTML = Array.from({ length: 6 }, () =>
      '<tr><td colspan="' + colCount + '"><div class="skeleton" style="height:20px"></div></td></tr>').join('');
  }

  function rowHtml(o) {
    const period = (o.start_year || '—') + '–' + (o.end_year || '—');
    let actions = '';
    if (canEdit) {
      actions = '<td style="white-space:nowrap">' +
        '<button class="icon-btn" title="Tahrirlash" data-edit="' + o.id + '">✎</button>' +
        (canDelete ? ' <button class="icon-btn" title="O\'chirish" data-del="' + o.id + '">🗑</button>' : '') +
        '</td>';
    }
    return '<tr data-id="' + o.id + '">' +
      '<td class="org-name">' + G.esc(o.name_uz_latn) +
      '<small>' + G.esc(o.agreement_number || '') + '</small></td>' +
      '<td>' + G.esc(o.ministry_name || '—') + '</td>' +
      '<td>' + G.esc(o.donor_short || '—') + '</td>' +
      '<td class="num">' + G.fmtMoney(o.budget_total_usd) + '</td>' +
      '<td>' + G.progressBar(o.disbursed_pct || 0, o.planned_pct) + '</td>' +
      '<td class="num">' + period + '</td>' +
      '<td>' + G.statusPill(o.status) + '</td>' +
      '<td>' + G.riskPill(o.risk_level) + '</td>' +
      actions +
      '</tr>';
  }

  async function loadList() {
    skeletonRows();
    const params = new URLSearchParams({
      page: state.page, limit: state.limit, sort: state.sort, dir: state.dir,
    });
    for (const [k, v] of Object.entries(state.filters)) if (v) params.set(k, v);
    let body;
    try {
      body = await G.api('/api/gerpi?' + params);
    } catch (err) {
      G.toast(err.message, 'error');
      tbody.innerHTML = '<tr><td colspan="' + colCount + '"><div class="empty-state">Xatolik yuz berdi</div></td></tr>';
      return;
    }
    if (!body.data.length) {
      tbody.innerHTML = '<tr><td colspan="' + colCount + '"><div class="empty-state">' +
        '<div class="big">🗂</div>Hech narsa topilmadi — filtrlarni o\'zgartirib ko\'ring</div></td></tr>';
      pagination.innerHTML = '';
      return;
    }
    tbody.innerHTML = body.data.map(rowHtml).join('');
    renderPagination(body.meta);
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
    loadList();
  });

  // ---------- Filters / search / sort ----------
  let searchTimer;
  document.getElementById('f-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.q = e.target.value.trim();
      state.page = 1;
      loadList();
    }, 300);
  });
  for (const [id, key] of [['f-ministry', 'ministry_id'], ['f-donor', 'donor_id'], ['f-status', 'status'], ['f-risk', 'risk_level']]) {
    document.getElementById(id).addEventListener('change', (e) => {
      state.filters[key] = e.target.value;
      state.page = 1;
      loadList();
    });
  }
  document.querySelector('#orgs-table thead').addEventListener('click', (e) => {
    const th = e.target.closest('.sortable');
    if (!th) return;
    const col = th.dataset.sort;
    if (state.sort === col) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    else { state.sort = col; state.dir = 'asc'; }
    loadList();
  });

  // ---------- Modals ----------
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer.dataset.close);
    if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('open');
  });

  // ---------- Row actions: open profile page, edit, delete ----------
  tbody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      try {
        const o = (await G.api('/api/gerpi/' + editBtn.dataset.edit)).data;
        openEdit(o);
      } catch (err) { G.toast(err.message, 'error'); }
      return;
    }
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      const name = delBtn.closest('tr').querySelector('.org-name').childNodes[0].textContent;
      if (!confirm('Rostdan ham "' + name + '" reestrdan o\'chirilsinmi?')) return;
      try {
        await G.api('/api/gerpi/' + delBtn.dataset.del, { method: 'DELETE' });
        G.toast('GERPI reestrdan o\'chirildi');
        loadList();
      } catch (err) { G.toast(err.message, 'error'); }
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (tr) location.href = '/org-detail.html?id=' + tr.dataset.id;
  });

  // ---------- Create / edit ----------
  const F = (id) => document.getElementById(id);

  document.getElementById('btn-add').addEventListener('click', () => openEdit(null));

  function openEdit(o) {
    editingId = o ? o.id : null;
    document.getElementById('edit-title').textContent = o ? 'GERPI tahrirlash' : 'Yangi GERPI';
    document.getElementById('edit-error').style.display = 'none';
    F('e-name').value = o ? o.name_uz_latn : '';
    F('e-ministry').value = o ? o.ministry_id : '';
    F('e-donor').value = o ? o.donor_id : '';
    F('e-budget').value = o ? Number(o.budget_total_usd) : '';
    F('e-agreement').value = o ? (o.agreement_number || '') : '';
    F('e-start').value = o ? (o.start_year || '') : '';
    F('e-end').value = o ? (o.end_year || '') : '';
    F('e-closing').value = o && o.closing_date ? String(o.closing_date).slice(0, 10) : '';
    F('e-status').value = o ? o.status : 'tayyorgarlik';
    F('e-director').value = o ? (o.director_name || '') : '';
    F('e-phone').value = o ? (o.director_phone || '') : '';
    openModal('edit-backdrop');
  }

  document.getElementById('btn-save').addEventListener('click', async () => {
    const errBox = document.getElementById('edit-error');
    errBox.style.display = 'none';
    const payload = {
      name_uz_latn: F('e-name').value.trim(),
      ministry_id: F('e-ministry').value,
      donor_id: F('e-donor').value,
      budget_total_usd: F('e-budget').value,
      agreement_number: F('e-agreement').value.trim(),
      start_year: F('e-start').value ? parseInt(F('e-start').value, 10) : null,
      end_year: F('e-end').value ? parseInt(F('e-end').value, 10) : null,
      closing_date: F('e-closing').value || null,
      status: F('e-status').value,
      director_name: F('e-director').value.trim(),
      director_phone: F('e-phone').value.trim(),
    };
    if (!payload.name_uz_latn || !payload.ministry_id || !payload.donor_id || payload.budget_total_usd === '') {
      errBox.textContent = 'Yulduzcha (*) bilan belgilangan maydonlar majburiy';
      errBox.style.display = 'block';
      return;
    }
    try {
      if (editingId) {
        await G.api('/api/gerpi/' + editingId, { method: 'PATCH', body: JSON.stringify(payload) });
        G.toast('GERPI ma\'lumotlari yangilandi');
      } else {
        await G.api('/api/gerpi', { method: 'POST', body: JSON.stringify(payload) });
        G.toast('Yangi GERPI reestrga qo\'shildi');
      }
      closeModal('edit-backdrop');
      loadList();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  });

  // ---------- Init ----------
  loadMeta().catch((err) => G.toast(err.message, 'error'));
  loadList();
})();
