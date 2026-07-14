import {
  users,
  sessions,
  categories,
  products,
  productSizes,
  productQuantityPricing,
  orders,
  orderItems,
  inventoryLogs,
  userActivityLogs,
  notifications,
  supportTickets,
  supportTicketResponses,
  passwordResetTokens,
  cityPurchaseLimits,
  accessPasswords,
  discounts,
  promotionalAds,
  promoCodes,
  promoCodeUses,
  priceTemplates,
  boardPosts,
  type Discount,
  type PromotionalAd,
  type AccessPassword,
  type PromoCode,
  type BoardPost,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type ProductSize,
  type InsertProductSize,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type InventoryLog,
  type InsertInventoryLog,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, desc, and, gte, lt, inArray, or, ne, asc, ilike, exists, lte, isNull, like, gt } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { queryCache, categoriesCache, productsCache, analyticsCache, generateCacheKey, invalidateCache, withCache } from "./cache";

async function retryQuery<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.cause?.message || error?.message || '';
      const isRetryable = errorMsg.includes("ECONNRESET") ||
        errorMsg.includes("socket hang up") ||
        errorMsg.includes("Connection terminated");
      if (isRetryable && attempt < retries) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("retryQuery: exhausted retries");
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByReferralCode(code: string): Promise<User | undefined>;
  createUserWithPassword(userData: any): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  getUserCount(): Promise<number>;
  incrementReferralCount(userId: string): Promise<void>;

  // Category operations
  getCategories(): Promise<(Category & { children?: Category[] })[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Product operations
  getProducts(filters?: { categoryId?: number; categoryIds?: number[]; search?: string; status?: string; isActive?: boolean }): Promise<(Product & { category: Category | null; sizes?: ProductSize[] })[]>;
  getProductBySku(sku: string): Promise<(Product & { category: Category | null }) | undefined>;
  getProduct(id: number): Promise<(Product & { category: Category | null; sizes?: ProductSize[] }) | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  adjustStock(productId: number, quantity: number, userId: string, reason: string, sizeName?: string): Promise<void>;
  getLowStockProducts(): Promise<Product[]>;

  // Order operations
  getOrders(filters?: { status?: string; statuses?: string[]; customerId?: string; assignedUserId?: string; hideOldDelivered?: boolean }): Promise<Order[]>;
  getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product | null })[] }) | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order>;
  updateOrderTotal(id: number, total: number): Promise<Order>;
  fulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string, orderItemId?: number): Promise<void>;
  unfulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string, orderItemId?: number): Promise<void>;
  substituteOrderItem(orderId: number, oldItemId: number, newProductId: number, quantity: number, userId: string): Promise<void>;
  removeOrderItem(orderId: number, itemId: number, userId: string): Promise<void>;
  addOrderItem(orderId: number, productId: number, quantity: number, userId: string, unitPrice?: number, unitLabel?: string): Promise<void>;
  updateOrderItemPrice(orderId: number, itemId: number, newPrice: number): Promise<Order>;
  markOrderItemAsPacked(orderId: number, productId: number, userId: string, orderItemId?: number): Promise<{ success: boolean; allPacked: boolean }>;
  assignOrderToUser(orderId: number, assignedUserId: string): Promise<Order>;
  deleteOrder(id: number): Promise<void>;
  clearAllOrders(statuses?: string[]): Promise<number>;

  // Analytics operations
  getSalesMetrics(days: number): Promise<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
  }>;
  getTopProducts(limit: number): Promise<{ product: Product; sales: number; revenue: number }[]>;
  getOrderStatusBreakdown(): Promise<{ status: string; count: number }[]>;
  getSalesTrend(days: number): Promise<{ date: string; sales: number; orders: number; customers: number }[]>;
  getCategoryBreakdown(): Promise<{ name: string; value: number; revenue: number; fill: string }[]>;
  getAdvancedMetrics(days: number): Promise<{
    netProfit: number;
    salesGrowthRate: number;
    returnRate: number;
    abandonedCartRate: number;
  }>;
  getPeakPurchaseTimes(days?: number): Promise<{ time: string; orders: number; percentage: number }[]>;
  getInventoryMetrics(): Promise<{
    stockTurnoverRate: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }>;
  getCustomerMetrics(days: number): Promise<{
    retentionRate: number;
    avgPurchaseFrequency: number;
    customerLifetimeValue: number;
    customerGrowth: { month: string; new: number; returning: number }[];
  }>;
  getOperationsMetrics(days: number): Promise<{
    avgFulfillmentTime: number;
    fulfillmentRate: number;
    costOfGoodsSold: number;
  }>;

  // Notification operations
  getNotifications(userId?: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<void>;
  deleteNotification(id: number): Promise<void>;

  // User management
  getUsersWithStats(): Promise<(User & { orderCount?: number })[]>;
  updateUserStatus(id: string, status: string): Promise<User>;
  updateUserRole(id: string, role: string): Promise<User>;
  updateUserIdVerification(id: string, status: string): Promise<User>;
  getUsersPendingVerification(): Promise<User[]>;
  updateUser(id: string, userData: any): Promise<User>;
  getStaffUsers(): Promise<User[]>;
  getUsersWithRole(role: string): Promise<User[]>;
  deleteUser(id: string): Promise<void>;

  // User activity
  logUserActivity(userId: string, action: string, details: string, metadata?: any): Promise<void>;
  getUserActivity(userId: string, options?: { limit?: number; type?: string }): Promise<any[]>;
  getInventoryLogs(filters?: { days?: number; type?: string; product?: string }): Promise<any[]>;

  // Support ticket operations
  createSupportTicket(data: any): Promise<any>;
  getSupportTickets(filters?: any): Promise<any[]>;
  updateSupportTicketStatus(id: number, status: string): Promise<any>;
  assignSupportTicket(id: number, assignedTo: string | null): Promise<any>;
  addSupportTicketResponse(ticketId: number, responseData: any): Promise<any>;
  deleteSupportTicket(id: number): Promise<void>;
  archiveSupportTicket(id: number): Promise<any>;
  unarchiveSupportTicket(id: number): Promise<any>;
  clearAllSupportTickets(): Promise<void>;
  cleanupOldClosedTickets(): Promise<void>;

  // Password reset operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | undefined>;
  deletePasswordResetToken(token: string): Promise<void>;
  cleanupExpiredPasswordResetTokens(): Promise<void>;

  // City purchase limits
  getCityPurchaseLimits(): Promise<any[]>;
  getCityPurchaseLimit(id: number): Promise<any | undefined>;
  getCityPurchaseLimitByCity(cityName: string): Promise<any | undefined>;
  createCityPurchaseLimit(data: any): Promise<any>;
  updateCityPurchaseLimit(id: number, data: any): Promise<any>;
  deleteCityPurchaseLimit(id: number): Promise<void>;

  // Access passwords
  getAccessPasswords(): Promise<AccessPassword[]>;
  getAccessPassword(id: number): Promise<AccessPassword | undefined>;
  createAccessPassword(data: any): Promise<AccessPassword>;

  // Promo code operations
  getPromoCodes(): Promise<PromoCode[]>;
  getPromoCode(id: number): Promise<PromoCode | undefined>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  createPromoCode(data: any): Promise<PromoCode>;
  updatePromoCode(id: number, data: any): Promise<PromoCode | undefined>;
  deletePromoCode(id: number): Promise<void>;
  getPromoCodeUsesForUser(promoCodeId: number, userId: string): Promise<number>;
  recordPromoCodeUse(promoCodeId: number, userId: string): Promise<void>;
  incrementPromoCodeTotalUses(promoCodeId: number): Promise<void>;

  updateAccessPassword(id: number, data: any): Promise<AccessPassword | undefined>;
  deleteAccessPassword(id: number): Promise<void>;
  verifyAccessPassword(password: string): Promise<number | null>;
  isAccessPasswordStillValid(passwordId: number): Promise<boolean>;
  setUserGrantedAccessPassword(userId: string, passwordId: number | null): Promise<void>;

  // Price template operations
  getPriceTemplates(): Promise<any[]>;
  getPriceTemplate(id: number): Promise<any | undefined>;
  createPriceTemplate(data: any): Promise<any>;
  updatePriceTemplate(id: number, data: any): Promise<any>;
  deletePriceTemplate(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private extractSizeFromProductName(productName: string): string | null {
    const match = productName.match(/\(Size:\s*([^)]+)\)/);
    return match ? match[1].trim() : null;
  }

  private extractWeightOptionFromProductName(productName: string): string | null {
    // Try to extract weight options from productName
    // Weight options might be appended like "Product Name - 1/8 oz" or similar
    const weightPatterns = [
      /(?:[-–—]\s*)?(1\/8\s*oz|⅛\s*oz|1\/8oz)/i,
      /(?:[-–—]\s*)?(1\/4\s*oz|¼\s*oz|1\/4oz)/i,
      /(?:[-–—]\s*)?(1\/2\s*oz|½\s*oz|1\/2oz)/i,
      /(?:[-–—]\s*)?(1\s*oz|1oz|ounce)/i,
      /(?:[-–—]\s*)?(grams?)/i,
    ];
    
    for (const pattern of weightPatterns) {
      const match = productName.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private getGramEquivalentFromSize(sizeLabel: string | null | undefined): number {
    if (!sizeLabel) return 1; // Default to 1 if no size label
    
    const normalized = sizeLabel.toLowerCase().trim();
    
    // Check for weight options
    if (normalized.includes('1/8') || normalized.includes('⅛')) {
      return 3.5;
    }
    if (normalized.includes('1/4') || normalized.includes('¼')) {
      return 7;
    }
    if (normalized.includes('1/2') || normalized.includes('½')) {
      return 14;
    }
    if ((normalized.includes('1') && normalized.includes('oz')) || normalized === '1oz' || normalized === 'ounce') {
      return 28;
    }
    if (normalized.includes('gram') || normalized === 'grams') {
      return 1;
    }
    
    // Default to 1 if no match (assume grams)
    return 1;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByReferralCode(code: string): Promise<User | undefined> {
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, code.toUpperCase()));
    return result;
  }

  async incrementReferralCount(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ referralCount: sql`${users.referralCount} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async createUserWithPassword(userData: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    idImageUrl?: string | null;
    verificationPhotoUrl?: string | null;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    telegramUsername?: string | null;
    idVerificationStatus?: string;
    role: string;
    status: string;
    referredBy?: string | null;
  }) {
    const userCount = await this.getUserCount();
    let status = 'pending';
    let role = 'customer';

    if (userCount === 0) {
      status = 'active';
      role = 'admin';
    }

    // Generate a unique referral code
    let referralCode = this.generateReferralCode();
    let codeExists = await this.getUserByReferralCode(referralCode);
    while (codeExists) {
      referralCode = this.generateReferralCode();
      codeExists = await this.getUserByReferralCode(referralCode);
    }

    userData = {
      ...userData,
      status,
      role
    };

    const [newUser] = await db
      .insert(users)
      .values({ ...userData, referralCode })
      .returning();

    // Create notification for admins about new user registration
    const adminUsers = await this.getUsersWithRole('admin');
    for (const admin of adminUsers) {
      await this.createNotification({
        userId: admin.id,
        type: 'new_user_registration',
        title: 'New User Registration',
        message: `${userData.firstName} ${userData.lastName} has registered and is awaiting approval`,
        data: { userId: newUser.id, userEmail: userData.email, userName: `${userData.firstName} ${userData.lastName}` }
      });
    }
    return newUser;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    return result[0];
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    });
  }

  async getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | undefined> {
    const [result] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return result;
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
  }

  async cleanupExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, new Date()));
  }

  async getUserCount(): Promise<number> {
    try {
      const result = await db.select({ count: sql`count(*)` }).from(users);
      return parseInt(result[0].count as string);
    } catch (error) {
      console.error("Error getting user count:", error);
      throw new Error("Failed to get user count");
    }
  }

  // Category operations
  async getCategories(): Promise<(Category & { children?: Category[] })[]> {
    return withCache(categoriesCache, generateCacheKey.categoryHierarchy(), async () => {
    const allCategories = await db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.sortOrder, categories.name);

    // Build hierarchical structure
    const categoryMap = new Map<number, Category & { children: Category[] }>();
    const rootCategories: (Category & { children: Category[] })[] = [];

    // First pass: create all category objects
    for (const category of allCategories) {
      categoryMap.set(category.id, { ...category, children: [] });
    }

    // Second pass: build hierarchy
    for (const category of allCategories) {
      const categoryWithChildren = categoryMap.get(category.id)!;
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    }

    return rootCategories;
    });
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    invalidateCache.categories(); // Invalidate categories cache
    return newCategory;
  }

  async updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    invalidateCache.categories(); // Invalidate categories cache
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    // Check if category has children
    const children = await db.select().from(categories).where(eq(categories.parentId, id));
    if (children.length > 0) {
      throw new Error("Cannot delete category with subcategories");
    }

    // Check if category has products
    const productsInCategory = await db.select().from(products).where(eq(products.categoryId, id));
    if (productsInCategory.length > 0) {
      throw new Error("Cannot delete category with products");
    }

    await db.delete(categories).where(eq(categories.id, id));
    invalidateCache.categories(); // Invalidate categories cache
  }

  // Optimized helper function to get all descendant category IDs
  private async getDescendantCategoryIds(categoryId: number): Promise<number[]> {
    // Use a more efficient single query to get children
    const directChildren = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.parentId, categoryId), eq(categories.isActive, true)));

    const categoryIds = [categoryId];
    for (const child of directChildren) {
      categoryIds.push(child.id);
      // For now, only go one level deep to avoid expensive recursive queries
      // This covers our current use case (parent -> direct children)
    }

    return categoryIds;
  }

  // Product operations
  async getProducts(filters?: {
    categoryId?: number;
    categoryIds?: number[];
    search?: string;
    status?: string;
    isActive?: boolean;
  }): Promise<(Product & { category: Category | null; sizes?: ProductSize[] })[]> {
    let query = db
      .select({
        id: products.id,
        name: products.name,
        company: products.company,
        description: products.description,
        price: products.price,
        sku: products.sku,
        categoryId: products.categoryId,
        imageUrl: products.imageUrl,
        imageUrls: products.imageUrls,
        stock: products.stock,
        physicalInventory: products.physicalInventory,
        minStockThreshold: products.minStockThreshold,
        sellingMethod: products.sellingMethod,
        weightUnit: products.weightUnit,
        pricePerGram: products.pricePerGram,
        pricePerOunce: products.pricePerOunce,
        pricePerEighth: products.pricePerEighth,
        pricePerQuarter: products.pricePerQuarter,
        pricePerHalf: products.pricePerHalf,
        discountPercentage: products.discountPercentage,
        bogoEnabled: products.bogoEnabled,
        bogoFreeOptionIndex: products.bogoFreeOptionIndex,
        purchasePrice: products.purchasePrice,
        purchasePriceMethod: products.purchasePriceMethod,
        purchasePricePerGram: products.purchasePricePerGram,
        purchasePricePerOunce: products.purchasePricePerOunce,
        adminNotes: products.adminNotes,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          parentId: categories.parentId,
          isActive: categories.isActive,
          sortOrder: categories.sortOrder,
          createdAt: categories.createdAt,
        },
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    const conditions = [];

    // Active status filter - only apply if explicitly set
    if (filters?.isActive !== undefined) {
      conditions.push(eq(products.isActive, filters.isActive));
    }

    if (filters?.categoryIds) {
      const allCats = await db
        .select({ id: categories.id, parentId: categories.parentId })
        .from(categories)
        .where(eq(categories.isActive, true));

      const allCategoryIds = new Set(filters.categoryIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const cat of allCats) {
          if (cat.parentId && allCategoryIds.has(cat.parentId) && !allCategoryIds.has(cat.id)) {
            allCategoryIds.add(cat.id);
            changed = true;
          }
        }
      }

      if (allCategoryIds.size > 0) {
        conditions.push(inArray(products.categoryId, Array.from(allCategoryIds)));
      }
    } else if (filters?.categoryId) {
      // Single category with subcategories optimization
      conditions.push(
        or(
          eq(products.categoryId, filters.categoryId),
          exists(
            db
              .select({ id: categories.id })
              .from(categories)
              .where(
                and(
                  eq(categories.parentId, filters.categoryId),
                  eq(categories.id, products.categoryId),
                  eq(categories.isActive, true)
                )
              )
          )
        )
      );
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.description, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`),
          ilike(categories.name, `%${filters.search}%`)
        )
      );
    }

    if (filters?.status === 'low_stock') {
      conditions.push(lte(products.stock, products.minStockThreshold));
    } else if (filters?.status === 'out_of_stock') {
      conditions.push(eq(products.stock, 0));
    } else if (filters?.status === 'in_stock') {
      conditions.push(sql`${products.stock} > ${products.minStockThreshold}`);
    }

    let finalQuery = query;
    if (conditions.length > 0) {
      finalQuery = finalQuery.where(and(...conditions));
    }

    const productsList = await finalQuery.orderBy(desc(products.createdAt));

    // If no products, return empty array with proper type
    if (productsList.length === 0) {
      return [];
    }

    // Fetch sizes for all products (if any exist)
    try {
      const productIds = productsList.map(p => p.id);
      
      const sizes = await retryQuery(() =>
        db.select().from(productSizes).where(inArray(productSizes.productId, productIds))
      );

      // Group sizes by product ID
      const sizesByProductId = new Map<number, ProductSize[]>();
      for (const size of sizes) {
        if (!sizesByProductId.has(size.productId)) {
          sizesByProductId.set(size.productId, []);
        }
        sizesByProductId.get(size.productId)!.push(size);
      }

      // Fetch quantity pricing tiers for all products
      let tiersByProductId = new Map<number, any[]>();
      try {
        const allTiers = await retryQuery(() =>
          db.select().from(productQuantityPricing).where(inArray(productQuantityPricing.productId, productIds))
        );
        for (const tier of allTiers) {
          if (!tiersByProductId.has(tier.productId)) {
            tiersByProductId.set(tier.productId, []);
          }
          tiersByProductId.get(tier.productId)!.push({
            id: tier.id,
            productId: tier.productId,
            minQuantity: tier.minQuantity,
            pricePerItem: tier.pricePerItem,
          });
        }
        for (const tiers of tiersByProductId.values()) {
          tiers.sort((a, b) => a.minQuantity - b.minQuantity);
        }
      } catch (tierErr) {
        // table may not exist yet, ignore
      }

      // Fetch bogo fields via direct SQL (bypasses Drizzle ORM column caching)
      const bogoByProductId = new Map<number, { bogoEnabled: boolean; bogoFreeOptionIndex: number | null }>();
      try {
        const { sql: rawSql } = await import("./db");
        const bogoResult = await rawSql`SELECT id, bogo_enabled, bogo_free_option_index FROM products WHERE id = ANY(${productIds})`;
        for (const row of bogoResult) {
          bogoByProductId.set(Number(row.id), {
            bogoEnabled: row.bogo_enabled === true || row.bogo_enabled === 't' || row.bogo_enabled === 'true',
            bogoFreeOptionIndex: row.bogo_free_option_index != null ? parseInt(String(row.bogo_free_option_index)) : null,
          });
        }
      } catch (bogoErr) {
        // columns may not exist yet, ignore
      }

      // Attach sizes, tiers, and bogo to each product
      const result = productsList.map(product => ({
        ...product,
        ...bogoByProductId.get(product.id),
        sizes: sizesByProductId.get(product.id) || [],
        quantityPricing: tiersByProductId.get(product.id) || [],
      }));
      
      return result;
    } catch (error) {
      // If there's an error fetching sizes, return products without sizes
      console.error('[getProducts] Error fetching product sizes:', error);
      const result = productsList.map(product => ({
        ...product,
        sizes: [] as ProductSize[],
        quantityPricing: [],
      }));
      return result;
    }
  }

  async getProductBySku(sku: string): Promise<(Product & { category: Category | null }) | undefined> {
    const results = await retryQuery(() =>
      db.select().from(products).where(eq(products.sku, sku))
    );
    if (!results[0]) return undefined;
    return { ...results[0], category: null };
  }

  async getProduct(id: number): Promise<(Product & { category: Category | null; sizes?: ProductSize[] }) | undefined> {
    let product: any;
    try {
      const rawResult = await retryQuery(() =>
        db.execute(sql`SELECT id, name, company, description, price, sku, category_id, image_url, image_urls, stock, physical_inventory, min_stock_threshold, selling_method, weight_unit, price_per_gram, price_per_ounce, price_per_eighth, price_per_quarter, price_per_half, discount_percentage, bogo_enabled, bogo_free_option_index, purchase_price, purchase_price_method, purchase_price_per_gram, purchase_price_per_ounce, admin_notes, is_active, created_at, updated_at FROM products WHERE id = ${id}`)
      );
      
      const row = rawResult?.rows?.[0];
      if (row) {
        product = {
          id: row.id,
          name: row.name,
          company: row.company || '',
          description: row.description || '',
          price: row.price,
          sku: row.sku,
          categoryId: row.category_id,
          imageUrl: row.image_url,
          imageUrls: row.image_urls,
          stock: row.stock,
          physicalInventory: row.physical_inventory,
          minStockThreshold: row.min_stock_threshold,
          sellingMethod: row.selling_method,
          weightUnit: row.weight_unit,
          pricePerGram: row.price_per_gram,
          pricePerOunce: row.price_per_ounce,
          pricePerEighth: row.price_per_eighth,
          pricePerQuarter: row.price_per_quarter,
          pricePerHalf: row.price_per_half,
          discountPercentage: row.discount_percentage,
          bogoEnabled: row.bogo_enabled === true || row.bogo_enabled === 't' || row.bogo_enabled === 'true',
          bogoFreeOptionIndex: row.bogo_free_option_index != null ? parseInt(String(row.bogo_free_option_index)) : null,
          purchasePrice: row.purchase_price,
          purchasePriceMethod: row.purchase_price_method,
          purchasePricePerGram: row.purchase_price_per_gram,
          purchasePricePerOunce: row.purchase_price_per_ounce,
          adminNotes: row.admin_notes,
          isActive: row.is_active === true || row.is_active === 't' || row.is_active === 'true',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          category: null as Category | null,
        };
        
        if (product.categoryId) {
          try {
            const catResult = await retryQuery(() =>
              db.execute(sql`SELECT id, name, description, parent_id, is_active, sort_order, created_at FROM categories WHERE id = ${product.categoryId}`)
            );
            const catRow = catResult?.rows?.[0];
            if (catRow) {
              product.category = {
                id: catRow.id,
                name: catRow.name,
                description: catRow.description,
                parentId: catRow.parent_id,
                isActive: catRow.is_active === true || catRow.is_active === 't' || catRow.is_active === 'true',
                sortOrder: catRow.sort_order,
                createdAt: catRow.created_at,
              };
            }
          } catch (e) {
            console.warn('[getProduct] Error fetching category:', e);
          }
        }
      }
    } catch (error) {
      console.error('[getProduct] Error fetching product:', error);
    }
    
    if (!product) return undefined;

    try {
      const sizesResult = await retryQuery(() =>
        db.execute(sql`SELECT id, product_id, size, quantity, physical_quantity, created_at, updated_at FROM product_sizes WHERE product_id = ${id}`)
      );
      const sizes = (sizesResult?.rows || []).map((r: any) => ({
        id: r.id,
        productId: r.product_id,
        size: r.size,
        quantity: r.quantity,
        physicalQuantity: r.physical_quantity,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      let quantityPricingTiers: any[] = [];
      try {
        const tiersResult = await retryQuery(() =>
          db.select().from(productQuantityPricing).where(eq(productQuantityPricing.productId, id))
        );
        quantityPricingTiers = tiersResult.map(r => ({
          id: r.id,
          productId: r.productId,
          minQuantity: r.minQuantity,
          pricePerItem: r.pricePerItem,
        })).sort((a, b) => a.minQuantity - b.minQuantity);
      } catch (tierErr) {
        // table may not exist yet
      }

      return {
        ...product,
        sizes: sizes.length > 0 ? sizes : undefined,
        quantityPricing: quantityPricingTiers,
      };
    } catch (error) {
      console.error('[getProduct] Error fetching product sizes:', error);
      return { ...product, sizes: [], quantityPricing: [] };
    }
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const { sizes, ...productDataWithoutSizes } = productData;
    
    // Ensure stock is a number
    const stockValue = typeof productData.stock === 'string' ? parseInt(productData.stock, 10) : (productData.stock || 0);
    
    const toNumericStr = (val: any): string | undefined => {
      if (val === null || val === undefined || val === '') return undefined;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? undefined : String(num);
    };

    const processedProduct: Record<string, any> = {
      ...productDataWithoutSizes,
      stock: stockValue,
      price: productData.price || "0",
      physicalInventory: stockValue,
      updatedAt: new Date()
    };

    console.log('[createProduct] productDataWithoutSizes:', JSON.stringify(productDataWithoutSizes, null, 2));
    console.log('[createProduct] processedProduct before insert:', JSON.stringify(processedProduct, null, 2));

    const numericFields = ['pricePerGram', 'pricePerOunce', 'pricePerEighth', 'pricePerQuarter', 'pricePerHalf', 'discountPercentage', 'purchasePrice', 'purchasePricePerGram', 'purchasePricePerOunce'] as const;
    for (const field of numericFields) {
      const val = toNumericStr(productData[field]);
      if (val !== undefined) {
        processedProduct[field] = val;
      } else {
        delete processedProduct[field];
      }
    }
    
    // Log the fractional ounce pricing fields specifically for debugging
    console.log('[createProduct] Fractional ounce pricing fields:', {
      pricePerEighth: processedProduct.pricePerEighth,
      pricePerQuarter: processedProduct.pricePerQuarter,
      pricePerHalf: processedProduct.pricePerHalf,
      rawData: {
        pricePerEighth: productData.pricePerEighth,
        pricePerQuarter: productData.pricePerQuarter,
        pricePerHalf: productData.pricePerHalf,
      }
    });

    const stringFields = ['company', 'adminNotes', 'imageUrls'] as const;
    for (const field of stringFields) {
      if (processedProduct[field] === '') {
        delete processedProduct[field];
      }
    }

    let newProduct: Product | undefined;
    // Declare these outside try block so they're accessible in catch block
    let cleanedInsertData: Record<string, any> = {};
    let fractionalFieldsToInsert: any = {};
    
    try {
      console.log('[createProduct] Attempting to insert product with imageUrls:', processedProduct.imageUrls ? `present (${typeof processedProduct.imageUrls})` : 'missing');
      console.log('[createProduct] imageUrls value:', processedProduct.imageUrls);
      
      // First, ensure fractional pricing columns exist
      try {
        const { sql } = await import("./db");
        await sql`
          ALTER TABLE products 
          ADD COLUMN IF NOT EXISTS price_per_eighth DECIMAL(10, 2),
          ADD COLUMN IF NOT EXISTS price_per_quarter DECIMAL(10, 2),
          ADD COLUMN IF NOT EXISTS price_per_half DECIMAL(10, 2);
        `;
      } catch (colError: any) {
        // Columns might already exist, that's fine
        if (!colError?.message?.includes('already exists') && !colError?.message?.includes('duplicate')) {
          console.warn('[createProduct] Could not ensure fractional pricing columns exist:', colError?.message);
        }
      }

      // Ensure imageUrls is explicitly included if it exists
      const insertData = { ...processedProduct };
      if (insertData.imageUrls === null || insertData.imageUrls === undefined) {
        delete insertData.imageUrls;
      }
      
      // Keep fractional pricing fields in insertData - Drizzle handles them correctly
      fractionalFieldsToInsert = {};
      if (insertData.hasOwnProperty('pricePerEighth')) {
        fractionalFieldsToInsert.pricePerEighth = insertData.pricePerEighth;
      }
      if (insertData.hasOwnProperty('pricePerQuarter')) {
        fractionalFieldsToInsert.pricePerQuarter = insertData.pricePerQuarter;
      }
      if (insertData.hasOwnProperty('pricePerHalf')) {
        fractionalFieldsToInsert.pricePerHalf = insertData.pricePerHalf;
      }
      
      // Clean up insertData - remove undefined values but keep null for numeric fields
      // Important: For numeric fields, explicitly set null (not empty string) so PostgreSQL gets NULL
      cleanedInsertData = {};
      const numericFieldNames = ['pricePerGram', 'pricePerOunce', 'pricePerEighth', 'pricePerQuarter', 'pricePerHalf', 'discountPercentage', 'purchasePrice', 'purchasePricePerGram', 'purchasePricePerOunce'];
      
      for (const [key, value] of Object.entries(insertData)) {
        // Skip undefined values
        if (value === undefined) {
          continue;
        }
        
        if (numericFieldNames.includes(key)) {
          if (value === null || value === '' || value === 'null' || (typeof value === 'string' && value.trim() === '')) {
            continue;
          }
          if (typeof value === 'string' && isNaN(parseFloat(value))) {
            continue;
          }
        }
        
        // For optional string fields, keep null if explicitly set
        const optionalStringFields = ['company', 'description', 'imageUrl', 'imageUrls', 'adminNotes'];
        if (value === null && !optionalStringFields.includes(key) && !numericFieldNames.includes(key)) {
          continue;
        }
        
        cleanedInsertData[key] = value;
      }
      
      // Log what we're about to insert for fractional ounce pricing
      console.log('[createProduct] Inserting with fractional pricing:', fractionalFieldsToInsert);
      console.log('[createProduct] Insert data keys:', Object.keys(cleanedInsertData).join(', '));
      console.log('[createProduct] Insert data sample:', JSON.stringify(Object.fromEntries(Object.entries(cleanedInsertData).slice(0, 10)), null, 2));
      
      try {
        const result = await db
          .insert(products)
          .values([cleanedInsertData as any])
          .returning();
        newProduct = result?.[0];
        console.log('[createProduct] Insert successful, product ID:', newProduct?.id);
      } catch (insertErr: any) {
        console.error('[createProduct] Drizzle insert failed:', insertErr?.message);
        console.error('[createProduct] Insert error details:', {
          message: insertErr?.message,
          cause: insertErr?.cause?.message,
          code: insertErr?.code,
          severity: insertErr?.cause?.severity,
          sql: insertErr?.cause?.sql,
        });
        console.error('[createProduct] Attempted insert data:', JSON.stringify(cleanedInsertData, null, 2));
        throw insertErr; // Re-throw to be caught by outer catch
      }
      
      console.log('[createProduct] Product created successfully, imageUrls:', newProduct?.imageUrls ? `present (${newProduct.imageUrls.substring(0, 50)}...)` : 'missing');
      
      // Now update fractional pricing fields via direct SQL
      if (Object.keys(fractionalFieldsToInsert).length > 0 && newProduct) {
        try {
          const { sql } = await import("./db");
          
          // Build update query with proper parameterization
          if (fractionalFieldsToInsert.pricePerEighth !== undefined && fractionalFieldsToInsert.pricePerEighth !== null) {
            await sql`UPDATE products SET price_per_eighth = ${fractionalFieldsToInsert.pricePerEighth} WHERE id = ${newProduct.id}`;
          }
          if (fractionalFieldsToInsert.pricePerQuarter !== undefined && fractionalFieldsToInsert.pricePerQuarter !== null) {
            await sql`UPDATE products SET price_per_quarter = ${fractionalFieldsToInsert.pricePerQuarter} WHERE id = ${newProduct.id}`;
          }
          if (fractionalFieldsToInsert.pricePerHalf !== undefined && fractionalFieldsToInsert.pricePerHalf !== null) {
            await sql`UPDATE products SET price_per_half = ${fractionalFieldsToInsert.pricePerHalf} WHERE id = ${newProduct.id}`;
          }
          
          console.log('[createProduct] Successfully updated fractional pricing via direct SQL');
          // Fetch again to get updated product
          const updated = await db.select().from(products).where(eq(products.id, newProduct.id));
          if (updated[0]) {
            newProduct = updated[0];
          }
        } catch (fractionalError: any) {
          // Log but don't fail - product was created successfully
          console.warn('[createProduct] Failed to update fractional pricing fields (product was created):', fractionalError?.message);
        }
      }
      
      console.log('[createProduct] Product created with fractional pricing:', {
        pricePerEighth: (newProduct as any)?.pricePerEighth,
        pricePerQuarter: (newProduct as any)?.pricePerQuarter,
        pricePerHalf: (newProduct as any)?.pricePerHalf,
      });
      
      // If imageUrls wasn't saved, try to update it directly
      if (processedProduct.imageUrls && !newProduct?.imageUrls) {
        console.warn('[createProduct] imageUrls was not saved in insert, attempting direct SQL update');
        const { sql } = await import("./db");
        await sql`UPDATE products SET image_urls = ${processedProduct.imageUrls} WHERE id = ${newProduct.id}`;
        // Fetch again to get updated product
        const updated = await db.select().from(products).where(eq(products.id, newProduct.id));
        if (updated[0]) {
          newProduct = updated[0];
          console.log('[createProduct] Successfully updated imageUrls via direct SQL');
        }
      }
      
    } catch (insertError: any) {
      console.error('[createProduct] Insert error:', insertError?.message || String(insertError));
      console.error('[createProduct] Insert error cause:', insertError?.cause?.message || insertError?.cause);
      
      if (insertError?.cause?.severity === 'ERROR') {
        // Check if it's a column doesn't exist error
        const errorMsg = insertError?.message || insertError?.cause?.message || String(insertError);
        if (errorMsg.includes('image_urls') || (errorMsg.includes('column') && errorMsg.includes('does not exist'))) {
          console.error('[createProduct] ERROR: Required column does not exist in database! Please run migration.');
        }
        // Check if it's related to fractional pricing columns
        if (errorMsg.includes('price_per_eighth') || errorMsg.includes('price_per_quarter') || errorMsg.includes('price_per_half')) {
          console.error('[createProduct] ERROR: Fractional pricing columns do not exist! Attempting to create...');
          try {
            const { sql } = await import("./db");
            await sql`
              ALTER TABLE products 
              ADD COLUMN IF NOT EXISTS price_per_eighth DECIMAL(10, 2),
              ADD COLUMN IF NOT EXISTS price_per_quarter DECIMAL(10, 2),
              ADD COLUMN IF NOT EXISTS price_per_half DECIMAL(10, 2);
            `;
            console.log('[createProduct] Created fractional pricing columns, retrying insert...');
            // Retry the insert with cleaned data
            const retryResult = await db
              .insert(products)
              .values([cleanedInsertData as any])
              .returning();
            newProduct = retryResult?.[0];
            // Continue with fractional field update if product was created
            if (newProduct && Object.keys(fractionalFieldsToInsert).length > 0) {
              const { sql: updateSql } = await import("./db");
              
              // Update each field individually
              if (fractionalFieldsToInsert.pricePerEighth !== undefined && fractionalFieldsToInsert.pricePerEighth !== null) {
                await updateSql`UPDATE products SET price_per_eighth = ${fractionalFieldsToInsert.pricePerEighth} WHERE id = ${newProduct.id}`;
              }
              if (fractionalFieldsToInsert.pricePerQuarter !== undefined && fractionalFieldsToInsert.pricePerQuarter !== null) {
                await updateSql`UPDATE products SET price_per_quarter = ${fractionalFieldsToInsert.pricePerQuarter} WHERE id = ${newProduct.id}`;
              }
              if (fractionalFieldsToInsert.pricePerHalf !== undefined && fractionalFieldsToInsert.pricePerHalf !== null) {
                await updateSql`UPDATE products SET price_per_half = ${fractionalFieldsToInsert.pricePerHalf} WHERE id = ${newProduct.id}`;
              }
            }
          } catch (retryError: any) {
            console.error('[createProduct] Retry after creating columns also failed:', retryError?.message);
            throw insertError; // Throw original error
          }
        } else {
          throw insertError;
        }
      } else {
        console.warn('Insert returning() parse issue, fetching by SKU:', insertError);
      }
    }

    if (!newProduct) {
      const found = await db
        .select()
        .from(products)
        .where(eq(products.sku, String(processedProduct.sku || productData.sku)));
      newProduct = found?.[found.length - 1];
    }

    if (!newProduct) {
      throw new Error("Product was created but could not be retrieved");
    }

    if (sizes && sizes.length > 0) {
      const sizeRecords: InsertProductSize[] = sizes.map(size => ({
        productId: newProduct!.id,
        size: size.size,
        quantity: size.quantity,
        physicalQuantity: size.quantity,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      try {
        await db.insert(productSizes).values(sizeRecords);
      } catch (sizeError) {
        console.warn('Error creating product sizes:', sizeError);
      }
    }

    // Save quantity pricing tiers
    const quantityPricingData = (productData as any).quantityPricing;
    if (quantityPricingData && quantityPricingData.length > 0 && newProduct) {
      try {
        const tierRecords = quantityPricingData.map((tier: any) => ({
          productId: newProduct!.id,
          minQuantity: tier.minQuantity,
          pricePerItem: String(tier.pricePerItem),
        }));
        await db.insert(productQuantityPricing).values(tierRecords);
      } catch (tierError) {
        console.warn('Error creating product quantity pricing tiers:', tierError);
      }
    }

    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product> {
    const { sizes, ...dataWithoutSizes } = productData as any;

    const toNumericStr = (val: any): string | undefined => {
      if (val === null || val === undefined || val === '') return undefined;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? undefined : String(num);
    };

    const updateData: Record<string, any> = { ...dataWithoutSizes };
    delete updateData.enableSizes;

    if (dataWithoutSizes.stock !== undefined) {
      updateData.physicalInventory = dataWithoutSizes.stock;
    }

    const numericFields = ['pricePerGram', 'pricePerOunce', 'pricePerEighth', 'pricePerQuarter', 'pricePerHalf', 'discountPercentage', 'purchasePrice', 'purchasePricePerGram', 'purchasePricePerOunce'];
    for (const field of numericFields) {
      if (field in updateData) {
        // For fractional pricing fields, preserve the value as-is (string or null) to ensure they're always updated
        if (['pricePerEighth', 'pricePerQuarter', 'pricePerHalf'].includes(field)) {
          // Keep the value as-is - it's already formatted as a string or null from the frontend
          // Don't convert it, just ensure it's in the updateData
          if (updateData[field] === '' || updateData[field] === undefined) {
            updateData[field] = null;
          }
          // Value is already a formatted string like "3.00" or null, keep it
        } else {
          const val = toNumericStr(updateData[field]);
          if (val !== undefined) {
            if (field === 'discountPercentage') {
              const numVal = parseFloat(val);
              updateData[field] = (isNaN(numVal) || numVal < 0) ? "0" : val;
            } else {
              updateData[field] = val;
            }
          } else {
            if (field === 'discountPercentage') {
              updateData[field] = "0";
            } else if (updateData[field] === '' || updateData[field] === null) {
              updateData[field] = null;
            } else {
              delete updateData[field];
            }
          }
        }
      }
    }
    
    // Log the fractional ounce pricing fields specifically for debugging
    console.log('[updateProduct] Fractional ounce pricing fields:', {
      pricePerEighth: updateData.pricePerEighth,
      pricePerQuarter: updateData.pricePerQuarter,
      pricePerHalf: updateData.pricePerHalf,
    });

    console.log('[updateProduct] Updating product', id, 'with fields:', Object.keys(updateData).join(', '));
    console.log('[updateProduct] Fractional pricing values:', {
      pricePerEighth: updateData.pricePerEighth,
      pricePerQuarter: updateData.pricePerQuarter,
      pricePerHalf: updateData.pricePerHalf,
    });

    // Track fractional pricing fields for backup direct SQL update
    const fractionalFieldsToUpdate: any = {};
    if (updateData.hasOwnProperty('pricePerEighth')) {
      fractionalFieldsToUpdate.pricePerEighth = updateData.pricePerEighth;
    }
    if (updateData.hasOwnProperty('pricePerQuarter')) {
      fractionalFieldsToUpdate.pricePerQuarter = updateData.pricePerQuarter;
    }
    if (updateData.hasOwnProperty('pricePerHalf')) {
      fractionalFieldsToUpdate.pricePerHalf = updateData.pricePerHalf;
    }

    // First, ensure fractional pricing + bogo columns exist
    try {
      const { sql } = await import("./db");
      await sql`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS price_per_eighth DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS price_per_quarter DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS price_per_half DECIMAL(10, 2);
      `;
    } catch (colError: any) {
      if (!colError?.message?.includes('already exists') && !colError?.message?.includes('duplicate')) {
        console.warn('[updateProduct] Could not ensure fractional pricing columns exist:', colError?.message);
      }
    }
    try {
      const { sql } = await import("./db");
      await sql`
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS bogo_enabled BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS bogo_free_option_index INTEGER;
      `;
    } catch (colError: any) {
      if (!colError?.message?.includes('already exists') && !colError?.message?.includes('duplicate')) {
        console.warn('[updateProduct] Could not ensure bogo columns exist:', colError?.message);
      }
    }

    let updateError: any = null;
    try {
      await retryQuery(() =>
        db.update(products)
          .set({
            ...updateData,
            updatedAt: new Date()
          })
          .where(eq(products.id, id))
      );
    } catch (err: any) {
      updateError = err;
      console.error('[updateProduct] Drizzle update failed, falling back to direct SQL:', err?.message);
    }

    if (updateError) {
      try {
        const { sql: rawSql } = await import("./db");

        const toSafeNum = (v: any): number | null => {
          if (v === null || v === undefined || v === '') return null;
          const n = typeof v === 'string' ? parseFloat(v) : v;
          return isNaN(n) ? null : n;
        };

        const d = updateData;

        await rawSql`UPDATE products SET name = ${d.name}, sku = ${d.sku}, selling_method = ${d.sellingMethod}, updated_at = NOW() WHERE id = ${id}`;
        await rawSql`UPDATE products SET company = ${d.company ?? null}, description = ${d.description ?? null}, image_url = ${d.imageUrl ?? null}, image_urls = ${d.imageUrls ?? null}, weight_unit = ${d.weightUnit ?? null}, purchase_price_method = ${d.purchasePriceMethod ?? null}, admin_notes = ${d.adminNotes ?? null}, is_active = ${d.isActive ?? true} WHERE id = ${id}`;
        await rawSql`UPDATE products SET stock = ${toSafeNum(d.stock) ?? 0}, physical_inventory = ${toSafeNum(d.physicalInventory) ?? 0}, min_stock_threshold = ${toSafeNum(d.minStockThreshold) ?? 0}, category_id = ${toSafeNum(d.categoryId)} WHERE id = ${id}`;

        const priceVal = toSafeNum(d.price);
        if (priceVal !== null) {
          await rawSql`UPDATE products SET price = ${priceVal} WHERE id = ${id}`;
        } else {
          await rawSql`UPDATE products SET price = NULL WHERE id = ${id}`;
        }

        const pgn = toSafeNum(d.pricePerGram);
        if (pgn !== null) { await rawSql`UPDATE products SET price_per_gram = ${pgn} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET price_per_gram = NULL WHERE id = ${id}`; }

        const pon = toSafeNum(d.pricePerOunce);
        if (pon !== null) { await rawSql`UPDATE products SET price_per_ounce = ${pon} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET price_per_ounce = NULL WHERE id = ${id}`; }

        const pe = toSafeNum(d.pricePerEighth);
        if (pe !== null) { await rawSql`UPDATE products SET price_per_eighth = ${pe} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET price_per_eighth = NULL WHERE id = ${id}`; }

        const pq = toSafeNum(d.pricePerQuarter);
        if (pq !== null) { await rawSql`UPDATE products SET price_per_quarter = ${pq} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET price_per_quarter = NULL WHERE id = ${id}`; }

        const ph = toSafeNum(d.pricePerHalf);
        if (ph !== null) { await rawSql`UPDATE products SET price_per_half = ${ph} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET price_per_half = NULL WHERE id = ${id}`; }

        const dp = toSafeNum(d.discountPercentage);
        if (dp !== null) { await rawSql`UPDATE products SET discount_percentage = ${dp} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET discount_percentage = NULL WHERE id = ${id}`; }

        const pp = toSafeNum(d.purchasePrice);
        if (pp !== null) { await rawSql`UPDATE products SET purchase_price = ${pp} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET purchase_price = NULL WHERE id = ${id}`; }

        const ppg = toSafeNum(d.purchasePricePerGram);
        if (ppg !== null) { await rawSql`UPDATE products SET purchase_price_per_gram = ${ppg} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET purchase_price_per_gram = NULL WHERE id = ${id}`; }

        const ppo = toSafeNum(d.purchasePricePerOunce);
        if (ppo !== null) { await rawSql`UPDATE products SET purchase_price_per_ounce = ${ppo} WHERE id = ${id}`; }
        else { await rawSql`UPDATE products SET purchase_price_per_ounce = NULL WHERE id = ${id}`; }

        // Save bogo fields
        if (d.hasOwnProperty('bogoEnabled')) {
          const bogoVal = d.bogoEnabled === true || d.bogoEnabled === 'true';
          await rawSql`UPDATE products SET bogo_enabled = ${bogoVal} WHERE id = ${id}`;
        }
        if (d.hasOwnProperty('bogoFreeOptionIndex')) {
          const bfi = d.bogoFreeOptionIndex == null ? null : parseInt(String(d.bogoFreeOptionIndex));
          await rawSql`UPDATE products SET bogo_free_option_index = ${bfi} WHERE id = ${id}`;
        }

        console.log('[updateProduct] Successfully updated all fields via direct SQL fallback');
        updateError = null;
      } catch (fallbackError: any) {
        console.error('[updateProduct] Direct SQL fallback also failed:', fallbackError?.message);
        throw fallbackError;
      }
    } else {
      // Drizzle update succeeded — still save bogo and fractional fields via direct SQL to guarantee they land
      try {
        const { sql: rawSql } = await import("./db");

        if (fractionalFieldsToUpdate.hasOwnProperty('pricePerEighth')) {
          const value = fractionalFieldsToUpdate.pricePerEighth === null || fractionalFieldsToUpdate.pricePerEighth === '' 
            ? null 
            : parseFloat(String(fractionalFieldsToUpdate.pricePerEighth));
          await rawSql`UPDATE products SET price_per_eighth = ${value} WHERE id = ${id}`;
        }
        if (fractionalFieldsToUpdate.hasOwnProperty('pricePerQuarter')) {
          const value = fractionalFieldsToUpdate.pricePerQuarter === null || fractionalFieldsToUpdate.pricePerQuarter === '' 
            ? null 
            : parseFloat(String(fractionalFieldsToUpdate.pricePerQuarter));
          await rawSql`UPDATE products SET price_per_quarter = ${value} WHERE id = ${id}`;
        }
        if (fractionalFieldsToUpdate.hasOwnProperty('pricePerHalf')) {
          const value = fractionalFieldsToUpdate.pricePerHalf === null || fractionalFieldsToUpdate.pricePerHalf === '' 
            ? null 
            : parseFloat(String(fractionalFieldsToUpdate.pricePerHalf));
          await rawSql`UPDATE products SET price_per_half = ${value} WHERE id = ${id}`;
        }

        // Always save bogo via direct SQL regardless of Drizzle success
        if (updateData.hasOwnProperty('bogoEnabled')) {
          const bogoVal = updateData.bogoEnabled === true || updateData.bogoEnabled === 'true';
          await rawSql`UPDATE products SET bogo_enabled = ${bogoVal} WHERE id = ${id}`;
        }
        if (updateData.hasOwnProperty('bogoFreeOptionIndex')) {
          const bfi = updateData.bogoFreeOptionIndex == null ? null : parseInt(String(updateData.bogoFreeOptionIndex));
          await rawSql`UPDATE products SET bogo_free_option_index = ${bfi} WHERE id = ${id}`;
        }

        console.log('[updateProduct] Successfully updated supplemental fields via direct SQL');
      } catch (fractionalError: any) {
        console.error('[updateProduct] Failed to update supplemental fields:', fractionalError?.message);
      }
    }

    if (updateError) {
      throw updateError;
    }

    // Fetch the updated product
    const [product] = await retryQuery(() =>
      db.select().from(products).where(eq(products.id, id))
    );

    if (!product) {
      throw new Error("Product not found");
    }

    // If Drizzle update failed but we updated fractional fields, we should still return success
    // Only throw if we couldn't update anything
    if (updateError && Object.keys(fractionalFieldsToUpdate).length === 0) {
      throw updateError;
    }

    console.log('[updateProduct] Product updated successfully, id:', product.id);

    if (sizes !== undefined) {
      try {
        await retryQuery(() =>
          db.delete(productSizes).where(eq(productSizes.productId, id))
        );
      } catch (e: any) {
        console.log('[updateProduct] Could not delete old product sizes:', e?.message);
      }

      if (sizes && sizes.length > 0) {
        const sizeRecords: InsertProductSize[] = sizes.map((size: any) => ({
          productId: id,
          size: size.size,
          quantity: size.quantity,
          physicalQuantity: size.quantity,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        try {
          await retryQuery(() =>
            db.insert(productSizes).values(sizeRecords)
          );
        } catch (sizeError: any) {
          console.log('[updateProduct] Error creating product sizes:', sizeError?.message);
        }
      }
    }

    // Save quantity pricing tiers (always replace on update)
    const quantityPricingData = (productData as any).quantityPricing;
    if (quantityPricingData !== undefined) {
      try {
        await db.delete(productQuantityPricing).where(eq(productQuantityPricing.productId, id));
        if (quantityPricingData.length > 0) {
          const tierRecords = quantityPricingData.map((tier: any) => ({
            productId: id,
            minQuantity: tier.minQuantity,
            pricePerItem: String(tier.pricePerItem),
          }));
          await db.insert(productQuantityPricing).values(tierRecords);
        }
      } catch (tierError: any) {
        console.warn('[updateProduct] Error saving quantity pricing tiers:', tierError?.message);
      }
    }

    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    const existsResult = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id));

    if (!existsResult || existsResult.length === 0) {
      throw new Error("Product not found");
    }

    try {
      const activeOrderCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orderItems.productId, id),
            or(eq(orders.status, 'pending'), eq(orders.status, 'processing'), eq(orders.status, 'packed'))
          )
        );

      if (activeOrderCount && activeOrderCount[0] && Number(activeOrderCount[0].count) > 0) {
        throw new Error("Cannot delete product. It is referenced in pending, packed, or processing orders.");
      }
    } catch (error: any) {
      if (error?.message?.includes('pending or processing')) {
        throw error;
      }
      console.warn('Error checking active orders, proceeding with deletion:', error);
    }

    try {
      await db
        .update(orderItems)
        .set({ productId: sql`NULL` })
        .where(eq(orderItems.productId, id));
    } catch (error) {
      console.warn('Could not nullify order item references, proceeding:', error);
    }

    try {
      await db.delete(inventoryLogs).where(eq(inventoryLogs.productId, id));
    } catch (error) {
      console.warn('Could not delete inventory logs, proceeding:', error);
    }

    try {
      await db.delete(productSizes).where(eq(productSizes.productId, id));
    } catch (error) {
      console.warn('Could not delete product sizes, proceeding:', error);
    }

    try {
      await db.delete(productQuantityPricing).where(eq(productQuantityPricing.productId, id));
    } catch (error) {
      console.warn('Could not delete product quantity pricing, proceeding:', error);
    }

    await db.delete(products).where(eq(products.id, id));
  }

  async adjustStock(productId: number, quantity: number, userId: string, reason: string, sizeName?: string): Promise<void> {
    if (!productId || typeof productId !== 'number') {
      throw new Error("Invalid product ID");
    }
    if (typeof quantity !== 'number') {
      throw new Error("Invalid quantity");
    }
    if (!reason || typeof reason !== 'string') {
      throw new Error("Reason is required");
    }

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw new Error("Product not found");
    }

    if (sizeName) {
      const sizeRows = await db.select().from(productSizes)
        .where(and(eq(productSizes.productId, productId), eq(productSizes.size, sizeName)));

      if (!sizeRows || sizeRows.length === 0) {
        throw new Error(`Size "${sizeName}" not found for this product`);
      }

      const sizeRow = sizeRows[0];
      const newSizeQty = sizeRow.quantity + quantity;
      if (newSizeQty < 0) {
        throw new Error("Insufficient stock for this size");
      }

      await db.update(productSizes)
        .set({ quantity: newSizeQty, physicalQuantity: newSizeQty, updatedAt: new Date() })
        .where(and(eq(productSizes.productId, productId), eq(productSizes.size, sizeName)));

      const newTotalStock = product.stock + quantity;
      await db.update(products)
        .set({ stock: newTotalStock, physicalInventory: newTotalStock, updatedAt: new Date() })
        .where(eq(products.id, productId));

      await db.insert(inventoryLogs).values({
        productId,
        type: quantity > 0 ? 'stock_in' : 'stock_out',
        quantity: Math.abs(quantity),
        previousStock: product.stock,
        newStock: newTotalStock,
        reason: `[${sizeName}] ${reason}`,
        userId
      });

      if (newTotalStock <= product.minStockThreshold && product.stock > product.minStockThreshold) {
        const adminUsers = await this.getUsersWithRole('admin');
        for (const admin of adminUsers) {
          await this.createNotification({
            userId: admin.id,
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `${product.name} is running low on stock (${newTotalStock} remaining)`,
            data: { productId, currentStock: newTotalStock, threshold: product.minStockThreshold },
          });
        }
      }
    } else {
      const newStock = product.stock + quantity;
      if (newStock < 0) {
        throw new Error("Insufficient stock");
      }

      await db.update(products)
        .set({
          stock: newStock,
          physicalInventory: newStock,
          updatedAt: new Date()
        })
        .where(eq(products.id, productId));

      await db.insert(inventoryLogs).values({
        productId,
        type: quantity > 0 ? 'stock_in' : 'stock_out',
        quantity: Math.abs(quantity),
        previousStock: product.stock,
        newStock,
        reason,
        userId
      });

      if (newStock <= product.minStockThreshold && product.stock > product.minStockThreshold) {
        const adminUsers = await this.getUsersWithRole('admin');
        for (const admin of adminUsers) {
          await this.createNotification({
            userId: admin.id,
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `${product.name} is running low on stock (${newStock} remaining)`,
            data: { productId, currentStock: newStock, threshold: product.minStockThreshold },
          });
        }
      }
    }
  }

  async getLowStockProducts(): Promise<Product[]> {
    const lowStockProducts = await db
      .select({
        id: products.id,
        name: products.name,
        company: products.company,
        description: products.description,
        price: products.price,
        sku: products.sku,
        categoryId: products.categoryId,
        imageUrl: products.imageUrl,
        imageUrls: products.imageUrls,
        stock: products.stock,
        physicalInventory: products.physicalInventory,
        minStockThreshold: products.minStockThreshold,
        sellingMethod: products.sellingMethod,
        weightUnit: products.weightUnit,
        pricePerGram: products.pricePerGram,
        pricePerOunce: products.pricePerOunce,
        discountPercentage: products.discountPercentage,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          sql`${products.stock} <= ${products.minStockThreshold}`
        )
      )
      .orderBy(products.stock);

    return lowStockProducts;
  }

  // Order operations
  async getOrders(filters: {
    status?: string;
    statuses?: string[];
    customerId?: string;
    assignedUserId?: string;
    hideOldDelivered?: boolean;
  } = {}): Promise<Order[]> {
    try {
      let query = db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          customerId: orders.customerId,
          customerName: orders.customerName,
          customerEmail: orders.customerEmail,
          customerPhone: orders.customerPhone,
          shippingAddress: orders.shippingAddress,
          total: orders.total,
          status: orders.status,
          paymentMethod: orders.paymentMethod,
          assignedUserId: orders.assignedUserId,
          notes: orders.notes,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
          assignedUser: users,
          customerTelegramUsername: sql<string | null>`(SELECT telegram_username FROM users WHERE id = ${orders.customerId})`,
        })
        .from(orders)
        .leftJoin(users, eq(orders.assignedUserId, users.id));

      const conditions = [];

      if (filters.status) {
        conditions.push(eq(orders.status, filters.status));
      }

      if (filters.statuses && filters.statuses.length > 0) {
        conditions.push(inArray(orders.status, filters.statuses));
      }

      if (filters.customerId) {
        conditions.push(eq(orders.customerId, filters.customerId));
      }

      if (filters.assignedUserId) {
        conditions.push(eq(orders.assignedUserId, filters.assignedUserId));
      }

      // Hide shipped orders older than 48 hours for customers
      if (filters.hideOldDelivered) {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        conditions.push(
          or(
            ne(orders.status, 'shipped'),
            and(
              eq(orders.status, 'shipped'),
              gte(orders.updatedAt, fortyEightHoursAgo)
            )
          )
        );
      }

      let finalQuery = query;
      if (conditions.length > 0) {
        finalQuery = finalQuery.where(and(...conditions));
      }

      const result = await retryQuery(() => finalQuery.orderBy(desc(orders.createdAt)));

      return result.map(row => ({
        ...row,
        assignedUser: row.assignedUser && row.assignedUser.id ? {
          id: row.assignedUser.id,
          firstName: row.assignedUser.firstName,
          lastName: row.assignedUser.lastName,
          email: row.assignedUser.email
        } : undefined
      }));
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  async getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product | null })[] }) | undefined> {
    const [order] = await retryQuery(() => db.select().from(orders).where(eq(orders.id, id)));
    if (!order) return undefined;

    const items = await retryQuery(() =>
      db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          productName: orderItems.productName,
          productSku: orderItems.productSku,
          productPrice: orderItems.productPrice,
          quantity: orderItems.quantity,
          subtotal: orderItems.subtotal,
          fulfilled: orderItems.fulfilled,
          product: products,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, id))
    );

    return { ...order, items };
  }

  async createOrder(orderData: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const datePrefix = `${month}${day}${year}`;

    let nextSequential = 1;
    try {
      const seqResult = await retryQuery(() =>
        db.execute(sql`
          INSERT INTO order_sequences (date_prefix, last_seq)
          VALUES (${datePrefix}, 1)
          ON CONFLICT (date_prefix)
          DO UPDATE SET last_seq = order_sequences.last_seq + 1
          RETURNING last_seq
        `)
      );
      nextSequential = seqResult?.rows?.[0]?.last_seq ?? 1;
    } catch (e) {
      console.warn('[createOrder] Could not get atomic order sequence, using timestamp fallback');
      nextSequential = Math.floor(Date.now() % 100000);
    }

    const orderNumber = `${datePrefix}-${nextSequential}`;

    for (const item of items) {
      try {
        const stockResult = await retryQuery(() =>
          db.execute(sql`SELECT stock, name FROM products WHERE id = ${item.productId}`)
        );
        const product = stockResult?.rows?.[0];
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }
        if (Number(product.stock) < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }
      } catch (stockErr: any) {
        if (stockErr?.message?.includes('Insufficient stock') || stockErr?.message?.includes('not found')) {
          throw stockErr;
        }
        console.warn('[createOrder] Stock check warning:', stockErr);
      }
    }

    let order: any;
    try {
      const insertResult = await db.insert(orders).values({
        ...orderData,
        orderNumber,
      }).returning();
      order = insertResult?.[0];
    } catch (insertErr: any) {
      const isParseError = insertErr?.cause?.message?.includes("Cannot read properties of null");
      if (!isParseError) {
        throw insertErr;
      }
      console.warn('[createOrder] Insert returning() parse failed, looking up by order number');
    }

    if (!order) {
      try {
        const found = await retryQuery(() =>
          db.execute(sql`SELECT * FROM orders WHERE order_number = ${orderNumber}`)
        );
        const row = found?.rows?.[0];
        if (row) {
          order = {
            id: row.id,
            orderNumber: row.order_number,
            customerId: row.customer_id,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            shippingAddress: row.shipping_address,
            total: row.total,
            status: row.status,
            paymentMethod: row.payment_method,
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }
      } catch (lookupErr) {
        console.error('[createOrder] Could not look up order:', lookupErr);
        throw lookupErr;
      }
    }

    if (!order) {
      throw new Error("Order was created but could not be retrieved");
    }

    const orderItemsData = items.map(item => ({
      ...item,
      orderId: order.id,
    }));

    try {
      await retryQuery(() => db.insert(orderItems).values(orderItemsData));
    } catch (itemsErr) {
      console.warn('[createOrder] Order items insert via ORM failed, using raw SQL:', itemsErr);
      for (const item of orderItemsData) {
        await db.execute(sql`INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal, size) VALUES (${item.orderId}, ${item.productId}, ${item.productName}, ${item.productPrice}, ${item.quantity}, ${item.subtotal}, ${item.size || null})`);
      }
    }

    for (const item of items) {
      try {
        if (!item.productId) {
          console.warn('[createOrder] Skipping stock update for item without productId');
          continue;
        }

        // Parse size label from the item or product name
        // This supports both unit-based "Size: Large" and weight-based options like "1 oz"
        const sizeLabel =
          (item as any).size ||
          this.extractWeightOptionFromProductName(item.productName) ||
          this.extractSizeFromProductName(item.productName);

        // Default stock deduction is the item quantity (non-weight items or unknown labels)
        let stockToDeduct = item.quantity;

        if (sizeLabel) {
          // Convert known weight options to their gram equivalent for stock deduction
          const gramEquivalent = this.getGramEquivalentFromSize(sizeLabel);
          // Stock is tracked in grams for weight-based items, so multiply the quantity by the gram equivalent
          stockToDeduct = item.quantity * gramEquivalent;
        }

        await db.execute(
          sql`UPDATE products SET stock = stock - ${stockToDeduct}, updated_at = NOW() WHERE id = ${item.productId}`
        );

        const sizeName = this.extractSizeFromProductName(item.productName);
        if (sizeName) {
          await db.execute(
            sql`UPDATE product_sizes SET quantity = quantity - ${item.quantity}, updated_at = NOW() WHERE product_id = ${item.productId} AND size = ${sizeName}`
          );
        }
      } catch (stockErr) {
        console.warn('[createOrder] Stock update error:', stockErr);
      }
    }

    try {
      const fullOrder = await this.getOrder(order.id);
      return fullOrder!;
    } catch (e) {
      return order;
    }
  }

  async updateOrderStatus(orderId: number, status: string): Promise<Order> {
    try {
      const [updatedOrder] = await retryQuery(() =>
        db
          .update(orders)
          .set({
            status,
            updatedAt: new Date()
          })
          .where(eq(orders.id, orderId))
          .returning()
      );

      if (updatedOrder) {
        return updatedOrder;
      }

      console.warn('[updateOrderStatus] Update returned empty, falling back to direct fetch');
    } catch (error: any) {
      console.warn('[updateOrderStatus] Retry failed, fetching order directly:', error?.message);
    }

    {
      const [order] = await retryQuery(() => db.select().from(orders).where(eq(orders.id, orderId)));
      if (!order) {
        throw new Error("Order not found");
      }
      if (order.status !== status) {
        await retryQuery(() =>
          db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId))
        );
        const [refreshed] = await retryQuery(() => db.select().from(orders).where(eq(orders.id, orderId)));
        return refreshed || order;
      }
      return order;
    }
  }

  async updateOrderTotal(orderId: number, total: number): Promise<Order> {
    const [updatedOrder] = await retryQuery(() =>
      db
        .update(orders)
        .set({ total: total.toString(), updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .returning()
    );
    if (!updatedOrder) {
      throw new Error("Order not found");
    }
    return updatedOrder;
  }

  async fulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string, orderItemId?: number): Promise<void> {
    // Get the product
    const productRows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (productRows.length === 0) {
      throw new Error("Product not found");
    }
    const product = productRows[0];

    // Get the specific order item — prefer matching by item ID when provided to
    // correctly handle multiple variants of the same product in one order
    const itemFilter = orderItemId
      ? and(eq(orderItems.orderId, orderId), eq(orderItems.id, orderItemId))
      : and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId));

    const [orderItem] = await db
      .select()
      .from(orderItems)
      .where(itemFilter)
      .limit(1);

    if (!orderItem) {
      throw new Error("Order item not found");
    }

    const sizeLabel =
      (orderItem as any).size ||
      this.extractWeightOptionFromProductName(orderItem.productName) ||
      this.extractSizeFromProductName(orderItem.productName);

    // Default to raw quantity; for weight options convert to grams
    let physicalDelta = quantity;
    if (sizeLabel) {
      const gramEquivalent = this.getGramEquivalentFromSize(sizeLabel);
      physicalDelta = quantity * gramEquivalent;
    }

    const currentPhysicalInventory = product.physicalInventory || 0;
    const newPhysicalInventory = currentPhysicalInventory - physicalDelta;

    if (newPhysicalInventory < 0) {
      throw new Error("Insufficient physical inventory");
    }

    // Round to integer before writing to integer DB columns
    const newPhysicalInventoryInt = Math.round(newPhysicalInventory);
    const physicalDeltaInt = Math.round(physicalDelta);

    // Update only physical inventory (stock is reduced when order is placed, not when fulfilled)
    await db
      .update(products)
      .set({
        physicalInventory: newPhysicalInventoryInt,
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    // Mark the specific order item as fulfilled
    const fulfillFilter = orderItemId
      ? and(eq(orderItems.orderId, orderId), eq(orderItems.id, orderItemId))
      : and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId));

    await db
      .update(orderItems)
      .set({ fulfilled: true })
      .where(fulfillFilter);

    // Update per-size physical quantity if applicable
    const sizeName = this.extractSizeFromProductName(orderItem.productName);
    if (sizeName) {
      await db.execute(
        sql`UPDATE product_sizes SET physical_quantity = physical_quantity - ${physicalDeltaInt}, updated_at = NOW() WHERE product_id = ${productId} AND size = ${sizeName}`
      );
    }

    // Log the physical inventory change
    await db.insert(inventoryLogs).values({
      productId,
      userId,
      type: 'physical_out',
      quantity: -physicalDeltaInt,
      previousStock: Math.round(currentPhysicalInventory),
      newStock: newPhysicalInventoryInt,
      reason: `Order fulfillment - Order #${orderId} (Physical inventory reduced)`,
      createdAt: new Date()
    });
  }

  async unfulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string, orderItemId?: number): Promise<void> {
    // Get the product
    const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (product.length === 0) {
      throw new Error("Product not found");
    }

    // Get the specific order item — prefer matching by item ID when provided
    const unfulfillItemFilter = orderItemId
      ? and(eq(orderItems.orderId, orderId), eq(orderItems.id, orderItemId))
      : and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId));

    const orderItem = await db
      .select()
      .from(orderItems)
      .where(unfulfillItemFilter)
      .limit(1);

    if (orderItem.length === 0) {
      throw new Error("Order item not found");
    }

    if (!orderItem[0].fulfilled) {
      throw new Error("Order item is not fulfilled");
    }

    const sizeLabel =
      (orderItem[0] as any).size ||
      this.extractWeightOptionFromProductName(orderItem[0].productName) ||
      this.extractSizeFromProductName(orderItem[0].productName);

    let physicalDelta = quantity;
    if (sizeLabel) {
      const gramEquivalent = this.getGramEquivalentFromSize(sizeLabel);
      physicalDelta = quantity * gramEquivalent;
    }

    const currentPhysicalInventory = product[0].physicalInventory || 0;
    const newPhysicalInventory = currentPhysicalInventory + physicalDelta;

    // Round to integer before writing to integer DB columns
    const newPhysicalInventoryInt = Math.round(newPhysicalInventory);
    const physicalDeltaInt = Math.round(physicalDelta);

    // Update only physical inventory (add back)
    await db
      .update(products)
      .set({
        physicalInventory: newPhysicalInventoryInt,
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    // Use the already-fetched orderItem[0] for size info
    const unfulfillItem = orderItem[0];

    // Mark the specific order item as not fulfilled
    await db
      .update(orderItems)
      .set({ fulfilled: false })
      .where(unfulfillItemFilter);

    if (unfulfillItem) {
      const sizeName = this.extractSizeFromProductName(unfulfillItem.productName);
      if (sizeName) {
        await db.execute(
          sql`UPDATE product_sizes SET physical_quantity = physical_quantity + ${physicalDeltaInt}, updated_at = NOW() WHERE product_id = ${productId} AND size = ${sizeName}`
        );
      }
    }

    // Log the physical inventory change
    await db.insert(inventoryLogs).values({
      productId,
      userId,
      type: 'physical_in',
      quantity: physicalDeltaInt,
      previousStock: Math.round(currentPhysicalInventory),
      newStock: newPhysicalInventoryInt,
      reason: `Order unfulfillment - Order #${orderId} (Physical inventory restored)`,
      createdAt: new Date()
    });
  }

  async substituteOrderItem(orderId: number, oldItemId: number, newProductId: number, quantity: number, userId: string): Promise<void> {
    // Fetch the old item
    const [oldItem] = await db.select().from(orderItems).where(and(eq(orderItems.id, oldItemId), eq(orderItems.orderId, orderId))).limit(1);
    if (!oldItem) throw new Error("Order item not found");

    // Fetch the replacement product
    const [newProduct] = await db.select().from(products).where(eq(products.id, newProductId)).limit(1);
    if (!newProduct) throw new Error("Replacement product not found");

    const unitPrice = newProduct.price ? parseFloat(newProduct.price) : 0;
    const newSubtotal = unitPrice * quantity;

    // Mark old item as removed
    await db.update(orderItems).set({ removed: true }).where(eq(orderItems.id, oldItemId));

    // Insert the new replacement item
    const [newItem] = await db.insert(orderItems).values({
      orderId,
      productId: newProductId,
      productName: newProduct.name,
      productSku: newProduct.sku,
      productPrice: String(unitPrice),
      quantity,
      subtotal: String(newSubtotal),
      fulfilled: false,
      removed: false,
      substitutedForItemId: oldItemId,
    }).returning();

    // Recalculate order total: sum all non-removed items
    const activeItems = await db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.removed, false)));
    const newTotal = activeItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    await db.update(orders).set({ total: String(newTotal), updatedAt: new Date() }).where(eq(orders.id, orderId));

    // Restore stock for old product (since it was reserved when order was placed)
    await db.update(products).set({ stock: sql`${products.stock} + ${oldItem.quantity}`, updatedAt: new Date() }).where(eq(products.id, oldItem.productId!));
    // Deduct stock for new product
    await db.update(products).set({ stock: sql`${products.stock} - ${quantity}`, updatedAt: new Date() }).where(eq(products.id, newProductId));

    // Inventory log for old product restore
    const [oldProduct] = await db.select().from(products).where(eq(products.id, oldItem.productId!)).limit(1);
    if (oldProduct) {
      await db.insert(inventoryLogs).values({
        productId: oldItem.productId!,
        userId,
        type: 'stock_in',
        quantity: oldItem.quantity,
        previousStock: oldProduct.stock - oldItem.quantity,
        newStock: oldProduct.stock,
        reason: `Item substituted out of Order #${orderId} - stock restored`,
        createdAt: new Date()
      });
    }
    // Inventory log for new product deduction
    const [newProductUpdated] = await db.select().from(products).where(eq(products.id, newProductId)).limit(1);
    if (newProductUpdated) {
      await db.insert(inventoryLogs).values({
        productId: newProductId,
        userId,
        type: 'stock_out',
        quantity,
        previousStock: newProductUpdated.stock + quantity,
        newStock: newProductUpdated.stock,
        reason: `Item substituted into Order #${orderId}`,
        createdAt: new Date()
      });
    }
  }

  async removeOrderItem(orderId: number, itemId: number, userId: string): Promise<void> {
    const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).limit(1);
    if (!item) throw new Error("Order item not found");

    // Hard-delete the item from the order
    await db.delete(orderItems).where(eq(orderItems.id, itemId));

    // Restore stock only if it wasn't already removed (soft-removed items already had stock restored)
    if (!item.removed && item.productId) {
      await db.update(products).set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: new Date() }).where(eq(products.id, item.productId));

      // Log inventory restore
      const [updatedProduct] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (updatedProduct) {
        await db.insert(inventoryLogs).values({
          productId: item.productId,
          userId,
          type: 'stock_in',
          quantity: item.quantity,
          previousStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock,
          reason: `Item removed from Order #${orderId} - stock restored`,
          createdAt: new Date()
        });
      }
    }

    // Recalculate order total from remaining items
    const remainingItems = await db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.removed, false)));
    const newTotal = remainingItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
    await db.update(orders).set({ total: String(newTotal), updatedAt: new Date() }).where(eq(orders.id, orderId));
  }

  async updateOrderItemPrice(orderId: number, itemId: number, newPrice: number): Promise<Order> {
    const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).limit(1);
    if (!item) throw new Error("Order item not found");

    const newSubtotal = newPrice * item.quantity;
    await db.update(orderItems).set({ productPrice: String(newPrice), subtotal: String(newSubtotal) }).where(eq(orderItems.id, itemId));

    const allItems = await db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.removed, false)));
    const newTotal = allItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
    const [updatedOrder] = await db.update(orders).set({ total: String(newTotal), updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    if (!updatedOrder) throw new Error("Order not found");
    return updatedOrder;
  }

  async addOrderItem(orderId: number, productId: number, quantity: number, userId: string, unitPrice?: number, unitLabel?: string): Promise<void> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new Error("Order not found");

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw new Error("Product not found");
    if (product.stock < quantity) throw new Error(`Insufficient stock. Available: ${product.stock}`);

    // Use provided unitPrice, or fall back to product's unit price
    const resolvedUnitPrice = unitPrice != null ? unitPrice : (product.price ? parseFloat(product.price) : 0);
    const subtotal = resolvedUnitPrice * quantity;

    // Append unit label to product name if provided (e.g. "Blue Dream - 1/8 oz")
    const itemName = unitLabel ? `${product.name} - ${unitLabel}` : product.name;

    // Insert new order item
    await db.insert(orderItems).values({
      orderId,
      productId,
      productName: itemName,
      productSku: product.sku,
      productPrice: String(resolvedUnitPrice),
      quantity,
      subtotal: String(subtotal),
      fulfilled: false,
      removed: false,
    });

    // Deduct stock
    await db.update(products).set({ stock: sql`${products.stock} - ${quantity}`, updatedAt: new Date() }).where(eq(products.id, productId));

    // Recalculate order total
    const activeItems = await db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.removed, false)));
    const newTotal = activeItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
    await db.update(orders).set({ total: String(newTotal), updatedAt: new Date() }).where(eq(orders.id, orderId));

    // Log inventory change
    const [updatedProduct] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (updatedProduct) {
      await db.insert(inventoryLogs).values({
        productId,
        userId,
        type: 'stock_out',
        quantity,
        previousStock: updatedProduct.stock + quantity,
        newStock: updatedProduct.stock,
        reason: `Item added to Order #${orderId}`,
        createdAt: new Date()
      });
    }
  }

  async markOrderItemAsPacked(orderId: number, productId: number, userId: string, orderItemId?: number): Promise<{ success: boolean; allPacked: boolean }> {
    // Get the product and order item
    const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (product.length === 0) {
      throw new Error("Product not found");
    }

    // Prefer matching by item ID when provided to handle variant products sharing the same productId
    const packItemFilter = orderItemId
      ? and(eq(orderItems.orderId, orderId), eq(orderItems.id, orderItemId))
      : and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId));

    const orderItem = await db
      .select()
      .from(orderItems)
      .where(packItemFilter)
      .limit(1);

    if (orderItem.length === 0) {
      throw new Error("Order item not found");
    }

    if (orderItem[0].fulfilled) {
      throw new Error("Order item already packed");
    }

    const packedQuantity = orderItem[0].quantity;

    const sizeLabel =
      (orderItem[0] as any).size ||
      this.extractWeightOptionFromProductName(orderItem[0].productName) ||
      this.extractSizeFromProductName(orderItem[0].productName);

    let physicalDelta = packedQuantity;
    if (sizeLabel) {
      const gramEquivalent = this.getGramEquivalentFromSize(sizeLabel);
      physicalDelta = packedQuantity * gramEquivalent;
    }

    const currentPhysicalInventory = product[0].physicalInventory || 0;
    const newPhysicalInventory = currentPhysicalInventory - physicalDelta;

    // Check if there's enough physical inventory
    if (newPhysicalInventory < 0) {
      throw new Error(
        `Insufficient physical inventory. Available: ${currentPhysicalInventory}, Required: ${physicalDelta}`
      );
    }

    // Mark the order item as packed (fulfilled = true) and update physical inventory
    await db.transaction(async (tx) => {
      // Mark the specific order item as packed
      await tx
        .update(orderItems)
        .set({ fulfilled: true })
        .where(packItemFilter);

      // Update physical inventory (reduce by packed quantity)
      await tx
        .update(products)
        .set({
          physicalInventory: newPhysicalInventory,
          updatedAt: new Date()
        })
        .where(eq(products.id, productId));

      // Log the packing activity with physical inventory change
      await tx.insert(inventoryLogs).values({
        productId,
        userId,
        type: 'packing',
        quantity: -physicalDelta, // Negative because we're reducing physical inventory
        previousStock: currentPhysicalInventory,
        newStock: newPhysicalInventory,
        reason: `Order item packed - Order #${orderId} (Physical inventory reduced)`,
        createdAt: new Date()
      });
    });

    // Check if all items in the order are packed
    const orderItemsResult = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const allPacked = orderItemsResult.every(item => item.fulfilled);

    // If all items are packed, update order status to processing
    if (allPacked) {
      await db
        .update(orders)
        .set({
          status: 'processing',
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId));
    }

    return { success: true, allPacked };
  }

  async assignOrderToUser(orderId: number, assignedUserId: string): Promise<Order> {
    const [updatedOrder] = await retryQuery(() =>
      db
        .update(orders)
        .set({
          assignedUserId,
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))
        .returning()
    );

    if (!updatedOrder) {
      throw new Error("Order not found");
    }

    return updatedOrder;
  }

  async deleteOrder(id: number): Promise<void> {
    const existing = await retryQuery(() => db.select({ id: orders.id }).from(orders).where(eq(orders.id, id)));
    if (existing.length === 0) {
      throw new Error("Order not found");
    }
    try {
      await retryQuery(() => db.delete(orderItems).where(eq(orderItems.orderId, id)));
    } catch (e) {
      console.warn('[deleteOrder] Failed to delete order items:', e);
    }
    try {
      await retryQuery(() => db.delete(orders).where(eq(orders.id, id)));
    } catch (e) {
      console.warn('[deleteOrder] Failed to delete order:', e);
    }
    try { invalidateCache.analytics(); } catch (e) { console.warn('Cache invalidation error:', e); }
  }

  async clearAllOrders(statuses?: string[]): Promise<number> {
    if (statuses && statuses.length > 0) {
      const matchingOrders = await retryQuery(() => db.select({ id: orders.id }).from(orders).where(inArray(orders.status, statuses)));
      if (matchingOrders.length === 0) return 0;
      const orderIds = matchingOrders.map(o => o.id);
      await retryQuery(() => db.delete(orderItems).where(inArray(orderItems.orderId, orderIds)));
      const deleted = await retryQuery(() => db.delete(orders).where(inArray(orders.id, orderIds)).returning());
      try { invalidateCache.analytics(); } catch (e) { console.warn('Cache invalidation error:', e); }
      return deleted.length;
    }
    await retryQuery(() => db.delete(orderItems));
    const deleted = await retryQuery(() => db.delete(orders).returning());
    try { invalidateCache.analytics(); } catch (e) { console.warn('Cache invalidation error:', e); }
    return deleted.length;
  }

  // Analytics operations
  async getSalesMetrics(days: number): Promise<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
  }> {
    return withCache(analyticsCache, generateCacheKey.salesMetrics(days), async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [metrics] = await db
        .select({
          totalSales: sql<number>`COALESCE(SUM(CAST(${orders.total} AS NUMERIC)), 0)`,
          totalOrders: sql<number>`COUNT(*)`,
          averageOrderValue: sql<number>`COALESCE(AVG(CAST(${orders.total} AS NUMERIC)), 0)`,
        })
        .from(orders)
        .where(
          and(
            sql`${orders.createdAt} >= ${startDate}`,
            inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'delivered', 'completed'])
          )
        );

      return {
        totalSales: Number(metrics.totalSales),
        totalOrders: Number(metrics.totalOrders),
        averageOrderValue: Number(metrics.averageOrderValue),
      };
    });
  }

  async getTopProducts(limit: number): Promise<{ product: Product; sales: number; revenue: number }[]> {
    return withCache(analyticsCache, generateCacheKey.topProducts(limit), async () => {
      const results = await db
        .select({
          product: products,
          sales: sql<number>`SUM(${orderItems.quantity})`,
          revenue: sql<number>`SUM(CAST(${orderItems.subtotal} AS NUMERIC))`,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
        .groupBy(products.id)
        .orderBy(desc(sql`SUM(CAST(${orderItems.subtotal} AS NUMERIC))`))
        .limit(limit);

      return results.map(r => ({
        product: r.product,
        sales: Number(r.sales),
        revenue: Number(r.revenue),
      }));
    });
  }

  async getOrderStatusBreakdown(): Promise<{ status: string; count: number }[]> {
    return withCache(analyticsCache, generateCacheKey.orderStatusBreakdown(), async () => {
      const results = await retryQuery(() =>
        db
          .select({
            status: orders.status,
            count: sql<number>`COUNT(*)`,
          })
          .from(orders)
          .groupBy(orders.status)
      );

      return results.map(r => ({
        status: r.status,
        count: Number(r.count),
      }));
    });
  }

  async getSalesTrend(days: number): Promise<{ date: string; sales: number; orders: number; customers: number }[]> {
    return withCache(analyticsCache, generateCacheKey.salesTrend(days), async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = await db
        .select({
          date: sql<string>`DATE_TRUNC('day', ${orders.createdAt})`,
          sales: sql<number>`SUM(CAST(${orders.total} AS NUMERIC))`,
          orders: sql<number>`COUNT(*)`,
          customers: sql<number>`COUNT(DISTINCT ${orders.customerId})`,
        })
        .from(orders)
        .where(
          and(
            sql`${orders.createdAt} >= ${startDate}`,
            inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'delivered', 'completed'])
          )
        )
        .groupBy(sql`DATE_TRUNC('day', ${orders.createdAt})`)
        .orderBy(asc(sql`DATE_TRUNC('day', ${orders.createdAt})`));

      return results.map(r => ({
        date: typeof r.date === 'string' ? r.date.split('T')[0].split(' ')[0] : new Date(r.date as any).toISOString().split('T')[0],
        sales: Number(r.sales),
        orders: Number(r.orders),
        customers: Number(r.customers),
      }));
    });
  }

  async getCategoryBreakdown(): Promise<{ name: string; value: number; revenue: number; fill: string }[]> {
    return withCache(analyticsCache, generateCacheKey.categoryBreakdown(), async () => {
      const results = await db
        .select({
          categoryName: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
          value: sql<number>`COUNT(${orderItems.id})`,
          revenue: sql<number>`COALESCE(SUM(CAST(${orderItems.subtotal} AS NUMERIC)), 0)`,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
        .groupBy(sql`COALESCE(${categories.name}, 'Uncategorized')`);

      const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

      return results.map((r, index) => ({
        name: r.categoryName || 'Uncategorized',
        value: Number(r.value) || 0,
        revenue: Number(r.revenue) || 0,
        fill: colors[index % colors.length],
      }));
    });
  }

  async getAdvancedMetrics(days: number): Promise<{
    netProfit: number;
    salesGrowthRate: number;
    returnRate: number;
    abandonedCartRate: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prevStartDate = new Date();
    prevStartDate.setDate(prevStartDate.getDate() - (days * 2));
    const prevEndDate = new Date();
    prevEndDate.setDate(prevEndDate.getDate() - days);

    // Current period sales
    const currentSalesResult = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${orders.total} AS NUMERIC)), 0)`,
        totalOrders: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
      );

    // Previous period sales for growth calculation
    const prevSalesResult = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${orders.total} AS NUMERIC)), 0)`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${prevStartDate}`,
          sql`${orders.createdAt} < ${prevEndDate}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
      );

    // Return rate (cancelled orders / total orders)
    const returnResult = await db
      .select({
        cancelledOrders: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          eq(orders.status, 'cancelled')
        )
      );

    const currentSales = Number(currentSalesResult[0]?.totalSales || 0);
    const currentOrders = Number(currentSalesResult[0]?.totalOrders || 0);
    const prevSales = Number(prevSalesResult[0]?.totalSales || 0);
    const cancelledOrders = Number(returnResult[0]?.cancelledOrders || 0);

    // Calculate net profit using actual purchase prices from order items
    const profitResult = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${orderItems.subtotal} AS NUMERIC)), 0)`,
        totalCost: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${products.purchasePriceMethod} = 'units' AND ${products.purchasePrice} IS NOT NULL
              THEN CAST(${products.purchasePrice} AS NUMERIC) * ${orderItems.quantity}
            WHEN ${products.purchasePriceMethod} = 'weight' AND ${products.purchasePricePerGram} IS NOT NULL AND ${products.pricePerGram} IS NOT NULL
              THEN CAST(${products.purchasePricePerGram} AS NUMERIC) * (CAST(${orderItems.subtotal} AS NUMERIC) / NULLIF(CAST(${products.pricePerGram} AS NUMERIC), 0))
            WHEN ${products.purchasePriceMethod} = 'weight' AND ${products.purchasePricePerOunce} IS NOT NULL AND ${products.pricePerOunce} IS NOT NULL
              THEN CAST(${products.purchasePricePerOunce} AS NUMERIC) * (CAST(${orderItems.subtotal} AS NUMERIC) / NULLIF(CAST(${products.pricePerOunce} AS NUMERIC), 0))
            WHEN ${products.purchasePrice} IS NOT NULL
              THEN CAST(${products.purchasePrice} AS NUMERIC) * ${orderItems.quantity}
            WHEN ${products.purchasePricePerGram} IS NOT NULL AND ${products.pricePerGram} IS NOT NULL
              THEN CAST(${products.purchasePricePerGram} AS NUMERIC) * (CAST(${orderItems.subtotal} AS NUMERIC) / NULLIF(CAST(${products.pricePerGram} AS NUMERIC), 0))
            WHEN ${products.purchasePricePerOunce} IS NOT NULL AND ${products.pricePerOunce} IS NOT NULL
              THEN CAST(${products.purchasePricePerOunce} AS NUMERIC) * (CAST(${orderItems.subtotal} AS NUMERIC) / NULLIF(CAST(${products.pricePerOunce} AS NUMERIC), 0))
            ELSE CAST(${orderItems.subtotal} AS NUMERIC) * 0.7
          END
        ), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
      );

    const totalRevenue = Number(profitResult[0]?.totalRevenue || 0);
    const totalCost = Number(profitResult[0]?.totalCost || 0);
    const netProfit = totalRevenue - totalCost;

    const salesGrowthRate = prevSales > 0 ? ((currentSales - prevSales) / prevSales) * 100 : 0;
    const totalAllOrders = currentOrders + cancelledOrders;
    const returnRate = totalAllOrders > 0 ? (cancelledOrders / totalAllOrders) * 100 : 0;

    return {
      netProfit,
      salesGrowthRate,
      returnRate,
      abandonedCartRate: 0,
    };
  }

  async getPeakPurchaseTimes(days: number = 30): Promise<{ time: string; orders: number; percentage: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get hourly order counts
    const results = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})`,
        orderCount: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          or(
            eq(orders.status, 'shipped'),
            eq(orders.status, 'processing'),
            eq(orders.status, 'pending'),
            eq(orders.status, 'delivered'),
            eq(orders.status, 'completed')
          )
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
      .orderBy(desc(sql`COUNT(*)`));

    // Calculate total orders for percentage calculation
    const totalOrders = results.reduce((sum, result) => sum + Number(result.orderCount), 0);

    if (totalOrders === 0) {
      return [];
    }

    // Group hours into time ranges and format results
    const timeRanges: { [key: string]: { orders: number; startHour: number; endHour: number } } = {};

    results.forEach(result => {
      const hour = Number(result.hour);
      const orderCount = Number(result.orderCount);

      // Group into 2-hour time slots
      let timeRange: string;
      let startHour: number;
      let endHour: number;

      if (hour >= 10 && hour < 12) {
        timeRange = "10:00 AM - 12:00 PM";
        startHour = 10;
        endHour = 12;
      } else if (hour >= 12 && hour < 14) {
        timeRange = "12:00 PM - 2:00 PM";
        startHour = 12;
        endHour = 14;
      } else if (hour >= 18 && hour < 20) {
        timeRange = "6:00 PM - 8:00 PM";
        startHour = 18;
        endHour = 20;
      } else if (hour >= 20 && hour < 22) {
        timeRange = "8:00 PM - 10:00 PM";
        startHour = 20;
        endHour = 22;
      } else if (hour >= 22 || hour < 2) {
        timeRange = "10:00 PM - 12:00 AM";
        startHour = 22;
        endHour = 24;
      } else if (hour >= 8 && hour < 10) {
        timeRange = "8:00 AM - 10:00 AM";
        startHour = 8;
        endHour = 10;
      } else if (hour >= 14 && hour < 16) {
        timeRange = "2:00 PM - 4:00 PM";
        startHour = 14;
        endHour = 16;
      } else if (hour >= 16 && hour < 18) {
        timeRange = "4:00 PM - 6:00 PM";
        startHour = 16;
        endHour = 18;
      } else {
        // Other hours grouped as "Other times"
        timeRange = "Other times";
        startHour = hour;
        endHour = hour + 1;
      }

      if (!timeRanges[timeRange]) {
        timeRanges[timeRange] = { orders: 0, startHour, endHour };
      }
      timeRanges[timeRange].orders += orderCount;
    });

    // Convert to array and calculate percentages
    const peakTimes = Object.entries(timeRanges)
      .map(([time, data]) => ({
        time,
        orders: data.orders,
        percentage: Math.round((data.orders / totalOrders) * 100),
      }))
      .sort((a, b) => b.orders - a.orders) // Sort by order count descending
      .slice(0, 6); // Take top 6 time ranges

    return peakTimes;
  }

  async getInventoryMetrics(): Promise<{
    stockTurnoverRate: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }> {
    const [inventoryStats] = await db
      .select({
        totalProducts: sql<number>`COUNT(*)`,
        totalInventoryValue: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${products.purchasePrice} IS NOT NULL THEN CAST(${products.purchasePrice} AS NUMERIC) * ${products.stock}
            WHEN ${products.price} IS NOT NULL THEN CAST(${products.price} AS NUMERIC) * ${products.stock}
            ELSE 0
          END
        ), 0)`,
        lowStockCount: sql<number>`COUNT(CASE WHEN ${products.stock} <= ${products.minStockThreshold} AND ${products.stock} > 0 THEN 1 END)`,
        outOfStockCount: sql<number>`COUNT(CASE WHEN ${products.stock} = 0 THEN 1 END)`,
        totalStockUnits: sql<number>`COALESCE(SUM(${products.stock}), 0)`,
      })
      .from(products)
      .where(eq(products.isActive, true));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [soldUnits] = await db
      .select({
        totalSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          sql`${orders.createdAt} >= ${thirtyDaysAgo}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
      );

    const totalStock = Number(inventoryStats.totalStockUnits) || 1;
    const totalSold = Number(soldUnits.totalSold) || 0;
    const stockTurnoverRate = Math.round((totalSold / totalStock) * 10) / 10;

    return {
      stockTurnoverRate,
      inventoryValue: Number(inventoryStats.totalInventoryValue),
      lowStockCount: Number(inventoryStats.lowStockCount),
      outOfStockCount: Number(inventoryStats.outOfStockCount),
    };
  }

  async getCustomerMetrics(days: number): Promise<{
    retentionRate: number;
    avgPurchaseFrequency: number;
    customerLifetimeValue: number;
    customerGrowth: { month: string; new: number; returning: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [customerStats] = await db
      .select({
        totalCustomers: sql<number>`COUNT(DISTINCT ${orders.customerId})`,
        totalOrders: sql<number>`COUNT(*)`,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.total} AS NUMERIC)), 0)`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
      );

    const totalCustomers = Number(customerStats.totalCustomers) || 1;
    const totalOrders = Number(customerStats.totalOrders) || 0;
    const totalRevenue = Number(customerStats.totalRevenue) || 0;

    const avgPurchaseFrequency = Math.round((totalOrders / totalCustomers) * 10) / 10;
    const customerLifetimeValue = Math.round((totalRevenue / totalCustomers) * 100) / 100;

    const repeatCustomerResult = await db
      .select({
        repeatCount: sql<number>`COUNT(*)`,
      })
      .from(
        db
          .select({
            customerId: orders.customerId,
            orderCount: sql<number>`COUNT(*)`,
          })
          .from(orders)
          .where(
            and(
              sql`${orders.createdAt} >= ${startDate}`,
              inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'delivered', 'completed'])
            )
          )
          .groupBy(orders.customerId)
          .having(sql`COUNT(*) > 1`)
          .as('repeat_customers')
      );

    const repeatCustomers = Number(repeatCustomerResult[0]?.repeatCount || 0);
    const retentionRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyGrowth = await db
      .select({
        month: sql<string>`TO_CHAR(${users.createdAt}, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${users.createdAt})`,
        yearNum: sql<number>`EXTRACT(YEAR FROM ${users.createdAt})`,
        newUsers: sql<number>`COUNT(*)`,
      })
      .from(users)
      .where(
        and(
          sql`${users.createdAt} >= ${sixMonthsAgo}`,
          eq(users.role, 'customer')
        )
      )
      .groupBy(
        sql`TO_CHAR(${users.createdAt}, 'Mon')`,
        sql`EXTRACT(MONTH FROM ${users.createdAt})`,
        sql`EXTRACT(YEAR FROM ${users.createdAt})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${users.createdAt})`,
        sql`EXTRACT(MONTH FROM ${users.createdAt})`
      );

    const monthlyOrders = await db
      .select({
        month: sql<string>`TO_CHAR(${orders.createdAt}, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${orders.createdAt})`,
        yearNum: sql<number>`EXTRACT(YEAR FROM ${orders.createdAt})`,
        returningCustomers: sql<number>`COUNT(DISTINCT ${orders.customerId})`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${sixMonthsAgo}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
      )
      .groupBy(
        sql`TO_CHAR(${orders.createdAt}, 'Mon')`,
        sql`EXTRACT(MONTH FROM ${orders.createdAt})`,
        sql`EXTRACT(YEAR FROM ${orders.createdAt})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${orders.createdAt})`,
        sql`EXTRACT(MONTH FROM ${orders.createdAt})`
      );

    const customerGrowth = monthlyGrowth.map(mg => {
      const matchingOrder = monthlyOrders.find(
        mo => Number(mo.monthNum) === Number(mg.monthNum) && Number(mo.yearNum) === Number(mg.yearNum)
      );
      return {
        month: mg.month,
        new: Number(mg.newUsers),
        returning: Number(matchingOrder?.returningCustomers || 0),
      };
    });

    return {
      retentionRate,
      avgPurchaseFrequency,
      customerLifetimeValue,
      customerGrowth,
    };
  }

  async getOperationsMetrics(days: number): Promise<{
    avgFulfillmentTime: number;
    fulfillmentRate: number;
    costOfGoodsSold: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [fulfillmentStats] = await db
      .select({
        totalOrders: sql<number>`COUNT(*)`,
        fulfilledOrders: sql<number>`COUNT(CASE WHEN ${orders.status} IN ('shipped', 'delivered', 'completed') THEN 1 END)`,
        avgFulfillmentHours: sql<number>`COALESCE(AVG(
          CASE WHEN ${orders.status} IN ('shipped', 'delivered', 'completed') AND ${orders.updatedAt} IS NOT NULL
            THEN EXTRACT(EPOCH FROM (${orders.updatedAt} - ${orders.createdAt})) / 3600
          END
        ), 0)`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
      );

    const [cogsResult] = await db
      .select({
        totalCogs: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${products.purchasePrice} IS NOT NULL THEN CAST(${products.purchasePrice} AS NUMERIC) * ${orderItems.quantity}
            WHEN ${products.purchasePricePerGram} IS NOT NULL AND ${products.pricePerGram} IS NOT NULL THEN
              CAST(${products.purchasePricePerGram} AS NUMERIC) * (CAST(${orderItems.subtotal} AS NUMERIC) / NULLIF(CAST(${products.pricePerGram} AS NUMERIC), 0))
            ELSE CAST(${orderItems.subtotal} AS NUMERIC) * 0.7
          END
        ), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'completed'])
        )
      );

    const totalOrders = Number(fulfillmentStats.totalOrders) || 1;
    const fulfilledOrders = Number(fulfillmentStats.fulfilledOrders) || 0;
    const avgFulfillmentHours = Number(fulfillmentStats.avgFulfillmentHours) || 0;
    const avgFulfillmentDays = Math.round((avgFulfillmentHours / 24) * 10) / 10;
    const fulfillmentRate = Math.round((fulfilledOrders / totalOrders) * 1000) / 10;

    return {
      avgFulfillmentTime: avgFulfillmentDays,
      fulfillmentRate,
      costOfGoodsSold: Number(cogsResult.totalCogs),
    };
  }

  // Notification operations
  async getNotifications(userId?: string): Promise<Notification[]> {
    if (userId) {
      return await retryQuery(() =>
        db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt))
      );
    }

    return await retryQuery(() =>
      db.select().from(notifications).orderBy(desc(notifications.createdAt))
    );
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await retryQuery(() => db.insert(notifications).values(notification).returning());
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await retryQuery(() => db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)));
  }

  async deleteNotification(id: number): Promise<void> {
    await retryQuery(() => db.delete(notifications).where(eq(notifications.id, id)));
  }

  // User management
  async getUsersWithStats(): Promise<(User & { orderCount?: number })[]> {
    const results = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        password: users.password,
        profileImageUrl: users.profileImageUrl,
        idImageUrl: users.idImageUrl,
        verificationPhotoUrl: users.verificationPhotoUrl,
        idVerificationStatus: users.idVerificationStatus,
        role: users.role,
        status: users.status,
        address: users.address,
        city: users.city,
        state: users.state,
        postalCode: users.postalCode,
        country: users.country,
        telegramUsername: users.telegramUsername,
        minPurchaseExempt: users.minPurchaseExempt,
        minPurchaseOverride: users.minPurchaseOverride,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        orderCount: sql<number>`COUNT(${orders.id})`,
      })
      .from(users)
      .leftJoin(orders, eq(users.id, orders.customerId))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt));

    return results.map(r => ({
      id: r.id,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      password: r.password,
      profileImageUrl: r.profileImageUrl,
      idImageUrl: r.idImageUrl,
      verificationPhotoUrl: r.verificationPhotoUrl,
      idVerificationStatus: r.idVerificationStatus,
      role: r.role,
      status: r.status,
      address: r.address,
      city: r.city,
      state: r.state,
      postalCode: r.postalCode,
      country: r.country,
      telegramUsername: r.telegramUsername,
      minPurchaseExempt: r.minPurchaseExempt,
      minPurchaseOverride: r.minPurchaseOverride,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      orderCount: Number(r.orderCount),
    }));
  }

  async updateUserStatus(id: string, status: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      throw new Error("User not found");
    }

    // Log the status change
    await this.logUserActivity(
      id,
      'Status Updated',
      `User status changed to ${status}`,
      { previousStatus: user.status, newStatus: status }
    );

    return user;
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    // Get current user data first
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .then(rows => rows[0]);

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Update the user role
    const [updatedUser] = await db
      .update(users)
      .set({
        role: role,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update user role');
    }

    // Log the role change
    await this.logUserActivity(
      id,
      'Role Updated',
      `User role changed from ${currentUser.role} to ${role}`,
      { previousRole: currentUser.role, newRole: role }
    );

    return updatedUser;
  }

  async updateUserIdVerification(id: string, status: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ idVerificationStatus: status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async getUsersPendingVerification(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.idVerificationStatus, 'pending'));
  }

  async createSupportTicket(data: any) {
    const [ticket] = await retryQuery(() =>
      db.insert(supportTickets).values(data).returning()
    );

    try {
      const adminUsers = await this.getUsersWithRole('admin');
      const managerUsers = await this.getUsersWithRole('manager');
      const allStaff = [...adminUsers, ...managerUsers];

      for (const user of allStaff) {
        await this.createNotification({
          userId: user.id,
          type: 'new_support_ticket',
          title: 'New Support Ticket',
          message: `New support ticket from ${data.customerName}: ${data.subject}`,
          data: {
            ticketId: ticket.id,
            customerName: data.customerName,
            subject: data.subject,
            priority: data.priority
          }
        });
      }
    } catch (notifyError) {
      console.error("Failed to send notifications for support ticket:", notifyError);
    }

    return ticket;
  }

  async getSupportTickets(filters: any = {}) {
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(supportTickets.status, filters.status));
    }

    if (filters.priority) {
      conditions.push(eq(supportTickets.priority, filters.priority));
    }

    const tickets = await retryQuery(() => db
      .select({
        ticket: supportTickets,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt)));

    // Process each ticket to add responses and assigned user
    const processedTickets = [];

    for (const ticket of tickets) {
      try {
        // Get responses for this ticket
        const responses = await retryQuery(() => db
          .select({
            id: supportTicketResponses.id,
            message: supportTicketResponses.message,
            type: supportTicketResponses.type,
            createdAt: supportTicketResponses.createdAt,
            createdBy: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            }
          })
          .from(supportTicketResponses)
          .leftJoin(users, eq(supportTicketResponses.createdBy, users.id))
          .where(eq(supportTicketResponses.ticketId, ticket.ticket.id))
          .orderBy(asc(supportTicketResponses.createdAt)));

        // Get assigned user if ticket has one
        let assignedUser = null;
        if (ticket.ticket.assignedTo) {
          const assignedUserResult = await db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            })
            .from(users)
            .where(eq(users.id, ticket.ticket.assignedTo))
            .limit(1);

          assignedUser = assignedUserResult[0] || null;
        }

        // Create processed ticket object
        processedTickets.push({
          ...ticket,
          responses,
          assignedUser
        });
      } catch (error) {
        console.error('Error processing ticket:', ticket.ticket.id, error);
        // Add ticket without responses/assignedUser if there's an error
        processedTickets.push({
          ...ticket,
          responses: [],
          assignedUser: null
        });
      }
    }

    return processedTickets;
  }

  async updateSupportTicketStatus(id: number, status: string) {
    const [ticket] = await db
      .update(supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return ticket;
  }

  async assignSupportTicket(id: number, assignedTo: string | null) {
    const [ticket] = await db
      .update(supportTickets)
      .set({ assignedTo, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();

    // If we need assigned user info, fetch it separately
    if (assignedTo && ticket) {
      const assignedUser = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, assignedTo))
        .limit(1);

      return {
        ...ticket,
        assignedUser: assignedUser[0] || null
      };
    }

    return ticket;
  }

  async addSupportTicketResponse(ticketId: number, responseData: {
    message: string;
    type: string;
    createdBy: string;
  }) {
    const [response] = await db
      .insert(supportTicketResponses)
      .values({
        ticketId,
        message: responseData.message,
        type: responseData.type,
        createdBy: responseData.createdBy,
      })
      .returning();

    return response;
  }

  async deleteSupportTicket(id: number): Promise<void> {
    await db.delete(supportTicketResponses).where(eq(supportTicketResponses.ticketId, id));
    await db.delete(supportTickets).where(eq(supportTickets.id, id));
  }

  async archiveSupportTicket(id: number): Promise<any> {
    const [ticket] = await db
      .update(supportTickets)
      .set({ archived: true, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return ticket;
  }

  async unarchiveSupportTicket(id: number): Promise<any> {
    const [ticket] = await db
      .update(supportTickets)
      .set({ archived: false, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return ticket;
  }

  async clearAllSupportTickets(): Promise<void> {
    // Only delete closed, non-archived tickets
    const ticketsToDelete = await db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.archived, false),
          eq(supportTickets.status, 'closed')
        )
      );

    for (const ticket of ticketsToDelete) {
      await db.delete(supportTicketResponses).where(eq(supportTicketResponses.ticketId, ticket.id));
    }

    if (ticketsToDelete.length > 0) {
      await db.delete(supportTickets).where(
        and(
          eq(supportTickets.archived, false),
          eq(supportTickets.status, 'closed')
        )
      );
    }
  }

  async cleanupOldClosedTickets(): Promise<void> {
    // Delete closed, non-archived tickets that were closed more than 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // First, get all closed non-archived tickets older than 24 hours
    const oldClosedTickets = await db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.status, 'closed'),
          eq(supportTickets.archived, false),
          lt(supportTickets.updatedAt, twentyFourHoursAgo)
        )
      );

    // Delete responses for these tickets first (foreign key constraint)
    for (const ticket of oldClosedTickets) {
      await db.delete(supportTicketResponses).where(eq(supportTicketResponses.ticketId, ticket.id));
    }

    // Then delete the tickets
    if (oldClosedTickets.length > 0) {
      await db
        .delete(supportTickets)
        .where(
          and(
            eq(supportTickets.status, 'closed'),
            eq(supportTickets.archived, false),
            lt(supportTickets.updatedAt, twentyFourHoursAgo)
          )
        );
    }
  }

  async getStaffUsers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(
        and(
          or(eq(users.role, 'staff'), eq(users.role, 'manager'), eq(users.role, 'admin')),
          eq(users.status, 'active')
        )
      )
      .orderBy(asc(users.firstName), asc(users.lastName));
  }

  async getUsersWithRole(role: string): Promise<User[]> {
    const usersWithRole = await db
      .select()
      .from(users)
      .where(eq(users.role, role));

    return usersWithRole;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(supportTicketResponses).where(eq(supportTicketResponses.createdBy, id));

    const userTickets = await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.userId, id));
    const assignedTickets = await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.assignedTo, id));

    const allTicketIds = [...new Set([...userTickets.map(t => t.id), ...assignedTickets.map(t => t.id)])];
    if (allTicketIds.length > 0) {
      await db.delete(supportTicketResponses).where(inArray(supportTicketResponses.ticketId, allTicketIds));
    }

    await db.update(supportTickets).set({ assignedTo: null }).where(eq(supportTickets.assignedTo, id));
    await db.delete(supportTickets).where(eq(supportTickets.userId, id));

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, id));
    await db.delete(notifications).where(eq(notifications.userId, id));
    await db.delete(inventoryLogs).where(eq(inventoryLogs.userId, id));

    const userOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, id));
    if (userOrders.length > 0) {
      const orderIds = userOrders.map(o => o.id);
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(eq(orders.customerId, id));
    }

    await db.update(orders).set({ assignedUserId: null }).where(eq(orders.assignedUserId, id));

    await db.delete(userActivityLogs).where(eq(userActivityLogs.userId, id));

    await db.delete(sessions).where(
      sql`sess::jsonb->>'userId' = ${id}`
    );

    await db.delete(users).where(eq(users.id, id));

    invalidateCache.analytics();
  }

  async updateUser(id: string, userData: any): Promise<User> {
    const updateFields: any = { updatedAt: new Date() };
    if (userData.firstName !== undefined) updateFields.firstName = userData.firstName;
    if (userData.lastName !== undefined) updateFields.lastName = userData.lastName;
    if (userData.email !== undefined) updateFields.email = userData.email;
    if (userData.role !== undefined) updateFields.role = userData.role;
    if (userData.status !== undefined) updateFields.status = userData.status;
    if (userData.address !== undefined) updateFields.address = userData.address;
    if (userData.city !== undefined) updateFields.city = userData.city;
    if (userData.state !== undefined) updateFields.state = userData.state;
    if (userData.postalCode !== undefined) updateFields.postalCode = userData.postalCode;
    if (userData.country !== undefined) updateFields.country = userData.country;
    if (userData.phoneNumber !== undefined) updateFields.phoneNumber = userData.phoneNumber;
    if (userData.telegramUsername !== undefined) updateFields.telegramUsername = userData.telegramUsername || null;
    if (userData.minPurchaseExempt !== undefined) updateFields.minPurchaseExempt = userData.minPurchaseExempt;
    if (userData.minPurchaseOverride !== undefined) {
      const val = userData.minPurchaseOverride;
      if (val === null || val === "" || val === undefined) {
        updateFields.minPurchaseOverride = null;
      } else {
        const parsed = parseFloat(String(val));
        updateFields.minPurchaseOverride = isNaN(parsed) ? null : String(parsed);
      }
    }

    // Read existing user first
    const [existingUser] = await retryQuery(async () => {
      return await db.select().from(users).where(eq(users.id, id));
    });

    if (!existingUser) {
      throw new Error("User not found");
    }

    // Perform update without RETURNING to avoid Neon driver stale read issues
    await retryQuery(async () => {
      await db
        .update(users)
        .set(updateFields)
        .where(eq(users.id, id));
      return true;
    });

    // Merge changes manually to construct correct response
    const result = { ...existingUser, ...updateFields };

    // Log the profile update (non-blocking, don't let it fail the update)
    const updatedFieldNames = Object.keys(userData).join(', ');
    this.logUserActivity(
      id,
      'Profile Updated',
      `User profile updated: ${updatedFieldNames}`,
      { updatedFields: userData }
    ).catch(err => console.error('Activity log error:', err));

    return result;
  }

  async getInventoryLogs(filters?: { days?: number; type?: string; product?: string }): Promise<any[]> {
    let query = db
      .select({
        id: inventoryLogs.id,
        productId: inventoryLogs.productId,
        type: inventoryLogs.type,
        quantity: inventoryLogs.quantity,
        previousStock: inventoryLogs.previousStock,
        newStock: inventoryLogs.newStock,
        reason: inventoryLogs.reason,
        userId: inventoryLogs.userId,
        createdAt: inventoryLogs.createdAt,
        product: products,
        user: users,
      })
      .from(inventoryLogs)
      .leftJoin(products, eq(inventoryLogs.productId, products.id))
      .leftJoin(users, eq(inventoryLogs.userId, users.id));

    const conditions = [];

    if (filters?.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - filters.days);
      conditions.push(sql`${inventoryLogs.createdAt} >= ${startDate}`);
    }

    if (filters?.type) {
      conditions.push(eq(inventoryLogs.type, filters.type));
    }

    if (filters?.product) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.product}%`),
          ilike(products.sku, `%${filters.product}%`)
        )
      );
    }

    let finalQuery = query;
    if (conditions.length > 0) {
      finalQuery = finalQuery.where(and(...conditions));
    }

    return await finalQuery.orderBy(desc(inventoryLogs.createdAt));
  }

  async logUserActivity(userId: string, action: string, details: string, metadata?: any): Promise<void> {
    try {
      await db.insert(userActivityLogs).values({
        userId,
        action,
        details,
        metadata: metadata ? metadata : null,
      });
    } catch (error) {
      console.error('Error logging user activity:', error);
    }
  }

  async getUserActivity(userId: string, options: { limit?: number; type?: string } = {}): Promise<any[]> {
    try {
      const { limit = 50, type } = options;

      const activityLogs = await db
        .select({
          id: userActivityLogs.id,
          type: sql<string>`'user_activity'`,
          action: userActivityLogs.action,
          details: userActivityLogs.details,
          timestamp: userActivityLogs.createdAt,
          metadata: userActivityLogs.metadata,
          productName: sql<string | null>`NULL`,
          productSku: sql<string | null>`NULL`,
        })
        .from(userActivityLogs)
        .where(eq(userActivityLogs.userId, userId))
        .orderBy(desc(userActivityLogs.createdAt))
        .limit(limit);

      const inventoryActivity = await db
        .select({
          id: inventoryLogs.id,
          type: inventoryLogs.type,
          action: inventoryLogs.reason,
          details: sql<string>`'Qty: ' || ${inventoryLogs.quantity}::text`,
          timestamp: inventoryLogs.createdAt,
          metadata: sql<any>`NULL`,
          productName: sql<string | null>`${products.name}`,
          productSku: sql<string | null>`${products.sku}`,
        })
        .from(inventoryLogs)
        .leftJoin(products, eq(inventoryLogs.productId, products.id))
        .where(
          and(
            eq(inventoryLogs.userId, userId),
            sql`${inventoryLogs.productId} IS NOT NULL`
          )
        )
        .orderBy(desc(inventoryLogs.createdAt))
        .limit(limit);

      const orderActivity = await db
        .select({
          id: orders.id,
          type: sql<string>`'order'`,
          action: sql<string>`CASE
            WHEN ${orders.status} = 'pending' THEN 'Order Placed'
            WHEN ${orders.status} = 'processing' THEN 'Order Processing'
            WHEN ${orders.status} = 'shipped' THEN 'Order Shipped'
            WHEN ${orders.status} = 'delivered' THEN 'Order Delivered'
            WHEN ${orders.status} = 'completed' THEN 'Order Completed'
            WHEN ${orders.status} = 'cancelled' THEN 'Order Cancelled'
            ELSE 'Order Updated'
          END`,
          details: orders.total,
          timestamp: orders.createdAt,
          metadata: sql<any>`NULL`,
          productName: sql<string | null>`NULL`,
          productSku: sql<string | null>`NULL`,
        })
        .from(orders)
        .where(eq(orders.customerId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(limit);

      const allActivity = [...activityLogs, ...inventoryActivity, ...orderActivity]
        .sort((a, b) => new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime())
        .slice(0, limit);

      return allActivity;
    } catch (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }
  }

  // City purchase limits
  async getCityPurchaseLimits(): Promise<any[]> {
    return retryQuery(() => db.select().from(cityPurchaseLimits).orderBy(cityPurchaseLimits.cityName));
  }

  async getCityPurchaseLimit(id: number): Promise<any | undefined> {
    const results = await retryQuery(() => db.select().from(cityPurchaseLimits).where(eq(cityPurchaseLimits.id, id)));
    return results[0];
  }

  async getCityPurchaseLimitByCity(cityName: string): Promise<any | undefined> {
    const results = await retryQuery(() => db.select().from(cityPurchaseLimits)
      .where(and(
        ilike(cityPurchaseLimits.cityName, cityName),
        eq(cityPurchaseLimits.isActive, true)
      )));
    return results[0];
  }

  async getCityByNameAny(cityName: string): Promise<any | undefined> {
    const results = await retryQuery(() => db.select().from(cityPurchaseLimits)
      .where(ilike(cityPurchaseLimits.cityName, cityName)));
    return results[0];
  }

  async createCityPurchaseLimit(data: any): Promise<any> {
    const results = await retryQuery(() => db.insert(cityPurchaseLimits).values(data).returning());
    return results[0];
  }

  async updateCityPurchaseLimit(id: number, data: any): Promise<any> {
    const existing = await this.getCityPurchaseLimit(id);
    if (!existing) return undefined;
    const updatedAt = new Date();
    await retryQuery(() => db.update(cityPurchaseLimits)
      .set({ ...data, updatedAt })
      .where(eq(cityPurchaseLimits.id, id)));
    return { ...existing, ...data, updatedAt };
  }

  async deleteCityPurchaseLimit(id: number): Promise<void> {
    await retryQuery(() => db.delete(cityPurchaseLimits).where(eq(cityPurchaseLimits.id, id)));
  }

  // Access passwords
  async getAccessPasswords(): Promise<AccessPassword[]> {
    return retryQuery(() => db.select().from(accessPasswords).orderBy(desc(accessPasswords.createdAt)));
  }

  async getAccessPassword(id: number): Promise<AccessPassword | undefined> {
    const results = await retryQuery(() => db.select().from(accessPasswords).where(eq(accessPasswords.id, id)));
    return results[0];
  }

  async createAccessPassword(data: any): Promise<AccessPassword> {
    const toInsert: any = {
      label: data.label,
      password: data.password,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
    if (data.validFrom) toInsert.validFrom = new Date(data.validFrom);
    if (data.validTo) toInsert.validTo = new Date(data.validTo);
    const results = await retryQuery(() => db.insert(accessPasswords).values(toInsert).returning());
    return results[0];
  }

  async updateAccessPassword(id: number, data: any): Promise<AccessPassword | undefined> {
    const existing = await this.getAccessPassword(id);
    if (!existing) return undefined;
    const toUpdate: any = { updatedAt: new Date() };
    if (data.label !== undefined) toUpdate.label = data.label;
    if (data.password !== undefined) toUpdate.password = data.password;
    if (data.isActive !== undefined) toUpdate.isActive = data.isActive;
    if ('validFrom' in data) toUpdate.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if ('validTo' in data) toUpdate.validTo = data.validTo ? new Date(data.validTo) : null;
    const results = await retryQuery(() => db.update(accessPasswords).set(toUpdate).where(eq(accessPasswords.id, id)).returning());
    return results[0];
  }

  async deleteAccessPassword(id: number): Promise<void> {
    await retryQuery(() => db.delete(accessPasswords).where(eq(accessPasswords.id, id)));
  }

  async verifyAccessPassword(password: string): Promise<number | null> {
    const now = new Date();
    const all = await retryQuery(() => db.select().from(accessPasswords).where(eq(accessPasswords.isActive, true)));
    for (const ap of all) {
      if (ap.password !== password) continue;
      if (ap.validFrom && now < ap.validFrom) continue;
      if (ap.validTo && now > ap.validTo) continue;
      return ap.id;
    }
    return null;
  }

  async isAccessPasswordStillValid(passwordId: number): Promise<boolean> {
    const now = new Date();
    const results = await retryQuery(() => db.select().from(accessPasswords).where(and(eq(accessPasswords.id, passwordId), eq(accessPasswords.isActive, true))));
    if (!results[0]) return false;
    const ap = results[0];
    if (ap.validFrom && now < ap.validFrom) return false;
    if (ap.validTo && now > ap.validTo) return false;
    return true;
  }

  async setUserGrantedAccessPassword(userId: string, passwordId: number | null): Promise<void> {
    await retryQuery(() => db.update(users).set({ grantedAccessPasswordId: passwordId, updatedAt: new Date() }).where(eq(users.id, userId)));
  }

  // Promotional Ads
  async getPromotionalAds(): Promise<PromotionalAd[]> {
    return retryQuery(() => db.select().from(promotionalAds).orderBy(asc(promotionalAds.sortOrder), desc(promotionalAds.createdAt)));
  }

  async getActivePromotionalAds(): Promise<PromotionalAd[]> {
    const now = new Date();
    const all = await retryQuery(() => db.select().from(promotionalAds).where(eq(promotionalAds.isActive, true)).orderBy(asc(promotionalAds.sortOrder)));
    return all.filter(ad => {
      if (ad.validFrom && now < ad.validFrom) return false;
      if (ad.validTo && now > ad.validTo) return false;
      return true;
    });
  }

  async getAdByDiscountId(discountId: number): Promise<PromotionalAd | undefined> {
    const results = await retryQuery(() => db.select().from(promotionalAds).where(eq(promotionalAds.discountId, discountId)));
    return results[0];
  }

  async deleteAdByDiscountId(discountId: number): Promise<void> {
    await retryQuery(() => db.delete(promotionalAds).where(eq(promotionalAds.discountId, discountId)));
  }

  async createPromotionalAd(data: any): Promise<PromotionalAd> {
    const toInsert: any = {
      title: data.title,
      isActive: data.isActive !== false,
      sortOrder: data.sortOrder ?? 0,
    };
    if (data.discountId !== undefined) toInsert.discountId = data.discountId;
    if (data.subtitle) toInsert.subtitle = data.subtitle;
    if (data.buttonText) toInsert.buttonText = data.buttonText;
    if (data.buttonLink) toInsert.buttonLink = data.buttonLink;
    if (data.backgroundImageUrl) toInsert.backgroundImageUrl = data.backgroundImageUrl;
    if (data.backgroundColor) toInsert.backgroundColor = data.backgroundColor;
    if (data.textColor) toInsert.textColor = data.textColor;
    if (data.validFrom) toInsert.validFrom = new Date(data.validFrom);
    if (data.validTo) toInsert.validTo = new Date(data.validTo);
    const results = await retryQuery(() => db.insert(promotionalAds).values(toInsert).returning());
    return results[0];
  }

  async updatePromotionalAd(id: number, data: any): Promise<PromotionalAd | undefined> {
    const existing = await retryQuery(() => db.select().from(promotionalAds).where(eq(promotionalAds.id, id)));
    if (!existing[0]) return undefined;
    const toUpdate: any = { updatedAt: new Date() };
    if (data.title !== undefined) toUpdate.title = data.title;
    if (data.subtitle !== undefined) toUpdate.subtitle = data.subtitle;
    if (data.buttonText !== undefined) toUpdate.buttonText = data.buttonText;
    if (data.buttonLink !== undefined) toUpdate.buttonLink = data.buttonLink;
    if (data.backgroundImageUrl !== undefined) toUpdate.backgroundImageUrl = data.backgroundImageUrl;
    if (data.backgroundColor !== undefined) toUpdate.backgroundColor = data.backgroundColor;
    if (data.textColor !== undefined) toUpdate.textColor = data.textColor;
    if (data.isActive !== undefined) toUpdate.isActive = data.isActive;
    if (data.sortOrder !== undefined) toUpdate.sortOrder = data.sortOrder;
    if ('validFrom' in data) toUpdate.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if ('validTo' in data) toUpdate.validTo = data.validTo ? new Date(data.validTo) : null;
    const results = await retryQuery(() => db.update(promotionalAds).set(toUpdate).where(eq(promotionalAds.id, id)).returning());
    return results[0];
  }

  async deletePromotionalAd(id: number): Promise<void> {
    await retryQuery(() => db.delete(promotionalAds).where(eq(promotionalAds.id, id)));
  }

  // Discounts
  async getDiscounts(): Promise<Discount[]> {
    return retryQuery(() => db.select().from(discounts).orderBy(desc(discounts.createdAt)));
  }

  async getActiveDiscounts(): Promise<Discount[]> {
    const now = new Date();
    const all = await retryQuery(() => db.select().from(discounts).where(eq(discounts.isActive, true)));
    return all.filter(d => {
      if (d.validFrom && now < d.validFrom) return false;
      if (d.validTo && now > d.validTo) return false;
      return true;
    });
  }

  async createDiscount(data: any): Promise<Discount> {
    const toInsert: any = {
      name: data.name,
      type: data.type,
      isActive: data.isActive !== false,
    };
    if (data.description) toInsert.description = data.description;
    if (data.minQuantity != null) toInsert.minQuantity = data.minQuantity;
    if (data.minSpend != null) toInsert.minSpend = data.minSpend;
    if (data.requiredProductIds) toInsert.requiredProductIds = data.requiredProductIds;
    if (data.discountPercent != null) toInsert.discountPercent = data.discountPercent;
    if (data.freeProductId != null) toInsert.freeProductId = data.freeProductId;
    if (data.freeProductQuantity != null) toInsert.freeProductQuantity = data.freeProductQuantity;
    if (data.applyToProductId != null) toInsert.applyToProductId = data.applyToProductId;
    if (data.applyToCategoryId != null) toInsert.applyToCategoryId = data.applyToCategoryId;
    if (data.validFrom) toInsert.validFrom = new Date(data.validFrom);
    if (data.validTo) toInsert.validTo = new Date(data.validTo);
    const results = await retryQuery(() => db.insert(discounts).values(toInsert).returning());
    return results[0];
  }

  async updateDiscount(id: number, data: any): Promise<Discount | undefined> {
    const existing = await retryQuery(() => db.select().from(discounts).where(eq(discounts.id, id)));
    if (!existing[0]) return undefined;
    const toUpdate: any = { updatedAt: new Date() };
    if (data.name !== undefined) toUpdate.name = data.name;
    if (data.type !== undefined) toUpdate.type = data.type;
    if (data.description !== undefined) toUpdate.description = data.description;
    if (data.isActive !== undefined) toUpdate.isActive = data.isActive;
    if ('minQuantity' in data) toUpdate.minQuantity = data.minQuantity;
    if ('minSpend' in data) toUpdate.minSpend = data.minSpend;
    if ('requiredProductIds' in data) toUpdate.requiredProductIds = data.requiredProductIds;
    if ('discountPercent' in data) toUpdate.discountPercent = data.discountPercent;
    if ('freeProductId' in data) toUpdate.freeProductId = data.freeProductId;
    if ('freeProductQuantity' in data) toUpdate.freeProductQuantity = data.freeProductQuantity;
    if ('applyToProductId' in data) toUpdate.applyToProductId = data.applyToProductId;
    if ('applyToCategoryId' in data) toUpdate.applyToCategoryId = data.applyToCategoryId;
    if ('validFrom' in data) toUpdate.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if ('validTo' in data) toUpdate.validTo = data.validTo ? new Date(data.validTo) : null;
    const results = await retryQuery(() => db.update(discounts).set(toUpdate).where(eq(discounts.id, id)).returning());
    return results[0];
  }

  async deleteDiscount(id: number): Promise<void> {
    await retryQuery(() => db.delete(discounts).where(eq(discounts.id, id)));
  }

  // Promo code implementation
  async getPromoCodes(): Promise<PromoCode[]> {
    return retryQuery(() => db.select().from(promoCodes).orderBy(promoCodes.createdAt));
  }

  async getPromoCode(id: number): Promise<PromoCode | undefined> {
    const results = await retryQuery(() => db.select().from(promoCodes).where(eq(promoCodes.id, id)));
    return results[0];
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const results = await retryQuery(() => db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase())));
    return results[0];
  }

  async createPromoCode(data: any): Promise<PromoCode> {
    const toInsert: any = {
      code: data.code.toUpperCase().trim(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      bypassPurchaseMinimum: data.bypassPurchaseMinimum || false,
      usageLimitType: data.usageLimitType || 'unlimited',
      isActive: data.isActive !== false,
    };
    if (data.description) toInsert.description = data.description;
    if (data.minOrderAmount != null && data.minOrderAmount !== "") toInsert.minOrderAmount = data.minOrderAmount;
    if (data.maxTotalUses != null) toInsert.maxTotalUses = data.maxTotalUses;
    if (data.validFrom) toInsert.validFrom = new Date(data.validFrom);
    if (data.validTo) toInsert.validTo = new Date(data.validTo);
    const results = await retryQuery(() => db.insert(promoCodes).values(toInsert).returning());
    return results[0];
  }

  async updatePromoCode(id: number, data: any): Promise<PromoCode | undefined> {
    const existing = await this.getPromoCode(id);
    if (!existing) return undefined;
    const toUpdate: any = {};
    if (data.code !== undefined) toUpdate.code = data.code.toUpperCase().trim();
    if (data.description !== undefined) toUpdate.description = data.description;
    if (data.discountType !== undefined) toUpdate.discountType = data.discountType;
    if (data.discountValue !== undefined) toUpdate.discountValue = data.discountValue;
    if ('minOrderAmount' in data) toUpdate.minOrderAmount = (data.minOrderAmount != null && data.minOrderAmount !== "") ? data.minOrderAmount : null;
    if (data.bypassPurchaseMinimum !== undefined) toUpdate.bypassPurchaseMinimum = data.bypassPurchaseMinimum;
    if (data.usageLimitType !== undefined) toUpdate.usageLimitType = data.usageLimitType;
    if ('maxTotalUses' in data) toUpdate.maxTotalUses = data.maxTotalUses;
    if (data.isActive !== undefined) toUpdate.isActive = data.isActive;
    if ('validFrom' in data) toUpdate.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if ('validTo' in data) toUpdate.validTo = data.validTo ? new Date(data.validTo) : null;
    const results = await retryQuery(() => db.update(promoCodes).set(toUpdate).where(eq(promoCodes.id, id)).returning());
    return results[0];
  }

  async deletePromoCode(id: number): Promise<void> {
    await retryQuery(() => db.delete(promoCodes).where(eq(promoCodes.id, id)));
  }

  async getPromoCodeUsesForUser(promoCodeId: number, userId: string): Promise<number> {
    const results = await retryQuery(() =>
      db.select().from(promoCodeUses)
        .where(eq(promoCodeUses.promoCodeId, promoCodeId))
    );
    return results.filter(r => r.userId === userId).length;
  }

  async recordPromoCodeUse(promoCodeId: number, userId: string): Promise<void> {
    await retryQuery(() => db.insert(promoCodeUses).values({ promoCodeId, userId }));
  }

  async incrementPromoCodeTotalUses(promoCodeId: number): Promise<void> {
    await retryQuery(() =>
      db.update(promoCodes)
        .set({ totalUses: sql`${promoCodes.totalUses} + 1` })
        .where(eq(promoCodes.id, promoCodeId))
    );
  }

  async getPriceTemplates(): Promise<any[]> {
    return retryQuery(() =>
      db.select().from(priceTemplates).orderBy(asc(priceTemplates.name))
    );
  }

  async getPriceTemplate(id: number): Promise<any | undefined> {
    const results = await retryQuery(() =>
      db.select().from(priceTemplates).where(eq(priceTemplates.id, id))
    );
    return results[0];
  }

  async createPriceTemplate(data: any): Promise<any> {
    const results = await retryQuery(() =>
      db.insert(priceTemplates).values(data).returning()
    );
    return results[0];
  }

  async updatePriceTemplate(id: number, data: any): Promise<any> {
    const results = await retryQuery(() =>
      db.update(priceTemplates).set({ ...data, updatedAt: new Date() }).where(eq(priceTemplates.id, id)).returning()
    );
    return results[0];
  }

  async deletePriceTemplate(id: number): Promise<void> {
    await retryQuery(() => db.delete(priceTemplates).where(eq(priceTemplates.id, id)));
  }

  // Board Posts
  async getBoardPosts(): Promise<BoardPost[]> {
    return retryQuery(() => db.select().from(boardPosts).where(eq(boardPosts.isActive, true)).orderBy(desc(boardPosts.createdAt)));
  }

  async getAllBoardPosts(): Promise<BoardPost[]> {
    return retryQuery(() => db.select().from(boardPosts).orderBy(desc(boardPosts.createdAt)));
  }

  async createBoardPost(data: { text?: string | null; imageUrl?: string | null; createdBy: string }): Promise<BoardPost> {
    const results = await retryQuery(() =>
      db.insert(boardPosts).values({
        text: data.text ?? null,
        imageUrl: data.imageUrl ?? null,
        createdBy: data.createdBy,
        isActive: true,
      }).returning()
    );
    return results[0];
  }

  async deleteBoardPost(id: number): Promise<void> {
    await retryQuery(() => db.delete(boardPosts).where(eq(boardPosts.id, id)));
  }
}

export const storage = new DatabaseStorage();