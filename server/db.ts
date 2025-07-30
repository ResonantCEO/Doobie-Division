import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection with better error handling
const sql = neon(process.env.DATABASE_URL!, {
  onNotice: (notice) => console.log("DB Notice:", notice),
  onNotification: (notification) => console.log("DB Notification:", notification),
});

export const db = drizzle(sql, { 
  schema,
  logger: process.env.NODE_ENV === "development"
});

// Add connection health check
export async function checkDatabaseConnection() {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}