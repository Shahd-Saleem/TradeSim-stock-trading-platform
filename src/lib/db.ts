import "server-only";
import { createPrisma } from "./prisma-client";
const shared = globalThis as unknown as {
  tradeSimPrisma?: ReturnType<typeof createPrisma>;
};
export const db = shared.tradeSimPrisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") shared.tradeSimPrisma = db;
