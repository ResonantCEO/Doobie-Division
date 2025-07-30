
-- Add indexes to optimize category and product queries
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_active_parent ON categories(is_active, parent_id);
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(is_active, category_id);
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
