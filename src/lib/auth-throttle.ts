import { createHmac } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

/** Atomic, shared across instances; does not store email addresses in limiter keys. */
export async function consumeAuthAttempt(
  db: PrismaClient,
  email: string,
  secret: string,
  schema = "tradesim",
) {
  if (!/^tradesim(?:_test_[a-f0-9]+)?$/.test(schema))
    throw new Error("Invalid schema");
  const key = createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest("hex");
  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const rows = await db.$queryRawUnsafe<{ count: number }[]>(
    `
    INSERT INTO "${schema}"."AuthThrottle" AS throttle ("key", "count", "windowStart") VALUES ($1, 1, $2)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN throttle."windowStart" < $3 THEN 1 ELSE LEAST(throttle."count" + 1, 1000) END,
      "windowStart" = CASE WHEN throttle."windowStart" < $3 THEN $2 ELSE throttle."windowStart" END
    RETURNING "count"`,
    key,
    now,
    cutoff,
  );
  return rows[0].count <= 8;
}
