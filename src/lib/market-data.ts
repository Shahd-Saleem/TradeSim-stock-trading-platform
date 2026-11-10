import type { PrismaClient } from "@/generated/prisma/client";
import { stockSchema, stocks, type Stock } from "./market";
import { dubaiDate } from "./daily-market";
import { safeInteger } from "./portfolio";
export type PricePoint = { time: string; priceFils: number };
export type MarketStock = Stock & {
  snapshotAt: string;
  sessionDate: string;
  history: PricePoint[];
};
export type MarketData = { stocks: MarketStock[]; sessionDate: string };
/** One consistent snapshot: no fabricated prices or fallback history. */
export async function readMarket(db: PrismaClient): Promise<MarketData> {
  return db.$transaction(
    async (tx) => {
      const result: MarketStock[] = [];
      const securities = await tx.security.findMany({
        where: {
          OR: stocks.map(({ exchange, symbol }) => ({ exchange, symbol })),
        },
        include: { quotes: { orderBy: { snapshotAt: "desc" }, take: 181 } },
      });
      for (const registry of stocks) {
        const security = securities.find(
          (row) =>
            row.exchange === registry.exchange &&
            row.symbol === registry.symbol,
        );
        if (!security?.quotes.length)
          throw new Error(
            "Simulated market data unavailable. Check database seeding.",
          );
        const latest = security.quotes[0];
        // Legacy snapshots may contain intraday rows: show their last persisted quote per Dubai date.
        const daily = new Map<string, PricePoint>();
        for (const quote of security.quotes) {
          const day = dubaiDate(quote.snapshotAt);
          if (!daily.has(day))
            daily.set(day, {
              time: day,
              priceFils: safeInteger(quote.priceFils),
            });
        }
        result.push({
          ...stockSchema.parse({
            ...security,
            priceFils: safeInteger(latest.priceFils),
            previousFils: safeInteger(latest.previousCloseFils),
            volume: latest.volume,
          }),
          sessionDate: dubaiDate(latest.snapshotAt),
          snapshotAt: latest.snapshotAt.toISOString(),
          history: [...daily.values()].reverse(),
        });
      }
      const sessionDate = result
        .map((stock) => stock.sessionDate)
        .sort()
        .at(-1)!;
      return { stocks: result, sessionDate };
    },
    { isolationLevel: "RepeatableRead", maxWait: 10000, timeout: 30000 },
  );
}
