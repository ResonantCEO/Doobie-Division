
import { db } from "./db.js";
import { products } from "@shared/schema";

async function syncPhysicalInventory() {
  try {
    console.log("Syncing physical inventory with current stock...");
    
    // Get all products and update their physical inventory to match current stock
    const allProducts = await db.select().from(products);
    
    for (const product of allProducts) {
      await db.update(products)
        .set({ 
          physicalInventory: product.stock 
        })
        .where(db.eq(products.id, product.id));
      
      console.log(`Updated ${product.name} (ID: ${product.id}): Physical inventory set to ${product.stock}`);
    }
    
    console.log(`Physical inventory sync completed successfully for ${allProducts.length} products`);
  } catch (error) {
    console.error("Error syncing physical inventory:", error);
  } finally {
    process.exit(0);
  }
}

syncPhysicalInventory();
