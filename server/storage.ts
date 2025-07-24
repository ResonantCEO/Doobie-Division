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
import { eq, desc, and, lt, sql, ilike, or } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Category operations
  getCategories(): Promise<(Category & { children?: Category[] })[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Product operations
  getProducts(filters?: { categoryId?: number; search?: string; status?: string }): Promise<(Product & { category: Category | null })[]>;
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
    let role = 'user';

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

  // Product operations
  async getProducts(filters?: { categoryId?: number; search?: string; status?: string }): Promise<(Product & { category: Category | null })[]> {
    let query = db
      .select({
        ...products,
        category: categories,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    const conditions = [];

    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.description, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`)
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
        ...products,
        category: categories,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product> {
    const [updated] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async adjustStock(productId: number, quantity: number, userId: string, reason: string): Promise<void> {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) throw new Error("Product not found");

    const previousStock = product.stock;
    const newStock = previousStock + quantity;

    // Update product stock
    await db
      .update(products)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(products.id, productId));

    // Log the inventory change
    await db.insert(inventoryLogs).values({
      productId,
      type: quantity > 0 ? 'stock_in' : quantity < 0 ? 'stock_out' : 'adjustment',
      quantity: Math.abs(quantity),
      previousStock,
      newStock,
      reason,
      userId,
    });

    // Check if product needs low stock notification
    if (newStock <= product.minStockThreshold && previousStock > product.minStockThreshold) {
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

  async getLowStockProducts(): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(sql`${products.stock} <= ${products.minStockThreshold}`)
      .orderBy(products.stock);
  }

  // Order operations
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

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const [newOrder] = await db
      .insert(orders)
      .values({ ...order, orderNumber })
      .returning();

    // Insert order items
    const orderItemsWithOrderId = items.map(item => ({ ...item, orderId: newOrder.id }));
    await db.insert(orderItems).values(orderItemsWithOrderId);

    // Update product stock
    for (const item of items) {
      if (item.productId) {
        await this.adjustStock(item.productId, -item.quantity, newOrder.customerId || 'system', `Order ${orderNumber}`);
      }
    }

    // Notify admins of new order
    const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
    for (const admin of adminUsers) {
      await this.createNotification({
        userId: admin.id,
        type: 'order_received',
        title: 'New Order Received',
        message: `Order ${orderNumber} has been placed by ${order.customerName}`,
        data: { orderId: newOrder.id, orderNumber, total: order.total },
      });
    }

    return newOrder;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  // Analytics operations
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
    const [updated] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
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
    return await db
      .select()
      .from(users)
      .where(eq(users.idVerificationStatus, 'pending'))
      .orderBy(desc(users.createdAt));
  }
}

export const storage = new DatabaseStorage();
import { db } from "./db";
import { categories, products, orders, orderItems, users, notifications, inventoryLogs } from "@shared/schema";
import { eq, desc, asc, sql, and, or, like, count, sum } from "drizzle-orm";
import { nanoid } from "nanoid";

export const storage = {
  // Category operations
  async getCategories() {
    try {
      return await db.select().from(categories).orderBy(asc(categories.name));
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  },

  async createCategory(categoryData: any) {
    try {
      const [category] = await db.insert(categories).values(categoryData).returning();
      return category;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  },

  async updateCategory(id: number, categoryData: any) {
    try {
      const [category] = await db
        .update(categories)
        .set({ ...categoryData, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning();
      return category;
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  },

  async deleteCategory(id: number) {
    try {
      // Check if category has products
      const productCount = await db
        .select({ count: count() })
        .from(products)
        .where(eq(products.categoryId, id));
      
      if (productCount[0].count > 0) {
        throw new Error("Cannot delete category with existing products");
      }
      
      await db.delete(categories).where(eq(categories.id, id));
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  },

  // Product operations
  async getProducts(filters: any = {}) {
    try {
      let query = db.select().from(products);
      
      if (filters.categoryId) {
        query = query.where(eq(products.categoryId, filters.categoryId));
      }
      
      if (filters.search) {
        query = query.where(
          or(
            like(products.name, `%${filters.search}%`),
            like(products.description, `%${filters.search}%`)
          )
        );
      }
      
      if (filters.status) {
        query = query.where(eq(products.isActive, filters.status === 'active'));
      }
      
      return await query.orderBy(asc(products.name));
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  },

  async getProduct(id: number) {
    try {
      const [product] = await db.select().from(products).where(eq(products.id, id));
      return product;
    } catch (error) {
      console.error("Error fetching product:", error);
      throw error;
    }
  },

  async createProduct(productData: any) {
    try {
      const [product] = await db.insert(products).values(productData).returning();
      return product;
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  },

  async updateProduct(id: number, productData: any) {
    try {
      const [product] = await db
        .update(products)
        .set({ ...productData, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      return product;
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  },

  async deleteProduct(id: number) {
    try {
      await db.delete(products).where(eq(products.id, id));
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  },

  async adjustStock(productId: number, quantity: number, userId: string, reason: string) {
    try {
      const [product] = await db.select().from(products).where(eq(products.id, productId));
      if (!product) throw new Error("Product not found");
      
      const previousStock = product.stock;
      const newStock = previousStock + quantity;
      
      await db.transaction(async (trx) => {
        await trx
          .update(products)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(products.id, productId));
        
        await trx.insert(inventoryLogs).values({
          productId,
          type: quantity > 0 ? 'adjustment_in' : 'adjustment_out',
          quantity: Math.abs(quantity),
          previousStock,
          newStock,
          reason,
          userId,
        });
      });
    } catch (error) {
      console.error("Error adjusting stock:", error);
      throw error;
    }
  },

  async getLowStockProducts() {
    try {
      return await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.isActive, true),
            sql`${products.stock} <= ${products.minStockThreshold}`
          )
        )
        .orderBy(asc(products.stock));
    } catch (error) {
      console.error("Error fetching low stock products:", error);
      throw error;
    }
  },

  // Order operations
  async getOrders(filters: any = {}) {
    try {
      let query = db.select().from(orders);
      
      if (filters.status) {
        query = query.where(eq(orders.status, filters.status));
      }
      
      if (filters.customerId) {
        query = query.where(eq(orders.customerId, filters.customerId));
      }
      
      return await query.orderBy(desc(orders.createdAt));
    } catch (error) {
      console.error("Error fetching orders:", error);
      throw error;
    }
  },

  async getOrder(id: number) {
    try {
      const [order] = await db.select().from(orders).where(eq(orders.id, id));
      if (!order) return null;
      
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
      
      return { ...order, items };
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error;
    }
  },

  async createOrder(orderData: any, itemsData: any[]) {
    try {
      return await db.transaction(async (trx) => {
        const orderNumber = `ORD-${Date.now()}-${nanoid(6).toUpperCase()}`;
        
        const [order] = await trx
          .insert(orders)
          .values({ ...orderData, orderNumber })
          .returning();
        
        for (const item of itemsData) {
          await trx.insert(orderItems).values({
            ...item,
            orderId: order.id,
          });
          
          // Update product stock
          await trx
            .update(products)
            .set({
              stock: sql`${products.stock} - ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));
        }
        
        return order;
      });
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  },

  async updateOrderStatus(id: number, status: string) {
    try {
      const [order] = await db
        .update(orders)
        .set({ status, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning();
      return order;
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  },

  // User operations
  async getUser(id: string) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error;
    }
  },

  async getUserByEmail(email: string) {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Error fetching user by email:", error);
      throw error;
    }
  },

  async getUserCount() {
    try {
      const [result] = await db.select({ count: count() }).from(users);
      return result.count;
    } catch (error) {
      console.error("Error getting user count:", error);
      throw error;
    }
  },

  async createUserWithPassword(userData: any) {
    try {
      const [user] = await db.insert(users).values(userData).returning();
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  },

  async getUsersWithStats() {
    try {
      return await db.select().from(users).orderBy(desc(users.createdAt));
    } catch (error) {
      console.error("Error fetching users with stats:", error);
      throw error;
    }
  },

  async updateUserStatus(id: string, status: string) {
    try {
      const [user] = await db
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user;
    } catch (error) {
      console.error("Error updating user status:", error);
      throw error;
    }
  },

  async updateUserRole(id: string, role: string) {
    try {
      const [user] = await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user;
    } catch (error) {
      console.error("Error updating user role:", error);
      throw error;
    }
  },

  async updateUserIdVerification(id: string, status: string) {
    try {
      const [user] = await db
        .update(users)
        .set({ idVerificationStatus: status, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user;
    } catch (error) {
      console.error("Error updating ID verification:", error);
      throw error;
    }
  },

  async getUsersPendingVerification() {
    try {
      return await db
        .select()
        .from(users)
        .where(eq(users.idVerificationStatus, 'pending'))
        .orderBy(desc(users.createdAt));
    } catch (error) {
      console.error("Error fetching pending verifications:", error);
      throw error;
    }
  },

  // Notification operations
  async getNotifications(userId: string) {
    try {
      return await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw error;
    }
  },

  async markNotificationAsRead(id: number) {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  },

  // Analytics operations
  async getSalesMetrics(days: number) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const totalOrders = await db
        .select({ count: count() })
        .from(orders)
        .where(sql`${orders.createdAt} >= ${startDate}`);
      
      const totalRevenue = await db
        .select({ total: sum(orders.total) })
        .from(orders)
        .where(
          and(
            sql`${orders.createdAt} >= ${startDate}`,
            eq(orders.status, 'completed')
          )
        );
      
      return {
        totalOrders: totalOrders[0].count,
        totalRevenue: totalRevenue[0].total || 0,
      };
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
      throw error;
    }
  },

  async getTopProducts(limit: number) {
    try {
      return await db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          totalQuantity: sum(orderItems.quantity),
          totalRevenue: sum(orderItems.subtotal),
        })
        .from(orderItems)
        .groupBy(orderItems.productId, orderItems.productName)
        .orderBy(desc(sum(orderItems.quantity)))
        .limit(limit);
    } catch (error) {
      console.error("Error fetching top products:", error);
      throw error;
    }
  },

  async getOrderStatusBreakdown() {
    try {
      return await db
        .select({
          status: orders.status,
          count: count(),
        })
        .from(orders)
        .groupBy(orders.status);
    } catch (error) {
      console.error("Error fetching order status breakdown:", error);
      throw error;
    }
  },
};
