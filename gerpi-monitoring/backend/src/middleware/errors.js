import { fail } from "../utils/respond.js";

export function notFound(req, res) {
  return fail(res, 404, "Topilmadi");
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.type === "entity.too.large" || err.code === "LIMIT_FILE_SIZE") {
    return fail(res, 422, "Fayl hajmi 20MB dan oshmasligi kerak");
  }
  console.error("Server xatosi:", err);
  return fail(res, err.status || 500, err.expose ? err.message : "Server xatosi");
}
