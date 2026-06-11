import { login } from "../api.js";
import { t, langSwitcherHtml, setLocale } from "../i18n.js";

/** P1: Rasmiy login sahifa — ikki ustun, til tanlash. */
export function renderLogin(el, onSuccess) {
  el.innerHTML = `
  <div class="login-page">
    <div class="login-left">
      <div class="emblem-lg">🇺🇿</div>
      <h1>${t("app_name")}</h1>
      <p>${t("app_subtitle")}</p>
      <div class="login-points">
        <div>✅ ${t("login_point1")}</div>
        <div>✅ ${t("login_point2")}</div>
        <div>✅ ${t("login_point3")}</div>
      </div>
    </div>
    <div class="login-right">
      <div class="login-card">
        <div style="display:flex;justify-content:flex-end;margin-bottom:14px"><div class="lang-switch" id="login-lang">${langSwitcherHtml()}</div></div>
        <div class="card">
          <h2>${t("login_title")}</h2>
          <div class="sub">${t("login_sub")}</div>
          <div class="login-error" id="login-error"></div>
          <form id="login-form">
            <div class="field"><label>${t("login_email")}</label>
              <input type="email" id="lg-email" required autocomplete="username" placeholder="admin@gerpi.uz"></div>
            <div class="field"><label>${t("login_password")}</label>
              <input type="password" id="lg-pass" required autocomplete="current-password" placeholder="••••••••"></div>
            <button class="btn" style="width:100%;justify-content:center" id="lg-btn">${t("login_btn")}</button>
          </form>
        </div>
      </div>
    </div>
  </div>`;

  el.querySelector("#login-lang").querySelectorAll("button").forEach((b) => {
    b.onclick = async () => { await setLocale(b.dataset.lang); renderLogin(el, onSuccess); };
  });

  el.querySelector("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = el.querySelector("#lg-btn");
    const err = el.querySelector("#login-error");
    btn.disabled = true;
    err.style.display = "none";
    const r = await login(el.querySelector("#lg-email").value.trim(), el.querySelector("#lg-pass").value);
    btn.disabled = false;
    if (r?.success) onSuccess();
    else {
      err.textContent = r?.error?.message || t("msg_error");
      err.style.display = "block";
    }
  });
}
