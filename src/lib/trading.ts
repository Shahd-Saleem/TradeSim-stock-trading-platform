import { z } from "zod";

export const orderSchema = z
  .object({
    exchange: z.enum(["DFM", "ADX"]),
    symbol: z.string().regex(/^[A-Z0-9]{1,20}$/),
    side: z.enum(["BUY", "SELL"]),
    quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    idempotencyKey: z.uuid(),
    quoteToken: z.string().min(1).max(2048).optional(),
  })
  .strict();
export type OrderInput = z.infer<typeof orderSchema>;
export class OrderError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
export function calculateOrder(
  side: OrderInput["side"],
  quantity: bigint,
  price: bigint,
  cash: bigint,
  owned: bigint,
  basis: bigint,
) {
  if (quantity <= 0n || price <= 0n || cash < 0n || owned < 0n || basis < 0n)
    throw new OrderError("INVALID_ORDER", "Invalid order or account values.");
  const total = quantity * price;
  if (total > MAX)
    throw new OrderError(
      "ORDER_TOO_LARGE",
      "Order exceeds the supported monetary range.",
    );
  if (side === "BUY" && total > cash)
    throw new OrderError("INSUFFICIENT_FUNDS", "Insufficient virtual cash.");
  if (side === "SELL" && quantity > owned)
    throw new OrderError("INSUFFICIENT_SHARES", "Insufficient owned shares.");
  const nextQuantity = side === "BUY" ? owned + quantity : owned - quantity;
  // Total cost basis represents a weighted average without rounding each share.
  // Partial sales release a proportional floor; full sales release all residual fils.
  const nextBasis =
    side === "BUY" ? basis + total : basis - (basis * quantity) / owned;
  const nextCash = side === "BUY" ? cash - total : cash + total;
  if ([nextQuantity, nextBasis, nextCash].some((value) => value > MAX))
    throw new OrderError(
      "ORDER_TOO_LARGE",
      "Result exceeds the supported account range.",
    );
  return { total, cash: nextCash, quantity: nextQuantity, basis: nextBasis };
}
