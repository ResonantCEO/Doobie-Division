
ALTER TABLE "orders" ADD COLUMN "assigned_user_id" varchar;
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
