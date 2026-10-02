import type { RequestHandler } from "express";

type RateLimitEntry = { count: number; resetTime: number };
type RateLimitStore = Map<string, RateLimitEntry>;

export function createRateLimit(
  store: RateLimitStore,
  maxRequests: number,
  windowMs: number,
  options: { skipSuccessful?: boolean; message?: string; now?: () => number } = {},
): RequestHandler {
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = (options.now ?? Date.now)();
    let entry = store.get(key);
    if (!entry || now >= entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      store.set(key, entry);
    }
    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        message: options.message ?? "Too many requests. Please wait and try again.",
        retryAfterSeconds,
      });
    }
    entry.count++;
    if (options.skipSuccessful) {
      const currentEntry = entry;
      // Include in-flight attempts, but release successful logins when they finish.
      // Previous failures remain counted even if another login succeeds.
      res.once("finish", () => {
        if (res.statusCode < 400 && store.get(key) === currentEntry) {
          currentEntry.count = Math.max(0, currentEntry.count - 1);
        }
      });
    }
    next();
  };
}

/** Each API request uses exactly one quota; polling cannot consume login attempts. */
export function createApiRateLimiter(): RequestHandler {
  const stores = {
    login: new Map<string, RateLimitEntry>(),
    register: new Map<string, RateLimitEntry>(),
    passwordReset: new Map<string, RateLimitEntry>(),
    sessionReads: new Map<string, RateLimitEntry>(),
    otherAuth: new Map<string, RateLimitEntry>(),
    upload: new Map<string, RateLimitEntry>(),
    general: new Map<string, RateLimitEntry>(),
  };
  const windowMs = 15 * 60 * 1000;
  const limits = {
    login: createRateLimit(stores.login, 10, windowMs, {
      skipSuccessful: true,
      message: "Too many failed sign-in attempts. Please wait up to 15 minutes before trying again.",
    }),
    register: createRateLimit(stores.register, 10, windowMs),
    passwordReset: createRateLimit(stores.passwordReset, 10, windowMs),
    sessionReads: createRateLimit(stores.sessionReads, 300, windowMs),
    otherAuth: createRateLimit(stores.otherAuth, 100, windowMs),
    upload: createRateLimit(stores.upload, 100, windowMs),
    general: createRateLimit(stores.general, 500, windowMs),
  };
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const store of Object.values(stores)) {
      store.forEach((entry, key) => { if (now >= entry.resetTime) store.delete(key); });
    }
  }, 5 * 60 * 1000);
  cleanup.unref();

  return (req, res, next) => {
    // Mounted at /api. Express routes ignore case and trailing slashes by default.
    const path = req.path.toLowerCase().replace(/\/+$/, "");
    if (req.method === "POST" && path === "/auth/login") return limits.login(req, res, next);
    if (req.method === "POST" && path === "/auth/register") return limits.register(req, res, next);
    if (req.method === "POST" && path === "/auth/reset-password") return limits.passwordReset(req, res, next);
    if (req.method === "GET" && ["/auth/user", "/auth/telegram-requirement"].includes(path)) {
      return limits.sessionReads(req, res, next);
    }
    if (path.startsWith("/auth/")) return limits.otherAuth(req, res, next);
    if (path.startsWith("/upload/") || path === "/upload" || path === "/objects/upload") {
      return limits.upload(req, res, next);
    }
    return limits.general(req, res, next);
  };
}