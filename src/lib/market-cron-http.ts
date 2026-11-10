import { createHash, timingSafeEqual } from "node:crypto";
import type { syncMarket } from "./market-sync";
export function createMarketCronHttp(
  run: () => ReturnType<typeof syncMarket>,
  secret: () => string | undefined,
  enabled: () => boolean,
) {
  return async function GET(request: Request) {
    const headers = { "Cache-Control": "private, no-store" };
    const error = (status: number, message: string) =>
      Response.json({ ok: false, message }, { status, headers });
    if (!enabled())
      return error(503, "Scheduled market updates are not enabled.");
    const expected = secret();
    if (!expected || !/^[A-Za-z0-9_-]{32,256}$/.test(expected))
      return error(503, "Scheduled market updates are not configured.");
    const actual = request.headers.get("authorization") ?? "";
    const hash = (s: string) => createHash("sha256").update(s).digest();
    if (!timingSafeEqual(hash(actual), hash(`Bearer ${expected}`)))
      return error(401, "Unauthorized.");
    if (new URL(request.url).search)
      return error(400, "Query parameters are not supported.");
    try {
      return Response.json({ ok: true, ...(await run()) }, { headers });
    } catch {
      return error(
        503,
        "Market publication failed. Retry safely or inspect the market configuration.",
      );
    }
  };
}
