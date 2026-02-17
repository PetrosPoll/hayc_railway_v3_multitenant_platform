import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Standard TCP connection (works with DigitalOcean Postgres, not WebSocket/Neon)
// connectionTimeoutMillis: give time for DO private network / SSL handshake
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV !== "development"
      ? { rejectUnauthorized: false }
      : false,
  connectionTimeoutMillis: 15000,
});
export const db = drizzle(pool, { schema });
