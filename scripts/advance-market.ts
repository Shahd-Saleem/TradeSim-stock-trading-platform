import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const { createPrisma } = await import("../src/lib/prisma-client");
const { advanceMarket } = await import("../src/lib/daily-market");
const args = process.argv.slice(2);
if (
  args.length &&
  (args.length !== 2 ||
    args[0] !== "--date" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(args[1]))
) {
  console.error("Usage: npm run market:advance -- [--date YYYY-MM-DD]");
  process.exit(1);
}
const db = createPrisma(process.env.DIRECT_URL || process.env.DATABASE_URL);
try {
  const result = await advanceMarket(db, args[1]);
  console.log(
    `${result.created ? "Published" : "Already stored:"} ${result.count} fictional quotes for ${result.date} (Asia/Dubai). Accounts, balances, holdings and trades unchanged.`,
  );
} catch (error) {
  // Domain errors are fixed messages; never print Prisma/network diagnostics or URLs.
  const messages = [
    "Simulation sessions",
    "Use a YYYY",
    "Invalid simulation",
    "All eight",
    "Latest quote",
    "That date",
    "Advance one",
    "Financial value",
    "Previous price",
  ];
  console.error(
    error instanceof Error &&
      messages.some((prefix) => error.message.startsWith(prefix))
      ? error.message
      : "Market advance failed. Verify database connectivity and administrative permissions; no credentials logged.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
