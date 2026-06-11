const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { fail } = require('../utils/respond');

// Verifies the Bearer access token and loads a fresh user row so that
// deactivation / role changes take effect immediately.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return fail(res, 401, 'UNAUTHORIZED', 'Access token required');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret);
    } catch {
      return fail(res, 401, 'TOKEN_INVALID', 'Access token expired or invalid');
    }

    const user = await db('users')
      .where({ id: payload.sub, is_active: true })
      .whereNull('deleted_at')
      .first();
    if (!user) return fail(res, 401, 'USER_INACTIVE', 'User not found or deactivated');

    req.user = {
      id: user.id,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
      gerpi_id: user.gerpi_id,
      ministry_id: user.ministry_id,
      donor_id: user.donor_id,
      locale: user.locale,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
