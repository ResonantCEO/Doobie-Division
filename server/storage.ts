import {
  users,
  sessions,
  categories,
  products,
  productSizes,
  orders,
  orderItems,
  inventoryLogs,
  userActivityLogs,
  notifications,
  supportTickets,
  supportTicketResponses,
  passwordResetTokens,
  cityPurchaseLimits,
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
      const isRetryable = errorMsg.includes("Cannot read properties of null") ||
        errorMsg.includes("fetch failed") ||
        errorMsg.includes("ECONNRESET") ||
        errorMsg.includes("socket hang up");
      if (isRetryable && attempt < retries) {
        const delay = 150 * Math.pow(2, attempt);
        console.warn(`[retryQuery] Retryable error (attempt ${attempt + 1}/${retries}), waiting ${delay}ms: ${errorMsg.substring(0, 80)}`);
        await new Promise(r => setTimeout(r, delay));
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
  createUserWithPassword(userData: any): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  getUserCount(): Promise<number>;

  // Category operations
  getCategories(): Promise<(Category & { children?: Category[] })[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Product operations
  getProducts(filters?: { categoryId?: number; categoryIds?: number[]; search?: string; status?: string; isActive?: boolean }): Promise<(Product & { category: Category | null; sizes?: ProductSize[] })[]>;
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
  fulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string): Promise<void>;
  unfulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string): Promise<void>;
  markOrderItemAsPacked(orderId: number, productId: number, userId: string): Promise<{ success: boolean; allPacked: boolean }>;
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
}

