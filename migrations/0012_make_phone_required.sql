
-- Make customer phone number required in orders table
ALTER TABLE "orders" ALTER COLUMN "customer_phone" SET NOT NULL;
