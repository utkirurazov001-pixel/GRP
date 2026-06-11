/* GERPI Monitoring — shared frontend core: API client, auth/session, layout shell, helpers */
(function () {
  'use strict';

  const TOKEN_KEY = 'gerpi_access';
  const REFRESH_KEY = 'gerpi_refresh';
  const USER_KEY = 'gerpi_user';

  // ---------- Session ----------
  const Session = {
    get user() {
      try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    },
    save(data) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    },
    get accessToken() { return localStorage.getItem(TOKEN_KEY); },
    get refreshToken() { return localStorage.getItem(REFRESH_KEY); },
  };

  // ---------- API client with auto-refresh ----------
  async function rawFetch(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (Session.accessToken) headers.Authorization = 'Bearer ' + Session.accessToken;
    const res = await fetch(path, Object.assign({}, options, { headers }));
    const body = await res.json().catch(() => null);
    return { res, body };
  }

  async function api(path, options = {}) {
    let { res, body } = await rawFetch(path, options);
    if (res.status === 401 && Session.refreshToken) {
      const r = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: Session.refreshToken }),
      });
      const rb = await r.json().catch(() => null);
      if (r.ok && rb && rb.success) {
        Session.save(rb.data);
        ({ res, body } = await rawFetch(path, options));
      } else {
        Session.clear();
        location.href = '/index.html';
        throw new Error('Session expired');
      }
    }
    if (!body || !body.success) {
      const msg = body && body.error ? body.error.message : 'Server xatosi';
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  function requireAuth() {
    if (!Session.accessToken || !Session.user) {
      location.href = '/index.html';
      return false;
    }
    return true;
  }

  // ---------- Formatting ----------
  const fmtMoney = (v) => {
    const n = Number(v) || 0;
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + ' mlrd';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + ' mln';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + ' ming';
    return '$' + n.toFixed(0);
  };
  const fmtNum = (v) => new Intl.NumberFormat('uz-UZ').format(Number(v) || 0);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const STATUS_LABELS = {
    tayyorgarlik: 'Tayyorgarlik', faol: 'Faol', kechikayotgan: 'Kechikayotgan',
    yakunlangan: 'Yakunlangan', toxtatilgan: "To'xtatilgan",
  };
  const RISK_LABELS = { past: 'Past', orta: "O'rta", yuqori: 'Yuqori' };
  const ROLE_LABELS = {
    admin: 'Administrator', mof_supervisor: 'IMV nazoratchi', ministry_officer: 'Vazirlik mas\'uli',
    gerpi_staff: 'GERPI xodimi', donor_viewer: 'Donor vakili',
  };

  const statusPill = (s) => '<span class="pill ' + esc(s) + '">' + esc(STATUS_LABELS[s] || s) + '</span>';
  const riskPill = (r) => '<span class="pill risk-' + esc(r) + '">' + esc(RISK_LABELS[r] || r) + '</span>';

  function progressBar(pct, planned) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const gap = planned != null ? Number(planned) - p : 0;
    const cls = gap > 15 ? 'bad' : (gap > 8 ? 'warn' : '');
    return '<div class="progress-cell"><span class="pct">' + p.toFixed(0) + '%</span>' +
      '<div class="progress"><i class="' + cls + '" style="width:' + p + '%"></i></div></div>';
  }

  // ---------- Toast ----------
  function toast(message, type = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  // ---------- Layout shell ----------
  const NAV = [
    { href: '/dashboard.html', icon: '▦', label: 'Boshqaruv paneli' },
    { href: '/orgs.html', icon: '☰', label: 'GERPI reestri' },
    { href: '/data-entry.html', icon: '✎', label: "Ma'lumot kiritish", roles: ['gerpi_staff'] },
  ];

  function renderLayout(activeHref, breadcrumb) {
    const user = Session.user || {};
    const navItems = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
    const initials = (user.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML =
      '<div class="brand"><div class="brand-mark">GM</div><div>' +
      '<div class="brand-title">GERPI Monitoring</div>' +
      '<div class="brand-sub">Milliy nazorat platformasi</div></div></div>' +
      '<nav class="nav">' +
      navItems.map((n) =>
        '<a class="nav-item' + (n.href === activeHref ? ' active' : '') + '" href="' + n.href + '">' +
        '<span class="ico">' + n.icon + '</span>' + esc(n.label) + '</a>').join('') +
      '</nav>' +
      '<div class="sidebar-foot">O\'zbekiston Respublikasi<br>Iqtisodiyot va moliya vazirligi</div>';

    const topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.innerHTML =
      '<button class="hamburger" id="hamburger" aria-label="Menyu">☰</button>' +
      '<div class="breadcrumb">' + breadcrumb + '</div>' +
      '<div class="topbar-right"><div class="user-chip">' +
      '<div class="user-avatar">' + esc(initials) + '</div>' +
      '<div class="user-meta"><div class="user-name">' + esc(user.full_name || '') + '</div>' +
      '<div class="user-role">' + esc(ROLE_LABELS[user.role] || user.role || '') + '</div></div></div>' +
      '<button class="btn-logout" id="btn-logout">Chiqish</button></div>';

    const banner = document.createElement('div');
    banner.className = 'demo-banner';
    banner.textContent = 'Namunaviy ma\'lumotlar — demo rejim';

    const main = document.querySelector('.main');
    main.prepend(banner);
    main.prepend(topbar);
    document.querySelector('.layout').prepend(sidebar);

    document.getElementById('btn-logout').addEventListener('click', async () => {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
      Session.clear();
      location.href = '/index.html';
    });
    document.getElementById('hamburger').addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target.id !== 'hamburger') {
        sidebar.classList.remove('open');
      }
    });
  }

  // ---------- Chart palette ----------
  const PALETTE = ['#1b5fae', '#1aa39a', '#2e9e5b', '#e0a106', '#d64545', '#8246c9', '#16a3c4', '#5f7894'];

  window.GERPI = {
    api, Session, requireAuth, toast, esc,
    fmtMoney, fmtNum, statusPill, riskPill, progressBar,
    STATUS_LABELS, RISK_LABELS, ROLE_LABELS, PALETTE, renderLayout,
  };
})();
