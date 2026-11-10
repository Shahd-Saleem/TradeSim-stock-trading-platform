import type { PrismaClient } from "@/generated/prisma/client";
import {
  dailyPrice,
  dubaiDate,
  marketLockKey,
  validDate,
} from "./daily-market";
import { stocks } from "./market";
import { safeInteger } from "./portfolio";

type Identity = { symbol: string; exchange: string; sector: string };
export function previousTradingDay(day: string): string {
  const date = validDate(day);
  do {
    date.setUTCDate(date.getUTCDate() - 1);
  } while ([0, 6].includes(date.getUTCDay()));
  return date.toISOString().slice(0, 10);
}
/** Reverse the existing daily return, rounding once to the nearest fil. */
export function historicalPrevious(
  price: bigint,
  day: string,
  stock: Identity,
): bigint {
  if (price <= 0n) throw new Error("Historical anchor must be positive.");
  const { basisPoints } = dailyPrice(10000n, day, stock);
  const divisor = BigInt(10000 + basisPoints);
  const previous = (price * 10000n + divisor / 2n) / divisor;
  const result = previous < 1n ? 1n : previous;
  safeInteger(result);
  return result;
}
export function historicalSeries(
  anchor: { date: string; previousCloseFils: bigint },
  start: string,
  stock: Identity,
) {
  validDate(start);
  validDate(anchor.date);
  const result: {
    date: string;
    priceFils: bigint;
    previousCloseFils: bigint;
  }[] = [];
  let day = previousTradingDay(anchor.date);
  // Preserve the published anchor's previous close exactly at the join.
  let price = anchor.previousCloseFils;
  while (day >= start) {
    const previous = historicalPrevious(price, day, stock);
    result.push({ date: day, priceFils: price, previousCloseFils: previous });
    price = previous;
    day = previousTradingDay(day);
  }
  return result.reverse();
}
/** Insert only before each security's oldest quote; never rewrite published rows. */
export async function backfillMarket(db: PrismaClient, schema = "tradesim") {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${marketLockKey(schema)}, 0))::text`;
      const securities = await tx.security.findMany({
        where: {
          OR: stocks.map(({ exchange, symbol }) => ({ exchange, symbol })),
        },
        include: { quotes: { orderBy: { snapshotAt: "asc" }, take: 1 } },
      });
      if (securities.length !== 8 || securities.some((s) => !s.quotes[0]))
        throw new Error("All eight securities require an existing quote.");
      const latest = await tx.simulatedQuote.findFirstOrThrow({
        where: { securityId: { in: securities.map((s) => s.id) } },
        orderBy: { snapshotAt: "desc" },
      });
      const end = dubaiDate(latest.snapshotAt);
      const start = new Date(validDate(end).getTime() - 183 * 86400000)
        .toISOString()
        .slice(0, 10);
      const rows = securities.flatMap((security) => {
        const anchor = security.quotes[0];
        return historicalSeries(
          {
            date: dubaiDate(anchor.snapshotAt),
            previousCloseFils: anchor.previousCloseFils,
          },
          start,
          security,
        ).map((point) => ({
          securityId: security.id,
          priceFils: point.priceFils,
          previousCloseFils: point.previousCloseFils,
          volume: anchor.volume,
          snapshotAt: new Date(`${point.date}T15:00:00+04:00`),
        }));
      });
      if (rows.length) await tx.simulatedQuote.createMany({ data: rows });
      return { count: rows.length, start, end };
    },
    { maxWait: 15000, timeout: 60000 },
  );
}
