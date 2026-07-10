import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  })
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  password: varchar("password"),
  profileImageUrl: varchar("profile_image_url"),
  idImageUrl: varchar("id_image_url"),
  verificationPhotoUrl: varchar("verification_photo_url"),
  idVerificationStatus: varchar("id_verification_status").notNull().default("pending"), // pending, verified, rejected
  role: varchar("role").notNull().default("customer"), // customer, staff, manager, admin
  status: varchar("status").notNull().default("pending"), // pending, active, suspended
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  postalCode: varchar("postal_code"),
  country: varchar("country").default("Canada"),
  telegramUsername: varchar("telegram_username"),
  phoneNumber: varchar("phone_number"),
  minPurchaseExempt: boolean("min_purchase_exempt").notNull().default(false),
  minPurchaseOverride: decimal("min_purchase_override", { precision: 10, scale: 2 }),
  grantedAccessPasswordId: integer("granted_access_password_id"),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  referralCount: integer("referral_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  parentIdIdx: index("IDX_categories_parent_id").on(table.parentId),
  isActiveIdx: index("IDX_categories_is_active").on(table.isActive),
}));



export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  company: varchar("company"),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }), // nullable for weight-based products
  sku: varchar("sku").notNull().unique(),
  categoryId: integer("category_id").references(() => categories.id),
  imageUrl: text("image_url"),
  imageUrls: text("image_urls"), // JSON array of image URLs
  stock: integer("stock").notNull().default(0),
  physicalInventory: integer("physical_inventory").notNull().default(0), // actual warehouse count
  minStockThreshold: integer("min_stock_threshold").notNull().default(5),
  sellingMethod: varchar("selling_method").notNull().default("units"), // units, weight
  weightUnit: varchar("weight_unit").default("grams"), // grams, ounces
  pricePerGram: decimal("price_per_gram", { precision: 10, scale: 4 }),
  pricePerOunce: decimal("price_per_ounce", { precision: 10, scale: 2 }),
  pricePerEighth: decimal("price_per_eighth", { precision: 10, scale: 2 }), // price per 1/8th ounce
  pricePerQuarter: decimal("price_per_quarter", { precision: 10, scale: 2 }), // price per 1/4 ounce
  pricePerHalf: decimal("price_per_half", { precision: 10, scale: 2 }), // price per 1/2 ounce
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"), // discount percentage (0-100)
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }), // admin only - cost price per unit
  purchasePriceMethod: varchar("purchase_price_method").default("units"), // units or weight
  purchasePricePerGram: decimal("purchase_price_per_gram", { precision: 10, scale: 4 }), // admin only - cost per gram
  purchasePricePerOunce: decimal("purchase_price_per_ounce", { precision: 10, scale: 2 }), // admin only - cost per ounce
  adminNotes: text("admin_notes"), // admin only - internal company notes
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  categoryIdIdx: index("IDX_products_category_id").on(table.categoryId),
  isActiveIdx: index("IDX_products_is_active").on(table.isActive),
  createdAtIdx: index("IDX_products_created_at").on(table.createdAt),
}));

export const productSizes = pgTable("product_sizes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  size: varchar("size").notNull(), // e.g., "S", "M", "L", "XL", "Small", "Medium", etc.
  quantity: integer("quantity").notNull().default(0),
  physicalQuantity: integer("physical_quantity").notNull().default(0), // actual warehouse count per size
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  productIdIdx: index("IDX_product_sizes_product_id").on(table.productId),
}));

export const productQuantityPricing = pgTable("product_quantity_pricing", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  minQuantity: integer("min_quantity").notNull(),
  pricePerItem: decimal("price_per_item", { precision: 10, scale: 4 }).notNull(),
}, (table) => ({
  productIdIdx: index("IDX_pqp_product_id").on(table.productId),
}));

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number").notNull().unique(),
  customerId: varchar("customer_id").references(() => users.id),
  customerName: varchar("customer_name").notNull(),
  customerEmail: varchar("customer_email").notNull(),
  customerPhone: varchar("customer_phone").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default("pending"), // pending, processing, shipped, delivered, cancelled
  paymentMethod: varchar("payment_method").notNull().default("cod"),
  paymentPhotoUrl: text("payment_photo_url"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  productName: varchar("product_name").notNull(),
  productSku: varchar("product_sku"),
  productPrice: decimal("product_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  fulfilled: boolean("fulfilled").default(false),
});

