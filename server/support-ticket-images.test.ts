import assert from "node:assert/strict";
import test from "node:test";
import { db } from "./db";
import { storage } from "./storage";
import { supportTicketResponses } from "@shared/schema";

test("staff and customer ticket reads preserve original and reply attachment links", async () => {
  const originalSelect = db.select;
  const initialImages = JSON.stringify(["/api/support-images/original.webp"]);
  const responses = [
    { id: 1, type: "staff", message: "(image attached)", imageUrls: JSON.stringify(["/api/support-images/staff.webp"]) },
    { id: 2, type: "customer", message: "Customer photo", imageUrls: JSON.stringify(["/api/support-images/customer.webp"]) },
    { id: 3, type: "staff", message: "Text-only reply", imageUrls: null },
  ];
  const responseProjections: any[] = [];
  try {
    // Exercise the real storage methods without touching accounts or database records.
    (db as any).select = (projection: any) => {
      const rows = projection.ticket
        ? [{ ticket: { id: 123, assignedTo: null, imageUrls: initialImages }, user: null }]
        : responses.map(({ imageUrls, ...response }) => ({
            ...response,
            ...(projection.imageUrls ? { imageUrls } : {}),
          }));
      if (!projection.ticket) responseProjections.push(projection);
      const query = {
        from() { return query; },
        leftJoin() { return query; },
        where() { return query; },
        orderBy() { return Promise.resolve(rows); },
      };
      return query;
    };
    for (const tickets of [
      await storage.getSupportTickets(),
      await storage.getCustomerTickets("support-image-fixture"),
    ]) {
      assert.equal(tickets[0].ticket.imageUrls, initialImages);
      assert.deepEqual(tickets[0].responses.map((response: any) => response.imageUrls), responses.map((response) => response.imageUrls));
      assert.deepEqual(tickets[0].responses.map((response: any) => response.message), responses.map((response) => response.message));
    }
    assert.equal(responseProjections.length, 2);
    for (const projection of responseProjections) {
      assert.equal(projection.imageUrls, supportTicketResponses.imageUrls);
    }
  } finally {
    db.select = originalSelect;
  }
});