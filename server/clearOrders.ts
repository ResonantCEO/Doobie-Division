
import { db } from "./db";
import { orders, orderItems } from "@shared/schema";

async function clearOrdersDatabase() {
  try {
    console.log("Clearing orders database...");
    
    // First, delete all order items (child records)
    console.log("Deleting order items...");
    const deletedOrderItems = await db.delete(orderItems).returning();
    console.log(`Deleted ${deletedOrderItems.length} order items`);
    
    // Then, delete all orders
    console.log("Deleting orders...");
    const deletedOrders = await db.delete(orders).returning();
    console.log(`Deleted ${deletedOrders.length} orders`);
    
    console.log("Orders database cleared successfully!");
    
    process.exit(0);
  } catch (error) {
    console.error("Error clearing orders database:", error);
    process.exit(1);
  }
}

clearOrdersDatabase();
