import type { PrismaClient } from "@/generated/prisma/client";
import { dailyQuoteRows, latestMarket, marketLockKey } from "./daily-market";
import { latestCompletedSession, nextSession } from "./market-calendar";

export const MAX_CATCHUP_SESSIONS = 40;
/** Clock/config supplied by trusted server code only, never by the HTTP caller. */
export async function syncMarket(
  db: PrismaClient,
  now: Date,
  closures: ReadonlySet<string>,
  schema = "tradesim",
) {
  const target = latestCompletedSession(now, closures);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${marketLockKey(schema)}, 0))::text`;
      const market = await latestMarket(tx);
      let latest = market.date;
      const rows: ReturnType<typeof dailyQuoteRows> = [];
      let sessions = 0;
      let next = nextSession(latest, closures);
      while (next <= target && sessions < MAX_CATCHUP_SESSIONS) {
        const quotes = dailyQuoteRows(market.securities, next);
        rows.push(...quotes);
        for (const [index, security] of market.securities.entries())
          security.quotes[0] = { ...security.quotes[0], ...quotes[index] };
        latest = next;
        next = nextSession(latest, closures);
        sessions++;
      }
      if (rows.length) await tx.simulatedQuote.createMany({ data: rows });
      return {
        latestSession: latest,
        targetSession: target,
        sessionsPublished: sessions,
        quotesPublished: rows.length,
        moreSessionsPending: next <= target,
        aheadOfClock: latest > target,
        simulated: true,
      };
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
