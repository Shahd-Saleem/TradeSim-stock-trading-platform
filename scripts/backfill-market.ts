import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const { createPrisma } = await import("../src/lib/prisma-client");
const { backfillMarket } = await import("../src/lib/market-backfill");
if (process.argv.length > 2) {
  console.error("Usage: npm run market:backfill");
  process.exit(1);
}
const db = createPrisma(process.env.DIRECT_URL || process.env.DATABASE_URL);
try {
  const result = await backfillMarket(db);
  console.log(
    `Inserted ${result.count} fictional historical quotes. Coverage target: ${result.start} to ${result.end} (Asia/Dubai). Published prices and all financial records unchanged.`,
  );
} catch {
  console.error(
    "Historical backfill failed. Check administrative database connectivity and quote anchors; credentials withheld.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
