/** Ilova qobig'i: hash-router + sidebar + topbar + Socket.IO jonli alertlar. */
import { session, logout, api } from "./api.js";
import { initI18n, t, setLocale, langSwitcherHtml } from "./i18n.js";
import { toast, destroyCharts } from "./ui.js";

import { renderLogin } from "./pages/login.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderRegistry } from "./pages/registry.js";
import { renderOrg } from "./pages/org.js";
import { renderMap } from "./pages/map.js";
import { renderAlerts } from "./pages/alerts.js";
import { renderDataEntry } from "./pages/dataentry.js";
import { renderReports } from "./pages/reports.js";
import { renderAdmin } from "./pages/admin.js";

const ROUTES = [
  { path: "dashboard", render: renderDashboard, nav: "nav_dashboard", ico: "📊" },
  { path: "registry", render: renderRegistry, nav: "nav_registry", ico: "🗂" },
  { path: "map", render: renderMap, nav: "nav_map", ico: "🗺" },
  { path: "alerts", render: renderAlerts, nav: "nav_alerts", ico: "🔔" },
  { path: "data-entry", render: renderDataEntry, nav: "nav_data_entry", ico: "📝", roles: ["gerpi_staff", "admin"] },
  { path: "reports", render: renderReports, nav: "nav_reports", ico: "📄" },
  { path: "admin", render: renderAdmin, nav: "nav_admin", ico: "⚙️", roles: ["admin", "mof_supervisor"] },
];

let socket = null;

function visibleRoutes() {
  const role = session.user?.role;
  return ROUTES.filter((r) => !r.roles || r.roles.includes(role));
}

function shellHtml(activePath, crumb) {
  const u = session.user;
  const initials = (u.full_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return `
  ${session.demoMode ? `<div class="demo-banner">⚠ ${t("demo_banner")}</div>` : ""}
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="logo"><div class="emblem">G</div><div>GERPI<br><span style="font-size:10px;font-weight:500;color:#7f95ac">MONITORING</span></div></div>
        <small>${t("app_subtitle")}</small>
      </div>
      <nav class="nav" id="nav">
        ${visibleRoutes().map((r) => `
          <a href="#/${r.path}" class="${r.path === activePath ? "active" : ""}" data-nav="${r.path}">
            <span class="ico">${r.ico}</span> ${t(r.nav)}
            ${r.path === "alerts" ? '<span class="nav-badge" id="alert-badge" style="display:none"></span>' : ""}
          </a>`).join("")}
      </nav>
      <div class="userbox">
        <div class="avatar">${initials}</div>
        <div class="uinfo"><b>${u.full_name}</b><span>${t("role_" + u.role)}</span></div>
        <button class="logout-btn" id="logout-btn" title="${t("logout")}">⏻</button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <button class="hamburger" id="hamburger">☰</button>
        <div class="breadcrumb">${t("app_name")} / <b id="crumb">${crumb}</b></div>
        <div class="lang-switch" id="lang-switch">${langSwitcherHtml()}</div>
      </div>
      <div class="content" id="content"></div>
    </div>
  </div>`;
}

async function navigate() {
  destroyCharts();
  const app = document.getElementById("app");
  const hash = location.hash.replace(/^#\//, "") || "dashboard";
  const [path, param] = hash.split("/");

  if (!session.isAuthed) {
    if (socket) { socket.disconnect(); socket = null; }
    renderLogin(app, () => { location.hash = "#/dashboard"; navigate(); });
    return;
  }

  let route = ROUTES.find((r) => r.path === path);
  let renderFn = route?.render;
  let crumbKey = route?.nav;
  if (path === "org" && param) {
    renderFn = (el) => renderOrg(el, param);
    crumbKey = "nav_registry";
  }
  if (!renderFn || (route?.roles && !route.roles.includes(session.user.role))) {
    renderFn = renderDashboard;
    crumbKey = "nav_dashboard";
  }

  app.innerHTML = shellHtml(path, t(crumbKey || "nav_dashboard"));
  wireShell();
  connectSocket();
  updateAlertBadge();
  await renderFn(document.getElementById("content"));
}

function wireShell() {
  document.getElementById("logout-btn").onclick = () => {
    logout();
    location.hash = "#/login";
  };
  document.getElementById("hamburger").onclick = () =>
    document.getElementById("sidebar").classList.toggle("open");
  document.querySelectorAll("#nav a").forEach((a) =>
    a.addEventListener("click", () => document.getElementById("sidebar").classList.remove("open")));
  document.getElementById("lang-switch").querySelectorAll("button").forEach((b) => {
    b.onclick = async () => { await setLocale(b.dataset.lang); navigate(); };
  });
}

async function updateAlertBadge() {
  const r = await api("/api/alerts?is_resolved=false&limit=1");
  const badge = document.getElementById("alert-badge");
  if (badge && r.success && r.meta?.total > 0) {
    badge.textContent = r.meta.total;
    badge.style.display = "";
  }
}

function connectSocket() {
  if (socket || typeof io === "undefined") return;
  socket = io({ auth: { token: session.token } });
  socket.on("alert:new", (a) => {
    toast(`🔔 ${t("msg_new_alert")}: ${a.title}`, a.severity === "yuqori" ? "error" : "info");
    updateAlertBadge();
  });
}

window.addEventListener("hashchange", navigate);
initI18n().then(navigate);
