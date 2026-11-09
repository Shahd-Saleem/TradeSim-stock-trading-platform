import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";
import { migrationUrl } from "./src/lib/database-config";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx scripts/seed.ts" },
  datasource: {
    url:
      process.env.DATABASE_URL || process.env.DIRECT_URL
        ? migrationUrl()
        : "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=tradesim",
  },
});
