import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";

const SALT_ROUNDS = 12;

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'id-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
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
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: SESSION_TTL,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET || "your-secret-key-change-this",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Register endpoint
  app.post("/api/auth/register", upload.single('idImage'), async (req, res) => {
    try {
      const { email, password, firstName, lastName, address, city, state, postalCode, country } = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists with this email" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Check if this is the first user (should become admin)
      const existingUserCount = await storage.getUserCount();
      const isFirstUser = existingUserCount === 0;

      // Create user
      const userId = crypto.randomUUID();
      const idImageUrl = req.file ? `/uploads/id-images/${req.file.filename}` : null;

      await storage.createUserWithPassword({
        id: userId,
        email,
        firstName,
        lastName,
        password: hashedPassword,
        idImageUrl,
        address,
        city,
        state,
        postalCode,
        country: country || 'Canada',
        idVerificationStatus: isFirstUser ? "verified" : (idImageUrl ? "pending" : "not_provided"),
        role: isFirstUser ? "admin" : "customer",
        status: isFirstUser ? "active" : "pending"
      });

      // Create session for first user only
      const user = await storage.getUser(userId);

      if (isFirstUser) {
        (req.session as any).userId = userId;
        res.status(201).json({ 
          user, 
          message: "Welcome! You are the first user and have been granted administrator privileges." 
        });
      } else {
        res.status(201).json({ 
          user: null, 
          message: "Registration successful! Your account is pending approval by an administrator." 
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Get user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.status !== "active") {
        if (user.status === "pending") {
          return res.status(401).json({ 
            message: "Account is pending approval. Please wait for an administrator to activate your account." 
          });
        }
        return res.status(401).json({ message: "Account is inactive" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
      (req.session as any).userId = user.id;

      // Remove password from response
      const { password: _, ...userResponse } = user;
      res.json({ user: userResponse, message: "Login successful" });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logout successful" });
    });
  });

  // Get current user endpoint
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  const userId = (req.session as any)?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user || user.status !== "active") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.userId = userId;
    req.currentUser = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};