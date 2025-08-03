
-- Add productSku column to order_items table
ALTER TABLE "order_items" ADD COLUMN "product_sku" varchar;

-- Update existing order items with product SKUs where possible
UPDATE "order_items" 
SET "product_sku" = "products"."sku" 
FROM "products" 
WHERE "order_items"."product_id" = "products"."id";
