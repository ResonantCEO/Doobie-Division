import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const sql = neon(process.env.DATABASE_URL!, {
  fetchOptions: { cache: 'no-store' },
});

export const db = drizzle(sql, { 
  schema,
  logger: process.env.NODE_ENV === "development"
});

// Warm up the Neon connection and pre-validate tables on startup.
// Neon serverless uses HTTP - first request(s) after idle can return null rows.
// Running a simple query early ensures the connection is ready before clients hit it.
export async function warmupDatabase() {
  const attempts = 6;
  for (let i = 0; i < attempts; i++) {
    try {
      await sql`SELECT 1`;
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
  return false;
}

export async function checkDatabaseConnection() {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