export class DatabaseStorage implements IStorage {
  private extractSizeFromProductName(productName: string): string | null {
    const match = productName.match(/\(Size:\s*([^)]+)\)/);
    return match ? match[1].trim() : null;
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
    idVerificationStatus?: string;
    role: string;
    status: string;
  }) {
    const userCount = await this.getUserCount();
    let status = 'pending';
    let role = 'customer';

    if (userCount === 0) {
      status = 'active';
      role = 'admin';
    }

    userData = {
      ...userData,
      status,
      role
    };

    const [newUser] = await db
      .insert(users)
      .values(userData)
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
      // Get all relevant category IDs including parent and all descendant categories recursively
      const allCategoryIds = [...filters.categoryIds];

      // Recursive function to get all descendants
      const getAllDescendants = async (parentId: number): Promise<number[]> => {
        const directChildren = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.parentId, parentId), eq(categories.isActive, true)));

        let descendants: number[] = [];
        for (const child of directChildren) {
          descendants.push(child.id);
          // Recursively get children of children
          const grandchildren = await getAllDescendants(child.id);
          descendants = descendants.concat(grandchildren);
        }

        return descendants;
      };

      // Get descendants for each requested category
      for (const categoryId of filters.categoryIds) {
        const descendants = await getAllDescendants(categoryId);
        for (const descendantId of descendants) {
          if (!allCategoryIds.includes(descendantId)) {
            allCategoryIds.push(descendantId);
          }
        }
      }

      if (allCategoryIds.length > 0) {
        conditions.push(inArray(products.categoryId, allCategoryIds));
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

      // Attach sizes to each product (empty array if no sizes)
      const result = productsList.map(product => ({
        ...product,
        sizes: sizesByProductId.get(product.id) || [],
      }));
      
      return result;
    } catch (error) {
      // If there's an error fetching sizes, return products without sizes
      console.error('[getProducts] Error fetching product sizes:', error);
      const result = productsList.map(product => ({
        ...product,
        sizes: [] as ProductSize[],
      }));
      return result;
    }
  }

  async getProduct(id: number): Promise<(Product & { category: Category | null; sizes?: ProductSize[] }) | undefined> {
    let product: any;
    try {
      const rawResult = await retryQuery(() =>
        db.execute(sql`SELECT id, name, company, description, price, sku, category_id, image_url, stock, physical_inventory, min_stock_threshold, selling_method, weight_unit, price_per_gram, price_per_ounce, discount_percentage, purchase_price, purchase_price_method, purchase_price_per_gram, purchase_price_per_ounce, admin_notes, is_active, created_at, updated_at FROM products WHERE id = ${id}`)
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
          stock: row.stock,
          physicalInventory: row.physical_inventory,
          minStockThreshold: row.min_stock_threshold,
          sellingMethod: row.selling_method,
          weightUnit: row.weight_unit,
          pricePerGram: row.price_per_gram,
          pricePerOunce: row.price_per_ounce,
          discountPercentage: row.discount_percentage,
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
      return {
        ...product,
        sizes: sizes.length > 0 ? sizes : undefined,
      };
    } catch (error) {
      console.error('[getProduct] Error fetching product sizes:', error);
      return { ...product, sizes: [] };
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

    const numericFields = ['pricePerGram', 'pricePerOunce', 'discountPercentage', 'purchasePrice', 'purchasePricePerGram', 'purchasePricePerOunce'] as const;
    for (const field of numericFields) {
      const val = toNumericStr(productData[field]);
      if (val !== undefined) {
        processedProduct[field] = val;
      } else {
        delete processedProduct[field];
      }
    }

    const stringFields = ['company', 'adminNotes'] as const;
    for (const field of stringFields) {
      if (processedProduct[field] === '') {
        delete processedProduct[field];
      }
    }

    let newProduct: Product | undefined;
    try {
      const result = await db
        .insert(products)
        .values([processedProduct])
        .returning();
      newProduct = result?.[0];
    } catch (insertError: any) {
      if (insertError?.cause?.severity === 'ERROR') {
        throw insertError;
      }
      console.warn('Insert returning() parse issue, fetching by SKU:', insertError);
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

    const numericFields = ['pricePerGram', 'pricePerOunce', 'discountPercentage', 'purchasePrice', 'purchasePricePerGram', 'purchasePricePerOunce'];
    for (const field of numericFields) {
      if (field in updateData) {
        const val = toNumericStr(updateData[field]);
        if (val !== undefined) {
          updateData[field] = val;
        } else {
          updateData[field] = sql`NULL`;
        }
      }
    }

    const [product] = await db.update(products)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(products.id, id))
      .returning();

    if (!product) {
      throw new Error("Product not found");
    }

    if (sizes !== undefined) {
      try {
        await db.delete(productSizes).where(eq(productSizes.productId, id));
      } catch (e) {
        console.warn('Could not delete old product sizes:', e);
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
          await db.insert(productSizes).values(sizeRecords);
        } catch (sizeError) {
          console.warn('Error creating product sizes:', sizeError);
        }
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
            or(eq(orders.status, 'pending'), eq(orders.status, 'processing'))
          )
        );

      if (activeOrderCount && activeOrderCount[0] && Number(activeOrderCount[0].count) > 0) {
        throw new Error("Cannot delete product. It is referenced in pending or processing orders.");
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

      // Hide delivered orders older than 48 hours for customers
      if (filters.hideOldDelivered) {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        conditions.push(
          or(
            ne(orders.status, 'delivered'),
            and(
              eq(orders.status, 'delivered'),
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
      const todayOrdersResult = await retryQuery(() =>
        db.execute(sql`SELECT order_number FROM orders WHERE order_number LIKE ${datePrefix + '-%'}`)
      );
      const todayOrders = todayOrdersResult?.rows || [];
      if (todayOrders.length > 0) {
        const sequentialNumbers = todayOrders
          .map((order: any) => {
            const parts = (order.order_number || '').split('-');
            return parts.length === 2 ? parseInt(parts[1]) : 0;
          })
          .filter((num: number) => !isNaN(num));
        if (sequentialNumbers.length > 0) {
          nextSequential = Math.max(...sequentialNumbers) + 1;
        }
      }
    } catch (e) {
      console.warn('[createOrder] Could not check existing orders, using timestamp fallback');
      nextSequential = Math.floor(Math.random() * 900) + 100;
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
        await db.execute(sql`UPDATE products SET stock = stock - ${item.quantity}, updated_at = NOW() WHERE id = ${item.productId}`);

        const sizeName = this.extractSizeFromProductName(item.productName);
        if (sizeName) {
          await db.execute(sql`UPDATE product_sizes SET quantity = quantity - ${item.quantity}, updated_at = NOW() WHERE product_id = ${item.productId} AND size = ${sizeName}`);
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

  async fulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string): Promise<void> {
    // Get the product
    const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (product.length === 0) {
      throw new Error("Product not found");
    }

    const currentPhysicalInventory = product[0].physicalInventory || 0;
    const newPhysicalInventory = currentPhysicalInventory - quantity;

    if (newPhysicalInventory < 0) {
      throw new Error("Insufficient physical inventory");
    }

    // Update only physical inventory (stock is reduced when order is placed, not when fulfilled)
    await db
      .update(products)
      .set({
        physicalInventory: newPhysicalInventory,
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    // Mark order item as fulfilled
    const [fulfilledItem] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)))
      .limit(1);

    await db
      .update(orderItems)
      .set({ fulfilled: true })
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)));

    if (fulfilledItem) {
      const sizeName = this.extractSizeFromProductName(fulfilledItem.productName);
      if (sizeName) {
        await db.execute(sql`UPDATE product_sizes SET physical_quantity = physical_quantity - ${quantity}, updated_at = NOW() WHERE product_id = ${productId} AND size = ${sizeName}`);
      }
    }

    // Log the physical inventory change
    await db.insert(inventoryLogs).values({
      productId,
      userId,
      type: 'physical_out',
      quantity: -quantity,
      previousStock: currentPhysicalInventory,
      newStock: newPhysicalInventory,
      reason: `Order fulfillment - Order #${orderId} (Physical inventory reduced)`,
      createdAt: new Date()
    });
  }

  async unfulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string): Promise<void> {
    // Get the product
    const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (product.length === 0) {
      throw new Error("Product not found");
    }

    // Get the order item to verify it's fulfilled
    const orderItem = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)))
      .limit(1);

    if (orderItem.length === 0) {
      throw new Error("Order item not found");
    }

    if (!orderItem[0].fulfilled) {
      throw new Error("Order item is not fulfilled");
    }

    const currentPhysicalInventory = product[0].physicalInventory || 0;
    const newPhysicalInventory = currentPhysicalInventory + quantity;

    // Update only physical inventory (add back)
    await db
      .update(products)
      .set({
        physicalInventory: newPhysicalInventory,
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    // Get the order item to extract size info before marking as unfulfilled
    const [unfulfillItem] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)))
      .limit(1);

    // Mark order item as not fulfilled
    await db
      .update(orderItems)
      .set({ fulfilled: false })
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)));

    if (unfulfillItem) {
      const sizeName = this.extractSizeFromProductName(unfulfillItem.productName);
      if (sizeName) {
        await db.execute(sql`UPDATE product_sizes SET physical_quantity = physical_quantity + ${quantity}, updated_at = NOW() WHERE product_id = ${productId} AND size = ${sizeName}`);
      }
    }

    // Log the physical inventory change
    await db.insert(inventoryLogs).values({
      productId,
      userId,
      type: 'physical_in',
      quantity: quantity,
      previousStock: currentPhysicalInventory,
      newStock: newPhysicalInventory,
      reason: `Order unfulfillment - Order #${orderId} (Physical inventory restored)`,
      createdAt: new Date()
    });
  }

  async markOrderItemAsPacked(orderId: number, productId: number, userId: string): Promise<{ success: boolean; allPacked: boolean }> {
    // Get the product and order item
    const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (product.length === 0) {
      throw new Error("Product not found");
    }

    const orderItem = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)))
      .limit(1);

    if (orderItem.length === 0) {
      throw new Error("Order item not found");
    }

    if (orderItem[0].fulfilled) {
      throw new Error("Order item already packed");
    }

    const packedQuantity = orderItem[0].quantity;
    const currentPhysicalInventory = product[0].physicalInventory || 0;
    const newPhysicalInventory = currentPhysicalInventory - packedQuantity;

    // Check if there's enough physical inventory
    if (newPhysicalInventory < 0) {
      throw new Error(`Insufficient physical inventory. Available: ${currentPhysicalInventory}, Required: ${packedQuantity}`);
    }

    // Mark the order item as packed (fulfilled = true) and update physical inventory
    await db.transaction(async (tx) => {
      // Mark order item as packed
      await tx
        .update(orderItems)
        .set({ fulfilled: true })
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)));

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
        quantity: -packedQuantity, // Negative because we're reducing physical inventory
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
    try {
      await retryQuery(() => db.delete(orderItems).where(eq(orderItems.orderId, id)));
    } catch (e) {
      console.warn('[deleteOrder] Failed to delete order items:', e);
    }
    const deleted = await retryQuery(() => db.delete(orders).where(eq(orders.id, id)).returning());
    if (deleted.length === 0) {
      throw new Error("Order not found");
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
            inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
            inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
          )
        )
        .groupBy(sql`DATE_TRUNC('day', ${orders.createdAt})`)
        .orderBy(asc(sql`DATE_TRUNC('day', ${orders.createdAt})`));

      return results.map(r => ({
        date: r.date,
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
              inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
        fulfilledOrders: sql<number>`COUNT(CASE WHEN ${orders.status} IN ('shipped', 'completed') THEN 1 END)`,
        avgFulfillmentHours: sql<number>`COALESCE(AVG(
          CASE WHEN ${orders.status} IN ('shipped', 'completed') AND ${orders.updatedAt} IS NOT NULL
            THEN EXTRACT(EPOCH FROM (${orders.updatedAt} - ${orders.createdAt})) / 3600
          END
        ), 0)`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
          inArray(orders.status, ['shipped', 'processing', 'pending', 'completed'])
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
    const [ticket] = await db
      .insert(supportTickets)
      .values(data)
      .returning();

    // Notify admins and managers about the new ticket
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

    const tickets = await db
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
      .orderBy(desc(supportTickets.createdAt));

    // Process each ticket to add responses and assigned user
    const processedTickets = [];

    for (const ticket of tickets) {
      try {
        // Get responses for this ticket
        const responses = await db
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
          .orderBy(asc(supportTicketResponses.createdAt));

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
    if (userData.minPurchaseExempt !== undefined) updateFields.minPurchaseExempt = userData.minPurchaseExempt;
    if (userData.minPurchaseOverride !== undefined) updateFields.minPurchaseOverride = userData.minPurchaseOverride !== null && userData.minPurchaseOverride !== "" ? String(userData.minPurchaseOverride) : null;

    const [user] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      throw new Error("User not found");
    }

    // Log the profile update
    const updatedFields = Object.keys(userData).join(', ');
    await this.logUserActivity(
      id,
      'Profile Updated',
      `User profile updated: ${updatedFields}`,
      { updatedFields: userData }
    );

    return user;
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
}

export const storage = new DatabaseStorage();