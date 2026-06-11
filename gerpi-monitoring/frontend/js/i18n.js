/** 4 tilli i18n: uz_latn (asosiy), uz_cyrl, ru, en. JSON lug'atlar /i18n/ dan. */

const LOCALES = ["uz_latn", "uz_cyrl", "ru", "en"];
const LABELS = { uz_latn: "O'z", uz_cyrl: "Ўз", ru: "Ру", en: "En" };
let dict = {};
let fallback = {};

export function currentLocale() {
  const l = localStorage.getItem("gerpi_locale");
  return LOCALES.includes(l) ? l : "uz_latn";
}

export async function initI18n() {
  const loc = currentLocale();
  const [d, f] = await Promise.all([
    fetch(`/i18n/${loc}.json`).then((r) => r.json()),
    loc === "uz_latn" ? Promise.resolve(null) : fetch(`/i18n/uz_latn.json`).then((r) => r.json()),
  ]);
  dict = d;
  fallback = f || d;
}

export const t = (key) => dict[key] ?? fallback[key] ?? key;

export async function setLocale(loc) {
  if (!LOCALES.includes(loc)) return;
  localStorage.setItem("gerpi_locale", loc);
  await initI18n();
}

/** GERPI/hudud nomini joriy tilda olish (name_uz_latn ... ustunlaridan) */
export function localName(row, base = "name") {
  const loc = currentLocale();
  return row[`${base}_${loc}`] || row[`${base}_uz_latn`] || row[base] || "—";
}

export function langSwitcherHtml() {
  const cur = currentLocale();
  return LOCALES.map((l) =>
    `<button data-lang="${l}" class="${l === cur ? "active" : ""}">${LABELS[l]}</button>`
  ).join("");
}
