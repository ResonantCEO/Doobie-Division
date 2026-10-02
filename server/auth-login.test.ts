import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import { setupAuth } from "./auth";
import { storage } from "./storage";

test("pending users authenticate with their password without becoming active", async () => {
  const originals = {
    getSiteSetting: storage.getSiteSetting,
    getUserByEmail: storage.getUserByEmail,
    logUserActivity: storage.logUserActivity,
  };
  const hash = await bcrypt.hash("support-login-fixture", 4);
  let accountStatus = "pending";
  const handlers = new Map<string, Function>();
  try {
    // Exercise the real login handler without creating accounts or database sessions.
    storage.getSiteSetting = async () => "2099-01-01T00:00:00.000Z";
    storage.getUserByEmail = async () => ({
      id: "pending-login-fixture", status: accountStatus, password: hash, role: "customer",
    } as any);
    storage.logUserActivity = async () => undefined as any;
    const app: any = {
      locals: {}, set() {}, use() {}, get() {}, put() {},
      post(path: string, handler: Function) { handlers.set(path, handler); },
    };
    await setupAuth(app);
    const login = handlers.get("/api/auth/login")!;
    async function attempt(password: string) {
      let status = 200;
      let body: any;
      const session: any = { save(callback: Function) { callback(); } };
      await new Promise<void>((resolve, reject) => {
        const result = login(
          { body: { email: "fixture@example.invalid", password }, session, get() {}, ip: "test" },
          { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; resolve(); } },
        );
        Promise.resolve(result).catch(reject);
      });
      return { status, body, session };
    }
    const pending = await attempt("support-login-fixture");
    assert.equal(pending.status, 200);
    assert.equal(pending.session.userId, "pending-login-fixture");
    assert.equal(pending.body.user.status, "pending");
    assert.equal("password" in pending.body.user, false);
    const wrongPassword = await attempt("incorrect-fixture");
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.session.userId, undefined);
    accountStatus = "active";
    assert.equal((await attempt("support-login-fixture")).status, 200);
    accountStatus = "inactive";
    assert.equal((await attempt("support-login-fixture")).status, 401);
  } finally {
    Object.assign(storage, originals);
  }
});