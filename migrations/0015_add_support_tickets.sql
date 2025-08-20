
-- Add support tickets table
CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar REFERENCES "users"("id"),
	"subject" varchar NOT NULL,
	"message" text NOT NULL,
	"priority" varchar DEFAULT 'normal' NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"assigned_to" varchar REFERENCES "users"("id"),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_support_tickets_status" ON "support_tickets" ("status");
CREATE INDEX IF NOT EXISTS "IDX_support_tickets_priority" ON "support_tickets" ("priority");
CREATE INDEX IF NOT EXISTS "IDX_support_tickets_assigned_to" ON "support_tickets" ("assigned_to");
CREATE INDEX IF NOT EXISTS "IDX_support_tickets_created_at" ON "support_tickets" ("created_at");
