import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use WebSocket mode so the Pool can handle concurrent queries without collapsing.
// neon-http (HTTP mode) returns null rows when multiple requests fire simultaneously;
// the WebSocket Pool serializes queries through real connections and doesn't have that problem.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

// Keep sql export for raw queries used in startup migrations
export const sql = pool;

export async function warmupDatabase() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function checkDatabaseConnection() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
