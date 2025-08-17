-- Add performance indexes for better query optimization
-- Create indexes for products table performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_category_id ON products(category_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_stock ON products(stock);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_is_active ON products(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_name_text ON products USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_description_text ON products USING gin(to_tsvector('english', description));
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_sku ON products(sku);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_created_at ON products(created_at DESC);

-- Create composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_category_stock ON products(category_id, stock) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_products_active_stock ON products(is_active, stock) WHERE stock > 0;

-- Create indexes for orders table performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_orders_customer_id ON orders(customer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_orders_status ON orders(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_orders_created_at ON orders(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_orders_assigned_user ON orders(assigned_user_id);

-- Create indexes for order_items table performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_order_items_order_id ON order_items(order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_order_items_product_id ON order_items(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_order_items_fulfilled ON order_items(fulfilled);

-- Create indexes for notifications table performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_notifications_user_id ON notifications(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_notifications_is_read ON notifications(is_read);

-- Create indexes for inventory_logs table performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_inventory_logs_user_id ON inventory_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_inventory_logs_created_at ON inventory_logs(created_at DESC);