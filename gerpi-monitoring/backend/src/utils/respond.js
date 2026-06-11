/** Yagona javob konvencisi: { success, data, error, meta } */
export function ok(res, data = null, meta = null, status = 200) {
  return res.status(status).json({ success: true, data, error: null, meta });
}

export function fail(res, status, message, details = null) {
  return res.status(status).json({ success: false, data: null, error: { message, details }, meta: null });
}

/** ?page=&limit= dan pagination parametrlari */
export function pagination(req, defLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit) || defLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export const uuid = () => globalThis.crypto.randomUUID();

/** Express async handler o'rami */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
