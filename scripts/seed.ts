import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const { createPrisma } = await import("../src/lib/prisma-client");
const { stocks, SNAPSHOT_DATE } = await import("../src/lib/market");
const db = createPrisma(process.env.DIRECT_URL || process.env.DATABASE_URL);
try {
  await db.$transaction(
    async (tx) => {
      for (const stock of stocks) {
        const { symbol, exchange, name, sector, color } = stock;
        const security = await tx.security.upsert({
          where: { exchange_symbol: { exchange, symbol } },
          create: { symbol, exchange, name, sector, color },
          update: { name, sector, color },
        });
        const snapshotAt = new Date(`${SNAPSHOT_DATE}T00:00:00Z`);
        const quote = {
          priceFils: BigInt(stock.priceFils),
          previousCloseFils: BigInt(stock.previousFils),
          volume: stock.volume,
        };
        await tx.simulatedQuote.upsert({
          where: {
            securityId_snapshotAt: { securityId: security.id, snapshotAt },
          },
          create: { securityId: security.id, snapshotAt, ...quote },
          update: {},
        });
      }
    },
    { timeout: 30000 },
  );
  console.log(
    "Seeded 8 simulated DFM/ADX securities and quotes. No users or trades created.",
  );
} catch {
  console.error("Seeding failed. Check migrations and database permissions.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
