const analyticsService = require('../services/analytics.service');
const { ok } = require('../utils/respond');

async function dashboard(req, res, next) {
  try {
    return ok(res, await analyticsService.dashboard(req.user));
  } catch (err) { return next(err); }
}

module.exports = { dashboard };
