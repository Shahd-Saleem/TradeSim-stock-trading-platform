import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { stocks } from "./market";
import { safeInteger } from "./portfolio";

const dubaiFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function dubaiDate(date: Date): string {
  const parts = dubaiFormatter.formatToParts(date);
  const part = (name: string) =>
    parts.find((value) => value.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validDate(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error("Use a YYYY-MM-DD simulation date.");
  const date = new Date(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== day
  )
    throw new Error("Invalid simulation date.");
  return date;
}
export function nextTradingDay(day: string): string {
  const date = validDate(day);
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while ([0, 6].includes(date.getUTCDay()));
  return date.toISOString().slice(0, 10);
}
function noise(key: string, scale: number): number {
  const hash = createHash("sha256").update(`tradesim-daily-v1:${key}`).digest();
  const range = 2 * scale + 1;
  return Math.trunc(
    ((hash.readUInt32BE(0) % range) -
      scale +
      ((hash.readUInt32BE(4) % range) - scale)) /
      2,
  );
}
export function dailyPrice(
  previous: bigint,
  day: string,
  stock: { symbol: string; exchange: string; sector: string },
) {
  validDate(day);
  if (previous <= 0n) throw new Error("Previous price must be positive.");
  const volatility =
    stock.sector === "Utilities" ? 80 : stock.sector === "Banking" ? 130 : 180;
  const basisPoints =
    noise(`${day}:market`, 70) +
    noise(`${day}:sector:${stock.sector}`, 50) +
    noise(`${day}:${stock.exchange}:${stock.symbol}`, volatility);
  const value = (previous * BigInt(10000 + basisPoints) + 5000n) / 10000n;
  const priceFils = value < 1n ? 1n : value;
  safeInteger(priceFils);
  return { priceFils, basisPoints };
}
export function marketLockKey(schema: string) {
  if (!/^tradesim(?:_test_[a-f0-9]{24})?$/.test(schema))
    throw new Error("Invalid database schema");
  return `tradesim-daily-market:${schema}`;
}
/** Administrative, local-only command. Never call with client-supplied credentials. */
export async function advanceMarket(
  db: PrismaClient,
  targetDate?: string,
  schema = "tradesim",
) {
  if (targetDate) {
    const date = validDate(targetDate);
    if ([0, 6].includes(date.getUTCDay()))
      throw new Error("Simulation sessions are Monday to Friday.");
  }
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${marketLockKey(schema)}, 0))::text`;
      const rows = await tx.security.findMany({
        where: {
          OR: stocks.map(({ exchange, symbol }) => ({ exchange, symbol })),
        },
        include: { quotes: { orderBy: { snapshotAt: "desc" }, take: 1 } },
      });
      const securities = stocks.map((stock) => {
        const security = rows.find(
          (row) =>
            row.exchange === stock.exchange && row.symbol === stock.symbol,
        );
        if (!security?.quotes[0])
          throw new Error(
            "All eight securities require an existing quote. Check database seeding.",
          );
        return security;
      });
      const latestDates = securities.map((security) =>
        dubaiDate(security.quotes[0].snapshotAt),
      );
      const latestDate = latestDates[0];
      if (latestDates.some((day) => day !== latestDate))
        throw new Error(
          "Latest quote dates differ. Review market data before advancing; nothing was changed.",
        );
      const day = targetDate ?? nextTradingDay(latestDate);
      if (day <= latestDate) {
        const from = new Date(`${day}T00:00:00+04:00`);
        const until = new Date(from.getTime() + 86400000);
        const existing = await tx.simulatedQuote.findMany({
          where: {
            securityId: { in: securities.map((security) => security.id) },
            snapshotAt: { gte: from, lt: until },
          },
          distinct: ["securityId"],
          select: { securityId: true },
        });
        if (existing.length !== 8)
          throw new Error(
            "That date is incomplete. Existing history was preserved; manual review required.",
          );
        return { date: day, created: false, count: 8 };
      }
      if (day !== nextTradingDay(latestDate))
        throw new Error(
          "Advance one eligible weekday at a time; dates cannot be skipped.",
        );
      const quotes = securities.map((security) => {
        const previous = security.quotes[0];
        const { priceFils } = dailyPrice(previous.priceFils, day, security);
        return {
          securityId: security.id,
          priceFils,
          previousCloseFils: previous.priceFils,
          volume: previous.volume,
          snapshotAt: new Date(`${day}T15:00:00+04:00`),
        };
      });
      await tx.simulatedQuote.createMany({ data: quotes });
      return { date: day, created: true, count: 8 };
    },
    { maxWait: 15000, timeout: 30000 },
  );
}
