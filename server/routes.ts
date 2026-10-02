import type { Express } from "express";
import { createServer, ServerResponse, type Server } from "http";
import path from "path";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { normalizeSubmittedPromoCodes } from "./promo-stack";
import { setupAuth, isAuthenticated, normalizeTelegramUsername } from "./auth";
import { insertProductSchema, insertCategorySchema, insertOrderSchema, insertOrderItemSchema, insertSupportTicketSchema, insertCityPurchaseLimitSchema } from "@shared/schema";
import { z } from "zod";
import { db, sql as rawPool } from "./db";
import { orders, products, orderItems, users, supportTickets, notifications, categories, boardPosts } from "@shared/schema";
import { eq, sql, desc, and, gte, lt, inArray, like } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import sharp from "sharp";
import { normalizeInventoryOption } from "@shared/inventory";

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

// Advertisement GIFs can be substantially larger than optimized images.
// Keep the higher multer ceiling limited by an explicit per-type check below.
const MAX_AD_IMAGE_OR_VIDEO_SIZE = 20 * 1024 * 1024;
const MAX_AD_GIF_SIZE = 100 * 1024 * 1024;
const MAX_REMOTE_PAYMENT_PHOTO_SIZE = 10 * 1024 * 1024;

function isPublicRemoteAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split(".").map(Number);
    const [a, b, c] = octets;
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return false;
    }

    return !(
      a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && c === 2)
      || (a === 192 && b === 88 && c === 99)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113)
    );
  }

  if (version !== 6) return false;

  let normalized = address.toLowerCase().split("%")[0];
  const embeddedIpv4 = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (embeddedIpv4) {
    const octets = embeddedIpv4[1].split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return false;
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = normalized.replace(embeddedIpv4[1], `${high}:${low}`);
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return false;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missingGroups = 8 - left.length - right.length;
  if ((halves.length === 1 && missingGroups !== 0) || (halves.length === 2 && missingGroups < 1)) return false;
  const groups = [
    ...left,
    ...Array(halves.length === 2 ? missingGroups : 0).fill("0"),
    ...right,
  ].map((group) => Number.parseInt(group || "0", 16));
  if (groups.length !== 8 || groups.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) {
    return false;
  }

  const [first, second] = groups;
  const isIpv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isIpv4Mapped) {
    return isPublicRemoteAddress(`${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`);
  }

  // Only accept globally routable unicast space. Exclude documentation and
  // transition blocks that can encode private IPv4 destinations.
  return (first & 0xe000) === 0x2000
    && !(first === 0x2001 && second <= 0x01ff)
    && !(first === 0x2001 && second === 0x0db8)
    && first !== 0x2002
    && !(first === 0x3fff && second <= 0x0fff);
}

async function fetchRemotePaymentImage(imageUrl: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("Drop an image file or a direct image link.");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    throw new Error("Only public HTTPS image links can be imported.");
  }

  const resolvedAddresses = await dnsLookup(url.hostname, { all: true, verbatim: true });
  if (resolvedAddresses.length === 0 || resolvedAddresses.some(({ address }) => !isPublicRemoteAddress(address))) {
    throw new Error("That image link is not available from a public address.");
  }
  const pinnedAddress = resolvedAddresses[0];
  const allowedContentTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/bmp",
    "image/tiff",
  ]);

  const responseBuffer = await new Promise<Buffer>((resolve, reject) => {
    const request = httpsRequest({
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      servername: url.hostname,
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff",
        "User-Agent": "Mozilla/5.0 (compatible; PaymentPhotoImporter/1.0)",
      },
      lookup: (_hostname, _options, callback) => {
        callback(null, pinnedAddress.address, pinnedAddress.family);
      },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error("The image link could not be downloaded. Try dragging the image itself."));
        return;
      }

      const contentType = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (!allowedContentTypes.has(contentType)) {
        response.resume();
        reject(new Error("The dropped link did not return a supported image."));
        return;
      }

      const contentLength = Number(response.headers["content-length"]);
      if (Number.isFinite(contentLength) && contentLength > MAX_REMOTE_PAYMENT_PHOTO_SIZE) {
        response.resume();
        reject(new Error("The image is too large. Choose an image under 10 MB."));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += bufferChunk.length;
        if (totalBytes > MAX_REMOTE_PAYMENT_PHOTO_SIZE) {
          response.destroy(new Error("The image is too large. Choose an image under 10 MB."));
          return;
        }
        chunks.push(bufferChunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });

    request.setTimeout(10000, () => request.destroy(new Error("The image download timed out. Try again.")));
    request.on("error", reject);
    request.end();
  });

  return sharp(responseBuffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .jpeg({ quality: 88 })
    .toBuffer();
}

