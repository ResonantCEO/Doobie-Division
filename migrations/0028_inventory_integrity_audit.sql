ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS ledger VARCHAR NOT NULL DEFAULT 'sellable';
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS variant_id INTEGER;
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS order_id INTEGER;
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS order_item_id INTEGER;
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS direction VARCHAR NOT NULL DEFAULT 'adjustment';
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS source_action VARCHAR NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS IDX_inventory_logs_order_id ON inventory_logs(order_id);
CREATE INDEX IF NOT EXISTS IDX_inventory_logs_order_item_id ON inventory_logs(order_item_id);
CREATE INDEX IF NOT EXISTS IDX_inventory_logs_variant_id ON inventory_logs(variant_id);

CREATE UNIQUE INDEX IF NOT EXISTS UQ_product_sizes_product_size
ON product_sizes(product_id, size);

ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_variant_id_product_sizes_id_fk;
ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_order_id_orders_id_fk;
ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_order_item_id_order_items_id_fk;
ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_variant_id_product_sizes_id_fk
  FOREIGN KEY (variant_id) REFERENCES product_sizes(id) ON DELETE SET NULL;
ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_order_id_orders_id_fk
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_order_item_id_order_items_id_fk
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL;