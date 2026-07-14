import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertProductSchema, insertCategorySchema, insertOrderSchema, insertOrderItemSchema, insertSupportTicketSchema, insertCityPurchaseLimitSchema } from "@shared/schema";
import { z } from "zod";
import { db, sql as rawPool } from "./db";
import { orders, products, orderItems, users, supportTickets, notifications } from "@shared/schema";
import { eq, sql, desc, and, gte, lt, inArray } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

// WebSocket connection store
const wsConnections = new Set<WebSocket>();

// Helper function to broadcast messages to all connected clients
function broadcastToClients(message: any) {
  const messageString = JSON.stringify(message);
  wsConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageString);
    }
  });
}


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

// Configure multer for image uploads (memory storage for Object Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
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

  // Ensure quantity pricing table exists
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_quantity_pricing (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        min_quantity INTEGER NOT NULL,
        price_per_item DECIMAL(10,4) NOT NULL
      )
    `);
    await db.execute(sql`
      ALTER TABLE product_quantity_pricing ALTER COLUMN price_per_item TYPE DECIMAL(10,4)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_pqp_product_id ON product_quantity_pricing(product_id)
    `);
  } catch (e: any) {
    console.warn('[startup] Could not ensure product_quantity_pricing table:', e?.message);
  }

  // Ensure price templates table exists
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS price_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        description TEXT,
        template_type VARCHAR NOT NULL DEFAULT 'units',
        price DECIMAL(10,2),
        price_per_gram DECIMAL(10,4),
        price_per_ounce DECIMAL(10,2),
        price_per_eighth DECIMAL(10,2),
        price_per_quarter DECIMAL(10,2),
        price_per_half DECIMAL(10,2),
        quantity_tiers TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e: any) {
    console.warn('[startup] Could not ensure price_templates table:', e?.message);
  }

  const verificationUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  // Auth middleware
  await setupAuth(app);

  // Object Storage routes - Reference: blueprint:javascript_object_storage
  
  // Endpoint to get presigned upload URL for object storage
  // Note: No authentication required for registration photo uploads
  app.post("/api/objects/upload", async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Endpoint to serve private objects with ACL check
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = (req.session as any).userId;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      
      // Check if user is admin - admins can view all verification photos
      const currentUser = await storage.getUser(userId);
      const isAdmin = currentUser?.role === 'admin';
      
      const canAccess = isAdmin || await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Endpoint to update user ID image with ACL policy
  app.put("/api/users/:userId/id-image", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).userId;
      const targetUserId = req.params.userId;
      
      // Users can only update their own photos, or admins can update any
      const currentUser = await storage.getUser(currentUserId);
      if (currentUserId !== targetUserId && currentUser?.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!req.body.idImageURL) {
        return res.status(400).json({ error: "idImageURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.idImageURL,
        {
          owner: targetUserId,
          visibility: "private", // ID images should be private
        },
      );

      // Update user's idImageUrl in database
      await storage.updateUser(targetUserId, { idImageUrl: objectPath });

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting ID image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to update user verification photo with ACL policy
  app.put("/api/users/:userId/verification-photo", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).userId;
      const targetUserId = req.params.userId;
      
      // Users can only update their own photos, or admins can update any
      const currentUser = await storage.getUser(currentUserId);
      if (currentUserId !== targetUserId && currentUser?.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!req.body.verificationPhotoURL) {
        return res.status(400).json({ error: "verificationPhotoURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.verificationPhotoURL,
        {
          owner: targetUserId,
          visibility: "private", // Verification photos should be private
        },
      );

      // Update user's verificationPhotoUrl in database
      await storage.updateUser(targetUserId, { verificationPhotoUrl: objectPath });

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting verification photo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Image upload endpoint - stores in Object Storage for persistence across deployments
  app.post('/api/upload/product-image', isAuthenticated, requireRole(['admin', 'manager', 'staff']), upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const uniqueId = uuidv4();
      const extension = path.extname(req.file.originalname) || '.jpg';
      const objectName = `product-images/${uniqueId}${extension}`;
      const fullPath = `${privateDir}/${objectName}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);

      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      const imageUrl = `/api/product-images/${uniqueId}${extension}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error('Product image upload error:', error);
      res.status(500).json({ message: 'Failed to upload image' });
    }
  });

  // Serve product images from Object Storage
  app.get('/api/product-images/:filename', async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateDir}/product-images/${req.params.filename}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: 'Image not found' });
      }

      const [metadata] = await file.getMetadata();
      res.set({
        'Content-Type': metadata.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      });

      const stream = file.createReadStream();
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming image' });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error('Product image serve error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error serving image' });
      }
    }
  });

  // Verification photo upload endpoint - stores in Object Storage
  app.post('/api/upload/verification-photo', verificationUpload.single('verificationPhoto'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No verification photo provided' });
      }

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const uniqueId = uuidv4();
      const extension = path.extname(req.file.originalname) || '.jpg';
      const objectName = `verification-photos/${uniqueId}${extension}`;
      const fullPath = `${privateDir}/${objectName}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);

      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      const imageUrl = `/api/verification-photos/${uniqueId}${extension}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error('Verification photo upload error:', error);
      res.status(500).json({ message: 'Failed to upload verification photo' });
    }
  });

  // Serve verification photos from Object Storage
  app.get('/api/verification-photos/:filename', isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateDir}/verification-photos/${req.params.filename}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      const [metadata] = await file.getMetadata();
      res.set({
        'Content-Type': metadata.contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      });

      const stream = file.createReadStream();
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming photo' });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error('Verification photo serve error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error serving photo' });
      }
    }
  });

  // Upload payment photo (pre-pay orders)
  app.post('/api/upload/payment-photo', isAuthenticated, upload.single('photo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No photo file provided' });
      }

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const uniqueId = uuidv4();
      const extension = path.extname(req.file.originalname) || '.jpg';
      const objectName = `payment-photos/${uniqueId}${extension}`;
      const fullPath = `${privateDir}/${objectName}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);

      await file.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
      });

      const photoUrl = `/api/payment-photos/${uniqueId}${extension}`;
      res.json({ photoUrl });
    } catch (error) {
      console.error('Payment photo upload error:', error);
      res.status(500).json({ message: 'Failed to upload photo' });
    }
  });

  // Serve payment photos (staff/manager/admin only)
  app.get('/api/payment-photos/:filename', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateDir}/payment-photos/${req.params.filename}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      const [metadata] = await file.getMetadata();
      res.set({
        'Content-Type': metadata.contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      });

      const stream = file.createReadStream();
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) res.status(500).json({ message: 'Error streaming photo' });
      });
      stream.pipe(res);
    } catch (error) {
      console.error('Payment photo serve error:', error);
      if (!res.headersSent) res.status(500).json({ message: 'Error serving photo' });
    }
  });

  // Auth routes are handled in setupAuth

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
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

  app.put('/api/categories/:id', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
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

  app.delete('/api/categories/:id', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
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
      const { categoryId, categoryIds, search, status, includeInactive } = req.query;
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

      // For storefront (non-authenticated requests), only show active products
      const isStorefrontRequest = !req.headers.authorization && !(req.cookies && req.cookies['connect.sid']);
      if (isStorefrontRequest) {
        filters.isActive = true;
      } else if (includeInactive !== 'true') {
        // For authenticated requests, only filter by active status if not explicitly including inactive products
        filters.isActive = true;
      }

      // Override: If explicitly requesting to include inactive products, don't filter by active status
      if (includeInactive === 'true') {
        delete filters.isActive;
      }

      const products = await storage.getProducts(filters);
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Low stock products - Must come BEFORE /api/products/:id to avoid route conflict
  app.get('/api/products/low-stock', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    try {
      const products = await storage.getLowStockProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch low stock products" });
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
      console.error('[GET /api/products/:id] error:', error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post('/api/products', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    try {
      console.log('[POST /api/products] Received data:', JSON.stringify(req.body, null, 2));
      const productData = insertProductSchema.parse(req.body);
      console.log('[POST /api/products] Parsed productData:', JSON.stringify(productData, null, 2));
      const product = await storage.createProduct(productData);

      // Auto-create a Daily Deals ad if product has BOGO or quantity pricing and no active ads exist yet
      try {
        const hasBogo = (product as any).bogoEnabled === true;
        const hasQuantityPricing = Array.isArray((product as any).quantityPricing) && (product as any).quantityPricing.length > 0;
        if (hasBogo || hasQuantityPricing) {
          const existingAds = await storage.getActivePromotionalAds();
          if (existingAds.length === 0) {
            const subtitle = hasBogo
              ? "Buy one, get one free on select items!"
              : "Buy more and save — tiered pricing available!";
            await storage.createPromotionalAd({
              title: "Daily Deals",
              subtitle,
              buttonText: "Shop Deals",
              buttonLink: "",
              backgroundImageUrl: (product as any).imageUrl || null,
              backgroundColor: hasBogo ? "#3b1054" : "#14532d",
              textColor: "white",
              isActive: true,
              sortOrder: 0,
            });
          }
        }
      } catch (e) {
        console.error('[POST /api/products] Failed to auto-create deals ad:', e);
      }

      res.status(201).json(product);
    } catch (error) {
      console.error('[POST /api/products] Product creation error:', error);
      if (error instanceof z.ZodError) {
        console.error('[POST /api/products] Validation errors:', error.errors);
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }

      const anyError: any = error;
      const cause = anyError?.cause || anyError?.sourceError || anyError?.originalError;
      const code = cause?.code || anyError?.code;
      const constraint = cause?.constraint || anyError?.constraint;
      const detail: string = String(cause?.detail || anyError?.detail || "");

      // Check for duplicate SKU constraint violation
      if (
        code === "23505" ||
        constraint === "products_sku_unique" ||
        detail.includes("(sku)=") ||
        (error instanceof Error && (
          error.message.includes('duplicate key value violates unique constraint') ||
          error.message.includes('UNIQUE constraint failed') ||
          (error.message.includes('sku') && error.message.includes('unique'))
        ))
      ) {
        return res.status(400).json({
          message: "Product SKU already exists"
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[POST /api/products] Full error details:', {
        message: errorMessage,
        stack: errorStack,
        cause: (error as any)?.cause,
        code: (error as any)?.code,
      });
      res.status(500).json({ 
        message: "Failed to create product", 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          stack: errorStack,
          cause: (error as any)?.cause?.message,
        } : undefined
      });
    }
  });

  app.put('/api/products/:id', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('[PUT /api/products/:id] Received data:', JSON.stringify(req.body, null, 2));
      const productData = insertProductSchema.partial().parse(req.body);
      console.log('[PUT /api/products/:id] Parsed productData:', JSON.stringify(productData, null, 2));
      const product = await storage.updateProduct(id, productData);
      console.log('[PUT /api/products/:id] Update returned product id:', product?.id);

      // Auto-create a Daily Deals ad if product has BOGO or quantity pricing and no active ads exist yet
      try {
        if (product) {
          const hasBogo = (product as any).bogoEnabled === true;
          const hasQuantityPricing = Array.isArray((product as any).quantityPricing) && (product as any).quantityPricing.length > 0;
          if (hasBogo || hasQuantityPricing) {
            const existingAds = await storage.getActivePromotionalAds();
            if (existingAds.length === 0) {
              const dealType = hasBogo ? "BOGO" : "Quantity";
              const subtitle = hasBogo
                ? "Buy one, get one free on select items!"
                : `Buy more and save — tiered pricing available!`;
              await storage.createPromotionalAd({
                title: "Daily Deals",
                subtitle,
                buttonText: "Shop Deals",
                buttonLink: "",
                backgroundImageUrl: (product as any).imageUrl || null,
                backgroundColor: hasBogo ? "#3b1054" : "#14532d",
                textColor: "white",
                isActive: true,
                sortOrder: 0,
              });
            }
          }
        }
      } catch (e) {
        console.error('[PUT /api/products/:id] Failed to auto-create deals ad:', e);
      }

      res.json(product);
    } catch (error: any) {
      console.log('[PUT /api/products/:id] ERROR:', error?.message || String(error));
      console.log('[PUT /api/products/:id] ERROR stack:', error?.stack);
      if (error instanceof z.ZodError) {
        console.log('[PUT /api/products/:id] Validation errors:', JSON.stringify(error.errors));
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('[PUT /api/products/:id] Update error:', errorMessage);
      res.status(500).json({ message: "Failed to update product", error: errorMessage });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      await storage.deleteProduct(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete product error:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (error instanceof Error && (error.message.includes('foreign key') || error.message.includes('pending or processing'))) {
        return res.status(409).json({
          message: error.message
        });
      }

      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to delete product"
      });
    }
  });

  // Stock adjustment route
  app.post('/api/products/:id/adjust-stock', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { quantity, reason, sizeName } = req.body;

      if (isNaN(productId) || productId <= 0) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      if (typeof quantity !== 'number' || Math.abs(quantity) > 10000) {
        return res.status(400).json({ message: "Quantity must be a number and cannot exceed 10000" });
      }
      
      if (!reason || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 200) {
        return res.status(400).json({ message: "Reason must be between 3 and 200 characters" });
      }

      await storage.adjustStock(productId, quantity, req.currentUser.id, reason, sizeName || undefined);
      res.status(200).json({ message: "Stock adjusted successfully" });
    } catch (error) {
      console.error("Stock adjustment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to adjust stock";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Bulk stock adjustment route for scanner operations
  app.post('/api/products/bulk-adjust-stock', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
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

  app.post('/api/products/generate-qr-codes', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
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

      // Role-based filtering
      if (req.currentUser.role === 'customer') {
        // Regular customers can only see their own orders
        filters.customerId = req.currentUser.id;
        // Hide delivered orders older than 48 hours for customers
        filters.hideOldDelivered = true;
      } else if (req.currentUser.role === 'staff') {
        // Staff can only see orders assigned to them
        filters.assignedUserId = req.currentUser.id;
      }
      // Managers and admins can see all orders

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

      const orderData = insertOrderSchema.parse(order);

      // Server-side delivery block and purchase limit enforcement
      if (orderData.shippingAddress) {
        const addressParts = orderData.shippingAddress.split(",").map((s: string) => s.trim());
        const city = addressParts.length >= 2 ? addressParts[1] : "";
        if (city) {
          // Check delivery block first
          const cityRecord = await storage.getCityByNameAny(city);
          if (cityRecord && cityRecord.deliveryBlocked) {
            return res.status(400).json({
              message: `We're sorry, but we do not currently deliver to ${city}. Please contact us for more information.`,
              deliveryBlocked: true,
            });
          }

          let allowed = true;
          let minimumAmount: number | null = null;

          // Use the pre-promo original total for city minimum check
          const checkTotal = parseFloat(orderData.originalTotal || orderData.total || "0");

          if (orderData.customerId) {
            const { rows: userRows } = await rawPool.query(`SELECT min_purchase_exempt::text as exempt_text, min_purchase_override FROM users WHERE id = $1`, [orderData.customerId]);
            if (userRows && userRows.length > 0) {
              const userRow = userRows[0];
              const isExempt = userRow.exempt_text === 'true' || userRow.exempt_text === 't';
              if (isExempt) {
                allowed = true;
              } else if (userRow.min_purchase_override !== null && userRow.min_purchase_override !== undefined) {
                minimumAmount = parseFloat(String(userRow.min_purchase_override));
                allowed = checkTotal >= minimumAmount;
              } else {
                const cityLimit = await storage.getCityPurchaseLimitByCity(city);
                if (cityLimit) {
                  minimumAmount = parseFloat(cityLimit.minimumAmount);
                  allowed = checkTotal >= minimumAmount;
                }
              }
            } else {
              const cityLimit = await storage.getCityPurchaseLimitByCity(city);
              if (cityLimit) {
                minimumAmount = parseFloat(cityLimit.minimumAmount);
                allowed = checkTotal >= minimumAmount;
              }
            }
          } else {
            const cityLimit = await storage.getCityPurchaseLimitByCity(city);
            if (cityLimit) {
              minimumAmount = parseFloat(cityLimit.minimumAmount);
              allowed = checkTotal >= minimumAmount;
            }
          }

          if (!allowed && minimumAmount !== null) {
            return res.status(400).json({
              message: `Orders shipping to ${city} require a minimum of $${minimumAmount.toFixed(2)}. Your pre-discount order total of $${checkTotal.toFixed(2)} does not meet this minimum.`,
            });
          }
        }
      }

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

      // If the order has a phone number and the customer is logged in, save it to their profile if not already set
      if (orderData.customerId && orderData.customerPhone) {
        try {
          const customer = await storage.getUser(orderData.customerId);
          if (customer && !(customer as any).phoneNumber) {
            await storage.updateUser(orderData.customerId, { phoneNumber: orderData.customerPhone });
          }
        } catch (phoneError) {
          console.error('Failed to save phone number to user profile:', phoneError);
        }
      }

      // Create notifications for staff, managers, and admins about the new order
      try {
        const staffUsers = await storage.getStaffUsers();
        for (const user of staffUsers) {
          await storage.createNotification({
            userId: user.id,
            type: 'new_order',
            title: 'New Order Received',
            message: `Order #${newOrder.orderNumber} from ${orderData.customerName} ($${orderData.total})`,
            data: { orderId: newOrder.id, orderNumber: newOrder.orderNumber, total: orderData.total }
          });
        }
      } catch (notificationError) {
        console.error('Failed to create order notifications:', notificationError);
        // Don't fail the order creation if notifications fail
      }

      try {
        broadcastToClients({
          type: 'new_order',
          data: newOrder
        });
      } catch (broadcastError) {
        console.error('Failed to broadcast new order:', broadcastError);
      }

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

  app.put('/api/orders/:id/status', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      // Get the order before updating to access customer information
      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      const order = await storage.updateOrderStatus(id, status);

      // Create notification for the customer about status change
      if (existingOrder.customerId) {
        try {
          const statusMessages = {
            'pending': 'Your order is pending confirmation',
            'processing': 'Your order is being processed',
            'shipped': 'Your order has been shipped',
            'cancelled': 'Your order has been cancelled'
          };

          const message = statusMessages[status as keyof typeof statusMessages] || `Your order status has been updated to ${status}`;

          await storage.createNotification({
            userId: existingOrder.customerId,
            type: 'order_status_update',
            title: `Order ${existingOrder.orderNumber} Update`,
            message: message,
            data: { 
              orderId: existingOrder.id, 
              orderNumber: existingOrder.orderNumber, 
              status: status,
              total: existingOrder.total 
            }
          });
        } catch (notificationError) {
          console.error('Failed to create customer notification:', notificationError);
          // Don't fail the status update if notification creation fails
        }
      }

      try {
        broadcastToClients({
          type: 'order_updated',
          data: order
        });
      } catch (broadcastError) {
        console.error('Failed to broadcast order update:', broadcastError);
      }

      res.json(order);
    } catch (error) {
      console.error('Failed to update order status:', error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  app.patch('/api/orders/:id/total', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { total } = req.body;

      if (total === undefined || total === null || isNaN(parseFloat(total))) {
        return res.status(400).json({ message: "A valid total is required" });
      }

      const numericTotal = parseFloat(total);
      if (numericTotal < 0) {
        return res.status(400).json({ message: "Total cannot be negative" });
      }

      const order = await storage.updateOrderTotal(id, numericTotal);
      res.json(order);
    } catch (error) {
      console.error('Failed to update order total:', error);
      res.status(500).json({ message: "Failed to update order total" });
    }
  });

  app.put('/api/orders/:id/assign', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { assignedUserId } = req.body;

      if (!assignedUserId) {
        return res.status(400).json({ message: "Assigned user ID is required" });
      }

      const order = await storage.assignOrderToUser(id, assignedUserId);
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign order" });
    }
  });

  app.delete('/api/orders/:id', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteOrder(id);
      res.json({ message: "Order deleted successfully" });
    } catch (error: any) {
      if (error.message === "Order not found") {
        return res.status(404).json({ message: "Order not found" });
      }
      console.error('Failed to delete order:', error);
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  app.delete('/api/orders', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const { statuses } = req.query;
      const statusList = statuses ? (statuses as string).split(',').map(s => s.trim()) : undefined;
      const count = await storage.clearAllOrders(statusList);
      res.json({ message: `${count} orders deleted successfully`, count });
    } catch (error) {
      console.error('Failed to clear orders:', error);
      res.status(500).json({ message: "Failed to clear orders" });
    }
  });

  // Order item packing route (marks as packed without reducing physical inventory)
  app.post('/api/orders/:id/pack-item', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { productId, orderItemId } = req.body;

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

      // Verify the specific order item exists (match by item ID when provided)
      const orderItem = orderItemId
        ? order.items?.find(item => item.id === orderItemId)
        : order.items?.find(item => item.productId === productId && !item.fulfilled);
      if (!orderItem) {
        return res.status(400).json({ message: "Product is not part of this order" });
      }

      if (orderItem.fulfilled) {
        return res.status(400).json({ message: "This order item has already been packed" });
      }

      // Mark the item as packed (fulfilled)
      await storage.markOrderItemAsPacked(orderId, productId, req.currentUser.id, orderItemId);

      res.status(200).json({ message: "Order item marked as packed successfully" });
    } catch (error) {
      console.error('Order packing error:', error);
      res.status(500).json({ message: "Failed to mark order item as packed" });
    }
  });

  // Order item fulfillment route
  app.post('/api/orders/:id/fulfill-item', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { productId, quantity, orderItemId } = req.body;

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

      // Get the product and verify physical inventory
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Check physicalInventory since fulfillment reduces physical inventory, not stock
      // physicalInventory is the actual warehouse count available for fulfillment
      const availablePhysicalInventory = (product.physicalInventory !== null && product.physicalInventory !== undefined) 
        ? product.physicalInventory 
        : 0;
      
      if (availablePhysicalInventory < quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock available. Physical inventory: ${availablePhysicalInventory}, requested: ${quantity}` 
        });
      }

      // Verify the specific order item exists (match by item ID when provided)
      const orderItem = orderItemId
        ? order.items?.find(item => item.id === orderItemId)
        : order.items?.find(item => item.productId === productId && !item.fulfilled);
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
      await storage.fulfillOrderItem(orderId, productId, quantity, req.currentUser.id, orderItemId);

      res.status(200).json({ message: "Order item fulfilled successfully" });
    } catch (error) {
      console.error('Order fulfillment error:', error);
      res.status(500).json({ message: "Failed to fulfill order item" });
    }
  });

  // Order item unfulfillment route (reverse inventory)
  app.post('/api/orders/:id/unfulfill-item', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { productId, quantity, orderItemId } = req.body;

      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "Product ID and positive quantity are required" });
      }

      // Get the order and verify it exists
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order is in a status that allows unfulfillment
      if (!['pending', 'processing'].includes(order.status)) {
        return res.status(400).json({ message: "Cannot unfulfill items for orders that are already packed, delivered, or cancelled" });
      }

      // Verify the specific order item exists (match by item ID when provided)
      const orderItem = orderItemId
        ? order.items?.find(item => item.id === orderItemId)
        : order.items?.find(item => item.productId === productId && item.fulfilled);
      if (!orderItem) {
        return res.status(400).json({ message: "Product is not part of this order" });
      }

      if (!orderItem.fulfilled) {
        return res.status(400).json({ message: "This order item is not fulfilled" });
      }

      // Unfulfill the item (restore stock and mark as not fulfilled)
      // Use the order item's actual quantity instead of client-supplied value for security
      await storage.unfulfillOrderItem(orderId, productId, orderItem.quantity, req.currentUser.id, orderItemId);

      res.status(200).json({ message: "Order item unfulfilled successfully" });
    } catch (error) {
      console.error('Order unfulfillment error:', error);
      res.status(500).json({ message: "Failed to unfulfill order item" });
    }
  });

  // Substitute order item (admin only)
  app.post('/api/orders/:id/substitute-item', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { oldItemId, newProductId, quantity } = req.body;

      if (!oldItemId || !newProductId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "oldItemId, newProductId, and positive quantity are required" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (['shipped', 'cancelled'].includes(order.status)) {
        return res.status(400).json({ message: "Cannot substitute items on shipped or cancelled orders" });
      }

      const oldItem = order.items?.find((item: any) => item.id === oldItemId);
      if (!oldItem) return res.status(400).json({ message: "Item not in this order" });
      if ((oldItem as any).removed) return res.status(400).json({ message: "Item has already been removed" });

      const newProduct = await storage.getProduct(newProductId);
      if (!newProduct) return res.status(404).json({ message: "Replacement product not found" });
      if (!newProduct.isActive) return res.status(400).json({ message: "Replacement product is not active" });
      if (newProduct.stock < quantity) return res.status(400).json({ message: `Insufficient stock. Available: ${newProduct.stock}` });

      await storage.substituteOrderItem(orderId, oldItemId, newProductId, quantity, req.currentUser.id);

      res.status(200).json({ message: "Item substituted successfully" });
    } catch (error: any) {
      console.error('Substitute item error:', error);
      res.status(500).json({ message: error.message || "Failed to substitute item" });
    }
  });

  // Daily analytics endpoints
  app.get("/api/analytics/hourly-breakdown", isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get hourly data for today
      const result = await db
        .select({
          hour: sql<string>`EXTRACT(HOUR FROM ${orders.createdAt})`,
          sales: sql<number>`COALESCE(SUM(CAST(${orders.total} AS NUMERIC)), 0)`,
          orders: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, startOfDay),
            lt(orders.createdAt, endOfDay),
            inArray(orders.status, ['shipped', 'processing', 'pending', 'delivered', 'completed'])
          )
        )
        .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
        .orderBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`);

      // Format data for chart - create 24 hours with defaults
      const hourlyData = Array.from({ length: 24 }, (_, i) => {
        const hour = i;
        const data = result.find(r => parseInt(r.hour) === hour);
        return {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          sales: data ? parseFloat(data.sales.toString()) : 0,
          orders: data ? data.orders : 0
        };
      });

      res.json(hourlyData);
    } catch (error) {
      console.error('Error fetching hourly breakdown:', error);
      res.status(500).json({ error: 'Failed to fetch hourly breakdown' });
    }
  });

  app.get("/api/analytics/daily-top-products", isAuthenticated, async (req, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const topProducts = await db
        .select({
          product: products,
          sales: sql<number>`SUM(${orderItems.quantity})`,
          revenue: sql<number>`SUM(CAST(${orderItems.subtotal} AS NUMERIC))`
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            gte(orders.createdAt, startOfDay),
            lt(orders.createdAt, endOfDay),
            inArray(orders.status, ['shipped', 'processing', 'pending', 'delivered', 'completed'])
          )
        )
        .groupBy(products.id)
        .orderBy(desc(sql`SUM(CAST(${orderItems.subtotal} AS NUMERIC))`))
        .limit(10);

      res.json(topProducts);
    } catch (error) {
      console.error('Error fetching daily top products:', error);
      res.status(500).json({ error: 'Failed to fetch daily top products' });
    }
  });

  // Analytics endpoints
  app.get('/api/analytics/metrics/:days', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const daysParam = parseInt(req.params.days);
      if (isNaN(daysParam) || daysParam < 1 || daysParam > 365) {
        return res.status(400).json({ message: "Days parameter must be between 1 and 365" });
      }
      const days = daysParam;
      const metrics = await storage.getSalesMetrics(days);
      res.json(metrics);
    } catch (error) {
      console.error('Analytics metrics error:', error);
      res.status(500).json({ message: "Failed to fetch analytics metrics" });
    }
  });

  app.get('/api/analytics/top-products/:limit', isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.params.limit) || 5;
      const topProducts = await storage.getTopProducts(limit);
      res.json(topProducts);
    } catch (error) {
      console.error('Top products error:', error);
      res.status(500).json({ message: "Failed to fetch top products" });
    }
  });

  // Order status breakdown for charts
  app.get('/api/analytics/order-status-breakdown', isAuthenticated, async (req, res) => {
    try {
      const breakdown = await storage.getOrderStatusBreakdown();
      res.json(breakdown);
    } catch (error) {
      console.error('Order status breakdown error:', error);
      res.status(500).json({ message: "Failed to fetch order status breakdown" });
    }
  });

  // Sales trend data for charts
  app.get('/api/analytics/sales-trend/:days', isAuthenticated, async (req, res) => {
    try {
      const days = parseInt(req.params.days) || 30;
      const salesTrend = await storage.getSalesTrend(days);
      res.json(salesTrend);
    } catch (error) {
      console.error('Sales trend error:', error);
      res.status(500).json({ message: "Failed to fetch sales trend data" });
    }
  });

  // Category breakdown for pie chart
  app.get('/api/analytics/category-breakdown', isAuthenticated, async (req, res) => {
    try {
      const categoryBreakdown = await storage.getCategoryBreakdown();
      res.json(categoryBreakdown);
    } catch (error) {
      console.error('Category breakdown error:', error);
      res.status(500).json({ message: "Failed to fetch category breakdown" });
    }
  });

  // Advanced metrics endpoint
  app.get('/api/analytics/advanced-metrics/:days', isAuthenticated, async (req, res) => {
    try {
      const days = parseInt(req.params.days) || 30;
      const metrics = await storage.getAdvancedMetrics(days);
      res.json(metrics);
    } catch (error) {
      console.error('Advanced metrics error:', error);
      res.status(500).json({ message: "Failed to fetch advanced metrics" });
    }
  });


  // Customer analytics
  app.get('/api/analytics/customers', isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getUsersWithStats();
      const totalCustomers = users.filter((user: any) => user.role === 'customer').length;
      const newCustomersThisMonth = users.filter((user: any) => {
        const userDate = new Date(user.createdAt!);
        const now = new Date();
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        return user.role === 'customer' && userDate >= monthAgo;
      }).length;

      res.json({
        totalCustomers,
        newCustomersThisMonth,
        percentageChange: 0 // Calculate based on previous month if needed
      });
    } catch (error) {
      console.error('Customer analytics error:', error);
      res.status(500).json({ message: "Failed to fetch customer analytics" });
    }
  });

  // Daily new users endpoint
  app.get('/api/analytics/daily-new-users', isAuthenticated, async (req, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const newUsersToday = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .where(
          and(
            gte(users.createdAt, startOfDay),
            lt(users.createdAt, endOfDay),
            eq(users.role, 'customer')
          )
        );

      res.json({
        newUsersToday: Number(newUsersToday[0]?.count || 0)
      });
    } catch (error) {
      console.error('Daily new users error:', error);
      res.status(500).json({ message: "Failed to fetch daily new users" });
    }
  });

  // Today's new customers (customers who placed their first order today)
  app.get('/api/analytics/daily-new-customers', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get all customers who ordered today
      const customersToday = await db
        .select({ 
          customerId: orders.customerId 
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, startOfDay),
            lt(orders.createdAt, endOfDay),
            inArray(orders.status, ['shipped', 'processing', 'pending', 'delivered', 'completed']),
            sql`${orders.customerId} IS NOT NULL`
          )
        )
        .groupBy(orders.customerId);

      // For each customer, check if they have orders before today
      let newCustomersCount = 0;
      for (const customer of customersToday) {
        if (customer.customerId) {
          const previousOrders = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(orders)
            .where(
              and(
                eq(orders.customerId, customer.customerId),
                lt(orders.createdAt, startOfDay)
              )
            );
          
          if (Number(previousOrders[0]?.count || 0) === 0) {
            newCustomersCount++;
          }
        }
      }

      res.json({
        newCustomersToday: newCustomersCount
      });
    } catch (error) {
      console.error('Daily new customers error:', error);
      res.status(500).json({ message: "Failed to fetch daily new customers" });
    }
  });

  // Today's return customers (customers who ordered today but have ordered before)
  app.get('/api/analytics/daily-return-customers', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get all customers who ordered today
      const customersToday = await db
        .select({ 
          customerId: orders.customerId 
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, startOfDay),
            lt(orders.createdAt, endOfDay),
            inArray(orders.status, ['shipped', 'processing', 'pending', 'delivered', 'completed']),
            sql`${orders.customerId} IS NOT NULL`
          )
        )
        .groupBy(orders.customerId);

      // For each customer, check if they have orders before today
      let returnCustomersCount = 0;
      for (const customer of customersToday) {
        if (customer.customerId) {
          const previousOrders = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(orders)
            .where(
              and(
                eq(orders.customerId, customer.customerId),
                lt(orders.createdAt, startOfDay)
              )
            );
          
          if (Number(previousOrders[0]?.count || 0) > 0) {
            returnCustomersCount++;
          }
        }
      }

      res.json({
        returnCustomersToday: returnCustomersCount
      });
    } catch (error) {
      console.error('Daily return customers error:', error);
      res.status(500).json({ message: "Failed to fetch daily return customers" });
    }
  });

  // Inventory metrics
  app.get('/api/analytics/inventory-metrics', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const metrics = await storage.getInventoryMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Inventory metrics error:', error);
      res.status(500).json({ message: "Failed to fetch inventory metrics" });
    }
  });

  // Customer metrics
  app.get('/api/analytics/customer-metrics/:days?', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const days = parseInt(req.params.days || '90');
      const metrics = await storage.getCustomerMetrics(days);
      res.json(metrics);
    } catch (error) {
      console.error('Customer metrics error:', error);
      res.status(500).json({ message: "Failed to fetch customer metrics" });
    }
  });

  // Operations metrics
  app.get('/api/analytics/operations-metrics/:days?', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const days = parseInt(req.params.days || '30');
      const metrics = await storage.getOperationsMetrics(days);
      res.json(metrics);
    } catch (error) {
      console.error('Operations metrics error:', error);
      res.status(500).json({ message: "Failed to fetch operations metrics" });
    }
  });

  // Peak purchase times
  app.get('/api/analytics/peak-times/:days?', isAuthenticated, async (req, res) => {
    try {
      const days = parseInt(req.params.days || '30');
      const peakTimes = await storage.getPeakPurchaseTimes(days);
      res.json(peakTimes);
    } catch (error) {
      console.error('Peak purchase times error:', error);
      res.status(500).json({ message: "Failed to fetch peak purchase times" });
    }
  });

  // City analytics endpoint
  app.get('/api/analytics/city-analytics/:days?', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    try {
      const days = parseInt(req.params.days || '30');
      const since = new Date();
      since.setDate(since.getDate() - days);

      const result = await db.execute(sql`
        SELECT
          COALESCE(u.city, 'Unknown') AS city,
          COUNT(o.id)::int AS total_orders,
          COALESCE(SUM(o.total::numeric), 0)::float AS total_revenue,
          COUNT(CASE WHEN o.status IN ('pending', 'processing') THEN 1 END)::int AS outstanding_orders,
          COUNT(CASE WHEN o.status IN ('shipped', 'delivered', 'completed') THEN 1 END)::int AS completed_orders,
          COUNT(CASE WHEN o.status = 'pending' THEN 1 END)::int AS pending_orders,
          COUNT(CASE WHEN o.status = 'processing' THEN 1 END)::int AS processing_orders,
          COUNT(CASE WHEN o.status = 'shipped' THEN 1 END)::int AS shipped_orders,
          COALESCE(AVG(o.total::numeric), 0)::float AS avg_order_value,
          MAX(o.created_at) AS last_order_date
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        WHERE o.created_at >= ${since}
        GROUP BY COALESCE(u.city, 'Unknown')
        ORDER BY total_orders DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error('City analytics error:', error);
      res.status(500).json({ message: "Failed to fetch city analytics" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const notifications = await storage.getNotifications(req.currentUser.id);
      res.json(notifications);
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error?.message || error);
      res.json([]);
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.markNotificationAsRead(id);
      res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(notifications).where(eq(notifications.id, id));
      res.status(204).send();
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ message: "Failed to delete notification" });
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

  app.get('/api/users/staff', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const staffUsers = await storage.getStaffUsers();
      res.json(staffUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch staff users" });
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

      // If activating an account, also mark ID verification as verified
      if (status === 'active') {
        await storage.updateUserIdVerification(id, 'verified');
        // Increment referrer's count now that the referred user is verified
        if (user.referredBy) {
          try {
            await storage.incrementReferralCount(user.referredBy);
          } catch (err) {
            console.error("Failed to increment referral count:", err);
          }
        }
      }

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

  app.delete('/api/users/:id', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const id = req.params.id;

      if (req.currentUser.id === id) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ message: "Failed to delete user" });
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
        const allowedFields = ['firstName', 'lastName', 'address', 'city', 'state', 'postalCode', 'country', 'telegramUsername', 'phoneNumber'];
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
    } catch (error: any) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // User activity endpoint
  app.get('/api/users/:id/activity', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
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

      const targetUser = await storage.getUser(id);
      const user = await storage.updateUserIdVerification(id, status);

      // If verified, also activate the user account
      if (status === 'verified') {
        await storage.updateUserStatus(id, 'active');
        // Increment referrer's count now that the referred user is verified
        if (targetUser?.referredBy) {
          try {
            await storage.incrementReferralCount(targetUser.referredBy);
          } catch (err) {
            console.error("Failed to increment referral count:", err);
          }
        }
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

  // Support ticket routes
  app.post('/api/support/contact', async (req, res) => {
    try {
      const ticketData = insertSupportTicketSchema.parse(req.body);
      const { userId, ...rest } = ticketData;
      const insertData = userId ? { ...rest, userId } : rest;
      const ticket = await storage.createSupportTicket(insertData);

      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      console.error("Support ticket error:", error);
      res.status(500).json({ message: "Failed to create support ticket" });
    }
  });

  app.get('/api/support/tickets', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const { status, priority } = req.query;
      const filters: any = {};

      if (status) filters.status = status as string;
      if (priority) filters.priority = priority as string;

      const tickets = await storage.getSupportTickets(filters);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch support tickets" });
    }
  });

  app.put('/api/support/tickets/:id/status', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ticket ID" });
      }

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const ticket = await storage.updateSupportTicketStatus(id, status);
      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found" });
      }
      res.json(ticket);
    } catch (error: any) {
      console.error("Error updating ticket status:", error);
      res.status(500).json({ message: error.message || "Failed to update ticket status" });
    }
  });

  app.put('/api/support/tickets/:id/assign', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { assignedTo } = req.body;

      const ticket = await storage.assignSupportTicket(id, assignedTo);
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign ticket" });
    }
  });

  app.post('/api/support/tickets/:id/respond', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { response, type } = req.body;

      if (!response || !type) {
        return res.status(400).json({ message: "Response and type are required" });
      }

      const ticketResponse = await storage.addSupportTicketResponse(id, {
        message: response,
        type,
        createdBy: req.currentUser.id
      });

      res.status(201).json(ticketResponse);
    } catch (error) {
      res.status(500).json({ message: "Failed to add ticket response" });
    }
  });

  app.delete('/api/support/tickets/:id', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ticket ID" });
      }
      await storage.deleteSupportTicket(id);
      res.json({ message: "Support ticket deleted successfully" });
    } catch (error) {
      console.error("Failed to delete support ticket:", error);
      res.status(500).json({ message: "Failed to delete support ticket" });
    }
  });

  app.put('/api/support/tickets/:id/archive', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ticket ID" });
      }
      const ticket = await storage.archiveSupportTicket(id);
      res.json(ticket);
    } catch (error) {
      console.error("Failed to archive support ticket:", error);
      res.status(500).json({ message: "Failed to archive support ticket" });
    }
  });

  app.delete('/api/support/tickets', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      await storage.clearAllSupportTickets();
      res.json({ message: "All non-archived support tickets cleared successfully" });
    } catch (error) {
      console.error("Failed to clear support tickets:", error);
      res.status(500).json({ message: "Failed to clear support tickets" });
    }
  });

  // City Purchase Limits routes
  app.get('/api/city-purchase-limits', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const limits = await storage.getCityPurchaseLimits();
      res.set('Cache-Control', 'no-store');
      res.json(limits);
    } catch (error) {
      console.error('Error fetching city purchase limits:', error);
      res.status(500).json({ message: "Failed to fetch city purchase limits" });
    }
  });

  app.post('/api/city-purchase-limits', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const data = insertCityPurchaseLimitSchema.parse(req.body);
      const limit = await storage.createCityPurchaseLimit(data);
      res.status(201).json(limit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      const anyError: any = error;
      if (anyError?.code === "23505" || anyError?.cause?.code === "23505") {
        return res.status(400).json({ message: "A purchase limit for this city already exists" });
      }
      console.error('Error creating city purchase limit:', error);
      res.status(500).json({ message: "Failed to create city purchase limit" });
    }
  });

  app.put('/api/city-purchase-limits/:id', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const updateSchema = z.object({
        cityName: z.string().min(1).optional(),
        minimumAmount: z.string().or(z.number()).transform(val => String(val)).optional(),
        isActive: z.boolean().optional(),
        deliveryBlocked: z.boolean().optional(),
      });
      const data = updateSchema.parse(req.body);
      const limit = await storage.updateCityPurchaseLimit(id, data);
      if (!limit) {
        return res.status(404).json({ message: "City purchase limit not found" });
      }
      console.log('[PUT city-purchase-limits] Returning:', JSON.stringify(limit));
      res.json(limit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error('Error updating city purchase limit:', error);
      res.status(500).json({ message: "Failed to update city purchase limit" });
    }
  });

  app.delete('/api/city-purchase-limits/:id', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCityPurchaseLimit(id);
      res.json({ message: "City purchase limit deleted successfully" });
    } catch (error) {
      console.error('Error deleting city purchase limit:', error);
      res.status(500).json({ message: "Failed to delete city purchase limit" });
    }
  });

  // Check minimum purchase requirement and delivery eligibility for a city/user combo
  app.post('/api/check-purchase-limit', async (req, res) => {
    try {
      const { city, total, userId } = req.body;
      console.log('[check-purchase-limit] Request:', { city, total, userId });

      if (!city) {
        return res.json({ allowed: true, minimumAmount: null });
      }

      // Check delivery block first (independent of isActive or user overrides)
      const cityRecord = await storage.getCityByNameAny(city.trim());
      if (cityRecord && cityRecord.deliveryBlocked) {
        return res.json({
          allowed: false,
          deliveryBlocked: true,
          cityName: cityRecord.cityName,
        });
      }

      if (userId) {
        const { rows: userRows } = await rawPool.query(`SELECT min_purchase_exempt::text as exempt_text, min_purchase_override FROM users WHERE id = $1`, [userId]);
        console.log('[check-purchase-limit] Raw SQL user result:', JSON.stringify(userRows));
        if (userRows && userRows.length > 0) {
          const userRow = userRows[0];
          const isExempt = userRow.exempt_text === 'true' || userRow.exempt_text === 't';
          console.log('[check-purchase-limit] isExempt:', isExempt, 'raw value:', userRow.exempt_text);
          if (isExempt) {
            return res.json({ allowed: true, minimumAmount: null, exempt: true });
          }
          if (userRow.min_purchase_override !== null && userRow.min_purchase_override !== undefined) {
            const overrideAmount = parseFloat(String(userRow.min_purchase_override));
            if (!isNaN(overrideAmount)) {
              const orderTotal = parseFloat(total);
              return res.json({
                allowed: orderTotal >= overrideAmount,
                minimumAmount: overrideAmount,
                isUserOverride: true,
              });
            }
          }
        }
      }

      const cityLimit = await storage.getCityPurchaseLimitByCity(city.trim());
      if (!cityLimit) {
        return res.json({ allowed: true, minimumAmount: null });
      }

      const minimumAmount = parseFloat(cityLimit.minimumAmount);
      const orderTotal = parseFloat(total);

      res.json({
        allowed: orderTotal >= minimumAmount,
        minimumAmount,
        cityName: cityLimit.cityName,
      });
    } catch (error) {
      console.error('Error checking purchase limit:', error);
      res.json({ allowed: true, minimumAmount: null });
    }
  });

  // =====================
  // Access Password Routes
  // =====================

  // Verify access password (customer-facing, requires auth)
  app.post("/api/access/verify", isAuthenticated, async (req: any, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ message: "Password is required" });
      const passwordId = await storage.verifyAccessPassword(password);
      if (passwordId !== null) {
        const userId = req.currentUser?.id;
        if (userId) {
          await storage.setUserGrantedAccessPassword(userId, passwordId);
        }
        return res.json({ success: true });
      }
      return res.status(401).json({ success: false, message: "Invalid access password" });
    } catch (error) {
      console.error("Error verifying access password:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check if access is still valid for this user
  app.get("/api/access/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) return res.json({ granted: false });
      const user = await storage.getUser(userId);
      if (!user?.grantedAccessPasswordId) return res.json({ granted: false });
      const valid = await storage.isAccessPasswordStillValid(user.grantedAccessPasswordId);
      if (!valid) {
        // Password no longer valid — clear the grant
        await storage.setUserGrantedAccessPassword(userId, null);
      }
      res.json({ granted: valid });
    } catch (error) {
      res.json({ granted: false });
    }
  });

  // Admin: list all access passwords
  app.get("/api/admin/access-passwords", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const passwords = await storage.getAccessPasswords();
      res.json(passwords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch access passwords" });
    }
  });

  // Admin: create access password
  app.post("/api/admin/access-passwords", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const { label, password, validFrom, validTo, isActive } = req.body;
      if (!label || !password) return res.status(400).json({ message: "Label and password are required" });
      const created = await storage.createAccessPassword({ label, password, validFrom: validFrom || null, validTo: validTo || null, isActive: isActive !== false });
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ message: "Failed to create access password" });
    }
  });

  // Admin: update access password
  app.put("/api/admin/access-passwords/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateAccessPassword(id, req.body);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update access password" });
    }
  });

  // Admin: delete access password
  app.delete("/api/admin/access-passwords/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAccessPassword(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete access password" });
    }
  });

  // Promotional Ads - public (for storefront carousel)
  app.get("/api/ads", async (req, res) => {
    try {
      const ads = await storage.getActivePromotionalAds();
      res.json(ads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ads" });
    }
  });

  // Admin: list all ads
  app.get("/api/admin/ads", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const ads = await storage.getPromotionalAds();
      res.json(ads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ads" });
    }
  });

  // Admin: create ad
  app.post("/api/admin/ads", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const created = await storage.createPromotionalAd(req.body);
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ message: "Failed to create ad" });
    }
  });

  // Admin: update ad
  app.put("/api/admin/ads/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updatePromotionalAd(id, req.body);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update ad" });
    }
  });

  // Admin: delete ad
  app.delete("/api/admin/ads/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePromotionalAd(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete ad" });
    }
  });

  // Discounts - public endpoint for cart evaluation (authenticated)
  app.get("/api/discounts", isAuthenticated, async (req, res) => {
    try {
      const activeDiscounts = await storage.getActiveDiscounts();
      res.json(activeDiscounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch discounts" });
    }
  });

  // Discounts - evaluate cart
  app.post("/api/discounts/evaluate", isAuthenticated, async (req, res) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) return res.json({ applied: [], totalSavings: 0 });

      const activeDiscounts = await storage.getActiveDiscounts();
      const applied: any[] = [];

      const totalItems = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      const cartTotal = items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
      const cartProductIds = items.map((i: any) => i.productId);
      const cartCategoryIds = items.map((i: any) => i.categoryId).filter(Boolean);

      for (const discount of activeDiscounts) {
        if (discount.type === 'quantity') {
          const minQty = discount.minQuantity || 0;
          let qualifyingItems = items;
          if (discount.applyToProductId) {
            qualifyingItems = items.filter((i: any) => i.productId === discount.applyToProductId);
          } else if (discount.applyToCategoryId) {
            qualifyingItems = items.filter((i: any) => i.categoryId === discount.applyToCategoryId);
          }
          const qualifyingQty = qualifyingItems.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
          if (qualifyingQty >= minQty) {
            const savingsBase = qualifyingItems.reduce((s: number, i: any) => s + ((i.price || 0) * (i.quantity || 1)), 0);
            const savings = savingsBase * (Number(discount.discountPercent) / 100);
            applied.push({ discount, savings: Math.round(savings * 100) / 100, description: `${discount.discountPercent}% off (${qualifyingQty} items)` });
          }
        } else if (discount.type === 'bundle') {
          let reqIds: number[] = [];
          try { reqIds = JSON.parse(discount.requiredProductIds || '[]'); } catch {}
          const allPresent = reqIds.every((id: number) => cartProductIds.includes(id));
          if (allPresent && reqIds.length > 0) {
            if (discount.freeProductId) {
              applied.push({ discount, savings: 0, freeProductId: discount.freeProductId, freeProductQuantity: discount.freeProductQuantity || 1, description: `Free item added to your order` });
            } else if (discount.discountPercent) {
              const savings = cartTotal * (Number(discount.discountPercent) / 100);
              applied.push({ discount, savings: Math.round(savings * 100) / 100, description: `${discount.discountPercent}% off bundle` });
            }
          }
        } else if (discount.type === 'spend') {
          const minSpend = Number(discount.minSpend) || 0;
          if (cartTotal >= minSpend) {
            const savings = cartTotal * (Number(discount.discountPercent) / 100);
            applied.push({ discount, savings: Math.round(savings * 100) / 100, description: `${discount.discountPercent}% off for spending $${minSpend.toFixed(2)}+` });
          }
        } else if (discount.type === 'bogo') {
          let bogoItems = items;
          if (discount.applyToProductId) {
            bogoItems = items.filter((i: any) => i.productId === discount.applyToProductId);
          }
          const bogoQty = bogoItems.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
          if (bogoQty >= 2) {
            const freeCount = Math.floor(bogoQty / 2);
            const unitPrice = bogoItems[0]?.price || 0;
            const savings = freeCount * unitPrice;
            applied.push({ discount, savings: Math.round(savings * 100) / 100, description: `Buy one get one free (${freeCount} free item${freeCount > 1 ? 's' : ''})` });
          }
        }
      }

      const totalSavings = applied.reduce((s, a) => s + (a.savings || 0), 0);
      res.json({ applied, totalSavings: Math.round(totalSavings * 100) / 100 });
    } catch (error) {
      res.status(500).json({ message: "Failed to evaluate discounts" });
    }
  });

  // Admin: list discounts
  app.get("/api/admin/discounts", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const all = await storage.getDiscounts();
      res.json(all);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch discounts" });
    }
  });

  // Helper: resolve SKU → product ID, storing result back into body
  async function resolveSkusToIds(body: any): Promise<any> {
    const resolved = { ...body };
    if (body.applyToProductSku) {
      const p = await storage.getProductBySku(body.applyToProductSku.trim());
      resolved.applyToProductId = p ? p.id : null;
      delete resolved.applyToProductSku;
    }
    if (body.freeProductSku) {
      const p = await storage.getProductBySku(body.freeProductSku.trim());
      resolved.freeProductId = p ? p.id : null;
      delete resolved.freeProductSku;
    }
    if (body.requiredProductSkus) {
      const skus: string[] = body.requiredProductSkus.split(',').map((s: string) => s.trim()).filter(Boolean);
      const ids: number[] = [];
      for (const sku of skus) {
        const p = await storage.getProductBySku(sku);
        if (p) ids.push(p.id);
      }
      resolved.requiredProductIds = ids.length ? JSON.stringify(ids) : null;
      delete resolved.requiredProductSkus;
    }
    return resolved;
  }

  // Helper: build auto-ad content from a discount (with image lookup)
  async function discountToAdData(discount: any, discountId: number) {
    const bgColors: Record<string, string> = {
      quantity: "#14532d",
      bundle: "#1e3a5f",
      spend: "#5c1a1a",
      bogo: "#3b1054",
    };
    const subtitleMap: Record<string, string> = {
      quantity: discount.minQuantity
        ? `Buy ${discount.minQuantity}+ items and save${discount.discountPercent ? ` ${discount.discountPercent}%` : ''}!`
        : discount.description || "",
      bundle: `Bundle deals — save${discount.discountPercent ? ` ${discount.discountPercent}%` : ''}!`,
      spend: discount.minSpend
        ? `Spend $${Number(discount.minSpend).toFixed(0)}+ and${discount.discountPercent ? ` save ${discount.discountPercent}%` : ' save'}!`
        : discount.description || "",
      bogo: "Buy one, get one free on select items!",
    };

    // Try to find a product image from the linked product IDs
    let backgroundImageUrl: string | null = null;
    const productIdToCheck = discount.applyToProductId || discount.freeProductId;
    if (productIdToCheck) {
      try {
        const product = await storage.getProduct(productIdToCheck);
        if (product?.imageUrl) backgroundImageUrl = product.imageUrl;
      } catch (e) { /* ignore */ }
    }

    return {
      discountId,
      title: discount.name,
      subtitle: discount.description || subtitleMap[discount.type] || "",
      buttonText: "Shop Deals",
      buttonLink: "",
      backgroundImageUrl,
      backgroundColor: bgColors[discount.type] || "#1a1a2e",
      textColor: "white",
      isActive: discount.isActive !== false,
      sortOrder: 0,
      validFrom: discount.validFrom || null,
      validTo: discount.validTo || null,
    };
  }

  // Admin: create discount
  app.post("/api/admin/discounts", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const body = await resolveSkusToIds(req.body);
      const created = await storage.createDiscount(body);
      // Auto-create a carousel ad for this discount
      try {
        await storage.createPromotionalAd(await discountToAdData(created, created.id));
      } catch (e) {
        console.error("Failed to auto-create ad for discount", e);
      }
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ message: "Failed to create discount" });
    }
  });

  // Admin: update discount
  app.put("/api/admin/discounts/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const body = await resolveSkusToIds(req.body);
      const updated = await storage.updateDiscount(id, body);
      if (!updated) return res.status(404).json({ message: "Not found" });
      // Sync the auto-generated ad
      try {
        const adData = await discountToAdData(updated, id);
        const existingAd = await storage.getAdByDiscountId(id);
        if (existingAd) {
          await storage.updatePromotionalAd(existingAd.id, adData);
        } else {
          await storage.createPromotionalAd(adData);
        }
      } catch (e) {
        console.error("Failed to sync ad for discount", e);
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update discount" });
    }
  });

  // Admin: delete discount
  app.delete("/api/admin/discounts/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDiscount(id);
      // Remove the auto-generated ad too
      try { await storage.deleteAdByDiscountId(id); } catch (e) {}
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete discount" });
    }
  });

  // ── Promo Codes ────────────────────────────────────────────────────────────

  // Admin: list all promo codes
  app.get("/api/admin/promo-codes", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      res.json(await storage.getPromoCodes());
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  // Admin: create promo code
  app.post("/api/admin/promo-codes", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const created = await storage.createPromoCode(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      const isDupe = e?.code === "23505" || e?.cause?.code === "23505" ||
        e?.message?.toLowerCase().includes("unique") || e?.cause?.message?.toLowerCase().includes("unique");
      if (isDupe) {
        return res.status(409).json({ message: "A promo code with that code already exists." });
      }
      console.error("Failed to create promo code:", e);
      res.status(500).json({ message: "Failed to create promo code" });
    }
  });

  // Admin: update promo code
  app.put("/api/admin/promo-codes/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const updated = await storage.updatePromoCode(parseInt(req.params.id), req.body);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) {
      const isDupe = e?.code === "23505" || e?.cause?.code === "23505" ||
        e?.message?.toLowerCase().includes("unique") || e?.cause?.message?.toLowerCase().includes("unique");
      if (isDupe) {
        return res.status(409).json({ message: "A promo code with that code already exists." });
      }
      res.status(500).json({ message: "Failed to update promo code" });
    }
  });

  // Admin: delete promo code
  app.delete("/api/admin/promo-codes/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      await storage.deletePromoCode(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete promo code" });
    }
  });

  // Public (authenticated): validate a promo code
  app.post("/api/promo-codes/validate", isAuthenticated, async (req: any, res) => {
    try {
      const { code, cartTotal } = req.body;
      if (!code) return res.status(400).json({ valid: false, message: "No code provided" });

      const promo = await storage.getPromoCodeByCode(code.trim());
      if (!promo) return res.json({ valid: false, message: "Code not found" });
      if (!promo.isActive) return res.json({ valid: false, message: "This code is no longer active" });

      // Date validation
      const now = new Date();
      if (promo.validFrom && now < promo.validFrom) return res.json({ valid: false, message: "This code isn't valid yet" });
      if (promo.validTo && now > promo.validTo) return res.json({ valid: false, message: "This code has expired" });

      // Minimum order amount check
      if (promo.minOrderAmount != null) {
        const minAmt = parseFloat(promo.minOrderAmount);
        const cartAmt = parseFloat(cartTotal || "0");
        if (cartAmt < minAmt) {
          return res.json({
            valid: false,
            message: `This code requires a minimum order of $${minAmt.toFixed(2)}. Your cart total is $${cartAmt.toFixed(2)}.`,
            minOrderAmount: minAmt,
            cartTotal: cartAmt,
          });
        }
      }

      // Total uses cap
      if (promo.maxTotalUses != null && promo.totalUses >= promo.maxTotalUses) {
        return res.json({ valid: false, message: "This code has reached its usage limit" });
      }

      // Per-user limit
      const userId = req.user?.claims?.sub;
      if (promo.usageLimitType === "once_per_user" && userId) {
        const uses = await storage.getPromoCodeUsesForUser(promo.id, userId);
        if (uses > 0) return res.json({ valid: false, message: "You've already used this code" });
      }

      // Calculate discount amount
      const total = parseFloat(cartTotal || "0");
      const discountValue = parseFloat(promo.discountValue);
      const discountAmount = promo.discountType === "percent"
        ? Math.min(total, total * discountValue / 100)
        : Math.min(total, discountValue);

      res.json({
        valid: true,
        promoId: promo.id,
        code: promo.code,
        description: promo.description,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        bypassPurchaseMinimum: promo.bypassPurchaseMinimum,
      });
    } catch (e) {
      res.status(500).json({ valid: false, message: "Error validating code" });
    }
  });

  // Price Templates CRUD (managers/admins)
  app.get("/api/price-templates", isAuthenticated, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const templates = await storage.getPriceTemplates();
      res.json(templates);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch price templates" });
    }
  });

  app.post("/api/price-templates", isAuthenticated, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const template = await storage.createPriceTemplate(req.body);
      res.json(template);
    } catch (e) {
      res.status(500).json({ message: "Failed to create price template" });
    }
  });

  app.put("/api/price-templates/:id", isAuthenticated, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.updatePriceTemplate(id, req.body);
      res.json(template);
    } catch (e) {
      res.status(500).json({ message: "Failed to update price template" });
    }
  });

  app.delete("/api/price-templates/:id", isAuthenticated, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePriceTemplate(id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete price template" });
    }
  });

  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    wsConnections.add(ws);

    // Set connection timeout with cleanup
    const timeout = setTimeout(() => {
      if (ws.readyState === ws.OPEN) {
        ws.close(1000, 'Connection timeout');
      }
      wsConnections.delete(ws);
    }, 30 * 60 * 1000); // 30 minutes

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clearTimeout(timeout);
      wsConnections.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearTimeout(timeout);
      wsConnections.delete(ws);
    });

    ws.on('pong', () => {
      // Reset timeout on pong
      clearTimeout(timeout);
    });
  });

  // Ping clients periodically to detect dead connections
  setInterval(() => {
    wsConnections.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        wsConnections.delete(ws);
      }
    });
  }, 30000); // Every 30 seconds

  return httpServer;
}