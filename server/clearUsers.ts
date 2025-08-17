
import { db } from "./db";
import { users, inventoryLogs, notifications, orders, orderItems } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

async function clearUserDatabase() {
  try {
    console.log("Clearing user database...");
    
    // Get all user IDs first
    const allUsers = await db.select({ id: users.id }).from(users);
    const userIds = allUsers.map(user => user.id);
    
    if (userIds.length === 0) {
      console.log("No users found to delete.");
      process.exit(0);
    }
    
    console.log(`Found ${userIds.length} users to delete`);
    
    // Delete in the correct order to avoid foreign key constraint violations
    
    // 1. Delete order items first (they reference orders)
    console.log("Deleting order items...");
    const deletedOrderItems = await db.delete(orderItems).returning();
    console.log(`Deleted ${deletedOrderItems.length} order items`);
    
    // 2. Delete orders (they reference users as customers and assigned users)
    console.log("Deleting orders...");
    const deletedOrders = await db.delete(orders).returning();
    console.log(`Deleted ${deletedOrders.length} orders`);
    
    // 3. Delete inventory logs (they reference users)
    console.log("Deleting inventory logs...");
    const deletedInventoryLogs = await db.delete(inventoryLogs).returning();
    console.log(`Deleted ${deletedInventoryLogs.length} inventory logs`);
    
    // 4. Delete notifications (they reference users)
    console.log("Deleting notifications...");
    const deletedNotifications = await db.delete(notifications).returning();
    console.log(`Deleted ${deletedNotifications.length} notifications`);
    
    // 5. Finally, delete all users
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
