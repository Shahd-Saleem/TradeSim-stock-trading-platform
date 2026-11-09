import type { PrismaClient } from "@/generated/prisma/client";
import type { AccountData } from "./account-types";
export function safeInteger(value: bigint) {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new RangeError("Financial value exceeds display range");
  return number;
}
/** Only call after session verification. There is no account ID supplied by the browser. */
export async function readAccount(
  db: PrismaClient,
  userId: string,
): Promise<AccountData> {
  const account = await db.virtualAccount.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true, email: true } },
      holdings: {
        include: {
          security: {
            include: { quotes: { orderBy: { snapshotAt: "desc" }, take: 1 } },
          },
        },
      },
      trades: {
        include: { security: { select: { symbol: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
  if (!account) throw new Error("Virtual account unavailable");
  let portfolio = account.cashBalanceFils;
  const holdings = account.holdings.map((holding) => {
    const quote = holding.security.quotes[0];
    if (!quote) throw new Error("Simulated quote unavailable");
    const value = holding.quantity * quote.priceFils;
    portfolio += value;
    return {
      symbol: holding.security.symbol,
      exchange: holding.security.exchange,
      quantity: safeInteger(holding.quantity),
      costBasisFils: safeInteger(holding.costBasisFils),
      valueFils: safeInteger(value),
    };
  });
  return {
    user: account.user,
    cashBalanceFils: safeInteger(account.cashBalanceFils),
    startingCapitalFils: safeInteger(account.startingCapitalFils),
    portfolioValueFils: safeInteger(portfolio),
    profitLossFils: safeInteger(portfolio - account.startingCapitalFils),
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
}
