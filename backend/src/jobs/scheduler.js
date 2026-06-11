// Cron wiring: daily 06:00 alert engine + snapshot check, plus a warm-up
// run shortly after server start so demo data is always evaluated.
const cron = require('node-cron');
const alertEngine = require('./alert-engine');
const kpiSnapshot = require('./kpi-snapshot');

function start() {
  cron.schedule('0 6 * * *', async () => {
    try {
      await alertEngine.runAll();
      await kpiSnapshot.ensureSnapshot();
    } catch (err) {
      console.error('[scheduler] daily job failed:', err.message);
    }
  });

  setTimeout(async () => {
    try {
      await alertEngine.runAll();
      await kpiSnapshot.ensureSnapshot();
    } catch (err) {
      console.error('[scheduler] warm-up run failed:', err.message);
    }
  }, 3000);
}

module.exports = { start };
