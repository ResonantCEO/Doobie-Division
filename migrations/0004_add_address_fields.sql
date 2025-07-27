
ALTER TABLE "users" ADD COLUMN "address" text;
ALTER TABLE "users" ADD COLUMN "city" varchar;
ALTER TABLE "users" ADD COLUMN "state" varchar;
ALTER TABLE "users" ADD COLUMN "postal_code" varchar;
ALTER TABLE "users" ADD COLUMN "country" varchar DEFAULT 'USA';
