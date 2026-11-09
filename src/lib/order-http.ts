import type { PrismaClient } from "@/generated/prisma/client";
import type { createAuth } from "./auth-core";
import { executeOrder, listTrades } from "./order-service";
import { OrderError, orderSchema } from "./trading";

export function createOrderHttp(
  auth: ReturnType<typeof createAuth>,
  db: PrismaClient,
  baseURL: string,
  schema = "tradesim",
) {
  const headers = { "Cache-Control": "private, no-store" };
  const error = (code: string, message: string, status: number) =>
    Response.json({ ok: false, error: { code, message } }, { status, headers });
  return {
    async POST(request: Request) {
      try {
        if (request.headers.get("origin") !== new URL(baseURL).origin)
          return error("INVALID_ORIGIN", "Invalid request origin.", 403);
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session)
          return error(
            "UNAUTHENTICATED",
            "Sign in to place a simulated order.",
            401,
          );
        if (
          request.headers.get("content-type")?.split(";")[0].trim() !==
          "application/json"
        )
          return error("INVALID_CONTENT_TYPE", "Use application/json.", 415);
        const reader = request.body?.getReader();
        if (!reader) return error("INVALID_ORDER", "Order body required.", 400);
        let raw = "";
        let bytes = 0;
        const decoder = new TextDecoder();
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 8192) {
            await reader.cancel();
            return error("BODY_TOO_LARGE", "Order body too large.", 413);
          }
          raw += decoder.decode(chunk.value, { stream: true });
        }
        let body: unknown;
        try {
          body = JSON.parse(raw + decoder.decode());
        } catch {
          return error("INVALID_ORDER", "Invalid JSON.", 400);
        }
        const parsed = orderSchema.safeParse(body);
        if (!parsed.success)
          return error(
            "INVALID_ORDER",
            "Provide exchange, symbol, side, positive whole quantity and UUID idempotencyKey only.",
            400,
          );
        const result = await executeOrder(
          db,
          session.user.id,
          parsed.data,
          schema,
        );
        return Response.json(
          { ok: true, ...result },
          { status: result.replayed ? 200 : 201, headers },
        );
      } catch (cause) {
        if (cause instanceof OrderError)
          return error(cause.code, cause.message, cause.status);
        return error(
          "TEMPORARILY_UNAVAILABLE",
          "Order service unavailable. Retry with the same idempotency key.",
          503,
        );
      }
    },
    async GET(request: Request) {
      try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session)
          return error("UNAUTHENTICATED", "Sign in to view trades.", 401);
        return Response.json(
          { ok: true, trades: await listTrades(db, session.user.id) },
          { headers },
        );
      } catch {
        return error(
          "TEMPORARILY_UNAVAILABLE",
          "Trade history unavailable.",
          503,
        );
      }
    },
  };
}
