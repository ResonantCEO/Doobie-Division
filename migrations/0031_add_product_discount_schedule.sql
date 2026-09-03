ALTER TABLE products
  ADD COLUMN IF NOT EXISTS discount_schedule JSONB;