// Configure media uploads for advertisements (memory storage for Object Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AD_GIF_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const isMp4 = file.mimetype === 'video/mp4' || file.originalname.toLowerCase().endsWith('.mp4');
    if (file.mimetype.startsWith('image/') || isMp4) {
      cb(null, true);
    } else {
      cb(new Error('Only image or MP4 video files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Existing categories keep their storefront headings unless an admin hides them.
  await db.execute(sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS show_storefront_heading BOOLEAN NOT NULL DEFAULT TRUE`);

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

  // Ensure board_posts table exists
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS board_posts (
        id SERIAL PRIMARY KEY,
        text TEXT,
        image_url TEXT,
        created_by VARCHAR NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS product_ids TEXT`);
    await db.execute(sql`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS after_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`);
  } catch (e: any) {
    console.warn('[startup] Could not ensure board_posts table:', e?.message);
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
      fileSize: 500 * 1024 * 1024, // 500MB limit
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

      // For video content, redirect to a short-lived GCS signed URL so the
      // browser can stream it directly with full Range-request support.
      // This avoids proxy issues and content-type guessing problems.
      const [metadata] = await objectFile.getMetadata();
      const contentType: string = metadata.contentType || "application/octet-stream";
      if (contentType.startsWith("video/") || contentType === "application/octet-stream") {
        // Also redirect octet-stream because it may be a video uploaded without MIME type
        const signedUrl = await objectStorageService.getSignedDownloadUrl(objectFile, 120);
        return res.redirect(302, signedUrl);
      }

      objectStorageService.downloadObject(objectFile, res, req);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      console.error("Error checking object access:", error);
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

      const compressedBuffer = await sharp(req.file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const uniqueId = uuidv4();
      const objectName = `product-images/${uniqueId}.webp`;
      const fullPath = `${privateDir}/${objectName}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);

      await file.save(compressedBuffer, {
        metadata: {
          contentType: 'image/webp',
        },
      });

      const imageUrl = `/api/product-images/${uniqueId}.webp`;
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
        'Content-Type': metadata.contentType || 'image/webp',
        'Cache-Control': 'public, max-age=604800',
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

  // Import a directly dropped image link. DNS is resolved and pinned to a
  // validated public IP before connecting, and redirects are not followed.
  app.post('/api/upload/payment-photo-from-url', isAuthenticated, async (req: any, res) => {
    const imageUrl = req.body?.imageUrl;
    if (typeof imageUrl !== "string" || imageUrl.length > 4096) {
      return res.status(400).json({ message: "A valid image link is required." });
    }

    try {
      const imageBuffer = await fetchRemotePaymentImage(imageUrl);
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const uniqueId = uuidv4();
      const objectName = `payment-photos/${uniqueId}.jpg`;
      const fullPath = `${privateDir}/${objectName}`;
      const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join("/");
      const file = objectStorageClient.bucket(bucketName).file(objectKey);

      await file.save(imageBuffer, {
        metadata: { contentType: "image/jpeg" },
      });

      res.json({ photoUrl: `/api/payment-photos/${uniqueId}.jpg` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not import that image link.";
      res.status(400).json({ message });
    }
  });

  // Serve payment photos (staff/driver/manager/admin only)
  app.get('/api/payment-photos/:filename', isAuthenticated, requireRole(['admin', 'manager', 'staff', 'driver']), async (req: any, res) => {
    try {
      if (req.currentUser.role === 'driver') {
        const photoUrl = `/api/payment-photos/${req.params.filename}`;
        const [assignedOrder] = await db
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.paymentPhotoUrl, photoUrl),
              eq(orders.assignedUserId, req.currentUser.id),
              eq(orders.status, 'shipped'),
              eq(orders.archived, false)
            )
          )
          .limit(1);

        if (!assignedOrder) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

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

  app.patch('/api/categories/reorder', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const orders = z.array(z.object({
        id: z.number().int().positive(),
        sortOrder: z.number().int().min(0),
      })).min(1).parse(req.body.orders);
      if (new Set(orders.map((order) => order.id)).size !== orders.length) {
        return res.status(400).json({ message: "Category orders must not contain duplicate IDs" });
      }
      const existing = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, orders.map((order) => order.id)));
      if (existing.length !== orders.length) {
        return res.status(400).json({ message: "One or more categories do not exist" });
      }
      await Promise.all(orders.map(({ id, sortOrder }) => storage.updateCategory(id, { sortOrder })));
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category order data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to reorder categories" });
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
      // Inventory changes must never be served from the browser's HTTP cache.
      // A stale product list can advertise variant rows that no longer exist,
      // while order mutations correctly validate against the current database.
      res.set('Cache-Control', 'no-store');
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

  // Reorder products (admin only) - Must come BEFORE /api/products/:id to avoid route conflict
  app.patch('/api/products/reorder', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ message: "orders must be an array" });
      }
      await storage.updateProductSortOrders(orders);
      res.json({ success: true });
    } catch (error) {
      console.error('Error reordering products:', error);
      res.status(500).json({ message: "Failed to reorder products" });
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
      res.set('Cache-Control', 'no-store');
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
      syncGrabBagAvailability().catch(() => {});

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

  // Helper: compute available stock units for a single component product.
  // For size-based products: total quantity across all sizes (any flavor works for one bag slot).
  // For a pinned size: only that size's quantity.
  function componentStock(component: any, selectedSize?: string): number {
    if (component.sizes && component.sizes.length > 0) {
      if (selectedSize) {
        const sz = component.sizes.find((s: any) => s.size === selectedSize);
        return sz ? (sz.quantity ?? 0) : 0;
      }
      return component.sizes.reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0);
    }
    return component.stock ?? 0;
  }

  function componentPhysicalInventory(component: any, selectedSize?: string): number {
    if (component.sizes && component.sizes.length > 0) {
      if (selectedSize) {
        const size = component.sizes.find((entry: any) => entry.size === selectedSize);
        return size ? (size.physicalQuantity ?? 0) : 0;
      }
      return component.sizes.reduce(
        (sum: number, size: any) => sum + (size.physicalQuantity ?? 0),
        0,
      );
    }
    return component.physicalInventory ?? 0;
  }

  // Sellable stock is the purchasing contract. Physical variance is surfaced to
  // administrators, not silently used to manufacture storefront availability.
  function componentAvailable(component: any, selectedSize?: string): boolean {
    if (component.sizes && component.sizes.length > 0) {
      if (selectedSize) {
        const sz = component.sizes.find((s: any) => s.size === selectedSize);
        if (!sz) return false;
        return (sz.quantity ?? 0) > 0;
      }
      // At least one size must be fully available
      return component.sizes.some((s: any) => (s.quantity ?? 0) > 0);
    }
    return (component.stock ?? 0) > 0;
  }

  // Helper: scan all grab-bag products and sync their stock to the minimum available across components.
  // Disables the bag if any component is out of stock; re-enables and updates stock count when all are available.
  async function syncGrabBagAvailability(): Promise<void> {
    try {
      const { products: productsTable } = await import("@shared/schema");
      const allBagProducts = await db
        .select()
        .from(productsTable)
        .where(like(productsTable.sku, "GRAB-BAG-%"));

      for (const bag of allBagProducts) {
        if ((bag.sku ?? "").startsWith("GRAB-BAG-DISCOUNT")) continue;
        if (!bag.adminNotes) continue;
        let items: Array<{ productId?: number | null; selectedSize?: string }> = [];
        try {
          const parsed = JSON.parse(bag.adminNotes as string);
          if (parsed.items && Array.isArray(parsed.items)) items = parsed.items;
        } catch { continue; }

        let minStock = Infinity;
        let minPhysicalInventory = Infinity;
        let anyUnavailable = false;
        const requirements = new Map<string, { productId: number; selectedSize?: string; count: number }>();
        for (const item of items) {
          if (!item.productId) continue;
          const key = `${item.productId}:${item.selectedSize ?? "*"}`;
          const requirement = requirements.get(key);
          if (requirement) requirement.count += 1;
          else requirements.set(key, { productId: item.productId, selectedSize: item.selectedSize, count: 1 });
        }
        for (const item of Array.from(requirements.values())) {
          if (!item.productId) continue;
          const component = await storage.getProduct(item.productId);
          // Components may be inactive in the storefront (sold only via grab bags) — just check they exist and have stock
          if (!component) {
            anyUnavailable = true;
            minPhysicalInventory = 0;
            continue;
          }
          if (!componentAvailable(component, item.selectedSize)) anyUnavailable = true;
          minStock = Math.min(minStock, Math.floor(componentStock(component, item.selectedSize) / item.count));
          minPhysicalInventory = Math.min(
            minPhysicalInventory,
            Math.floor(componentPhysicalInventory(component, item.selectedSize) / item.count),
          );
        }

        const newStock = anyUnavailable ? 0 : (isFinite(minStock) ? minStock : 0);
        const newPhysicalInventory = isFinite(minPhysicalInventory) ? minPhysicalInventory : 0;
        const shouldBeActive = !anyUnavailable && newStock > 0;
        const currentStock = bag.stock ?? 0;
        const currentPhysicalInventory = bag.physicalInventory ?? 0;
        const currentActive = bag.isActive ?? false;

        if (
          newStock !== currentStock ||
          newPhysicalInventory !== currentPhysicalInventory ||
          shouldBeActive !== currentActive
        ) {
          await rawPool.query(
            `UPDATE products SET stock = $1, physical_inventory = $2, is_active = $3, updated_at = NOW() WHERE id = $4`,
            [newStock, newPhysicalInventory, shouldBeActive, bag.id]
          );
          console.log(
            `[syncGrabBagAvailability] Bag #${bag.id} (${bag.name}): ` +
            `stock ${currentStock} → ${newStock}, physical ${currentPhysicalInventory} → ${newPhysicalInventory}, ` +
            `active ${currentActive} → ${shouldBeActive}`,
          );
        }
      }

      try {
        const { invalidateCache } = await import("./cache");
        invalidateCache.products();
      } catch { /* best-effort */ }
    } catch (err) {
      console.warn("[syncGrabBagAvailability] Error:", err);
    }
  }

  // Stock adjustment route
  app.get('/api/admin/inventory-integrity', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (_req, res) => {
    try {
      res.json(await storage.getInventoryIntegrity());
    } catch (error) {
      console.error("Inventory integrity scan failed:", error);
      res.status(500).json({ message: "Failed to scan inventory integrity" });
    }
  });

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
      syncGrabBagAvailability().catch(() => {});
      res.status(200).json({ message: "Stock adjusted successfully" });
    } catch (error) {
      console.error("Stock adjustment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to adjust stock";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post('/api/products/:id/physical-count', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { count, reason, sizeName } = req.body;
      if (!Number.isInteger(count) || count < 0 || count > 1000000) {
        return res.status(400).json({ message: "Count must be a non-negative whole number" });
      }
      if (!reason || typeof reason !== "string" || reason.trim().length < 3 || reason.length > 200) {
        return res.status(400).json({ message: "Reason must be between 3 and 200 characters" });
      }
      await storage.setPhysicalCount(productId, count, req.currentUser.id, reason.trim(), sizeName || undefined);
      res.json({ message: "Verified physical count recorded" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to record physical count";
      res.status(message.includes("not found") ? 404 : 409).json({ message });
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

      syncGrabBagAvailability().catch(() => {});
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
      const isSelfServiceOrderView = req.query.view === 'mine';

      if (status) {
        // Handle multiple statuses separated by comma
        if (status.includes(',')) {
          filters.statuses = status.split(',').map((s: string) => s.trim());
        } else {
          filters.status = status as string;
        }
      }

      // Role-based filtering
      if (req.currentUser.role === 'customer' || (req.currentUser.role === 'driver' && isSelfServiceOrderView)) {
        // Customers and drivers using My Orders can only see purchases placed by their own account.
        filters.customerId = req.currentUser.id;
        // Match the standard customer order-history policy.
        filters.hideOldDelivered = true;
      } else if (req.currentUser.role === 'driver') {
        filters.assignedUserId = req.currentUser.id;
        filters.status = 'shipped';
        filters.archived = false;
      } else if (req.currentUser.role === 'staff') {
        // Staff can only see orders assigned to them
        filters.assignedUserId = req.currentUser.id;
      } else if (req.currentUser.role === 'admin' || req.currentUser.role === 'manager') {
        // Admins/managers can filter by a specific customer
        if (req.query.customerId) {
          filters.customerId = req.query.customerId as string;
        }
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

      // Regular customers and drivers can only see their own permitted orders.
      if (req.currentUser.role === 'customer' && order.customerId !== req.currentUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (req.currentUser.role === 'driver') {
        const isOwnPurchase = order.customerId === req.currentUser.id;
        const isAssignedDelivery =
          order.assignedUserId === req.currentUser.id &&
          order.status === 'shipped' &&
          !order.archived;
        if (!isOwnPurchase && !isAssignedDelivery) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Public endpoint: list active Customer Generated bag templates for the storefront
  app.get('/api/grab-bags/customer-generated', async (_req, res) => {
    try {
      const all = await storage.getGrabBags();
      const cg = all
        .filter(b => (b as any).type === 'customer_generated' && b.isActive)
        .map(b => ({
          id: b.id,
          name: b.name,
          description: b.description,
          sellingPrice: b.sellingPrice,
          maxTotalItemPrice: b.maxTotalItemPrice,
          allowedCategoryIds: b.allowedCategoryIds ? (() => { try { return JSON.parse(b.allowedCategoryIds as string); } catch { return []; } })() : [],
        }));
      res.json(cg);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch customer-generated grab bags" });
    }
  });

  type PromoCartItem = {
    productId: number;
    categoryId?: number | null;
    quantity: number;
    size?: string;
    productPrice?: string | number;
    unitPrice?: string | number;
  };

  type ItemPromoTarget = {
    productId?: number;
    categoryId?: number;
    sizes?: string[];
  };

  // Older promo codes store [1, 2] while newer records may store
  // [{ productId: 1, sizes: ["Small", "Large"] }]. Treat legacy values
  // as product-wide targets so existing deals continue to work.
  function getItemPromoTargets(promo: any): ItemPromoTarget[] {
    try {
      const rawTargets = JSON.parse(promo.targetProductIds || "[]");
      if (!Array.isArray(rawTargets)) return [];
      const seen = new Set<string>();
      return rawTargets.flatMap((rawTarget: any): ItemPromoTarget[] => {
        const categoryId = Number(rawTarget?.categoryId);
        if (Number.isInteger(categoryId) && categoryId > 0) {
          const key = `category:${categoryId}`;
          if (seen.has(key)) return [];
          seen.add(key);
          return [{ categoryId }];
        }
        const id = Number(typeof rawTarget === "number" ? rawTarget : rawTarget?.productId);
        const key = `product:${id}`;
        if (!Number.isInteger(id) || id <= 0 || seen.has(key)) return [];
        seen.add(key);
        const sizes = Array.isArray(rawTarget?.sizes)
          ? [...new Set(rawTarget.sizes.map(String).map((size: string) => size.trim()).filter(Boolean))]
          : undefined;
        return [{ productId: id, ...(sizes?.length ? { sizes } : {}) }];
      });
    } catch {
      return [];
    }
  }

  function getItemPromoTargetIds(promo: any): number[] {
    return getItemPromoTargets(promo)
      .map(target => target.productId)
      .filter((productId): productId is number => productId !== undefined);
  }

  async function getPromoEligibilityMessage(promo: any): Promise<string> {
    const productIds = getItemPromoTargetIds(promo);
    const products = (await Promise.all(productIds.map(productId => storage.getProduct(productId))))
      .filter((product): product is NonNullable<typeof product> => Boolean(product));
    if (products.length === 0) {
      return "Add one of this promo's eligible items to your cart before using the code.";
    }
    const names = products.map(product => product.name);
    const productList = names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
    return `Add ${productList} to your cart before using this promo code.`;
  }

  function promoTargetMatchesItem(target: ItemPromoTarget, item: PromoCartItem): boolean {
    const productMatches = target.productId !== undefined && target.productId === Number(item.productId);
    const categoryMatches = target.categoryId !== undefined && target.categoryId === Number(item.categoryId);
    return (productMatches || categoryMatches) && promoOptionMatches(target, item.size);
  }

  function promoOptionMatches(target: ItemPromoTarget, itemSize: string | undefined): boolean {
    if (!target.sizes?.length) return true;
    if (!itemSize) return false;
    const normalizedItemSize = itemSize.trim().toLowerCase();
    return target.sizes.some(size => size.trim().toLowerCase() === normalizedItemSize);
  }

  function getTargetedPromoSubtotal(promo: any, items: PromoCartItem[]): number {
    const targets = getItemPromoTargets(promo);
    if (targets.length === 0) return 0;

    return items.reduce((subtotal, item) => {
      if (!targets.some(target => promoTargetMatchesItem(target, item))) return subtotal;
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const unitPrice = Math.max(0, Number(item.productPrice ?? item.unitPrice) || 0);
      return subtotal + (quantity * unitPrice);
    }, 0);
  }

  function getItemPromoAllocations(promo: any, items: PromoCartItem[]) {
    const targets = getItemPromoTargets(promo);
    const maxQuantity = Math.max(1, Number(promo.itemDealQuantity) || 1);
    const promoPrice = promo.discountType === "item_free"
      ? 0
      : Math.max(0, Number(promo.discountValue) || 0);
    const allocations: Array<PromoCartItem & { itemIndex: number; quantity: number; promoPrice: number; normalUnitPrice: number }> = [];
    const allocatedQuantities = new Map<number, number>();
    let remaining = maxQuantity;

    for (const target of targets) {
      for (let itemIndex = 0; itemIndex < items.length && remaining > 0; itemIndex++) {
        const item = items[itemIndex];
        if (!promoTargetMatchesItem(target, item)) continue;
        const availableQuantity = Math.max(0, Number(item.quantity) || 0) - (allocatedQuantities.get(itemIndex) || 0);
        const quantity = Math.min(availableQuantity, remaining);
        if (quantity <= 0) continue;
        const normalUnitPrice = Math.max(0, Number(item.productPrice ?? item.unitPrice) || 0);
        allocations.push({ ...item, itemIndex, quantity, promoPrice, normalUnitPrice });
        allocatedQuantities.set(itemIndex, (allocatedQuantities.get(itemIndex) || 0) + quantity);
        remaining -= quantity;
      }
    }

    return allocations;
  }

  async function getPromoValidationError(promo: any, userId: string | undefined, cartTotal: number): Promise<string | null> {
    if (!promo) return "Code not found";
    if (!promo.isActive) return "This code is no longer active";
    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) return "This code isn't valid yet";
    if (promo.validTo && now > promo.validTo) return "This code has expired";

    if (promo.minOrderAmount != null && cartTotal < Number(promo.minOrderAmount)) {
      return `This code requires a minimum order of $${Number(promo.minOrderAmount).toFixed(2)}.`;
    }
    if (promo.maxTotalUses != null && promo.totalUses >= promo.maxTotalUses) {
      return "This code has reached its usage limit";
    }
    if (promo.usageLimitType === "once_per_user" && userId) {
      const uses = await storage.getPromoCodeUsesForUser(promo.id, userId);
      if (uses > 0) return "You've already used this code";
    }
    if (promo.discountType === "item_free" || promo.discountType === "item_price") {
      if (getItemPromoTargets(promo).length === 0) return "This item deal is not configured correctly";
      if (promo.discountType === "item_price" && (!Number.isFinite(Number(promo.discountValue)) || Number(promo.discountValue) < 0)) {
        return "This item deal has an invalid promotional price";
      }
    }
    return null;
  }

  app.post('/api/orders', async (req, res) => {
    try {
      const { order, items, cgBags: cgBagsInput = [] } = req.body;

      const orderData = insertOrderSchema.parse(order);

      const submittedPromoCodes = Array.isArray(req.body.promoCodes)
        ? req.body.promoCodes.map((code: unknown) => String(code).trim()).filter(Boolean)
        : [];
      const legacyPromoCode = String(order.promoCode || (orderData as any).promoCode || "").trim();
      let promoCodeStrings: string[];
      try {
        promoCodeStrings = normalizeSubmittedPromoCodes(
          submittedPromoCodes.length > 0 ? submittedPromoCodes : legacyPromoCode.split(","),
        );
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Duplicate promo codes are not allowed.",
        });
      }
      const verifiedPromos: any[] = [];
      let verifiedPromoSavings = 0;
      for (const promoCodeStr of promoCodeStrings) {
        const verifiedPromo = await storage.getPromoCodeByCode(promoCodeStr);
        const promoError = await getPromoValidationError(
          verifiedPromo,
          orderData.customerId || req.user?.claims?.sub,
          Number((order as any).originalTotal || orderData.total || 0),
        );
        if (promoError) return res.status(400).json({ message: promoError });
        verifiedPromos.push(verifiedPromo);
      }

      // Server-side delivery-area, delivery-block, and purchase-limit enforcement
      if (orderData.shippingAddress) {
        const addressParts = orderData.shippingAddress.split(",").map((s: string) => s.trim());
        const city = addressParts.length >= 2 ? addressParts[1] : "";
        if (!city) {
          return res.status(400).json({
            message: "A valid delivery city is required.",
            outsideDeliveryArea: true,
          });
        }

        // A city must exist on the City Purchase Limits list. Matching is
        // case-insensitive, and the stored address uses the configured spelling.
        const cityRecord = await storage.getCityByNameAny(city);
        if (!cityRecord) {
          const displayCity = city.replace(/\b\w/g, (character: string) => character.toUpperCase());
          return res.status(400).json({
            message: `${displayCity} is outside our current delivery area. Please submit a support ticket for further assistance.`,
            outsideDeliveryArea: true,
          });
        }
        addressParts[1] = cityRecord.cityName;
        orderData.shippingAddress = addressParts.join(", ");

        if (cityRecord.deliveryBlocked) {
          return res.status(400).json({
            message: `We're sorry, but we do not currently deliver to ${cityRecord.cityName}. Please contact us for more information.`,
            deliveryBlocked: true,
          });
        }

        // Check if the applied promo code bypasses the purchase minimum
        const promoBypassesMinimum = verifiedPromos.some(promo => promo.bypassPurchaseMinimum);

        if (!promoBypassesMinimum) {
          let allowed = true;
          let minimumAmount: number | null = null;

          // Use the pre-promo original total for city minimum check (rounded to cents to avoid float precision issues)
          const checkTotal = Math.round(parseFloat((order as any).originalTotal || orderData.total || "0") * 100) / 100;

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
                const cityLimit = await storage.getCityPurchaseLimitByCity(cityRecord.cityName);
                if (cityLimit) {
                  minimumAmount = parseFloat(cityLimit.minimumAmount);
                  allowed = checkTotal >= minimumAmount;
                }
              }
            } else {
              const cityLimit = await storage.getCityPurchaseLimitByCity(cityRecord.cityName);
              if (cityLimit) {
                minimumAmount = parseFloat(cityLimit.minimumAmount);
                allowed = checkTotal >= minimumAmount;
              }
            }
          } else {
            const cityLimit = await storage.getCityPurchaseLimitByCity(cityRecord.cityName);
            if (cityLimit) {
              minimumAmount = parseFloat(cityLimit.minimumAmount);
              allowed = checkTotal >= minimumAmount;
            }
          }

          if (!allowed && minimumAmount !== null) {
            return res.status(400).json({
              message: `Orders shipping to ${cityRecord.cityName} require a minimum of $${minimumAmount.toFixed(2)}. Your pre-discount order total of $${checkTotal.toFixed(2)} does not meet this minimum.`,
            });
          }
        }
      }

      // Helper: convert a size/weight label to its gram equivalent for stock comparison
      const getGramEquivalentForCheck = (sizeLabel: string | undefined): number => {
        if (!sizeLabel) return 1;
        const s = sizeLabel.toLowerCase().trim();
        if (s.includes('1/8') || s.includes('⅛')) return 3.5;
        if (s.includes('1/4') || s.includes('¼')) return 7;
        if (s.includes('1/2') || s.includes('½')) return 14;
        if ((s.includes('1') && s.includes('oz')) || s === '1oz' || s === 'ounce') return 28;
        if (s.includes('gram') || s === 'grams') return 1;
        return 1;
      };

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
        // Size-based products store inventory in product_sizes; weight/flat products use product.stock
        if (item.size && product.sizes && product.sizes.length > 0) {
          const normalizedSize = normalizeInventoryOption(item.size);
          const sizeData = product.sizes.find(
            (size: any) => normalizeInventoryOption(size.size) === normalizedSize,
          );
          if (sizeData) {
            // Has a matching product_sizes record — validate against that quantity
            if (sizeData.quantity < item.quantity) {
              stockErrors.push(`Insufficient stock for ${product.name} (${item.size}). Available: ${sizeData.quantity}, Requested: ${item.quantity}`);
              continue;
            }
          } else {
            // Weight option or no matching size row — compare grams needed vs grams in stock
            const gramsNeeded = item.quantity * getGramEquivalentForCheck(item.size);
            if (product.stock < gramsNeeded) {
              stockErrors.push(`Insufficient stock for ${product.name}. Available: ${product.stock}g, Requested: ${gramsNeeded}g`);
              continue;
            }
          }
        } else if (product.stock < item.quantity) {
          stockErrors.push(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
          continue;
        }

        // For grab bag products, also verify each component item has stock
        if ((product.sku ?? "").startsWith("GRAB-BAG-") && product.adminNotes) {
          try {
            const bagMeta = JSON.parse(product.adminNotes as string);
            if (bagMeta.items && Array.isArray(bagMeta.items)) {
              for (const bagItem of bagMeta.items) {
                if (!bagItem.productId) continue;
                const comp = await storage.getProduct(bagItem.productId);
                // Components may be inactive in storefront (sold only via grab bags) — just check existence and stock
                if (!comp) {
                  stockErrors.push(`Grab bag "${product.name}" is unavailable — item "${bagItem.name}" is no longer available.`);
                  break;
                }
                const compOutOfStock = comp.sizes && comp.sizes.length > 0
                  ? !comp.sizes.some((s: any) => (s.quantity ?? 0) > 0)
                  : (comp.stock ?? 0) <= 0;
                if (compOutOfStock) {
                  stockErrors.push(`Grab bag "${product.name}" is unavailable — item "${bagItem.name}" is out of stock.`);
                  break;
                }
              }
            }
          } catch { /* ignore parse errors */ }
          if (stockErrors.length > 0) continue;
        }

        enrichedItems.push({
          ...item,
          productSku: product.sku,
          categoryId: product.categoryId,
        });
      }

      // If there are stock errors, reject the order
      if (stockErrors.length > 0) {
        return res.status(400).json({
          message: "Order cannot be processed due to stock issues",
          errors: stockErrors
        });
      }

      // Recalculate every submitted promo in entry order. Each code is capped at
      // the remaining order value so stacked codes can never create a negative total.
      const requestedPromoSavings = Math.max(0, Number((order as any).promoDiscount) || 0);
      let remainingPromoBase = Math.max(0, Number(orderData.total || 0) + requestedPromoSavings);
      const verifiedPromoResults: Array<{ promo: any; savings: number; allocations: any[] }> = [];

      for (const promo of verifiedPromos) {
        const targets = getItemPromoTargets(promo);
        let savings = 0;
        let allocations: any[] = [];

        if (promo.discountType === "item_free" || promo.discountType === "item_price") {
          allocations = getItemPromoAllocations(promo, enrichedItems);
          if (allocations.length === 0) {
            return res.status(400).json({
              message: await getPromoEligibilityMessage(promo),
            });
          }
          savings = allocations.reduce(
            (total, allocation) => total + Math.max(0, allocation.normalUnitPrice - allocation.promoPrice) * allocation.quantity,
            0,
          );
        } else {
          const discountBase = targets.length > 0
            ? getTargetedPromoSubtotal(promo, enrichedItems)
            : remainingPromoBase;
          if (targets.length > 0 && discountBase <= 0) {
            return res.status(400).json({
              message: await getPromoEligibilityMessage(promo),
            });
          }
          const discountValue = Math.max(0, Number(promo.discountValue) || 0);
          savings = promo.discountType === "percent"
            ? discountBase * discountValue / 100
            : discountValue;
          savings = Math.min(discountBase, savings);
        }

        savings = Math.round(Math.min(remainingPromoBase, Math.max(0, savings)) * 100) / 100;
        remainingPromoBase = Math.max(0, remainingPromoBase - savings);
        verifiedPromoSavings = Math.round((verifiedPromoSavings + savings) * 100) / 100;
        verifiedPromoResults.push({ promo, savings, allocations });
      }

      if (Math.abs(verifiedPromoSavings - requestedPromoSavings) > 0.02) {
        return res.status(400).json({
          message: "Your promo discounts have changed. Please apply the codes again before placing your order.",
        });
      }

      const mutableOrderData: any = orderData;
      mutableOrderData.promoDiscount = verifiedPromoSavings.toFixed(2);
      mutableOrderData.total = Math.max(
        0,
        Number(orderData.total || 0) + requestedPromoSavings - verifiedPromoSavings,
      ).toFixed(2);

      // Preserve the existing discounted line-item display when exactly one
      // item-specific promo is used. Multiple item deals are represented in the
      // discount breakdown to avoid assigning the same quantity to two line prices.
      const itemPromoResults = verifiedPromoResults.filter(result => result.allocations.length > 0);
      if (itemPromoResults.length === 1) {
        const { promo, allocations } = itemPromoResults[0];
        const allocationsByItemIndex = new Map<number, typeof allocations[number]>();
        allocations.forEach((allocation) => allocationsByItemIndex.set(allocation.itemIndex, allocation));
        const promoAdjustedItems: any[] = [];
        enrichedItems.forEach((item: any, itemIndex: number) => {
          const allocation = allocationsByItemIndex.get(itemIndex);
          if (!allocation) {
            promoAdjustedItems.push(item);
            return;
          }
          const regularQuantity = item.quantity - allocation.quantity;
          if (regularQuantity > 0) {
            promoAdjustedItems.push({
              ...item,
              quantity: regularQuantity,
              subtotal: (allocation.normalUnitPrice * regularQuantity).toFixed(2),
            });
          }
          promoAdjustedItems.push({
            ...item,
            quantity: allocation.quantity,
            productPrice: allocation.promoPrice.toFixed(2),
            subtotal: (allocation.promoPrice * allocation.quantity).toFixed(2),
            metadata: { ...(item.metadata || {}), itemPromoCode: promo.code },
          });
        });
        enrichedItems.splice(0, enrichedItems.length, ...promoAdjustedItems);
      }

      // Persist a checkout-time snapshot of every discount shown to the customer.
      // Promo details are rebuilt from the verified server record so historical
      // orders remain accurate even if the promo is later edited or deleted.
      const submittedBreakdown = Array.isArray((order as any).discountBreakdown)
        ? (order as any).discountBreakdown
        : [];
      const discountBreakdown = submittedBreakdown
        .filter((entry: any) => entry?.type !== "promo")
        .map((entry: any) => ({
          type: entry?.type === "bogo" ? "bogo" : "automatic",
          label: String(entry?.label || "Discount").slice(0, 160),
          amount: Math.max(0, Number(entry?.amount) || 0),
          ...(entry?.description ? { description: String(entry.description).slice(0, 300) } : {}),
        }))
        .filter((entry: any) => entry.amount > 0);

      for (const result of verifiedPromoResults) {
        discountBreakdown.push({
          type: "promo",
          label: result.promo.description || `Promo code ${result.promo.code}`,
          code: result.promo.code,
          amount: result.savings,
        });
      }

      const persistedDiscountTotal = discountBreakdown.reduce(
        (sum: number, entry: any) => sum + entry.amount,
        0,
      );
      mutableOrderData.discountBreakdown = discountBreakdown;
      mutableOrderData.discountTotal = persistedDiscountTotal.toFixed(2);
      mutableOrderData.originalTotal = (
        Math.max(0, Number(mutableOrderData.total) || 0) + persistedDiscountTotal
      ).toFixed(2);
      mutableOrderData.promoCodeId = verifiedPromos[0]?.id ?? null;
      mutableOrderData.promoCode = verifiedPromos.length > 0
        ? verifiedPromos.map(promo => promo.code).join(", ")
        : null;
      mutableOrderData.promoDiscount = verifiedPromoSavings.toFixed(2);

      // Expand grab bag products into individual line items + a discount line
      const finalItems: any[] = [];

      for (const item of enrichedItems) {
        const product = await storage.getProduct(item.productId);
        const sku: string = product?.sku ?? "";
        if (product && sku.startsWith("GRAB-BAG-") && !sku.startsWith("GRAB-BAG-DISCOUNT")) {
          type BagItem = { productId: number | null; name: string; sku: string | null; price: number; selectedSize?: string };
          let bagItems: BagItem[] | null = null;

          // Try structured JSON in adminNotes (new format)
          if (product.adminNotes) {
            try {
              const parsed = JSON.parse(product.adminNotes as string);
              if (parsed.items && Array.isArray(parsed.items)) {
                bagItems = parsed.items.map((bi: any) => ({
                  productId: bi.productId ? Number(bi.productId) : null,
                  name: String(bi.name),
                  sku: bi.sku ? String(bi.sku) : null,
                  price: Number(bi.price),
                  selectedSize: bi.selectedSize ? String(bi.selectedSize) : undefined,
                }));
              }
            } catch { /* fall through */ }
          }

          // Fallback: parse description bullet format (old bags)
          if (!bagItems && product.description) {
            bagItems = (product.description as string).split("\n")
              .filter((l: string) => l.trim().startsWith("•"))
              .map((l: string) => {
                const m = l.match(/•\s+(.+?)\s+\(\$([0-9.]+)\)/);
                return m ? { productId: null, name: m[1], sku: null, price: parseFloat(m[2]) } : null;
              })
              .filter(Boolean) as BagItem[];
          }

          if (bagItems && bagItems.length > 0) {
            const sellingPrice = parseFloat(String(product.price));
            const retailTotal = bagItems.reduce((s, bi) => s + bi.price, 0);
            const discount = sellingPrice - retailTotal; // negative = savings for customer
            const purchasedQuantity = Math.max(1, Number(item.quantity) || 1);

            for (const bi of bagItems) {
              finalItems.push({
                productId: bi.productId,
                productName: bi.name,
                productSku: bi.sku ?? undefined,
                productPrice: bi.price.toFixed(2),
                quantity: purchasedQuantity,
                subtotal: (bi.price * purchasedQuantity).toFixed(2),
                fulfilled: false,
                removed: false,
                ...(bi.selectedSize ? { size: bi.selectedSize } : {}),
                // Tag so createOrder skips the per-component stock re-check
                // (components were already verified in the pre-check above).
                metadata: { fromStandardBag: true },
              });
            }

            // Add discount line only when there is a real discount
            if (Math.abs(discount) > 0.001) {
              finalItems.push({
                productId: null,
                productName: `🎁 Grab Bag Discount — ${product.name}`,
                productSku: "GRAB-BAG-DISCOUNT",
                productPrice: discount.toFixed(2),
                quantity: purchasedQuantity,
                subtotal: (discount * purchasedQuantity).toFixed(2),
                fulfilled: true,
                removed: false,
              });
            }

            continue; // skip the bag container item itself
          }
        }

        finalItems.push(item);
      }

      // Expand Customer-Generated bag items (from cgBags in the request body)
      const cgBagsInput_typed = cgBagsInput as Array<{ templateId: number; selectedCategoryIds: number[] }>;
      for (const cgBagReq of cgBagsInput_typed) {
        try {
          const template = await storage.getGrabBag(cgBagReq.templateId);
          if (!template || !(template as any).isActive || (template as any).type !== 'customer_generated') {
            stockErrors.push(`Customer-generated bag template not found or inactive.`);
            continue;
          }

          if (!cgBagReq.selectedCategoryIds || cgBagReq.selectedCategoryIds.length === 0) {
            stockErrors.push(`No categories selected for bag "${template.name}".`);
            continue;
          }

          // Custom CG bag picker for Customer-Generated bags.
          // Phase 1: pick 1 random item per selected category (no per-item price ceiling).
          // Phase 2: top-up loop — keep adding items (preferring variety, then multiples)
          //          until the retail total reaches maxTotalItemPrice (the target value).
          const cgSellingPrice = parseFloat(String(template.sellingPrice)) || 0;
          const cgTarget = parseFloat(String((template as any).maxTotalItemPrice)) || cgSellingPrice * 1.5;

          type CgPoolItem = { id: number; name: string; price: number; sku: string };
          // Map from productId → { item, quantity } to aggregate duplicates
          const cgPickMap = new Map<number, { item: CgPoolItem; qty: number }>();
          // All eligible products across all selected categories (for top-up phase)
          const cgAllPool: CgPoolItem[] = [];
          // Declared here so Phase 1 can also use it for budget checks
          const currentRetail = () =>
            [...cgPickMap.values()].reduce((s, { item, qty }) => s + item.price * qty, 0);

          // Phase 1: one random pick per category (respecting cgTarget cap)
          for (const catId of cgBagReq.selectedCategoryIds) {
            try {
              const catProducts = await storage.getProducts({ categoryIds: [catId], isActive: true });
              const eligible = catProducts
                .filter(p => {
                  if ((p.sku ?? '').startsWith('GRAB-BAG-')) return false;
                  // CG bag items skip createOrder's stock check (via metadata.fromCgBag),
                  // so we match the storefront's categoriesWithStock logic: stock OR physicalInventory > 0.
                  const hasStock = (p.stock ?? 0) > 0 || ((p as any).physicalInventory ?? 0) > 0;
                  const price = parseFloat(String(p.price ?? '')) || 0;
                  return hasStock && price > 0;
                })
                .map(p => ({ id: p.id, name: p.name, price: parseFloat(String(p.price)), sku: p.sku ?? '' }));

              // Accumulate into the shared pool for top-up (deduplicated by id)
              for (const e of eligible) {
                if (!cgAllPool.find(x => x.id === e.id)) cgAllPool.push(e);
              }

              // Only pick items that fit within the remaining budget (hard cap = cgTarget)
              const remainingBudget = cgTarget - currentRetail();
              const unpickedFitting = eligible.filter(e => !cgPickMap.has(e.id) && e.price <= remainingBudget + 0.01);
              const alreadyPickedFitting = eligible.filter(e => cgPickMap.has(e.id) && e.price <= remainingBudget + 0.01);
              const candidates = unpickedFitting.length > 0 ? unpickedFitting : alreadyPickedFitting;

              // If no item fits the budget for this category, skip it
              if (candidates.length === 0) continue;

              const firstPick = candidates[Math.floor(Math.random() * candidates.length)];
              const existing = cgPickMap.get(firstPick.id);
              if (existing) existing.qty++;
              else cgPickMap.set(firstPick.id, { item: firstPick, qty: 1 });
            } catch (catErr) {
              console.warn(`[createOrder] CG bag category ${catId} fetch error:`, catErr);
            }
          }

          if (cgPickMap.size === 0) {
            stockErrors.push(`Could not assemble bag "${template.name}": no products with stock found in the selected categories.`);
            continue;
          }

          // Phase 2: top-up loop — add more items until we reach cgTarget
          const MAX_TOPUP = 30;
          let topupCount = 0;
          while (currentRetail() < cgTarget - 0.01 && cgAllPool.length > 0 && topupCount < MAX_TOPUP) {
            const remaining = cgTarget - currentRetail();
            // Prefer items not yet in the bag for variety; fall back to already-included items
            const preferNovel = cgAllPool.filter(p => !cgPickMap.has(p.id) && p.price > 0);
            const pool = preferNovel.length > 0 ? preferNovel : cgAllPool.filter(p => p.price > 0);
            if (pool.length === 0) break;

            // Pick the highest-priced item that fits within remaining budget.
            // If nothing fits, stop — never overshoot the target cap.
            const fitting = pool.filter(p => p.price <= remaining + 0.01);
            if (fitting.length === 0) break;
            const pick = fitting.reduce((best, p) => p.price > best.price ? p : best);

            const existing = cgPickMap.get(pick.id);
            if (existing) existing.qty++;
            else cgPickMap.set(pick.id, { item: pick, qty: 1 });
            topupCount++;
          }

          const retailTotal = currentRetail();
          // discount is negative when items retail > selling price (customer savings)
          const discount = cgSellingPrice - retailTotal;

          for (const { item, qty } of cgPickMap.values()) {
            finalItems.push({
              productId: item.id,
              productName: item.name,
              productSku: item.sku || undefined,
              productPrice: item.price.toFixed(2),
              quantity: qty,
              subtotal: (item.price * qty).toFixed(2),
              fulfilled: false,
              removed: false,
              metadata: { fromCgBag: true, grabBagName: template.name },
            });
          }

          // Discount line: only add when the retail value differs from selling price
          if (discount < -0.001) {
            // Items retail exceeds selling price — customer savings (negative line)
            finalItems.push({
              productId: null,
              productName: `🎁 Grab Bag Discount — ${template.name}`,
              productSku: "GRAB-BAG-DISCOUNT",
              productPrice: discount.toFixed(2), // negative
              quantity: 1,
              subtotal: discount.toFixed(2),
              fulfilled: true,
              removed: false,
            });
          } else if (discount > 0.001) {
            // Fewer items than target (stock shortage) — balance line
            finalItems.push({
              productId: null,
              productName: `🎁 Custom Bag Balance — ${template.name}`,
              productSku: "GRAB-BAG-DISCOUNT",
              productPrice: discount.toFixed(2), // positive
              quantity: 1,
              subtotal: discount.toFixed(2),
              fulfilled: true,
              removed: false,
            });
          }

        } catch (cgErr) {
          console.error("[createOrder] CG bag expansion error:", cgErr);
          stockErrors.push(`Failed to process customer-generated bag.`);
        }
      }

      // Re-check stock errors after CG bag expansion
      if (stockErrors.length > 0) {
        return res.status(400).json({
          message: "Order cannot be processed due to stock issues",
          errors: stockErrors
        });
      }

      let itemsData: any[];
      try {
        itemsData = finalItems.map((item: any) => insertOrderItemSchema.parse(item));
      } catch (parseErr) {
        console.error('[CG-ORDER] insertOrderItemSchema.parse failed:', parseErr);
        console.error('[CG-ORDER] finalItems snapshot:', JSON.stringify(finalItems.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, metadata: i.metadata }))));
        throw parseErr;
      }

      console.log(`[CG-ORDER] Creating order with ${itemsData.length} items (cgBags: ${cgBagsInput_typed.length})`);
      const newOrder = await storage.createOrder(orderData, itemsData);

      // Sync grab bag availability — disables any bag products whose component items are now out of stock
      syncGrabBagAvailability().catch(() => {});

      // Invalidate the products cache so updated stock counts are reflected immediately
      try {
        const { invalidateCache } = await import("./cache");
        invalidateCache.products();
      } catch (cacheErr) {
        console.warn('[createOrder] Cache invalidation failed:', cacheErr);
      }

      // Track usage for every applied promo code.
      if (verifiedPromos.length > 0) {
        try {
          for (const promoRecord of verifiedPromos) {
            await storage.incrementPromoCodeTotalUses(promoRecord.id);
            if (orderData.customerId) {
              await storage.recordPromoCodeUse(promoRecord.id, orderData.customerId);
            }
          }
        } catch (promoTrackError) {
          console.error('Failed to track promo code usage:', promoTrackError);
          // Don't fail the order creation if promo tracking fails
        }
      }

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

      // Create notifications for staff, managers, and admins about the new order.
      // Drivers receive order information only after an order is assigned to them.
      try {
        const staffUsers = await storage.getStaffUsers();
        for (const user of staffUsers.filter((user) => user.role !== 'driver')) {
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

      // Re-sync grab bag availability after any status change that could restore stock (e.g. cancellation)
      syncGrabBagAvailability().catch(() => {});

      // Once an order enters Shipped, route it to the driver assigned to its
      // delivery city unless staff already chose a driver manually.
      if (status === "shipped") {
        try {
          const automaticAssignment = await storage.autoAssignOrderByCity(id);
          if (automaticAssignment) {
            await storage.createNotification({
              userId: automaticAssignment.driver.id,
              type: "order_assigned",
              title: "Order Assigned",
              message: `Order #${automaticAssignment.order.orderNumber} has been assigned to you`,
              data: {
                orderId: automaticAssignment.order.id,
                orderNumber: automaticAssignment.order.orderNumber,
              },
            });
          }
        } catch (assignmentError) {
          // A missing city mapping must not prevent the status update.
          console.error("Failed to auto-assign shipped order:", assignmentError);
        }
      }

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

  // Return active orders with unchecked items to New Orders without
  // changing any item's fulfillment state.
  app.post('/api/orders/:id/reconcile-fulfillment', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.reopenOrderIfUnfulfilled(id);
      res.json(order);
    } catch (error: any) {
      console.error('Failed to reconcile order fulfillment:', error);
      if (error?.message === "Order not found") {
        return res.status(404).json({ message: "Order not found" });
      }
      res.status(500).json({ message: "Failed to reconcile order fulfillment" });
    }
  });

  // Admin: change payment method (prepay / cod), optionally uploading a photo
  app.patch('/api/orders/:id/payment-method', isAuthenticated, requireRole(['admin']), upload.single('photo'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { paymentMethod } = req.body;
      if (!paymentMethod || !['prepay', 'cod'].includes(paymentMethod)) {
        return res.status(400).json({ message: 'paymentMethod must be "prepay" or "cod"' });
      }

      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      let photoUrl: string | null | undefined = undefined;

      if (req.file) {
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
        await file.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
        photoUrl = `/api/payment-photos/${uniqueId}${extension}`;
      } else if (paymentMethod === 'cod') {
        // Switching to COD — clear existing photo
        photoUrl = null;
      }

      const updatedOrder = await storage.updateOrderPaymentMethod(id, paymentMethod, photoUrl);
      res.json(updatedOrder);
    } catch (error) {
      console.error('Failed to update payment method:', error);
      res.status(500).json({ message: 'Failed to update payment method' });
    }
  });

  // Admin: upload/replace payment photo for an order
  app.post('/api/orders/:id/payment-photo', isAuthenticated, requireRole(['admin']), upload.single('photo'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!req.file) {
        return res.status(400).json({ message: 'No photo file provided' });
      }

      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: 'Order not found' });
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
      const updatedOrder = await storage.updateOrderPaymentPhoto(id, photoUrl);
      res.json(updatedOrder);
    } catch (error) {
      console.error('Failed to upload payment photo:', error);
      res.status(500).json({ message: 'Failed to upload payment photo' });
    }
  });

  // Admin: delete payment photo for an order
  app.delete('/api/orders/:id/payment-photo', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      const updatedOrder = await storage.updateOrderPaymentPhoto(id, null);
      res.json(updatedOrder);
    } catch (error) {
      console.error('Failed to delete payment photo:', error);
      res.status(500).json({ message: 'Failed to delete payment photo' });
    }
  });

  app.patch('/api/orders/:id/items/:itemId/price', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const { price } = req.body;

      if (price === undefined || price === null || isNaN(parseFloat(price))) {
        return res.status(400).json({ message: "A valid price is required" });
      }
      const numericPrice = parseFloat(price);
      if (numericPrice < 0) {
        return res.status(400).json({ message: "Price cannot be negative" });
      }

      const updatedOrder = await storage.updateOrderItemPrice(orderId, itemId, numericPrice);
      res.json(updatedOrder);
    } catch (error: any) {
      console.error('Failed to update item price:', error);
      res.status(500).json({ message: error.message || "Failed to update item price" });
    }
  });

  app.patch('/api/orders/:id/notes', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      if (notes === undefined || notes === null) {
        return res.status(400).json({ message: "notes field is required" });
      }
      const order = await storage.updateOrderNotes(id, String(notes));
      res.json(order);
    } catch (error) {
      console.error('Failed to update order notes:', error);
      res.status(500).json({ message: "Failed to update order notes" });
    }
  });

  app.patch('/api/orders/:id/shipping-address', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { shippingAddress } = req.body;
      if (!shippingAddress || typeof shippingAddress !== 'string' || !shippingAddress.trim()) {
        return res.status(400).json({ message: "A valid shipping address is required" });
      }
      const order = await storage.updateOrderShippingAddress(id, shippingAddress.trim());
      res.json(order);
    } catch (error) {
      console.error('Failed to update shipping address:', error);
      res.status(500).json({ message: "Failed to update shipping address" });
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

      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (existingOrder.status !== 'shipped' || existingOrder.archived) {
        return res.status(400).json({ message: "Drivers can only be assigned to orders in the Shipped column" });
      }

      let assignedDriver = null;
      if (assignedUserId) {
        assignedDriver = await storage.getUser(assignedUserId);
        if (assignedDriver?.role !== 'driver' || assignedDriver.status !== 'active') {
          return res.status(400).json({ message: "Orders can only be assigned to active drivers" });
        }
      }

      const order = await storage.assignOrderToUser(id, assignedUserId || null);

      try {
        if (assignedDriver) {
          await storage.createNotification({
            userId: assignedDriver.id,
            type: 'order_assigned',
            title: 'Order Assigned',
            message: `Order #${order.orderNumber} has been assigned to you`,
            data: { orderId: order.id, orderNumber: order.orderNumber }
          });
        }
      } catch (notificationError) {
        console.error('Failed to create assignment notification:', notificationError);
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign order" });
    }
  });

  // Delete all archived orders — must be before /:id to avoid "archived" being parsed as an id
  app.delete('/api/orders/archived', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      await storage.clearArchivedOrders();
      res.json({ message: "All archived orders have been cleared" });
    } catch (error) {
      console.error('Failed to clear archived orders:', error);
      res.status(500).json({ message: "Failed to clear archived orders" });
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

  // Archive all shipped orders
  // Archive a single order (sets archived = true)
  app.put('/api/orders/:id/archive', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { sql: pool } = await import("./db");
      await pool.query(`UPDATE orders SET archived = true, updated_at = NOW() WHERE id = $1`, [id]);
      res.json({ message: "Order archived successfully" });
    } catch (error) {
      console.error('Failed to archive order:', error);
      res.status(500).json({ message: "Failed to archive order" });
    }
  });

  app.post('/api/orders/archive-all-shipped', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const { sql: pool } = await import("./db");
      await pool.query(`UPDATE orders SET archived = true, updated_at = NOW() WHERE status = 'shipped' AND archived = false`);
      res.json({ message: "All shipped orders have been archived" });
    } catch (error) {
      console.error('Failed to archive shipped orders:', error);
      res.status(500).json({ message: "Failed to archive shipped orders" });
    }
  });

  // Bulk ship all packed orders
  app.post('/api/orders/ship-all-packed', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const { sql: pool } = await import("./db");
      await pool.query(`UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE status = 'packed'`);
      res.json({ message: "All packed orders have been shipped" });
    } catch (error) {
      console.error('Failed to ship all packed orders:', error);
      res.status(500).json({ message: "Failed to ship all packed orders" });
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
      const requestedProductId = productId === null || productId === undefined || productId === ""
        ? null
        : Number(productId);
      const requestedOrderItemId = orderItemId === null || orderItemId === undefined || orderItemId === ""
        ? null
        : Number(orderItemId);
      const requestedQuantity = Number(quantity);

      if (
        !Number.isInteger(requestedQuantity) ||
        requestedQuantity <= 0 ||
        (requestedProductId !== null && (!Number.isInteger(requestedProductId) || requestedProductId <= 0)) ||
        (requestedOrderItemId !== null && (!Number.isInteger(requestedOrderItemId) || requestedOrderItemId <= 0)) ||
        (requestedProductId === null && requestedOrderItemId === null)
      ) {
        return res.status(400).json({ message: "Order item and positive quantity are required" });
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

      // Verify the specific order item exists (match by item ID when provided)
      const orderItem = requestedOrderItemId !== null
        ? order.items?.find(item => item.id === requestedOrderItemId)
        : order.items?.find(item => item.productId === requestedProductId && !item.fulfilled);
      if (!orderItem) {
        return res.status(400).json({ message: "Product is not part of this order" });
      }

      if (requestedProductId !== null && orderItem.productId !== requestedProductId) {
        return res.status(400).json({ message: "Product does not match order item" });
      }

      if (orderItem.fulfilled) {
        return res.status(400).json({ message: "This order item has already been fulfilled" });
      }

      if (requestedQuantity > orderItem.quantity) {
        return res.status(400).json({ message: `Order only requires ${orderItem.quantity} units` });
      }

      const isCustomItem = orderItem.productId === null;
      if (isCustomItem) {
        await storage.fulfillOrderItem(orderId, null, requestedQuantity, req.currentUser.id, requestedOrderItemId ?? undefined);
        return res.status(200).json({ message: "Custom order item marked as fulfilled" });
      }

      if (requestedProductId === null || orderItem.productId === null) {
        return res.status(400).json({ message: "Product ID is required for catalog items" });
      }

      const fulfillmentProductId = orderItem.productId;

      // The locked storage transaction is the inventory authority. It checks the
      // selected variant when variants exist and the parent ledger otherwise.
      await storage.fulfillOrderItem(orderId, fulfillmentProductId, requestedQuantity, req.currentUser.id, requestedOrderItemId ?? undefined);

      // Invalidate products cache so physical inventory reflects immediately
      try {
        const { invalidateCache } = await import("./cache");
        invalidateCache.products();
      } catch (_) {}

      res.status(200).json({ message: "Order item fulfilled successfully" });
    } catch (error: any) {
      console.error('Order fulfillment error:', error);
      const knownErrors = [
        'Insufficient physical inventory',
        'Product not found',
        'Order item not found',
        'Product does not match order item',
        'Order item is not a custom item',
        'The exact reserved size or flavor is missing',
      ];
      if (error?.message && knownErrors.some(msg => error.message.includes(msg))) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fulfill order item" });
    }
  });

  // Order item unfulfillment route (reverse inventory)
  app.post('/api/orders/:id/unfulfill-item', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { productId, quantity, orderItemId } = req.body;
      const requestedProductId = productId === null || productId === undefined || productId === ""
        ? null
        : Number(productId);
      const requestedOrderItemId = orderItemId === null || orderItemId === undefined || orderItemId === ""
        ? null
        : Number(orderItemId);
      const requestedQuantity = Number(quantity);

      if (
        !Number.isInteger(requestedQuantity) ||
        requestedQuantity <= 0 ||
        (requestedProductId !== null && (!Number.isInteger(requestedProductId) || requestedProductId <= 0)) ||
        (requestedOrderItemId !== null && (!Number.isInteger(requestedOrderItemId) || requestedOrderItemId <= 0)) ||
        (requestedProductId === null && requestedOrderItemId === null)
      ) {
        return res.status(400).json({ message: "Order item and positive quantity are required" });
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
      const orderItem = requestedOrderItemId !== null
        ? order.items?.find(item => item.id === requestedOrderItemId)
        : order.items?.find(item => item.productId === requestedProductId && item.fulfilled);
      if (!orderItem) {
        return res.status(400).json({ message: "Product is not part of this order" });
      }

      if (requestedProductId !== null && orderItem.productId !== requestedProductId) {
        return res.status(400).json({ message: "Product does not match order item" });
      }

      if (!orderItem.fulfilled) {
        return res.status(400).json({ message: "This order item is not fulfilled" });
      }

      const isCustomItem = orderItem.productId === null;
      if (isCustomItem) {
        await storage.unfulfillOrderItem(orderId, null, orderItem.quantity, req.currentUser.id, requestedOrderItemId ?? undefined);
        return res.status(200).json({ message: "Custom order item marked as unfulfilled" });
      }

      if (requestedProductId === null || orderItem.productId === null) {
        return res.status(400).json({ message: "Product ID is required for catalog items" });
      }

      // Unfulfill the item (restore physical inventory and mark as not fulfilled)
      // Use the order item's actual quantity instead of client-supplied value for security
      await storage.unfulfillOrderItem(orderId, orderItem.productId, orderItem.quantity, req.currentUser.id, requestedOrderItemId ?? undefined);

      // Invalidate products cache so physical inventory reflects immediately
      try {
        const { invalidateCache } = await import("./cache");
        invalidateCache.products();
      } catch (_) {}

      res.status(200).json({ message: "Order item unfulfilled successfully" });
    } catch (error: any) {
      console.error('Order unfulfillment error:', error);
      const knownErrors = [
        'Product not found',
        'Order item not found',
        'Product does not match order item',
        'Order item is not a custom item',
        'Order item is not fulfilled',
      ];
      if (error?.message && knownErrors.some(msg => error.message.includes(msg))) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to unfulfill order item" });
    }
  });

  // Remove order item (admin only)
  app.post('/api/orders/:id/remove-item', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { itemId } = req.body;
      if (!itemId) return res.status(400).json({ message: "itemId is required" });

      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (['shipped', 'cancelled'].includes(order.status)) {
        return res.status(400).json({ message: "Cannot remove items from shipped or cancelled orders" });
      }

      await storage.removeOrderItem(orderId, itemId, req.currentUser.id);
      syncGrabBagAvailability().catch(() => {});
      const updatedOrder = await storage.getOrder(orderId);
      res.status(200).json(updatedOrder);
    } catch (error: any) {
      console.error('Remove item error:', error);
      res.status(500).json({ message: error.message || "Failed to remove item" });
    }
  });

  // Add order item (admin only)
  app.post('/api/orders/:id/add-item', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { productId, quantity, unitPrice, unitLabel } = req.body;
      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "productId and quantity are required" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (['shipped', 'cancelled'].includes(order.status)) {
        return res.status(400).json({ message: "Cannot add items to shipped or cancelled orders" });
      }

      await storage.addOrderItem(
        orderId,
        Number(productId),
        Number(quantity),
        req.currentUser.id,
        unitPrice != null ? Number(unitPrice) : undefined,
        typeof unitLabel === "string" && unitLabel.trim() ? unitLabel.trim() : undefined,
      );
      await storage.reopenOrderIfUnfulfilled(orderId);
      syncGrabBagAvailability().catch(() => {});
      const updatedOrder = await storage.getOrder(orderId);
      res.status(200).json(updatedOrder);
    } catch (error: any) {
      console.error('Add item error:', error);
      res.status(500).json({ message: error.message || "Failed to add item" });
    }
  });

  // Add custom (one-off) item to order — no product record, no stock change (admin only)
  app.post('/api/orders/:id/add-custom-item', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { customName, price, quantity } = req.body;
      if (!customName || customName.trim() === '') {
        return res.status(400).json({ message: "customName is required" });
      }
      if (price == null || isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({ message: "A valid price is required" });
      }
      if (!quantity || Number(quantity) <= 0) {
        return res.status(400).json({ message: "A positive quantity is required" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (['shipped', 'cancelled'].includes(order.status)) {
        return res.status(400).json({ message: "Cannot add items to shipped or cancelled orders" });
      }

      await storage.addCustomOrderItem(orderId, customName.trim(), Number(price), Number(quantity), req.currentUser.id);
      await storage.reopenOrderIfUnfulfilled(orderId);
      const updatedOrder = await storage.getOrder(orderId);
      res.status(200).json(updatedOrder);
    } catch (error: any) {
      console.error('Add custom item error:', error);
      res.status(500).json({ message: error.message || "Failed to add custom item" });
    }
  });

  // Substitute order item (admin only)
  app.post('/api/orders/:id/substitute-item', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { oldItemId, newProductId, quantity, unitLabel, unitPrice } = req.body;

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
      await storage.substituteOrderItem(
        orderId,
        oldItemId,
        newProductId,
        Number(quantity),
        req.currentUser.id,
        typeof unitLabel === "string" && unitLabel.trim() ? unitLabel.trim() : undefined,
        unitPrice != null ? Number(unitPrice) : undefined,
      );
      await storage.reopenOrderIfUnfulfilled(orderId);
      syncGrabBagAvailability().catch(() => {});

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

      // Get hourly data for today (live + snapshot)
      const rawResult = await db.execute(sql`
        WITH all_orders AS (
          SELECT total, created_at, status FROM orders
          UNION ALL
          SELECT total, created_at, status FROM analytics_orders_snapshot
        )
        SELECT
          EXTRACT(HOUR FROM created_at) AS hour,
          COALESCE(SUM(CAST(total AS NUMERIC)), 0) AS sales,
          COUNT(*) AS orders
        FROM all_orders
        WHERE created_at >= ${startOfDay} AND created_at < ${endOfDay}
          AND status IN ('shipped', 'processing', 'pending', 'packed', 'delivered', 'completed')
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY EXTRACT(HOUR FROM created_at)
      `);
      const result = (rawResult.rows as any[]).map(r => ({ hour: String(r.hour), sales: Number(r.sales), orders: Number(r.orders) }));

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

      // Live order items for today
      const liveTopProducts = await db
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
            inArray(orders.status, ['shipped', 'processing', 'pending', 'packed', 'delivered', 'completed'])
          )
        )
        .groupBy(products.id)
        .orderBy(desc(sql`SUM(CAST(${orderItems.subtotal} AS NUMERIC))`))
        .limit(10);

      // Snapshot items for today
      const snapTop = await db.execute(sql`
        SELECT s.product_id, s.product_name, SUM(s.quantity) AS sales, SUM(CAST(s.subtotal AS NUMERIC)) AS revenue
        FROM analytics_order_items_snapshot s
        INNER JOIN analytics_orders_snapshot ao ON s.original_order_id = ao.original_order_id
        WHERE ao.created_at >= ${startOfDay} AND ao.created_at < ${endOfDay}
          AND ao.status IN ('shipped', 'processing', 'pending', 'packed', 'delivered', 'completed')
          AND s.product_id IS NOT NULL
        GROUP BY s.product_id, s.product_name
      `);

      // Merge live + snapshot results
      const merged = new Map<number, any>();
      for (const r of liveTopProducts) {
        merged.set(r.product.id, { product: r.product, sales: Number(r.sales), revenue: Number(r.revenue) });
      }
      for (const snap of (snapTop.rows as any[])) {
        const pid = Number(snap.product_id);
        if (merged.has(pid)) {
          const ex = merged.get(pid)!;
          ex.sales += Number(snap.sales);
          ex.revenue += Number(snap.revenue);
        } else {
          const [prod] = await db.select().from(products).where(eq(products.id, pid));
          if (prod) merged.set(pid, { product: prod, sales: Number(snap.sales), revenue: Number(snap.revenue) });
        }
      }
      const topProducts = Array.from(merged.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

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

      // Get customers who ordered today (live + snapshot) with no prior orders
      const newCustResult = await db.execute(sql`
        WITH all_orders AS (
          SELECT customer_id, created_at, status FROM orders
          UNION ALL
          SELECT customer_id, created_at, status FROM analytics_orders_snapshot
        ),
        today_customers AS (
          SELECT DISTINCT customer_id
          FROM all_orders
          WHERE created_at >= ${startOfDay} AND created_at < ${endOfDay}
            AND status IN ('shipped', 'processing', 'pending', 'packed', 'delivered', 'completed')
            AND customer_id IS NOT NULL
        ),
        new_customers AS (
          SELECT tc.customer_id
          FROM today_customers tc
          WHERE NOT EXISTS (
            SELECT 1 FROM all_orders ao
            WHERE ao.customer_id = tc.customer_id AND ao.created_at < ${startOfDay}
          )
        )
        SELECT COUNT(*) AS count FROM new_customers
      `);

      res.json({
        newCustomersToday: Number((newCustResult.rows[0] as any)?.count || 0)
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

      // Get return customers who ordered today (live + snapshot)
      const returnCustResult = await db.execute(sql`
        WITH all_orders AS (
          SELECT customer_id, created_at, status FROM orders
          UNION ALL
          SELECT customer_id, created_at, status FROM analytics_orders_snapshot
        ),
        today_customers AS (
          SELECT DISTINCT customer_id
          FROM all_orders
          WHERE created_at >= ${startOfDay} AND created_at < ${endOfDay}
            AND status IN ('shipped', 'processing', 'pending', 'packed', 'delivered', 'completed')
            AND customer_id IS NOT NULL
        ),
        return_customers AS (
          SELECT tc.customer_id
          FROM today_customers tc
          WHERE EXISTS (
            SELECT 1 FROM all_orders ao
            WHERE ao.customer_id = tc.customer_id AND ao.created_at < ${startOfDay}
          )
        )
        SELECT COUNT(*) AS count FROM return_customers
      `);

      res.json({
        returnCustomersToday: Number((returnCustResult.rows[0] as any)?.count || 0)
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
        WITH all_orders AS (
          SELECT o.id, o.total, o.status, o.created_at,
            COALESCE(u.city, 'Unknown') AS city
          FROM orders o
          LEFT JOIN users u ON o.customer_id = u.id
          UNION ALL
          SELECT s.original_order_id AS id, s.total, s.status, s.created_at,
            COALESCE(s.customer_city, 'Unknown') AS city
          FROM analytics_orders_snapshot s
        )
        SELECT
          city,
          COUNT(id)::int AS total_orders,
          COALESCE(SUM(total::numeric), 0)::float AS total_revenue,
          COUNT(CASE WHEN status IN ('pending', 'processing', 'packed') THEN 1 END)::int AS outstanding_orders,
          COUNT(CASE WHEN status IN ('shipped', 'delivered', 'completed') THEN 1 END)::int AS completed_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_orders,
          COUNT(CASE WHEN status = 'processing' THEN 1 END)::int AS processing_orders,
          COUNT(CASE WHEN status = 'packed' THEN 1 END)::int AS packed_orders,
          COUNT(CASE WHEN status = 'shipped' THEN 1 END)::int AS shipped_orders,
          COALESCE(AVG(total::numeric), 0)::float AS avg_order_value,
          MAX(created_at) AS last_order_date
        FROM all_orders
        WHERE created_at >= ${since}
        GROUP BY city
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

  // Mark ALL notifications as read (bulk)
  app.put("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.currentUser.id);
      res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Delete all read notifications (bulk)
  app.delete("/api/notifications/clear-read", isAuthenticated, async (req: any, res) => {
    try {
      await storage.clearReadNotifications(req.currentUser.id);
      res.status(200).json({ message: "Read notifications cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear read notifications" });
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
      const page = Math.max(1, parseInt(String(req.query.page || '1')));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'))));
      const search = String(req.query.search || '').trim();
      const sortBy = z.enum(["user", "address", "role", "status", "joined"]).catch("joined").parse(req.query.sortBy);
      const sortDirection = z.enum(["asc", "desc"]).catch("desc").parse(req.query.sortDirection);
      const result = await storage.getUsersWithStatsPaginated({ page, limit, search, sortBy, sortDirection });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/attention-counts', isAuthenticated, requireRole(['admin', 'manager', 'staff']), async (_req, res) => {
    try {
      const [pendingSupportTickets, pendingUserApprovals, newOrders] = await Promise.all([
        storage.getPendingSupportTicketCount(),
        storage.getPendingUserCount(),
        storage.getNewOrderCount(),
      ]);
      res.set('Cache-Control', 'no-store');
      res.json({ pendingSupportTickets, pendingUserApprovals, newOrders });
    } catch (error) {
      console.error('Failed to fetch admin attention counts:', error);
      res.status(500).json({ message: 'Failed to fetch admin attention counts' });
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

  app.get('/api/users/drivers', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const driverUsers = await storage.getDriverUsers();
      res.json(driverUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  app.get('/api/driver-delivery-cities/cities', isAuthenticated, requireRole(['admin', 'manager']), async (_req, res) => {
    try {
      const cities = await storage.getCityPurchaseLimits();
      res.json(cities.filter((city) => city.isActive && !city.deliveryBlocked));
    } catch (error) {
      console.error("Failed to fetch driver delivery cities:", error);
      res.status(500).json({ message: "Failed to fetch delivery cities" });
    }
  });

  app.put('/api/users/:id/delivery-cities', isAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const driverUserId = req.params.id;
      const { cityNames } = req.body ?? {};
      if (!Array.isArray(cityNames) || cityNames.some((city) => typeof city !== "string")) {
        return res.status(400).json({ message: "cityNames must be an array of city names" });
      }

      const assignments = await storage.setDriverDeliveryCities(driverUserId, cityNames);
      const autoAssignments = await storage.autoAssignUnassignedShippedOrders();

      for (const assignment of autoAssignments) {
        try {
          await storage.createNotification({
            userId: assignment.driver.id,
            type: "order_assigned",
            title: "Order Assigned",
            message: `Order #${assignment.order.orderNumber} has been assigned to you`,
            data: {
              orderId: assignment.order.id,
              orderNumber: assignment.order.orderNumber,
            },
          });
        } catch (notificationError) {
          console.error("Failed to notify driver of city assignment:", notificationError);
        }
      }

      res.json({
        assignments,
        autoAssignedOrderCount: autoAssignments.length,
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({
          message: "One or more selected cities are already assigned to another driver",
        });
      }
      if (error?.message?.includes("active driver") || error?.message?.includes("active delivery city")) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Failed to save driver delivery cities:", error);
      res.status(500).json({ message: "Failed to save driver delivery cities" });
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
      let userData = req.body ?? {};
      const isAdmin = req.currentUser.role === 'admin';

      // Only administrators can manage other accounts or update protected fields.
      // Every other role may edit only its own limited profile fields.
      if (!isAdmin && req.currentUser.id !== id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (Object.prototype.hasOwnProperty.call(userData, 'telegramUsername')) {
        const submittedTelegramUsername = typeof userData.telegramUsername === 'string'
          ? userData.telegramUsername.trim()
          : '';

        if (!submittedTelegramUsername) {
          const targetUser = await storage.getUser(id);
          if (normalizeTelegramUsername(targetUser?.telegramUsername)) {
            return res.status(400).json({ message: "A saved Telegram username cannot be removed." });
          }

          const { telegramUsername: _, ...dataWithoutTelegramUsername } = userData;
          userData = dataWithoutTelegramUsername;
        } else {
          const telegramUsername = normalizeTelegramUsername(submittedTelegramUsername);
          if (!telegramUsername) {
            return res.status(400).json({ message: "Telegram usernames must use 5-32 letters, numbers, or underscores." });
          }
          userData = { ...userData, telegramUsername };
        }
      }

      if (!isAdmin) {
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
  app.delete('/api/admin/inventory-logs', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      await storage.clearInventoryLogs();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear inventory logs" });
    }
  });

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
      const { userId: _ignoredUserId, ...publicTicketData } = ticketData;
      const ticket = await storage.createSupportTicket(publicTicketData);

      // Push real-time notification to all admin/manager clients
      broadcastToClients({ type: 'new_support_ticket', ticketId: ticket.id });

      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      console.error("Support ticket error:", error);
      res.status(500).json({ message: "Failed to create support ticket" });
    }
  });

  // Authenticated self-service support: always link the ticket to the signed-in user.
  app.post('/api/support/my-tickets', isAuthenticated, async (req: any, res) => {
    try {
      const ticketData = insertSupportTicketSchema.parse(req.body);
      const { userId: _ignoredUserId, ...rest } = ticketData;
      const ticket = await storage.createSupportTicket({
        ...rest,
        userId: req.currentUser.id,
        customerTelegram: req.currentUser.telegramUsername || null,
      });

      broadcastToClients({ type: 'new_support_ticket', ticketId: ticket.id });
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      console.error("Authenticated support ticket error:", error);
      res.status(500).json({ message: "Failed to create support ticket" });
    }
  });

  // Customer: get their own tickets
  app.get('/api/support/my-tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser.id;
      const tickets = await storage.getCustomerTickets(userId);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch your tickets" });
    }
  });

  // Upload image for support ticket — public version (no auth required, used by landing-page form)
  app.post('/api/support/ticket-images/public', upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No image file provided' });
      const compressedBuffer = await sharp(req.file.buffer)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const uniqueId = uuidv4();
      const objectName = `support-images/${uniqueId}.webp`;
      const fullPath = `${privateDir}/${objectName}`;
      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);
      await file.save(compressedBuffer, { metadata: { contentType: 'image/webp' } });
      res.json({ imageUrl: `/api/support-images/${uniqueId}.webp` });
    } catch (error) {
      console.error('Support ticket image upload error:', error);
      res.status(500).json({ message: 'Failed to upload image' });
    }
  });

  // Upload image for support ticket (any authenticated user)
  app.post('/api/support/ticket-images', isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      const compressedBuffer = await sharp(req.file.buffer)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const uniqueId = uuidv4();
      const objectName = `support-images/${uniqueId}.webp`;
      const fullPath = `${privateDir}/${objectName}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);
      await file.save(compressedBuffer, { metadata: { contentType: 'image/webp', metadata: { uploadedBy: req.currentUser.id } } });

      res.json({ imageUrl: `/api/support-images/${uniqueId}.webp` });
    } catch (error) {
      console.error('Support ticket image upload error:', error);
      res.status(500).json({ message: 'Failed to upload image' });
    }
  });

  // Serve support ticket images
  app.get('/api/support-images/:filename', isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateDir}/support-images/${req.params.filename}`;

      const parts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ message: 'Image not found' });

      const [metadata] = await file.getMetadata();
      if (req.currentUser.status === "pending" && metadata.metadata?.uploadedBy !== req.currentUser.id) {
        const imageUrl = `/api/support-images/${req.params.filename}`;
        const tickets = await storage.getCustomerTickets(req.currentUser.id);
        // Staff attachments are accessible only in this user's conversations.
        const belongsToStaffReply = tickets.some(({ responses }) => responses.some((response) => {
          if (response.createdBy === req.currentUser.id || !response.imageUrls) return false;
          try {
            const urls = JSON.parse(response.imageUrls);
            return Array.isArray(urls) && urls.includes(imageUrl);
          } catch {
            return false;
          }
        }));
        if (!belongsToStaffReply) return res.status(403).json({ message: "You cannot access this support attachment." });
      }
      res.set({
        'Content-Type': metadata.contentType || 'image/webp',
        'Cache-Control': req.currentUser.status === "pending" ? 'private, no-store' : 'private, max-age=3600',
      });
      file.createReadStream().pipe(res);
    } catch (error) {
      res.status(500).json({ message: 'Failed to serve image' });
    }
  });

  // Customer: reply to their own ticket
  app.post('/api/support/tickets/:id/customer-reply', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { message, imageUrls } = req.body;
      const userId = req.currentUser.id;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Verify this ticket belongs to the customer
      const tickets = await storage.getCustomerTickets(userId);
      const ticket = tickets.find(t => t.ticket.id === id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      if (ticket.ticket.status === 'closed') {
        return res.status(400).json({ message: "Cannot reply to a closed ticket" });
      }

      const response = await storage.addSupportTicketResponse(id, {
        message: message.trim(),
        type: 'customer',
        createdBy: userId,
        imageUrls: imageUrls ? JSON.stringify(imageUrls) : undefined,
      });

      broadcastToClients({ type: 'ticket_reply', ticketId: id });

      res.status(201).json(response);
    } catch (error) {
      console.error("Customer reply error:", error);
      res.status(500).json({ message: "Failed to send reply" });
    }
  });

  // Customer: request ticket closure
  app.put('/api/support/tickets/:id/request-close', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.currentUser.id;

      const tickets = await storage.getCustomerTickets(userId);
      const ticket = tickets.find(t => t.ticket.id === id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      const updated = await storage.updateSupportTicketStatus(id, 'close_requested');
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to request ticket closure" });
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
      const { response, type, imageUrls } = req.body;

      if (!response || !type) {
        return res.status(400).json({ message: "Response and type are required" });
      }

      const ticketResponse = await storage.addSupportTicketResponse(id, {
        message: response,
        type,
        createdBy: req.currentUser.id,
        imageUrls: imageUrls ? JSON.stringify(imageUrls) : undefined,
      });

      // Auto-advance status from 'open' to 'in_progress' on first staff reply
      try {
        const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
        if (ticket?.status === 'open') {
          await storage.updateSupportTicketStatus(id, 'in_progress');
        }
        // Notify the customer if they have a userId linked
        if (ticket?.userId) {
          await storage.createNotification({
            userId: ticket.userId,
            type: 'support_reply',
            title: 'Support Team Replied',
            message: `Your support ticket #${id} received a new reply from our team.`,
            data: { ticketId: id },
          });
        }
      } catch (notifyErr) {
        console.error("Failed to update ticket status or notify customer:", notifyErr);
      }

      broadcastToClients({ type: 'ticket_reply', ticketId: id });

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

  app.put('/api/support/tickets/:id/unarchive', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ticket ID" });
      }
      const ticket = await storage.unarchiveSupportTicket(id);
      res.json(ticket);
    } catch (error) {
      console.error("Failed to unarchive support ticket:", error);
      res.status(500).json({ message: "Failed to unarchive support ticket" });
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
      const { city, total, userId, bypassMinimum = false } = req.body;
      console.log('[check-purchase-limit] Request:', { city, total, userId });

      if (!city || !String(city).trim()) {
        return res.status(400).json({
          allowed: false,
          outsideDeliveryArea: true,
          message: "A delivery city is required.",
        });
      }

      // Delivery-area eligibility is independent of minimum exemptions.
      const cityRecord = await storage.getCityByNameAny(String(city).trim());
      if (!cityRecord) {
        const displayCity = String(city).trim().replace(/\b\w/g, (character) => character.toUpperCase());
        return res.json({
          allowed: false,
          outsideDeliveryArea: true,
          message: `${displayCity} is outside our current delivery area. Please submit a support ticket for further assistance.`,
        });
      }

      if (cityRecord.deliveryBlocked) {
        return res.json({
          allowed: false,
          deliveryBlocked: true,
          cityName: cityRecord.cityName,
        });
      }

      if (bypassMinimum === true) {
        return res.json({
          allowed: true,
          minimumAmount: null,
          bypassMinimum: true,
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

      const cityLimit = await storage.getCityPurchaseLimitByCity(cityRecord.cityName);
      if (!cityLimit) {
        return res.json({
          allowed: true,
          minimumAmount: null,
          cityName: cityRecord.cityName,
        });
      }

      const minimumAmount = parseFloat(cityLimit.minimumAmount);
      const orderTotal = Math.round(parseFloat(total) * 100) / 100;

      res.json({
        allowed: orderTotal >= minimumAmount,
        minimumAmount,
        cityName: cityLimit.cityName,
      });
    } catch (error) {
      console.error('Error checking purchase limit:', error);
      res.status(500).json({
        allowed: false,
        verificationFailed: true,
        message: "Could not verify the delivery area.",
      });
    }
  });

  // Access password routes
  // Access Password Routes

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

  // Site settings - get a setting (public for feature flags)
  app.get("/api/settings/:key", async (req, res) => {
    try {
      const value = await storage.getSiteSetting(req.params.key);
      res.json({ key: req.params.key, value });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  // Site settings - update a setting (admin only)
  app.put("/api/admin/settings/:key", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const { value } = req.body;
      if (value === undefined) return res.status(400).json({ message: "value is required" });
      await storage.setSiteSetting(req.params.key, String(value));
      res.json({ key: req.params.key, value: String(value) });
    } catch (error) {
      res.status(500).json({ message: "Failed to update setting" });
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
      const { code, cartTotal, items = [] } = req.body;
      if (!code) return res.status(400).json({ valid: false, message: "No code provided" });

      const promo = await storage.getPromoCodeByCode(code.trim());
      const total = parseFloat(cartTotal || "0");
      const promoError = await getPromoValidationError(promo, req.user?.claims?.sub, total);
      if (promoError) return res.json({ valid: false, message: promoError });

      // Calculate discount amount. Percentage and fixed codes with targets only
      // apply to matching products/options; codes without targets remain
      // order-wide for backwards compatibility.
      const discountValue = parseFloat(promo.discountValue);
      const targets = getItemPromoTargets(promo);
      let discountBase = total;
      if (targets.length > 0 && promo.discountType !== "item_free" && promo.discountType !== "item_price") {
        discountBase = getTargetedPromoSubtotal(promo, Array.isArray(items) ? items : []);
        if (discountBase <= 0) {
          return res.json({
            valid: false,
            message: await getPromoEligibilityMessage(promo),
          });
        }
      }
      let discountAmount = promo.discountType === "percent"
        ? Math.min(discountBase, discountBase * discountValue / 100)
        : Math.min(discountBase, discountValue);
      let itemAllocations: any[] = [];
      if (promo.discountType === "item_free" || promo.discountType === "item_price") {
        itemAllocations = getItemPromoAllocations(promo, Array.isArray(items) ? items : []);
        if (itemAllocations.length === 0) {
          return res.json({
            valid: false,
            message: await getPromoEligibilityMessage(promo),
          });
        }
        discountAmount = itemAllocations.reduce(
          (s, allocation) => s + Math.max(0, allocation.normalUnitPrice - allocation.promoPrice) * allocation.quantity,
          0,
        );
      }
      discountAmount = Math.min(Math.max(0, total), Math.max(0, discountAmount));

      res.json({
        valid: true,
        promoId: promo.id,
        code: promo.code,
        description: promo.description,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        bypassPurchaseMinimum: promo.bypassPurchaseMinimum,
        appliesToSpecificItems: targets.length > 0,
        itemAllocations: itemAllocations.map(({ productId, size, quantity, promoPrice }) => ({ productId, size, quantity, promoPrice })),
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
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    verifyClient: (info, done) => {
      // Order broadcasts must never reach pending (or signed-out) accounts.
      app.locals.authSessionMiddleware(info.req, new ServerResponse(info.req), async (error: unknown) => {
        if (error) return done(false, 401, "Unauthorized");
        try {
          const userId = (info.req as any).session?.userId;
          const user = userId ? await storage.getUser(userId) : undefined;
          if (!user || user.status !== "active") return done(false, 403, "Account approval required");
          done(true);
        } catch {
          done(false, 503, "Unable to verify account access");
        }
      });
    },
  });

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

  // Board Posts - public read
  app.get("/api/board-posts", async (req, res) => {
    try {
      const posts = await storage.getBoardPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch board posts" });
    }
  });

  app.patch("/api/board-posts/layout", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const placements = z.array(z.object({
        id: z.number().int().positive(),
        categoryId: z.number().int().positive().nullable(),
        afterCategoryId: z.number().int().positive().nullable().optional(),
        sortOrder: z.number().int().min(0),
      })).min(1).parse(req.body.placements);
      if (new Set(placements.map((placement) => placement.id)).size !== placements.length) {
        return res.status(400).json({ message: "Ad placements must not contain duplicate IDs" });
      }

      const postIds = placements.map((placement) => placement.id);
      const existingPosts = await db.select({ id: boardPosts.id }).from(boardPosts).where(inArray(boardPosts.id, postIds));
      if (existingPosts.length !== postIds.length) {
        return res.status(400).json({ message: "One or more ads do not exist" });
      }

      const categoryIds = Array.from(new Set(placements
        .map((placement) => placement.categoryId)
        .filter((id): id is number => id !== null)));
      if (categoryIds.length > 0) {
        const existingCategories = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, categoryIds));
        if (existingCategories.length !== categoryIds.length) {
          return res.status(400).json({ message: "One or more categories do not exist" });
        }
      }

      const afterCategoryIds = Array.from(new Set(placements
        .map((placement) => placement.afterCategoryId)
        .filter((id): id is number => id !== null && id !== undefined)));
      if (placements.some((placement) => placement.categoryId !== null && placement.afterCategoryId != null)) {
        return res.status(400).json({ message: "Ads inside a category cannot also be placed between categories" });
      }
      if (afterCategoryIds.length > 0) {
        const rootCategories = await db.select({ id: categories.id }).from(categories)
          .where(and(inArray(categories.id, afterCategoryIds), sql`${categories.parentId} IS NULL`));
        if (rootCategories.length !== afterCategoryIds.length) {
          return res.status(400).json({ message: "Between-category placements must use a main category" });
        }
      }

      await storage.updateBoardPostLayout(placements);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ad layout data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save ad layout" });
    }
  });

  // Board Posts - admin create
  app.post("/api/board-posts", isAuthenticated, requireRole(["admin"]), async (req: any, res) => {
    try {
      const userId = req.userId || req.user?.claims?.sub || req.user?.id;
      const { text, imageUrl, productIds } = req.body;
      if (!text && !imageUrl) {
        return res.status(400).json({ message: "Post must have text or an image" });
      }
      const productIdsJson = Array.isArray(productIds) && productIds.length > 0
        ? JSON.stringify(productIds)
        : null;
      const post = await storage.createBoardPost({ text: text ?? null, imageUrl: imageUrl ?? null, productIds: productIdsJson, createdBy: userId });
      res.status(201).json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to create board post" });
    }
  });

  // Board Posts - admin edit
  app.patch("/api/board-posts/:id", isAuthenticated, requireRole(["admin"]), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { text, imageUrl, productIds } = req.body;
      const productIdsJson = Array.isArray(productIds) && productIds.length > 0
        ? JSON.stringify(productIds)
        : productIds === null ? null : undefined;
      const post = await storage.updateBoardPost(id, {
        ...(text !== undefined ? { text: text ?? null } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ?? null } : {}),
        ...(productIdsJson !== undefined ? { productIds: productIdsJson } : {}),
      });
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to update post" });
    }
  });

  // Board Posts - admin delete
  app.delete("/api/board-posts/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBoardPost(id);
      res.json({ message: "Deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete board post" });
    }
  });

  // Board Posts - upload image or MP4 video (admin only)
  app.post("/api/upload/board-image", isAuthenticated, requireRole(["admin"]), upload.single("image"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image or MP4 file provided" });
      }

      const isMp4 = req.file.mimetype === 'video/mp4' || req.file.originalname.toLowerCase().endsWith('.mp4');
      const isGif = req.file.mimetype === 'image/gif' || req.file.originalname.toLowerCase().endsWith('.gif');
      const maxFileSize = isGif ? MAX_AD_GIF_SIZE : MAX_AD_IMAGE_OR_VIDEO_SIZE;
      if (req.file.size > maxFileSize) {
        const limitLabel = isGif ? '100 MB' : '20 MB';
        return res.status(413).json({ message: `Advertisement files of this type must be ${limitLabel} or smaller` });
      }
      const extension = isMp4 ? 'mp4' : isGif ? 'gif' : 'webp';
      const contentType = isMp4 ? 'video/mp4' : isGif ? 'image/gif' : 'image/webp';
      const mediaBuffer = isMp4
        ? req.file.buffer
        : isGif
          ? req.file.buffer
        : await sharp(req.file.buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const uniqueId = uuidv4();
      const objectName = `board-images/${uniqueId}.${extension}`;
      const fullPath = `${privateDir}/${objectName}`;
      const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join("/");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);
      await file.save(mediaBuffer, { metadata: { contentType } });
      const imageUrl = `/api/board-images/${uniqueId}.${extension}`;
      res.json({ imageUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload advertisement media" });
    }
  });

  // Board Images - serve
  app.get("/api/board-images/:filename", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateDir}/board-images/${req.params.filename}`;
      const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = parts[0];
      const objectKey = parts.slice(1).join("/");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectKey);
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ message: "Image not found" });
      const [metadata] = await file.getMetadata();
      res.setHeader("Content-Type", (metadata as any).contentType || "image/webp");
      res.setHeader("Cache-Control", "public, max-age=604800");
      file.createReadStream().pipe(res);
    } catch (error) {
      res.status(500).json({ message: "Failed to serve image" });
    }
  });

  // ── Grab Bags ────────────────────────────────────────────────────────────────

  app.get("/api/admin/grab-bags", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      res.json(await storage.getGrabBags());
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch grab bags" });
    }
  });

  app.post("/api/admin/grab-bags", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const created = await storage.createGrabBag(req.body);
      res.status(201).json(created);
    } catch (e) {
      console.error("Failed to create grab bag:", e);
      res.status(500).json({ message: "Failed to create grab bag" });
    }
  });

  app.put("/api/admin/grab-bags/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const bagId = parseInt(req.params.id);
      const updated = await storage.updateGrabBag(bagId, req.body);
      if (!updated) return res.status(404).json({ message: "Not found" });

      // Explicitly persist hideItems via raw SQL (Drizzle boolean in .set() can silently drop)
      if (req.body.hideItems !== undefined) {
        await rawPool.query(`UPDATE grab_bags SET hide_items = $1 WHERE id = $2`, [req.body.hideItems === true, bagId]);
      }

      // Sync hideItems to all generated products for this bag template
      const newHideItems = req.body.hideItems === true;
      const skuPrefix = `GRAB-BAG-${bagId}-`;
      const { products: productsTable } = await import("@shared/schema");
      const generatedProducts = await db.select().from(productsTable).where(like(productsTable.sku, `${skuPrefix}%`));
      for (const gp of generatedProducts) {
        if ((gp.sku ?? "").startsWith("GRAB-BAG-DISCOUNT")) continue;
        try {
          const existing = JSON.parse((gp.adminNotes as string) || "{}");
          existing.hideItems = newHideItems;
          await rawPool.query(`UPDATE products SET admin_notes = $1 WHERE id = $2`, [JSON.stringify(existing), gp.id]);
        } catch { /* skip malformed */ }
      }
      if (generatedProducts.length > 0) {
        try { const { invalidateCache } = await import("./cache"); invalidateCache.products(); } catch { /* best-effort */ }
      }

      res.json(updated);
    } catch (e) {
      res.status(500).json({ message: "Failed to update grab bag" });
    }
  });

  app.delete("/api/admin/grab-bags/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      await storage.deleteGrabBag(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete grab bag" });
    }
  });

  // Shared helper: pick items for a grab bag (no DB writes)
  async function pickGrabBagItems(bag: any): Promise<{
    selectedProducts: Array<{ id: number; name: string; price: number; sku: string; imageUrl?: string | null; imageUrls?: string | null }>;
    runningTotal: number;
    warnings: string[];
    error?: string;
  }> {
    const targetTotal = parseFloat(bag.maxTotalItemPrice) || 0;
    let runningTotal = 0;
    const warnings: string[] = [];
    const selectedProducts: Array<{ id: number; name: string; price: number; sku: string; sellingMethod: string; weightLabel: string; selectedSize?: string; imageUrl?: string | null; imageUrls?: string | null }> = [];

    // Build category name lookup
    const allCats = await storage.getCategories();
    const catNameMap = new Map<number, string>(allCats.map(c => [c.id, c.name]));
    const catLabel = (id: number) => catNameMap.get(id) ?? `Category #${id}`;

    // Helper: resolve effective price + label + selected size for flat-price AND weight-based products.
    // slotBudget: the per-item budget — weight-based items pick the highest tier that fits within it.
    function resolveProduct(p: any, slotBudget = Infinity, preferredSize?: string): { price: number; sellingMethod: string; weightLabel: string; selectedSize?: string } {
      // Pick a size option if this product has sizes
      let selectedSize: string | undefined;
      if (Array.isArray(p.sizes) && p.sizes.length > 0) {
        if (preferredSize) {
          // Honor the pinned flavor; fall back to auto-pick if not found
          const exact = p.sizes.find((s: any) => s.size === preferredSize);
          selectedSize = exact ? exact.size : preferredSize;
        } else {
          // Unpinned specific products mean “any flavor.” Choose at generation time
          // from the currently available options so a sold-out flavor is skipped.
          const withStock = p.sizes.filter((s: any) =>
            (s.quantity ?? 0) > 0 && (s.physicalQuantity ?? 0) > 0
          );
          const chosen = withStock.length > 0
            ? withStock[Math.floor(Math.random() * withStock.length)]
            : undefined;
          selectedSize = (chosen ?? p.sizes[0]).size;
        }
      }

      if (p.sellingMethod === "weight") {
        const opts = [
          { label: "g", val: p.pricePerGram },
          { label: "⅛ oz", val: p.pricePerEighth },
          { label: "¼ oz", val: p.pricePerQuarter },
          { label: "½ oz", val: p.pricePerHalf },
          { label: "oz", val: p.pricePerOunce },
        ].map(o => ({ label: o.label, price: o.val != null ? parseFloat(o.val) : NaN }))
         .filter(o => !isNaN(o.price) && o.price > 0);
        if (opts.length === 0) return { price: 0, sellingMethod: "weight", weightLabel: "", selectedSize };
        // If a specific weight tier was pinned (preferredSize holds the label like "⅛ oz"), honor it
        if (preferredSize) {
          const pinned = opts.find(o => o.label === preferredSize);
          if (pinned) return { price: pinned.price, sellingMethod: "weight", weightLabel: pinned.label, selectedSize };
        }
        // Pick the highest-value tier that fits within slotBudget; fall back to cheapest if none fit
        const affordable = opts.filter(o => o.price <= slotBudget);
        const best = affordable.length > 0
          ? affordable.reduce((a, b) => a.price > b.price ? a : b)
          : opts.reduce((a, b) => a.price < b.price ? a : b);
        return { price: best.price, sellingMethod: "weight", weightLabel: best.label, selectedSize };
      }
      const v = parseFloat(p.price ?? "");
      return { price: !isNaN(v) && v > 0 ? v : 0, sellingMethod: "units", weightLabel: "", selectedSize };
    }

    // Helper: Fisher-Yates shuffle in place
    function shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    // Helper: pick `count` items from pool with total ≤ budget, maximizing total (closest to budget from below).
    // Uses random trials for variety while respecting the hard ceiling.
    function pickBestUnder(
      pool: Array<{ id: number; name: string; price: number; sku: string; imageUrl?: string | null; imageUrls?: string | null }>,
      count: number,
      budget: number,
      trials = 300
    ) {
      if (pool.length <= count) return pool;
      // Only work with items that individually fit
      const affordable = pool.filter(p => p.price <= budget);
      if (affordable.length === 0) return [];
      if (affordable.length <= count) return affordable;

      let bestCombo: typeof pool = [];
      let bestTotal = -1;
      for (let t = 0; t < trials; t++) {
        const shuffled = shuffle([...affordable]);
        // Greedily pick up to `count` items that fit within remaining budget
        const combo: typeof pool = [];
        let spent = 0;
        for (const p of shuffled) {
          if (combo.length >= count) break;
          if (spent + p.price <= budget) { combo.push(p); spent += p.price; }
        }
        if (combo.length > 0 && spent > bestTotal) {
          bestTotal = spent;
          bestCombo = combo;
        }
        if (bestTotal === budget) break; // perfect fit
      }
      return bestCombo;
    }

    // Pre-parse specific items and category selections so we can compute a fair per-slot budget
    // BEFORE adding mandatory items (prevents a single mandatory item from consuming the full budget).
    let specificItems: { id: number; size?: string }[] = [];
    try {
      const parsed = bag.specificProductIds ? JSON.parse(bag.specificProductIds) : [];
      specificItems = parsed.map((item: any) => typeof item === 'number' ? { id: item } : item);
    } catch { /* ignore */ }

    let categorySelections: Array<{ categoryId: number; count: number }> = [];
    try { categorySelections = bag.categorySelections ? JSON.parse(bag.categorySelections) : []; } catch { /* ignore */ }

    // Fair per-slot budget based on ALL slots (specific + category) so mandatory items without a
    // pinned size pick an affordable weight tier instead of always defaulting to the most expensive.
    const totalSlots = specificItems.length + categorySelections.reduce((s, c) => s + c.count, 0);
    const slotBudget = totalSlots > 0 ? targetTotal / totalSlots : targetTotal;

    // 1. Always include specific products
    for (const item of specificItems) {
      try {
        const p = await storage.getProduct(item.id);
        if (p) {
          // Skip items with no stock or no physical inventory
          if (!componentAvailable(p, item.size)) {
            warnings.push(`"${p.name}" is out of stock or has no physical inventory — skipped.`);
            continue;
          }
          // Use slotBudget when no size is pinned so weight-based products don't eat the whole budget.
          const effectiveBudget = item.size ? Infinity : slotBudget;
          const { price, sellingMethod, weightLabel, selectedSize } = resolveProduct(p, effectiveBudget, item.size);
          if (price > 0) {
            selectedProducts.push({ id: p.id, name: p.name, price, sku: p.sku, sellingMethod, weightLabel, selectedSize, imageUrl: p.imageUrl, imageUrls: p.imageUrls });
            runningTotal += price;
          } else {
            warnings.push(`"${p.name}" has no resolvable price — skipped.`);
          }
        } else {
          warnings.push(`Product ID ${item.id} not found — skipped.`);
        }
      } catch { warnings.push(`Could not fetch product ID ${item.id} — skipped.`); }
    }

    // 2. Pick items from category selections targeting the remaining value
    let blacklistedIds: number[] = [];
    try { blacklistedIds = bag.blacklistedProductIds ? JSON.parse(bag.blacklistedProductIds) : []; } catch { /* ignore */ }
    let blacklistedCategoryIds: number[] = [];
    try { blacklistedCategoryIds = bag.blacklistedCategoryIds ? JSON.parse(bag.blacklistedCategoryIds) : []; } catch { /* ignore */ }

    // Compute how much of the target remains after specific products
    const remainingTarget = Math.max(0, targetTotal - runningTotal);

    // Category slot budget based on what's left after mandatory items
    const catTotalSlots = categorySelections.reduce((s, c) => s + c.count, 0);
    const catSlotBudget = catTotalSlots > 0 ? remainingTarget / catTotalSlots : remainingTarget;

    // Fetch all category pools, resolving weight tiers against the per-slot budget for variety
    type PoolEntry = { sel: { categoryId: number; count: number }; pool: Array<{ id: number; name: string; price: number; sku: string; sellingMethod: string; weightLabel: string; selectedSize?: string; imageUrl?: string | null; imageUrls?: string | null }> };
    const poolEntries: PoolEntry[] = [];
    for (const sel of categorySelections) {
      // Skip entire category if it's blacklisted
      if (blacklistedCategoryIds.includes(sel.categoryId)) {
        warnings.push(`"${catLabel(sel.categoryId)}" is blacklisted and was skipped.`);
        continue;
      }
      try {
        const allInCat = await storage.getProducts({ categoryIds: [sel.categoryId], isActive: true });
        const pool = allInCat
          .filter(p => !selectedProducts.find(s => s.id === p.id) && !blacklistedIds.includes(p.id) && !blacklistedCategoryIds.includes(p.categoryId ?? -1))
          .filter(p => componentAvailable(p))  // exclude 0-stock or 0-physical items
          .map(p => { const r = resolveProduct(p, catSlotBudget); return { id: p.id, name: p.name, price: r.price, sku: p.sku, sellingMethod: r.sellingMethod, weightLabel: r.weightLabel, selectedSize: r.selectedSize, imageUrl: p.imageUrl, imageUrls: p.imageUrls }; })
          .filter(p => p.price > 0);
        if (pool.length === 0) {
          warnings.push(`"${catLabel(sel.categoryId)}" has no eligible products.`);
        } else {
          poolEntries.push({ sel, pool });
        }
      } catch (e) {
        warnings.push(`Error fetching "${catLabel(sel.categoryId)}": ${(e as any)?.message || "unknown error"}`);
      }
    }

    // Each category gets its proportional budget share (catSlotBudget × count) — no starvation
    for (const { sel, pool } of poolEntries) {
      const categoryBudget = catSlotBudget * sel.count;
      const picked = pickBestUnder(pool, sel.count, categoryBudget);
      const pickedTotal = picked.reduce((s, p) => s + p.price, 0);
      for (const p of picked) {
        if (!selectedProducts.find(s => s.id === p.id)) {
          selectedProducts.push(p);
          runningTotal += p.price;
        }
      }
      if (picked.length < sel.count) {
        warnings.push(`Only ${picked.length} of ${sel.count} requested items could be found within budget for "${catLabel(sel.categoryId)}".`);
      }
    }

    if (selectedProducts.length === 0) {
      return { selectedProducts, runningTotal, warnings, error: "No products could be selected. Check your category selections and that those categories have active products." };
    }

    // ── Top-up: retail value must meet the selling price, ideally reaching targetTotal ──
    // If the selected items fall short, add extra copies of existing items.
    const sellingPriceNum = parseFloat(bag.sellingPrice) || 0;
    const hardMin = sellingPriceNum;     // must reach at least this
    const softTarget = Math.max(hardMin, targetTotal); // ideally reach this

    if (runningTotal < hardMin) {
      // Build a pool sorted cheapest → most-expensive for fine-grained filling
      const baseItems = [...selectedProducts].sort((a, b) => a.price - b.price);
      const SAFETY = 200; // max extra iterations
      let iters = 0;

      // Phase 1: reach hard minimum
      while (runningTotal < hardMin && iters < SAFETY) {
        iters++;
        const shortfall = hardMin - runningTotal;
        // Pick the most expensive item whose price ≤ shortfall (precise fill)
        const fitting = baseItems.filter(p => p.price <= shortfall);
        const toAdd = fitting.length > 0
          ? fitting.reduce((a, b) => a.price > b.price ? a : b)
          : baseItems[0]; // cheapest — will overshoot, but we must reach minimum
        selectedProducts.push({ ...toAdd });
        runningTotal += toAdd.price;
      }

      // Phase 2: also try to reach softTarget without exceeding it by more than the cheapest item
      const cheapestPrice = baseItems[0]?.price ?? 0;
      while (runningTotal < softTarget && iters < SAFETY) {
        iters++;
        const remaining = softTarget - runningTotal;
        const fitting = baseItems.filter(p => p.price <= remaining);
        if (fitting.length === 0) break; // would overshoot — stop
        const toAdd = fitting.reduce((a, b) => a.price > b.price ? a : b);
        selectedProducts.push({ ...toAdd });
        runningTotal += toAdd.price;
      }

      warnings.push(`Retail value was topped up to $${runningTotal.toFixed(2)} to meet the $${hardMin.toFixed(2)} selling price.`);
    }

    return { selectedProducts, runningTotal, warnings };
  }

  // Preview a grab bag — picks items but does NOT create a product
  app.post("/api/admin/grab-bags/:id/preview", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const bag = await storage.getGrabBag(parseInt(req.params.id));
      if (!bag) return res.status(404).json({ message: "Grab bag not found" });

      const { selectedProducts, runningTotal, warnings, error } = await pickGrabBagItems(bag);
      if (error) return res.status(400).json({ message: error });

      res.json({
        selectedProducts,
        retailValue: runningTotal,
        sellingPrice: parseFloat(bag.sellingPrice),
        bagId: bag.id,
        bagName: bag.name,
        warnings,
      });
    } catch (e) {
      console.error("Failed to preview grab bag:", e);
      res.status(500).json({ message: "Failed to preview grab bag" });
    }
  });

  // Confirm a grab bag — receives the pre-picked items and creates the product
  app.post("/api/admin/grab-bags/:id/generate", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const bag = await storage.getGrabBag(parseInt(req.params.id));
      if (!bag) return res.status(404).json({ message: "Grab bag not found" });

      const confirmedProducts: Array<{ id: number; name: string; price: number; sku: string; imageUrl?: string | null; imageUrls?: string | null }> = req.body.selectedProducts;
      if (!confirmedProducts || confirmedProducts.length === 0) {
        return res.status(400).json({ message: "No products provided" });
      }

      const runningTotal = confirmedProducts.reduce((s, p) => s + p.price, 0);

      // Collect all images from selected products (deduplicated)
      const allImageUrls: string[] = [];
      for (const p of confirmedProducts) {
        if (p.imageUrls) {
          try {
            const parsed: string[] = JSON.parse(p.imageUrls);
            for (const url of parsed) {
              if (url && !allImageUrls.includes(url)) allImageUrls.push(url);
            }
          } catch { /* ignore */ }
        }
        if (p.imageUrl && !allImageUrls.includes(p.imageUrl)) {
          allImageUrls.push(p.imageUrl);
        }
      }
      const primaryImage = allImageUrls[0] ?? null;
      const imageUrlsJson = allImageUrls.length > 0 ? JSON.stringify(allImageUrls) : null;

      const itemList = confirmedProducts.map(p => `• ${p.name} ($${p.price.toFixed(2)})`).join("\n");
      const description = `🎁 Grab Bag — ${confirmedProducts.length} item${confirmedProducts.length !== 1 ? 's' : ''} (retail value: $${runningTotal.toFixed(2)})\n\n${itemList}`;

      // Find or create "Grab Bags" category
      const { categories: categoriesTable } = await import("@shared/schema");
      let grabBagCategory = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.name, "Grab Bags"))
        .limit(1)
        .then(r => r[0] ?? null);

      if (!grabBagCategory) {
        grabBagCategory = await storage.createCategory({
          name: "Grab Bags",
          description: "Mystery grab bags with curated selections",
          isActive: true,
          sortOrder: 0,
        });
      }

      // Calculate initial stock = minimum available across all component products
      // Components may be inactive in the storefront (sold only via grab bags) — just check existence and stock
      let initialStock = Infinity;
      let initialPhysicalInventory = Infinity;
      for (const p of confirmedProducts) {
        const comp = await storage.getProduct(p.id);
        if (!comp) {
          initialStock = 0;
          initialPhysicalInventory = 0;
          continue;
        }
        const avail = componentStock(comp, (p as any).selectedSize);
        if (avail <= 0) initialStock = 0;
        initialStock = Math.min(initialStock, avail);
        initialPhysicalInventory = Math.min(
          initialPhysicalInventory,
          componentPhysicalInventory(comp, (p as any).selectedSize),
        );
      }
      if (!isFinite(initialStock)) initialStock = 0;
      if (!isFinite(initialPhysicalInventory)) initialPhysicalInventory = 0;

      const sku = `GRAB-BAG-${bag.id}-${Date.now()}`;
      const newProduct = await storage.createProduct({
        name: bag.name,
        description,
        price: bag.sellingPrice,
        sku,
        stock: initialStock,
        physicalInventory: initialPhysicalInventory,
        isActive: initialStock > 0,
        sellingMethod: "units",
        categoryId: grabBagCategory.id,
        imageUrl: primaryImage,
        imageUrls: imageUrlsJson,
        adminNotes: JSON.stringify({
          templateId: bag.id,
          bagName: bag.name,
          hideItems: bag.hideItems ?? false,
          items: confirmedProducts.map(p => ({ productId: p.id, name: p.name, sku: p.sku, price: p.price, selectedSize: (p as any).selectedSize })),
        }),
      } as any);

      res.status(201).json({
        product: newProduct,
        selectedProducts: confirmedProducts,
        retailValue: runningTotal,
        sellingPrice: parseFloat(bag.sellingPrice),
      });
    } catch (e) {
      console.error("Failed to generate grab bag:", e);
      res.status(500).json({ message: "Failed to generate grab bag" });
    }
  });

  // Admin endpoint to manually trigger a grab bag availability sync
  app.post("/api/admin/sync-grab-bags", isAuthenticated, requireRole(["admin"]), async (_req, res) => {
    try {
      await syncGrabBagAvailability();
      res.json({ message: "Grab bag availability synced" });
    } catch (e) {
      res.status(500).json({ message: "Sync failed" });
    }
  });

  // Run one sync on startup so existing bags reflect correct stock counts
  syncGrabBagAvailability().catch(err => console.warn("[startup] syncGrabBagAvailability failed:", err));

  return httpServer;
}