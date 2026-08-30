
import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function syncPhysicalInventory() {
  try {
    const result = await db.execute(sql`
      SELECT p.id, p.name, p.stock AS sellable, p.physical_inventory AS physical,
             COALESCE(SUM(ps.quantity), p.stock)::integer AS canonical_sellable,
             COALESCE(SUM(ps.physical_quantity), p.physical_inventory)::integer AS canonical_physical
      FROM products p
      LEFT JOIN product_sizes ps ON ps.product_id = p.id
      GROUP BY p.id
      HAVING p.stock IS DISTINCT FROM COALESCE(SUM(ps.quantity), p.stock)
          OR p.physical_inventory IS DISTINCT FROM COALESCE(SUM(ps.physical_quantity), p.physical_inventory)
          OR p.stock IS DISTINCT FROM p.physical_inventory
      ORDER BY p.name
    `);
    console.log(JSON.stringify(result.rows, null, 2));
    console.log(`Inventory integrity scan completed. ${result.rows.length} discrepancies require review.`);
  } catch (error) {
    console.error("Error syncing physical inventory:", error);
  } finally {
    process.exit(0);
  }
}

syncPhysicalInventory();
