import {
  users,
  categories,
  products,
  orders,
  orderItems,
  inventoryLogs,
  notifications,
  supportTickets,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
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
import { eq, sql, desc, and, gte, lt, inArray, or, ne, asc, ilike, exists, lte, isNull, like, gt, alias } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { queryCache, categoriesCache, productsCache, analyticsCache, generateCacheKey, invalidateCache, withCache } from "./cache";

// Create alias for assigned user joins
const assignedUser = alias(users, 'assigned_user');
const assignedUserTable = alias(users, 'assignedUser');

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
  getProducts(filters?: { categoryId?: number; categoryIds?: number[]; search?: string; status?: string; isActive?: boolean }): Promise<(Product & { category: Category | null })[]>;
  getProduct(id: number): Promise<(Product & { category: Category | null }) | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  adjustStock(productId: number, quantity: number, userId: string, reason: string): Promise<void>;
  getLowStockProducts(): Promise<Product[]>;

  // Order operations
  getOrders(filters?: { status?: string; statuses?: string[]; customerId?: string; assignedUserId?: string; hideOldDelivered?: boolean }): Promise<Order[]>;
  getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product | null })[] }) | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order>;
  fulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string): Promise<void>;
  markOrderItemAsPacked(orderId: number, productId: number, userId: string): Promise<{ success: boolean; allPacked: boolean }>;
  assignOrderToUser(orderId: number, assignedUserId: string): Promise<Order>;

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

  // Notification operations
  getNotifications(userId?: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<void>;

  // User management
  getUsersWithStats(): Promise<(User & { orderCount?: number })[]>;
  updateUserStatus(id: string, status: string): Promise<User>;
  updateUserRole(id: string, role: string): Promise<User>;
  updateUserIdVerification(id: string, status: string): Promise<User>;
  getUsersPendingVerification(): Promise<User[]>;
  updateUser(id: string, userData: any): Promise<User>;
  getStaffUsers(): Promise<User[]>;
  getUsersWithRole(role: string): Promise<User[]>;

  // User activity
  logUserActivity(userId: string, action: string, details: string, metadata?: any): Promise<void>;
  getUserActivity(userId: string, options?: { limit?: number; type?: string }): Promise<any[]>;
  getInventoryLogs(filters?: { days?: number; type?: string; product?: string }): Promise<any[]>;

  // Support ticket operations
  createSupportTicket(data: any): Promise<any>;
  getSupportTickets(filters?: any): Promise<any[]>;
  updateSupportTicketStatus(id: number, status: string): Promise<any>;
  assignSupportTicket(id: number, assignedTo: string | null): Promise<any>;
}

