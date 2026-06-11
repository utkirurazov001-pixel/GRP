import cron from "node-cron";
import { CONFIG } from "../config.js";
import { runAlertEngine } from "../services/alertEngine.js";
import { takeKpiSnapshot } from "../services/snapshots.js";
import { currentQuarter, prevQuarter } from "../utils/quarters.js";

/** Har kuni 06:00 (Toshkent): qoidalar dvigateli + joriy chorak snapshot. */
export function startJobs(io) {
  cron.schedule(CONFIG.ALERT_CRON, async () => {
    try {
      await runAlertEngine({ io });
      const q = prevQuarter(currentQuarter());
      await takeKpiSnapshot(q.year, q.quarter);
    } catch (e) {
      console.error("Cron xatosi:", e);
    }
  }, { timezone: "Asia/Tashkent" });
  console.log(`✓ Cron rejalashtirildi: ${CONFIG.ALERT_CRON} (Asia/Tashkent)`);
}
