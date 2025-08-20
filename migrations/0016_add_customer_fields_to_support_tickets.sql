
-- Add customer contact fields to support tickets
ALTER TABLE "support_tickets" 
ADD COLUMN IF NOT EXISTS "customer_name" varchar,
ADD COLUMN IF NOT EXISTS "customer_email" varchar,
ADD COLUMN IF NOT EXISTS "customer_phone" varchar;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_support_tickets_customer_email" ON "support_tickets" ("customer_email");
