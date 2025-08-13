
import { db } from "./db.js";
import { products } from "@shared/schema";

async function syncPhysicalInventory() {
  try {
    console.log("Syncing physical inventory with current stock...");
    
    // Update all products to set physical inventory equal to current stock
    const result = await db.update(products)
      .set({ 
        physicalInventory: products.stock 
      });
    
    console.log("Physical inventory sync completed successfully");
  } catch (error) {
    console.error("Error syncing physical inventory:", error);
  } finally {
    process.exit(0);
  }
}

syncPhysicalInventory();
