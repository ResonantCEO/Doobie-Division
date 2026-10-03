import assert from "node:assert/strict";
import test from "node:test";
import { insertCustomerSupportTicketSchema, insertSupportTicketSchema } from "@shared/schema";

const ticket = {
  customerName: "Support fixture",
  subject: "Support Request",
  message: "Support fixture message",
};

test("signed-in support tickets require a nonempty valid Telegram username", () => {
  for (const customerTelegram of [undefined, null, "", " ", "@", "abc", "bad handle", "x".repeat(33)]) {
    const result = insertCustomerSupportTicketSchema.safeParse({ ...ticket, customerTelegram });
    assert.equal(result.success, false, String(customerTelegram));
    if (!result.success) assert.equal(result.error.issues[0].path[0], "customerTelegram");
  }
});

test("submitted Telegram contacts are normalized and preserved on the ticket", () => {
  const parsed = insertCustomerSupportTicketSchema.parse({ ...ticket, customerTelegram: " @support_fixture " });
  assert.equal(parsed.customerTelegram, "support_fixture");
  assert.equal(insertCustomerSupportTicketSchema.parse({ ...ticket, customerTelegram: "support_fixture" }).customerTelegram, "support_fixture");
});

test("public and legacy ticket creation keep their existing optional contact behavior", () => {
  assert.equal(insertSupportTicketSchema.safeParse(ticket).success, true);
});