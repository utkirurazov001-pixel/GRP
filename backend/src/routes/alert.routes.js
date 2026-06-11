const router = require('express').Router();
const alertService = require('../services/alert.service');
const { writeAudit } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth');
const { ok } = require('../utils/respond');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { rows, meta } = await alertService.list(req.user, req.query);
    ok(res, rows, meta);
  } catch (err) { next(err); }
});

router.patch('/:id/resolve', async (req, res, next) => {
  try {
    const { row, old } = await alertService.resolve(req.user, req.params.id, (req.body || {}).note);
    await writeAudit(req, { action: 'update', entityType: 'alert', entityId: row.id, oldValue: old, newValue: row });
    ok(res, row);
  } catch (err) { next(err); }
});

module.exports = router;
