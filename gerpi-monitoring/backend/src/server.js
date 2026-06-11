import http from "node:http";
import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";
import { buildApp } from "./app.js";
import { CONFIG } from "./config.js";
import { db, USE_PG } from "./db.js";
import { startJobs } from "./jobs/cron.js";

const app = buildApp();
const server = http.createServer(app);

/** Socket.IO — yangi alert kelganda jonli yangilanish */
const io = new SocketServer(server, {
  cors: { origin: CONFIG.ALLOWED_ORIGINS, credentials: true },
});
io.use((socket, next) => {
  // Token ixtiyoriy: ulanish ochiq, lekin foydalanuvchi aniqlangan bo'lsa saqlanadi
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.data.user = jwt.verify(token, CONFIG.JWT.ACCESS_SECRET);
    } catch { /* anonim ulanish davom etadi */ }
  }
  next();
});
app.set("io", io);

server.listen(CONFIG.PORT, async () => {
  console.log(`✓ GERPI Monitoring backend: http://localhost:${CONFIG.PORT}`);
  console.log(`✓ Baza: ${USE_PG ? "PostgreSQL" : "SQLite (lokal demo)"}`);
  if (CONFIG.DEMO_MODE) console.log("✓ Demo rejim yoqilgan");
  try {
    await db.raw("select 1");
  } catch (e) {
    console.error("✗ Baza ulanish xatosi:", e.message);
  }
  startJobs(io);
});
