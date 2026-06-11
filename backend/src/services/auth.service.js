const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { ApiError } = require('../utils/respond');

function signTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl },
  );
  const refreshToken = jwt.sign(
    { sub: user.id, typ: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshTtl },
  );
  return { accessToken, refreshToken };
}

function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    gerpi_id: user.gerpi_id,
    ministry_id: user.ministry_id,
    donor_id: user.donor_id,
    locale: user.locale,
  };
}

async function login(email, password) {
  const user = await db('users')
    .whereRaw('lower(email) = ?', [String(email || '').toLowerCase().trim()])
    .whereNull('deleted_at')
    .first();
  if (!user || !user.is_active) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email yoki parol noto\'g\'ri');

  const valid = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email yoki parol noto\'g\'ri');

  return { user: publicUser(user), ...signTokens(user) };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    throw new ApiError(401, 'REFRESH_INVALID', 'Refresh token expired or invalid');
  }
  if (payload.typ !== 'refresh') throw new ApiError(401, 'REFRESH_INVALID', 'Not a refresh token');

  const user = await db('users').where({ id: payload.sub, is_active: true }).whereNull('deleted_at').first();
  if (!user) throw new ApiError(401, 'USER_INACTIVE', 'User not found or deactivated');

  return { user: publicUser(user), ...signTokens(user) };
}

module.exports = { login, refresh };
