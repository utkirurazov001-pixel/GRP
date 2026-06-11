(function () {
  'use strict';
  const G = window.GERPI;
  if (!G.requireAuth()) return;

  const user = G.Session.user;
  // Page is for GERPI staff; admins may open it for testing but need a gerpi id.
  const orgId = user.gerpi_id || new URLSearchParams(location.search).get('gerpi');
  if (user.role !== 'gerpi_staff' && user.role !== 'admin') {
    location.href = '/dashboard.html';
    return;
  }
  if (!orgId) {
    location.href = '/orgs.html';
    return;
  }

  G.renderLayout('/data-entry.html', '<b>Ma\'lumot kiritish</b> / Choraklik hisobot');

  const REPORT_LABELS = {
    qoralama: 'Qoralama', topshirilgan: 'Topshirilgan',
    tasdiqlangan: 'Tasdiqlangan', qaytarilgan: 'Qaytarilgan',
  };

  let step = 1;
  let savedDraft = null; // draft row from the server

  const $ = (id) => document.getElementById(id);
  const errBox = $('wizard-error');

  // Year selector: current and previous year
  const now = new Date();
  for (const y of [now.getFullYear(), now.getFullYear() - 1]) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    $('w-year').appendChild(o);
  }
  // default to previous quarter
  const prevQ = Math.floor(now.getMonth() / 3); // 0 = previous year's Q4
  if (prevQ === 0) { $('w-year').value = now.getFullYear() - 1; $('w-quarter').value = 4; }
  else { $('w-quarter').value = prevQ; }

  function gapCheck() {
    const gap = Number($('w-planned').value) - Number($('w-pct').value);
    $('narrative-hint').hidden = !(gap > 10);
  }
  $('w-pct').addEventListener('input', gapCheck);
  $('w-planned').addEventListener('input', gapCheck);

  function showStep(n) {
    step = n;
    for (let i = 1; i <= 3; i++) {
      $('step-' + i).hidden = i !== n;
      const ws = $('ws-' + i);
      ws.classList.toggle('active', i === n);
      ws.classList.toggle('done', i < n);
    }
    $('btn-back').hidden = n === 1;
    $('btn-draft').hidden = n === 3;
    $('btn-next').textContent = n === 3 ? 'Hisobotni topshirish' : 'Keyingi ›';
    errBox.style.display = 'none';
  }

  function showError(msg) {
    errBox.textContent = msg;
    errBox.style.display = 'block';
  }

  function payload() {
    return {
      year: $('w-year').value,
      quarter: $('w-quarter').value,
      disbursed_usd_cumulative: $('w-disbursed').value,
      disbursed_pct: $('w-pct').value,
      planned_pct: $('w-planned').value,
      commitment_usd: $('w-commitment').value,
      narrative: $('w-narrative').value.trim(),
    };
  }

  function validateStep1() {
    const p = payload();
    if (p.disbursed_usd_cumulative === '' || p.disbursed_pct === '' || p.planned_pct === '') {
      showError('Yulduzcha (*) bilan belgilangan maydonlar majburiy');
      return false;
    }
    const gap = Number(p.planned_pct) - Number(p.disbursed_pct);
    if (gap > 10 && p.narrative.length < 100) {
      showError('Reja bilan farq 10% dan oshgan — kamida 100 belgilik izoh yozing (hozir: ' + p.narrative.length + ')');
      return false;
    }
    return true;
  }

  async function saveDraft() {
    const body = (await G.api('/api/gerpi/' + orgId + '/disbursements', {
      method: 'POST',
      body: JSON.stringify(payload()),
    })).data;
    savedDraft = body;
    return body;
  }

  $('btn-draft').addEventListener('click', async () => {
    if (!validateStep1()) return;
    try {
      await saveDraft();
      G.toast('Qoralama saqlandi');
      loadMyReports();
    } catch (err) { showError(err.message); }
  });

  $('btn-back').addEventListener('click', () => showStep(step - 1));

  $('btn-next').addEventListener('click', async () => {
    if (step === 1) {
      if (!validateStep1()) return;
      try {
        await saveDraft();
      } catch (err) { showError(err.message); return; }
      showStep(2);
    } else if (step === 2) {
      const p = payload();
      const file = $('w-file').files[0];
      $('confirm-grid').innerHTML =
        item('Davr', p.year + '-Q' + p.quarter) +
        item("O'zlashtirildi", G.fmtMoney(p.disbursed_usd_cumulative)) +
        item('Fakt %', Number(p.disbursed_pct).toFixed(1) + '%') +
        item('Reja %', Number(p.planned_pct).toFixed(1) + '%') +
        item('Majburiyatlar', p.commitment_usd ? G.fmtMoney(p.commitment_usd) : '—') +
        item('Biriktirilgan fayl', file ? G.esc(file.name) : '—');
      showStep(3);
    } else {
      await submitAll();
    }
  });

  function item(l, v) {
    return '<div class="detail-item"><div class="dl">' + l + '</div><div class="dv">' + v + '</div></div>';
  }

  async function submitAll() {
    const btn = $('btn-next');
    btn.disabled = true;
    try {
      if (!savedDraft) await saveDraft();
      // optional document
      const file = $('w-file').files[0];
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', savedDraft.year + '-Q' + savedDraft.quarter + ' choraklik hisobot');
        fd.append('type', 'choraklik_hisobot');
        fd.append('period_year', savedDraft.year);
        fd.append('period_quarter', savedDraft.quarter);
        const res = await fetch('/api/gerpi/' + orgId + '/documents', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + G.Session.accessToken },
          body: fd,
        });
        const body = await res.json();
        if (!body.success) throw new Error(body.error ? body.error.message : 'Fayl yuklashda xato');
      }
      await G.api('/api/disbursements/' + savedDraft.id + '/submit', { method: 'PATCH' });
      G.toast('Hisobot topshirildi — vazirlik tekshiruviga yuborildi');
      savedDraft = null;
      $('w-disbursed').value = '';
      $('w-pct').value = '';
      $('w-planned').value = '';
      $('w-commitment').value = '';
      $('w-narrative').value = '';
      $('w-file').value = '';
      showStep(1);
      loadMyReports();
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- My reports ----------
  async function loadMyReports() {
    let rows;
    try {
      rows = (await G.api('/api/gerpi/' + orgId + '/disbursements')).data;
    } catch (err) { G.toast(err.message, 'error'); return; }
    const tbody = document.getElementById('my-reports');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Hisobotlar yo\'q</div></td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => {
      let action = '';
      if (['qoralama', 'qaytarilgan'].includes(r.status)) {
        action = '<button class="btn btn-secondary" style="padding:5px 11px;font-size:12px" data-load="' + r.id + '">Davom ettirish</button>';
      }
      let row = '<tr style="cursor:default"><td class="num"><b>' + r.year + '-Q' + r.quarter + '</b></td>' +
        '<td class="num">' + Number(r.disbursed_pct).toFixed(1) + '%</td>' +
        '<td class="num">' + Number(r.planned_pct).toFixed(1) + '%</td>' +
        '<td><span class="pill ' + r.status + '">' + REPORT_LABELS[r.status] + '</span></td>' +
        '<td>' + action + '</td></tr>';
      if (r.status === 'qaytarilgan' && r.review_comment) {
        row += '<tr style="cursor:default"><td colspan="5"><div class="review-box">↩ ' + G.esc(r.review_comment) + '</div></td></tr>';
      }
      return row;
    }).join('');

    tbody.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
      const r = rows.find((x) => x.id === b.dataset.load);
      if (!r) return;
      savedDraft = r;
      $('w-year').value = r.year;
      $('w-quarter').value = r.quarter;
      $('w-disbursed').value = Number(r.disbursed_usd_cumulative);
      $('w-pct').value = Number(r.disbursed_pct);
      $('w-planned').value = Number(r.planned_pct);
      $('w-commitment').value = r.commitment_usd ? Number(r.commitment_usd) : '';
      $('w-narrative').value = r.narrative || '';
      gapCheck();
      showStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  // ---------- Init ----------
  (async function init() {
    try {
      const org = (await G.api('/api/gerpi/' + orgId)).data;
      document.getElementById('org-name-sub').textContent =
        org.name_uz_latn + ' — DCP-01: choraklik o\'zlashtirish hisoboti';
    } catch { /* sub stays generic */ }
    loadMyReports();
  })();
})();
