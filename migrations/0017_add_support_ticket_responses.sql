
-- Add support ticket responses table
CREATE TABLE IF NOT EXISTS "support_ticket_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer REFERENCES "support_tickets"("id"),
	"message" text NOT NULL,
	"type" varchar NOT NULL,
	"created_by" varchar REFERENCES "users"("id"),
	"created_at" timestamp DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_support_ticket_responses_ticket_id" ON "support_ticket_responses" ("ticket_id");
CREATE INDEX IF NOT EXISTS "IDX_support_ticket_responses_created_at" ON "support_ticket_responses" ("created_at");
CREATE INDEX IF NOT EXISTS "IDX_support_ticket_responses_type" ON "support_ticket_responses" ("type");
