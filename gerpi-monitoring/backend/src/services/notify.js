import { db } from "../db.js";

/**
 * Yuqori darajali alert bildirishnomasi: Telegram (telegram_chat_id mavjud
 * foydalanuvchilarga). Email uchun SMTP_URL sozlansa kengaytiriladi.
 * Token yo'q bo'lsa jimgina o'tkazib yuboriladi — demo rejimda xato bermaydi.
 */
export async function notifyHighAlert(org, alert) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  // Qabul qiluvchilar: GERPI xodimlari, vazirlik mas'uli, MoF nazoratchilar
  const recipients = await db("users")
    .whereNotNull("telegram_chat_id")
    .where("is_active", true)
    .where((q) =>
      q.where({ gerpi_id: org.id })
        .orWhere({ ministry_id: org.ministry_id, role: "ministry_officer" })
        .orWhere({ role: "mof_supervisor" })
    );
  const text = `🚨 GERPI MONITORING\n${org.name_uz_latn}\n[${alert.severity.toUpperCase()}] ${alert.title}\n${alert.description || ""}`;
  for (const u of recipients) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: u.telegram_chat_id, text }),
    }).catch(() => {});
  }
}
