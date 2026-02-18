-- Add physical_quantity column to product_sizes table
ALTER TABLE "product_sizes" ADD COLUMN "physical_quantity" integer DEFAULT 0 NOT NULL;

-- Initialize physical_quantity to match quantity for existing sizes
UPDATE "product_sizes" SET "physical_quantity" = "quantity";
