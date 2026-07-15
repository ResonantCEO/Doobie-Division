import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import path from "path";
import { fileURLToPath } from "url";
import { checkDatabaseConnection, warmupDatabase } from "./db";

// Separate rate limiting stores for different endpoint types to prevent cross-contamination
const rateLimitStores = {
  auth: new Map<string, { count: number; resetTime: number }>(),
  upload: new Map<string, { count: number; resetTime: number }>(),
  general: new Map<string, { count: number; resetTime: number }>(),
};

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const store of Object.values(rateLimitStores)) {
    for (const [key, data] of store.entries()) {
      if (now > data.resetTime) {
        store.delete(key);
      }
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

const createRateLimit = (store: Map<string, { count: number; resetTime: number }>, maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || 'unknown';
    const now = Date.now();

    if (!store.has(clientIp)) {
      store.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const clientData = store.get(clientIp)!;

    if (now > clientData.resetTime) {
      store.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (clientData.count >= maxRequests) {
      return res.status(429).json({ message: 'Too many requests' });
    }

    clientData.count++;
    next();
  };
};

// ES module compatible static file serving
function customServeStatic(app: express.Express) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDistPath = path.resolve(currentDir, "..", "dist", "public");

  console.log("Serving static files from:", clientDistPath);

  app.use(express.static(clientDistPath));

  // Catch-all handler for client-side routing - but exclude API routes
  app.get("*", (req, res) => {
    // Don't serve index.html for API routes or other special paths
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/") || req.path.startsWith("/objects/")) {
      return res.status(404).json({ message: "Resource not found" });
    }

    // For all other routes, serve index.html to allow client-side routing
    try {
      res.sendFile(path.join(clientDistPath, "index.html"));
    } catch (error) {
      console.error("Error serving index.html:", error);
      res.status(500).send("Internal Server Error");
    }
  });
}


const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Add basic health check endpoint before other middleware
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CORS headers with fallback for undefined FRONTEND_URL
  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? (frontendUrl ? [frontendUrl] : []) // Only include if defined
    : ['http://localhost:5000', 'http://0.0.0.0:5000'];

  const origin = req.headers.origin;
  // Add validation to prevent setting undefined values in headers
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'production' && frontendUrl && !origin) {
    // In production, if no origin header but we have a frontend URL, allow it
    res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Rate limiting - apply specific routes BEFORE general routes
// This prevents double rate limiting and ensures proper isolation

// Auth endpoints - separate store to prevent interference from uploads
app.use('/api/auth/login', createRateLimit(rateLimitStores.auth, 10, 15 * 60 * 1000)); // 10 login attempts per 15 minutes
app.use('/api/auth/register', createRateLimit(rateLimitStores.auth, 10, 15 * 60 * 1000)); // 10 registration attempts per 15 minutes
app.use('/api/auth/reset-password', createRateLimit(rateLimitStores.auth, 10, 15 * 60 * 1000)); // 10 reset-password attempts per 15 minutes
app.use('/api/auth/', createRateLimit(rateLimitStores.auth, 100, 15 * 60 * 1000)); // 100 general auth requests per 15 minutes

// Upload endpoints - separate store with higher limits for file operations
app.use('/api/upload/', createRateLimit(rateLimitStores.upload, 100, 15 * 60 * 1000)); // 100 uploads per 15 minutes
app.use('/api/objects/upload', createRateLimit(rateLimitStores.upload, 100, 15 * 60 * 1000)); // 100 object uploads per 15 minutes

// General API routes - applied last to catch everything else
app.use('/api/', createRateLimit(rateLimitStores.general, 500, 15 * 60 * 1000)); // 500 requests per 15 minutes


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 300) {
        logLine = logLine.slice(0, 299) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Warm up the Neon connection before accepting any requests.
  // Neon serverless HTTP can return null rows on cold-start concurrent requests.
  // A single warmup query serializes startup and prevents the null-map crash.
  await warmupDatabase();

  // Ensure image_urls column exists (migration)
  try {
    const { sql } = await import("./db");
    await sql.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT`);
    console.log("✓ Verified image_urls column exists");
  } catch (error: any) {
    if (error?.message?.includes("already exists") || error?.message?.includes("duplicate")) {
      console.log("✓ image_urls column already exists");
    } else {
      console.warn("⚠ Could not verify image_urls column:", error?.message);
    }
  }

  // Ensure fractional ounce pricing columns exist (migration)
  try {
    const { sql } = await import("./db");
    await sql.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS price_per_eighth DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS price_per_quarter DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS price_per_half DECIMAL(10, 2)
    `);
    console.log("✓ Verified fractional ounce pricing columns exist");
  } catch (error: any) {
    if (error?.message?.includes("already exists") || error?.message?.includes("duplicate")) {
      console.log("✓ Fractional ounce pricing columns already exist");
    } else {
      console.warn("⚠ Could not verify fractional ounce pricing columns:", error?.message);
    }
  }

  // Ensure BOGO columns exist (migration)
  try {
    const { sql } = await import("./db");
    await sql.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS bogo_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS bogo_free_option_index INTEGER
    `);
    console.log("✓ Verified BOGO columns exist");
  } catch (error: any) {
    if (error?.message?.includes("already exists") || error?.message?.includes("duplicate")) {
      console.log("✓ BOGO columns already exist");
    } else {
      console.warn("⚠ Could not verify BOGO columns:", error?.message);
    }
  }

  // Ensure archived column exists on orders table
  try {
    const { sql } = await import("./db");
    await sql.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false`);
    console.log("✓ Verified orders.archived column exists");
  } catch (error: any) {
    if (error?.message?.includes("already exists") || error?.message?.includes("duplicate")) {
      console.log("✓ orders.archived column already exists");
    } else {
      console.warn("⚠ Could not verify orders.archived column:", error?.message);
    }
  }

  // Ensure order_sequences table exists for atomic order number generation
  try {
    const { sql } = await import("./db");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS order_sequences (
        date_prefix TEXT PRIMARY KEY,
        last_seq INTEGER NOT NULL DEFAULT 0
      )
    `);
    console.log("✓ Verified order_sequences table exists");
  } catch (error: any) {
    console.warn("⚠ Could not verify order_sequences table:", error?.message);
  }

  // Fix user_activity_logs sequence if it has fallen behind actual data
  try {
    const { sql } = await import("./db");
    await sql.query(`
      SELECT setval(
        pg_get_serial_sequence('user_activity_logs', 'id'),
        COALESCE((SELECT MAX(id) FROM user_activity_logs), 0) + 1,
        false
      )
    `);
  } catch (error: any) {
    console.warn("⚠ Could not reset user_activity_logs sequence:", error?.message);
  }

  // Add health check endpoint
  app.get("/api/health", async (req, res) => {
    const dbConnected = await checkDatabaseConnection();
    res.json({ 
      status: "ok", 
      database: dbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    });
  });

  const server = await registerRoutes(app);

  // In production, serve static files
  if (process.env.NODE_ENV === "production") {
    customServeStatic(app);
  } else {
    // In development, setup Vite middleware
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  }

  // Cleanup expired password reset tokens every hour
  setInterval(async () => {
    try {
      const { storage } = await import("./storage");
      await storage.cleanupExpiredPasswordResetTokens();
      console.log("Cleaned up expired password reset tokens");
    } catch (error) {
      console.error("Error cleaning up expired tokens:", error);
    }
  }, 3600000); // 1 hour

  // Cleanup old closed support tickets every hour
  setInterval(async () => {
    try {
      const { storage } = await import("./storage");
      await storage.cleanupOldClosedTickets();
      console.log("Cleaned up old closed support tickets");
    } catch (error) {
      console.error("Error cleaning up old closed tickets:", error);
    }
  }, 3600000); // 1 hour

  // Start the server
  server.listen(port, "0.0.0.0", () => {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    console.log(`${formattedTime} [express] serving on port ${port}`);
  });
})()
.catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export { app };