
import { db } from "./db";
import { users, inventoryLogs, notifications, orders } from "@shared/schema";

async function clearUserDatabase() {
  try {
    console.log("Clearing user database...");
    
    // First, delete all related records that reference users
    console.log("Deleting inventory logs...");
    const deletedInventoryLogs = await db.delete(inventoryLogs).returning();
    console.log(`Deleted ${deletedInventoryLogs.length} inventory logs`);
    
    console.log("Deleting notifications...");
    const deletedNotifications = await db.delete(notifications).returning();
    console.log(`Deleted ${deletedNotifications.length} notifications`);
    
    console.log("Deleting orders...");
    const deletedOrders = await db.delete(orders).returning();
    console.log(`Deleted ${deletedOrders.length} orders`);
    
    // Finally, delete all users
    console.log("Deleting users...");
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
