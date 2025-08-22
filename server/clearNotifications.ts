
import { db } from "./db";
import { notifications } from "@shared/schema";

async function clearAllNotifications() {
  try {
    console.log("Clearing all notifications from the database...");

    // Delete all notifications
    const deletedNotifications = await db.delete(notifications).returning();

    console.log(`Successfully deleted ${deletedNotifications.length} notifications from the database.`);
    console.log("All notifications cleared!");
    
    process.exit(0);
  } catch (error) {
    console.error("Error clearing notifications:", error);
    process.exit(1);
  }
}

clearAllNotifications();
