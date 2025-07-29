
-- Add selling method and weight-related fields to products table
ALTER TABLE products 
ADD COLUMN selling_method VARCHAR DEFAULT 'units' NOT NULL,
ADD COLUMN weight_unit VARCHAR DEFAULT 'grams',
ADD COLUMN price_per_gram DECIMAL(10, 4),
ADD COLUMN price_per_ounce DECIMAL(10, 2);
