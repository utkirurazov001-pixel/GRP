const gerpiService = require('../services/gerpi.service');
const { writeAudit } = require('../services/audit.service');
const { ok } = require('../utils/respond');

async function list(req, res, next) {
  try {
    const { rows, meta } = await gerpiService.list(req.user, req.query);
    return ok(res, rows, meta);
  } catch (err) { return next(err); }
}

async function getById(req, res, next) {
  try {
    return ok(res, await gerpiService.getById(req.user, req.params.id));
  } catch (err) { return next(err); }
}

async function create(req, res, next) {
  try {
    const row = await gerpiService.create(req.body || {});
    await writeAudit(req, { action: 'create', entityType: 'gerpi_organization', entityId: row.id, newValue: row });
    return ok(res, row, null, 201);
  } catch (err) { return next(err); }
}

async function update(req, res, next) {
  try {
    const { old, row } = await gerpiService.update(req.user, req.params.id, req.body || {});
    await writeAudit(req, {
      action: 'update', entityType: 'gerpi_organization', entityId: row.id, oldValue: old, newValue: row,
    });
    return ok(res, row);
  } catch (err) { return next(err); }
}

async function remove(req, res, next) {
  try {
    const old = await gerpiService.softDelete(req.params.id);
    await writeAudit(req, { action: 'delete', entityType: 'gerpi_organization', entityId: old.id, oldValue: old });
    return ok(res, { id: old.id, deleted: true });
  } catch (err) { return next(err); }
}

async function history(req, res, next) {
  try {
    return ok(res, await gerpiService.history(req.user, req.params.id));
  } catch (err) { return next(err); }
}

module.exports = { list, getById, create, update, remove, history };
