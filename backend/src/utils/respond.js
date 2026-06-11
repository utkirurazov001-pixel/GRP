// Unified API envelope: { success, data, error, meta }
function ok(res, data, meta = null, status = 200) {
  return res.status(status).json({ success: true, data, error: null, meta });
}

function fail(res, status, code, message, details = null) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { code, message, details },
    meta: null,
  });
}

class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = { ok, fail, ApiError };
