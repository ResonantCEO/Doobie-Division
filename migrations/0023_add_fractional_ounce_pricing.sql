-- Add fractional ounce pricing fields to products table
ALTER TABLE products 
ADD COLUMN price_per_eighth DECIMAL(10, 2),
ADD COLUMN price_per_quarter DECIMAL(10, 2),
ADD COLUMN price_per_half DECIMAL(10, 2);
