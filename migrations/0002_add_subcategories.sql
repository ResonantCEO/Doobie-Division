
-- Add new columns to categories table
ALTER TABLE "categories" ADD COLUMN "parent_id" integer;
ALTER TABLE "categories" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "categories" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;

-- Add foreign key constraint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;

-- Remove unique constraint on name since subcategories can have same names under different parents
ALTER TABLE "categories" DROP CONSTRAINT "categories_name_unique";

-- Add compound unique constraint for name within same parent
ALTER TABLE "categories" ADD CONSTRAINT "categories_name_parent_unique" UNIQUE("name", "parent_id");
