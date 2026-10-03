ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_item_limit integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_campaign_id varchar NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cap_usage jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS product_discount_usage (
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_key varchar NOT NULL,
  used_items integer NOT NULL DEFAULT 0 CHECK (used_items >= 0),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, user_id, cycle_key)
);