/** API mijozi: JWT access (15min) + refresh rotation, yagona javob konvensiyasi. */

const store = {
  get access() { return localStorage.getItem("gerpi_access"); },
  set access(v) { v ? localStorage.setItem("gerpi_access", v) : localStorage.removeItem("gerpi_access"); },
  get refresh() { return localStorage.getItem("gerpi_refresh"); },
  set refresh(v) { v ? localStorage.setItem("gerpi_refresh", v) : localStorage.removeItem("gerpi_refresh"); },
  get user() { try { return JSON.parse(localStorage.getItem("gerpi_user")); } catch { return null; } },
  set user(v) { v ? localStorage.setItem("gerpi_user", JSON.stringify(v)) : localStorage.removeItem("gerpi_user"); },
};

export const session = {
  get user() { return store.user; },
  get isAuthed() { return !!store.access && !!store.user; },
  get token() { return store.access; },
  demoMode: localStorage.getItem("gerpi_demo") === "true",
};

async function tryRefresh() {
  if (!store.refresh) return false;
  const r = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: store.refresh }),
  });
  const j = await r.json().catch(() => null);
  if (j?.success) {
    store.access = j.data.access_token;
    store.refresh = j.data.refresh_token;
    store.user = j.data.user;
    return true;
  }
  return false;
}

/** Asosiy so'rov. 401 da bir marta refresh qilib qayta urinadi. */
export async function api(path, opts = {}, retried = false) {
  const headers = { ...(opts.headers || {}) };
  if (store.access) headers.Authorization = `Bearer ${store.access}`;
  if (opts.body && !(opts.body instanceof FormData) && !headers["content-type"]) {
    headers["content-type"] = "application/json";
    opts = { ...opts, body: JSON.stringify(opts.body) };
  }
  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401 && !retried && (await tryRefresh())) {
    return api(path, opts, true);
  }
  const json = await res.json().catch(() => ({ success: false, error: { message: "Server javobi o'qilmadi" } }));
  if (res.status === 401) {
    logout();
    location.hash = "#/login";
  }
  return json;
}

export async function login(email, password) {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json().catch(() => null);
  if (j?.success) {
    store.access = j.data.access_token;
    store.refresh = j.data.refresh_token;
    store.user = j.data.user;
    localStorage.setItem("gerpi_demo", String(!!j.data.demo_mode));
    session.demoMode = !!j.data.demo_mode;
  }
  return j;
}

export function logout() {
  if (store.refresh) {
    fetch("/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: store.refresh }),
    }).catch(() => {});
  }
  store.access = null;
  store.refresh = null;
  store.user = null;
}

/** Token bilan fayl yuklab olish (eksportlar) */
export async function downloadFile(path, filename) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${store.access}` } });
  if (!res.ok) throw new Error("Yuklab olishda xato");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || path.split("/").pop();
  a.click();
  URL.revokeObjectURL(url);
}

export const fmtMoney = (n) => {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)} mlrd`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)} mln`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};
export const fmtNum = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(localStorage.getItem("gerpi_locale") === "en" ? "en-GB" : "ru-RU") : "—");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
