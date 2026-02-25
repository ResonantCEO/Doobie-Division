-- Add image_urls column to products table for storing multiple images as JSON array
ALTER TABLE products 
ADD COLUMN image_urls TEXT;
