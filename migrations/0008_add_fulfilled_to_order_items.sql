
-- Add fulfilled field to order_items table
ALTER TABLE "order_items" ADD COLUMN "fulfilled" boolean DEFAULT false;

-- Update existing order items to be unfulfilled by default
UPDATE "order_items" SET "fulfilled" = false WHERE "fulfilled" IS NULL;