export const inventoryLogs = pgTable("inventory_logs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  type: varchar("type").notNull(), // stock_in, stock_out, adjustment
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: text("reason"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userActivityLogs = pgTable("user_activity_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: varchar("action").notNull(),
  details: text("details"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type").notNull(), // low_stock, order_received, user_approval
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  customerName: varchar("customer_name"),
  customerEmail: varchar("customer_email"),
  customerPhone: varchar("customer_phone"),
  customerTelegram: varchar("customer_telegram"),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  priority: varchar("priority").notNull().default('normal'),
  status: varchar("status").notNull().default('open'),
  assignedTo: varchar("assigned_to").references(() => users.id),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const supportTicketResponses = pgTable("support_ticket_responses", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => supportTickets.id),
  message: text("message").notNull(),
  type: varchar("type").notNull(), // 'customer', 'staff', 'system'
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const cityPurchaseLimits = pgTable("city_purchase_limits", {
  id: serial("id").primaryKey(),
  cityName: varchar("city_name").notNull().unique(),
  minimumAmount: decimal("minimum_amount", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  deliveryBlocked: boolean("delivery_blocked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const promotionalAds = pgTable("promotional_ads", {
  id: serial("id").primaryKey(),
  discountId: integer("discount_id").unique(), // auto-linked to a discount if set
  title: varchar("title").notNull(),
  subtitle: text("subtitle"),
  buttonText: varchar("button_text").default("Shop Now"),
  buttonLink: varchar("button_link"),
  backgroundImageUrl: text("background_image_url"),
  backgroundColor: varchar("background_color").default("#1a1a2e"),
  textColor: varchar("text_color").default("white"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPromotionalAdSchema = createInsertSchema(promotionalAds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().nullable().optional(),
  buttonText: z.string().nullable().optional(),
  buttonLink: z.string().nullable().optional(),
  backgroundImageUrl: z.string().nullable().optional(),
  backgroundColor: z.string().nullable().optional(),
  textColor: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
});

export type PromotionalAd = typeof promotionalAds.$inferSelect;
export type InsertPromotionalAd = z.infer<typeof insertPromotionalAdSchema>;

export const discounts = pgTable("discounts", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  type: varchar("type").notNull(), // 'quantity', 'bundle', 'spend', 'bogo'
  isActive: boolean("is_active").notNull().default(true),

  minQuantity: integer("min_quantity"),
  minSpend: decimal("min_spend", { precision: 10, scale: 2 }),
  requiredProductIds: text("required_product_ids"),

  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  freeProductId: integer("free_product_id"),
  freeProductQuantity: integer("free_product_quantity").default(1),

  applyToProductId: integer("apply_to_product_id"),
  applyToCategoryId: integer("apply_to_category_id"),

  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(),
  description: text("description"),
  discountType: varchar("discount_type").notNull().default("percent"), // 'percent' | 'fixed'
  discountValue: text("discount_value").notNull().default("0"),
  minOrderAmount: text("min_order_amount"),
  bypassPurchaseMinimum: boolean("bypass_purchase_minimum").notNull().default(false),
  usageLimitType: varchar("usage_limit_type").notNull().default("unlimited"), // 'unlimited' | 'once_per_user'
  maxTotalUses: integer("max_total_uses"),
  totalUses: integer("total_uses").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promoCodeUses = pgTable("promo_code_uses", {
  id: serial("id").primaryKey(),
  promoCodeId: integer("promo_code_id").notNull().references(() => promoCodes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  totalUses: true,
  createdAt: true,
}).extend({
  code: z.string().min(1, "Code is required"),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.string().min(1, "Discount value is required"),
  minOrderAmount: z.string().nullable().optional(),
  bypassPurchaseMinimum: z.boolean().optional(),
  usageLimitType: z.enum(["unlimited", "once_per_user"]),
  maxTotalUses: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
});

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;

export const accessPasswords = pgTable("access_passwords", {
  id: serial("id").primaryKey(),
  label: varchar("label").notNull(),
  password: varchar("password").notNull(),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAccessPasswordSchema = createInsertSchema(accessPasswords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  label: z.string().min(1, "Label is required"),
  password: z.string().min(1, "Password is required"),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type AccessPassword = typeof accessPasswords.$inferSelect;
export type InsertAccessPassword = z.infer<typeof insertAccessPasswordSchema>;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  notifications: many(notifications),
  inventoryLogs: many(inventoryLogs),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  products: many(products),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryParent",
  }),
  children: many(categories, {
    relationName: "categoryParent",
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
  inventoryLogs: many(inventoryLogs),
  sizes: many(productSizes),
  quantityPricing: many(productQuantityPricing),
}));

export const productSizesRelations = relations(productSizes, ({ one }) => ({
  product: one(products, {
    fields: [productSizes.productId],
    references: [products.id],
  }),
}));

export const productQuantityPricingRelations = relations(productQuantityPricing, ({ one }) => ({
  product: one(products, {
    fields: [productQuantityPricing.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  assignedUser: one(users, {
    fields: [orders.assignedUserId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const inventoryLogsRelations = relations(inventoryLogs, ({ one }) => ({
  product: one(products, {
    fields: [inventoryLogs.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [inventoryLogs.userId],
    references: [users.id],
  }),
}));

export const userActivityLogsRelations = relations(userActivityLogs, ({ one }) => ({
  user: one(users, {
    fields: [userActivityLogs.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
  assignedUser: one(users, {
    fields: [supportTickets.assignedTo],
    references: [users.id],
  }),
  responses: many(supportTicketResponses),
}));

export const supportTicketResponsesRelations = relations(supportTicketResponses, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportTicketResponses.ticketId],
    references: [supportTickets.id],
  }),
  createdBy: one(users, {
    fields: [supportTicketResponses.createdBy],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
}).extend({
  parentId: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  sellingMethod: z.enum(["units", "weight"]).optional(),
  weightUnit: z.enum(["grams", "ounces"]).optional(),
  pricePerGram: z.string().nullable().optional(),
  pricePerOunce: z.string().nullable().optional(),
  pricePerEighth: z.string().nullable().optional(),
  pricePerQuarter: z.string().nullable().optional(),
  pricePerHalf: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  discountPercentage: z.string().nullable().optional(),
  stock: z.number().int().min(0).optional().default(0),
  physicalInventory: z.number().optional(),
  purchasePrice: z.string().nullable().optional(),
  purchasePriceMethod: z.enum(["units", "weight"]).optional(),
  purchasePricePerGram: z.string().nullable().optional(),
  purchasePricePerOunce: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageUrls: z.string().nullable().optional(), // JSON array as string
  sizes: z.array(z.object({
    size: z.string().min(1, "Size name is required"),
    quantity: z.number().int().min(0, "Quantity must be 0 or greater"),
  })).optional(),
  quantityPricing: z.array(z.object({
    minQuantity: z.number().int().min(1, "Min quantity must be at least 1"),
    pricePerItem: z.string().or(z.number()).transform(val => String(val)),
  })).optional(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  total: z.string().or(z.number()).transform(val => String(val)),
  customerId: z.string().nullable().optional(),
  customerPhone: z.string().min(1, "Phone number is required"),
  assignedUserId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
}).extend({
  productPrice: z.string().or(z.number()).transform(val => String(val)),
  subtotal: z.string().or(z.number()).transform(val => String(val)),
  orderId: z.number().optional(),
  productSku: z.string().optional(),
  // Preserve size from the client so stock logic can distinguish weight options
  size: z.string().optional(),
});

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryLogSchema = createInsertSchema(inventoryLogs).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).extend({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional().nullable(),
  customerTelegram: z.string().optional().nullable(),
  userId: z.string().nullable().optional(),
});

export const insertSupportTicketResponseSchema = createInsertSchema(supportTicketResponses).omit({
  id: true,
  createdAt: true,
});

export const insertCityPurchaseLimitSchema = createInsertSchema(cityPurchaseLimits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  cityName: z.string().min(1, "City name is required"),
  minimumAmount: z.string().or(z.number()).transform(val => String(val)),
  isActive: z.boolean().optional(),
  deliveryBlocked: z.boolean().optional(),
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type ProductSize = typeof productSizes.$inferSelect;
export type InsertProductSize = typeof productSizes.$inferInsert;
export type ProductQuantityPricing = typeof productQuantityPricing.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect & {
  assignedUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
  customerTelegramUsername?: string | null;
};
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertInventoryLog = z.infer<typeof insertInventoryLogSchema>;
export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicketResponse = z.infer<typeof insertSupportTicketResponseSchema>;
export type SupportTicketResponse = typeof supportTicketResponses.$inferSelect;
export type InsertCityPurchaseLimit = z.infer<typeof insertCityPurchaseLimitSchema>;
export type CityPurchaseLimit = typeof cityPurchaseLimits.$inferSelect;

export const insertDiscountSchema = createInsertSchema(discounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["quantity", "bundle", "spend", "bogo"]),
  description: z.string().nullable().optional(),
  minQuantity: z.number().int().nullable().optional(),
  minSpend: z.string().nullable().optional(),
  requiredProductIds: z.string().nullable().optional(),
  discountPercent: z.string().nullable().optional(),
  freeProductId: z.number().int().nullable().optional(),
  freeProductQuantity: z.number().int().nullable().optional(),
  applyToProductId: z.number().int().nullable().optional(),
  applyToCategoryId: z.number().int().nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type Discount = typeof discounts.$inferSelect;
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;

export const priceTemplates = pgTable("price_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  templateType: varchar("template_type").notNull().default("units"), // "units", "weight", "quantity"
  price: decimal("price", { precision: 10, scale: 2 }),
  pricePerGram: decimal("price_per_gram", { precision: 10, scale: 4 }),
  pricePerOunce: decimal("price_per_ounce", { precision: 10, scale: 2 }),
  pricePerEighth: decimal("price_per_eighth", { precision: 10, scale: 2 }),
  pricePerQuarter: decimal("price_per_quarter", { precision: 10, scale: 2 }),
  pricePerHalf: decimal("price_per_half", { precision: 10, scale: 2 }),
  quantityTiers: text("quantity_tiers"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPriceTemplateSchema = createInsertSchema(priceTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Template name is required"),
  templateType: z.enum(["units", "weight", "quantity"]),
  description: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  pricePerGram: z.string().nullable().optional(),
  pricePerOunce: z.string().nullable().optional(),
  pricePerEighth: z.string().nullable().optional(),
  pricePerQuarter: z.string().nullable().optional(),
  pricePerHalf: z.string().nullable().optional(),
  quantityTiers: z.string().nullable().optional(),
});

export type PriceTemplate = typeof priceTemplates.$inferSelect;
export type InsertPriceTemplate = z.infer<typeof insertPriceTemplateSchema>;