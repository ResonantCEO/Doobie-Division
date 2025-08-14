import {
  users,
  categories,
  products,
  orders,
  orderItems,
  inventoryLogs,
  notifications,
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
import { eq, desc, asc, and, or, like, lte, isNull, inArray, sql, exists, ilike } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";

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
  getProducts(filters?: { categoryId?: number; categoryIds?: number[]; search?: string; status?: string }): Promise<(Product & { category: Category | null })[]>;
  getProduct(id: number): Promise<(Product & { category: Category | null }) | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  adjustStock(productId: number, quantity: number, userId: string, reason: string): Promise<void>;
  getLowStockProducts(): Promise<Product[]>;

  // Order operations
  getOrders(filters?: { status?: string; customerId?: string }): Promise<Order[]>;
  getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product | null })[] }) | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order>;
  fulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string): Promise<any>;
  markOrderItemAsPacked(orderId: number, productId: number, userId: string): Promise<any>;

  // Analytics operations
  getSalesMetrics(days: number): Promise<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
  }>;
  getTopProducts(limit: number): Promise<{ product: Product; sales: number; revenue: number }[]>;
  getOrderStatusBreakdown(): Promise<{ status: string; count: number }[]>;

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

  // User activity
  logUserActivity(userId: string, action: string, details: string, metadata?: any): Promise<void>;
  getUserActivity(userId: string, options?: { limit?: number; type?: string }): Promise<any[]>;
  getInventoryLogs(filters?: { days?: number; type?: string; product?: string }): Promise<any[]>;
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
  async getCategories(): Promise<(Category & { children?: Category[] })>;
  async getCategories(): Promise<(Category & { children?: Category[] })[]> {
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
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
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
  }): Promise<(Product & { category: Category | null })>;
  async getProducts(filters?: {
    categoryId?: number;
    categoryIds?: number[];
    search?: string;
    status?: string;
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
        category: categories,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    const conditions = [];

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

  async getProduct(id: number): Promise<(Product & { category: Category | null })>;
  async getProduct(id: number): Promise<(Product & { category: Category | null }) | undefined> {
    const [product] = await db
      .select({
        ...products,
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
      const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));

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

  async getLowStockProducts(): Promise<Product[]>;
  async getLowStockProducts(): Promise<Product[]> {
    const lowStockProducts = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stock: products.stock,
        physicalInventory: products.physicalInventory,
        minStockThreshold: products.minStockThreshold,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(products.isActive, true),
          lte(products.stock, products.minStockThreshold)
        )
      )
      .orderBy(products.stock);

    return lowStockProducts;
  }

  // Order operations
  async getOrders(filters?: { status?: string; customerId?: string }): Promise<Order[]>;
  async getOrders(filters?: { status?: string; customerId?: string }): Promise<Order[]> {
    let query = db.select().from(orders);

    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }
    if (filters?.customerId) {
      conditions.push(eq(orders.customerId, filters.customerId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(orders.createdAt));
  }

  async getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product | null })[] })>;
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

  async createOrder(orderData: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
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

  async updateOrderStatus(id: number, status: string): Promise<Order>;
  async updateOrderStatus(id: number, status: string): Promise<Order> {
    // Get the current order with its items
    const [currentOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));

    if (!currentOrder) {
      throw new Error("Order not found");
    }

    // If changing status to cancelled, restore stock for all unfulfilled items
    if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
      const orderItemsData = await db
        .select({
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          fulfilled: orderItems.fulfilled,
          productName: orderItems.productName
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, id));

      // Process stock restoration for unfulfilled items
      for (const item of orderItemsData) {
        if (!item.fulfilled && item.productId) {
          try {
            // Get current product stock
            const [currentProduct] = await db
              .select({ id: products.id, name: products.name, stock: products.stock })
              .from(products)
              .where(eq(products.id, item.productId));

            if (currentProduct) {
              const previousStock = currentProduct.stock;
              const newStock = previousStock + item.quantity;

              // Update product stock (restore stock only, physical inventory wasn't changed)
              await db
                .update(products)
                .set({
                  stock: newStock,
                  updatedAt: new Date()
                })
                .where(eq(products.id, item.productId));

              // Log the inventory restoration
              await db.insert(inventoryLogs).values({
                productId: item.productId,
                type: 'stock_in',
                quantity: item.quantity,
                previousStock: previousStock,
                newStock: newStock,
                reason: `Order cancellation - Order #${currentOrder.orderNumber}`,
                userId: null // System operation
              });

              console.log(`Restored ${item.quantity} units of ${currentProduct.name} (Product ID: ${item.productId})`);
            }
          } catch (error) {
            console.error(`Error restoring stock for product ${item.productId}:`, error);
            // Continue with other items instead of failing the entire operation
          }
        }
      }
    }

    // Update the order status
    const [updated] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update order status");
    }

    return updated;
  }

  async fulfillOrderItem(orderId: number, productId: number, quantity: number, userId: string) {
    // Reduce physical inventory (stock is already reduced when order was placed)
    await db
      .update(products)
      .set({
        physicalInventory: sql`${products.physicalInventory} - ${quantity}`,
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    // Mark order item as fulfilled
    await db
      .update(orderItems)
      .set({ fulfilled: true })
      .where(and(
        eq(orderItems.orderId, orderId),
        eq(orderItems.productId, productId)
      ));

    // Log the inventory adjustment
    await db.insert(inventoryLogs).values({
      productId,
      userId,
      type: 'adjustment',
      quantity: -quantity,
      reason: `Order fulfillment - Order #${orderId}`,
      createdAt: new Date()
    });

    // Check if all items in the order are fulfilled
    const orderItemsResult = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const allFulfilled = orderItemsResult.every(item => item.fulfilled);

    // If all items are fulfilled, update order status to shipped
    if (allFulfilled) {
      await db
        .update(orders)
        .set({
          status: 'shipped',
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId));
    }

    return { success: true, allFulfilled };
  }

  async markOrderItemAsPacked(orderId: number, productId: number, userId: string) {
    // Get current product stock for logging
    const [product] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw new Error("Product not found");
    }

    // Mark order item as packed (fulfilled) without reducing physical inventory
    await db
      .update(orderItems)
      .set({ fulfilled: true })
      .where(and(
        eq(orderItems.orderId, orderId),
        eq(orderItems.productId, productId)
      ));

    // Log the packing activity with current stock values (no change in stock for packing)
    await db.insert(inventoryLogs).values({
      productId,
      userId,
      type: 'packing',
      quantity: 0, // No inventory change for packing
      previousStock: product.stock,
      newStock: product.stock, // Stock remains the same for packing
      reason: `Order item packed - Order #${orderId}`,
      createdAt: new Date()
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

  // Analytics operations
  async getSalesMetrics(days: number): Promise<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
  }>;
  async getSalesMetrics(days: number): Promise<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [metrics] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${orders.total} AS NUMERIC)), 0)`,
        totalOrders: sql<number>`COUNT(*)`,
        averageOrderValue: sql<number>`COALESCE(AVG(CAST(${orders.total} AS NUMERIC)), 0)`,
      })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${startDate}`);

    return {
      totalSales: Number(metrics.totalSales),
      totalOrders: Number(metrics.totalOrders),
      averageOrderValue: Number(metrics.averageOrderValue),
    };
  }

  async getTopProducts(limit: number): Promise<{ product: Product; sales: number; revenue: number }[]>;
  async getTopProducts(limit: number): Promise<{ product: Product; sales: number; revenue: number }[]> {
    const results = await db
      .select({
        product: products,
        sales: sql<number>`SUM(${orderItems.quantity})`,
        revenue: sql<number>`SUM(CAST(${orderItems.subtotal} AS NUMERIC))`,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .groupBy(products.id)
      .orderBy(desc(sql`SUM(CAST(${orderItems.subtotal} AS NUMERIC))`))
      .limit(limit);

    return results.map(r => ({
      product: r.product,
      sales: Number(r.sales),
      revenue: Number(r.revenue),
    }));
  }

  async getOrderStatusBreakdown(): Promise<{ status: string; count: number }[]>;
  async getOrderStatusBreakdown(): Promise<{ status: string; count: number }[]> {
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
  }

  // Notification operations
  async getNotifications(userId?: string): Promise<Notification[]>;
  async getNotifications(userId?: string): Promise<Notification[]> {
    let query = db.select().from(notifications);

    if (userId) {
      query = query.where(eq(notifications.userId, userId));
    }

    return await query.orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification>;
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<void>;
  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  // User management
  async getUsersWithStats(): Promise<(User & { orderCount?: number })>;
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

  async updateUserStatus(id: string, status: string): Promise<User>;
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

  async updateUserRole(id: string, role: string): Promise<User>;
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

  async updateUserIdVerification(id: string, status: string): Promise<User>;
  async updateUserIdVerification(id: string, status: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ idVerificationStatus: status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async getUsersPendingVerification(): Promise<User[]>;
  async getUsersPendingVerification(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.idVerificationStatus, 'pending'))
      .orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, userData: any): Promise<User>;
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

  async getInventoryLogs(filters?: { days?: number; type?: string; product?: string }): Promise<any[]>;
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

  async logUserActivity(userId: string, action: string, details: string, metadata?: any): Promise<void>;
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

  async getUserActivity(userId: string, options: { limit?: number; type?: string } = {}): Promise<any[]>;
  async getUserActivity(userId: string, options: { limit?: number; type?: string } = {}): Promise<any[]> {
    try {
      const { limit = 50 } = options;

      // Get user activity logs (if any exist)
      const activityLogs = await db
        .select({
          id: inventoryLogs.id,
          action: inventoryLogs.reason,
          details: inventoryLogs.notes,
          metadata: inventoryLogs.metadata,
          timestamp: inventoryLogs.createdAt,
          type: inventoryLogs.type
        })
        .from(inventoryLogs)
        .where(and(
          eq(inventoryLogs.userId, userId),
          eq(inventoryLogs.type, 'user_activity')
        ))
        .orderBy(desc(inventoryLogs.createdAt))
        .limit(limit);

      // Get order-related activities
      const orderActivities = await db
        .select({
          id: orders.id,
          action: sql<string>`'Order placed'`,
          details: sql<string>`CONCAT('Order #', ${orders.orderNumber}, ' - $', CAST(${orders.total} AS VARCHAR))`,
          metadata: sql<string>`NULL`,
          timestamp: orders.createdAt,
          type: sql<string>`'order'`
        })
        .from(orders)
        .where(eq(orders.customerId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(10);

      // Combine and sort by timestamp
      const allActivity = [...activityLogs, ...orderActivities]
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