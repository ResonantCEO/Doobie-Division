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

// Configure multer for file uploads with proper storage handling
const idImagesDir = path.join(process.cwd(), 'uploads', 'id-images');
const verificationPhotosDir = path.join(process.cwd(), 'uploads', 'verification-photos');

// Ensure both directories exist
if (!fs.existsSync(idImagesDir)) {
  fs.mkdirSync(idImagesDir, { recursive: true });
}
if (!fs.existsSync(verificationPhotosDir)) {
  fs.mkdirSync(verificationPhotosDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'idImage') {
      cb(null, idImagesDir);
    } else if (file.fieldname === 'verificationPhoto') {
      cb(null, verificationPhotosDir);
    } else {
      cb(new Error('Unknown field name'), '');
    }
  },
  filename: function (req, file, cb) {
    // Use a hash-based filename (no extension to maintain security)
    const hash = crypto.createHash('md5').update(file.originalname + Date.now()).digest('hex');
    cb(null, hash);
  }
});

const upload = multer({
  storage: multerStorage,
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
  app.post("/api/auth/register", upload.fields([{ name: 'idImage', maxCount: 1 }, { name: 'verificationPhoto', maxCount: 1 }]), async (req, res) => {
    try {
      const { email, password, firstName, lastName, address, city, state, postalCode, country } = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Normalize email to lowercase for case-insensitive comparison
      const normalizedEmail = email.toLowerCase();

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
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
      const idImageUrl = req.files && (req.files as any)['idImage'] ? `/uploads/id-images/${(req.files as any)['idImage'][0].filename}` : null;
      const verificationPhotoUrl = req.files && (req.files as any)['verificationPhoto'] ? `/uploads/verification-photos/${(req.files as any)['verificationPhoto'][0].filename}` : null;

      await storage.createUserWithPassword({
        id: userId,
        email: normalizedEmail,
        firstName,
        lastName,
        password: hashedPassword,
        idImageUrl,
        verificationPhotoUrl,
        address,
        city,
        state,
        postalCode,
        country: country || 'USA',
        idVerificationStatus: isFirstUser ? "verified" : (idImageUrl ? "pending" : "not_provided"),
        role: isFirstUser ? "admin" : "customer",
        status: isFirstUser ? "active" : "pending"
      });

      // Create session for first user only
      const user = await storage.getUser(userId);

      if (isFirstUser) {
        (req.session as any).userId = userId;
        req.session.save(async (err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ message: "Session error" });
          }

          // Log the login activity
          try {
            await storage.logUserActivity(
              user.id,
              'Login',
              'User logged in successfully',
              { ipAddress: req.ip, userAgent: req.get('User-Agent') }
            );
          } catch (error) {
            console.error('Error logging login activity:', error);
          }

          res.status(201).json({ 
            user, 
            message: "Welcome! You are the first user and have been granted administrator privileges." 
          });
        });
      } else {
        // Notification creation removed - user registration notifications are handled elsewhere
        
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

      // Normalize email to lowercase for case-insensitive comparison
      const normalizedEmail = email.toLowerCase();

      // Get user by email
      const user = await storage.getUserByEmail(normalizedEmail);
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
      req.session.save(async (err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Session error" });
        }

        // Log the login activity
        try {
          await storage.logUserActivity(
            user.id,
            'Login',
            'User logged in successfully',
            { ipAddress: req.ip, userAgent: req.get('User-Agent') }
          );
        } catch (error) {
          console.error('Error logging login activity:', error);
        }

        // Remove password from response
        const { password: _, ...userResponse } = user;
        res.json({ user: userResponse, message: "Login successful" });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    const userId = (req.session as any).userId;
    req.session.destroy(async (err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ message: "Logout failed" });
      }

      // Log the logout activity
      if (userId) {
        try {
          await storage.logUserActivity(
            userId,
            'Logout',
            'User logged out successfully',
            { ipAddress: req.ip }
          );
        } catch (error) {
          console.error('Error logging logout activity:', error);
        }
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logout successful" });
    });
  });

  // Password reset endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({ message: "Email and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Normalize email to lowercase for case-insensitive comparison
      const normalizedEmail = email.toLowerCase();

      // Get user by email
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update password in database
      await storage.updateUserPassword(user.id, hashedPassword);

      res.json({ message: "Password reset successful. You can now login with your new password." });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Password reset failed" });
    }
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