import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { OrderError } from "./trading";

function signature(payload: string, secret: string) {
  if (!secret) throw new Error("Quote signing configuration required");
  return createHmac("sha256", secret)
    .update(`order-quote:${payload}`)
    .digest("base64url");
}
export async function readOrderQuote(
  db: PrismaClient,
  exchange: string,
  symbol: string,
  secret: string,
) {
  const security = await db.security.findUnique({
    where: { exchange_symbol: { exchange, symbol } },
    include: { quotes: { orderBy: { snapshotAt: "desc" }, take: 1 } },
  });
  const quote = security?.quotes[0];
  if (!quote || quote.priceFils > BigInt(Number.MAX_SAFE_INTEGER))
    throw new OrderError(
      "QUOTE_UNAVAILABLE",
      "Simulated quote unavailable.",
      503,
    );
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({
      exchange,
      symbol,
      id: quote.id,
      price: quote.priceFils.toString(),
      expiresAt,
    }),
  ).toString("base64url");
  return {
    priceFils: Number(quote.priceFils),
    snapshotAt: quote.snapshotAt.toISOString(),
    expiresAt,
    token: `${payload}.${signature(payload, secret)}`,
  };
}
export function verifyOrderQuote(
  token: string,
  exchange: string,
  symbol: string,
  quote: { id: string; priceFils: bigint },
  secret: string,
) {
  const invalid = () =>
    new OrderError(
      "QUOTE_CHANGED",
      "The simulated quote changed or expired. Refresh it and review your order again.",
      409,
    );
  try {
    const [payload, signed, extra] = token.split(".");
    if (!payload || !signed || extra) throw invalid();
    const actual = Buffer.from(signed);
    const expected = Buffer.from(signature(payload, secret));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw invalid();
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      data.exchange !== exchange ||
      data.symbol !== symbol ||
      data.id !== quote.id ||
      data.price !== quote.priceFils.toString() ||
      !Number.isFinite(data.expiresAt) ||
      data.expiresAt <= Date.now()
    )
      throw invalid();
  } catch {
    throw invalid();
  }
}
