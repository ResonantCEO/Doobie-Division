import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail, createPasswordResetEmail } from "./email";
import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
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
      sameSite: 'strict',
      maxAge: SESSION_TTL,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Email availability check endpoint
  app.post("/api/auth/check-email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Normalize email to lowercase for case-insensitive comparison
      const normalizedEmail = email.toLowerCase();

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists. Please use a different email or try logging in." });
      }

      res.json({ message: "Email is available" });
    } catch (error) {
      console.error("Email check error:", error);
      res.status(500).json({ message: "Failed to check email availability" });
    }
  });

  // Register endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, address, city, state, postalCode, country, idImageUrl, verificationPhotoUrl } = req.body;

      // Only check for essential fields that are actually sent from frontend
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All required fields must be provided" });
      }

      // Validate photo uploads are provided and in correct format
      if (!idImageUrl || !verificationPhotoUrl) {
        return res.status(400).json({ message: "Photo ID and verification photo are required" });
      }

      if (!idImageUrl.startsWith('/objects/') || !verificationPhotoUrl.startsWith('/objects/')) {
        return res.status(400).json({ message: "Invalid photo format" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }

      // Validate password complexity
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
      }
      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one lowercase letter" });
      }
      if (!/\d/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one number" });
      }

      // Normalize email to lowercase for case-insensitive comparison
      const normalizedEmail = email.toLowerCase();

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists. Please use a different email or try logging in." });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Check if this is the first user (should become admin)
      const existingUserCount = await storage.getUserCount();
      const isFirstUser = existingUserCount === 0;

      // Create user
      const userId = crypto.randomUUID();
      
      // Process object storage URLs and set ACL policies
      let processedIdImageUrl = idImageUrl;
      let processedVerificationPhotoUrl = verificationPhotoUrl;
      
      if (idImageUrl) {
        try {
          const { ObjectStorageService } = await import("./objectStorage");
          const objectStorageService = new ObjectStorageService();
          processedIdImageUrl = await objectStorageService.trySetObjectEntityAclPolicy(
            idImageUrl,
            {
              owner: userId,
              visibility: "private",
            }
          );
        } catch (error) {
          console.error("Error setting ID image ACL:", error);
        }
      }
      
      if (verificationPhotoUrl) {
        try {
          const { ObjectStorageService } = await import("./objectStorage");
          const objectStorageService = new ObjectStorageService();
          processedVerificationPhotoUrl = await objectStorageService.trySetObjectEntityAclPolicy(
            verificationPhotoUrl,
            {
              owner: userId,
              visibility: "private",
            }
          );
        } catch (error) {
          console.error("Error setting verification photo ACL:", error);
        }
      }

      await storage.createUserWithPassword({
        id: userId,
        email: normalizedEmail,
        firstName,
        lastName,
        password: hashedPassword,
        idImageUrl: processedIdImageUrl,
        verificationPhotoUrl: processedVerificationPhotoUrl,
        address,
        city,
        state,
        postalCode,
        country: country || 'USA',
        idVerificationStatus: isFirstUser ? "verified" : (processedIdImageUrl ? "pending" : "not_provided"),
        role: isFirstUser ? "admin" : "customer",
        status: isFirstUser ? "active" : "pending"
      });

      // Create session for first user only
      const user = await storage.getUser(userId);

      if (isFirstUser && user) {
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
      if (!user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
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

  // Generate password reset token
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase();
      const user = await storage.getUserByEmail(normalizedEmail);

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "If the email exists, a reset link has been sent." });
      }

      if (user.status !== "active") {
        return res.json({ message: "If the email exists, a reset link has been sent." });
      }

      // Generate 6-character alphanumeric reset token
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let resetToken = '';
      for (let i = 0; i < 6; i++) {
        const randomIndex = crypto.randomInt(0, characters.length);
        resetToken += characters[randomIndex];
      }
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token
      await storage.createPasswordResetToken(user.id, resetToken, resetTokenExpiry);

      // Log the reset request
      await storage.logUserActivity(
        user.id,
        'Password Reset Request',
        'User requested password reset',
        { ipAddress: req.ip, userAgent: req.get('User-Agent') }
      );

      // Create support ticket for password reset request
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;

      await storage.createSupportTicket({
        customerName: `${user.firstName} ${user.lastName}`,
        customerEmail: user.email,
        customerPhone: user.address || 'Not provided', // Use address field or default
        subject: `Password Reset Request - ${user.firstName} ${user.lastName}`,
        message: `User ${user.firstName} ${user.lastName} (${user.email}) has requested a password reset.

RESET TOKEN: ${resetToken}
RESET URL: ${resetUrl}
EXPIRES AT: ${resetTokenExpiry.toISOString()}

Request Details:
- IP Address: ${req.ip}
- User Agent: ${req.get('User-Agent')}
- User ID: ${user.id}

Please manually send this reset URL to the user via their preferred communication method.`,
        priority: 'medium'
      });

      // In development, log the token to console for testing
      if (process.env.NODE_ENV === 'development') {
        console.log(`Password reset token for ${email}: ${resetToken}`);
        console.log(`Reset URL: ${resetUrl}`);
        console.log(`Support ticket created for password reset`);
      }

      res.json({
        message: "Your password reset request has been submitted to our support team. They will contact you shortly with reset instructions.",
        ...(process.env.NODE_ENV === 'development' && { resetToken }) // Include token in dev mode for testing
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, token, password, confirmPassword } = req.body;

      if (!email || !token || !password || !confirmPassword) {
        return res.status(400).json({ message: "Email, token, password, and confirm password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }

      // Validate password complexity
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
      }
      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one lowercase letter" });
      }
      if (!/\d/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one number" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      // Verify reset token
      const resetData = await storage.getPasswordResetToken(token);
      if (!resetData || resetData.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Get user
      const user = await storage.getUser(resetData.userId);
      if (!user || user.status !== "active") {
        return res.status(400).json({ message: "Invalid reset token" });
      }

      // Verify email matches the user associated with the token
      const normalizedEmail = email.toLowerCase();
      if (user.email.toLowerCase() !== normalizedEmail) {
        return res.status(400).json({ message: "Email does not match the user associated with this reset token" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Update password
      await storage.updateUserPassword(user.id, hashedPassword);

      // Delete used reset token
      await storage.deletePasswordResetToken(token);

      // Log successful password reset
      await storage.logUserActivity(
        user.id,
        'Password Reset',
        'User successfully reset password',
        { ipAddress: req.ip, userAgent: req.get('User-Agent') }
      );

      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
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