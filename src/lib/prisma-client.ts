import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseConfig } from "./database-config";

/** Factory kept separate so integration tests can use an isolated schema. */
export function createPrisma(connectionString?: string, schema = "tradesim") {
  return new PrismaClient({
    adapter: new PrismaPg(databaseConfig(connectionString), { schema }),
    log: [],
  });
}
