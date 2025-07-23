
import { db } from "./db";
import { users } from "@shared/schema";

async function clearUserDatabase() {
  try {
    console.log("Clearing user database...");
    
    // Delete all users
    const deletedUsers = await db.delete(users).returning();
    
    console.log(`Successfully deleted ${deletedUsers.length} users from the database.`);
    console.log("User database cleared!");
    
    process.exit(0);
  } catch (error) {
    console.error("Error clearing user database:", error);
    process.exit(1);
  }
}

clearUserDatabase();
