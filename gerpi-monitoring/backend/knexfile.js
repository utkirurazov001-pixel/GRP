import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usePg = !!process.env.DATABASE_URL;

/** PostgreSQL (production) yoki SQLite (lokal demo) — DATABASE_URL ga qarab. */
const config = usePg
  ? {
      client: "pg",
      connection: process.env.DATABASE_URL,
      pool: { min: 1, max: 10 },
      migrations: { directory: path.join(__dirname, "migrations") },
      seeds: { directory: path.join(__dirname, "seeds") },
    }
  : {
      client: "better-sqlite3",
      connection: { filename: path.join(__dirname, "data", "gerpi.sqlite") },
      useNullAsDefault: true,
      migrations: { directory: path.join(__dirname, "migrations") },
      seeds: { directory: path.join(__dirname, "seeds") },
    };

export default config;
