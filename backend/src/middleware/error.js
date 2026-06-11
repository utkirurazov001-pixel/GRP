const { fail, ApiError } = require('../utils/respond');

function notFound(req, res) {
  return fail(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return fail(res, err.status, err.code, err.message, err.details);
  }
  console.error('[error]', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}

module.exports = { notFound, errorHandler };
