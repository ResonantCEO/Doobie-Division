ALTER TABLE "users" ADD COLUMN "id_image_url" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "id_verification_status" varchar DEFAULT 'pending' NOT NULL;