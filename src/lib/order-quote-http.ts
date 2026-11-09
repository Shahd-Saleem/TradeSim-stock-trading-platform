import type { PrismaClient } from "@/generated/prisma/client";
import type { createAuth } from "./auth-core";
import { readOrderQuote } from "./order-quote";
import { OrderError } from "./trading";
export async function orderQuoteResponse(
  auth: ReturnType<typeof createAuth>,
  db: PrismaClient,
  request: Request,
  secret = process.env.BETTER_AUTH_SECRET ?? "",
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (!(await auth.api.getSession({ headers: request.headers })))
      return Response.json(
        { message: "Sign in to trade." },
        { status: 401, headers },
      );
    const params = new URL(request.url).searchParams;
    const exchange = params.get("exchange") ?? "";
    const symbol = params.get("symbol") ?? "";
    if (!["DFM", "ADX"].includes(exchange) || !/^[A-Z0-9]{1,20}$/.test(symbol))
      return Response.json(
        { message: "Invalid security." },
        { status: 400, headers },
      );
    return Response.json(await readOrderQuote(db, exchange, symbol, secret), {
      headers,
    });
  } catch (error) {
    return Response.json(
      { message: "Unable to load the simulated quote." },
      { status: error instanceof OrderError ? error.status : 503, headers },
    );
  }
}
