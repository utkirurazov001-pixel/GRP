import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "./config.js";
import { ok } from "./utils/respond.js";
import { notFound, errorHandler } from "./middleware/errors.js";

import { authRouter } from "./routes/auth.js";
import { gerpiRouter } from "./routes/gerpi.js";
import { disbursementsRouter, disbursementActionsRouter } from "./routes/disbursements.js";
import { componentsRouter, componentActionsRouter } from "./routes/components.js";
import { procurementsRouter, procurementActionsRouter } from "./routes/procurements.js";
import { documentsRouter, documentActionsRouter } from "./routes/documents.js";
import { alertsRouter } from "./routes/alerts.js";
import { analyticsRouter } from "./routes/analytics.js";
import { exportsRouter } from "./routes/exports.js";
import { adminRouter, refsRouter } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");

export function buildApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet({
    contentSecurityPolicy: false, // frontend inline skriptlari uchun (lokal statik)
  }));
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || CONFIG.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: origin ruxsat etilmagan"));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", rateLimit({
    windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
    max: CONFIG.RATE_LIMIT.MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, data: null, error: { message: "So'rovlar limiti oshib ketdi" }, meta: null },
  }));

  app.get("/health", (req, res) => res.json({ ok: true, demo: CONFIG.DEMO_MODE }));
  app.get("/api/meta", (req, res) => ok(res, {
    demo_mode: CONFIG.DEMO_MODE,
    locales: CONFIG.LOCALES,
    roles: CONFIG.ROLES,
    statuses: CONFIG.GERPI_STATUSES,
    document_types: CONFIG.DOCUMENT_TYPES,
    procurement_methods: CONFIG.PROCUREMENT_METHODS,
    procurement_statuses: CONFIG.PROCUREMENT_STATUSES,
    alert_types: CONFIG.ALERT_TYPES,
  }));

  app.use("/api/auth", authRouter);
  app.use("/api/gerpi/:gerpiId/disbursements", disbursementsRouter);
  app.use("/api/gerpi/:gerpiId/components", componentsRouter);
  app.use("/api/gerpi/:gerpiId/procurements", procurementsRouter);
  app.use("/api/gerpi/:gerpiId/documents", documentsRouter);
  app.use("/api/gerpi", gerpiRouter);
  app.use("/api/disbursements", disbursementActionsRouter);
  app.use("/api/components", componentActionsRouter);
  app.use("/api/procurements", procurementActionsRouter);
  app.use("/api/documents", documentActionsRouter);
  app.use("/api/alerts", alertsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/exports", exportsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", refsRouter);

  // Frontend — bitta serverdan statik
  app.use(express.static(FRONTEND_DIR));
  app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));

  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}
