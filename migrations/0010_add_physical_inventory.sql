
ALTER TABLE "products" ADD COLUMN "physical_inventory" integer DEFAULT 0 NOT NULL;

-- Set initial physical inventory to match current stock for existing products
UPDATE "products" SET "physical_inventory" = "stock";
