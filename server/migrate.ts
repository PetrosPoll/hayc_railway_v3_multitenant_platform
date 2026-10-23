import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("🔄 Running database migrations...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV !== "development"
        ? { rejectUnauthorized: false }
        : false,
  });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    await pool.query(`
      UPDATE contacts SET status = 'active', updated_at = NOW() WHERE status = 'confirmed';
      UPDATE admin_contacts SET status = 'active', updated_at = NOW() WHERE status IN ('confirmed', 'subscribed');
      UPDATE newsletter_subscribers SET status = 'active', updated_at = NOW() WHERE status = 'confirmed';
      UPDATE website_progress
        SET automations_engine = 'v2', updated_at = NOW()
        WHERE automations_engine IS DISTINCT FROM 'v2';
      ALTER TABLE website_progress
        ALTER COLUMN automations_engine SET DEFAULT 'v2';
    `);
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}
