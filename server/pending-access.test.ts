import assert from "node:assert/strict";
import test from "node:test";
import { canAccessWhilePending, createAccountAccessGuard } from "./pending-access";

test("pending accounts can use the customer support workflow and session endpoints", () => {
  for (const [method, path] of [
    ["GET", "/api/auth/user"],
    ["POST", "/api/auth/login"],
    ["POST", "/api/auth/logout"],
    ["GET", "/api/support/my-tickets?status=open"],
    ["POST", "/api/support/my-tickets"],
    ["POST", "/api/support/ticket-images"],
    ["GET", "/api/support-images/example.webp"],
    ["POST", "/api/support/tickets/123/customer-reply"],
    ["PUT", "/api/support/tickets/123/request-close"],
  ]) assert.equal(canAccessWhilePending(method, path), true, `${method} ${path}`);
});

test("pending accounts cannot browse, order, edit profiles, or use staff ticket actions", () => {
  for (const [method, path] of [
    ["GET", "/api/products"],
    ["GET", "/api/categories"],
    ["GET", "/api/board-posts"],
    ["GET", "/api/orders"],
    ["POST", "/api/orders"],
    ["GET", "/api/analytics/metrics/30"],
    ["GET", "/api/users"],
    ["PUT", "/api/auth/telegram-username"],
    ["GET", "/api/notifications"],
    ["POST", "/api/objects/upload"],
    ["GET", "/api/support/tickets"],
    ["POST", "/api/support/tickets/123/respond"],
    ["PUT", "/api/support/tickets/123/status"],
    ["DELETE", "/api/support/tickets/123"],
    ["DELETE", "/api/support/my-tickets"],
    ["GET", "/api/support/my-tickets/other"],
    ["GET", "/api/support-images/example.webp/other"],
  ]) assert.equal(canAccessWhilePending(method, path), false, `${method} ${path}`);
});

async function runGuard(status: string | undefined, path: string, method = "GET", signedIn = true) {
  const request: any = { method, originalUrl: path, session: signedIn ? { userId: "fixture" } : {} };
  let statusCode: number | undefined;
  let didNext = false;
  let body: any;
  const response: any = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  };
  const guard = createAccountAccessGuard(async () => status ? { status } : undefined);
  await guard(request, response, () => { didNext = true; });
  return { statusCode, didNext, body, request };
}

test("pending sessions are restricted even on otherwise public catalog endpoints", async () => {
  const denied = await runGuard("pending", "/api/products");
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.code, "ACCOUNT_PENDING");
  assert.equal(denied.didNext, false);
  const allowed = await runGuard("pending", "/api/support/my-tickets");
  assert.equal(allowed.didNext, true);
  assert.equal(allowed.request.currentUser.status, "pending");
});

test("suspended sessions retain only their own support-ticket workflow", async () => {
  for (const [method, path] of [
    ["GET", "/api/auth/user"],
    ["GET", "/api/support/my-tickets"],
    ["POST", "/api/support/my-tickets"],
    ["POST", "/api/support/ticket-images"],
    ["GET", "/api/support-images/example.webp"],
    ["POST", "/api/support/tickets/123/customer-reply"],
    ["PUT", "/api/support/tickets/123/request-close"],
    ["POST", "/api/auth/logout"],
  ]) assert.equal((await runGuard("suspended", path, method)).didNext, true, path);
  for (const [method, path] of [
    ["GET", "/api/products"],
    ["GET", "/api/orders"],
    ["POST", "/api/orders"],
    ["GET", "/api/users"],
    ["PUT", "/api/auth/telegram-username"],
    ["GET", "/api/support/tickets"],
    ["POST", "/api/support/tickets/123/respond"],
    ["DELETE", "/api/support/tickets/123"],
  ]) {
    const denied = await runGuard("suspended", path, method);
    assert.equal(denied.statusCode, 403, path);
    assert.equal(denied.body.code, "ACCOUNT_SUSPENDED");
  }
});

test("approval restores access, while rejected and inactive accounts stay blocked", async () => {
  assert.equal((await runGuard("active", "/api/orders")).didNext, true);
  for (const status of ["inactive", "rejected", undefined]) {
    assert.equal((await runGuard(status, "/api/support/my-tickets")).statusCode, 401);
  }
  assert.equal((await runGuard("inactive", "/api/auth/logout", "POST")).didNext, true);
});

test("anonymous browsing is unchanged and failed status checks do not grant access", async () => {
  assert.equal((await runGuard(undefined, "/api/products", "GET", false)).didNext, true);
  let didNext = false;
  let statusCode: number | undefined;
  const guard = createAccountAccessGuard(async () => { throw new Error("unavailable"); });
  await guard(
    { method: "GET", originalUrl: "/api/products", session: { userId: "fixture" } } as any,
    { status(code: number) { statusCode = code; return this; }, json() {} } as any,
    () => { didNext = true; },
  );
  assert.equal(statusCode, 503);
  assert.equal(didNext, false);
});