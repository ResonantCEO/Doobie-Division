
import { db } from "./db";
import { users, inventoryLogs, notifications, orders, orderItems } from "@shared/schema";
import { eq, inArray, or } from "drizzle-orm";

async function deleteSpecificUsers(userIds: string[]) {
  try {
    console.log(`Attempting to delete users: ${userIds.join(', ')}`);
    
    // Verify users exist
    const existingUsers = await db.select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));
    
    if (existingUsers.length === 0) {
      console.log("No matching users found.");
      process.exit(0);
    }
    
    console.log(`Found ${existingUsers.length} users to delete:`);
    existingUsers.forEach(user => console.log(`- ${user.email} (${user.id})`));
    
    // Delete in the correct order to avoid foreign key constraint violations
    
    // 1. Delete order items for orders related to these users
    console.log("Deleting related order items...");
    const userOrders = await db.select({ id: orders.id })
      .from(orders)
      .where(or(
        inArray(orders.customerId, userIds),
        inArray(orders.assignedUserId, userIds)
      ));
    
    if (userOrders.length > 0) {
      const orderIds = userOrders.map(order => order.id);
      const deletedOrderItems = await db.delete(orderItems)
        .where(inArray(orderItems.orderId, orderIds))
        .returning();
      console.log(`Deleted ${deletedOrderItems.length} order items`);
    }
    
    // 2. Delete orders related to these users
    console.log("Deleting related orders...");
    const deletedOrders = await db.delete(orders)
      .where(or(
        inArray(orders.customerId, userIds),
        inArray(orders.assignedUserId, userIds)
      ))
      .returning();
    console.log(`Deleted ${deletedOrders.length} orders`);
    
    // 3. Delete inventory logs created by these users
    console.log("Deleting related inventory logs...");
    const deletedInventoryLogs = await db.delete(inventoryLogs)
      .where(inArray(inventoryLogs.userId, userIds))
      .returning();
    console.log(`Deleted ${deletedInventoryLogs.length} inventory logs`);
    
    // 4. Delete notifications for these users
    console.log("Deleting related notifications...");
    const deletedNotifications = await db.delete(notifications)
      .where(inArray(notifications.userId, userIds))
      .returning();
    console.log(`Deleted ${deletedNotifications.length} notifications`);
    
    // 5. Finally, delete the users
    console.log("Deleting users...");
    const deletedUsers = await db.delete(users)
      .where(inArray(users.id, userIds))
      .returning();
    
    console.log(`Successfully deleted ${deletedUsers.length} users:`);
    deletedUsers.forEach(user => console.log(`- ${user.email} (${user.id})`));
    
    process.exit(0);
  } catch (error) {
    console.error("Error deleting users:", error);
    process.exit(1);
  }
}

// Get user IDs from command line arguments
const userIdsToDelete = process.argv.slice(2);

if (userIdsToDelete.length === 0) {
  console.error("Please provide user IDs as arguments:");
  console.error("Usage: tsx server/deleteSpecificUsers.ts <user-id-1> <user-id-2> ...");
  console.error("Example: tsx server/deleteSpecificUsers.ts 25561cc6-c261-4ac1-934f-498c5761c950 2b6f178e-2ab6-4d05-8de8-4e68bbe08feb");
  process.exit(1);
}

deleteSpecificUsers(userIdsToDelete);
