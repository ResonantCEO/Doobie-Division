import type { RequestHandler } from "express";
import { isSupportOnlyAccount, supportOnlyAccessMessage } from "@shared/account-access";

/** Pending and suspended accounts share this own-ticket-only allowlist. */
export function canAccessWhilePending(method: string, url: string): boolean {
  const path = url.split("?")[0];
  if (method === "GET" && path === "/api/auth/user") return true;
  if (method === "POST" && ["/api/auth/login", "/api/auth/logout"].includes(path)) return true;
  if (["GET", "POST"].includes(method) && path === "/api/support/my-tickets") return true;
  if (method === "POST" && path === "/api/support/ticket-images") return true;
  if (method === "GET" && /^\/api\/support-images\/[^/]+$/.test(path)) return true;
  if (method === "POST" && /^\/api\/support\/tickets\/\d+\/customer-reply$/.test(path)) return true;
  return method === "PUT" && /^\/api\/support\/tickets\/\d+\/request-close$/.test(path);
}

export function createAccountAccessGuard<T extends { status: string }>(
  loadUser: (id: string) => Promise<T | undefined>,
): RequestHandler {
  return async (req: any, res, next) => {
    const path = req.originalUrl.split("?")[0];
    // Always permit signing out or signing in to another account.
    if (req.method === "POST" && ["/api/auth/login", "/api/auth/logout"].includes(path)) return next();
    const userId = req.session?.userId;
    if (!userId) return next();
    try {
      const user = await loadUser(userId);
      if (!user || (user.status !== "active" && !isSupportOnlyAccount(user.status))) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      req.userId = userId;
      req.currentUser = user;
      if (isSupportOnlyAccount(user.status) && !canAccessWhilePending(req.method, req.originalUrl)) {
        return res.status(403).json({
          code: user.status === "suspended" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_PENDING",
          message: supportOnlyAccessMessage(user.status),
        });
      }
      next();
    } catch {
      res.status(503).json({ message: "Unable to verify account access. Please try again." });
    }
  };
}