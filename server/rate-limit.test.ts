import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createApiRateLimiter, createRateLimit } from "./rate-limit";

function request(limiter: Function, path: string, options: { method?: string; status?: number; ip?: string } = {}) {
  let allowed = false;
  let body: any;
  const headers: Record<string, unknown> = {};
  const response: any = new EventEmitter();
  response.statusCode = options.status ?? 200;
  response.setHeader = (name: string, value: unknown) => { headers[name] = value; };
  response.status = (code: number) => { response.statusCode = code; return response; };
  response.json = (value: unknown) => { body = value; return response; };
  limiter(
    { ip: options.ip ?? "fixture-ip", path, method: options.method ?? "GET" },
    response,
    () => { allowed = true; },
  );
  response.emit("finish");
  return { allowed, body, headers, status: response.statusCode };
}

test("session polling and ordinary browsing never consume the login quota", () => {
  const limiter = createApiRateLimiter();
  for (let i = 0; i < 150; i++) assert.equal(request(limiter, "/auth/user").allowed, true);
  for (let i = 0; i < 500; i++) assert.equal(request(limiter, "/products").allowed, true);
  assert.equal(request(limiter, "/products").status, 429);
  assert.equal(request(limiter, "/auth/login", { method: "POST" }).allowed, true);
  assert.equal(request(limiter, "/auth/logout", { method: "POST" }).allowed, true);
});

test("successful account switching does not accumulate failed sign-in attempts", () => {
  const limiter = createApiRateLimiter();
  for (let i = 0; i < 30; i++) {
    assert.equal(request(limiter, "/auth/login", { method: "POST" }).allowed, true);
    assert.equal(request(limiter, "/auth/logout", { method: "POST" }).allowed, true);
  }
});

test("failed logins remain limited, with retry guidance and separate IP quotas", () => {
  const limiter = createApiRateLimiter();
  for (let i = 0; i < 10; i++) {
    assert.equal(request(limiter, "/auth/login", { method: "POST", status: 401 }).allowed, true);
  }
  const blocked = request(limiter, "/AUTH/LOGIN/", { method: "POST" });
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.message, /failed sign-in/);
  assert.ok(Number(blocked.headers["Retry-After"]) > 0);
  assert.equal(request(limiter, "/auth/login", { method: "POST", ip: "different-ip" }).allowed, true);
  assert.equal(request(limiter, "/auth/logout", { method: "POST" }).allowed, true);
});

test("registration and password resets have separate quotas from login", () => {
  const limiter = createApiRateLimiter();
  for (let i = 0; i < 10; i++) assert.equal(request(limiter, "/auth/register", { method: "POST" }).allowed, true);
  assert.equal(request(limiter, "/auth/register", { method: "POST" }).status, 429);
  assert.equal(request(limiter, "/auth/reset-password", { method: "POST" }).allowed, true);
  assert.equal(request(limiter, "/auth/login", { method: "POST" }).allowed, true);
});

test("successful logins do not clear earlier failures, and limits expire at the window boundary", () => {
  let now = 0;
  const limiter = createRateLimit(new Map(), 2, 1000, { skipSuccessful: true, now: () => now });
  assert.equal(request(limiter, "/login", { status: 401 }).allowed, true);
  assert.equal(request(limiter, "/login", { status: 200 }).allowed, true);
  assert.equal(request(limiter, "/login", { status: 401 }).allowed, true);
  assert.equal(request(limiter, "/login").status, 429);
  now = 1000;
  assert.equal(request(limiter, "/login").allowed, true);
});