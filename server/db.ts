import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../shared/schema";

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use WebSocket mode so the Pool can handle concurrent queries without collapsing.
// neon-http (HTTP mode) returns null rows when multiple requests fire simultaneously;
// the WebSocket Pool serializes queries through real connections and doesn't have that problem.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString });

export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export const sql = pool;

// Neon free-tier endpoints auto-suspend after inactivity. When dev first hits a
// sleeping endpoint it throws "The endpoint has been disabled". This helper retries
// with exponential back-off so the endpoint has time to wake up before giving up.
export async function warmupDatabase(maxAttempts = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      if (attempt > 1) {
        console.log(`[db] Database endpoint woke up after ${attempt} attempts.`);
      }
      return true;
    } catch (err: any) {
      const isEndpointSleeping =
        err?.message?.includes("endpoint has been disabled") ||
        err?.cause?.message?.includes("endpoint has been disabled");
      if (isEndpointSleeping && attempt < maxAttempts) {
        console.log(
          `[db] Neon endpoint is waking up (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      console.error("[db] Database warmup failed:", err?.message ?? err);
      return false;
    }
  }
  return false;
}

export async function checkDatabaseConnection() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
