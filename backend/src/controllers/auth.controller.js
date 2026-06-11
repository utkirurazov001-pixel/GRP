const authService = require('../services/auth.service');
const { writeAudit } = require('../services/audit.service');
const { ok, fail } = require('../utils/respond');

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, 400, 'BAD_REQUEST', 'email va password majburiy');
    const result = await authService.login(email, password);
    req.user = result.user;
    await writeAudit(req, { action: 'login', entityType: 'user', entityId: result.user.id });
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return fail(res, 400, 'BAD_REQUEST', 'refreshToken majburiy');
    const result = await authService.refresh(refreshToken);
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res) {
  // Stateless JWT: the client discards tokens; we only record the event.
  await writeAudit(req, { action: 'login', entityType: 'user_logout', entityId: req.user.id });
  return ok(res, { message: 'Logged out' });
}

async function me(req, res) {
  return ok(res, req.user);
}

module.exports = { login, refresh, logout, me };
