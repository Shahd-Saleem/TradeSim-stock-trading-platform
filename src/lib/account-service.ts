import type { PrismaClient } from "@/generated/prisma/client";
import type { AccountData } from "./account-types";
import { safeInteger, holdingAnalytics, portfolioAnalytics } from "./portfolio";
export { safeInteger } from "./portfolio";
/** Caller must verify the session. Repeatable-read prevents mixed pre/post-trade metrics. */
export async function readAccount(
  db: PrismaClient,
  userId: string,
): Promise<AccountData> {
  return db.$transaction(
    async (tx) => {
      const record = await tx.virtualAccount.findUnique({ where: { userId } });
      if (!record) throw new Error("Virtual account unavailable");
      // Serialize sibling reads on the transaction's single PostgreSQL connection.
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, email: true },
      });
      const holdingsRows = await tx.holding.findMany({
        where: {
          accountId: record.id,
          account: { userId },
          quantity: { gt: 0n },
        },
        orderBy: { securityId: "asc" },
        include: {
          security: {
            include: { quotes: { orderBy: { snapshotAt: "desc" }, take: 1 } },
          },
        },
      });
      const trades = await tx.trade.findMany({
        where: { accountId: record.id, account: { userId } },
        include: { security: { select: { symbol: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      const account = { ...record, user, holdings: holdingsRows, trades };
      // Aggregate the ENTIRE immutable ledger, independently of the display's 100-row cap.
      const totals = await tx.trade.groupBy({
        by: ["side"],
        where: { accountId: account.id, account: { userId } },
        _sum: { totalValueFils: true },
      });
      const purchases =
        totals.find((row) => row.side === "BUY")?._sum.totalValueFils ?? 0n;
      const sales =
        totals.find((row) => row.side === "SELL")?._sum.totalValueFils ?? 0n;
      const holdings = account.holdings.map((holding) => {
        const quote = holding.security.quotes[0];
        return {
          symbol: holding.security.symbol,
          exchange: holding.security.exchange,
          name: holding.security.name,
          quoteSnapshotAt: quote?.snapshotAt.toISOString() ?? null,
          ...holdingAnalytics(
            holding.quantity,
            holding.costBasisFils,
            quote?.priceFils ?? null,
          ),
        };
      });
      return {
        user: account.user,
        cashBalanceFils: safeInteger(account.cashBalanceFils),
        startingCapitalFils: safeInteger(account.startingCapitalFils),
        ...portfolioAnalytics(
          account.cashBalanceFils,
          account.startingCapitalFils,
          purchases,
          sales,
          account.holdings.map((holding) => ({
            quantity: holding.quantity,
            costBasisFils: holding.costBasisFils,
            priceFils: holding.security.quotes[0]?.priceFils ?? null,
          })),
        ),
        holdings,
        trades: account.trades.map((trade) => ({
          id: trade.id,
          symbol: trade.security.symbol,
          side: trade.side,
          quantity: safeInteger(trade.quantity),
          totalValueFils: safeInteger(trade.totalValueFils),
          createdAt: trade.createdAt.toISOString(),
        })),
      };
    },
    { isolationLevel: "RepeatableRead", maxWait: 10000, timeout: 15000 },
  );
}
