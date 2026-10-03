import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { products } from "../shared/schema";
import { discountFingerprint, getDiscountCycleKey } from "../shared/product-discounts";
import { reserveDiscountCaps, releaseDiscountCaps, DiscountCapChangedError } from "./product-discount-cap";

const product = {
  id: 1, price: "10.00", sellingMethod: "units", discountPercentage: "20",
  discountItemLimit: 3, discountCampaignId: "test-campaign",
};
const reservation = (quantity: number, p: any = product) => ({
  productId: p.id, quantity, cycleKey: getDiscountCycleKey(p), fingerprint: discountFingerprint(p),
});

/** Model transaction serialization/rollback without changing application data. */
function harness(initialUsage = 0, currentProduct: any = product) {
  let used = initialUsage;
  let waiting = Promise.resolve();
  const statements: string[] = [];
  const dialect = new PgDialect();
  async function transaction(run: (tx: any) => Promise<any>) {
    let unlock: (() => void) | undefined;
    let before: number | undefined;
    const tx = {
      select() {
        let table: any;
        const builder: any = {
          from(value: any) { table = value; return builder; },
          where() { return builder; },
          orderBy() { return builder; },
          async for(mode: string) {
            assert.equal(mode, "update");
            const previous = waiting;
            waiting = new Promise<void>(resolve => { unlock = resolve; });
            await previous;
            before = used;
            return table === products ? [currentProduct] : [];
          },
          then(resolve: any, reject: any) { return Promise.resolve(table === products ? [currentProduct] : []).then(resolve, reject); },
        };
        return builder;
      },
      async execute(query: any) {
        const compiled = dialect.sqlToQuery(query);
        statements.push(compiled.sql);
        assert.ok(unlock, "usage changes must occur after a product FOR UPDATE lock");
        if (compiled.sql.startsWith("SELECT")) return { rows: [{ used_items: used }] };
        if (compiled.sql.includes("INSERT INTO")) used += Number(compiled.params[3]);
        else if (compiled.sql.includes("UPDATE product_discount_usage")) used = Math.max(0, used - Number(compiled.params[0]));
        return { rows: [] };
      },
    };
    try { return await run(tx); }
    catch (error) { if (before !== undefined) used = before; throw error; }
    finally { unlock?.(); }
  }
  return { transaction, used: () => used, statements };
}

test("concurrent checkouts cannot both claim an allowance that only covers one", async () => {
  const state = harness();
  const results = await Promise.allSettled([1, 2].map(() => state.transaction(tx =>
    reserveDiscountCaps(tx, [reservation(2)], [{ productId: 1 }], "customer"),
  )));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal(state.used(), 2);
});

test("an order failure rolls back its allowance reservation", async () => {
  const state = harness(1);
  await assert.rejects(state.transaction(async tx => {
    await reserveDiscountCaps(tx, [reservation(2)], [{ productId: 1 }], "customer");
    throw new Error("stock or order insertion failed");
  }), /stock or order insertion failed/);
  assert.equal(state.used(), 1);
});

test("a changed cap or price rejects checkout instead of silently charging more", async () => {
  const state = harness(0, { ...product, discountPercentage: "30" });
  await assert.rejects(state.transaction(tx => reserveDiscountCaps(tx, [reservation(1)], [{ productId: 1 }], "customer")), DiscountCapChangedError);
  assert.equal(state.used(), 0);
});

test("forged, missing, or anonymous cap claims are rejected", async () => {
  const state = harness();
  await assert.rejects(state.transaction(tx => reserveDiscountCaps(tx, [], [{ productId: 1 }], "customer")), DiscountCapChangedError);
  await assert.rejects(state.transaction(tx => reserveDiscountCaps(tx, [reservation(1)], [{ productId: 1 }], null)), DiscountCapChangedError);
  await assert.rejects(state.transaction(tx => reserveDiscountCaps(tx, [reservation(-1)], [{ productId: 1 }], "customer")), DiscountCapChangedError);
  assert.equal(state.used(), 0);
});

test("cancellation returns the recorded usage to its original customer/window", async () => {
  const state = harness(3);
  await state.transaction(async tx => {
    await tx.select().from(products).where().orderBy().for("update");
    await releaseDiscountCaps(tx, { customerId: "customer", discountCapUsage: [{ productId: 1, cycleKey: getDiscountCycleKey(product), quantity: 2 }] });
  });
  assert.equal(state.used(), 1);
  assert.match(state.statements[0], /user_id =/);
  assert.match(state.statements[0], /cycle_key =/);
});

test("server-expanded bag components do not use standalone item allowances", async () => {
  const state = harness();
  const result = await state.transaction(tx => reserveDiscountCaps(tx, [], [{ productId: 1, metadata: { fromStandardBag: true } }, { productId: 1, metadata: { fromCgBag: true } }], "customer"));
  assert.deepEqual(result, []);
  assert.equal(state.used(), 0);
});