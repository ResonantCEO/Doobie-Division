import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { fileURLToPath } from "url";
import { checkDatabaseConnection } from "./db";

// Simple rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!rateLimitStore.has(clientIp)) {
      rateLimitStore.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const clientData = rateLimitStore.get(clientIp)!;

    if (now > clientData.resetTime) {
      rateLimitStore.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (clientData.count >= maxRequests) {
      return res.status(429).json({ message: 'Too many requests' });
    }

    clientData.count++;
    next();
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Add basic health check endpoint before other middleware
app.get('/', (req, res) => {
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

// Apply rate limiting to API routes
app.use('/api/', rateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
app.use('/api/auth/', rateLimit(10, 15 * 60 * 1000)); // 10 auth requests per 15 minutes

// Database connection middleware
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api") && req.path !== "/api/health") {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      return res.status(503).json({ 
        error: "Database connection unavailable",
        message: "Please try again in a moment" 
      });
    }
  }
  next();
});

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

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
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
    const { serveStatic } = await import("./vite");
    serveStatic(app);
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