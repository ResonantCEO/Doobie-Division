
import { db } from "./db";
import { supportTickets, notifications } from "@shared/schema";
import { eq, or } from "drizzle-orm";

async function clearTicketsAndNotifications() {
  try {
    console.log("Clearing support tickets and related notifications...");

    // Delete all ticket-related notifications
    const deletedNotifications = await db
      .delete(notifications)
      .where(
        or(
          eq(notifications.type, 'new_support_ticket'),
          eq(notifications.type, 'support_ticket_update')
        )
      );

    console.log("Deleted ticket-related notifications");

    // Delete all support tickets
    const deletedTickets = await db.delete(supportTickets);

    console.log("Deleted all support tickets");

    console.log("Successfully cleared all tickets and ticket notifications!");
    
    process.exit(0);
  } catch (error) {
    console.error("Error clearing tickets:", error);
    process.exit(1);
  }
}

clearTicketsAndNotifications();
