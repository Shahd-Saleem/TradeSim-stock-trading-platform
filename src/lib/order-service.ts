import type { PrismaClient, Trade } from "@/generated/prisma/client";
import {
  calculateOrder,
  OrderError,
  orderSchema,
  type OrderInput,
} from "./trading";

function receipt(trade: Trade, security: { symbol: string; exchange: string }) {
  return {
    id: trade.id,
    ...security,
    side: trade.side,
    quantity: trade.quantity.toString(),
    priceFils: trade.priceFils.toString(),
    totalValueFils: trade.totalValueFils.toString(),
    currency: "AED",
    simulated: true,
    createdAt: trade.createdAt.toISOString(),
    idempotencyKey: trade.idempotencyKey,
  };
}

// userId must come from a verified server session, never from request JSON.
export async function executeOrder(
  db: PrismaClient,
  userId: string,
  input: OrderInput,
  schema = "tradesim",
) {
  if (!/^tradesim(?:_test_[a-f0-9]{24})?$/.test(schema))
    throw new Error("Invalid database schema");
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success)
    throw new OrderError(
      "INVALID_ORDER",
      "Enter a supported security, side, positive whole quantity and UUID idempotency key.",
      400,
    );
  const order = parsed.data;
  return db.$transaction(
    async (tx) => {
      // Parameterized identity; schema is a strictly validated internal identifier.
      // READ COMMITTED + one account mutex serializes all writes for this account.
      const accounts = await tx.$queryRawUnsafe<
        { id: string; cashBalanceFils: bigint }[]
      >(
        `SELECT "id", "cashBalanceFils" FROM "${schema}"."VirtualAccount" WHERE "userId" = $1 FOR UPDATE`,
        userId,
      );
      const account = accounts[0];
      if (!account)
        throw new OrderError(
          "ACCOUNT_NOT_FOUND",
          "Virtual account unavailable.",
          404,
        );
      const existing = await tx.trade.findUnique({
        where: {
          accountId_idempotencyKey: {
            accountId: account.id,
            idempotencyKey: order.idempotencyKey,
          },
        },
        include: { security: true },
      });
      if (existing) {
        if (
          existing.security.symbol !== order.symbol ||
          existing.security.exchange !== order.exchange ||
          existing.side !== order.side ||
          existing.quantity !== BigInt(order.quantity)
        )
          throw new OrderError(
            "IDEMPOTENCY_CONFLICT",
            "This idempotency key belongs to a different order.",
            409,
          );
        return {
          trade: receipt(existing, {
            symbol: existing.security.symbol,
            exchange: existing.security.exchange,
          }),
          replayed: true,
        };
      }
      const security = await tx.security.findUnique({
        where: {
          exchange_symbol: { exchange: order.exchange, symbol: order.symbol },
        },
        include: { quotes: { orderBy: { snapshotAt: "desc" }, take: 1 } },
      });
      if (!security)
        throw new OrderError(
          "UNSUPPORTED_SECURITY",
          "Security is not supported.",
        );
      const quote = security.quotes[0];
      if (!quote)
        throw new OrderError(
          "QUOTE_UNAVAILABLE",
          "Simulated quote unavailable.",
          503,
        );
      const where = {
        accountId_securityId: {
          accountId: account.id,
          securityId: security.id,
        },
      };
      const holding = await tx.holding.findUnique({ where });
      const result = calculateOrder(
        order.side,
        BigInt(order.quantity),
        quote.priceFils,
        account.cashBalanceFils,
        holding?.quantity ?? 0n,
        holding?.costBasisFils ?? 0n,
      );
      await tx.virtualAccount.update({
        where: { id: account.id, userId },
        data: { cashBalanceFils: result.cash },
      });
      if (result.quantity === 0n) {
        await tx.holding.delete({ where });
      } else {
        await tx.holding.upsert({
          where,
          create: {
            accountId: account.id,
            securityId: security.id,
            quantity: result.quantity,
            costBasisFils: result.basis,
          },
          update: { quantity: result.quantity, costBasisFils: result.basis },
        });
      }
      const trade = await tx.trade.create({
        data: {
          accountId: account.id,
          securityId: security.id,
          side: order.side,
          quantity: BigInt(order.quantity),
          priceFils: quote.priceFils,
          totalValueFils: result.total,
          idempotencyKey: order.idempotencyKey,
        },
      });
      return {
        trade: receipt(trade, {
          symbol: security.symbol,
          exchange: security.exchange,
        }),
        replayed: false,
      };
    },
    { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 },
  );
}

export async function listTrades(db: PrismaClient, userId: string) {
  const trades = await db.trade.findMany({
    where: { account: { userId } },
    include: { security: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return trades.map((trade) =>
    receipt(trade, {
      symbol: trade.security.symbol,
      exchange: trade.security.exchange,
    }),
  );
}
