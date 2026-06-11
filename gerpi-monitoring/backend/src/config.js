import "dotenv/config";

/** Barcha konstantalar — yagona manba. */
export const CONFIG = {
  PORT: Number(process.env.PORT || 4000),
  DEMO_MODE: String(process.env.DEMO_MODE ?? "true") === "true",
  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
    ACCESS_TTL: "15m",
    REFRESH_TTL_DAYS: 7,
  },
  BCRYPT_ROUNDS: 12,
  RATE_LIMIT: { WINDOW_MS: 60_000, MAX: 100 },
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "http://localhost:4000")
    .split(",").map((s) => s.trim()).filter(Boolean),
  UPLOADS: {
    DIR: new URL("../uploads/", import.meta.url).pathname,
    MAX_BYTES: 20 * 1024 * 1024,
    ALLOWED_MIME: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
    ],
  },
  // Risk ball formulasi (6-bo'lim, master prompt)
  RISK: {
    GAP_HIGH: { THRESHOLD: 15, SCORE: 40 },
    GAP_MID: { MIN: 8, MAX: 15, SCORE: 20 },
    LATE_REPORT_PER_7D: 10,
    LATE_REPORT_MAX: 30,
    CLOSING_SOON: { MONTHS: 12, DISB_BELOW: 70, SCORE: 20 },
    AUDIT_FINDING: 15,
    TENDER_CANCELLED: 10,
    LEVELS: { PAST_MAX: 25, ORTA_MAX: 55 }, // 0-25 past, 26-55 orta, 56+ yuqori
  },
  REPORT_DEADLINE_DAYS: 15, // chorak tugagach 15 kun ichida hisobot
  ALERT_CRON: "0 6 * * *", // har kuni 06:00
  ROLES: ["admin", "mof_supervisor", "ministry_officer", "gerpi_staff", "donor_viewer"],
  GERPI_STATUSES: ["tayyorgarlik", "faol", "kechikayotgan", "yakunlangan", "toxtatilgan"],
  REPORT_STATUSES: ["qoralama", "topshirilgan", "tasdiqlangan", "qaytarilgan"],
  PROCUREMENT_METHODS: ["ICB", "NCB", "shopping", "direct", "QCBS", "boshqa"],
  PROCUREMENT_STATUSES: ["rejalashtirilgan", "elon_qilingan", "baholashda", "imzolangan", "bekor_qilingan"],
  DOCUMENT_TYPES: ["choraklik_hisobot", "yillik_reja", "audit_hisoboti", "donor_missiya", "shartnoma", "boshqa"],
  ALERT_TYPES: ["ozlashtirish_past", "hisobot_kechikkan", "muddat_yaqin", "xarid_muammo", "audit_nomuvofiqlik", "hujjat_kutilmoqda", "eslatma"],
  LOCALES: ["uz_latn", "uz_cyrl", "ru", "en"],
};
