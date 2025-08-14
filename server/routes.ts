import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import QRCode from "qrcode";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertProductSchema, insertCategorySchema, insertOrderSchema, insertOrderItemSchema } from "@shared/schema";
import { z } from "zod";

// Role-based middleware
const requireRole = (roles: string[]) => {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.currentUser || !roles.includes(req.currentUser.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Authorization error" });
    }
  };
};

// Configure multer for image uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'product-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Static file serving for uploaded images
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Auth middleware
  await setupAuth(app);

  // Image upload endpoint
  app.post('/api/upload/product-image', isAuthenticated, requireRole(['admin', 'manager']), upload.single('image'), (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      const imageUrl = `/uploads/product-images/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (error) {
      res.status(500).json({ message: 'Failed to upload image' });
    }
  });

  // Auth routes are handled in setupAuth

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put('/api/categories/:id', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, categoryData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/categories/:id', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete category" });
    }
  });

  // Product routes
  app.get('/api/products', async (req, res) => {
    try {
      const { categoryId, categoryIds, search, status } = req.query;
      const filters: any = {};

      if (categoryIds) {
        // Handle multiple category IDs
        const ids = (categoryIds as string).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (ids.length > 0) {
          filters.categoryIds = ids;
        }
      } else if (categoryId) {
        filters.categoryId = parseInt(categoryId as string);
      }

      if (search) filters.search = search as string;
      if (status) filters.status = status as string;

      console.log('Product query filters:', filters);
      const products = await storage.getProducts(filters);
      console.log(`Found ${products.length} products`);
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post('/api/products', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error('Product creation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }

      // Check for duplicate SKU constraint violation
      if (error instanceof Error && (
        error.message.includes('duplicate key value violates unique constraint') ||
        error.message.includes('UNIQUE constraint failed') ||
        error.message.includes('sku') && error.message.includes('unique')
      )) {
        return res.status(400).json({ 
          message: "duplicate key value violates unique constraint \"products_sku_unique\"" 
        });
      }

      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put('/api/products/:id', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, productData);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Check if product exists first
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      await storage.deleteProduct(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete product error:', error);

      // Check for foreign key constraint errors
      if (error instanceof Error && error.message.includes('foreign key')) {
        return res.status(409).json({ 
          message: "Cannot delete product. It may be referenced in orders or other records." 
        });
      }

      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete product" 
      });
    }
  });

  // Stock adjustment route
  app.post('/api/products/:id/adjust-stock', isAuthenticated, requireRole(['admin', 'manager']), async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { quantity, reason } = req.body;

      // Validate productId
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      // Validate quantity and reason
      if (typeof quantity !== 'number' || !reason || typeof reason !== 'string') {
        return res.status(400).json({ message: "Valid quantity and reason are required" });
      }

      console.log(`Adjusting stock for product ${productId}: ${quantity} units, reason: ${reason}`);
      
      await storage.adjustStock(productId, quantity, req.currentUser.id, reason);
      res.status(200).json({ message: "Stock adjusted successfully" });
    } catch (error) {
      console.error("Stock adjustment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to adjust stock";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Bulk stock adjustment route for scanner operations
  app.post('/api/products/bulk-adjust-stock', isAuthenticated, requireRole(['admin', 'manager']), async (req: any, res) => {
    try {
      const { adjustments } = req.body;

      if (!adjustments || !Array.isArray(adjustments)) {
        return res.status(400).json({ message: "Adjustments array is required" });
      }

      const results = [];
      for (const adjustment of adjustments) {
        const { productId, quantity, reason } = adjustment;

        if (typeof productId !== 'number' || typeof quantity !== 'number' || !reason) {
          results.push({ productId, success: false, error: "Invalid adjustment data" });
          continue;
        }

        try {
          await storage.adjustStock(productId, quantity, req.currentUser.id, reason);
          results.push({ productId, success: true });
        } catch (error) {
          results.push({ productId, success: false, error: "Failed to adjust stock" });
        }
      }

      res.status(200).json({ results });
    } catch (error) {
      res.status(500).json({ message: "Failed to process bulk adjustments" });
    }
  });

  // Low stock products
  app.get('/api/products/low-stock', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const products = await storage.getLowStockProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch low stock products" });
    }
  });

  // QR Code generation routes
  app.get('/api/products/:id/qr-code', isAuthenticated, requireRole(['admin', 'manager', 'customer']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Create QR code data with just the SKU for scanner compatibility
      const qrData = product.sku;

      // Generate QR code as base64 data URL
      const qrCodeUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      res.json({ 
        qrCode: qrCodeUrl,
        product: {
          id: product.id,
          sku: product.sku,
          name: product.name
        }
      });
    } catch (error) {
      console.error('QR Code generation error:', error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.post('/api/products/generate-qr-codes', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const { productIds } = req.body;

      if (!productIds || !Array.isArray(productIds)) {
        return res.status(400).json({ message: "Product IDs array is required" });
      }

      const qrCodes = [];

      for (const id of productIds) {
        const product = await storage.getProduct(id);
        if (product) {
          const qrData = product.sku;

          const qrCodeUrl = await QRCode.toDataURL(qrData, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });

          qrCodes.push({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            qrCode: qrCodeUrl
          });
        }
      }

      res.json({ qrCodes });
    } catch (error) {
      console.error('Bulk QR Code generation error:', error);
      res.status(500).json({ message: "Failed to generate QR codes" });
    }
  });

  // Order routes
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.query;
      const filters: any = {};

      if (status) {
        // Handle multiple statuses separated by comma
        if (status.includes(',')) {
          filters.statuses = status.split(',').map((s: string) => s.trim());
        } else {
          filters.status = status as string;
        }
      }

      // Regular customers can only see their own orders
      if (req.currentUser.role === 'customer') {
        filters.customerId = req.currentUser.id;
      }

      const orders = await storage.getOrders(filters);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Regular customers can only see their own orders
      if (req.currentUser.role === 'customer' && order.customerId !== req.currentUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const { order, items } = req.body;

      console.log('Order data received:', JSON.stringify(order, null, 2));
      console.log('Items data received:', JSON.stringify(items, null, 2));

      const orderData = insertOrderSchema.parse(order);

      // Validate stock availability and enrich items with product SKU data
      const enrichedItems = [];
      const stockErrors = [];

      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          stockErrors.push(`Product with ID ${item.productId} not found`);
          continue;
        }

        // Check if there's enough stock
        if (product.stock < item.quantity) {
          stockErrors.push(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
          continue;
        }

        enrichedItems.push({
          ...item,
          productSku: product.sku
        });
      }

      // If there are stock errors, reject the order
      if (stockErrors.length > 0) {
        return res.status(400).json({ 
          message: "Order cannot be processed due to stock issues",
          errors: stockErrors
        });
      }

      const itemsData = enrichedItems.map((item: any) => insertOrderItemSchema.parse(item));

      const newOrder = await storage.createOrder(orderData, itemsData);
      res.status(201).json(newOrder);
    } catch (error) {
      console.error('Order creation error:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
        return res.status(400).json({ message: "Invalid order data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create order", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put('/api/orders/:id/status', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const order = await storage.updateOrderStatus(id, status);
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Order item packing route (marks as packed without reducing physical inventory)
  app.post('/api/orders/:id/pack-item', isAuthenticated, requireRole(['admin', 'manager']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      // Get the order and verify it exists
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order is in a packable status
      if (!['pending', 'processing'].includes(order.status)) {
        return res.status(400).json({ message: "Order cannot be packed in its current status" });
      }

      // Verify the product is part of this order
      const orderItem = order.items?.find(item => item.productId === productId);
      if (!orderItem) {
        return res.status(400).json({ message: "Product is not part of this order" });
      }

      if (orderItem.fulfilled) {
        return res.status(400).json({ message: "This order item has already been packed" });
      }

      // Mark the item as packed (fulfilled)
      await storage.markOrderItemAsPacked(orderId, productId, req.currentUser.id);

      res.status(200).json({ message: "Order item marked as packed successfully" });
    } catch (error) {
      console.error('Order packing error:', error);
      res.status(500).json({ message: "Failed to mark order item as packed" });
    }
  });

  // Order item fulfillment route
  app.post('/api/orders/:id/fulfill-item', isAuthenticated, requireRole(['admin', 'manager']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { productId, quantity } = req.body;

      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "Product ID and positive quantity are required" });
      }

      // Get the order and verify it exists
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order is in a fulfillable status
      if (!['pending', 'processing'].includes(order.status)) {
        return res.status(400).json({ message: "Order cannot be fulfilled in its current status" });
      }

      // Get the product and verify stock
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.stock < quantity) {
        return res.status(400).json({ message: "Insufficient stock available" });
      }

      // Verify the product is part of this order
      const orderItem = order.items?.find(item => item.productId === productId);
      if (!orderItem) {
        return res.status(400).json({ message: "Product is not part of this order" });
      }

      if (orderItem.fulfilled) {
        return res.status(400).json({ message: "This order item has already been fulfilled" });
      }

      if (quantity > orderItem.quantity) {
        return res.status(400).json({ message: `Order only requires ${orderItem.quantity} units` });
      }

      // Fulfill the item (reduce stock and mark as fulfilled)
      await storage.fulfillOrderItem(orderId, productId, quantity, req.currentUser.id);

      res.status(200).json({ message: "Order item fulfilled successfully" });
    } catch (error) {
      console.error('Order fulfillment error:', error);
      res.status(500).json({ message: "Failed to fulfill order item" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/metrics', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await storage.getSalesMetrics(days);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get('/api/analytics/top-products', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topProducts = await storage.getTopProducts(limit);
      res.json(topProducts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch top products" });
    }
  });

  app.get('/api/analytics/order-status-breakdown', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const breakdown = await storage.getOrderStatusBreakdown();
      res.json(breakdown);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order breakdown" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const notifications = await storage.getNotifications(req.currentUser.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.markNotificationAsRead(id);
      res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // User management routes (admin only)
  app.get('/api/users', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const users = await storage.getUsersWithStats();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/users/:id/status', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const user = await storage.updateUserStatus(id, status);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.put('/api/users/:id/role', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = req.params.id;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      const user = await storage.updateUserRole(id, role);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = req.params.id;
      const userData = req.body;

      // Regular users can only update their own profile
      if (req.currentUser.role === 'customer' && req.currentUser.id !== id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If not admin, restrict what fields can be updated
      if (req.currentUser.role === 'customer') {
        const allowedFields = ['firstName', 'lastName', 'address', 'city', 'state', 'postalCode', 'country'];
        const filteredData = Object.keys(userData)
          .filter(key => allowedFields.includes(key))
          .reduce((obj: any, key) => {
            obj[key] = userData[key];
            return obj;
          }, {});

        const user = await storage.updateUser(id, filteredData);
        res.json(user);
      } else {
        // Admins can update all fields
        const user = await storage.updateUser(id, userData);
        res.json(user);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // User activity endpoint
  app.get('/api/users/:id/activity', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const userId = req.params.id;
      const { limit = 50, type } = req.query;

      const filters: any = { userId };
      if (type) filters.type = type as string;

      const activity = await storage.getUserActivity(userId, {
        limit: parseInt(limit as string),
        type: filters.type
      });

      res.json(activity);
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ message: "Failed to fetch user activity" });
    }
  });

  // Admin routes
  app.get('/api/admin/inventory-logs', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const { days, type, product } = req.query;
      const filters: any = {};

      if (days) filters.days = parseInt(days as string);
      if (type) filters.type = type as string;
      if (product) filters.product = product as string;

      const logs = await storage.getInventoryLogs(filters);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory logs" });
    }
  });

  // ID verification routes
  app.put('/api/users/:id/id-verification', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body;

      if (!['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'verified' or 'rejected'" });
      }

      const user = await storage.updateUserIdVerification(id, status);

      // If verified, also activate the user account
      if (status === 'verified') {
        await storage.updateUserStatus(id, 'active');
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update ID verification status" });
    }
  });

  app.get('/api/users/pending-verification', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const users = await storage.getUsersPendingVerification();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending verifications" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}