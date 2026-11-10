import { createMarketCronHttp } from "@/lib/market-cron-http";
import { marketWriter } from "@/lib/market-writer";
import { closedDates } from "@/lib/market-calendar";
import { syncMarket } from "@/lib/market-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = createMarketCronHttp(
  () =>
    syncMarket(
      marketWriter(),
      new Date(),
      closedDates(process.env.MARKET_CLOSED_DATES),
    ),
  () => process.env.CRON_SECRET,
  () =>
    process.env.MARKET_CRON_ENABLED === "true" &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production"),
);
