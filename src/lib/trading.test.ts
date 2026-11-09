import { describe, expect, it } from "vitest";
import { calculateOrder, orderSchema } from "./trading";
describe("integer-fils order calculations", () => {
  it("buys at weighted total cost and sells proportionally", () => {
    expect(calculateOrder("BUY", 2n, 101n, 1000n, 3n, 300n)).toEqual({
      total: 202n,
      cash: 798n,
      quantity: 5n,
      basis: 502n,
    });
    expect(calculateOrder("SELL", 2n, 150n, 798n, 5n, 502n)).toEqual({
      total: 300n,
      cash: 1098n,
      quantity: 3n,
      basis: 302n,
    });
    expect(calculateOrder("SELL", 3n, 150n, 1098n, 3n, 302n).basis).toBe(0n);
  });
  it("rejects insufficient cash, shares and overflow without rounding money", () => {
    expect(() => calculateOrder("BUY", 1n, 101n, 100n, 0n, 0n)).toThrow("cash");
    expect(() => calculateOrder("SELL", 1n, 100n, 100n, 0n, 0n)).toThrow(
      "shares",
    );
    expect(() =>
      calculateOrder("BUY", 9007199254740991n, 100n, 100n, 0n, 0n),
    ).toThrow("range");
  });
  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null])(
    "rejects invalid quantity %s",
    (quantity) => {
      expect(
        orderSchema.safeParse({
          exchange: "DFM",
          symbol: "EMAAR",
          side: "BUY",
          quantity,
          idempotencyKey: "e2c5fc41-a884-4000-8000-000000000001",
        }).success,
      ).toBe(false);
    },
  );
});
