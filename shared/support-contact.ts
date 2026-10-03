import { z } from "zod";

export const supportTelegramSchema = z.string({ required_error: "Telegram name is required" })
  .trim()
  .transform((value) => value.replace(/^@+/, ""))
  .pipe(z.string().regex(
    /^[A-Za-z0-9_]{5,32}$/,
    "Enter a valid Telegram username (5–32 letters, numbers, or underscores).",
  ));