export class DatabaseStorage implements IStorage {
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
      return newUser;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    return result[0];
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id));
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
      .set({ ...updates, updatedAt: new Date() })
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
  }): Promise<(Product & { category: Category | null })[]> {
    let query = db
      .select({
        id: products.id,
        name: products.name,
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
      conditions.push(sql`${products.stock} <= ${products.minStockThreshold}`);
    } else if (filters?.status === 'out_of_stock') {
      conditions.push(eq(products.stock, 0));
    } else if (filters?.status === 'in_stock') {
      conditions.push(sql`${products.stock} > ${products.minStockThreshold}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<(Product & { category: Category | null }) | undefined> {
    const [product] = await db
      .select({
        id: products.id,
        name: products.name,
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
        category: categories,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id));
    return product;
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const processedProduct = {
      ...productData,
      pricePerGram: productData.pricePerGram ? (typeof productData.pricePerGram === 'string' ? parseFloat(productData.pricePerGram) : productData.pricePerGram) : null,
      pricePerOunce: productData.pricePerOunce ? (typeof productData.pricePerOunce === 'string' ? parseFloat(productData.pricePerOunce) : productData.pricePerOunce) : null,
      physicalInventory: productData.stock || 0, // Set physical inventory to match initial stock
      updatedAt: new Date()
    };

    const [newProduct] = await db
      .insert(products)
      .values(processedProduct)
      .returning();
    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product> {
    // If stock is being updated, also update physical inventory to match
    const updateData = { ...productData };
    if (productData.stock !== undefined) {
      updateData.physicalInventory = productData.stock;
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

    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    // Check if product is referenced in any order items from pending or processing orders
    const orderItemsInActiveOrders = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.productId, id),
          or(
            eq(orders.status, 'pending'),
            eq(orders.status, 'processing')
          )
        )
      );

    if (Number(orderItemsInActiveOrders[0].count) > 0) {
      throw new Error("Cannot delete product. It is referenced in pending or processing orders.");
    }

    // For order items in non-active orders (cancelled, completed, shipped),
    // set product_id to null to preserve order history while allowing product deletion
    await db
      .update(orderItems)
      .set({ productId: null })
      .where(
        and(
          eq(orderItems.productId, id),
          exists(
            db
              .select({ id: orders.id })
              .from(orders)
              .where(
                and(
                  eq(orders.id, orderItems.orderId),
                  or(
                    eq(orders.status, 'cancelled'),
                    eq(orders.status, 'completed'),
                    eq(orders.status, 'shipped')
                  )
                )
              )
          )
        )
      );

    // Delete related inventory logs
    await db.delete(inventoryLogs).where(eq(inventoryLogs.productId, id));

    // Now delete the product
    await db.delete(products).where(eq(products.id, id));
  }

  async adjustStock(productId: number, quantity: number, userId: string, reason: string): Promise<void> {
    // Validate inputs
    if (!productId || typeof productId !== 'number') {
      throw new Error("Invalid product ID");
    }
    if (typeof quantity !== 'number') {
      throw new Error("Invalid quantity");
    }
    if (!reason || typeof reason !== 'string') {
      throw new Error("Reason is required");
    }

    // Get the product directly from the products table
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw new Error("Product not found");
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }

    // Update product stock and physical inventory
    await db.update(products)
      .set({
        stock: newStock,
        physicalInventory: newStock, // Update physical inventory to match new stock
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    // Log the inventory change
    await db.insert(inventoryLogs).values({
      productId,
      type: quantity > 0 ? 'stock_in' : 'stock_out',
      quantity: Math.abs(quantity),
      previousStock: product.stock,
      newStock,
      reason,
      userId
    });

    // Check if product needs low stock notification
    if (newStock <= product.minStockThreshold && product.stock > product.minStockThreshold) {
      // Get all admin users for notification
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

  async getLowStockProducts(): Promise<Product[]> {
    const lowStockProducts = await db
      .select({
        id: products.id,
        name: products.name,
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
          assignedUser: {
            id: assignedUser.id,
            firstName: assignedUser.firstName,
            lastName: assignedUser.lastName,
            email: assignedUser.email,
          },
        })
        .from(orders)
        .leftJoin(assignedUser, eq(orders.assignedUserId, assignedUser.id));

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

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const result = await query.orderBy(desc(orders.createdAt));

      return result.map(row => ({
        ...row,
        assignedUser: row.assignedUser && row.assignedUser.id ? row.assignedUser : null
      }));
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  async getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product | null })[] }) | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await db
      .select({
        ...orderItems,
        product: products,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id));

    return { ...order, items };
  }

  async createOrder(orderData: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    // Generate date-based order number (MMDDYY-N)
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const datePrefix = `${month}${day}${year}`;

    // Find the highest sequential number for today
    const todayOrders = await db
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(sql`${orders.orderNumber} LIKE ${datePrefix + '-%'}`);

    let nextSequential = 1;
    if (todayOrders.length > 0) {
      const sequentialNumbers = todayOrders
        .map(order => {
          const parts = order.orderNumber.split('-');
          return parts.length === 2 ? parseInt(parts[1]) : 0;
        })
        .filter(num => !isNaN(num));

      if (sequentialNumbers.length > 0) {
        nextSequential = Math.max(...sequentialNumbers) + 1;
      }
    }

    const orderNumber = `${datePrefix}-${nextSequential}`;

    // Double-check stock availability
    for (const item of items) {
      const [product] = await db
        .select({ stock: products.stock, name: products.name })
        .from(products)
        .where(eq(products.id, item.productId));

      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
    }

    // Create the order
    const [order] = await db.insert(orders).values({
      ...orderData,
      orderNumber,
    }).returning();

    // Create order items
    const orderItemsData = items.map(item => ({
      ...item,
      orderId: order.id,
    }));

    await db.insert(orderItems).values(orderItemsData);

    // Reduce stock for each item (but keep physical inventory unchanged until fulfillment)
    for (const item of items) {
      await db.update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          updatedAt: new Date()
        })
        .where(eq(products.id, item.productId));
    }

    // Get the complete order with items
    const fullOrder = await this.getOrder(order.id);
    return fullOrder!;
  }

  async updateOrderStatus(orderId: number, status: string): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updatedOrder) {
      throw new Error("Order not found");
    }

    return updatedOrder;
  }

  async fulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string): Promise<void> {
    // Get the product
    const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (product.length === 0) {
      throw new Error("Product not found");
    }

    const currentStock = product[0].stock;
    const currentPhysicalInventory = product[0].physicalInventory || 0;
    const newStock = currentStock - quantity;
    const newPhysicalInventory = currentPhysicalInventory - quantity;

    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }

    if (newPhysicalInventory < 0) {
      throw new Error("Insufficient physical inventory");
    }

    // Update product stock, physical inventory and mark order item as fulfilled
    await db.transaction(async (tx) => {
      // Update product stock and physical inventory
      await tx
        .update(products)
        .set({
          stock: newStock,
          physicalInventory: newPhysicalInventory,
          updatedAt: new Date()
        })
        .where(eq(products.id, productId));

      // Mark order item as fulfilled
      await tx
        .update(orderItems)
        .set({ fulfilled: true })
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)));

      // Log the stock change
      await tx.insert(inventoryLogs).values({
        productId,
        userId,
        type: 'stock_out',
        quantity: -quantity,
        previousStock: currentStock,
        newStock: newStock,
        reason: `Order fulfillment - Order #${orderId} (Stock and physical inventory reduced)`,
        createdAt: new Date()
      });
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
    const [updatedOrder] = await db
      .update(orders)
      .set({
        assignedUserId,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updatedOrder) {
      throw new Error("Order not found");
    }

    return updatedOrder;
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
            or(
              eq(orders.status, 'shipped'),
              eq(orders.status, 'processing'),
              eq(orders.status, 'pending')
            )
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
          or(
            eq(orders.status, 'shipped'),
            eq(orders.status, 'processing'),
            eq(orders.status, 'pending')
          )
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
      const results = await db
        .select({
          status: orders.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .groupBy(orders.status);

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
            or(
              eq(orders.status, 'shipped'),
              eq(orders.status, 'processing'),
              eq(orders.status, 'pending')
            )
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
          or(
            eq(orders.status, 'shipped'),
            eq(orders.status, 'processing'),
            eq(orders.status, 'pending')
          )
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
          or(
            eq(orders.status, 'shipped'),
            eq(orders.status, 'processing'),
            eq(orders.status, 'pending')
          )
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
          or(
            eq(orders.status, 'shipped'),
            eq(orders.status, 'processing'),
            eq(orders.status, 'pending')
          )
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

    // Calculate metrics
    const netProfit = currentSales * 0.3; // Assuming 30% profit margin
    const salesGrowthRate = prevSales > 0 ? ((currentSales - prevSales) / prevSales) * 100 : 0;
    const returnRate = currentOrders > 0 ? (cancelledOrders / currentOrders) * 100 : 0;
    const abandonedCartRate = 25.5; // Mock data - would need cart tracking implementation

    return {
      netProfit,
      salesGrowthRate,
      returnRate,
      abandonedCartRate,
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

  // Notification operations
  async getNotifications(userId?: string): Promise<Notification[]> {
    let query = db.select().from(notifications);

    if (userId) {
      query = query.where(eq(notifications.userId, userId));
    }

    return await query.orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  // User management
  async getUsersWithStats(): Promise<(User & { orderCount?: number })[]> {
    const results = await db
      .select({
        ...users,
        orderCount: sql<number>`COUNT(${orders.id})`,
      })
      .from(users)
      .leftJoin(orders, eq(users.id, orders.customerId))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt));

    return results.map(r => ({
      ...r,
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

    return db
      .select({
        ticket: supportTickets,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        assignedUser: {
          id: assignedUserTable.id,
          firstName: assignedUserTable.firstName,
          lastName: assignedUserTable.lastName,
          email: assignedUserTable.email,
        },
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .leftJoin(assignedUserTable, eq(supportTickets.assignedTo, assignedUserTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt));
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
    return ticket;
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

  async updateUser(id: string, userData: any): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        updatedAt: new Date()
      })
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
        ...inventoryLogs,
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(inventoryLogs.createdAt));
  }

  async logUserActivity(userId: string, action: string, details: string, metadata?: any): Promise<void> {
    try {
      // For now, we'll use the inventory_logs table to store user activity
      // In a production system, you'd want a dedicated user_activity_logs table
      await db.insert(inventoryLogs).values({
        productId: null,
        userId: userId,
        type: 'user_activity',
        quantity: 0,
        previousStock: 0, // Set default value to avoid null constraint
        newStock: 0, // Set default value to avoid null constraint
        reason: action,
        notes: details,
        metadata: metadata ? JSON.stringify(metadata) : null
      });
    } catch (error) {
      console.error('Error logging user activity:', error);
      // Don't throw here as this shouldn't break the main operation
    }
  }

  async getUserActivity(userId: string, options: { limit?: number; type?: string } = {}): Promise<any[]> {
    try {
      const { limit = 50, type } = options;

      // Get inventory activity with proper null handling
      const inventoryActivity = await db
        .select({
          id: inventoryLogs.id,
          type: inventoryLogs.type,
          action: inventoryLogs.reason,
          details: inventoryLogs.quantity,
          timestamp: inventoryLogs.createdAt,
          productName: sql<string | null>`${products.name}`,
          productSku: sql<string | null>`${products.sku}`,
        })
        .from(inventoryLogs)
        .leftJoin(products, eq(inventoryLogs.productId, products.id))
        .where(eq(inventoryLogs.userId, userId))
        .orderBy(desc(inventoryLogs.createdAt))
        .limit(limit);

      // Get order activity
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
          productName: sql<string | null>`NULL`,
          productSku: sql<string | null>`NULL`,
        })
        .from(orders)
        .where(eq(orders.customerId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(limit);

      // Combine and sort all activities with proper null handling
      const allActivity = [...inventoryActivity, ...orderActivity]
        .map(activity => ({
          ...activity,
          productName: activity.productName || null,
          productSku: activity.productSku || null,
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      return allActivity;
    } catch (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();